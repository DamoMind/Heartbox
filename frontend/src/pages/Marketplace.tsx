import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Store,
  Plus,
  Package,
  Heart,
  Search,
  Filter,
  ChevronRight,
  MapPin,
  Clock,
  User,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, Button, Input, Select, Badge } from '@/components/ui';
import { useOrganization } from '@/contexts/OrganizationContext';
import { MarketplaceListing, ListingType, CATEGORY_INFO, ItemCategory } from '@/types';
import { clsx } from 'clsx';
import { format, formatDistanceToNow } from 'date-fns';

const API_URL = import.meta.env.VITE_API_URL || '';

export function Marketplace() {
  const { t } = useTranslation();
  const { currentOrganization } = useOrganization();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{
    type: ListingType | 'all';
    category: ItemCategory | 'all';
    search: string;
  }>({
    type: 'all',
    category: 'all',
    search: '',
  });

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.type !== 'all') params.set('type', filter.type);

      const response = await fetch(`${API_URL}/api/marketplace/listings?${params}`);
      if (response.ok) {
        const data = await response.json();
        setListings(data.listings || []);
      }
    } catch (error) {
      console.error('Failed to fetch listings:', error);
    } finally {
      setLoading(false);
    }
  }, [filter.type]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  // Filter listings locally
  const filteredListings = listings.filter(listing => {
    if (filter.category !== 'all' && listing.itemCategory !== filter.category) return false;
    if (filter.search) {
      const search = filter.search.toLowerCase();
      if (!listing.itemName.toLowerCase().includes(search) &&
          !listing.description?.toLowerCase().includes(search) &&
          !listing.organizationName?.toLowerCase().includes(search)) {
        return false;
      }
    }
    return true;
  });

  // Separate offers and needs
  const offers = filteredListings.filter(l => l.type === 'offer');
  const needs = filteredListings.filter(l => l.type === 'need');

  return (
    <div className="p-4 pb-24 space-y-6">
      {/* Header */}
      <div className="pt-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Store className="h-6 w-6 text-primary-600" />
            {t('marketplace.title')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">{t('marketplace.subtitle')}</p>
        </div>
        <Link to="/marketplace/new">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            {t('marketplace.post')}
          </Button>
        </Link>
      </div>

      {/* Search and Filters */}
      <Card>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder={t('marketplace.searchPlaceholder')}
              value={filter.search}
              onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Select
              value={filter.type}
              onChange={(e) => setFilter(prev => ({ ...prev, type: e.target.value as ListingType | 'all' }))}
              className="flex-1"
            >
              <option value="all">{t('marketplace.allTypes')}</option>
              <option value="offer">{t('marketplace.offers')}</option>
              <option value="need">{t('marketplace.needs')}</option>
            </Select>
            <Select
              value={filter.category}
              onChange={(e) => setFilter(prev => ({ ...prev, category: e.target.value as ItemCategory | 'all' }))}
              className="flex-1"
            >
              <option value="all">{t('marketplace.allCategories')}</option>
              {Object.entries(CATEGORY_INFO).map(([key, info]) => (
                <option key={key} value={key}>{t(info.labelKey)}</option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Available Items (Offers) */}
          {offers.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-semibold text-slate-700 flex items-center gap-2">
                <Heart className="h-5 w-5 text-success-500" />
                {t('marketplace.availableItems')} ({offers.length})
              </h2>
              {offers.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}

          {/* Requested Items (Needs) */}
          {needs.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-semibold text-slate-700 flex items-center gap-2">
                <Package className="h-5 w-5 text-warning-500" />
                {t('marketplace.requestedItems')} ({needs.length})
              </h2>
              {needs.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}

          {/* Empty State */}
          {filteredListings.length === 0 && (
            <Card className="text-center py-12">
              <Store className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="font-medium text-slate-600">{t('marketplace.noListings')}</h3>
              <p className="text-sm text-slate-400 mt-1">{t('marketplace.noListingsDesc')}</p>
              <Link to="/marketplace/new" className="mt-4 inline-block">
                <Button variant="secondary">
                  <Plus className="h-4 w-4 mr-1" />
                  {t('marketplace.createFirst')}
                </Button>
              </Link>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function ListingCard({ listing }: { listing: MarketplaceListing }) {
  const { t } = useTranslation();
  const categoryInfo = CATEGORY_INFO[listing.itemCategory];

  return (
    <Link to={`/marketplace/${listing.id}`}>
      <Card className="hover:shadow-md transition-shadow">
        <div className="flex items-start gap-4">
          {/* Category Icon */}
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${categoryInfo?.color || '#64748b'}20` }}
          >
            <Package
              className="h-6 w-6"
              style={{ color: categoryInfo?.color || '#64748b' }}
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-slate-800 truncate">{listing.itemName}</h3>
                <p className="text-sm text-slate-500">
                  {listing.quantity} {listing.unit}
                  {listing.condition && ` • ${t(`conditions.${listing.condition}`)}`}
                </p>
              </div>
              <Badge
                variant={listing.type === 'offer' ? 'success' : 'warning'}
              >
                {listing.type === 'offer' ? t('marketplace.offering') : t('marketplace.seeking')}
              </Badge>
            </div>

            {listing.description && (
              <p className="text-sm text-slate-600 mt-2 line-clamp-2">{listing.description}</p>
            )}

            <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
              {listing.organizationName && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {listing.organizationName}
                </span>
              )}
              {listing.pickupAddress && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {listing.pickupAddress.split(',')[0]}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(new Date(listing.createdAt), { addSuffix: true })}
              </span>
            </div>
          </div>

          <ChevronRight className="h-5 w-5 text-slate-300 flex-shrink-0" />
        </div>
      </Card>
    </Link>
  );
}
