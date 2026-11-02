import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/database/client';
import { isPaletteColorKey, type PaletteColorKey } from '@/theme/category-colors';
import type {
  Appointment,
  AppointmentCategory,
  AppointmentInput,
  ReminderMinutes,
  Recurrence,
  SeriesScope,
} from '@/types/calendar';
import { addDaysToDateKey, daysBetween, type DateKey } from '@/utils/date';

type CategoryRow = { id: string; name: string; color: string; icon: string };

function mapCategory(row: CategoryRow): AppointmentCategory {
  return { id: row.id, name: row.name, color: isPaletteColorKey(row.color) ? row.color : 'blue', icon: row.icon };
}

export async function listAppointmentCategories(): Promise<AppointmentCategory[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<CategoryRow>(
    `SELECT id, name, color, icon FROM appointment_categories
     WHERE archived_at IS NULL ORDER BY is_system DESC, sort_order, created_at`,
  );
  return rows.map(mapCategory);
}

export async function createAppointmentCategory(
  name: string,
  color: PaletteColorKey,
  icon: string,
): Promise<AppointmentCategory> {
  const normalized = name.trim().replace(/\s+/g, ' ');
  if (!normalized) throw new Error('Informe um nome.');
  if (normalized.length > 40) throw new Error('Use até 40 caracteres.');
  const existing = (await listAppointmentCategories()).find(
    (category) => category.name.localeCompare(normalized, 'pt-BR', { sensitivity: 'accent' }) === 0,
  );
  if (existing) return existing;

  const database = await getDatabase();
  const category: AppointmentCategory = { id: randomUUID(), name: normalized, color, icon };
  await database.runAsync(
    `INSERT INTO appointment_categories (id, name, color, icon, sort_order, is_system, created_at)
     VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM appointment_categories), 0, ?)`,
    category.id,
    category.name,
    color,
    icon,
    Date.now(),
  );
  return category;
}

type AppointmentRow = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  category_id: string | null;
  start_date: DateKey;
  start_time: string | null;
  end_date: DateKey;
  end_time: string | null;
  all_day: number;
  recurrence: Recurrence;
  recurrence_until: DateKey | null;
  reminder_minutes: number | null;
  category_name: string | null;
  category_color: string | null;
  category_icon: string | null;
};

const SELECT_APPOINTMENTS = `
  SELECT a.id, a.title, a.description, a.location, a.category_id, a.start_date, a.start_time,
    a.end_date, a.end_time, a.all_day, a.recurrence, a.recurrence_until, a.reminder_minutes,
    c.name AS category_name, c.color AS category_color, c.icon AS category_icon
  FROM appointments a
  LEFT JOIN appointment_categories c ON c.id = a.category_id`;

async function attachExceptions(database: SQLiteDatabase, rows: AppointmentRow[]): Promise<Appointment[]> {
  const recurringIds = rows.filter((row) => row.recurrence !== 'none').map((row) => row.id);
  const exceptions = new Map<string, DateKey[]>();
  if (recurringIds.length > 0) {
    const exceptionRows = await database.getAllAsync<{ appointment_id: string; occurrence_date: DateKey }>(
      `SELECT appointment_id, occurrence_date FROM appointment_exceptions
       WHERE appointment_id IN (${recurringIds.map(() => '?').join(', ')})`,
      recurringIds,
    );
    for (const row of exceptionRows) {
      exceptions.set(row.appointment_id, [...(exceptions.get(row.appointment_id) ?? []), row.occurrence_date]);
    }
  }

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    categoryId: row.category_id,
    startDate: row.start_date,
    startTime: row.start_time,
    endDate: row.end_date,
    endTime: row.end_time,
    allDay: row.all_day === 1,
    recurrence: row.recurrence,
    recurrenceUntil: row.recurrence_until,
    reminderMinutes: row.reminder_minutes as ReminderMinutes | null,
    exceptions: exceptions.get(row.id) ?? [],
    category:
      row.category_id && row.category_name && row.category_color && row.category_icon
        ? mapCategory({ id: row.category_id, name: row.category_name, color: row.category_color, icon: row.category_icon })
        : null,
  }));
}

/**
 * Appointments that can produce an occurrence inside the range: one-offs that
 * overlap it, plus recurring series that started before its end and have not
 * ended before its start. Occurrences themselves are expanded in memory.
 */
export async function listAppointmentsInRange(rangeStart: DateKey, rangeEnd: DateKey): Promise<Appointment[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<AppointmentRow>(
    `${SELECT_APPOINTMENTS}
     WHERE a.start_date <= ?
       AND ((a.recurrence = 'none' AND a.end_date >= ?)
         OR (a.recurrence <> 'none' AND (a.recurrence_until IS NULL OR a.recurrence_until >= ?)))`,
    rangeEnd,
    rangeStart,
    // Series ended up to a year before the range may still have a long occurrence reaching into it.
    addDaysToDateKey(rangeStart, -366),
  );
  return attachExceptions(database, rows);
}

/** Appointments with a reminder, for scheduling notifications. */
export async function listAppointmentsWithReminders(): Promise<Appointment[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<AppointmentRow>(`${SELECT_APPOINTMENTS} WHERE a.reminder_minutes IS NOT NULL`);
  return attachExceptions(database, rows);
}

