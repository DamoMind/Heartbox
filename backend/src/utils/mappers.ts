/**
 * Database row mappers
 */

export function mapOrganizationFromDB(row: Record<string, unknown>) {
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

export function mapItemFromDB(row: Record<string, unknown>) {
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

export function mapTransactionFromDB(row: Record<string, unknown>) {
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
