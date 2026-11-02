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
import { createTask, editTask, type ReminderOutcome } from '@/features/tasks/create-task';
import {
  getNotificationPreferences,
  saveNotificationPreferences,
} from '@/database/repositories/preferences-repository';
import { ensureReminderPermission, getExactAlarmStatus } from '@/services/notifications/task-reminders';
import type { Priority, TaskItem } from '@/types/tasks';
import { combineDateAndTime, formatDateKey, nextFullHour, toDateKey, type DateKey, type TimeKey } from '@/utils/date';

const successMessages: Record<ReminderOutcome, string> = {
  none: 'Tarefa salva.',
  scheduled: 'Tarefa salva com lembrete.',
  denied: 'Tarefa salva. O lembrete não foi agendado porque as notificações estão desativadas.',
  failed: 'Tarefa salva, mas não foi possível agendar o lembrete.',
  disabled: 'Tarefa salva. Lembretes de tarefas estão desativados em Configurações.',
};

/** "Lembretes de tarefas" in Configurações (assumed on until loaded), plus a way to switch it on. */
function useTaskRemindersSetting(): [boolean, () => Promise<void>] {
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

  const enable = async () => {
    const preferences = await getNotificationPreferences();
    if (!preferences.taskReminders) await saveNotificationPreferences({ ...preferences, taskReminders: true });
    setAllowed(true);
  };
  return [allowed, enable];
}

const dayLabel = (dueDate: DateKey, today: DateKey) => (dueDate === today ? 'hoje' : formatDateKey(dueDate));

/** Says exactly when the reminder fires, so a wrong AM/PM pick is obvious. */
async function describeScheduledReminder(
  dueDate: DateKey,
  dueTime: TimeKey,
  today: DateKey,
  verb: string,
): Promise<string> {
  const day = dueDate === today ? 'hoje' : `em ${formatDateKey(dueDate)}`;
  const delayNote =
    (await getExactAlarmStatus()) === 'inexact'
      ? ' O Android pode entregá-lo alguns minutos depois — veja Configurações.'
      : '';
  return `Tarefa ${verb}. Lembrete ${day} às ${dueTime}.${delayNote}`;
}

type TaskFormProps = {
  onSaved: QuickSheetProps['onSaved'];
  /** When set, the form edits this task instead of creating one. */
  task: TaskItem | null;
};

