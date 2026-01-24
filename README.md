# Heartbox 爱心捐赠管理系统

> 🎁 一个公益开源的爱心捐赠物资管理系统，帮助慈善机构和非营利组织高效管理捐赠物资。

**Heartbox** is an open-source charity donation inventory management system designed to help charities and nonprofit organizations efficiently manage donated items.

---

A professional-grade, offline-first Progressive Web App (PWA) for managing donation inventory at charities and nonprofit organizations.

## Features

### Core Functionality
- **Inventory Management**: Track all donated items with categories, quantities, and conditions
- **Barcode Scanning**: Quick inbound/outbound operations using device camera
- **Real-time Dashboard**: Overview of inventory status, low stock alerts, and activity
- **Transaction History**: Complete audit trail of all inventory movements

### Technical Highlights
- **Offline-First**: Works without internet, syncs when connection is restored
- **PWA**: Installable on mobile devices, works like a native app
- **Multi-language**: English and Spanish support (easily extensible)
- **Responsive Design**: Optimized for mobile-first warehouse operations

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and builds
- **Tailwind CSS** for styling
- **react-router-dom** for navigation
- **react-i18next** for internationalization
- **html5-qrcode** for barcode scanning
- **idb** for IndexedDB (offline storage)
- **lucide-react** for icons

### Backend
- **Cloudflare Workers** for serverless API
- **Cloudflare D1** for SQLite database
- RESTful API design

## Quick Start

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
# Open http://localhost:3000

# Build for production
npm run build
```

### Backend Development

```bash
cd backend

# Install dependencies
npm install

# Initialize database (requires Cloudflare account)
wrangler d1 create donation-inventory
# Update wrangler.toml with database_id

# Run database migrations
npm run db:init

# Start local development
npm run dev
# API available at http://localhost:8787

# Deploy to Cloudflare
npm run deploy
```

## Project Structure

```
donation_app_pro/
├── frontend/
│   ├── public/
│   │   ├── manifest.json      # PWA manifest
│   │   └── favicon.svg        # App icon
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   │   ├── ui/           # Base UI primitives
│   │   │   ├── Navigation.tsx
│   │   │   ├── OfflineBanner.tsx
│   │   │   └── Scanner.tsx
│   │   ├── pages/            # Page components
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Inventory.tsx
│   │   │   ├── ScanPage.tsx
│   │   │   ├── History.tsx
│   │   │   └── Settings.tsx
│   │   ├── hooks/            # Custom React hooks
│   │   │   ├── useInventory.ts
│   │   │   └── useOnlineStatus.ts
│   │   ├── services/         # Data layer
│   │   │   ├── db.ts         # IndexedDB operations
│   │   │   └── sync.ts       # Offline sync logic
│   │   ├── i18n/             # Translations
│   │   │   ├── en.json
│   │   │   ├── es.json
│   │   │   └── config.ts
│   │   ├── types/            # TypeScript types
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
├── backend/
│   ├── src/
│   │   └── index.ts          # Cloudflare Worker API
│   ├── migrations/
│   │   └── 001_init.sql      # Database schema
│   ├── package.json
│   ├── wrangler.toml
│   └── tsconfig.json
└── README.md
```

## Item Categories

| Category | Description |
|----------|-------------|
| diapers | Diapers and nappies |
| formula | Baby formula and milk |
| clothing | Children's clothing |
| toys | Toys and games |
| books | Books and educational materials |
| hygiene | Hygiene products |
| school | School supplies |
| food | Non-perishable food |
| medical | Medical supplies |
| other | Miscellaneous items |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Health check |
| GET | /api/items | List all items |
| POST | /api/items | Create item |
| GET | /api/items/:id | Get item |
| PUT | /api/items/:id | Update item |
| DELETE | /api/items/:id | Delete item |
| GET | /api/transactions | List transactions |
| POST | /api/transactions | Create transaction |
| GET | /api/stats | Dashboard statistics |
| POST | /api/sync | Bulk sync endpoint |

## Offline Sync Strategy

1. **Local-First**: All data operations write to IndexedDB first
2. **Pending Queue**: Unsynced operations are queued
3. **Background Sync**: Auto-sync when connection is restored
4. **Conflict Resolution**: Last-write-wins with timestamp comparison

## Configuration

### Environment Variables

Frontend (.env):
```
VITE_API_URL=https://your-api.workers.dev/api
```

Backend (wrangler.toml):
```toml
[vars]
CORS_ORIGIN = "https://your-frontend.pages.dev"
```

## Deployment

### Frontend (Cloudflare Pages)

```bash
cd frontend
npm run build
# Deploy dist/ to Cloudflare Pages
```

### Backend (Cloudflare Workers)

```bash
cd backend
npm run deploy
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - Free for use by nonprofit organizations.

## 开源公益 | Open Source for Good

本项目完全开源免费，欢迎所有公益组织使用和贡献代码。

This project is completely open-source and free. All nonprofit organizations are welcome to use and contribute.

---

💝 Built with love for charities worldwide. | 用爱心为全球慈善机构打造。
