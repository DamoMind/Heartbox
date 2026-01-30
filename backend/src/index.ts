/**
 * Heartbox API - Cloudflare Workers
 * RESTful API for managing donation items and transactions
 */

import { Env } from './types';
import { json, error } from './utils/response';
import { handleCors, addCorsHeaders } from './middleware/cors';

// Route handlers
import {
  getOrganizations,
  getOrganization,
  createOrganization,
  updateOrganization,
  deleteOrganization,
} from './routes/organizations';

import {
  getItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  getTransactions,
  createTransaction,
  getStats,
  syncData,
} from './routes/inventory';

import {
  getListings,
  createListing,
  createExchangeRequest,
  getExchangeRequests,
  updateExchangeRequest,
} from './routes/marketplace';

import {
  lookupBarcode,
  recognizeImage,
  getAIQuotaStatus,
} from './routes/ai';

// Main router
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const origin = env.CORS_ORIGIN || '*';

    // Handle CORS preflight
    const corsResponse = handleCors(request, origin);
    if (corsResponse) return corsResponse;

    try {
      // Route handling
      const response = await handleRequest(request, env, path, method, url);

      // Add CORS headers to response
      return addCorsHeaders(response, origin);
    } catch (err) {
      console.error('API Error:', err);
      return addCorsHeaders(error('Internal server error', 500), origin);
    }
  },
};

async function handleRequest(
  request: Request,
  env: Env,
  path: string,
  method: string,
  url: URL
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
    if (method === 'GET') return getListings(env, url);
    if (method === 'POST') return createListing(request, env);
  }

  if (path === '/api/marketplace/requests') {
    if (method === 'GET') return getExchangeRequests(env, url);
    if (method === 'POST') return createExchangeRequest(request, env);
  }

  if (path.startsWith('/api/marketplace/requests/')) {
    const id = path.split('/')[4];
    if (method === 'PUT') return updateExchangeRequest(id, request, env);
  }

  return error('Not found', 404);
}
