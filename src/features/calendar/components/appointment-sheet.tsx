import { useRef, useState } from 'react';
import { View } from 'react-native';

import {
  BottomSheet,
  BottomSheetFooter,
  BottomSheetScrollView,
  useBottomSheetDirty,
} from '@/components/forms/bottom-sheet';
import { DateField } from '@/components/forms/date-field';
import { PrimaryButton } from '@/components/forms/primary-button';
import { SegmentedControl } from '@/components/forms/segmented-control';
import { SelectField } from '@/components/forms/select-field';
import { TextField } from '@/components/forms/text-field';
import { TimeField } from '@/components/forms/time-field';
import { ToggleField, ToggleGroup } from '@/components/forms/toggle-field';
import { AppText } from '@/components/ui/app-text';
import { ChoiceDialog } from '@/components/ui/choice-dialog';
import { AppointmentCategoryPicker } from '@/features/calendar/components/appointment-category-picker';
import { saveAppointmentEdit, saveNewAppointment } from '@/features/calendar/save-appointment';
import { FormError, formStyles } from '@/features/quick-actions/form-parts';
import { describeError } from '@/features/quick-actions/use-form-options';
import type { Appointment, AppointmentInput, Recurrence, ReminderMinutes, SeriesScope } from '@/types/calendar';
import {
  addDaysToDateKey,
  daysBetween,
  minutesToTimeKey,
  nextFullHour,
  timeKeyToMinutes,
  type DateKey,
  type TimeKey,
} from '@/utils/date';

export type AppointmentSheetMode =
  | { kind: 'create'; date: DateKey }
  | { kind: 'edit'; appointment: Appointment; occurrenceDate: DateKey };

