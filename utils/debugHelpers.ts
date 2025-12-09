import AsyncStorage from '@react-native-async-storage/async-storage';
import { db, auth } from '@/config/firebase';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { offlineQueue } from '@/utils/offlineQueue';
import NetInfo from '@react-native-community/netinfo';

export interface DebugInfo {
  timestamp: number;
  firebase: {
    isConfigured: boolean;
    isAuthenticated: boolean;
    currentUser: string | null;
    canConnect: boolean;
    connectionError?: string;
  };
  asyncStorage: {
    isAccessible: boolean;
    keys: string[];
    totalSize: number;
    error?: string;
  };
  offlineQueue: {
    isEnabled: boolean;
    pendingCount: number;
    failedCount: number;
    p0Count: number;
    p1Count: number;
    p2Count: number;
    p3Count: number;
    lastSyncTime: number | null;
    isSyncing: boolean;
    queueItems: Array<{
      id: string;
      type: string;
      priority: string;
      entityType: string;
      retryCount: number;
      timestamp: number;
      lastError?: string;
    }>;
  };
  network: {
    isConnected: boolean;
    type: string | null;
    isInternetReachable: boolean | null;
  };
}

export async function collectDebugInfo(): Promise<DebugInfo> {
  console.log('[DebugHelpers] Starting debug info collection...');
  
  const debugInfo: DebugInfo = {
    timestamp: Date.now(),
    firebase: {
      isConfigured: false,
      isAuthenticated: false,
      currentUser: null,
      canConnect: false,
    },
    asyncStorage: {
      isAccessible: false,
      keys: [],
      totalSize: 0,
    },
    offlineQueue: {
      isEnabled: true,
      pendingCount: 0,
      failedCount: 0,
      p0Count: 0,
      p1Count: 0,
      p2Count: 0,
      p3Count: 0,
      lastSyncTime: null,
      isSyncing: false,
      queueItems: [],
    },
    network: {
      isConnected: false,
      type: null,
      isInternetReachable: null,
    },
  };

  await Promise.all([
    checkFirebase(debugInfo),
    checkAsyncStorage(debugInfo),
    checkOfflineQueue(debugInfo),
    checkNetwork(debugInfo),
  ]);

  console.log('[DebugHelpers] Debug info collection complete');
  return debugInfo;
}

async function checkFirebase(debugInfo: DebugInfo) {
  try {
    debugInfo.firebase.isConfigured = !!db && !!auth;
    debugInfo.firebase.isAuthenticated = !!auth.currentUser;
    debugInfo.firebase.currentUser = auth.currentUser?.uid || null;

    if (db) {
      try {
        const testQuery = query(collection(db, 'users'), limit(1));
        await getDocs(testQuery);
        debugInfo.firebase.canConnect = true;
      } catch (error: any) {
        debugInfo.firebase.canConnect = false;
        debugInfo.firebase.connectionError = error.message;
        console.warn('[DebugHelpers] Firebase connection test failed:', error);
      }
    }
  } catch (error: any) {
    debugInfo.firebase.connectionError = error.message;
    console.error('[DebugHelpers] Firebase check error:', error);
  }
}

async function checkAsyncStorage(debugInfo: DebugInfo) {
  try {
    const testKey = '__debug_test__';
    await AsyncStorage.setItem(testKey, 'test');
    await AsyncStorage.getItem(testKey);
    await AsyncStorage.removeItem(testKey);
    
    debugInfo.asyncStorage.isAccessible = true;
    
    const keys = await AsyncStorage.getAllKeys();
    debugInfo.asyncStorage.keys = Array.from(keys);
    
    let totalSize = 0;
    for (const key of keys) {
      try {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalSize += value.length;
        }
      } catch (error) {
        console.warn('[DebugHelpers] Error reading key:', key, error);
      }
    }
    
    debugInfo.asyncStorage.totalSize = totalSize;
    console.log('[DebugHelpers] AsyncStorage check complete:', keys.length, 'keys,', totalSize, 'bytes');
  } catch (error: any) {
    debugInfo.asyncStorage.isAccessible = false;
    debugInfo.asyncStorage.error = error.message;
    console.error('[DebugHelpers] AsyncStorage check error:', error);
  }
}

async function checkOfflineQueue(debugInfo: DebugInfo) {
  try {
    const status = offlineQueue.getSyncStatus();
    const items = offlineQueue.getQueuedItems();
    
    debugInfo.offlineQueue = {
      isEnabled: true,
      pendingCount: status.pendingCount,
      failedCount: status.failedCount,
      p0Count: status.p0Count,
      p1Count: 0,
      p2Count: status.p2Count,
      p3Count: status.p3Count,
      lastSyncTime: status.lastSyncTime,
      isSyncing: status.isSyncing,
      queueItems: items.map(item => ({
        id: item.id,
        type: item.operation.type,
        priority: item.priority,
        entityType: item.entityType,
        retryCount: item.retryCount,
        timestamp: item.timestamp,
        lastError: item.lastError,
      })),
    };
  } catch (error: any) {
    console.error('[DebugHelpers] OfflineQueue check error:', error);
  }
}

async function checkNetwork(debugInfo: DebugInfo) {
  try {
    const netInfo = await NetInfo.fetch();
    debugInfo.network = {
      isConnected: netInfo.isConnected || false,
      type: netInfo.type || null,
      isInternetReachable: netInfo.isInternetReachable,
    };
  } catch (error: any) {
    console.error('[DebugHelpers] Network check error:', error);
  }
}

export async function clearAsyncStorageCache() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(
      key => 
        key.startsWith('@sitePack_') || 
        key.startsWith('@userCache_') ||
        key.startsWith('@surveyorImages_')
    );
    
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
      console.log('[DebugHelpers] Cleared', cacheKeys.length, 'cache keys');
      return cacheKeys.length;
    }
    
    return 0;
  } catch (error) {
    console.error('[DebugHelpers] Error clearing cache:', error);
    throw error;
  }
}

export async function forceOfflineSync() {
  try {
    console.log('[DebugHelpers] Forcing offline queue sync...');
    await offlineQueue.syncQueue('full');
    console.log('[DebugHelpers] Force sync complete');
  } catch (error) {
    console.error('[DebugHelpers] Force sync error:', error);
    throw error;
  }
}

export async function retryFailedQueueItems() {
  try {
    console.log('[DebugHelpers] Retrying failed queue items...');
    await offlineQueue.retryFailedItems();
    console.log('[DebugHelpers] Retry complete');
  } catch (error) {
    console.error('[DebugHelpers] Retry error:', error);
    throw error;
  }
}

export async function clearFailedQueueItems() {
  try {
    console.log('[DebugHelpers] Clearing failed queue items...');
    await offlineQueue.clearFailedItems();
    console.log('[DebugHelpers] Clear complete');
  } catch (error) {
    console.error('[DebugHelpers] Clear error:', error);
    throw error;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

export function formatTimestamp(timestamp: number | null): string {
  if (!timestamp) return 'Never';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' min ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' hr ago';
  
  return date.toLocaleString();
}
