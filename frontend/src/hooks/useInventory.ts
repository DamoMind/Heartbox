import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  getAllItems,
  getItemById,
  getItemByBarcode,
  getLowStockItems,
  saveItem,
  deleteItem as dbDeleteItem,
  saveTransaction,
  getRecentTransactions,
  getDashboardStats,
} from '@/services/db';
import {
  DonationItem,
  Transaction,
  TransactionType,
  ItemCategory,
  ItemCondition,
  DashboardStats,
} from '@/types';

export function useInventory() {
  const [items, setItems] = useState<DonationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAllItems();
      setItems(data);
      setError(null);
    } catch (err) {
      setError('Failed to load inventory');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const addItem = useCallback(async (item: Omit<DonationItem, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'>) => {
    const newItem: DonationItem = {
      ...item,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    await saveItem(newItem);
    await loadItems();
    return newItem;
  }, [loadItems]);

  const updateItem = useCallback(async (item: DonationItem) => {
    await saveItem(item);
    await loadItems();
  }, [loadItems]);

  const deleteItem = useCallback(async (id: string) => {
    await dbDeleteItem(id);
    await loadItems();
  }, [loadItems]);

  const findByBarcode = useCallback(async (barcode: string) => {
    return getItemByBarcode(barcode);
  }, []);

  const findById = useCallback(async (id: string) => {
    return getItemById(id);
  }, []);

  return {
    items,
    loading,
    error,
    refresh: loadItems,
    addItem,
    updateItem,
    deleteItem,
    findByBarcode,
    findById,
  };
}

export function useLowStockItems() {
  const [items, setItems] = useState<DonationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await getLowStockItems();
      setItems(data);
      setLoading(false);
    };
    load();
  }, []);

  return { items, loading };
}

export function useTransactions(limit = 20) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    const data = await getRecentTransactions(limit);
    setTransactions(data);
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const addTransaction = useCallback(async (
    itemId: string,
    type: TransactionType,
    quantity: number,
    reason: string,
    performedBy: string,
    recipientInfo?: string,
    notes?: string
  ) => {
    const transaction: Transaction = {
      id: uuidv4(),
      itemId,
      type,
      quantity,
      reason,
      recipientInfo,
      performedBy,
      performedAt: new Date().toISOString(),
      notes,
      syncStatus: 'pending',
    };

    await saveTransaction(transaction);
    await loadTransactions();
    return transaction;
  }, [loadTransactions]);

  return {
    transactions,
    loading,
    refresh: loadTransactions,
    addTransaction,
  };
}

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setLoading(true);
    const data = await getDashboardStats();
    setStats(data as DashboardStats);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStats();
    // Refresh stats every 30 seconds
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, [loadStats]);

  return { stats, loading, refresh: loadStats };
}

// Helper hook for creating new items with defaults
export function useNewItem() {
  const createNewItem = useCallback((
    barcode: string,
    name: string,
    category: ItemCategory,
    quantity: number,
    unit: string,
    options?: {
      condition?: ItemCondition;
      minStock?: number;
      location?: string;
      expiryDate?: string;
      notes?: string;
    }
  ): Omit<DonationItem, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'> => {
    return {
      barcode,
      name,
      category,
      quantity,
      unit,
      condition: options?.condition || 'new',
      minStock: options?.minStock || 10,
      location: options?.location || 'Unassigned',
      expiryDate: options?.expiryDate,
      notes: options?.notes,
    };
  }, []);

  return { createNewItem };
}
