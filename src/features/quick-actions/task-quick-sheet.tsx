import { randomUUID } from 'expo-crypto';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  BottomSheet,
  BottomSheetFooter,
  BottomSheetScrollView,
  useBottomSheetDirty,
} from '@/components/forms/bottom-sheet';
import { CategorySelector } from '@/components/forms/category-selector';
import { DateField } from '@/components/forms/date-field';
import { PrimaryButton } from '@/components/forms/primary-button';
import { SegmentedControl } from '@/components/forms/segmented-control';
import { TextField } from '@/components/forms/text-field';
import { TimeField } from '@/components/forms/time-field';
import { ToggleField, ToggleGroup } from '@/components/forms/toggle-field';
import { AppText } from '@/components/ui/app-text';
import { FormError, formStyles } from '@/features/quick-actions/form-parts';
import {
  describeError,
  priorityOptions,
  useCategories,
  useNow,
  type QuickSheetProps,
} from '@/features/quick-actions/use-form-options';
import { createTask, type ReminderOutcome } from '@/features/tasks/create-task';
import { getNotificationPreferences } from '@/database/repositories/preferences-repository';
import { ensureReminderPermission, getExactAlarmStatus } from '@/services/notifications/task-reminders';
import type { Priority } from '@/types/tasks';
import { combineDateAndTime, formatDateKey, toDateKey, type DateKey, type TimeKey } from '@/utils/date';

const successMessages: Record<ReminderOutcome, string> = {
  none: 'Tarefa salva.',
  scheduled: 'Tarefa salva com lembrete.',
  denied: 'Tarefa salva. O lembrete não foi agendado porque as notificações estão desativadas.',
  failed: 'Tarefa salva, mas não foi possível agendar o lembrete.',
  disabled: 'Tarefa salva. Lembretes de tarefas estão desativados em Configurações.',
};

