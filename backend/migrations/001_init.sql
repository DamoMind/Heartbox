-- Donation Inventory Database Schema
-- For Cloudflare D1 (SQLite)

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'volunteer' CHECK (role IN ('admin', 'volunteer')),
  avatar TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Donation items table
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  barcode TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('diapers', 'formula', 'clothing', 'toys', 'books', 'hygiene', 'school', 'food', 'medical', 'other')),
  quantity INTEGER NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'pieces',
  condition TEXT NOT NULL DEFAULT 'new' CHECK (condition IN ('new', 'like_new', 'good', 'fair')),
  expiry_date TEXT,
  min_stock INTEGER NOT NULL DEFAULT 10,
  location TEXT NOT NULL DEFAULT 'Unassigned',
  notes TEXT,
  image_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('in', 'out')),
  quantity INTEGER NOT NULL,
  reason TEXT NOT NULL,
  recipient_info TEXT,
  performed_by TEXT NOT NULL REFERENCES users(id),
  performed_at TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_items_barcode ON items(barcode);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_items_quantity ON items(quantity);
CREATE INDEX IF NOT EXISTS idx_transactions_item_id ON transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_performed_at ON transactions(performed_at);

-- Note: Seed data has been moved to 004_seed_data.sql (optional, for testing only)
-- Do NOT run seed data in production
