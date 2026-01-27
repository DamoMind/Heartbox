# Changelog

## [1.1.0] - 2026-01-28

### 🆕 New Features

#### Multi-Organization Support
- Users can now create multiple inventories (charity, food bank, pantry, personal)
- Organization switcher in dashboard header
- Each organization has independent inventory and transactions
- Support for organization members with roles (owner, admin, member)

#### Food Bank Marketplace
- New Marketplace page accessible from Dashboard
- Organizations can post listings to share or exchange items
- Three listing types: **Share**, **Exchange**, **Request**
- Search and filter listings by type and keyword
- Exchange request workflow with approval system
- Connect with other organizations in your area

### 📊 Database Changes
- Added `organizations` table
- Added `organization_members` table
- Added `listings` table for marketplace posts
- Added `exchange_requests` table for request management
- Added `organization_connections` table for networking
- Added `organization_id` to items and transactions

### 🔧 API Endpoints

New endpoints:
- `GET /api/marketplace/listings` - List all active listings
- `POST /api/marketplace/listings` - Create a new listing
- `GET /api/marketplace/requests` - Get exchange requests
- `POST /api/marketplace/requests` - Submit exchange request
- `PUT /api/marketplace/requests/:id` - Update request status

### 🎨 UI Changes
- New Marketplace card on Dashboard (green gradient)
- Marketplace page with search/filter functionality
- Listing cards with type badges and contact buttons
- Organization switcher component

---

## [1.0.0] - 2026-01-24

### Initial Release
- Inventory management with categories
- Barcode scanning for quick operations
- AI-powered item recognition
- Offline-first PWA with sync
- Transaction history
- Dashboard with stats
- Multi-language support (EN/ES)
