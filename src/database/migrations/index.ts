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
  {
    version: 2,
    name: 'create_quick_action_tables',
    migrate: async (database) => {
      await database.execAsync(`
        CREATE INDEX stored_files_checksum_idx ON stored_files(checksum);

        CREATE TABLE categories (
          id TEXT PRIMARY KEY NOT NULL,
          scope TEXT NOT NULL CHECK (scope IN ('task', 'expense', 'income', 'wishlist')),
          name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 40),
          sort_order INTEGER NOT NULL DEFAULT 0,
          is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
          archived_at INTEGER,
          created_at INTEGER NOT NULL
        );

        CREATE UNIQUE INDEX categories_scope_name_idx ON categories(scope, name COLLATE NOCASE);

        CREATE TABLE payment_methods (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 40),
          archived_at INTEGER,
          created_at INTEGER NOT NULL
        );

        CREATE UNIQUE INDEX payment_methods_name_idx ON payment_methods(name COLLATE NOCASE);

        CREATE TABLE tasks (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL CHECK (length(trim(title)) > 0),
          description TEXT,
          category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
          due_date TEXT CHECK (due_date IS NULL OR due_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
          due_time TEXT CHECK (due_time IS NULL OR due_time GLOB '[0-2][0-9]:[0-5][0-9]'),
          priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
          reminder_enabled INTEGER NOT NULL DEFAULT 0 CHECK (reminder_enabled IN (0, 1)),
          reminder_notification_id TEXT,
          completed_at INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          CHECK (due_time IS NULL OR due_date IS NOT NULL),
          CHECK (reminder_enabled = 0 OR due_time IS NOT NULL)
        );

        CREATE INDEX tasks_pending_due_idx ON tasks(completed_at, due_date, due_time);

        -- amount_cents is the full purchase amount; for recurring series it is the
        -- amount of each occurrence. Month-by-month values live in financial_entries.
        CREATE TABLE financial_transactions (
          id TEXT PRIMARY KEY NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
          description TEXT NOT NULL CHECK (length(trim(description)) > 0),
          amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
          category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
          payment_method_id TEXT REFERENCES payment_methods(id) ON DELETE SET NULL,
          transaction_date TEXT NOT NULL CHECK (transaction_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
          installment_count INTEGER NOT NULL DEFAULT 1 CHECK (installment_count BETWEEN 1 AND 48),
          recurrence_frequency TEXT CHECK (recurrence_frequency IS NULL OR recurrence_frequency = 'monthly'),
          recurrence_interval INTEGER NOT NULL DEFAULT 1 CHECK (recurrence_interval >= 1),
          recurrence_end_date TEXT,
          status TEXT NOT NULL CHECK (status IN ('confirmed', 'planned')),
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          CHECK (recurrence_frequency IS NULL OR installment_count = 1)
        );

        CREATE INDEX financial_transactions_recurring_idx
          ON financial_transactions(recurrence_frequency, type, status);

        -- One row per installment (sequence 1..installment_count). Recurring series
        -- materialize only occurrences that exist (the first one, and later any the
        -- user confirms); the rest are projected on demand from the series.
        CREATE TABLE financial_entries (
          id TEXT PRIMARY KEY NOT NULL,
          transaction_id TEXT NOT NULL REFERENCES financial_transactions(id) ON DELETE CASCADE,
          sequence INTEGER NOT NULL CHECK (sequence >= 1),
          amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
          due_date TEXT NOT NULL CHECK (due_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
          status TEXT NOT NULL CHECK (status IN ('confirmed', 'planned')),
          created_at INTEGER NOT NULL,
          UNIQUE (transaction_id, sequence)
        );

        CREATE INDEX financial_entries_due_idx ON financial_entries(due_date, status);

        CREATE TABLE wishlist_items (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL CHECK (length(trim(name)) > 0),
          price_cents INTEGER CHECK (price_cents IS NULL OR price_cents >= 0),
          product_url TEXT,
          category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
          priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
          notes TEXT,
          purchased_at INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE INDEX wishlist_items_highlight_idx ON wishlist_items(purchased_at, priority, created_at);
      `);

      const now = Date.now();
      const defaults: [scope: string, names: string[]][] = [
        ['expense', ['Alimentação', 'Moradia', 'Transporte', 'Lazer', 'Saúde', 'Compras', 'Educação', 'Outros']],
        ['income', ['Salário', 'Freelance', 'Rendimentos', 'Presente', 'Outros']],
        ['wishlist', ['Moda', 'Casa', 'Tecnologia', 'Beleza', 'Livros', 'Outros']],
        ['task', ['Pessoal', 'Trabalho', 'Casa', 'Saúde', 'Estudos']],
      ];

      for (const [scope, names] of defaults) {
        for (const [index, name] of names.entries()) {
          await database.runAsync(
            `INSERT OR IGNORE INTO categories (id, scope, name, sort_order, is_system, created_at)
             VALUES (?, ?, ?, ?, 1, ?)`,
            `system-${scope}-${index + 1}`,
            scope,
            name,
            index,
            now,
          );
        }
      }
    },
  },
];
