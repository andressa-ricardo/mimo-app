import { useEffect, useState } from 'react';

import { listAppointmentsInRange } from '@/database/repositories/appointments-repository';
import { listPaymentMethods } from '@/database/repositories/categories-repository';
import { getEntriesInRange } from '@/database/repositories/finance-repository';
import { listGoals } from '@/database/repositories/goals-repository';
import { listTasksDueBetween } from '@/database/repositories/tasks-repository';
import { expandOccurrences } from '@/features/calendar/recurrence';
import { subscribeToDataChanges } from '@/services/events/data-events';
import { paletteColor } from '@/theme/category-colors';
import type { ThemeColors } from '@/theme/tokens';
import type { CalendarEvent } from '@/types/calendar';
import { addDaysToDateKey, daysBetween, daysInMonth, type DateKey } from '@/utils/date';
import { formatCurrency } from '@/utils/format';

type BuildContext = { colors: ThemeColors; isDark: boolean };

async function appointmentEvents(start: DateKey, end: DateKey, { colors, isDark }: BuildContext): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = [];
  for (const appointment of await listAppointmentsInRange(start, end)) {
    const color = appointment.category ? paletteColor(appointment.category.color, isDark) : colors.accent;
    const icon = appointment.category?.icon ?? 'calendar-outline';
    for (const occurrence of expandOccurrences(appointment, start, end)) {
      const span = daysBetween(occurrence.startDate, occurrence.endDate);
      // Multi-day occurrences appear on every day they cover.
      for (let offset = 0; offset <= span; offset += 1) {
        const date = addDaysToDateKey(occurrence.startDate, offset);
        if (date < start || date > end) continue;
        const isFirst = offset === 0;
        const isLast = offset === span;
        const timed = !appointment.allDay && (isFirst || isLast);
        events.push({
          key: `appointment:${appointment.id}:${occurrence.startDate}:${date}`,
          source: 'appointment',
          date,
          title: appointment.title,
          subtitle: [appointment.location, appointment.category?.name].filter(Boolean).join(' · ') || null,
          // A timed multi-day event shows its start on the first day, its end on the last
          // day and sits with all-day items in between.
          startTime: timed && isFirst ? appointment.startTime : null,
          endTime: timed && isLast ? appointment.endTime : null,
          allDay: !timed,
          color,
          icon,
          hasReminder: appointment.reminderMinutes !== null,
          done: false,
          ref: { kind: 'appointment', id: appointment.id, occurrenceDate: occurrence.startDate },
        });
      }
    }
  }
  return events;
}

async function taskEvents(start: DateKey, end: DateKey, { colors }: BuildContext): Promise<CalendarEvent[]> {
  const tasks = await listTasksDueBetween(start, end);
  return tasks.map((task) => ({
      key: `task:${task.id}`,
      source: 'task' as const,
      date: task.dueDate as DateKey,
      title: task.title,
      subtitle: ['Tarefa', task.categoryName].filter(Boolean).join(' · '),
      startTime: task.dueTime,
      endTime: null,
      allDay: task.dueTime === null,
      color: colors.info,
      icon: 'checkbox-outline',
      hasReminder: task.reminderEnabled,
      done: task.completedAt !== null,
      ref: { kind: 'task' as const, id: task.id },
    }));
}

