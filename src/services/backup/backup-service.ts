import { Directory, File, Paths } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';

import { getDatabase } from '@/database/client';
import { recordBackupExported } from '@/database/repositories/notices-repository';
import {
  BACKUP_TABLES,
  CURRENT_BACKUP_FORMAT_VERSION,
  type BackupFile,
  type BackupRow,
  type BackupSummary,
  type BackupTable,
} from '@/services/backup/backup-types';
import { resolveStoredImage } from '@/services/images/image-storage';
import { toDateKey } from '@/utils/date';

const exportDirectory = new Directory(Paths.cache, 'mimo', 'backups');

/** Error whose message is safe to show to the user as-is. */
export class BackupError extends Error {}

async function currentSchemaVersion(): Promise<number> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ version: number | null }>(
    'SELECT MAX(version) AS version FROM schema_migrations',
  );
  return row?.version ?? 0;
}

export type StorageSummary = {
  totalBytes: number;
  transactions: number;
  tasks: number;
  wishlistItems: number;
};

export async function getStorageSummary(): Promise<StorageSummary> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{
    db_bytes: number;
    file_bytes: number;
    transactions: number;
    tasks: number;
    wishlist_items: number;
  }>(
    `SELECT
       (SELECT page_count FROM pragma_page_count()) * (SELECT page_size FROM pragma_page_size()) AS db_bytes,
       (SELECT COALESCE(SUM(byte_size), 0) FROM stored_files) AS file_bytes,
       (SELECT COUNT(*) FROM financial_transactions) AS transactions,
       (SELECT COUNT(*) FROM tasks) AS tasks,
       (SELECT COUNT(*) FROM wishlist_items) AS wishlist_items`,
  );
  return {
    totalBytes: (row?.db_bytes ?? 0) + (row?.file_bytes ?? 0),
    transactions: row?.transactions ?? 0,
    tasks: row?.tasks ?? 0,
    wishlistItems: row?.wishlist_items ?? 0,
  };
}

/** Writes a backup JSON to the cache and opens the system share sheet. */
export async function exportBackup(): Promise<void> {
  if (!(await isAvailableAsync())) {
    throw new BackupError('Compartilhamento indisponível neste dispositivo.');
  }

  const database = await getDatabase();
  const tables = {} as Record<BackupTable, BackupRow[]>;
  for (const table of BACKUP_TABLES) {
    tables[table] = await database.getAllAsync<BackupRow>(`SELECT * FROM ${table}`);
  }

  const files: BackupFile['files'] = [];
  for (const row of tables.stored_files) {
    const relativePath = String(row.relative_path);
    const file = resolveStoredImage(relativePath);
    if (file.exists) files.push({ relativePath, base64: await file.base64() });
  }

  const backup: BackupFile = {
    app: 'mimo',
    formatVersion: CURRENT_BACKUP_FORMAT_VERSION,
    createdAt: new Date().toISOString(),
    schemaVersion: await currentSchemaVersion(),
    tables,
    files,
  };

  // Only the latest export is kept in the cache.
  if (exportDirectory.exists) exportDirectory.delete();
  exportDirectory.create({ intermediates: true, idempotent: true });
  const output = new File(exportDirectory, `mimo-backup-${toDateKey(new Date())}.json`);
  output.create({ overwrite: true });
  await output.write(JSON.stringify(backup));

  await shareAsync(output.uri, {
    dialogTitle: 'Salvar backup do Mimo',
    mimeType: 'application/json',
    UTI: 'public.json',
  });
  // The share sheet cannot tell whether the file was really saved; this marks the attempt.
  await recordBackupExported(Date.now());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseBackup(text: string): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BackupError('Esse arquivo não é um backup do Mimo.');
  }

  if (!isRecord(parsed) || parsed.app !== 'mimo' || !isRecord(parsed.tables) || !Array.isArray(parsed.files)) {
    throw new BackupError('Esse arquivo não é um backup do Mimo.');
  }
  if (parsed.formatVersion !== CURRENT_BACKUP_FORMAT_VERSION || typeof parsed.schemaVersion !== 'number') {
    throw new BackupError('Formato de backup não suportado.');
  }

  const tables = {} as Record<BackupTable, BackupRow[]>;
  for (const table of BACKUP_TABLES) {
    const rows = parsed.tables[table] ?? [];
    if (!Array.isArray(rows) || !rows.every(isRecord)) throw new BackupError('O backup está corrompido.');
    tables[table] = rows as BackupRow[];
  }

  const files = parsed.files.map((entry) => {
    if (!isRecord(entry) || typeof entry.relativePath !== 'string' || typeof entry.base64 !== 'string') {
      throw new BackupError('O backup está corrompido.');
    }
    resolveStoredImage(entry.relativePath); // rejects path traversal
    return { relativePath: entry.relativePath, base64: entry.base64 };
  });

  return {
    app: 'mimo',
    formatVersion: CURRENT_BACKUP_FORMAT_VERSION,
    createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : '',
    schemaVersion: parsed.schemaVersion,
    tables,
    files,
  };
}

