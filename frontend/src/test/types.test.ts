import { describe, it, expect } from 'vitest';
import {
  CATEGORY_INFO,
  CONDITION_INFO,
  ORGANIZATION_TYPE_INFO,
  DonationItem,
  Transaction,
  Organization,
} from '../types';

describe('Type Constants', () => {
  describe('CATEGORY_INFO', () => {
    it('should have all required categories', () => {
      const expectedCategories = [
        'diapers', 'formula', 'clothing', 'toys', 'books',
        'hygiene', 'school', 'food', 'medical', 'other'
      ];

      for (const cat of expectedCategories) {
        expect(CATEGORY_INFO).toHaveProperty(cat);
        expect(CATEGORY_INFO[cat as keyof typeof CATEGORY_INFO]).toHaveProperty('labelKey');
        expect(CATEGORY_INFO[cat as keyof typeof CATEGORY_INFO]).toHaveProperty('icon');
        expect(CATEGORY_INFO[cat as keyof typeof CATEGORY_INFO]).toHaveProperty('color');
      }
    });

    it('should have valid color hex codes', () => {
      const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
      
      for (const [cat, info] of Object.entries(CATEGORY_INFO)) {
        expect(info.color, `${cat} should have valid hex color`).toMatch(hexColorRegex);
      }
    });

    it('should have i18n label keys', () => {
      for (const [cat, info] of Object.entries(CATEGORY_INFO)) {
        expect(info.labelKey).toContain('categories.');
      }
    });
  });

  describe('CONDITION_INFO', () => {
    it('should have all required conditions', () => {
      const expectedConditions = ['new', 'like_new', 'good', 'fair'];

      for (const condition of expectedConditions) {
        expect(CONDITION_INFO).toHaveProperty(condition);
        expect(CONDITION_INFO[condition as keyof typeof CONDITION_INFO]).toHaveProperty('labelKey');
        expect(CONDITION_INFO[condition as keyof typeof CONDITION_INFO]).toHaveProperty('color');
      }
    });
  });

  describe('ORGANIZATION_TYPE_INFO', () => {
    it('should have all required organization types', () => {
      const expectedTypes = ['charity', 'food_bank', 'shelter', 'school', 'other'];

      for (const type of expectedTypes) {
        expect(ORGANIZATION_TYPE_INFO).toHaveProperty(type);
        expect(ORGANIZATION_TYPE_INFO[type as keyof typeof ORGANIZATION_TYPE_INFO]).toHaveProperty('labelKey');
        expect(ORGANIZATION_TYPE_INFO[type as keyof typeof ORGANIZATION_TYPE_INFO]).toHaveProperty('icon');
        expect(ORGANIZATION_TYPE_INFO[type as keyof typeof ORGANIZATION_TYPE_INFO]).toHaveProperty('color');
      }
    });
  });
});

describe('Type Structures', () => {
  it('should accept valid DonationItem', () => {
    const validItem: DonationItem = {
      id: 'test-123',
      barcode: '1234567890',
      name: 'Test Item',
      category: 'food',
      quantity: 10,
      unit: 'pieces',
      condition: 'new',
      minStock: 5,
      location: 'Shelf A',
      organizationId: 'org-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'synced',
    };

    expect(validItem.id).toBe('test-123');
    expect(validItem.quantity).toBe(10);
    expect(validItem.category).toBe('food');
  });

  it('should accept valid Transaction', () => {
    const validTransaction: Transaction = {
      id: 'tx-123',
      itemId: 'item-123',
      type: 'in',
      quantity: 5,
      reason: 'donation',
      performedBy: 'user-123',
      performedAt: new Date().toISOString(),
      organizationId: 'org-1',
      syncStatus: 'pending',
    };

    expect(validTransaction.id).toBe('tx-123');
    expect(validTransaction.type).toBe('in');
  });

  it('should accept valid Organization', () => {
    const validOrg: Organization = {
      id: 'org-123',
      name: 'Test Charity',
      type: 'charity',
      icon: 'Heart',
      color: '#ec4899',
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(validOrg.id).toBe('org-123');
    expect(validOrg.type).toBe('charity');
  });
});