async function financeEvents(start: DateKey, end: DateKey, { colors }: BuildContext): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = [];
  // Planned amounts and installments; confirmed one-off spending is history, not a due date.
  for (const entry of await getEntriesInRange(start, end)) {
    if (entry.type !== 'expense' || (entry.status !== 'planned' && entry.installmentCount < 2)) continue;
    const detail =
      entry.installmentCount > 1 ? `Parcela ${entry.sequence}/${entry.installmentCount}` : entry.recurring ? 'Recorrente' : 'Planejado';
    events.push({
      key: `finance:${entry.key}`,
      source: 'finance',
      date: entry.dueDate,
      title: entry.description,
      subtitle: `${formatCurrency(entry.amountCents)} · ${detail}`,
      startTime: null,
      endTime: null,
      allDay: true,
      color: colors.expense,
      icon: 'wallet-outline',
      hasReminder: false,
      done: entry.status === 'confirmed',
      ref: { kind: 'finance' },
    });
  }

  for (const method of await listPaymentMethods()) {
    if (method.kind !== 'credit' || method.dueDay === null) continue;
    // Due day in each month the range touches, clamped to short months.
    for (let month = `${start.slice(0, 7)}-01`; month <= end; month = addDaysToDateKey(month, 32).slice(0, 8) + '01') {
      const [year, monthNumber] = month.split('-').map(Number);
      const day = Math.min(method.dueDay, daysInMonth(year, monthNumber - 1));
      const date = `${month.slice(0, 8)}${String(day).padStart(2, '0')}`;
      if (date < start || date > end) continue;
      events.push({
        key: `card:${method.id}:${date}`,
        source: 'finance',
        date,
        title: `Fatura ${method.name}`,
        subtitle: 'Vencimento do cartão',
        startTime: null,
        endTime: null,
        allDay: true,
        color: colors.expense,
        icon: 'card-outline',
        hasReminder: false,
        done: false,
        ref: { kind: 'finance' },
      });
    }
  }
  return events;
}

async function goalEvents(start: DateKey, end: DateKey, { colors }: BuildContext): Promise<CalendarEvent[]> {
  const goals = await listGoals();
  return goals
    .filter((goal) => goal.status !== 'archived' && goal.targetDate !== null && goal.targetDate >= start && goal.targetDate <= end)
    .map((goal) => ({
      key: `goal:${goal.id}`,
      source: 'goal' as const,
      date: goal.targetDate as DateKey,
      title: `${goal.icon ? `${goal.icon} ` : ''}${goal.title}`,
      subtitle: `Prazo da meta · ${formatCurrency(goal.savedAmountCents)} de ${formatCurrency(goal.targetAmountCents)}`,
      startTime: null,
      endTime: null,
      allDay: true,
      color: colors.success,
      icon: 'flag-outline',
      hasReminder: false,
      done: goal.status === 'completed',
      ref: { kind: 'goal' as const, id: goal.id },
    }));
}

/** Every calendar entry inside [start, end], from all modules, keyed by day. */
export async function loadCalendarRange(start: DateKey, end: DateKey, context: BuildContext) {
  // A failing module must not blank the whole calendar.
  const sources = await Promise.allSettled([
    appointmentEvents(start, end, context),
    taskEvents(start, end, context),
    financeEvents(start, end, context),
    goalEvents(start, end, context),
  ]);
  const byDay = new Map<DateKey, CalendarEvent[]>();
  for (const source of sources) {
    if (source.status === 'rejected') {
      console.warn('Falha ao carregar uma fonte do calendário.', source.reason);
      continue;
    }
    for (const event of source.value) byDay.set(event.date, [...(byDay.get(event.date) ?? []), event]);
  }
  for (const events of byDay.values()) events.sort(compareEvents);
  return byDay;
}

/** All-day first, then by start time; ties by title. */
export function compareEvents(a: CalendarEvent, b: CalendarEvent): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  const aTime = a.startTime ?? a.endTime ?? '';
  const bTime = b.startTime ?? b.endTime ?? '';
  if (aTime !== bTime) return aTime < bTime ? -1 : 1;
  return a.title.localeCompare(b.title, 'pt-BR');
}

/** Loads the visible range and reloads it whenever any source module changes. */
export function useCalendarRange(start: DateKey, end: DateKey, context: BuildContext) {
  const [state, setState] = useState<{ ready: boolean; byDay: Map<DateKey, CalendarEvent[]> }>({
    ready: false,
    byDay: new Map(),
  });
  const { colors, isDark } = context;

  useEffect(() => {
    let active = true;
    let requestId = 0;
    const run = () => {
      const currentRequest = ++requestId;
      loadCalendarRange(start, end, { colors, isDark })
        .then((byDay) => {
          if (active && currentRequest === requestId) setState({ ready: true, byDay });
        })
        .catch((error: unknown) => console.error('Falha ao carregar o calendário.', error));
    };
    run();
    const unsubscribe = subscribeToDataChanges(run);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [colors, end, isDark, start]);

  return state;
}
