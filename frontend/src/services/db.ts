import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { DonationItem, Transaction, PendingOperation, AppSettings, Organization } from '@/types';

interface DonationDB extends DBSchema {
  items: {
    key: string;
    value: DonationItem;
    indexes: {
      'by-barcode': string;
      'by-category': string;
      'by-syncStatus': string;
      'by-organizationId': string;
    };
  };
  transactions: {
    key: string;
    value: Transaction;
    indexes: {
      'by-itemId': string;
      'by-type': string;
      'by-date': string;
      'by-syncStatus': string;
      'by-organizationId': string;
    };
  };
  pendingOperations: {
    key: string;
    value: PendingOperation;
    indexes: {
      'by-timestamp': string;
    };
  };
  settings: {
    key: string;
    value: AppSettings;
  };
  organizations: {
    key: string;
    value: Organization;
    indexes: {
      'by-isDefault': number;
    };
  };
}

const DB_NAME = 'donation-inventory-db';
const DB_VERSION = 2;  // Bumped version for new schema

let dbInstance: IDBPDatabase<DonationDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<DonationDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<DonationDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // Items store
      if (!db.objectStoreNames.contains('items')) {
        const itemStore = db.createObjectStore('items', { keyPath: 'id' });
        itemStore.createIndex('by-barcode', 'barcode', { unique: true });
        itemStore.createIndex('by-category', 'category');
        itemStore.createIndex('by-syncStatus', 'syncStatus');
        itemStore.createIndex('by-organizationId', 'organizationId');
      } else if (oldVersion < 2) {
        // Add organizationId index to existing store
        const tx = (db as unknown as IDBPDatabase<DonationDB>).transaction('items', 'readwrite');
        const store = tx.objectStore('items');
        if (!store.indexNames.contains('by-organizationId')) {
          store.createIndex('by-organizationId', 'organizationId');
        }
      }

      // Transactions store
      if (!db.objectStoreNames.contains('transactions')) {
        const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
        txStore.createIndex('by-itemId', 'itemId');
        txStore.createIndex('by-type', 'type');
        txStore.createIndex('by-date', 'performedAt');
        txStore.createIndex('by-syncStatus', 'syncStatus');
        txStore.createIndex('by-organizationId', 'organizationId');
      } else if (oldVersion < 2) {
        const tx = (db as unknown as IDBPDatabase<DonationDB>).transaction('transactions', 'readwrite');
        const store = tx.objectStore('transactions');
        if (!store.indexNames.contains('by-organizationId')) {
          store.createIndex('by-organizationId', 'organizationId');
        }
      }

      // Pending operations store (for offline sync queue)
      if (!db.objectStoreNames.contains('pendingOperations')) {
        const pendingStore = db.createObjectStore('pendingOperations', { keyPath: 'id' });
        pendingStore.createIndex('by-timestamp', 'timestamp');
      }

      // Settings store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }

      // Organizations store (new in v2)
      if (!db.objectStoreNames.contains('organizations')) {
        const orgStore = db.createObjectStore('organizations', { keyPath: 'id' });
        orgStore.createIndex('by-isDefault', 'isDefault');
      }
    },
  });

  return dbInstance;
}

// ============================================
// Item Operations
// ============================================

export async function getAllItems(): Promise<DonationItem[]> {
  const db = await getDB();
  return db.getAll('items');
}

export async function getItemById(id: string): Promise<DonationItem | undefined> {
  const db = await getDB();
  return db.get('items', id);
}

export async function getItemByBarcode(barcode: string): Promise<DonationItem | undefined> {
  const db = await getDB();
  return db.getFromIndex('items', 'by-barcode', barcode);
}

export async function getItemsByCategory(category: string): Promise<DonationItem[]> {
  const db = await getDB();
  return db.getAllFromIndex('items', 'by-category', category);
}

export async function getLowStockItems(): Promise<DonationItem[]> {
  const items = await getAllItems();
  return items.filter(item => item.quantity <= item.minStock);
}

// Organization-filtered item operations
export async function getItemsByOrganization(organizationId: string): Promise<DonationItem[]> {
  const db = await getDB();
  return db.getAllFromIndex('items', 'by-organizationId', organizationId);
}

