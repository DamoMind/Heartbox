/**
 * Marketplace routes
 */

import { Env } from '../types';
import { json, error } from '../utils/response';

// GET /api/marketplace/listings - Get all active listings
export async function getListings(env: Env, url: URL): Promise<Response> {
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
export async function createListing(request: Request, env: Env): Promise<Response> {
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
export async function createExchangeRequest(request: Request, env: Env): Promise<Response> {
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
export async function getExchangeRequests(env: Env, url: URL): Promise<Response> {
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
export async function updateExchangeRequest(id: string, request: Request, env: Env): Promise<Response> {
  const body = await request.json() as { status: string };
  
  await env.DB.prepare(`
    UPDATE exchange_requests 
    SET status = ?, responded_at = datetime('now')
    WHERE id = ?
  `).bind(body.status, id).run();
  
  return json({ message: 'Request updated' });
}
