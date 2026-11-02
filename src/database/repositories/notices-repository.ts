import { getSetting, setSetting } from '@/database/repositories/settings-repository';

const STORAGE_NOTICE_KEY = 'storage_notice_seen';
const LAST_BACKUP_KEY = 'last_backup_at';
const BACKUP_SNOOZE_KEY = 'backup_reminder_snoozed_until';

export type NoticeState = {
  storageNoticeSeen: boolean;
  lastBackupAt: number | null;
  backupSnoozedUntil: number | null;
};

function parseTimestamp(value: string | null): number | null {
  const parsed = value === null ? Number.NaN : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function getNoticeState(): Promise<NoticeState> {
  const [seen, lastBackup, snoozed] = await Promise.all([
    getSetting(STORAGE_NOTICE_KEY),
    getSetting(LAST_BACKUP_KEY),
    getSetting(BACKUP_SNOOZE_KEY),
  ]);
  return {
    storageNoticeSeen: seen === 'true',
    lastBackupAt: parseTimestamp(lastBackup),
    backupSnoozedUntil: parseTimestamp(snoozed),
  };
}

export async function markStorageNoticeSeen(): Promise<void> {
  await setSetting(STORAGE_NOTICE_KEY, 'true');
}

export async function recordBackupExported(at: number): Promise<void> {
  await setSetting(LAST_BACKUP_KEY, String(at));
}

export async function snoozeBackupReminder(until: number): Promise<void> {
  await setSetting(BACKUP_SNOOZE_KEY, String(until));
}