export async function getLowStockItemsByOrganization(organizationId: string): Promise<DonationItem[]> {
  const items = await getItemsByOrganization(organizationId);
  return items.filter(item => item.quantity <= item.minStock);
}

export async function saveItem(item: DonationItem, addToPending = true): Promise<void> {
  const db = await getDB();
  const existingItem = await db.get('items', item.id);

  await db.put('items', {
    ...item,
    updatedAt: new Date().toISOString(),
    syncStatus: 'pending',
  });

  if (addToPending) {
    await addPendingOperation({
      id: crypto.randomUUID(),
      type: existingItem ? 'update' : 'create',
      entity: 'item',
      data: item,
      timestamp: new Date().toISOString(),
      retryCount: 0,
    });
  }
}

export async function deleteItem(id: string): Promise<void> {
  const db = await getDB();
  const item = await db.get('items', id);

  if (item) {
    await db.delete('items', id);
    await addPendingOperation({
      id: crypto.randomUUID(),
      type: 'delete',
      entity: 'item',
      data: item,
      timestamp: new Date().toISOString(),
      retryCount: 0,
    });
  }
}

// ============================================
// Transaction Operations
// ============================================

export async function getAllTransactions(): Promise<Transaction[]> {
  const db = await getDB();
  const transactions = await db.getAll('transactions');
  return transactions.sort((a, b) =>
    new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime()
  );
}

export async function getTransactionsByItem(itemId: string): Promise<Transaction[]> {
  const db = await getDB();
  return db.getAllFromIndex('transactions', 'by-itemId', itemId);
}

export async function getRecentTransactions(limit = 10): Promise<Transaction[]> {
  const transactions = await getAllTransactions();
  return transactions.slice(0, limit);
}

// Organization-filtered transaction operations
export async function getTransactionsByOrganization(organizationId: string, limit = 50): Promise<Transaction[]> {
  const db = await getDB();
  const transactions = await db.getAllFromIndex('transactions', 'by-organizationId', organizationId);
  return transactions
    .sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime())
    .slice(0, limit);
}

export async function getTodayTransactionsByOrganization(organizationId: string): Promise<{ inbound: number; outbound: number }> {
  const transactions = await getTransactionsByOrganization(organizationId, 1000);
  const today = new Date().toISOString().split('T')[0];

  let inbound = 0;
  let outbound = 0;

  for (const tx of transactions) {
    if (tx.performedAt.startsWith(today)) {
      if (tx.type === 'in') {
        inbound += tx.quantity;
      } else {
        outbound += tx.quantity;
      }
    }
  }

  return { inbound, outbound };
}

export async function getTodayTransactions(): Promise<{ inbound: number; outbound: number }> {
  const db = await getDB();
  const transactions = await db.getAll('transactions');
  const today = new Date().toISOString().split('T')[0];

  let inbound = 0;
  let outbound = 0;

  for (const tx of transactions) {
    if (tx.performedAt.startsWith(today)) {
      if (tx.type === 'in') {
        inbound += tx.quantity;
      } else {
        outbound += tx.quantity;
      }
    }
  }

  return { inbound, outbound };
}

export async function saveTransaction(transaction: Transaction): Promise<void> {
  const db = await getDB();

  await db.put('transactions', {
    ...transaction,
    syncStatus: 'pending',
  });

  // Update item quantity
  const item = await getItemById(transaction.itemId);
  if (item) {
    const newQuantity = transaction.type === 'in'
      ? item.quantity + transaction.quantity
      : item.quantity - transaction.quantity;

    await saveItem({
      ...item,
      quantity: Math.max(0, newQuantity),
    });
  }

  await addPendingOperation({
    id: crypto.randomUUID(),
    type: 'create',
    entity: 'transaction',
    data: transaction,
    timestamp: new Date().toISOString(),
    retryCount: 0,
  });
}

// ============================================
// Pending Operations (Sync Queue)
// ============================================

export async function getPendingOperations(): Promise<PendingOperation[]> {
  const db = await getDB();
  return db.getAllFromIndex('pendingOperations', 'by-timestamp');
}

export async function addPendingOperation(operation: PendingOperation): Promise<void> {
  const db = await getDB();
  await db.put('pendingOperations', operation);
}

