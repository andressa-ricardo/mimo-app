import { getNotificationPreferences } from '@/database/repositories/preferences-repository';
import {
  deleteTask,
  insertTask,
  setTaskCompleted,
  setTaskReminder,
  updateTask,
} from '@/database/repositories/tasks-repository';
import { notifyDataChanged } from '@/services/events/data-events';
import { syncTaskRemindersNow } from '@/services/notifications/notification-sync';
import {
  cancelTaskReminder,
  ensureReminderPermission,
  scheduleTaskReminder,
} from '@/services/notifications/task-reminders';
import type { NewTaskInput } from '@/types/tasks';
import { combineDateAndTime } from '@/utils/date';

export type ReminderOutcome = 'none' | 'scheduled' | 'denied' | 'failed' | 'disabled';

/**
 * Saves the task first, then tries to schedule the reminder. A reminder
 * failure never loses the task; the outcome tells the UI what really happened.
 */
export async function createTask(input: NewTaskInput, withReminder: boolean): Promise<ReminderOutcome> {
  await insertTask(input);
  notifyDataChanged('tasks');

  if (!withReminder || input.dueTime === null) return 'none';
  if (!(await getNotificationPreferences()).taskReminders) return 'disabled';

  const reminderDate = combineDateAndTime(input.dueDate, input.dueTime);
  if (reminderDate.getTime() <= Date.now()) return 'failed';

  const permission = await ensureReminderPermission();
  if (permission === 'denied') return 'denied';
  if (permission === 'unavailable') return 'failed';

  let notificationId: string | null = null;
  try {
    notificationId = await scheduleTaskReminder(input.id, input.title, reminderDate);
    console.info(`Lembrete agendado para ${reminderDate.toLocaleString('pt-BR')} (id ${notificationId}).`);
    await setTaskReminder(input.id, notificationId);
    return 'scheduled';
  } catch (error: unknown) {
    console.warn('Falha ao agendar lembrete.', error);
    if (notificationId) await cancelTaskReminder(notificationId).catch(() => undefined);
    return 'failed';
  }
}

/**
 * Saves edits, then rebuilds task notifications from SQLite so the reminder
 * follows the new date/time (or disappears when turned off).
 */
export async function editTask(input: NewTaskInput, withReminder: boolean): Promise<ReminderOutcome> {
  const wantsReminder = withReminder && input.dueTime !== null;
  let outcome: ReminderOutcome = 'none';
  if (wantsReminder) {
    if (!(await getNotificationPreferences()).taskReminders) outcome = 'disabled';
    else {
      const permission = await ensureReminderPermission();
      outcome = permission === 'granted' ? 'scheduled' : permission === 'denied' ? 'denied' : 'failed';
    }
  }

  await updateTask(input, wantsReminder);
  notifyDataChanged('tasks');
  await syncTaskRemindersNow();
  return outcome;
}

/** Completing a task cancels its reminder; reopening it reschedules a future one. */
export async function toggleTaskCompleted(id: string, completed: boolean): Promise<void> {
  await setTaskCompleted(id, completed);
  notifyDataChanged('tasks');
  await syncTaskRemindersNow();
}

export async function removeTask(id: string): Promise<void> {
  await deleteTask(id);
  notifyDataChanged('tasks');
  await syncTaskRemindersNow();
}
