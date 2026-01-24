-- Migration: Add AI usage tracking table
-- Track daily AI API usage with limits

CREATE TABLE IF NOT EXISTS ai_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,                    -- Date in YYYY-MM-DD format
  provider TEXT NOT NULL,                -- 'cloudflare' or 'azure'
  endpoint TEXT NOT NULL,                -- 'barcode_lookup' or 'image_recognition'
  request_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(date, provider, endpoint)
);

-- Index for quick lookups by date
CREATE INDEX IF NOT EXISTS idx_ai_usage_date ON ai_usage(date);

-- Settings table for configurable limits
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Insert default AI limits
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('ai_daily_limit', '1000'),
  ('ai_warning_threshold', '100');
