import { useEffect, useState, useRef } from 'react';
import Toast from 'react-native-root-toast';
import { dataFreshnessManager } from '@/utils/dataFreshnessSync';
import { useOfflineQueue } from '@/utils/offlineQueue';

export default function FreshnessNotificationBanner() {
  const offlineQueue = useOfflineQueue();
  const [isSyncing, setIsSyncing] = useState(false);
  const currentToastRef = useRef<any>(null);

  useEffect(() => {
    const unsubscribeSync = dataFreshnessManager.onP0SyncComplete((options) => {
      console.log('[FreshnessNotificationBanner] P0 sync complete:', options.message);
      
      if (currentToastRef.current) {
        Toast.hide(currentToastRef.current);
        currentToastRef.current = null;
      }

      currentToastRef.current = Toast.show('Synchronized', {
        duration: Toast.durations.SHORT,
        position: Toast.positions.BOTTOM,
        shadow: true,
        animation: true,
        hideOnPress: true,
        backgroundColor: '#34A853',
        textColor: '#ffffff',
        opacity: 0.9,
      });
    });

    const unsubscribeQueue = offlineQueue.subscribe((status) => {
      const wasSyncing = isSyncing;
      const nowSyncing = status.isSyncing;
      
      setIsSyncing(nowSyncing);

      if (nowSyncing && !wasSyncing) {
        if (currentToastRef.current) {
          Toast.hide(currentToastRef.current);
        }

        const pendingCount = status.p0Count + status.p1Count + status.p2Count + status.p3Count;
        const message = status.p0Count > 0 
          ? `Syncing ${status.p0Count} critical item${status.p0Count > 1 ? 's' : ''}...`
          : `Syncing ${pendingCount} item${pendingCount > 1 ? 's' : ''}...`;

        currentToastRef.current = Toast.show(message, {
          duration: Toast.durations.LONG,
          position: Toast.positions.BOTTOM,
          shadow: true,
          animation: true,
          hideOnPress: false,
          backgroundColor: '#1a73e8',
          textColor: '#ffffff',
          opacity: 0.9,
        });

        console.log('[FreshnessNotificationBanner] Sync started:', message);
      } else if (!nowSyncing && wasSyncing) {
        if (currentToastRef.current) {
          Toast.hide(currentToastRef.current);
          currentToastRef.current = null;
        }
        console.log('[FreshnessNotificationBanner] Sync complete');
      }
    });

    return () => {
      unsubscribeSync();
      unsubscribeQueue();
      if (currentToastRef.current) {
        Toast.hide(currentToastRef.current);
        currentToastRef.current = null;
      }
    };
  }, [isSyncing]);

  return null;
}
