import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  Plus,
  Package,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { Card, Input, Select, Button, Badge } from '@/components/ui';
import { useInventory } from '@/hooks/useInventory';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { DonationItem, ItemCategory, CATEGORY_INFO } from '@/types';

type SortOption = 'name' | 'quantity' | 'recent';

export function Inventory() {
  const { t } = useTranslation();
  const { items, loading, refresh } = useInventory();
  const { isOnline, isSyncing, sync } = useOnlineStatus();
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ItemCategory | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('name');

  const handleRefresh = async () => {
    await sync();
    refresh();
  };

  // Apply filters and sorting
  const filteredItems = useMemo(() => {
    let result = [...items];

    // Check for low stock filter from URL
    if (searchParams.get('filter') === 'lowstock') {
      result = result.filter(item => item.quantity <= item.minStock);
    }

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        item =>
          item.name.toLowerCase().includes(searchLower) ||
          item.barcode.includes(search)
      );
    }

    // Category filter
    if (categoryFilter !== 'all') {
      result = result.filter(item => item.category === categoryFilter);
    }

    // Sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'quantity':
          return b.quantity - a.quantity;
        case 'recent':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        default:
          return 0;
      }
    });

    return result;
  }, [items, search, categoryFilter, sortBy, searchParams]);

  const categoryOptions = [
    { value: 'all', label: t('inventory.filterAll') },
    ...Object.entries(CATEGORY_INFO).map(([value, info]) => ({
      value,
      label: t(info.labelKey),
    })),
  ];

  const sortOptions = [
    { value: 'name', label: t('inventory.sortName') },
    { value: 'quantity', label: t('inventory.sortQuantity') },
    { value: 'recent', label: t('inventory.sortRecent') },
  ];

  const getStockStatus = (item: DonationItem) => {
    if (item.quantity === 0) return 'outOfStock';
    if (item.quantity <= item.minStock) return 'lowStock';
    return 'inStock';
  };

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-800">{t('inventory.title')}</h1>
          <button
            onClick={handleRefresh}
            disabled={!isOnline || isSyncing}
            className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-50 transition"
            title={t('settings.syncNow')}
          >
            <RefreshCw className={`h-5 w-5 text-slate-500 ${isSyncing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <Link to="/inventory/new">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            {t('inventory.addItem')}
          </Button>
        </Link>
      </div>

      {/* Search & Filters */}
      <div className="space-y-3">
        <Input
          placeholder={t('inventory.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon={<Search className="h-4 w-4" />}
        />

        <div className="flex gap-2">
          <Select
            options={categoryOptions}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as ItemCategory | 'all')}
            className="flex-1"
          />
          <Select
            options={sortOptions}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="flex-1"
          />
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-slate-500">
        {filteredItems.length} {t('inventory.title').toLowerCase()}
      </p>

      {/* Item List */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">{t('inventory.noItems')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => {
            const stockStatus = getStockStatus(item);
            const categoryInfo = CATEGORY_INFO[item.category];

            return (
              <Link key={item.id} to={`/inventory/${item.id}`}>
                <Card hover padding="sm" className="animate-fade-in">
                  <div className="flex items-center gap-3">
                    {/* Category Icon */}
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${categoryInfo.color}15` }}
                    >
                      <Package
                        className="h-6 w-6"
                        style={{ color: categoryInfo.color }}
                      />
                    </div>

                    {/* Item Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-slate-800 truncate">{item.name}</h3>
                        {stockStatus === 'lowStock' && (
                          <AlertTriangle className="h-4 w-4 text-warning-500 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          variant={
                            stockStatus === 'outOfStock'
                              ? 'danger'
                              : stockStatus === 'lowStock'
                              ? 'warning'
                              : 'success'
                          }
                        >
                          {item.quantity} {item.unit}
                        </Badge>
                        <Badge variant="default">
                          {t(categoryInfo.labelKey)}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {item.location} • {item.barcode}
                      </p>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="h-5 w-5 text-slate-300 flex-shrink-0" />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
