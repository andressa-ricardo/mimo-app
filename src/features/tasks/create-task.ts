import { insertTask, setTaskReminder } from '@/database/repositories/tasks-repository';
import { notifyDataChanged } from '@/services/events/data-events';
import {
  cancelTaskReminder,
  ensureReminderPermission,
  scheduleTaskReminder,
} from '@/services/notifications/task-reminders';
import type { NewTaskInput } from '@/types/tasks';
import { combineDateAndTime } from '@/utils/date';

export type ReminderOutcome = 'none' | 'scheduled' | 'denied' | 'failed';

/**
 * Saves the task first, then tries to schedule the reminder. A reminder
 * failure never loses the task; the outcome tells the UI what really happened.
 */
export async function createTask(input: NewTaskInput, withReminder: boolean): Promise<ReminderOutcome> {
  await insertTask(input);
  notifyDataChanged('tasks');

  if (!withReminder || input.dueTime === null) return 'none';

  const reminderDate = combineDateAndTime(input.dueDate, input.dueTime);
  if (reminderDate.getTime() <= Date.now()) return 'failed';

  const permission = await ensureReminderPermission();
  if (permission === 'denied') return 'denied';
  if (permission === 'unavailable') return 'failed';

  let notificationId: string | null = null;
  try {
    notificationId = await scheduleTaskReminder(input.id, input.title, reminderDate);
    await setTaskReminder(input.id, notificationId);
    return 'scheduled';
  } catch (error: unknown) {
    console.warn('Falha ao agendar lembrete.', error);
    if (notificationId) await cancelTaskReminder(notificationId).catch(() => undefined);
    return 'failed';
  }
}
