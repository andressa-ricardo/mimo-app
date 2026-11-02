import { SchedulableTriggerInputTypes, scheduleNotificationAsync } from 'expo-notifications';

import { listPaymentMethods } from '@/database/repositories/categories-repository';
import { getEntriesInRange } from '@/database/repositories/finance-repository';
import { getNotificationPreferences } from '@/database/repositories/preferences-repository';
import {
  BILL_CHANNEL_ID,
  BILL_REMINDER_KIND,
  cancelScheduledByKind,
  channelFor,
  hasNotificationPermission,
} from '@/services/notifications/task-reminders';
import { addMonthsToDateKey, combineDateAndTime, daysInMonth, toDateKey, type DateKey } from '@/utils/date';
import { formatCurrency } from '@/utils/format';

const REMINDER_TIME = '09:00';
const HORIZON_MONTHS = 2;
/** iOS keeps at most 64 pending local notifications; leave room for tasks. */
const MAX_BILL_REMINDERS = 30;

type BillReminder = { date: Date; title: string; body: string };

function cardDueDates(dueDay: number, from: DateKey, until: DateKey): DateKey[] {
  const dates: DateKey[] = [];
  for (let offset = 0; offset <= HORIZON_MONTHS; offset += 1) {
    const monthStart = addMonthsToDateKey(`${from.slice(0, 7)}-01`, offset);
    const [year, month] = monthStart.split('-').map(Number);
    const day = Math.min(dueDay, daysInMonth(year, month - 1));
    const date = `${monthStart.slice(0, 8)}${String(day).padStart(2, '0')}`;
    if (date >= from && date <= until) dates.push(date);
  }
  return dates;
}

/**
 * Rebuilds bill notifications (09:00 on the due date) for planned expenses
 * and credit card due days in the next two months. Recomputed from SQLite on
 * every call, so it never accumulates stale or duplicate notifications.
 */
export async function syncBillReminders(): Promise<void> {
  await cancelScheduledByKind(BILL_REMINDER_KIND);

  const preferences = await getNotificationPreferences();
  if (!preferences.billReminders || !(await hasNotificationPermission())) return;

  const now = Date.now();
  const today = toDateKey(new Date());
  const until = addMonthsToDateKey(today, HORIZON_MONTHS);
  const reminders: BillReminder[] = [];

  for (const entry of await getEntriesInRange(today, until)) {
    if (entry.type !== 'expense' || entry.status !== 'planned') continue;
    reminders.push({
      date: combineDateAndTime(entry.dueDate, REMINDER_TIME),
      title: 'Conta vence hoje',
      body: `${entry.description} · ${formatCurrency(entry.amountCents)}`,
    });
  }

  for (const method of await listPaymentMethods()) {
    if (method.kind !== 'credit' || method.dueDay === null) continue;
    for (const dueDate of cardDueDates(method.dueDay, today, until)) {
      reminders.push({
        date: combineDateAndTime(dueDate, REMINDER_TIME),
        title: 'Fatura vence hoje',
        body: `Fatura do ${method.name}`,
      });
    }
  }

  const upcoming = reminders
    .filter((reminder) => reminder.date.getTime() > now)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, MAX_BILL_REMINDERS);

  for (const reminder of upcoming) {
    try {
      await scheduleNotificationAsync({
        content: { title: reminder.title, body: reminder.body, data: { kind: BILL_REMINDER_KIND } },
        trigger: { type: SchedulableTriggerInputTypes.DATE, date: reminder.date, channelId: channelFor(BILL_CHANNEL_ID) },
      });
    } catch (error: unknown) {
      console.warn('Falha ao agendar lembrete de vencimento.', error);
    }
  }
}
