export const CURRENT_BACKUP_FORMAT_VERSION = 1;

export type BackupManifest = {
  formatVersion: typeof CURRENT_BACKUP_FORMAT_VERSION;
  createdAt: string;
  databaseFile: string;
  filesDirectory: string;
};
