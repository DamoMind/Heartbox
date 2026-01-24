-- Migration: Remove foreign key constraints from transactions table
-- SQLite requires recreating the table to remove constraints

-- Step 1: Create new table without FK constraints
CREATE TABLE IF NOT EXISTS transactions_new (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('in', 'out')),
  quantity INTEGER NOT NULL,
  reason TEXT NOT NULL,
  recipient_info TEXT,
  performed_by TEXT NOT NULL,
  performed_at TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT
);

-- Step 2: Copy existing data
INSERT INTO transactions_new (id, item_id, type, quantity, reason, recipient_info, performed_by, performed_at, notes)
SELECT id, item_id, type, quantity, reason, recipient_info, performed_by, performed_at, notes
FROM transactions;

-- Step 3: Drop old table
DROP TABLE transactions;

-- Step 4: Rename new table
ALTER TABLE transactions_new RENAME TO transactions;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_transactions_item_id ON transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_performed_at ON transactions(performed_at);
