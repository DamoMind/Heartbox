import {
  getPendingOperations,
  removePendingOperation,
  bulkSaveItems,
  bulkSaveTransactions,
  markAllSynced,
  saveSettings,
  getSettings,
} from './db';
import { DonationItem, Transaction, PendingOperation } from '@/types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}

// Check if we're online
export function isOnline(): boolean {
  return navigator.onLine;
}

// Perform full sync
export async function performSync(): Promise<SyncResult> {
  if (!isOnline()) {
    return {
      success: false,
      synced: 0,
      failed: 0,
      errors: ['Device is offline'],
    };
  }

  const result: SyncResult = {
    success: true,
    synced: 0,
    failed: 0,
    errors: [],
  };

  try {
    // 1. Push pending operations to server
    const pending = await getPendingOperations();

    for (const operation of pending) {
      try {
        await pushOperation(operation);
        await removePendingOperation(operation.id);
        result.synced++;
      } catch (error) {
        result.failed++;
        result.errors.push(`Failed to sync ${operation.entity}: ${error}`);
      }
    }

    // 2. Pull latest data from server
    await pullLatestData();

    // 3. Update last sync time
    await saveSettings({
      lastSyncAt: new Date().toISOString(),
    });

    result.success = result.failed === 0;
  } catch (error) {
    result.success = false;
    result.errors.push(`Sync failed: ${error}`);
  }

  return result;
}

// Push a single operation to the server
async function pushOperation(operation: PendingOperation): Promise<void> {
  const endpoint = operation.entity === 'item' ? 'items' : 'transactions';
  let method = 'POST';
  let url = `${API_BASE}/${endpoint}`;

  if (operation.type === 'update') {
    method = 'PUT';
    url = `${API_BASE}/${endpoint}/${operation.data.id}`;
  } else if (operation.type === 'delete') {
    method = 'DELETE';
    url = `${API_BASE}/${endpoint}/${operation.data.id}`;
  }

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: operation.type !== 'delete' ? JSON.stringify(operation.data) : undefined,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
}

// Pull latest data from server
async function pullLatestData(): Promise<void> {
  try {
    // Fetch items
    const itemsResponse = await fetch(`${API_BASE}/items`);
    if (itemsResponse.ok) {
      const items: DonationItem[] = await itemsResponse.json();
      await bulkSaveItems(items);
    }

    // Fetch recent transactions
    const txResponse = await fetch(`${API_BASE}/transactions?limit=100`);
    if (txResponse.ok) {
      const transactions: Transaction[] = await txResponse.json();
      await bulkSaveTransactions(transactions);
    }
  } catch (error) {
    console.error('Failed to pull latest data:', error);
    // Don't throw - we can work with local data
  }
}

// Initial data load (for first app launch)
export async function initialDataLoad(): Promise<void> {
  if (!isOnline()) return;

  try {
    await pullLatestData();
    await markAllSynced();
    await saveSettings({
      lastSyncAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Initial data load failed:', error);
  }
}

// Auto-sync setup
let syncInterval: ReturnType<typeof setInterval> | null = null;

export function startAutoSync(intervalMs = 60000): void {
  if (syncInterval) return;

  syncInterval = setInterval(async () => {
    const settings = await getSettings();
    if (settings.autoSync && isOnline()) {
      await performSync();
    }
  }, intervalMs);

  // Sync when coming online
  window.addEventListener('online', handleOnline);
}

export function stopAutoSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  window.removeEventListener('online', handleOnline);
}

async function handleOnline(): Promise<void> {
  const settings = await getSettings();
  if (settings.autoSync) {
    // Small delay to ensure connection is stable
    setTimeout(() => performSync(), 2000);
  }
}

// Force sync (user-triggered)
export async function forceSync(): Promise<SyncResult> {
  return performSync();
}

// Get sync status
export async function getSyncStatus(): Promise<{
  isOnline: boolean;
  pendingCount: number;
  lastSyncAt: string | undefined;
}> {
  const settings = await getSettings();
  const pending = await getPendingOperations();

  return {
    isOnline: isOnline(),
    pendingCount: pending.length,
    lastSyncAt: settings.lastSyncAt,
  };
}

// Barcode lookup response interface
export interface BarcodeLookupResult {
  name: string;
  category: string;
  unit: string;
  source: 'openfoodfacts' | 'upcitemdb' | 'ai' | 'unknown';
  confidence: number;
  imageUrl?: string;
}

// AI Image Recognition result
export interface AIRecognitionResult {
  name: string;
  category: string;
  unit: string;
  barcode: string | null;
  generatedBarcode: string;
  confidence: number;
  description?: string;
  quotaExhausted?: boolean;
}

// AI Quota Status
export interface AIQuotaStatus {
  date: string;
  used: number;
  limit: number;
  remaining: number;
  warningThreshold: number;
  isWarning: boolean;
  isExhausted: boolean;
  provider: 'cloudflare' | 'azure';
  breakdown: {
    cloudflare: number;
    azure: number;
  };
}

// Get AI quota status
export async function getAIQuotaStatus(): Promise<AIQuotaStatus | null> {
  if (!isOnline()) return null;

  try {
    const response = await fetch(`${API_BASE}/ai/quota`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Failed to get AI quota status:', error);
    return null;
  }
}

// Lookup barcode using AI-powered API
export async function lookupBarcode(barcode: string): Promise<BarcodeLookupResult | null> {
  if (!isOnline()) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE}/barcode/lookup/${encodeURIComponent(barcode)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Barcode lookup failed:', response.status);
      return null;
    }

    const result: BarcodeLookupResult = await response.json();

    // Only return if we have a meaningful result
    if (result.source !== 'unknown' && result.confidence > 0) {
      return result;
    }

    return null;
  } catch (error) {
    console.error('Barcode lookup error:', error);
    return null;
  }
}

// Generate unique barcode (format: KC + timestamp + random)
export function generateBarcode(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `KC${timestamp}${random}`;
}

// AI Image Recognition - analyze image to identify item
export async function recognizeImage(imageBase64: string): Promise<AIRecognitionResult | null> {
  // First try to call backend API
  if (isOnline()) {
    try {
      const response = await fetch(`${API_BASE}/ai/recognize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: imageBase64 }),
      });

      if (response.ok) {
        const result: AIRecognitionResult = await response.json();
        // If no barcode detected, generate one
        if (!result.barcode) {
          result.barcode = null;
          result.generatedBarcode = generateBarcode();
        }
        return result;
      }
    } catch (error) {
      console.error('AI recognition API error:', error);
    }
  }

  // Fallback: Use browser-based recognition (simplified mock for demo)
  // In production, this would use a local ML model or return null
  return performLocalRecognition(imageBase64);
}

// Local fallback recognition (simplified for demo)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function performLocalRecognition(_imageBase64: string): Promise<AIRecognitionResult> {
  // This is a fallback that returns a generic result
  // In a real app, you might use TensorFlow.js or similar
  const generatedBarcode = generateBarcode();

  return {
    name: '',
    category: 'other',
    unit: 'pieces',
    barcode: null,
    generatedBarcode,
    confidence: 0,
    description: 'Unable to recognize. Please enter details manually.',
  };
}

// Capture image from video stream
export function captureImageFromVideo(videoElement: HTMLVideoElement): string | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(videoElement, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.8);
  } catch (error) {
    console.error('Failed to capture image:', error);
    return null;
  }
}