function TaskForm({ onSaved, task }: TaskFormProps) {
  const [taskId] = useState(() => task?.id ?? randomUUID());
  const [today] = useState(() => toDateKey(new Date()));
  const [initial] = useState(() => ({
    title: task?.title ?? '',
    dueDate: task?.dueDate ?? today,
    dueTime: task?.dueTime ?? null,
    priority: task?.priority ?? ('medium' as Priority),
    description: task?.description ?? '',
    categoryId: task?.categoryId ?? null,
    reminder: task?.reminderEnabled ?? false,
  }));
  const [title, setTitle] = useState(initial.title);
  const [dueDate, setDueDate] = useState(initial.dueDate);
  const [dueTime, setDueTime] = useState<TimeKey | null>(initial.dueTime);
  const [priority, setPriority] = useState<Priority>(initial.priority);
  const [showDetails, setShowDetails] = useState(Boolean(initial.description || initial.categoryId));
  const [description, setDescription] = useState(initial.description);
  const [categoryId, setCategoryId] = useState<string | null>(initial.categoryId);
  const [reminder, setReminder] = useState(initial.reminder);
  // Once the user flips the switch, picking a time no longer changes it.
  const [reminderTouched, setReminderTouched] = useState(task !== null);
  const [reminderNotice, setReminderNotice] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const { categories, addCategory } = useCategories('task');
  const now = useNow(30_000);
  const [remindersAllowed, enableReminderSetting] = useTaskRemindersSetting();

  const reminderDate = dueTime ? combineDateAndTime(dueDate, dueTime) : null;
  const timeIsFuture = reminderDate !== null && reminderDate.getTime() > now;
  const reminderActive = reminder && remindersAllowed && timeIsFuture;

  const reminderDescription = !reminder
    ? remindersAllowed
      ? 'Avisa no horário da tarefa'
      : 'Lembretes de tarefas estão desligados — toque para ligar'
    : !dueTime
      ? 'Escolha um horário para o lembrete'
      : !timeIsFuture
        ? 'Esse horário já passou — escolha um horário futuro'
        : `Notificação ${dayLabel(dueDate, today)} às ${dueTime}`;

  useBottomSheetDirty(
    title.trim() !== initial.title ||
      description.trim() !== initial.description ||
      dueTime !== initial.dueTime ||
      dueDate !== initial.dueDate ||
      priority !== initial.priority ||
      categoryId !== initial.categoryId ||
      reminder !== initial.reminder,
  );

  /** Turns the reminder on: asks permission, switches the setting on and fills a time if missing. */
  const enableReminder = async (): Promise<boolean> => {
    setReminderNotice(null);
    const permission = await ensureReminderPermission();
    if (permission !== 'granted') {
      setReminder(false);
      setReminderNotice(
        permission === 'denied'
          ? 'As notificações estão bloqueadas. Ative-as nas configurações do sistema para usar lembretes.'
          : 'Lembretes não estão disponíveis neste dispositivo.',
      );
      return false;
    }
    if (!remindersAllowed) await enableReminderSetting();
    setReminder(true);
    return true;
  };

  const toggleReminder = async (enabled: boolean) => {
    setReminderTouched(true);
    if (!enabled) {
      setReminder(false);
      setReminderNotice(null);
      return;
    }
    if (await enableReminder()) {
      if (!dueTime) setDueTime(nextFullHour(new Date()));
    }
  };

  // Choosing a time turns the reminder on, unless the user already decided.
  const changeDueTime = (next: TimeKey | null) => {
    setDueTime(next);
    if (next && !dueTime && !reminderTouched && remindersAllowed) void enableReminder();
  };

  const submit = async () => {
    if (savingRef.current) return;
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      setTitleError('Informe o que precisa ser feito.');
      return;
    }
    // Never save silently without the reminder the user turned on.
    if (reminder && remindersAllowed && !reminderActive) {
      setReminderNotice(
        dueTime
          ? 'O horário do lembrete já passou. Escolha um horário futuro ou desligue o lembrete.'
          : 'Escolha um horário para o lembrete ou desligue-o.',
      );
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setFormError(null);
    try {
      const input = {
        id: taskId,
        title: normalizedTitle,
        description: description.trim() || null,
        categoryId,
        dueDate,
        dueTime,
        priority,
      };
      const outcome = task ? await editTask(input, reminderActive) : await createTask(input, reminderActive);
      const verb = task ? 'atualizada' : 'salva';
      onSaved(
        outcome === 'scheduled' && dueTime
          ? await describeScheduledReminder(dueDate, dueTime, today, verb)
          : successMessages[outcome].replace('Tarefa salva', `Tarefa ${verb}`),
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
          autoFocus={!task}
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
          <TimeField containerStyle={styles.half} label="Hora (opcional)" onChange={changeDueTime} value={dueTime} />
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
            {/* Always tappable: turning it on fills a time and switches the setting on if needed. */}
            <ToggleField
              description={reminderDescription}
              label="Lembrete local"
              onChange={(enabled) => void toggleReminder(enabled)}
              value={reminder && remindersAllowed}
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

type TaskQuickSheetProps = QuickSheetProps & { task?: TaskItem | null };

export function TaskQuickSheet({ onClose, onSaved, task = null, visible }: TaskQuickSheetProps) {
  return (
    <BottomSheet onRequestClose={onClose} title={task ? 'Editar tarefa' : 'Nova tarefa'} visible={visible}>
      <TaskForm onSaved={onSaved} task={task} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  ...formStyles,
  detailsToggle: {
    alignSelf: 'flex-start',
  },
});
