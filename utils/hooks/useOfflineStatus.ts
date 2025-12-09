import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { offlineQueue, SyncStatus } from '@/utils/offlineQueue';
import { OFFLINE_CONFIG } from '@/constants/colors';

export interface OfflineStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  syncStatus: SyncStatus;
}

export function useOfflineStatus() {
  const [status, setStatus] = useState<OfflineStatus>({
    isConnected: true,
    isInternetReachable: true,
    syncStatus: offlineQueue.getSyncStatus(),
  });

  useEffect(() => {
    let unsubscribeQueue: (() => void) | undefined;
    let unsubscribeNetInfo: (() => void) | undefined;
    let isSubscribed = true;

    if (OFFLINE_CONFIG.ENABLE_OFFLINE_QUEUE) {
      unsubscribeQueue = offlineQueue.subscribe((syncStatus) => {
        if (isSubscribed) {
          setStatus(prev => ({ ...prev, syncStatus }));
        }
      });
    }

    unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      console.log('[useOfflineStatus] Network state changed:', {
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
      });
      if (isSubscribed) {
        setStatus(prev => ({
          ...prev,
          isConnected: state.isConnected ?? true,
          isInternetReachable: state.isInternetReachable ?? null,
        }));
      }
    });

    NetInfo.fetch().then((state) => {
      console.log('[useOfflineStatus] Initial network state:', {
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
      });
      if (isSubscribed) {
        setStatus(prev => ({
          ...prev,
          isConnected: state.isConnected ?? true,
          isInternetReachable: state.isInternetReachable ?? null,
        }));
      }
    }).catch((err) => {
      console.error('[useOfflineStatus] Error fetching network state:', err);
    });

    return () => {
      isSubscribed = false;
      if (unsubscribeQueue) {
        unsubscribeQueue();
      }
      if (unsubscribeNetInfo) {
        unsubscribeNetInfo();
      }
    };
  }, []);

  const formatLastSync = (): string => {
    if (!status.syncStatus.lastSyncTime) {
      return 'Never synced';
    }

    const now = Date.now();
    const diff = now - status.syncStatus.lastSyncTime;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  return {
    ...status,
    isOffline: !status.isConnected,
    hasPendingChanges: status.syncStatus.pendingCount > 0,
    hasFailedChanges: status.syncStatus.failedCount > 0,
    lastSyncFormatted: formatLastSync(),
  };
}
