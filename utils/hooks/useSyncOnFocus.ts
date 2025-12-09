import { useCallback } from 'react';
import { offlineQueue } from '@/utils/offlineQueue';
import { useFocusEffect } from 'expo-router';

export function useSyncOnFocus() {
  const sync = useCallback(async () => {
    console.log('🔄 [useSyncOnFocus] Screen focused, triggering sync');
    try {
      await offlineQueue.syncQueue('auto');
    } catch (error) {
      console.error('❌ [useSyncOnFocus] Sync error:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      sync();
      return () => {};
    }, [sync])
  );

  return { sync };
}
