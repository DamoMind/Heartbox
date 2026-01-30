/**
 * Inventory (Items & Transactions) routes
 */

import { Env } from '../types';
import { json, error } from '../utils/response';
import { mapItemFromDB, mapTransactionFromDB } from '../utils/mappers';

// ============================================
// Items Handlers
// ============================================

export async function getItems(request: Request, env: Env): Promise<Response> {
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

export async function getItem(id: string, env: Env): Promise<Response> {
  const result = await env.DB.prepare(`
    SELECT * FROM items WHERE id = ?
  `).bind(id).first();

  if (!result) {
    return error('Item not found', 404);
  }

  return json(mapItemFromDB(result));
}

export async function createItem(request: Request, env: Env): Promise<Response> {
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

export async function updateItem(id: string, request: Request, env: Env): Promise<Response> {
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

export async function deleteItem(id: string, env: Env): Promise<Response> {
  await env.DB.prepare(`DELETE FROM items WHERE id = ?`).bind(id).run();
  return json({ success: true });
}

// ============================================
// Transactions Handlers
// ============================================

export async function getTransactions(request: Request, env: Env): Promise<Response> {
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

export async function createTransaction(request: Request, env: Env): Promise<Response> {
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

export async function getStats(request: Request, env: Env): Promise<Response> {
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

export async function syncData(request: Request, env: Env): Promise<Response> {
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
