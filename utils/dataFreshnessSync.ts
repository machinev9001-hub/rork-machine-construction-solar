import { useCallback, useMemo } from 'react';
import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '@/config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

/**
 * DATA FRESHNESS SYSTEM
 * 
 * This system ensures that when data exists in both AsyncStorage and Firebase,
 * we always use the FRESHEST data by checking timestamps.
 * 
 * 1. Real-time listeners: Auto-update when Firebase changes (online only)
 * 2. Timestamp comparison: Compare Firebase vs AsyncStorage timestamps
 * 3. P0 sync completion callbacks: Notify when critical data syncs complete
 */

const FRESHNESS_NOTIFICATION_KEY = '@freshness_notifications';

export type FreshnessNotification = {
  id: string;
  timestamp: number;
  message: string;
  entityType: string;
  entityId: string;
  read: boolean;
};

export type DataSource = 'firebase' | 'asyncstorage' | 'merged';

export type TimestampedData<T> = {
  data: T;
  source: DataSource;
  timestamp: string;
  isFresh: boolean;
};

class DataFreshnessManager {
  private listeners: Map<string, Unsubscribe> = new Map();
  private notificationCallbacks: Set<(notifications: FreshnessNotification[]) => void> = new Set();
  private notifications: FreshnessNotification[] = [];

  async init() {
    await this.loadNotifications();
    console.log('[DataFreshness] Initialized with', this.notifications.length, 'notifications');
  }

  /**
   * ==========================================
   * 1. REAL-TIME LISTENERS
   * ==========================================
   * Listen to Firebase document changes and auto-update AsyncStorage
   */
  
  async subscribeToDocument<T>(
    collection: string,
    docId: string,
    cacheKey: string,
    onUpdate: (data: T, timestamp: string) => Promise<void>
  ): Promise<string> {
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log('[DataFreshness] Offline - skipping real-time listener for:', docId);
      return 'offline_skip';
    }

    const listenerKey = `${collection}/${docId}`;
    
    // Clean up existing listener if any
    if (this.listeners.has(listenerKey)) {
      console.log('[DataFreshness] Cleaning up old listener:', listenerKey);
      this.listeners.get(listenerKey)!();
      this.listeners.delete(listenerKey);
    }

    const docRef = doc(db, collection, docId);
    
    console.log('[DataFreshness] Setting up real-time listener:', listenerKey);
    
    const unsubscribe = onSnapshot(
      docRef,
      async (snapshot) => {
        if (!snapshot.exists()) {
          console.log('[DataFreshness] Document deleted:', listenerKey);
          return;
        }

        const data = snapshot.data() as T;
        const timestamp = new Date().toISOString();
        
        console.log('[DataFreshness] Real-time update received:', listenerKey, 'at', timestamp);

        // Update AsyncStorage with fresh data
        await AsyncStorage.setItem(
          cacheKey,
          JSON.stringify({
            data,
            timestamp,
            source: 'firebase',
          })
        );

        // Trigger custom update callback
        await onUpdate(data, timestamp);
        
        console.log('[DataFreshness] AsyncStorage updated from Firebase:', listenerKey);
      },
      (error) => {
        console.error('[DataFreshness] Listener error:', listenerKey, error);
      }
    );

