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
