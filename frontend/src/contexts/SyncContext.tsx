import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { initialDataLoad, performSync, getSyncStatus, isOnline as checkOnline } from '@/services/sync';
import { getPendingCount } from '@/services/db';

interface SyncContextValue {
  isOnline: boolean;
  isSyncing: boolean;
  isInitializing: boolean;
  pendingCount: number;
  lastSyncAt: string | undefined;
  syncError: string | null;
  sync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(checkOnline());
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<string | undefined>();
  const [syncError, setSyncError] = useState<string | null>(null);

  // Initial data load on app startup
  useEffect(() => {
    const initialize = async () => {
      setIsInitializing(true);
      try {
        // Load initial sync status
        const status = await getSyncStatus();
        setLastSyncAt(status.lastSyncAt);
        setPendingCount(status.pendingCount);

        // If online, pull latest data from server
        if (checkOnline()) {
          await initialDataLoad();
          const newStatus = await getSyncStatus();
          setLastSyncAt(newStatus.lastSyncAt);
          setPendingCount(newStatus.pendingCount);
        }
      } catch (error) {
        console.error('Initial sync failed:', error);
        setSyncError('Failed to load data from server');
      } finally {
        setIsInitializing(false);
      }
    };

    initialize();
  }, []);

  // Update pending count periodically
  useEffect(() => {
    const updatePendingCount = async () => {
      const count = await getPendingCount();
      setPendingCount(count);
    };

    const interval = setInterval(updatePendingCount, 5000);
    return () => clearInterval(interval);
  }, []);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      setSyncError(null);
      // Auto-sync when coming online
      setIsSyncing(true);
      try {
        await performSync();
        const status = await getSyncStatus();
        setPendingCount(status.pendingCount);
        setLastSyncAt(status.lastSyncAt);
      } catch (error) {
        setSyncError('Sync failed after reconnecting');
      } finally {
        setIsSyncing(false);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsSyncing(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const sync = useCallback(async () => {
    if (!checkOnline() || isSyncing) return;

    setIsSyncing(true);
    setSyncError(null);
    try {
      const result = await performSync();
      const status = await getSyncStatus();
      setPendingCount(status.pendingCount);
      setLastSyncAt(status.lastSyncAt);

      if (!result.success) {
        setSyncError(`Sync completed with errors: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      setSyncError('Sync failed');
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  return (
    <SyncContext.Provider value={{
      isOnline,
      isSyncing,
      isInitializing,
      pendingCount,
      lastSyncAt,
      syncError,
      sync,
    }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncContextValue {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}
