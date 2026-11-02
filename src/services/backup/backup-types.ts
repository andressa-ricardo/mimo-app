export const CURRENT_BACKUP_FORMAT_VERSION = 1;

/**
 * Tables included in a backup, in insert order (parents before children).
 * schema_migrations is excluded: the restoring app keeps its own schema.
 */
export const BACKUP_TABLES = [
  'app_settings',
  'categories',
  'payment_methods',
  'stored_files',
  'financial_transactions',
  'financial_entries',
  'budgets',
  'tasks',
  'wishlist_items',
  'file_references',
  'goal_categories',
  'savings_goals',
  'goal_movements',
  'goal_sections',
  'goal_section_items',
  'appointment_categories',
  'appointments',
  'appointment_exceptions',
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

export type BackupRow = Record<string, string | number | null>;

/** A single self-contained JSON file: database rows plus stored images. */
export type BackupFile = {
  app: 'mimo';
  formatVersion: typeof CURRENT_BACKUP_FORMAT_VERSION;
  createdAt: string;
  /** Highest migration applied when the backup was made. */
  schemaVersion: number;
  tables: Record<BackupTable, BackupRow[]>;
  files: { relativePath: string; base64: string }[];
};

export type BackupSummary = {
  createdAt: string;
  transactions: number;
  tasks: number;
  wishlistItems: number;
  images: number;
};