export function summarizeBackup(backup: BackupFile): BackupSummary {
  return {
    createdAt: backup.createdAt,
    transactions: backup.tables.financial_transactions.length,
    tasks: backup.tables.tasks.length,
    wishlistItems: backup.tables.wishlist_items.length,
    images: backup.files.length,
  };
}

/** Lets the user pick a backup file and validates it without changing anything. */
export async function pickBackup(): Promise<BackupFile | null> {
  const picked = await File.pickFileAsync();
  if (picked.canceled) return null;

  const backup = parseBackup(await picked.result.text());
  if (backup.schemaVersion > (await currentSchemaVersion())) {
    throw new BackupError('Esse backup foi criado por uma versão mais nova do Mimo. Atualize o app primeiro.');
  }
  return backup;
}

/** Tables whose rows are also unique by name: a same-named local row is reused instead of duplicated. */
const NAME_UNIQUE_TABLES: Partial<Record<BackupTable, { scopeColumn?: string }>> = {
  categories: { scopeColumn: 'scope' },
  payment_methods: {},
  goal_categories: {},
  appointment_categories: {},
};

/** Foreign keys that may point to a reused (remapped) row. */
const REMAPPED_REFERENCES: { table: BackupTable; column: string; target: BackupTable }[] = [
  { table: 'tasks', column: 'category_id', target: 'categories' },
  { table: 'financial_transactions', column: 'category_id', target: 'categories' },
  { table: 'financial_transactions', column: 'payment_method_id', target: 'payment_methods' },
  { table: 'wishlist_items', column: 'category_id', target: 'categories' },
  { table: 'budgets', column: 'category_id', target: 'categories' },
  { table: 'savings_goals', column: 'category_id', target: 'goal_categories' },
  { table: 'appointments', column: 'category_id', target: 'appointment_categories' },
  { table: 'file_references', column: 'file_id', target: 'stored_files' },
];

/** What a merge added, per kind of record. */
export type MergeResult = {
  tasks: number;
  transactions: number;
  wishlistItems: number;
  goals: number;
  appointments: number;
};

function sqlValue(value: unknown): string | number | null {
  return typeof value === 'string' || typeof value === 'number' ? value : null;
}

/**
 * Merges a backup into the local data without deleting anything:
 * - rows whose id already exists keep the local version (no duplicates when
 *   importing a backup of this same device);
 * - categories and payment methods with an existing name are reused, and the
 *   imported rows that pointed to them are re-pointed;
 * - images identical to a stored one (same checksum) are not copied again;
 * - app settings (theme, name, notifications) keep their current values.
 * Everything runs in one SQL transaction; on failure nothing is imported and
 * any image written for it is removed.
 */
