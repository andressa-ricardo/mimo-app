import { getDatabase } from '@/database/client';
import type { NewTaskInput } from '@/types/tasks';

export async function insertTask(input: NewTaskInput): Promise<void> {
  const database = await getDatabase();
  const now = Date.now();
  await database.runAsync(
    `INSERT INTO tasks (
       id, title, description, category_id, due_date, due_time, priority,
       reminder_enabled, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    input.id,
    input.title,
    input.description,
    input.categoryId,
    input.dueDate,
    input.dueTime,
    input.priority,
    now,
    now,
  );
}

export type ReminderTask = { id: string; title: string; due_date: string; due_time: string };

/** Pending tasks whose reminder the user asked for (scheduled or not). */
export async function listReminderTasks(): Promise<ReminderTask[]> {
  const database = await getDatabase();
  return database.getAllAsync<ReminderTask>(
    `SELECT id, title, due_date, due_time FROM tasks
     WHERE reminder_enabled = 1 AND completed_at IS NULL AND due_date IS NOT NULL AND due_time IS NOT NULL`,
  );
}

/** Forgets scheduled notification ids while keeping the user's reminder choice. */
export async function clearTaskReminderIds(): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('UPDATE tasks SET reminder_notification_id = NULL WHERE reminder_notification_id IS NOT NULL');
}

export async function setTaskReminder(taskId: string, notificationId: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE tasks SET reminder_enabled = 1, reminder_notification_id = ?, updated_at = ?
     WHERE id = ? AND due_time IS NOT NULL`,
    notificationId,
    Date.now(),
    taskId,
  );
}