    this.listeners.set(listenerKey, unsubscribe);
    return listenerKey;
  }

  unsubscribeFromDocument(listenerKey: string) {
    const unsubscribe = this.listeners.get(listenerKey);
    if (unsubscribe) {
      console.log('[DataFreshness] Unsubscribing from:', listenerKey);
      unsubscribe();
      this.listeners.delete(listenerKey);
    }
  }

  unsubscribeAll() {
    console.log('[DataFreshness] Unsubscribing from all listeners:', this.listeners.size);
    this.listeners.forEach((unsubscribe) => unsubscribe());
    this.listeners.clear();
  }

  /**
   * ==========================================
   * 2. TIMESTAMP-BASED FRESHNESS CHECK
   * ==========================================
   * Compare timestamps to determine which data is fresher
   */

  async getFreshestData<T>(options: {
    firebaseData?: T;
    firebaseTimestamp?: string;
    asyncStorageKey: string;
    preferSource?: 'firebase' | 'asyncstorage';
  }): Promise<TimestampedData<T | null>> {
    const { firebaseData, firebaseTimestamp, asyncStorageKey, preferSource } = options;

    console.log('[DataFreshness] Checking freshness for:', asyncStorageKey);

    let asyncData: T | null = null;
    let asyncTimestamp: string | null = null;
    
    try {
      // Load from AsyncStorage
      const cached = await AsyncStorage.getItem(asyncStorageKey);

      if (cached) {
        const parsed = JSON.parse(cached);
        asyncData = parsed.data || parsed;
        asyncTimestamp = parsed.timestamp || parsed.updatedAt || null;
        console.log('[DataFreshness] AsyncStorage data found, timestamp:', asyncTimestamp);
      } else {
        console.log('[DataFreshness] No AsyncStorage data found');
      }

      // If only one source has data, use that
      if (firebaseData && !asyncData) {
        console.log('[DataFreshness] Using Firebase (only source)');
        return {
          data: firebaseData,
          source: 'firebase',
          timestamp: firebaseTimestamp || new Date().toISOString(),
          isFresh: true,
        };
      }

      if (!firebaseData && asyncData) {
        console.log('[DataFreshness] Using AsyncStorage (only source)');
        return {
          data: asyncData,
          source: 'asyncstorage',
          timestamp: asyncTimestamp || 'unknown',
          isFresh: false,
        };
      }

      if (!firebaseData && !asyncData) {
        console.log('[DataFreshness] No data from any source');
        return {
          data: null,
          source: 'asyncstorage',
          timestamp: 'never',
          isFresh: false,
        };
      }

      // Both sources have data - compare timestamps
      if (firebaseTimestamp && asyncTimestamp) {
        const firebaseTime = new Date(firebaseTimestamp).getTime();
        const asyncTime = new Date(asyncTimestamp).getTime();

        console.log('[DataFreshness] Comparing timestamps:');
        console.log('  Firebase:', firebaseTimestamp, '(', firebaseTime, ')');
        console.log('  AsyncStorage:', asyncTimestamp, '(', asyncTime, ')');

        if (firebaseTime > asyncTime) {
          console.log('[DataFreshness] ✅ Firebase is NEWER - using Firebase');
          return {
            data: firebaseData!,
            source: 'firebase',
            timestamp: firebaseTimestamp,
            isFresh: true,
          };
        } else if (asyncTime > firebaseTime) {
          console.log('[DataFreshness] ⚠️ AsyncStorage is NEWER - using AsyncStorage (pending sync?)');
          return {
            data: asyncData!,
            source: 'asyncstorage',
            timestamp: asyncTimestamp,
            isFresh: true,
          };
        } else {
          console.log('[DataFreshness] ✅ Same timestamp - using Firebase');
          return {
            data: firebaseData!,
            source: 'firebase',
            timestamp: firebaseTimestamp,
            isFresh: true,
          };
        }
      }

      // Fallback: If no timestamps, prefer Firebase or explicit preference
      const source = preferSource === 'asyncstorage' ? 'asyncstorage' : 'firebase';
      console.log('[DataFreshness] No timestamps available, preferring:', source);

      return {
        data: source === 'firebase' ? firebaseData! : asyncData!,
        source,
        timestamp: source === 'firebase' ? firebaseTimestamp || 'now' : asyncTimestamp || 'unknown',
        isFresh: source === 'firebase',
      };
    } catch (error) {
      console.error('[DataFreshness] Error checking freshness:', error);
      return {
        data: firebaseData || asyncData || null,
        source: firebaseData ? 'firebase' : 'asyncstorage',
        timestamp: firebaseTimestamp || asyncTimestamp || 'error',
        isFresh: false,
      };
    }
  }

  /**
   * ==========================================
   * 3. P0 SYNC COMPLETION CALLBACKS
   * ==========================================
   * Trigger callbacks when critical P0 data syncs complete
   */

  private syncCallbacks: Set<(options: {
    entityType: string;
    entityId: string;
    message: string;
  }) => void> = new Set();

  onP0SyncComplete(callback: (options: {
    entityType: string;
    entityId: string;
    message: string;
  }) => void) {
    this.syncCallbacks.add(callback);
    return () => {
      this.syncCallbacks.delete(callback);
    };
  }

  async notifyP0SyncComplete(options: {
    entityType: string;
    entityId: string;
    message: string;
  }) {
    console.log('[DataFreshness] P0 sync complete:', options.message);
    
    // Notify all callbacks
    this.syncCallbacks.forEach((callback) => {
      try {
        callback(options);
      } catch (error) {
        console.error('[DataFreshness] Error in sync callback:', error);
      }
    });
  }

  subscribeToNotifications(callback: (notifications: FreshnessNotification[]) => void) {
    this.notificationCallbacks.add(callback);
    callback(this.notifications);
    
    return () => {
      this.notificationCallbacks.delete(callback);
    };
  }

  private notifyCallbacks() {
    this.notificationCallbacks.forEach((callback) => callback(this.notifications));
  }

  getUnreadNotifications(): FreshnessNotification[] {
    return this.notifications.filter((n) => !n.read);
  }

  async markNotificationAsRead(notificationId: string) {
    const notification = this.notifications.find((n) => n.id === notificationId);
    if (notification) {
      notification.read = true;
      await this.saveNotifications();
      this.notifyCallbacks();
    }
  }

  async markAllNotificationsAsRead() {
    this.notifications.forEach((n) => (n.read = true));
    await this.saveNotifications();
    this.notifyCallbacks();
  }

  async clearNotifications() {
    this.notifications = [];
    await this.saveNotifications();
    this.notifyCallbacks();
  }

  private async loadNotifications() {
    try {
      const stored = await AsyncStorage.getItem(FRESHNESS_NOTIFICATION_KEY);
      if (stored) {
        this.notifications = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[DataFreshness] Error loading notifications:', error);
    }
  }

  private async saveNotifications() {
    try {
      await AsyncStorage.setItem(FRESHNESS_NOTIFICATION_KEY, JSON.stringify(this.notifications));
    } catch (error) {
      console.error('[DataFreshness] Error saving notifications:', error);
    }
  }
}

export const dataFreshnessManager = new DataFreshnessManager();

/**
 * Hook to use freshness notifications
 */
export function useFreshnessNotifications() {
  const subscribe = useCallback(
    (callback: (notifications: FreshnessNotification[]) => void) =>
      dataFreshnessManager.subscribeToNotifications(callback),
    [],
  );

  const getUnread = useCallback(
    () => dataFreshnessManager.getUnreadNotifications(),
    [],
  );

  const markAsRead = useCallback(
    (notificationId: string) => dataFreshnessManager.markNotificationAsRead(notificationId),
    [],
  );

  const markAllAsRead = useCallback(
    () => dataFreshnessManager.markAllNotificationsAsRead(),
    [],
  );

  const clear = useCallback(
    () => dataFreshnessManager.clearNotifications(),
    [],
  );

  return useMemo(
    () => ({
      subscribe,
      getUnread,
      markAsRead,
      markAllAsRead,
      clear,
    }),
    [subscribe, getUnread, markAsRead, markAllAsRead, clear],
  );
}
