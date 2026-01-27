/**
 * Donation Inventory API - Cloudflare Workers
 * RESTful API for managing donation items and transactions
 */

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
  CORS_ORIGIN?: string;
  AI?: Ai; // Cloudflare Workers AI binding
  // Edge AI Gateway fallback configuration
  EDGE_AI_GATEWAY_URL?: string;
  EDGE_AI_GATEWAY_KEY?: string;
  AI_DAILY_LIMIT?: string;
  AI_WARNING_THRESHOLD?: string;
}

// AI Usage tracking result
interface AIQuotaStatus {
  used: number;
  limit: number;
  remaining: number;
  warningThreshold: number;
  isWarning: boolean;
  isExhausted: boolean;
  provider: 'cloudflare' | 'azure';
}

// CORS headers
const corsHeaders = (origin: string) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
});

// JSON response helper
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

// Error response helper
const error = (message: string, status = 400) =>
  json({ error: message }, status);

// Main router
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const origin = env.CORS_ORIGIN || '*';

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    try {
      // Route handling
      const response = await handleRequest(request, env, path, method);

      // Add CORS headers to response
      Object.entries(corsHeaders(origin)).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
    } catch (err) {
      console.error('API Error:', err);
      return error('Internal server error', 500);
    }
  },
};

async function handleRequest(
  request: Request,
  env: Env,
  path: string,
  method: string
): Promise<Response> {
  // Health check
  if (path === '/api/health') {
    return json({ status: 'ok', timestamp: new Date().toISOString() });
  }

  // Organizations routes
  if (path === '/api/organizations') {
    if (method === 'GET') return getOrganizations(env);
    if (method === 'POST') return createOrganization(request, env);
  }

  if (path.startsWith('/api/organizations/')) {
    const id = path.split('/')[3];
    if (method === 'GET') return getOrganization(id, env);
    if (method === 'PUT') return updateOrganization(id, request, env);
    if (method === 'DELETE') return deleteOrganization(id, env);
  }

  // Items routes
  if (path === '/api/items') {
    if (method === 'GET') return getItems(request, env);
    if (method === 'POST') return createItem(request, env);
  }

  if (path.startsWith('/api/items/')) {
    const id = path.split('/')[3];
    if (method === 'GET') return getItem(id, env);
    if (method === 'PUT') return updateItem(id, request, env);
    if (method === 'DELETE') return deleteItem(id, env);
  }

  // Transactions routes
  if (path === '/api/transactions') {
    if (method === 'GET') return getTransactions(request, env);
    if (method === 'POST') return createTransaction(request, env);
  }

  // Dashboard stats
  if (path === '/api/stats') {
    if (method === 'GET') return getStats(request, env);
  }

  // Sync endpoint (for offline-first sync)
  if (path === '/api/sync') {
    if (method === 'POST') return syncData(request, env);
  }

  // Barcode lookup with AI (for auto-fill)
  if (path.startsWith('/api/barcode/lookup/')) {
    const barcode = path.split('/')[4];
    if (method === 'GET') return lookupBarcode(barcode, env);
  }

  // AI Image Recognition endpoint
  if (path === '/api/ai/recognize') {
    if (method === 'POST') return recognizeImage(request, env);
  }

  // AI Quota status endpoint
  if (path === '/api/ai/quota') {
    if (method === 'GET') return getAIQuotaStatus(env);
  }

  // Marketplace routes
  if (path === '/api/marketplace/listings') {
    const url = new URL(request.url);
    if (method === 'GET') return getListings(env, url);
    if (method === 'POST') return createListing(request, env);
  }

  if (path === '/api/marketplace/requests') {
    const url = new URL(request.url);
    if (method === 'GET') return getExchangeRequests(env, url);
    if (method === 'POST') return createExchangeRequest(request, env);
  }

  if (path.startsWith('/api/marketplace/requests/')) {
    const id = path.split('/')[4];
    if (method === 'PUT') return updateExchangeRequest(id, request, env);
  }

  return error('Not found', 404);
}

// ============================================
// Organizations Handlers
// ============================================

async function getOrganizations(env: Env): Promise<Response> {
  const result = await env.DB.prepare(`
    SELECT * FROM organizations ORDER BY created_at ASC, name ASC
  `).all();

  return json(result.results?.map(mapOrganizationFromDB) || []);
}

async function getOrganization(id: string, env: Env): Promise<Response> {
  const result = await env.DB.prepare(`
    SELECT * FROM organizations WHERE id = ?
  `).bind(id).first();

  if (!result) {
    return error('Organization not found', 404);
  }

  return json(mapOrganizationFromDB(result));
}