export async function getAppointment(id: string): Promise<Appointment | null> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<AppointmentRow>(`${SELECT_APPOINTMENTS} WHERE a.id = ?`, id);
  return (await attachExceptions(database, rows))[0] ?? null;
}

async function insertAppointment(
  database: SQLiteDatabase,
  input: AppointmentInput,
  recurrenceUntil: DateKey | null = null,
): Promise<string> {
  const id = randomUUID();
  const now = Date.now();
  await database.runAsync(
    `INSERT INTO appointments (
       id, title, description, location, category_id, start_date, start_time, end_date, end_time,
       all_day, recurrence, recurrence_until, reminder_minutes, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.title,
    input.description,
    input.location,
    input.categoryId,
    input.startDate,
    input.allDay ? null : input.startTime,
    input.endDate,
    input.allDay ? null : input.endTime,
    input.allDay ? 1 : 0,
    input.recurrence,
    input.recurrence === 'none' ? null : recurrenceUntil,
    input.reminderMinutes,
    now,
    now,
  );
  return id;
}

export async function createAppointment(input: AppointmentInput): Promise<string> {
  const database = await getDatabase();
  return insertAppointment(database, input);
}

async function updateRow(database: SQLiteDatabase, id: string, input: AppointmentInput): Promise<void> {
  const result = await database.runAsync(
    `UPDATE appointments SET title = ?, description = ?, location = ?, category_id = ?, start_date = ?,
       start_time = ?, end_date = ?, end_time = ?, all_day = ?, recurrence = ?, reminder_minutes = ?,
       recurrence_until = CASE WHEN ? = 'none' THEN NULL ELSE recurrence_until END, updated_at = ?
     WHERE id = ?`,
    input.title,
    input.description,
    input.location,
    input.categoryId,
    input.startDate,
    input.allDay ? null : input.startTime,
    input.endDate,
    input.allDay ? null : input.endTime,
    input.allDay ? 1 : 0,
    input.recurrence,
    input.reminderMinutes,
    input.recurrence,
    Date.now(),
    id,
  );
  if (result.changes === 0) throw new Error('Compromisso não encontrado.');
}

async function addException(database: SQLiteDatabase, id: string, occurrenceDate: DateKey): Promise<void> {
  await database.runAsync(
    `INSERT OR IGNORE INTO appointment_exceptions (appointment_id, occurrence_date, created_at) VALUES (?, ?, ?)`,
    id,
    occurrenceDate,
    Date.now(),
  );
}

/** Ends a series the day before `occurrenceDate` ("this and future" split). */
async function endSeriesBefore(database: SQLiteDatabase, id: string, occurrenceDate: DateKey): Promise<void> {
  await database.runAsync(
    'UPDATE appointments SET recurrence_until = ?, updated_at = ? WHERE id = ?',
    addDaysToDateKey(occurrenceDate, -1),
    Date.now(),
    id,
  );
}

/**
 * Edits an appointment. For recurring series the scope decides what changes:
 * - occurrence: the date is skipped in the series and a standalone copy is created;
 * - future: the series ends before this date and a new series starts from it;
 * - series: the whole series is updated in place.
 * `input` holds the edited values of the occurrence being edited.
 * Resolves with the id of the row that now holds those values.
 */
export async function updateAppointment(
  appointment: Appointment,
  occurrenceDate: DateKey,
  scope: SeriesScope,
  input: AppointmentInput,
): Promise<string> {
  const database = await getDatabase();
  let resultId = appointment.id;
  await database.withExclusiveTransactionAsync(async (transaction) => {
    if (appointment.recurrence === 'none' || scope === 'series' || (scope === 'future' && occurrenceDate === appointment.startDate)) {
      // Editing the whole series from a later occurrence keeps the series' own start
      // date (the time, duration and details change; the anchor date does not).
      const shift = appointment.recurrence !== 'none' && scope === 'series' && occurrenceDate !== appointment.startDate;
      await updateRow(
        transaction,
        appointment.id,
        shift ? { ...input, startDate: appointment.startDate, endDate: addDaysToDateKey(appointment.startDate, daysBetween(input.startDate, input.endDate)) } : input,
      );
      return;
    }
    if (scope === 'occurrence') {
      await addException(transaction, appointment.id, occurrenceDate);
      resultId = await insertAppointment(transaction, { ...input, recurrence: 'none' });
      return;
    }
    await endSeriesBefore(transaction, appointment.id, occurrenceDate);
    resultId = await insertAppointment(transaction, input, appointment.recurrenceUntil);
  });
  return resultId;
}

export async function deleteAppointment(
  appointment: Appointment,
  occurrenceDate: DateKey,
  scope: SeriesScope,
): Promise<void> {
  const database = await getDatabase();
  await database.withExclusiveTransactionAsync(async (transaction) => {
    if (appointment.recurrence === 'none' || scope === 'series' || (scope === 'future' && occurrenceDate === appointment.startDate)) {
      await transaction.runAsync('DELETE FROM appointments WHERE id = ?', appointment.id);
      return;
    }
    if (scope === 'occurrence') await addException(transaction, appointment.id, occurrenceDate);
    else await endSeriesBefore(transaction, appointment.id, occurrenceDate);
  });
}
