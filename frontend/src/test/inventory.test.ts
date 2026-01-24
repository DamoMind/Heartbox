import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveItem,
  getItemById,
  saveTransaction,
} from '../services/db';
import { DonationItem, Transaction } from '../types';

describe('Inventory Deduction Tests', () => {
  const mockItem: DonationItem = {
    id: 'test-item-001',
    barcode: '1234567890',
    name: 'Test Vaseline',
    category: 'hygiene',
    quantity: 10,
    unit: 'pieces',
    condition: 'new',
    minStock: 5,
    location: 'Shelf A',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    syncStatus: 'synced',
  };

  beforeEach(async () => {
    // Clear IndexedDB before each test
    const { indexedDB } = globalThis;
    const databases = await indexedDB.databases();
    for (const db of databases) {
      if (db.name) {
        indexedDB.deleteDatabase(db.name);
      }
    }
  });

  it('should create an item with initial quantity', async () => {
    await saveItem(mockItem, false);

    const savedItem = await getItemById(mockItem.id);
    expect(savedItem).toBeDefined();
    expect(savedItem?.quantity).toBe(10);
    expect(savedItem?.name).toBe('Test Vaseline');
  });

  it('should decrease quantity on outbound transaction', async () => {
    // Create item with 10 units
    await saveItem(mockItem, false);

    // Verify initial quantity
    let item = await getItemById(mockItem.id);
    expect(item?.quantity).toBe(10);

    // Create outbound transaction (distribute 5 units)
    const outboundTransaction: Transaction = {
      id: 'tx-001',
      itemId: mockItem.id,
      type: 'out',
      quantity: 5,
      reason: 'distribution',
      performedBy: 'test-user',
      performedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    await saveTransaction(outboundTransaction);

    // Verify quantity decreased to 5
    item = await getItemById(mockItem.id);
    expect(item?.quantity).toBe(5);
  });

  it('should increase quantity on inbound transaction', async () => {
    // Create item with 10 units
    await saveItem(mockItem, false);

    // Create inbound transaction (receive 8 units)
    const inboundTransaction: Transaction = {
      id: 'tx-002',
      itemId: mockItem.id,
      type: 'in',
      quantity: 8,
      reason: 'donation',
      performedBy: 'test-user',
      performedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    await saveTransaction(inboundTransaction);

    // Verify quantity increased to 18
    const item = await getItemById(mockItem.id);
    expect(item?.quantity).toBe(18);
  });

  it('should not allow negative quantity', async () => {
    // Create item with 3 units
    const smallItem = { ...mockItem, quantity: 3 };
    await saveItem(smallItem, false);

    // Try to distribute 5 units (more than available)
    const outboundTransaction: Transaction = {
      id: 'tx-003',
      itemId: mockItem.id,
      type: 'out',
      quantity: 5,
      reason: 'distribution',
      performedBy: 'test-user',
      performedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    await saveTransaction(outboundTransaction);

    // Quantity should be 0, not negative
    const item = await getItemById(mockItem.id);
    expect(item?.quantity).toBe(0);
  });

  it('should handle multiple transactions correctly', async () => {
    // Create item with 10 units
    await saveItem(mockItem, false);

    // Transaction 1: Distribute 3 units (10 - 3 = 7)
    await saveTransaction({
      id: 'tx-multi-1',
      itemId: mockItem.id,
      type: 'out',
      quantity: 3,
      reason: 'distribution',
      performedBy: 'test-user',
      performedAt: new Date().toISOString(),
      syncStatus: 'pending',
    });

    let item = await getItemById(mockItem.id);
    expect(item?.quantity).toBe(7);

    // Transaction 2: Receive 5 units (7 + 5 = 12)
    await saveTransaction({
      id: 'tx-multi-2',
      itemId: mockItem.id,
      type: 'in',
      quantity: 5,
      reason: 'donation',
      performedBy: 'test-user',
      performedAt: new Date().toISOString(),
      syncStatus: 'pending',
    });

    item = await getItemById(mockItem.id);
    expect(item?.quantity).toBe(12);

    // Transaction 3: Distribute 4 units (12 - 4 = 8)
    await saveTransaction({
      id: 'tx-multi-3',
      itemId: mockItem.id,
      type: 'out',
      quantity: 4,
      reason: 'event',
      performedBy: 'test-user',
      performedAt: new Date().toISOString(),
      syncStatus: 'pending',
    });

    item = await getItemById(mockItem.id);
    expect(item?.quantity).toBe(8);
  });

  it('should not update quantity if item not found', async () => {
    // Try to create transaction for non-existent item
    const transaction: Transaction = {
      id: 'tx-noitem',
      itemId: 'non-existent-id',
      type: 'out',
      quantity: 5,
      reason: 'distribution',
      performedBy: 'test-user',
      performedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    // Should not throw error
    await saveTransaction(transaction);

    // Item should still not exist
    const item = await getItemById('non-existent-id');
    expect(item).toBeUndefined();
  });
});
