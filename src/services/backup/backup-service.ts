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
import { imagesDirectory } from '@/services/storage/app-directories';
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

/**
 * Replaces all local data with the backup in a single SQL transaction. Images
 * are written first; if the database step fails, the new files are removed
 * and the current data stays untouched.
 */
export async function restoreBackup(backup: BackupFile): Promise<void> {
  const database = await getDatabase();

  const writtenFiles: File[] = [];
  try {
    for (const entry of backup.files) {
      const file = resolveStoredImage(entry.relativePath);
      if (file.exists) continue;
      file.create({ intermediates: true });
      await file.write(entry.base64, { encoding: 'base64' });
      writtenFiles.push(file);
    }

    await database.withExclusiveTransactionAsync(async (transaction) => {
      for (const table of [...BACKUP_TABLES].reverse()) {
        await transaction.runAsync(`DELETE FROM ${table}`);
      }

      for (const table of BACKUP_TABLES) {
        // Only columns that exist in this schema version; names come from SQLite itself.
        const columns = new Set(
          (await transaction.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`)).map((column) => column.name),
        );
        for (const row of backup.tables[table]) {
          const names = Object.keys(row).filter((name) => columns.has(name));
          if (names.length === 0) continue;
          const values = names.map((name) => {
            const value = row[name];
            return typeof value === 'string' || typeof value === 'number' ? value : null;
          });
          await transaction.runAsync(
            `INSERT INTO ${table} (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`,
            values,
          );
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
    console.error('Falha ao restaurar backup.', error);
    throw new BackupError('Não foi possível restaurar o backup. Seus dados atuais foram mantidos.');
  }

  // Remove images that the restored data no longer references.
  const keep = new Set(backup.tables.stored_files.map((row) => String(row.relative_path)));
  for (const item of imagesDirectory.list()) {
    if (item instanceof File && !keep.has(item.name)) {
      try {
        item.delete();
      } catch {
        // Best effort cleanup.
      }
    }
  }
}
