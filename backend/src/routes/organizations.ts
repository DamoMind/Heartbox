/**
 * Organizations routes
 */

import { Env } from '../types';
import { json, error } from '../utils/response';
import { mapOrganizationFromDB } from '../utils/mappers';

export async function getOrganizations(env: Env): Promise<Response> {
  const result = await env.DB.prepare(`
    SELECT * FROM organizations ORDER BY created_at ASC, name ASC
  `).all();

  return json(result.results?.map(mapOrganizationFromDB) || []);
}

export async function getOrganization(id: string, env: Env): Promise<Response> {
  const result = await env.DB.prepare(`
    SELECT * FROM organizations WHERE id = ?
  `).bind(id).first();

  if (!result) {
    return error('Organization not found', 404);
  }

  return json(mapOrganizationFromDB(result));
}

export async function createOrganization(request: Request, env: Env): Promise<Response> {
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

export async function updateOrganization(id: string, request: Request, env: Env): Promise<Response> {
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

export async function deleteOrganization(id: string, env: Env): Promise<Response> {
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
