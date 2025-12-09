import {
  collectDebugInfo,
  clearAsyncStorageCache,
  forceOfflineSync,
  retryFailedQueueItems,
  clearFailedQueueItems,
  formatBytes,
  formatTimestamp,
} from '@/utils/debugHelpers';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getAllKeys: jest.fn().mockResolvedValue(['key1', 'key2', 'key3']),
  multiGet: jest.fn().mockResolvedValue([
    ['key1', 'value1'],
    ['key2', 'value2'],
    ['key3', 'value3'],
  ]),
  multiRemove: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn().mockResolvedValue({
    isConnected: true,
    type: 'wifi',
    isInternetReachable: true,
  }),
}));

jest.mock('@/config/firebase', () => ({
  auth: {
    currentUser: { uid: 'test-user-123' },
  },
  db: {},
}));

jest.mock('@/utils/offlineQueue', () => ({
  offlineQueue: {
    getSyncStatus: jest.fn(() => ({
      lastSyncTime: Date.now() - 60000,
      isSyncing: false,
      pendingCount: 11,
      failedCount: 2,
      p0Count: 5,
      p1Count: 3,
      p2Count: 2,
      p3Count: 1,
    })),
    getQueuedItems: jest.fn(() => [
      {
        id: 'item1',
        operation: { type: 'create' },
        entityType: 'task',
        priority: 'P0',
        timestamp: Date.now(),
        retryCount: 0,
      },
    ]),
    syncQueue: jest.fn().mockResolvedValue(undefined),
    retryFailedItems: jest.fn().mockResolvedValue(undefined),
    clearFailedItems: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('Debug Helpers (Task 7)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('collectDebugInfo', () => {
    it('should collect comprehensive system status', async () => {
      const info = await collectDebugInfo();
      
      expect(info).toMatchObject({
        timestamp: expect.any(Number),
        network: {
          isConnected: expect.any(Boolean),
          type: expect.any(String),
        },
        firebase: {
          isConfigured: expect.any(Boolean),
          isAuthenticated: expect.any(Boolean),
          canConnect: expect.any(Boolean),
        },
        asyncStorage: {
          isAccessible: expect.any(Boolean),
          keys: expect.any(Array),
          totalSize: expect.any(Number),
        },
        offlineQueue: {
          isEnabled: expect.any(Boolean),
          isSyncing: expect.any(Boolean),
          lastSyncTime: expect.any(Number),
          p0Count: expect.any(Number),
          p1Count: expect.any(Number),
          p2Count: expect.any(Number),
          p3Count: expect.any(Number),
          failedCount: expect.any(Number),
          queueItems: expect.any(Array),
        },
      });
    });

    it('should handle network check errors gracefully', async () => {
      const NetInfo = require('@react-native-community/netinfo');
      NetInfo.fetch.mockRejectedValueOnce(new Error('Network check failed'));
      
      const info = await collectDebugInfo();
      
      expect(info.network).toBeDefined();
      expect(info.network.isConnected).toBe(false);
    });

    it('should handle AsyncStorage errors gracefully', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      AsyncStorage.getAllKeys.mockRejectedValueOnce(new Error('Storage error'));
      
      const info = await collectDebugInfo();
      
      expect(info.asyncStorage).toBeDefined();
      expect(info.asyncStorage.isAccessible).toBe(false);
      expect(info.asyncStorage.error).toBeDefined();
    });
  });

  describe('clearAsyncStorageCache', () => {
    it('should clear cache entries', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      AsyncStorage.getAllKeys.mockResolvedValueOnce([
        '@sitePack_123',
        '@userCache_456',
        'other_key',
      ]);
      
      const count = await clearAsyncStorageCache();
      
      expect(count).toBe(2);
      expect(AsyncStorage.multiRemove).toHaveBeenCalledWith(['@sitePack_123', '@userCache_456']);
    });

    it('should not clear auth-related keys', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      AsyncStorage.getAllKeys.mockResolvedValueOnce([
        '@sitePack_123',
        'auth_token',
        '@surveyorImages_456',
      ]);
      
      await clearAsyncStorageCache();
      
      const removedKeys = AsyncStorage.multiRemove.mock.calls[0][0];
      expect(removedKeys).toContain('@sitePack_123');
      expect(removedKeys).toContain('@surveyorImages_456');
      expect(removedKeys).not.toContain('auth_token');
    });
  });

  describe('forceOfflineSync', () => {
    it('should trigger offline queue sync', async () => {
      const { offlineQueue } = require('@/utils/offlineQueue');
      
      await forceOfflineSync();
      
      expect(offlineQueue.syncQueue).toHaveBeenCalledWith('full');
    });

    it('should handle sync errors gracefully', async () => {
      const { offlineQueue } = require('@/utils/offlineQueue');
      offlineQueue.syncQueue.mockRejectedValueOnce(new Error('Sync failed'));
      
      await expect(forceOfflineSync()).rejects.toThrow('Sync failed');
    });
  });

  describe('retryFailedQueueItems', () => {
    it('should retry failed queue items', async () => {
      const { offlineQueue } = require('@/utils/offlineQueue');
      
      await retryFailedQueueItems();
      
      expect(offlineQueue.retryFailedItems).toHaveBeenCalled();
    });
  });

  describe('clearFailedQueueItems', () => {
    it('should clear failed queue items', async () => {
      const { offlineQueue } = require('@/utils/offlineQueue');
      
      await clearFailedQueueItems();
      
      expect(offlineQueue.clearFailedItems).toHaveBeenCalled();
    });
  });

  describe('Utility Functions', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1048576)).toBe('1 MB');
      expect(formatBytes(1073741824)).toBe('1 GB');
    });

    it('should format timestamp correctly', () => {
      const now = Date.now();
      const formatted = formatTimestamp(now);
      
      expect(formatted).toBe('Just now');
    });

    it('should format timestamp from minutes ago', () => {
      const twoMinutesAgo = Date.now() - 120000;
      const formatted = formatTimestamp(twoMinutesAgo);
      
      expect(formatted).toBe('2 min ago');
    });

    it('should format timestamp from hours ago', () => {
      const twoHoursAgo = Date.now() - 7200000;
      const formatted = formatTimestamp(twoHoursAgo);
      
      expect(formatted).toBe('2 hr ago');
    });

    it('should handle null timestamp', () => {
      expect(formatTimestamp(null)).toBe('Never');
    });
  });
});
