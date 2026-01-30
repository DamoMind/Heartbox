import { describe, it, expect } from 'vitest';
import en from '../i18n/en.json';
import es from '../i18n/es.json';
import zh from '../i18n/zh.json';

// Helper to get all keys from a nested object
function getAllKeys(obj: Record<string, any>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      return getAllKeys(value, newKey);
    }
    return [newKey];
  });
}

describe('i18n Translation Files', () => {
  const enKeys = getAllKeys(en);
  const zhKeys = getAllKeys(zh);

  it('should have core top-level sections in all languages', () => {
    // Core sections that should exist in all languages
    const coreSections = [
      'app',
      'nav',
      'dashboard',
      'inventory',
      'item',
      'scan',
      'history',
      'settings',
      'categories',
      'conditions',
      'common',
      'errors',
    ];

    for (const section of coreSections) {
      expect(en).toHaveProperty(section);
      expect(es).toHaveProperty(section);
      expect(zh).toHaveProperty(section);
    }
  });

  it('should have same keys in English and Chinese', () => {
    const missingInZh = enKeys.filter(key => !zhKeys.includes(key));
    const extraInZh = zhKeys.filter(key => !enKeys.includes(key));

    expect(missingInZh).toEqual([]);
    expect(extraInZh).toEqual([]);
  });

  it('should have non-empty values for all translations', () => {
    const checkNonEmpty = (obj: Record<string, any>, lang: string, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'object' && value !== null) {
          checkNonEmpty(value, lang, fullKey);
        } else {
          expect(value, `${lang}: ${fullKey} should not be empty`).not.toBe('');
        }
      }
    };

    checkNonEmpty(en, 'en');
    checkNonEmpty(es, 'es');
    checkNonEmpty(zh, 'zh');
  });

  it('should have app title and tagline in all languages', () => {
    expect(en.app.title).toBe('Heartbox');
    expect(es.app.title).toBe('Heartbox');
    expect(zh.app.title).toBe('心盒');

    expect(en.app.tagline).toBeDefined();
    expect(es.app.tagline).toBeDefined();
    expect(zh.app.tagline).toBeDefined();
  });

  it('should have core navigation items in all languages', () => {
    // Core nav items that exist in all language files
    const coreNavItems = ['dashboard', 'inventory', 'scan', 'history', 'settings'];
    
    for (const item of coreNavItems) {
      expect(en.nav[item]).toBeDefined();
      expect(es.nav[item]).toBeDefined();
      expect(zh.nav[item]).toBeDefined();
    }
  });

  it('should have all category translations', () => {
    const categories = [
      'diapers', 'formula', 'clothing', 'toys', 'books',
      'hygiene', 'school', 'food', 'medical', 'other'
    ];

    for (const cat of categories) {
      expect(en.categories[cat]).toBeDefined();
      expect(es.categories[cat]).toBeDefined();
      expect(zh.categories[cat]).toBeDefined();
    }
  });

  it('should have correct Chinese translations for key terms', () => {
    expect(zh.nav.dashboard).toBe('仪表盘');
    expect(zh.nav.inventory).toBe('库存');
    expect(zh.settings.language).toBe('语言');
    expect(zh.categories.diapers).toBe('尿布');
    expect(zh.categories.food).toBe('食品');
  });

  it('should have Chinese translations for marketplace and organizations', () => {
    expect(zh.nav.marketplace).toBe('市场');
    expect(zh.organizations).toBeDefined();
    expect(zh.marketplace).toBeDefined();
    expect(zh.orgTypes).toBeDefined();
  });
});
