-- Migration 006: Add Marketplace for inter-organization exchanges
-- Enables food banks and charities to connect and exchange resources

-- Marketplace listings (offers and requests)
CREATE TABLE IF NOT EXISTS marketplace_listings (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  type TEXT NOT NULL CHECK (type IN ('offer', 'need')),
  item_category TEXT NOT NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit TEXT NOT NULL DEFAULT 'pieces',
  condition TEXT CHECK (condition IN ('new', 'like_new', 'good', 'fair')),
  description TEXT,
  expiry_date TEXT,
  pickup_address TEXT,
  pickup_notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'fulfilled', 'expired', 'cancelled')),
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Exchange requests (when one org responds to another's listing)
CREATE TABLE IF NOT EXISTS exchange_requests (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES marketplace_listings(id),
  requestor_org_id TEXT NOT NULL REFERENCES organizations(id),
  provider_org_id TEXT NOT NULL REFERENCES organizations(id),
  quantity INTEGER NOT NULL,
  message TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'completed', 'cancelled')),
  response_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  responded_at TEXT,
  completed_at TEXT
);

-- Organization connections (for discovering nearby orgs)
CREATE TABLE IF NOT EXISTS organization_connections (
  id TEXT PRIMARY KEY,
  from_org_id TEXT NOT NULL REFERENCES organizations(id),
  to_org_id TEXT NOT NULL REFERENCES organizations(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'connected', 'blocked')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(from_org_id, to_org_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_listings_org ON marketplace_listings(organization_id);
CREATE INDEX IF NOT EXISTS idx_listings_type ON marketplace_listings(type);
CREATE INDEX IF NOT EXISTS idx_listings_status ON marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_category ON marketplace_listings(item_category);
CREATE INDEX IF NOT EXISTS idx_exchange_listing ON exchange_requests(listing_id);
CREATE INDEX IF NOT EXISTS idx_exchange_requestor ON exchange_requests(requestor_org_id);
CREATE INDEX IF NOT EXISTS idx_exchange_provider ON exchange_requests(provider_org_id);
CREATE INDEX IF NOT EXISTS idx_exchange_status ON exchange_requests(status);
CREATE INDEX IF NOT EXISTS idx_connections_from ON organization_connections(from_org_id);
CREATE INDEX IF NOT EXISTS idx_connections_to ON organization_connections(to_org_id);