export async function removePendingOperation(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('pendingOperations', id);
}

export async function getPendingCount(): Promise<number> {
  const db = await getDB();
  return db.count('pendingOperations');
}

// ============================================
// Settings
// ============================================

const DEFAULT_SETTINGS: AppSettings = {
  language: 'en',
  theme: 'system',
  lowStockAlertEnabled: true,
  autoSync: true,
};

export async function getSettings(): Promise<AppSettings> {
  const db = await getDB();
  const settings = await db.get('settings', 'app-settings');
  return settings || DEFAULT_SETTINGS;
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
  const db = await getDB();
  const current = await getSettings();
  await db.put('settings', {
    ...current,
    ...settings,
    id: 'app-settings',
  } as AppSettings & { id: string });
}

// ============================================
// Dashboard Stats
// ============================================

export async function getDashboardStats() {
  const items = await getAllItems();
  const todayTx = await getTodayTransactions();

  const categoryBreakdown: Record<string, number> = {};
  let totalQuantity = 0;
  let lowStockCount = 0;

  for (const item of items) {
    totalQuantity += item.quantity;
    categoryBreakdown[item.category] = (categoryBreakdown[item.category] || 0) + item.quantity;
    if (item.quantity <= item.minStock) {
      lowStockCount++;
    }
  }

  return {
    totalItems: items.length,
    totalQuantity,
    lowStockCount,
    recentInbound: todayTx.inbound,
    recentOutbound: todayTx.outbound,
    categoryBreakdown,
  };
}

export async function getDashboardStatsByOrganization(organizationId: string) {
  const items = await getItemsByOrganization(organizationId);
  const todayTx = await getTodayTransactionsByOrganization(organizationId);

  const categoryBreakdown: Record<string, number> = {};
  let totalQuantity = 0;
  let lowStockCount = 0;

  for (const item of items) {
    totalQuantity += item.quantity;
    categoryBreakdown[item.category] = (categoryBreakdown[item.category] || 0) + item.quantity;
    if (item.quantity <= item.minStock) {
      lowStockCount++;
    }
  }

  return {
    totalItems: items.length,
    totalQuantity,
    lowStockCount,
    recentInbound: todayTx.inbound,
    recentOutbound: todayTx.outbound,
    categoryBreakdown,
  };
}

// ============================================
// Bulk Operations (for initial sync)
// ============================================

export async function bulkSaveItems(items: DonationItem[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('items', 'readwrite');

  for (const item of items) {
    await tx.store.put({ ...item, syncStatus: 'synced' });
  }

  await tx.done;
}

export async function bulkSaveTransactions(transactions: Transaction[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('transactions', 'readwrite');

  for (const transaction of transactions) {
    await tx.store.put({ ...transaction, syncStatus: 'synced' });
  }

  await tx.done;
}

export async function clearPendingOperations(): Promise<void> {
  const db = await getDB();
  await db.clear('pendingOperations');
}

export async function markAllSynced(): Promise<void> {
  const db = await getDB();

  const items = await db.getAll('items');
  const itemTx = db.transaction('items', 'readwrite');
  for (const item of items) {
    await itemTx.store.put({ ...item, syncStatus: 'synced' });
  }
  await itemTx.done;

  const transactions = await db.getAll('transactions');
  const txTx = db.transaction('transactions', 'readwrite');
  for (const transaction of transactions) {
    await txTx.store.put({ ...transaction, syncStatus: 'synced' });
  }
  await txTx.done;
}

// ============================================
// Clear All Data (for resetting the app)
// ============================================

export async function clearAllData(): Promise<void> {
  const db = await getDB();

  // Clear all stores except settings
  await db.clear('items');
  await db.clear('transactions');
  await db.clear('pendingOperations');

  // Reset lastSyncAt in settings
  const settings = await db.get('settings', 'app-settings');
  if (settings) {
    await db.put('settings', {
      ...settings,
      lastSyncAt: undefined,
    });
  }
}

export async function clearAllDataIncludingSettings(): Promise<void> {
  const db = await getDB();

  // Clear all stores
  await db.clear('items');
  await db.clear('transactions');
  await db.clear('pendingOperations');
  await db.clear('settings');
}
