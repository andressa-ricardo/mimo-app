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
  {
    version: 3,
    name: 'link_wishlist_purchase_to_transaction',
    migrate: async (database) => {
      await database.execAsync(`
        ALTER TABLE wishlist_items ADD COLUMN purchase_transaction_id TEXT
          REFERENCES financial_transactions(id) ON DELETE SET NULL;
      `);
    },
  },
  {
    version: 4,
    name: 'add_payment_method_details_and_budgets',
    migrate: async (database) => {
      await database.execAsync(`
        ALTER TABLE payment_methods ADD COLUMN kind TEXT NOT NULL DEFAULT 'other'
          CHECK (kind IN ('credit', 'debit', 'pix', 'cash', 'other'));
        ALTER TABLE payment_methods ADD COLUMN institution TEXT;
        ALTER TABLE payment_methods ADD COLUMN due_day INTEGER
          CHECK (due_day IS NULL OR due_day BETWEEN 1 AND 31);

        -- Best-effort type for methods created before this migration.
        UPDATE payment_methods SET kind = CASE
          WHEN name LIKE '%cr_dito%' THEN 'credit'
          WHEN name LIKE '%d_bito%' THEN 'debit'
          WHEN name LIKE '%pix%' THEN 'pix'
          WHEN name LIKE '%dinheiro%' THEN 'cash'
          ELSE 'other'
        END;

        -- One monthly limit per expense category, applied to every month.
        CREATE TABLE budgets (
          category_id TEXT PRIMARY KEY NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
          amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);
    },
  },
  {
    version: 5,
    name: 'create_savings_goals',
    migrate: async (database) => {
      // Goal categories get their own table: widening the CHECK on `categories`
      // would require rebuilding it, and dropping it would cascade into budgets.
      await database.execAsync(`
        CREATE TABLE goal_categories (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 40),
          sort_order INTEGER NOT NULL DEFAULT 0,
          is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
          archived_at INTEGER,
          created_at INTEGER NOT NULL
        );

        CREATE UNIQUE INDEX goal_categories_name_idx ON goal_categories(name COLLATE NOCASE);

        -- Saved balance and status are derived (from goal_movements and the
        -- target), never stored, so they cannot drift out of sync.
        CREATE TABLE savings_goals (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL CHECK (length(trim(title)) > 0),
          description TEXT,
          target_amount_cents INTEGER NOT NULL CHECK (target_amount_cents > 0),
          target_date TEXT CHECK (target_date IS NULL OR target_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
          icon TEXT,
          category_id TEXT REFERENCES goal_categories(id) ON DELETE SET NULL,
          archived_at INTEGER,
          linked_wishlist_item_id TEXT REFERENCES wishlist_items(id) ON DELETE SET NULL,
          -- Plans has no table yet; the reference becomes a foreign key when it does.
          linked_plan_id TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE INDEX savings_goals_wishlist_idx ON savings_goals(linked_wishlist_item_id);

        CREATE TABLE goal_movements (
          id TEXT PRIMARY KEY NOT NULL,
          goal_id TEXT NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
          type TEXT NOT NULL CHECK (type IN ('contribution', 'withdrawal')),
          amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
          movement_date TEXT NOT NULL CHECK (movement_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
          note TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE INDEX goal_movements_goal_idx ON goal_movements(goal_id, movement_date);
      `);

      const now = Date.now();
      const names = ['Viagem', 'Compras', 'Emergência', 'Estudos', 'Casa', 'Outros'];
      for (const [index, name] of names.entries()) {
        await database.runAsync(
          `INSERT OR IGNORE INTO goal_categories (id, name, sort_order, is_system, created_at)
           VALUES (?, ?, ?, 1, ?)`,
          `system-goal-${index + 1}`,
          name,
          index,
          now,
        );
      }
    },
  },
];
