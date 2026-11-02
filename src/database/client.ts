import * as SQLite from 'expo-sqlite';

import { migrations } from '@/database/migrations';

const DATABASE_NAME = 'mimo.db';

let databasePromise: Promise<SQLite.SQLiteDatabase> | undefined;

async function migrate(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);

  const row = await database.getFirstAsync<{ version: number | null }>(
    'SELECT MAX(version) AS version FROM schema_migrations',
  );
  const currentVersion = row?.version ?? 0;

  for (const migration of migrations) {
    if (migration.version <= currentVersion) continue;

    await database.withTransactionAsync(async () => {
      await migration.migrate(database);
      await database.runAsync(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
        migration.version,
        migration.name,
        Date.now(),
      );
    });
  }
}

async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  const database = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await database.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await migrate(database);
  return database;
}

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  databasePromise ??= openDatabase().catch((error: unknown) => {
    databasePromise = undefined;
    throw error;
  });

  return databasePromise;
}

export async function initializeDatabase(): Promise<void> {
  await getDatabase();
}
