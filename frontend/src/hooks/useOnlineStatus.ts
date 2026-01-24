import { useSync } from '@/contexts/SyncContext';

interface OnlineStatus {
  isOnline: boolean;
  isSyncing: boolean;
  isInitializing: boolean;
  pendingCount: number;
  lastSyncAt: string | undefined;
  syncError: string | null;
  sync: () => Promise<void>;
}

export function useOnlineStatus(): OnlineStatus {
  const syncContext = useSync();

  return {
    isOnline: syncContext.isOnline,
    isSyncing: syncContext.isSyncing,
    isInitializing: syncContext.isInitializing,
    pendingCount: syncContext.pendingCount,
    lastSyncAt: syncContext.lastSyncAt,
    syncError: syncContext.syncError,
    sync: syncContext.sync,
  };
}
