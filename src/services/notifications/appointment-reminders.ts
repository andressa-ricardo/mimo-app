import { SchedulableTriggerInputTypes, scheduleNotificationAsync } from 'expo-notifications';

import { listAppointmentsWithReminders } from '@/database/repositories/appointments-repository';
import { getNotificationPreferences } from '@/database/repositories/preferences-repository';
import { expandOccurrences } from '@/features/calendar/recurrence';
import {
  APPOINTMENT_REMINDER_KIND,
  cancelScheduledByKind,
  channelFor,
  hasNotificationPermission,
  TASK_CHANNEL_ID,
} from '@/services/notifications/task-reminders';
import { addDaysToDateKey, combineDateAndTime, toDateKey } from '@/utils/date';

/** Bounded window: recurring series never schedule more than this ahead. */
const HORIZON_DAYS = 30;
/** iOS keeps at most 64 pending notifications; share them with tasks and bills. */
const MAX_APPOINTMENT_REMINDERS = 24;
/** All-day events remind at this local time. */
const ALL_DAY_TIME = '09:00';

function describeLead(minutes: number): string {
  if (minutes === 0) return 'Começa agora';
  if (minutes === 1440) return 'Amanhã';
  if (minutes === 60) return 'Em 1 hora';
  return `Em ${minutes} minutos`;
}

/**
 * Rebuilds appointment notifications from SQLite for the next 30 days and
 * returns the ids of appointments that really got a notification.
 */
export async function syncAppointmentReminders(): Promise<Set<string>> {
  const scheduledIds = new Set<string>();
  await cancelScheduledByKind(APPOINTMENT_REMINDER_KIND);

  const preferences = await getNotificationPreferences();
  if (!preferences.appointmentReminders || !(await hasNotificationPermission())) return scheduledIds;

  const now = Date.now();
  const today = toDateKey(new Date());
  // One extra day so "1 dia antes" reminders for events just past the horizon still fit.
  const until = addDaysToDateKey(today, HORIZON_DAYS + 1);

  const pending: { appointmentId: string; fireAt: Date; title: string; body: string }[] = [];
  for (const appointment of await listAppointmentsWithReminders()) {
    if (appointment.reminderMinutes === null) continue;
    for (const occurrence of expandOccurrences(appointment, today, until)) {
      const start = combineDateAndTime(occurrence.startDate, appointment.allDay ? ALL_DAY_TIME : (appointment.startTime ?? ALL_DAY_TIME));
      const fireAt = new Date(start.getTime() - appointment.reminderMinutes * 60_000);
      if (fireAt.getTime() <= now) continue;
      pending.push({
        appointmentId: appointment.id,
        fireAt,
        title: appointment.title,
        body: [
          describeLead(appointment.reminderMinutes),
          appointment.allDay ? 'dia todo' : appointment.startTime,
          appointment.location,
        ]
          .filter(Boolean)
          .join(' · '),
      });
    }
  }

  pending.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
  for (const reminder of pending.slice(0, MAX_APPOINTMENT_REMINDERS)) {
    try {
      await scheduleNotificationAsync({
        content: {
          title: reminder.title,
          body: reminder.body,
          data: { kind: APPOINTMENT_REMINDER_KIND, appointmentId: reminder.appointmentId },
        },
        trigger: { type: SchedulableTriggerInputTypes.DATE, date: reminder.fireAt, channelId: channelFor(TASK_CHANNEL_ID) },
      });
      scheduledIds.add(reminder.appointmentId);
    } catch (error: unknown) {
      console.warn('Falha ao agendar lembrete de compromisso.', error);
    }
  }
  return scheduledIds;
}