async function createOrganization(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as Record<string, unknown>;
  const now = new Date().toISOString();
  const id = (body.id as string) || crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO organizations (id, name, description, type, contact_email, location, is_public, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    body.name,
    body.description || null,
    body.type || 'charity',
    body.contactEmail || null,
    body.location || null,
    body.isPublic ? 1 : 0,
    now,
    now
  ).run();

  return json({ success: true, id }, 201);
}

async function updateOrganization(id: string, request: Request, env: Env): Promise<Response> {
  const body = await request.json() as Record<string, unknown>;
  const now = new Date().toISOString();

  await env.DB.prepare(`
    UPDATE organizations SET
      name = COALESCE(?, name),
      description = ?,
      type = COALESCE(?, type),
      contact_email = ?,
      location = ?,
      is_public = COALESCE(?, is_public),
      updated_at = ?
    WHERE id = ?
  `).bind(
    body.name,
    body.description !== undefined ? body.description : null,
    body.type,
    body.contactEmail !== undefined ? body.contactEmail : null,
    body.location !== undefined ? body.location : null,
    body.isPublic !== undefined ? (body.isPublic ? 1 : 0) : null,
    now,
    id
  ).run();

  return json({ success: true });
}

async function deleteOrganization(id: string, env: Env): Promise<Response> {
  const org = await env.DB.prepare(`SELECT id FROM organizations WHERE id = ?`).bind(id).first();
  if (!org) {
    return error('Organization not found', 404);
  }

  // Delete all items and transactions in this organization
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM transactions WHERE organization_id = ?`).bind(id),
    env.DB.prepare(`DELETE FROM items WHERE organization_id = ?`).bind(id),
    env.DB.prepare(`DELETE FROM organization_members WHERE organization_id = ?`).bind(id),
    env.DB.prepare(`DELETE FROM organizations WHERE id = ?`).bind(id),
  ]);

  return json({ success: true });
}

// ============================================
// Items Handlers
// ============================================

async function getItems(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organizationId');

  let query = `SELECT * FROM items`;
  const params: string[] = [];

  if (organizationId) {
    query += ` WHERE organization_id = ?`;
    params.push(organizationId);
  }

  query += ` ORDER BY updated_at DESC`;

  const stmt = env.DB.prepare(query);
  const result = await (params.length > 0 ? stmt.bind(...params) : stmt).all();

  return json(result.results?.map(mapItemFromDB) || []);
}

async function getItem(id: string, env: Env): Promise<Response> {
  const result = await env.DB.prepare(`
    SELECT * FROM items WHERE id = ?
  `).bind(id).first();

  if (!result) {
    return error('Item not found', 404);
  }

  return json(mapItemFromDB(result));
}

async function createItem(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as Record<string, unknown>;
  const now = new Date().toISOString();

  // Default to 'default' organization if not specified
  const organizationId = (body.organizationId as string) || 'default';

  await env.DB.prepare(`
    INSERT INTO items (id, barcode, name, category, quantity, unit, condition, expiry_date, min_stock, location, notes, image_url, organization_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    body.id,
    body.barcode,
    body.name,
    body.category,
    body.quantity || 0,
    body.unit || 'pieces',
    body.condition || 'new',
    body.expiryDate || null,
    body.minStock || 10,
    body.location || 'Unassigned',
    body.notes || null,
    body.imageUrl || null,
    organizationId,
    now,
    now
  ).run();

  return json({ success: true, id: body.id }, 201);
}

async function updateItem(id: string, request: Request, env: Env): Promise<Response> {
  const body = await request.json() as Record<string, unknown>;
  const now = new Date().toISOString();

  await env.DB.prepare(`
    UPDATE items SET
      name = COALESCE(?, name),
      category = COALESCE(?, category),
      quantity = COALESCE(?, quantity),
      unit = COALESCE(?, unit),
      condition = COALESCE(?, condition),
      expiry_date = ?,
      min_stock = COALESCE(?, min_stock),
      location = COALESCE(?, location),
      notes = ?,
      image_url = ?,
      organization_id = COALESCE(?, organization_id),
      updated_at = ?
    WHERE id = ?
  `).bind(
    body.name,
    body.category,
    body.quantity,
    body.unit,
    body.condition,
    body.expiryDate || null,
    body.minStock,
    body.location,
    body.notes || null,
    body.imageUrl || null,
    body.organizationId || null,
    now,
    id
  ).run();

  return json({ success: true });
}

async function deleteItem(id: string, env: Env): Promise<Response> {
  await env.DB.prepare(`DELETE FROM items WHERE id = ?`).bind(id).run();
  return json({ success: true });
}

