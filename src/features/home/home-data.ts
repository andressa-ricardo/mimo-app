import { getDatabase } from '@/database/client';
import { getConfirmedTotal } from '@/database/repositories/finance-repository';
import { WISHLIST_FILE_OWNER } from '@/database/repositories/wishlist-repository';
import type { HomeSummary, HomeTask, HomeWishlistItem } from '@/features/home/home-types';
import { storedImageUri } from '@/services/images/image-storage';
import { getMonthRange, parseDateKey, toDateKey, toTimeKey, type DateKey } from '@/utils/date';

const HOME_TASK_LIMIT = 5;
const HOME_WISHLIST_LIMIT = 8;

type TaskRow = {
  id: string;
  title: string;
  due_date: DateKey | null;
  due_time: string | null;
  priority: HomeTask['priority'];
};

const shortDateFormatter = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });

function describeDue(row: TaskRow, today: DateKey, tomorrow: DateKey): string | null {
  if (!row.due_date) return null;
  const day =
    row.due_date === today
      ? 'Hoje'
      : row.due_date === tomorrow
        ? 'Amanhã'
        : shortDateFormatter.format(parseDateKey(row.due_date));
  return row.due_time ? `${day} · ${row.due_time}` : day;
}

async function loadTasks(now: Date): Promise<HomeTask[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<TaskRow>(
    `SELECT id, title, due_date, due_time, priority FROM tasks
     WHERE completed_at IS NULL
     ORDER BY due_date IS NULL, due_date, due_time IS NULL, due_time,
       CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, created_at
     LIMIT ?`,
    HOME_TASK_LIMIT,
  );

  const today = toDateKey(now);
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(now.getDate() + 1);
  const tomorrow = toDateKey(tomorrowDate);
  const currentTime = toTimeKey(now);

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    dueAt: describeDue(row, today, tomorrow),
    priority: row.priority,
    isOverdue:
      row.due_date !== null &&
      (row.due_date < today || (row.due_date === today && row.due_time !== null && row.due_time < currentTime)),
  }));
}

async function loadWishlist(): Promise<HomeWishlistItem[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{
    id: string;
    name: string;
    price_cents: number | null;
    relative_path: string | null;
  }>(
    `SELECT w.id, w.name, w.price_cents,
       (SELECT f.relative_path FROM file_references r
        JOIN stored_files f ON f.id = r.file_id
        WHERE r.owner_type = ? AND r.owner_id = w.id
        ORDER BY r.created_at LIMIT 1) AS relative_path
     FROM wishlist_items w
     WHERE w.purchased_at IS NULL
     ORDER BY CASE w.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, w.created_at DESC
     LIMIT ?`,
    WISHLIST_FILE_OWNER,
    HOME_WISHLIST_LIMIT,
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    priceCents: row.price_cents,
    imageUri: storedImageUri(row.relative_path),
  }));
}

/**
 * Aggregation boundary for the Home screen. Each module contributes a small,
 * limited query; modules without a schema yet return explicit empty lists.
 */
export async function loadHomeSummary(): Promise<HomeSummary> {
  const now = new Date();
  const month = getMonthRange(now);
  const [expenseCents, tasks, wishlist] = await Promise.all([
    getConfirmedTotal('expense', month.start, month.end),
    loadTasks(now),
    loadWishlist(),
  ]);

  return {
    monthlyFinance: { expenseCents, budgetCents: null },
    tasks,
    plans: [],
    wishlist,
    goals: [],
    notes: [],
  };
}
