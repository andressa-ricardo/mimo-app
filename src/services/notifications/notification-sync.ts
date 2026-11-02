import { Platform } from 'react-native';

import { syncTaskReminders } from '@/features/tasks/task-reminder-sync';
import { subscribeToDataChanges } from '@/services/events/data-events';
import { syncBillReminders } from '@/services/notifications/bill-reminders';

const DEBOUNCE_MS = 1500;

let started = false;
let billTimer: ReturnType<typeof setTimeout> | undefined;
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
  });
}

export function syncBillRemindersNow(): Promise<void> {
  return enqueue(syncBillReminders);
}

export function syncTaskRemindersNow(): Promise<void> {
  return enqueue(syncTaskReminders);
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
    if (scope !== 'finance') return;
    clearTimeout(billTimer);
    billTimer = setTimeout(() => void syncBillRemindersNow(), DEBOUNCE_MS);
  });
}
