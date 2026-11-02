import type { SQLiteDatabase } from 'expo-sqlite';

export type Migration = {
  version: number;
  name: string;
  migrate: (database: SQLiteDatabase) => Promise<void>;
};

export const migrations: readonly Migration[] = [
  {
    version: 1,
    name: 'create_foundation_tables',
    migrate: async (database) => {
      await database.execAsync(`
        CREATE TABLE app_settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE stored_files (
          id TEXT PRIMARY KEY NOT NULL,
          relative_path TEXT NOT NULL UNIQUE,
          media_type TEXT NOT NULL,
          byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
          checksum TEXT,
          created_at INTEGER NOT NULL
        );

        CREATE TABLE file_references (
          owner_type TEXT NOT NULL,
          owner_id TEXT NOT NULL,
          file_id TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          PRIMARY KEY (owner_type, owner_id, file_id),
          FOREIGN KEY (file_id) REFERENCES stored_files(id) ON DELETE CASCADE
        );

        CREATE INDEX file_references_file_id_idx ON file_references(file_id);
      `);
    },
  },
];
