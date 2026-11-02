import { getDatabase } from '@/database/client';
import type { NewTaskInput, TaskItem } from '@/types/tasks';

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

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  category_id: string | null;
  category_name: string | null;
  due_date: string | null;
  due_time: string | null;
  priority: TaskItem['priority'];
  reminder_enabled: number;
  completed_at: number | null;
  created_at: number;
};

const SELECT_TASKS = `
  SELECT t.id, t.title, t.description, t.category_id, c.name AS category_name, t.due_date, t.due_time,
    t.priority, t.reminder_enabled, t.completed_at, t.created_at
  FROM tasks t LEFT JOIN categories c ON c.id = t.category_id`;

function mapTask(row: TaskRow): TaskItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    categoryId: row.category_id,
    categoryName: row.category_name,
    dueDate: row.due_date,
    dueTime: row.due_time,
    priority: row.priority,
    reminderEnabled: row.reminder_enabled === 1,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

export async function listTasks(): Promise<TaskItem[]> {
  const database = await getDatabase();
  return (await database.getAllAsync<TaskRow>(SELECT_TASKS)).map(mapTask);
}

/** Saves edits. The reminder choice is kept even if it cannot be scheduled right now. */
export async function updateTask(input: NewTaskInput, reminderEnabled: boolean): Promise<void> {
  const database = await getDatabase();
  const result = await database.runAsync(
    `UPDATE tasks SET title = ?, description = ?, category_id = ?, due_date = ?, due_time = ?, priority = ?,
       reminder_enabled = ?, reminder_notification_id = NULL, updated_at = ?
     WHERE id = ?`,
    input.title,
    input.description,
    input.categoryId,
    input.dueDate,
    input.dueTime,
    input.priority,
    reminderEnabled && input.dueTime !== null ? 1 : 0,
    Date.now(),
    input.id,
  );
  if (result.changes === 0) throw new Error('Tarefa não encontrada.');
}

export async function setTaskCompleted(id: string, completed: boolean): Promise<void> {
  const database = await getDatabase();
  const now = Date.now();
  await database.runAsync(
    'UPDATE tasks SET completed_at = ?, updated_at = ? WHERE id = ?',
    completed ? now : null,
    now,
    id,
  );
}

export async function deleteTask(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM tasks WHERE id = ?', id);
}

/** Tasks due inside [start, end] — only the visible calendar range is queried. */
export async function listTasksDueBetween(start: string, end: string): Promise<TaskItem[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<TaskRow>(`${SELECT_TASKS} WHERE t.due_date BETWEEN ? AND ?`, start, end);
  return rows.map(mapTask);
}

export async function getTask(id: string): Promise<TaskItem | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<TaskRow>(`${SELECT_TASKS} WHERE t.id = ?`, id);
  return row ? mapTask(row) : null;
}
