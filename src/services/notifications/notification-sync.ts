import { Platform } from 'react-native';

import { syncTaskReminders } from '@/features/tasks/task-reminder-sync';
import { subscribeToDataChanges } from '@/services/events/data-events';
import { syncAppointmentReminders } from '@/services/notifications/appointment-reminders';
import { syncBillReminders } from '@/services/notifications/bill-reminders';

const DEBOUNCE_MS = 1500;

let started = false;
let billTimer: ReturnType<typeof setTimeout> | undefined;
let appointmentTimer: ReturnType<typeof setTimeout> | undefined;
let queue: Promise<void> = Promise.resolve();

/** Runs syncs one after another so two rebuilds never interleave. */
function enqueue(task: () => Promise<void>): Promise<void> {
  queue = queue.then(task).catch((error: unknown) => console.warn('Falha ao sincronizar notificações.', error));
  return queue;
}

export function syncAllReminders(): Promise<void> {
  return enqueue(async () => {
    await syncTaskReminders();
    await syncBillReminders();
    await syncAppointmentReminders();
  });
}

export function syncBillRemindersNow(): Promise<void> {
  return enqueue(syncBillReminders);
}

export function syncTaskRemindersNow(): Promise<void> {
  return enqueue(syncTaskReminders);
}

/** Resolves with the ids of appointments that got a notification scheduled. */
export async function syncAppointmentRemindersNow(): Promise<Set<string>> {
  let scheduled = new Set<string>();
  await enqueue(async () => {
    scheduled = await syncAppointmentReminders();
  });
  return scheduled;
}

/**
 * Started once at boot: rebuilds reminders (they may be stale after a restore
 * or reinstall) and keeps bill reminders in step with finance changes.
 */
export function startNotificationSync(): void {
  if (started || Platform.OS === 'web') return;
  started = true;

  void syncAllReminders();
  subscribeToDataChanges((scope) => {
    if (scope === 'finance') {
      clearTimeout(billTimer);
      billTimer = setTimeout(() => void syncBillRemindersNow(), DEBOUNCE_MS);
    }
    // Saves run their own sync; this catches other changes (e.g. a restored backup).
    if (scope === 'appointments') {
      clearTimeout(appointmentTimer);
      appointmentTimer = setTimeout(() => void syncAppointmentRemindersNow(), DEBOUNCE_MS);
    }
  });
}
