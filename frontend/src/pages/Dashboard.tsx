import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Package,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronRight,
  TrendingUp,
  RefreshCw,
  Cloud,
  CloudOff,
  Check,
  Store,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, Button } from '@/components/ui';
import { OrganizationSwitcher } from '@/components/OrganizationSwitcher';
import { useDashboardStats, useLowStockItems } from '@/hooks/useInventory';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useOrganization } from '@/contexts/OrganizationContext';
import { CATEGORY_INFO } from '@/types';
import { clsx } from 'clsx';
import { format } from 'date-fns';

export function Dashboard() {
  const { t } = useTranslation();
  const { currentOrganization, loading: orgLoading } = useOrganization();
  const { stats, loading, refresh } = useDashboardStats();
  const { items: lowStockItems } = useLowStockItems();
  const { isOnline, isSyncing, pendingCount, lastSyncAt, sync } = useOnlineStatus();

  const handleSync = async () => {
    await sync();
    refresh();
  };

  if (loading || orgLoading || !stats) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 space-y-6">
      {/* Header with Organization Switcher */}
      <div className="pt-2 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-slate-500 text-sm">{t('dashboard.welcome')}</p>
          <OrganizationSwitcher />
        </div>
        <button
          onClick={handleSync}
          disabled={!isOnline || isSyncing}
          className={clsx(
            'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition flex-shrink-0',
            isOnline
              ? pendingCount > 0
                ? 'bg-warning-100 text-warning-700'
                : 'bg-success-100 text-success-700'
              : 'bg-slate-100 text-slate-500'
          )}
        >
          {isSyncing ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : isOnline ? (
            pendingCount > 0 ? (
              <CloudOff className="h-4 w-4" />
            ) : (
              <Check className="h-4 w-4" />
            )
          ) : (
            <Cloud className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">
            {isSyncing
              ? t('offline.syncing')
              : isOnline
              ? pendingCount > 0
                ? `${pendingCount} ${t('offline.syncPending')}`
                : t('dashboard.synced') || 'Synced'
              : t('offline.banner')}
          </span>
        </button>
      </div>

      {/* Last Sync Time */}
      {lastSyncAt && (
        <p className="text-xs text-slate-400 -mt-4">
          {t('settings.lastSync')}: {format(new Date(lastSyncAt), 'MMM d, HH:mm')}
        </p>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-to-br from-primary-500 to-primary-600">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-primary-100 text-xs font-medium">{t('dashboard.totalItems')}</p>
              <p className="text-3xl font-bold text-white mt-1">{stats.totalItems}</p>
            </div>
            <div className="p-2 bg-white/20 rounded-xl">
              <Package className="h-5 w-5 text-white" />
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-slate-700 to-slate-800">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-300 text-xs font-medium">{t('dashboard.totalQuantity')}</p>
              <p className="text-3xl font-bold text-white mt-1">{stats.totalQuantity.toLocaleString()}</p>
            </div>
            <div className="p-2 bg-white/20 rounded-xl">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
          </div>
        </Card>

        <Card className={clsx(
          stats.lowStockCount > 0
            ? 'bg-gradient-to-br from-warning-500 to-orange-500'
            : 'bg-gradient-to-br from-success-500 to-emerald-500'
        )}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white/80 text-xs font-medium">{t('dashboard.lowStock')}</p>
              <p className="text-3xl font-bold text-white mt-1">{stats.lowStockCount}</p>
            </div>
            <div className="p-2 bg-white/20 rounded-xl">
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-500 text-xs font-medium">{t('dashboard.inboundToday')}</p>
              <div className="flex items-baseline gap-2 mt-1">
                <ArrowDownToLine className="h-4 w-4 text-success-500" />
                <span className="text-xl font-bold text-slate-800">{stats.recentInbound}</span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <ArrowUpFromLine className="h-4 w-4 text-primary-500" />
                <span className="text-xl font-bold text-slate-800">{stats.recentOutbound}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.quickActions')}</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 gap-3">
          <Link to="/scan?mode=in">
            <Button variant="secondary" fullWidth className="h-auto py-4 flex-col gap-2">
              <ArrowDownToLine className="h-6 w-6 text-success-500" />
              <span className="text-sm">{t('dashboard.scanInbound')}</span>
            </Button>
          </Link>
          <Link to="/scan?mode=out">
            <Button variant="secondary" fullWidth className="h-auto py-4 flex-col gap-2">
              <ArrowUpFromLine className="h-6 w-6 text-primary-500" />
              <span className="text-sm">{t('dashboard.scanOutbound')}</span>
            </Button>
          </Link>
        </div>
      </Card>

      {/* Low Stock Alerts */}
      {lowStockItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning-500" />
              {t('dashboard.lowStock')}
            </CardTitle>
            <Link to="/inventory?filter=lowstock" className="text-sm text-primary-600 font-medium">
              {t('common.seeAll')}
            </Link>
          </CardHeader>
          <div className="space-y-2">
            {lowStockItems.slice(0, 3).map((item) => (
              <Link
                key={item.id}
                to={`/inventory/${item.id}`}
                className="flex items-center justify-between p-3 bg-warning-50 rounded-xl hover:bg-warning-100 transition"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${CATEGORY_INFO[item.category].color}20` }}
                  >
                    <Package
                      className="h-5 w-5"
                      style={{ color: CATEGORY_INFO[item.category].color }}
                    />
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{item.name}</p>
                    <p className="text-sm text-slate-500">
                      {item.quantity} / {item.minStock} {item.unit}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400" />
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Category Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.categoryBreakdown')}</CardTitle>
        </CardHeader>
        <div className="space-y-3">
          {Object.entries(stats.categoryBreakdown)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([category, count]) => {
              const info = CATEGORY_INFO[category as keyof typeof CATEGORY_INFO];
              const percentage = Math.round((count / stats.totalQuantity) * 100);

              return (
                <div key={category} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{t(info.labelKey)}</span>
                    <span className="font-medium text-slate-800">{count.toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: info.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </Card>

      {/* Marketplace Quick Access */}
      <Link to="/marketplace">
        <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/20 rounded-xl">
                <Store className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Food Bank Marketplace</h3>
                <p className="text-white/80 text-sm">Connect & share with other organizations</p>
              </div>
            </div>
            <ChevronRight className="h-6 w-6 text-white/60" />
          </div>
        </Card>
      </Link>
    </div>
  );
}