// ============================================
// Transactions Handlers
// ============================================

async function getTransactions(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const type = url.searchParams.get('type');
  const organizationId = url.searchParams.get('organizationId');

  let query = `SELECT * FROM transactions`;
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (type && (type === 'in' || type === 'out')) {
    conditions.push(`type = ?`);
    params.push(type);
  }

  if (organizationId) {
    conditions.push(`organization_id = ?`);
    params.push(organizationId);
  }

  if (conditions.length > 0) {
    query += ` WHERE ` + conditions.join(' AND ');
  }

  query += ` ORDER BY performed_at DESC LIMIT ?`;
  params.push(limit);

  const stmt = env.DB.prepare(query);
  const result = await (params.length > 0 ? stmt.bind(...params) : stmt).all();

  return json(result.results?.map(mapTransactionFromDB) || []);
}

async function createTransaction(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as Record<string, unknown>;
  const now = new Date().toISOString();

  // Default to 'default' organization if not specified
  const organizationId = (body.organizationId as string) || 'default';

  // Start transaction
  const batch = [
    // Insert transaction record
    env.DB.prepare(`
      INSERT INTO transactions (id, item_id, type, quantity, reason, recipient_info, performed_by, performed_at, notes, organization_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      body.id,
      body.itemId,
      body.type,
      body.quantity,
      body.reason,
      body.recipientInfo || null,
      body.performedBy,
      body.performedAt || now,
      body.notes || null,
      organizationId
    ),
    // Update item quantity
    body.type === 'in'
      ? env.DB.prepare(`UPDATE items SET quantity = quantity + ?, updated_at = ? WHERE id = ?`).bind(body.quantity, now, body.itemId)
      : env.DB.prepare(`UPDATE items SET quantity = MAX(0, quantity - ?), updated_at = ? WHERE id = ?`).bind(body.quantity, now, body.itemId),
  ];

  await env.DB.batch(batch);

  return json({ success: true, id: body.id }, 201);
}

// ============================================
// Stats Handler
// ============================================

async function getStats(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organizationId');

  const orgFilter = organizationId ? `WHERE organization_id = ?` : '';
  const orgFilterAnd = organizationId ? `AND organization_id = ?` : '';

  const itemStatsQuery = `
    SELECT
      COUNT(*) as total_items,
      SUM(quantity) as total_quantity,
      SUM(CASE WHEN quantity <= min_stock THEN 1 ELSE 0 END) as low_stock_count
    FROM items ${orgFilter}
  `;

  const todayTxQuery = `
    SELECT
      SUM(CASE WHEN type = 'in' THEN quantity ELSE 0 END) as inbound,
      SUM(CASE WHEN type = 'out' THEN quantity ELSE 0 END) as outbound
    FROM transactions
    WHERE date(performed_at) = date('now') ${orgFilterAnd}
  `;

  const categoryQuery = `
    SELECT category, SUM(quantity) as count FROM items ${orgFilter} GROUP BY category
  `;

  const [itemStats, todayTx, categoryResult] = await Promise.all([
    organizationId
      ? env.DB.prepare(itemStatsQuery).bind(organizationId).first()
      : env.DB.prepare(itemStatsQuery).first(),
    organizationId
      ? env.DB.prepare(todayTxQuery).bind(organizationId).first()
      : env.DB.prepare(todayTxQuery).first(),
    organizationId
      ? env.DB.prepare(categoryQuery).bind(organizationId).all()
      : env.DB.prepare(categoryQuery).all(),
  ]);

  const categoryBreakdown: Record<string, number> = {};
  categoryResult.results?.forEach((row: Record<string, unknown>) => {
    categoryBreakdown[row.category as string] = row.count as number;
  });

  return json({
    totalItems: itemStats?.total_items || 0,
    totalQuantity: itemStats?.total_quantity || 0,
    lowStockCount: itemStats?.low_stock_count || 0,
    recentInbound: todayTx?.inbound || 0,
    recentOutbound: todayTx?.outbound || 0,
    categoryBreakdown,
  });
}

// ============================================
// Sync Handler (for offline-first)
// ============================================

async function syncData(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as {
    items?: Record<string, unknown>[];
    transactions?: Record<string, unknown>[];
    lastSyncAt?: string;
  };

  const results = {
    itemsSynced: 0,
    transactionsSynced: 0,
    errors: [] as string[],
  };

  // Sync items
  if (body.items && body.items.length > 0) {
    for (const item of body.items) {
      try {
        await env.DB.prepare(`
          INSERT OR REPLACE INTO items (id, barcode, name, category, quantity, unit, condition, expiry_date, min_stock, location, notes, image_url, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          item.id,
          item.barcode,
          item.name,
          item.category,
          item.quantity,
          item.unit,
          item.condition,
          item.expiryDate || null,
          item.minStock,
          item.location,
          item.notes || null,
          item.imageUrl || null,
          item.createdAt,
          item.updatedAt
        ).run();
        results.itemsSynced++;
      } catch (err) {
        results.errors.push(`Item ${item.id}: ${err}`);
      }
    }
  }

  // Sync transactions (with quantity updates)
  if (body.transactions && body.transactions.length > 0) {
    for (const tx of body.transactions) {
      try {
        // Check if transaction already exists
        const existing = await env.DB.prepare(
          `SELECT id FROM transactions WHERE id = ?`
        ).bind(tx.id).first();

        if (!existing) {
          // Use batch to atomically insert transaction AND update item quantity
          const now = new Date().toISOString();
          const batch = [
            env.DB.prepare(`
              INSERT INTO transactions (id, item_id, type, quantity, reason, recipient_info, performed_by, performed_at, notes)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              tx.id,
              tx.itemId,
              tx.type,
              tx.quantity,
              tx.reason,
              tx.recipientInfo || null,
              tx.performedBy,
              tx.performedAt,
              tx.notes || null
            ),
            // Update item quantity based on transaction type
            tx.type === 'in'
              ? env.DB.prepare(`UPDATE items SET quantity = quantity + ?, updated_at = ? WHERE id = ?`).bind(tx.quantity, now, tx.itemId)
              : env.DB.prepare(`UPDATE items SET quantity = MAX(0, quantity - ?), updated_at = ? WHERE id = ?`).bind(tx.quantity, now, tx.itemId),
          ];

          await env.DB.batch(batch);
          results.transactionsSynced++;
        }
      } catch (err) {
        results.errors.push(`Transaction ${tx.id}: ${err}`);
      }
    }
  }

  return json({
    success: results.errors.length === 0,
    ...results,
    syncedAt: new Date().toISOString(),
  });
}

// ============================================
// AI Usage Tracking & Quota Management
// ============================================

// Get today's date in YYYY-MM-DD format
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

// Get current AI usage for today
async function getAIUsageToday(env: Env): Promise<number> {
  const today = getTodayDate();
  const result = await env.DB.prepare(`
    SELECT SUM(request_count) as total FROM ai_usage WHERE date = ?
  `).bind(today).first();
  return (result?.total as number) || 0;
}

// Increment AI usage counter
async function incrementAIUsage(env: Env, provider: 'cloudflare' | 'azure', endpoint: string): Promise<void> {
  const today = getTodayDate();
  const now = new Date().toISOString();

  await env.DB.prepare(`
    INSERT INTO ai_usage (date, provider, endpoint, request_count, created_at, updated_at)
    VALUES (?, ?, ?, 1, ?, ?)
    ON CONFLICT(date, provider, endpoint) DO UPDATE SET
      request_count = request_count + 1,
      updated_at = ?
  `).bind(today, provider, endpoint, now, now, now).run();
}

// Get AI quota status
async function getAIQuotaStatus(env: Env): Promise<Response> {
  const today = getTodayDate();
  const limit = parseInt(env.AI_DAILY_LIMIT || '1000');
  const warningThreshold = parseInt(env.AI_WARNING_THRESHOLD || '100');

  // Get usage breakdown by provider
  const usageResult = await env.DB.prepare(`
    SELECT provider, SUM(request_count) as count
    FROM ai_usage
    WHERE date = ?
    GROUP BY provider
  `).bind(today).all();

  let cloudflareUsed = 0;
  let azureUsed = 0;

  usageResult.results?.forEach((row: Record<string, unknown>) => {
    if (row.provider === 'cloudflare') cloudflareUsed = row.count as number;
    if (row.provider === 'azure') azureUsed = row.count as number;
  });

  const totalUsed = cloudflareUsed + azureUsed;
  const remaining = Math.max(0, limit - totalUsed);
  const currentProvider = cloudflareUsed < limit * 0.8 ? 'cloudflare' : 'azure';

  return json({
    date: today,
    used: totalUsed,
    limit,
    remaining,
    warningThreshold,
    isWarning: remaining <= warningThreshold && remaining > 0,
    isExhausted: remaining === 0,
    provider: currentProvider,
    breakdown: {
      cloudflare: cloudflareUsed,
      azure: azureUsed,
    },
  } as AIQuotaStatus & { date: string; breakdown: { cloudflare: number; azure: number } });
}

// Check if we should use Azure fallback
async function shouldUseAzureFallback(env: Env): Promise<boolean> {
  const limit = parseInt(env.AI_DAILY_LIMIT || '1000');
  const used = await getAIUsageToday(env);
  // Use Azure when Cloudflare usage exceeds 80% of daily limit
  return used >= limit * 0.8;
}

// Check if daily limit is exhausted
async function isQuotaExhausted(env: Env): Promise<boolean> {
  const limit = parseInt(env.AI_DAILY_LIMIT || '1000');
  const used = await getAIUsageToday(env);
  return used >= limit;
}

// Call Edge AI Gateway (Azure fallback)
async function callEdgeAIGateway(
  env: Env,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number = 100
): Promise<string | null> {
  if (!env.EDGE_AI_GATEWAY_URL) {
    console.error('EDGE_AI_GATEWAY_URL not configured');
    return null;
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (env.EDGE_AI_GATEWAY_KEY) {
      headers['Authorization'] = `Bearer ${env.EDGE_AI_GATEWAY_KEY}`;
    }

    const response = await fetch(env.EDGE_AI_GATEWAY_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages,
        max_tokens: maxTokens,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error('Edge AI Gateway error:', await response.text());
      return null;
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error('Edge AI Gateway call failed:', err);
    return null;
  }
}

// ============================================
// Barcode Lookup Handler (AI-powered)
// ============================================

interface ProductInfo {
  name: string;
  category: string;
  unit: string;
  source: 'openfoodfacts' | 'upcitemdb' | 'ai' | 'unknown';
  confidence: number;
  imageUrl?: string;
}

// Category mapping from product categories to our app categories
const CATEGORY_MAP: Record<string, string> = {
  // Food related
  'baby foods': 'formula',
  'baby formula': 'formula',
  'infant formula': 'formula',
  'baby food': 'formula',
  'beverages': 'food',
  'snacks': 'food',
  'cereals': 'food',
  'dairy': 'food',
  'fruits': 'food',
  'vegetables': 'food',
  'canned': 'food',
  'food': 'food',
  // Hygiene
  'personal care': 'hygiene',
  'hygiene': 'hygiene',
  'toiletries': 'hygiene',
  'soap': 'hygiene',
  'shampoo': 'hygiene',
  'toothpaste': 'hygiene',
  // Diapers
  'diapers': 'diapers',
  'nappies': 'diapers',
  'baby diapers': 'diapers',
  'diaper': 'diapers',
  // Clothing
  'clothing': 'clothing',
  'apparel': 'clothing',
  'clothes': 'clothing',
  // Toys
  'toys': 'toys',
  'games': 'toys',
  'toy': 'toys',
  // Books
  'books': 'books',
  'book': 'books',
  'reading': 'books',
  // School
  'stationery': 'school',
  'school supplies': 'school',
  'office supplies': 'school',
  // Medical
  'health': 'medical',
  'medical': 'medical',
  'medicine': 'medical',
  'first aid': 'medical',
};

function mapToAppCategory(productCategory: string): string {
  const lower = productCategory.toLowerCase();

  // Direct match
  if (CATEGORY_MAP[lower]) {
    return CATEGORY_MAP[lower];
  }

  // Partial match
  for (const [key, value] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key) || key.includes(lower)) {
      return value;
    }
  }

  return 'other';
}

async function lookupBarcode(barcode: string, env: Env): Promise<Response> {
  // Run all lookups in PARALLEL for speed (with 3s timeout each)
  const timeout = 3000;

  const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T | null> =>
    Promise.race([
      promise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))
    ]);

  // Start all lookups simultaneously
  const [offResult, upcResult] = await Promise.all([
    // Open Food Facts lookup
    withTimeout(
      (async (): Promise<ProductInfo | null> => {
        try {
          const response = await fetch(
            `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
            { headers: { 'User-Agent': 'DonationInventoryApp/1.0' } }
          );
          if (!response.ok) return null;

          const data = await response.json() as {
            status: number;
            product?: {
              product_name?: string;
              product_name_en?: string;
              categories_tags?: string[];
              image_url?: string;
            };
          };

          if (data.status === 1 && data.product) {
            const product = data.product;
            const name = product.product_name_en || product.product_name || '';
            if (!name) return null;

            let category = 'food';
            for (const cat of product.categories_tags || []) {
              const cleanCat = cat.replace('en:', '').replace(/-/g, ' ');
              const mapped = mapToAppCategory(cleanCat);
              if (mapped !== 'other') {
                category = mapped;
                break;
              }
            }

            return {
              name,
              category,
              unit: 'pieces',
              source: 'openfoodfacts',
              confidence: 0.9,
              imageUrl: product.image_url,
            };
          }
          return null;
        } catch {
          return null;
        }
      })(),
      timeout
    ),

    // UPCitemdb lookup
    withTimeout(
      (async (): Promise<ProductInfo | null> => {
        try {
          const response = await fetch(
            `https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`,
            { headers: { 'Accept': 'application/json' } }
          );
          if (!response.ok) return null;

          const data = await response.json() as {
            code: string;
            items?: Array<{ title?: string; category?: string; images?: string[] }>;
          };

          if (data.code === 'OK' && data.items?.[0]?.title) {
            const item = data.items[0];
            return {
              name: item.title!,
              category: mapToAppCategory(item.category || 'other'),
              unit: 'pieces',
              source: 'upcitemdb',
              confidence: 0.85,
              imageUrl: item.images?.[0],
            };
          }
          return null;
        } catch {
          return null;
        }
      })(),
      timeout
    ),
  ]);

  // Return first successful result (prefer Open Food Facts)
  if (offResult) return json(offResult);
  if (upcResult) return json(upcResult);

  // Check if quota is exhausted
  if (await isQuotaExhausted(env)) {
    return json({
      name: '',
      category: 'other',
      unit: 'pieces',
      source: 'unknown',
      confidence: 0,
      quotaExhausted: true,
    } as ProductInfo & { quotaExhausted: boolean });
  }

  // AI fallback with usage tracking
  const aiMessages = [
    {
      role: 'system',
      content: `You classify products for a charity inventory. Categories: diapers, formula, clothing, toys, books, hygiene, school, food, medical, other. Respond ONLY with JSON: {"category": "name", "suggestedName": "Product Name", "confidence": 0.5}`
    },
    { role: 'user', content: `Barcode: ${barcode}` }
  ];

  // Determine which AI provider to use
  const useAzure = await shouldUseAzureFallback(env);

  if (useAzure && env.EDGE_AI_GATEWAY_URL) {
    // Use Azure via Edge AI Gateway
    try {
      const azureResponse = await callEdgeAIGateway(env, aiMessages, 80);
      if (azureResponse) {
        await incrementAIUsage(env, 'azure', 'barcode_lookup');
        try {
          const parsed = JSON.parse(azureResponse);
          return json({
            name: parsed.suggestedName || '',
            category: parsed.category || 'other',
            unit: 'pieces',
            source: 'ai',
            confidence: parsed.confidence || 0.3,
          } as ProductInfo);
        } catch { /* ignore parse error */ }
      }
    } catch { /* ignore */ }
  } else if (env.AI) {
    // Use Cloudflare AI
    try {
      const aiResult = await withTimeout(
        (env.AI as any).run('@cf/meta/llama-3.1-8b-instruct', {
          messages: aiMessages,
          max_tokens: 80,
        }),
        2000
      );

      if (aiResult?.response) {
        await incrementAIUsage(env, 'cloudflare', 'barcode_lookup');
        try {
          const parsed = JSON.parse(aiResult.response);
          return json({
            name: parsed.suggestedName || '',
            category: parsed.category || 'other',
            unit: 'pieces',
            source: 'ai',
            confidence: parsed.confidence || 0.3,
          } as ProductInfo);
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }

  // Return unknown
  return json({ name: '', category: 'other', unit: 'pieces', source: 'unknown', confidence: 0 } as ProductInfo);
}

// ============================================
// AI Image Recognition Handler
// ============================================

interface AIRecognitionResult {
  name: string;
  category: string;
  unit: string;
  barcode: string | null;
  generatedBarcode: string;
  confidence: number;
  description?: string;
}

// Generate unique barcode (format: KC + timestamp + random)
function generateBarcode(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `KC${timestamp}${random}`;
}

async function recognizeImage(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as { image: string };

    if (!body.image) {
      return error('Image data required', 400);
    }

    // Extract base64 data (remove data URL prefix if present)
    const base64Data = body.image.replace(/^data:image\/\w+;base64,/, '');

    // Check if quota is exhausted
    if (await isQuotaExhausted(env)) {
      return json({
        name: '',
        category: 'other',
        unit: 'pieces',
        barcode: null,
        generatedBarcode: generateBarcode(),
        confidence: 0,
        description: 'AI quota exhausted for today. Please enter details manually.',
        quotaExhausted: true,
      } as AIRecognitionResult & { quotaExhausted: boolean });
    }

    // Check if we should use Azure fallback
    const useAzure = await shouldUseAzureFallback(env);

    // Use Cloudflare Workers AI for image analysis
    // First, let's try to detect any barcode in the image
    const aiPrompt = `Analyze this image for a charity donation inventory system.

Please identify:
1. What is the item? (product name)
2. Category (one of: diapers, formula, clothing, toys, books, hygiene, school, food, medical, other)
3. Best unit of measure (pieces, packs, boxes, bags, bottles, sets)
4. Is there a visible barcode? If yes, read it. If no, return null.
5. Brief description

Respond ONLY with JSON in this exact format:
{
  "name": "Product Name",
  "category": "category_name",
  "unit": "pieces",
  "barcode": "1234567890" or null,
  "confidence": 0.85,
  "description": "Brief description"
}`;

    // If using Azure fallback for image recognition (GPT-4o vision)
    if (useAzure && env.EDGE_AI_GATEWAY_URL) {
      try {
        // Use Azure GPT-4o with vision
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (env.EDGE_AI_GATEWAY_KEY) {
          headers['Authorization'] = `Bearer ${env.EDGE_AI_GATEWAY_KEY}`;
        }

        const azureResponse = await fetch(env.EDGE_AI_GATEWAY_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: aiPrompt },
                  {
                    type: 'image_url',
                    image_url: { url: `data:image/jpeg;base64,${base64Data}` }
                  }
                ]
              }
            ],
            max_tokens: 200,
          }),
        });

        if (azureResponse.ok) {
          const data = await azureResponse.json() as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const content = data.choices?.[0]?.message?.content;

          if (content) {
            await incrementAIUsage(env, 'azure', 'image_recognition');
            try {
              const jsonMatch = content.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return json({
                  name: parsed.name || '',
                  category: mapToAppCategory(parsed.category || 'other'),
                  unit: parsed.unit || 'pieces',
                  barcode: parsed.barcode || null,
                  generatedBarcode: generateBarcode(),
                  confidence: parsed.confidence || 0.7,
                  description: parsed.description || '',
                } as AIRecognitionResult);
              }
            } catch { /* ignore parse error */ }
          }
        }
      } catch (err) {
        console.error('Azure vision recognition failed:', err);
      }
    }

    // Use Cloudflare AI if available and not using Azure
    if (env.AI && !useAzure) {
      try {
        // Use LLaVA model for image understanding (Cloudflare Workers AI)
        const aiResponse = await (env.AI as any).run('@cf/llava-hf/llava-1.5-7b-hf', {
          image: Array.from(Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))),
          prompt: aiPrompt,
          max_tokens: 200,
        });

        if (aiResponse?.description) {
          await incrementAIUsage(env, 'cloudflare', 'image_recognition');
          try {
            // Try to parse JSON from response
            const jsonMatch = aiResponse.description.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);

              return json({
                name: parsed.name || '',
                category: mapToAppCategory(parsed.category || 'other'),
                unit: parsed.unit || 'pieces',
                barcode: parsed.barcode || null,
                generatedBarcode: generateBarcode(),
                confidence: parsed.confidence || 0.7,
                description: parsed.description || '',
              } as AIRecognitionResult);
            }
          } catch {
            // If JSON parsing fails, try to extract info from text
            const text = aiResponse.description.toLowerCase();
            let category = 'other';
            for (const [key, value] of Object.entries(CATEGORY_MAP)) {
              if (text.includes(key)) {
                category = value;
                break;
              }
            }

            return json({
              name: '',
              category,
              unit: 'pieces',
              barcode: null,
              generatedBarcode: generateBarcode(),
              confidence: 0.5,
              description: aiResponse.description,
            } as AIRecognitionResult);
          }
        }

        // Fallback: Use text model to analyze
        const textResponse = await (env.AI as any).run('@cf/meta/llama-3.1-8b-instruct', {
          messages: [
            {
              role: 'system',
              content: `You are an AI assistant that helps identify donation items. When given context about an image, determine the likely item category. Categories: diapers, formula, clothing, toys, books, hygiene, school, food, medical, other. Respond ONLY with JSON.`
            },
            {
              role: 'user',
              content: `Based on an image analysis, please categorize this item. Response format: {"name": "", "category": "other", "unit": "pieces", "confidence": 0.3}`
          }
        ],
        max_tokens: 100,
      });

      if (textResponse?.response) {
        try {
          const parsed = JSON.parse(textResponse.response);
          return json({
            name: parsed.name || '',
            category: parsed.category || 'other',
            unit: parsed.unit || 'pieces',
            barcode: null,
            generatedBarcode: generateBarcode(),
            confidence: parsed.confidence || 0.3,
          } as AIRecognitionResult);
        } catch { /* ignore */ }
      }
    } catch (aiError) {
      console.error('AI recognition error:', aiError);
    }
  }

  // Final fallback
  return json({
      name: '',
      category: 'other',
      unit: 'pieces',
      barcode: null,
      generatedBarcode: generateBarcode(),
      confidence: 0,
      description: 'Could not recognize item. Please enter details manually.',
    } as AIRecognitionResult);

  } catch (err) {
    console.error('Image recognition error:', err);
    return error('Failed to process image', 500);
  }
}

