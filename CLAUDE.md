# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Heartbox - An open-source, offline-first Progressive Web App (PWA) for managing donation inventory at charities and nonprofit organizations. Features barcode scanning, AI-powered item recognition, and automatic sync when online.

## Commands

### Frontend (in `frontend/` directory)
```bash
npm run dev          # Start dev server at http://localhost:3000
npm run build        # TypeScript check + Vite production build
npm run preview      # Preview production build locally
npm run test         # Run tests in watch mode (vitest)
npm run test:run     # Run tests once
npm run lint         # ESLint with zero warnings allowed
```

### Backend (in `backend/` directory)
```bash
npm run dev          # Start local Cloudflare Worker at http://localhost:8787
npm run deploy       # Deploy to Cloudflare Workers
npm run db:init      # Run initial database migration (001_init.sql)
```

### Database Migrations
Migrations are in `backend/migrations/` and must be run manually via wrangler:
```bash
wrangler d1 execute donation-inventory-db --file=./migrations/001_init.sql
wrangler d1 execute donation-inventory-db --file=./migrations/002_remove_fk_constraints.sql
wrangler d1 execute donation-inventory-db --file=./migrations/003_ai_usage_tracking.sql
```
For remote database, add `--remote` flag.

### Running a Single Test
```bash
cd frontend && npx vitest run src/test/inventory.test.ts
```

### Full-Stack Local Development
Run frontend and backend in separate terminals:
```bash
# Terminal 1 - Backend
cd backend && npm run dev  # http://localhost:8787

# Terminal 2 - Frontend
cd frontend && npm run dev # http://localhost:3000
```

## Architecture

### Monorepo Structure
- **frontend/**: React 18 + TypeScript PWA
- **backend/**: Cloudflare Workers API with D1 (SQLite) database

### Frontend Data Flow
```
Pages/Components
      ↓
Custom Hooks (useInventory, useTransactions, useDashboardStats)
      ↓
services/db.ts (IndexedDB via idb library)
      ↓
services/sync.ts (Offline sync queue → Backend API)
```

### Offline-First Strategy
1. All writes go to IndexedDB first via `services/db.ts`
2. Writes are queued as `PendingOperation` records
3. `services/sync.ts` pushes pending operations when online
4. Conflict resolution: last-write-wins with timestamps

### Key Files
- `frontend/src/types/index.ts` - All TypeScript types and domain constants (CATEGORY_INFO, CONDITION_INFO)
- `frontend/src/services/db.ts` - IndexedDB schema and CRUD operations
- `frontend/src/services/sync.ts` - Sync logic, barcode lookup, AI recognition
- `backend/src/index.ts` - Complete Cloudflare Worker API (single file)
- `backend/migrations/001_init.sql` - Database schema

### Custom Hooks
- `useInventory` - CRUD operations for items, includes `findByBarcode` and `findById`
- `useTransactions` - Transaction history and `addTransaction`
- `useDashboardStats` - Dashboard statistics with 30-second auto-refresh
- `useLowStockItems` - Items below minimum stock threshold
- `useNewItem` - Helper for creating new items with defaults
- `useOnlineStatus` - Network connectivity state

### UI Components
Base UI primitives in `frontend/src/components/ui/` (Button, Card, Input, Select, Badge) - import from `@/components/ui`.

### Routing (react-router-dom)
- `/` - Dashboard
- `/inventory` - Inventory list
- `/inventory/new` - Add new item
- `/inventory/:id` - Edit item
- `/scan` - Barcode/camera scan page
- `/history` - Transaction history
- `/settings` - App settings

### Path Alias
`@/` maps to `frontend/src/` (configured in vite.config.ts)

## Testing

- Framework: Vitest with Testing Library
- IndexedDB mocking: `fake-indexeddb/auto` (auto-loaded in `src/test/setup.ts`)
- Tests clear IndexedDB between runs using `indexedDB.databases()` pattern

## API Endpoints (Backend)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Health check |
| GET | /api/items | List all items |
| GET | /api/items/:id | Get single item |
| POST | /api/items | Create item |
| PUT | /api/items/:id | Update item |
| DELETE | /api/items/:id | Delete item |
| GET | /api/transactions | List transactions |
| POST | /api/transactions | Create transaction |
| GET | /api/stats | Dashboard statistics |
| POST | /api/sync | Bulk sync for offline data |
| GET | /api/barcode/lookup/:barcode | AI-powered barcode lookup |
| POST | /api/ai/recognize | AI image recognition |
| GET | /api/ai/quota | AI usage quota status |

## Domain Types

**Item Categories**: diapers, formula, clothing, toys, books, hygiene, school, food, medical, other

**Item Conditions**: new, like_new, good, fair

**Transaction Types**: in (inbound donation), out (outbound distribution)

**Sync Status**: synced, pending, failed

## i18n

Translations in `frontend/src/i18n/` - English (en.json) and Spanish (es.json). Uses react-i18next with browser language detection.

## Environment Variables

**Frontend** (`.env` or `VITE_*` vars):
- `VITE_API_URL` - Backend API URL (defaults to `/api`)

**Backend** (set in `wrangler.toml` or Cloudflare dashboard):
- `CORS_ORIGIN` - Allowed CORS origin (default: `*`)
- `AI_DAILY_LIMIT` - Daily AI request limit (default: `1000`)
- `AI_WARNING_THRESHOLD` - Warning when remaining requests below this (default: `100`)
- `EDGE_AI_GATEWAY_URL` - Azure fallback gateway URL
- `EDGE_AI_GATEWAY_KEY` - Azure gateway API key (set via `wrangler secret put`)
