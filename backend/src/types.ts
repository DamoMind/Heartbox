/**
 * Shared types for Heartbox API
 */

export interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
  CORS_ORIGIN?: string;
  AI?: Ai;
  EDGE_AI_GATEWAY_URL?: string;
  EDGE_AI_GATEWAY_KEY?: string;
  AI_DAILY_LIMIT?: string;
  AI_WARNING_THRESHOLD?: string;
}

export interface AIQuotaStatus {
  used: number;
  limit: number;
  remaining: number;
  warningThreshold: number;
  isWarning: boolean;
  isExhausted: boolean;
  provider: 'cloudflare' | 'azure';
}

export interface ProductInfo {
  name: string;
  category: string;
  unit: string;
  source: 'openfoodfacts' | 'upcitemdb' | 'ai' | 'unknown';
  confidence: number;
  imageUrl?: string;
}

export interface AIRecognitionResult {
  name: string;
  category: string;
  unit: string;
  barcode: string | null;
  generatedBarcode: string;
  confidence: number;
  description?: string;
}

// Database row types
export interface OrganizationRow {
  id: string;
  name: string;
  description: string | null;
  type: string;
  contact_email: string | null;
  location: string | null;
  is_public: number;
  created_at: string;
  updated_at: string;
}

export interface ItemRow {
  id: string;
  barcode: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  condition: string;
  expiry_date: string | null;
  min_stock: number;
  location: string;
  notes: string | null;
  image_url: string | null;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

export interface TransactionRow {
  id: string;
  item_id: string;
  type: string;
  quantity: number;
  reason: string;
  recipient_info: string | null;
  performed_by: string;
  performed_at: string;
  notes: string | null;
  organization_id: string;
}
