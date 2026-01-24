import { useTranslation } from 'react-i18next';
import { WifiOff, RefreshCw, Check, CloudOff, Loader2, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export function OfflineBanner() {
  const { t } = useTranslation();
  const { isOnline, isSyncing, isInitializing, pendingCount, syncError } = useOnlineStatus();

  // Show initializing state
  if (isInitializing) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 py-2 px-4 text-center text-sm font-medium bg-primary-500 text-white">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t('offline.initializing') || 'Loading data...'}</span>
        </div>
      </div>
    );
  }

  // Show sync error
  if (syncError) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 py-2 px-4 text-center text-sm font-medium bg-danger-500 text-white">
        <div className="flex items-center justify-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <span>{syncError}</span>
        </div>
      </div>
    );
  }

  // Don't show anything if online and no pending changes
  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null;
  }

  return (
    <div
      className={clsx(
        'fixed top-0 left-0 right-0 z-50 py-2 px-4 text-center text-sm font-medium transition-all duration-300',
        !isOnline
          ? 'bg-slate-800 text-white'
          : isSyncing
          ? 'bg-primary-500 text-white'
          : pendingCount > 0
          ? 'bg-warning-500 text-white'
          : 'bg-success-500 text-white'
      )}
    >
      <div className="flex items-center justify-center gap-2">
        {!isOnline ? (
          <>
            <WifiOff className="h-4 w-4" />
            <span>{t('offline.banner')}</span>
            {pendingCount > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                {pendingCount} {t('offline.syncPending')}
              </span>
            )}
          </>
        ) : isSyncing ? (
          <>
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>{t('offline.syncing')}</span>
          </>
        ) : pendingCount > 0 ? (
          <>
            <CloudOff className="h-4 w-4" />
            <span>{pendingCount} {t('offline.syncPending') || 'changes pending sync'}</span>
          </>
        ) : (
          <>
            <Check className="h-4 w-4" />
            <span>{t('offline.syncComplete')}</span>
          </>
        )}
      </div>
    </div>
  );
}