// ============================================
// Helper Functions
// ============================================

function mapOrganizationFromDB(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    contactEmail: row.contact_email,
    location: row.location,
    isPublic: row.is_public === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapItemFromDB(row: Record<string, unknown>) {
  return {
    id: row.id,
    barcode: row.barcode,
    name: row.name,
    category: row.category,
    quantity: row.quantity,
    unit: row.unit,
    condition: row.condition,
    expiryDate: row.expiry_date,
    minStock: row.min_stock,
    location: row.location,
    notes: row.notes,
    imageUrl: row.image_url,
    organizationId: row.organization_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: 'synced',
  };
}

function mapTransactionFromDB(row: Record<string, unknown>) {
  return {
    id: row.id,
    itemId: row.item_id,
    type: row.type,
    quantity: row.quantity,
    reason: row.reason,
    recipientInfo: row.recipient_info,
    performedBy: row.performed_by,
    performedAt: row.performed_at,
    notes: row.notes,
    organizationId: row.organization_id,
    syncStatus: 'synced',
  };
}

// ============= MARKETPLACE API =============

// GET /api/marketplace/listings - Get all active listings
async function getListings(env: Env, url: URL): Promise<Response> {
  const orgId = url.searchParams.get('organization_id');
  const type = url.searchParams.get('type');
  
  let query = `
    SELECT l.*, i.name as item_name, i.category, o.name as organization_name
    FROM listings l
    JOIN items i ON l.item_id = i.id
    JOIN organizations o ON l.organization_id = o.id
    WHERE l.status = 'active'
  `;
  const params: string[] = [];
  
  if (orgId) {
    query += ' AND l.organization_id = ?';
    params.push(orgId);
  }
  if (type) {
    query += ' AND l.listing_type = ?';
    params.push(type);
  }
  
  query += ' ORDER BY l.created_at DESC';
  
  const result = await env.DB.prepare(query).bind(...params).all();
  return json({ listings: result.results });
}

// POST /api/marketplace/listings - Create a listing
async function createListing(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as {
    organization_id: string;
    item_id: string;
    quantity_available: number;
    listing_type?: string;
    description?: string;
    expires_at?: string;
  };
  
  const id = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO listings (id, organization_id, item_id, quantity_available, listing_type, description, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    body.organization_id,
    body.item_id,
    body.quantity_available,
    body.listing_type || 'share',
    body.description || null,
    body.expires_at || null
  ).run();
  
  return json({ id, message: 'Listing created' }, 201);
}

// POST /api/marketplace/requests - Create exchange request
async function createExchangeRequest(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as {
    listing_id: string;
    requester_org_id: string;
    quantity_requested: number;
    message?: string;
  };
  
  const id = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO exchange_requests (id, listing_id, requester_org_id, quantity_requested, message)
    VALUES (?, ?, ?, ?, ?)
  `).bind(id, body.listing_id, body.requester_org_id, body.quantity_requested, body.message || null).run();
  
  return json({ id, message: 'Request created' }, 201);
}

// GET /api/marketplace/requests - Get requests for an organization
async function getExchangeRequests(env: Env, url: URL): Promise<Response> {
  const orgId = url.searchParams.get('organization_id');
  if (!orgId) return error('organization_id required');
  
  const result = await env.DB.prepare(`
    SELECT er.*, l.item_id, i.name as item_name, o.name as requester_name
    FROM exchange_requests er
    JOIN listings l ON er.listing_id = l.id
    JOIN items i ON l.item_id = i.id
    JOIN organizations o ON er.requester_org_id = o.id
    WHERE l.organization_id = ?
    ORDER BY er.created_at DESC
  `).bind(orgId).all();
  
  return json({ requests: result.results });
}

// PUT /api/marketplace/requests/:id - Update request status
async function updateExchangeRequest(id: string, request: Request, env: Env): Promise<Response> {
  const body = await request.json() as { status: string };
  
  await env.DB.prepare(`
    UPDATE exchange_requests 
    SET status = ?, responded_at = datetime('now')
    WHERE id = ?
  `).bind(body.status, id).run();
  
  return json({ message: 'Request updated' });
}
