-- Organizations table for multi-inventory support
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'charity' CHECK (type IN ('charity', 'food_bank', 'pantry', 'personal', 'other')),
  description TEXT,
  contact_email TEXT,
  location TEXT,
  is_public INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Organization members
CREATE TABLE IF NOT EXISTS organization_members (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(organization_id, user_id)
);

-- Add organization_id to items
ALTER TABLE items ADD COLUMN organization_id TEXT REFERENCES organizations(id);

-- Add organization_id to transactions  
ALTER TABLE transactions ADD COLUMN organization_id TEXT REFERENCES organizations(id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_items_org ON items(organization_id);
CREATE INDEX IF NOT EXISTS idx_transactions_org ON transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
