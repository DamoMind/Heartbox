// Core domain types for Donation Inventory Management

export type ItemCategory =
  | 'diapers'      // Diapers/Nappies
  | 'formula'      // Baby formula/milk
  | 'clothing'     // Clothes for children
  | 'toys'         // Toys and games
  | 'books'        // Books and educational materials
  | 'hygiene'      // Hygiene products (soap, shampoo, etc.)
  | 'school'       // School supplies
  | 'food'         // Non-perishable food items
  | 'medical'      // Medical supplies (band-aids, etc.)
  | 'other';       // Other items

export type ItemCondition = 'new' | 'like_new' | 'good' | 'fair';

export type TransactionType = 'in' | 'out';

export type UserRole = 'admin' | 'volunteer';

export type SyncStatus = 'synced' | 'pending' | 'failed';

export interface DonationItem {
  id: string;
  barcode: string;
  name: string;
  category: ItemCategory;
  quantity: number;
  unit: string;              // e.g., "packs", "pieces", "boxes"
  condition: ItemCondition;
  expiryDate?: string;       // ISO date string for perishables
  minStock: number;          // Low stock alert threshold
  location: string;          // Storage location (e.g., "Shelf A-1")
  notes?: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
}

export interface Transaction {
  id: string;
  itemId: string;
  type: TransactionType;
  quantity: number;
  reason: string;            // "Donation received", "Distribution to family", etc.
  recipientInfo?: string;    // For outbound: family ID or description
  performedBy: string;       // User ID
  performedAt: string;
  notes?: string;
  syncStatus: SyncStatus;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  createdAt: string;
}

export interface AppSettings {
  language: 'en' | 'es';
  theme: 'light' | 'dark' | 'system';
  lowStockAlertEnabled: boolean;
  autoSync: boolean;
  lastSyncAt?: string;
}

export interface DashboardStats {
  totalItems: number;
  totalQuantity: number;
  lowStockCount: number;
  recentInbound: number;
  recentOutbound: number;
  categoryBreakdown: Record<ItemCategory, number>;
}

// Offline sync queue
export interface PendingOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'item' | 'transaction';
  data: DonationItem | Transaction;
  timestamp: string;
  retryCount: number;
}

// Category metadata for UI
export const CATEGORY_INFO: Record<ItemCategory, { labelKey: string; icon: string; color: string }> = {
  diapers: { labelKey: 'categories.diapers', icon: 'Baby', color: '#8b5cf6' },
  formula: { labelKey: 'categories.formula', icon: 'Milk', color: '#06b6d4' },
  clothing: { labelKey: 'categories.clothing', icon: 'Shirt', color: '#f59e0b' },
  toys: { labelKey: 'categories.toys', icon: 'Gamepad2', color: '#ec4899' },
  books: { labelKey: 'categories.books', icon: 'BookOpen', color: '#10b981' },
  hygiene: { labelKey: 'categories.hygiene', icon: 'Sparkles', color: '#3b82f6' },
  school: { labelKey: 'categories.school', icon: 'GraduationCap', color: '#6366f1' },
  food: { labelKey: 'categories.food', icon: 'Apple', color: '#ef4444' },
  medical: { labelKey: 'categories.medical', icon: 'Cross', color: '#14b8a6' },
  other: { labelKey: 'categories.other', icon: 'Package', color: '#64748b' },
};

export const CONDITION_INFO: Record<ItemCondition, { labelKey: string; color: string }> = {
  new: { labelKey: 'conditions.new', color: '#22c55e' },
  like_new: { labelKey: 'conditions.likeNew', color: '#84cc16' },
  good: { labelKey: 'conditions.good', color: '#f59e0b' },
  fair: { labelKey: 'conditions.fair', color: '#f97316' },
};