/** Whether "Lembretes de tarefas" is on in Configurações (assumed on until loaded). */
function useTaskRemindersSetting(): boolean {
  const [allowed, setAllowed] = useState(true);
  useEffect(() => {
    let active = true;
    getNotificationPreferences()
      .then((preferences) => {
        if (active) setAllowed(preferences.taskReminders);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  return allowed;
}

/** Says exactly when the reminder fires, so a wrong AM/PM pick is obvious. */
async function describeScheduledReminder(dueDate: DateKey, dueTime: TimeKey, today: DateKey): Promise<string> {
  const day = dueDate === today ? 'hoje' : `em ${formatDateKey(dueDate)}`;
  const delayNote =
    (await getExactAlarmStatus()) === 'inexact'
      ? ' O Android pode entregá-lo alguns minutos depois — veja Configurações.'
      : '';
  return `Tarefa salva. Lembrete ${day} às ${dueTime}.${delayNote}`;
}

function TaskForm({ onSaved }: { onSaved: QuickSheetProps['onSaved'] }) {
  const [taskId] = useState(() => randomUUID());
  const [initialDate] = useState(() => toDateKey(new Date()));
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(initialDate);
  const [dueTime, setDueTime] = useState<TimeKey | null>(null);
  const [priority, setPriority] = useState<Priority>('medium');
  const [showDetails, setShowDetails] = useState(false);
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [reminder, setReminder] = useState(false);
  const [reminderNotice, setReminderNotice] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const { categories, addCategory } = useCategories('task');
  const now = useNow(30_000);
  const remindersAllowed = useTaskRemindersSetting();

  const reminderDate = dueTime ? combineDateAndTime(dueDate, dueTime) : null;
  const canRemind = remindersAllowed && reminderDate !== null && reminderDate.getTime() > now;
  const reminderActive = reminder && canRemind;

  useBottomSheetDirty(
    title.trim().length > 0 ||
      description.trim().length > 0 ||
      dueTime !== null ||
      dueDate !== initialDate ||
      priority !== 'medium' ||
      categoryId !== null ||
      reminder,
  );

  const toggleReminder = async (enabled: boolean) => {
    setReminderNotice(null);
    if (!enabled) {
      setReminder(false);
      return;
    }
    setReminder(true);
    const permission = await ensureReminderPermission();
    if (permission === 'granted') return;
    setReminder(false);
    setReminderNotice(
      permission === 'denied'
        ? 'Notificações desativadas. Ative-as nas configurações do sistema para usar lembretes.'
        : 'Lembretes não estão disponíveis neste dispositivo.',
    );
  };

  const submit = async () => {
    if (savingRef.current) return;
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      setTitleError('Informe o que precisa ser feito.');
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setFormError(null);
    try {
      const outcome = await createTask(
        {
          id: taskId,
          title: normalizedTitle,
          description: description.trim() || null,
          categoryId,
          dueDate,
          dueTime,
          priority,
        },
        reminderActive,
      );
      onSaved(
        outcome === 'scheduled' && dueTime
          ? await describeScheduledReminder(dueDate, dueTime, initialDate)
          : successMessages[outcome],
      );
    } catch (error: unknown) {
      setFormError(describeError(error, 'Não foi possível salvar a tarefa. Tente novamente.'));
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <>
      <BottomSheetScrollView>
        <TextField
          autoFocus
          error={titleError}
          maxLength={120}
          onChangeText={(text) => {
            setTitle(text);
            if (titleError) setTitleError(null);
          }}
          placeholder="O que precisa ser feito?"
          returnKeyType="done"
          large
          value={title}
        />

        <View style={styles.row}>
          <DateField containerStyle={styles.half} label="Data" onChange={setDueDate} value={dueDate} />
          <TimeField containerStyle={styles.half} label="Hora (opcional)" onChange={setDueTime} value={dueTime} />
        </View>

        <View style={styles.group}>
          <AppText color="secondary" variant="label">
            Prioridade
          </AppText>
          <SegmentedControl
            accessibilityLabel="Prioridade"
            onChange={setPriority}
            options={priorityOptions}
            value={priority}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showDetails }}
          hitSlop={8}
          onPress={() => setShowDetails((current) => !current)}
          style={styles.detailsToggle}>
          <AppText color="accent" variant="label">
            {showDetails ? '− Menos detalhes' : '+ Mais detalhes'}
          </AppText>
        </Pressable>

        {showDetails ? (
          <>
            <TextField
              label="Descrição"
              maxLength={1000}
              multiline
              onChangeText={setDescription}
              placeholder="Opcional"
              value={description}
            />
            <CategorySelector
              categories={categories}
              onChange={setCategoryId}
              onCreate={addCategory}
              value={categoryId}
            />
          </>
        ) : null}

        <View style={styles.group}>
          <ToggleGroup>
            <ToggleField
              description={
                !remindersAllowed
                  ? 'Desativado em Configurações'
                  : canRemind
                    ? 'Notificação no horário definido'
                    : 'Defina um horário futuro para ativar'
              }
              disabled={!canRemind}
              label="Lembrete local"
              onChange={(enabled) => void toggleReminder(enabled)}
              value={reminderActive}
            />
          </ToggleGroup>
          {reminderNotice ? (
            <AppText color="secondary" variant="caption">
              {reminderNotice}
            </AppText>
          ) : null}
        </View>

        {formError ? <FormError message={formError} /> : null}
      </BottomSheetScrollView>
      <BottomSheetFooter>
        <PrimaryButton label="Salvar tarefa" loading={saving} onPress={() => void submit()} />
      </BottomSheetFooter>
    </>
  );
}

export function TaskQuickSheet({ onClose, onSaved, visible }: QuickSheetProps) {
  return (
    <BottomSheet onRequestClose={onClose} title="Nova tarefa" visible={visible}>
      <TaskForm onSaved={onSaved} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  ...formStyles,
  detailsToggle: {
    alignSelf: 'flex-start',
  },
});