const recurrenceOptions = [
  { value: 'none', label: 'Não' },
  { value: 'daily', label: 'Diária' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensal' },
] as const;

export const reminderOptions: { value: ReminderMinutes; label: string }[] = [
  { value: 0, label: 'Na hora do evento' },
  { value: 5, label: '5 minutos antes' },
  { value: 15, label: '15 minutos antes' },
  { value: 30, label: '30 minutos antes' },
  { value: 60, label: '1 hora antes' },
  { value: 1440, label: '1 dia antes' },
];

function initialValues(mode: AppointmentSheetMode): AppointmentInput {
  if (mode.kind === 'edit') {
    const { appointment, occurrenceDate } = mode;
    const span = daysBetween(appointment.startDate, appointment.endDate);
    return {
      title: appointment.title,
      description: appointment.description,
      location: appointment.location,
      categoryId: appointment.categoryId,
      // The form edits the tapped occurrence, not the series' first date.
      startDate: occurrenceDate,
      startTime: appointment.startTime,
      endDate: addDaysToDateKey(occurrenceDate, span),
      endTime: appointment.endTime,
      allDay: appointment.allDay,
      recurrence: appointment.recurrence,
      reminderMinutes: appointment.reminderMinutes,
    };
  }
  const start = nextFullHour(new Date());
  return {
    title: '',
    description: null,
    location: null,
    categoryId: null,
    startDate: mode.date,
    startTime: start,
    endDate: mode.date,
    endTime: minutesToTimeKey(timeKeyToMinutes(start) + 60),
    allDay: false,
    recurrence: 'none',
    reminderMinutes: null,
  };
}

function AppointmentForm({ mode, onSaved }: { mode: AppointmentSheetMode; onSaved: (message: string) => void }) {
  const [initial] = useState(() => initialValues(mode));
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description ?? '');
  const [location, setLocation] = useState(initial.location ?? '');
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [allDay, setAllDay] = useState(initial.allDay);
  const [startDate, setStartDate] = useState(initial.startDate);
  const [startTime, setStartTime] = useState<TimeKey | null>(initial.startTime);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [endTime, setEndTime] = useState<TimeKey | null>(initial.endTime);
  const [recurrence, setRecurrence] = useState<Recurrence>(initial.recurrence);
  const [reminderMinutes, setReminderMinutes] = useState<ReminderMinutes | null>(initial.reminderMinutes);
  const [errors, setErrors] = useState<{ title?: string; time?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [askScope, setAskScope] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const editing = mode.kind === 'edit' ? mode : null;

  useBottomSheetDirty(
    title.trim() !== initial.title ||
      description.trim() !== (initial.description ?? '') ||
      location.trim() !== (initial.location ?? '') ||
      categoryId !== initial.categoryId ||
      allDay !== initial.allDay ||
      startDate !== initial.startDate ||
      startTime !== initial.startTime ||
      endDate !== initial.endDate ||
      endTime !== initial.endTime ||
      recurrence !== initial.recurrence ||
      reminderMinutes !== initial.reminderMinutes,
  );

  // Moving the start keeps the duration, like native calendars do.
  const changeStartDate = (next: DateKey) => {
    setEndDate((current) => addDaysToDateKey(next, Math.max(daysBetween(startDate, current), 0)));
    setStartDate(next);
  };
  const changeStartTime = (next: TimeKey | null) => {
    if (next && startTime && endTime && startDate === endDate) {
      const duration = Math.max(timeKeyToMinutes(endTime) - timeKeyToMinutes(startTime), 0);
      setEndTime(minutesToTimeKey(timeKeyToMinutes(next) + duration));
    }
    setStartTime(next);
  };

  const buildInput = (): AppointmentInput | null => {
    const nextErrors: typeof errors = {};
    if (!title.trim()) nextErrors.title = 'Dê um título ao compromisso.';
    if (!allDay && (!startTime || !endTime)) nextErrors.time = 'Informe o horário de início e de fim, ou marque "Dia todo".';
    else if (endDate < startDate || (!allDay && endDate === startDate && endTime! < startTime!)) {
      nextErrors.time = 'O fim não pode ser antes do início.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return null;
    return {
      title: title.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      categoryId,
      startDate,
      startTime: allDay ? null : startTime,
      endDate,
      endTime: allDay ? null : endTime,
      allDay,
      recurrence,
      reminderMinutes,
    };
  };

  const save = async (input: AppointmentInput, scope: SeriesScope) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setFormError(null);
    try {
      const message = editing
        ? await saveAppointmentEdit(editing.appointment, editing.occurrenceDate, scope, input)
        : await saveNewAppointment(input);
      onSaved(message);
    } catch (error: unknown) {
      setAskScope(false);
      setFormError(describeError(error, 'Não foi possível salvar o compromisso. Tente novamente.'));
      savingRef.current = false;
      setSaving(false);
    }
  };

  const submit = () => {
    const input = buildInput();
    if (!input) return;
    // Recurring series ask which occurrences the change applies to.
    if (editing && editing.appointment.recurrence !== 'none') setAskScope(true);
    else void save(input, 'series');
  };

  const chooseScope = (scope: SeriesScope) => {
    const input = buildInput();
    if (input) void save(input, scope);
  };

  return (
    <>
      <BottomSheetScrollView>
        <TextField
          autoFocus={!editing}
          error={errors.title}
          large
          maxLength={120}
          onChangeText={(text) => {
            setTitle(text);
            if (errors.title) setErrors((current) => ({ ...current, title: undefined }));
          }}
          placeholder="Título do compromisso"
          value={title}
        />

        <ToggleGroup>
          <ToggleField label="Dia todo" onChange={setAllDay} value={allDay} />
        </ToggleGroup>

        <View style={formStyles.row}>
          <DateField containerStyle={formStyles.half} label="Início" onChange={changeStartDate} value={startDate} />
          {allDay ? null : (
            <TimeField containerStyle={formStyles.half} label="Hora" onChange={changeStartTime} value={startTime} />
          )}
        </View>
        <View style={formStyles.row}>
          <DateField containerStyle={formStyles.half} label="Fim" onChange={setEndDate} value={endDate} />
          {allDay ? null : <TimeField containerStyle={formStyles.half} label="Hora" onChange={setEndTime} value={endTime} />}
        </View>
        {errors.time ? <FormError message={errors.time} /> : null}

        <TextField label="Local (opcional)" maxLength={120} onChangeText={setLocation} placeholder="Ex.: Consultório, Zoom" value={location} />

        <AppointmentCategoryPicker onChange={setCategoryId} value={categoryId} />

        <View style={formStyles.group}>
          <AppText color="secondary" variant="label">
            Repetir
          </AppText>
          <SegmentedControl accessibilityLabel="Repetição" onChange={setRecurrence} options={recurrenceOptions} value={recurrence} />
        </View>

        <SelectField
          label="Lembrete"
          noneLabel="Sem lembrete"
          onChange={(value) => setReminderMinutes(value === null ? null : (Number(value) as ReminderMinutes))}
          options={reminderOptions.map((option) => ({ value: String(option.value), label: option.label }))}
          value={reminderMinutes === null ? null : String(reminderMinutes)}
        />

        <TextField label="Descrição (opcional)" maxLength={1000} multiline onChangeText={setDescription} value={description} />

        {formError ? <FormError message={formError} /> : null}
      </BottomSheetScrollView>
      <BottomSheetFooter>
        <PrimaryButton label="Salvar compromisso" loading={saving && !askScope} onPress={submit} />
      </BottomSheetFooter>

      <ChoiceDialog
        choices={[
          { label: 'Só esta ocorrência', onPress: () => chooseScope('occurrence') },
          { label: 'Esta e as próximas', onPress: () => chooseScope('future') },
          { label: 'Toda a série', onPress: () => chooseScope('series') },
        ]}
        loading={saving}
        message="Este compromisso se repete. Onde aplicar as alterações?"
        onCancel={() => setAskScope(false)}
        title="Editar compromisso recorrente"
        visible={askScope}
      />
    </>
  );
}

type AppointmentSheetProps = {
  mode: AppointmentSheetMode | null;
  onClose: () => void;
  onSaved: (message: string) => void;
};

export function AppointmentSheet({ mode, onClose, onSaved }: AppointmentSheetProps) {
  // Keep the last content while the sheet animates out after `mode` is cleared.
  const [shown, setShown] = useState<AppointmentSheetMode | null>(null);
  if (mode && mode !== shown) setShown(mode);

  return (
    <BottomSheet
      onRequestClose={onClose}
      title={shown?.kind === 'edit' ? 'Editar compromisso' : 'Novo compromisso'}
      visible={mode !== null}>
      {shown ? <AppointmentForm mode={shown} onSaved={onSaved} /> : null}
    </BottomSheet>
  );
}
