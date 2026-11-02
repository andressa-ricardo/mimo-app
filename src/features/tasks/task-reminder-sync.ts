import { getNotificationPreferences } from '@/database/repositories/preferences-repository';
import {
  clearTaskReminderIds,
  listReminderTasks,
  setTaskReminder,
} from '@/database/repositories/tasks-repository';
import {
  cancelScheduledByKind,
  hasNotificationPermission,
  scheduleTaskReminder,
  TASK_REMINDER_KIND,
} from '@/services/notifications/task-reminders';
import { combineDateAndTime, isDateKey, isTimeKey } from '@/utils/date';

/**
 * Rebuilds task notifications from SQLite: cancels all of them, then — when
 * the setting is on and permission exists — schedules every future reminder
 * the user asked for. Safe to call repeatedly.
 */
export async function syncTaskReminders(): Promise<void> {
  await cancelScheduledByKind(TASK_REMINDER_KIND);
  await clearTaskReminderIds();

  const preferences = await getNotificationPreferences();
  if (!preferences.taskReminders || !(await hasNotificationPermission())) return;

  const now = Date.now();
  for (const task of await listReminderTasks()) {
    if (!isDateKey(task.due_date) || !isTimeKey(task.due_time)) continue;
    const date = combineDateAndTime(task.due_date, task.due_time);
    if (date.getTime() <= now) continue;
    try {
      await setTaskReminder(task.id, await scheduleTaskReminder(task.id, task.title, date));
    } catch (error: unknown) {
      console.warn('Falha ao reagendar lembrete de tarefa.', error);
    }
  }
}
