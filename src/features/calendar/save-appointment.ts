import {
  createAppointment,
  deleteAppointment,
  updateAppointment,
} from '@/database/repositories/appointments-repository';
import { getNotificationPreferences } from '@/database/repositories/preferences-repository';
import { expandOccurrences } from '@/features/calendar/recurrence';
import { notifyDataChanged } from '@/services/events/data-events';
import { syncAppointmentRemindersNow } from '@/services/notifications/notification-sync';
import { ensureReminderPermission } from '@/services/notifications/task-reminders';
import type { Appointment, AppointmentInput, SeriesScope } from '@/types/calendar';
import { addDaysToDateKey, combineDateAndTime, toDateKey, type DateKey } from '@/utils/date';

/** Whether any future occurrence still has a reminder time ahead of now. */
function hasUpcomingReminder(input: AppointmentInput): boolean {
  const minutes = input.reminderMinutes;
  if (minutes === null) return false;
  const today = toDateKey(new Date());
  const source = { ...input, recurrenceUntil: null, exceptions: [] };
  return expandOccurrences(source, today, addDaysToDateKey(today, 400)).some((occurrence) => {
    const start = combineDateAndTime(occurrence.startDate, input.allDay ? '09:00' : (input.startTime ?? '09:00'));
    return start.getTime() - minutes * 60_000 > Date.now();
  });
}

/**
 * Saves and then rebuilds reminders from SQLite. The message only promises a
 * reminder when a notification was really scheduled.
 */
async function finish(id: string, input: AppointmentInput, verb: string): Promise<string> {
  notifyDataChanged('appointments');
  if (input.reminderMinutes === null) {
    await syncAppointmentRemindersNow();
    return `Compromisso ${verb}.`;
  }

  if (!(await getNotificationPreferences()).appointmentReminders) {
    await syncAppointmentRemindersNow();
    return `Compromisso ${verb}. Lembretes de compromissos estão desativados em Configurações.`;
  }
  const permission = await ensureReminderPermission();
  const scheduled = await syncAppointmentRemindersNow();
  if (scheduled.has(id)) return `Compromisso ${verb} com lembrete.`;
  if (permission === 'denied') return `Compromisso ${verb}. O lembrete não foi agendado: as notificações estão bloqueadas.`;
  if (permission === 'unavailable') return `Compromisso ${verb}. Lembretes não estão disponíveis neste dispositivo.`;
  if (!hasUpcomingReminder(input)) return `Compromisso ${verb}. O horário do lembrete já passou.`;
  return `Compromisso ${verb}. O lembrete será agendado automaticamente quando a data estiver mais próxima.`;
}

export async function saveNewAppointment(input: AppointmentInput): Promise<string> {
  const id = await createAppointment(input);
  return finish(id, input, 'salvo');
}

export async function saveAppointmentEdit(
  appointment: Appointment,
  occurrenceDate: DateKey,
  scope: SeriesScope,
  input: AppointmentInput,
): Promise<string> {
  const id = await updateAppointment(appointment, occurrenceDate, scope, input);
  return finish(id, input, 'atualizado');
}

export async function removeAppointment(appointment: Appointment, occurrenceDate: DateKey, scope: SeriesScope): Promise<string> {
  await deleteAppointment(appointment, occurrenceDate, scope);
  notifyDataChanged('appointments');
  // Cancels notifications of deleted occurrences.
  await syncAppointmentRemindersNow();
  return scope === 'occurrence' && appointment.recurrence !== 'none' ? 'Ocorrência excluída.' : 'Compromisso excluído.';
}