export async function mergeBackup(backup: BackupFile): Promise<MergeResult> {
  const database = await getDatabase();
  const filesByPath = new Map(backup.files.map((entry) => [entry.relativePath, entry.base64]));
  const writtenFiles: File[] = [];
  const added = new Map<BackupTable, number>();

  try {
    await database.withExclusiveTransactionAsync(async (transaction) => {
      // backup id → local id, for rows reused instead of inserted.
      const remap = new Map<BackupTable, Map<string, string>>();
      const remapFor = (table: BackupTable) => {
        const map = remap.get(table) ?? new Map<string, string>();
        remap.set(table, map);
        return map;
      };

      for (const table of BACKUP_TABLES) {
        // Only columns that exist in this schema version; names come from SQLite itself.
        const columns = new Set(
          (await transaction.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`)).map((column) => column.name),
        );

        for (const original of backup.tables[table]) {
          const row: BackupRow = { ...original };
          for (const reference of REMAPPED_REFERENCES) {
            if (reference.table !== table) continue;
            const value = row[reference.column];
            if (typeof value === 'string') row[reference.column] = remapFor(reference.target).get(value) ?? value;
          }

          const id = typeof row.id === 'string' ? row.id : null;
          const idExists =
            id !== null &&
            columns.has('id') &&
            (await transaction.getFirstAsync(`SELECT 1 AS found FROM ${table} WHERE id = ?`, id)) !== null;
          if (idExists) continue;

          const nameRule = NAME_UNIQUE_TABLES[table];
          if (nameRule && id !== null && typeof row.name === 'string') {
            const scope = nameRule.scopeColumn ? sqlValue(row[nameRule.scopeColumn]) : null;
            const existing = await transaction.getFirstAsync<{ id: string }>(
              `SELECT id FROM ${table} WHERE name = ? COLLATE NOCASE${nameRule.scopeColumn ? ` AND ${nameRule.scopeColumn} = ?` : ''}`,
              ...(nameRule.scopeColumn ? [row.name, scope] : [row.name]),
            );
            if (existing) {
              remapFor(table).set(id, existing.id);
              continue;
            }
          }

          if (table === 'stored_files' && id !== null) {
            const sameImage =
              typeof row.checksum === 'string'
                ? await transaction.getFirstAsync<{ id: string }>('SELECT id FROM stored_files WHERE checksum = ?', row.checksum)
                : null;
            if (sameImage) {
              remapFor(table).set(id, sameImage.id);
              continue;
            }
            const relativePath = String(row.relative_path);
            const base64 = filesByPath.get(relativePath);
            if (!base64) continue; // Image missing from the backup: skip it (and its references).
            const file = resolveStoredImage(relativePath);
            if (!file.exists) {
              file.create({ intermediates: true });
              await file.write(base64, { encoding: 'base64' });
              writtenFiles.push(file);
            }
          }

          if (table === 'file_references') {
            const fileExists = await transaction.getFirstAsync('SELECT 1 AS found FROM stored_files WHERE id = ?', sqlValue(row.file_id));
            if (!fileExists) continue;
          }

          const names = Object.keys(row).filter((name) => columns.has(name));
          if (names.length === 0) continue;
          const result = await transaction.runAsync(
            `INSERT OR IGNORE INTO ${table} (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`,
            names.map((name) => sqlValue(row[name])),
          );
          if (result.changes > 0) added.set(table, (added.get(table) ?? 0) + 1);
        }
      }
    });
  } catch (error: unknown) {
    for (const file of writtenFiles) {
      try {
        file.delete();
      } catch {
        // Best effort cleanup.
      }
    }
    if (error instanceof BackupError) throw error;
    console.error('Falha ao importar backup.', error);
    throw new BackupError('Não foi possível importar o backup. Seus dados atuais foram mantidos.');
  }

  return {
    tasks: added.get('tasks') ?? 0,
    transactions: added.get('financial_transactions') ?? 0,
    wishlistItems: added.get('wishlist_items') ?? 0,
    goals: added.get('savings_goals') ?? 0,
    appointments: added.get('appointments') ?? 0,
  };
}
