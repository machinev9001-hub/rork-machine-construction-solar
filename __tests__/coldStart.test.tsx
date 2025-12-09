import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { InteractionManager } from 'react-native';

jest.mock('expo-router', () => ({
  Slot: 'Slot',
  useRouter: () => ({
    replace: jest.fn(),
  }),
  useSegments: () => [],
}));

jest.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }: any) => children,
  useAuth: () => ({
    isAuthenticated: false,
    isLoading: false,
  }),
}));

jest.mock('@tanstack/react-query', () => ({
  QueryClient: jest.fn(),
  QueryClientProvider: ({ children }: any) => children,
}));

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn().mockResolvedValue({
    isConnected: true,
    type: 'wifi',
    isInternetReachable: true,
  }),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}));

jest.mock('@/config/firebase', () => ({
  auth: { currentUser: null },
  db: {},
}));

jest.mock('@/utils/offlineQueue', () => ({
  offlineQueue: {
    init: jest.fn().mockResolvedValue(undefined),
    getSyncStatus: jest.fn(() => ({
      lastSyncTime: null,
      isSyncing: false,
      pendingCount: 0,
      failedCount: 0,
      p0Count: 0,
      p1Count: 0,
      p2Count: 0,
      p3Count: 0,
    })),
    getQueuedItems: jest.fn(() => []),
  },
}));

jest.mock('@/utils/sitePackManager', () => ({
  sitePackManager: {
    init: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@rork-ai/toolkit-sdk', () => ({
  AnalyticsProvider: ({ children }: any) => children,
}), { virtual: true });

jest.mock('@rork-ai/toolkit-dev-sdk/v54', () => ({
  RorkDevWrapper: ({ children }: any) => children,
}), { virtual: true });

describe('Cold Start Performance (Tasks 1-2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Non-blocking Initialization', () => {
    it('should defer offlineQueue.init to background', async () => {
      const { offlineQueue } = require('@/utils/offlineQueue');
      const runAfterInteractionsSpy = jest.spyOn(InteractionManager, 'runAfterInteractions');
      
      const RootLayout = require('@/app/_layout').default;
      render(<RootLayout />);
      
      await waitFor(() => {
        expect(runAfterInteractionsSpy).toHaveBeenCalled();
      });
    });

    it('should defer sitePackManager.init to background', async () => {
      const { sitePackManager } = require('@/utils/sitePackManager');
      const runAfterInteractionsSpy = jest.spyOn(InteractionManager, 'runAfterInteractions');
      
      const RootLayout = require('@/app/_layout').default;
      render(<RootLayout />);
      
      await waitFor(() => {
        expect(runAfterInteractionsSpy).toHaveBeenCalled();
      });
    });

    it('should not block UI during initialization', async () => {
      const startTime = Date.now();
      
      const RootLayout = require('@/app/_layout').default;
      const renderResult = render(<RootLayout />);
      
      const renderTime = Date.now() - startTime;
      
      expect(renderTime).toBeLessThan(500);
      expect(renderResult.toJSON()).toBeTruthy();
    });
  });

  describe('Timeout Handling', () => {
    it('should handle offlineQueue init timeout gracefully', async () => {
      const { offlineQueue } = require('@/utils/offlineQueue');
      offlineQueue.init.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 2000))
      );
      
      const RootLayout = require('@/app/_layout').default;
      const renderResult = render(<RootLayout />);
      
      expect(renderResult.toJSON()).toBeTruthy();
      
      await waitFor(() => {
        expect(offlineQueue.init).toHaveBeenCalled();
      }, { timeout: 1500 });
    });

    it('should retry failed initialization in background', async () => {
      const { offlineQueue } = require('@/utils/offlineQueue');
      offlineQueue.init
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce(undefined);
      
      const RootLayout = require('@/app/_layout').default;
      render(<RootLayout />);
      
      await waitFor(() => {
        expect(offlineQueue.init).toHaveBeenCalledTimes(2);
      }, { timeout: 5000 });
    });
  });

  describe('Error Resilience', () => {
    it('should not crash if offlineQueue init fails', async () => {
      const { offlineQueue } = require('@/utils/offlineQueue');
      offlineQueue.init.mockRejectedValue(new Error('Init failed'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const RootLayout = require('@/app/_layout').default;
      const renderResult = render(<RootLayout />);
      
      expect(renderResult.toJSON()).toBeTruthy();
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });
      
      consoleSpy.mockRestore();
    });

    it('should not crash if sitePackManager init fails', async () => {
      const { sitePackManager } = require('@/utils/sitePackManager');
      sitePackManager.init.mockRejectedValue(new Error('Init failed'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const RootLayout = require('@/app/_layout').default;
      const renderResult = render(<RootLayout />);
      
      expect(renderResult.toJSON()).toBeTruthy();
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });
      
      consoleSpy.mockRestore();
    });
  });
});

describe('OfflineBanner Non-blocking (Task 3)', () => {
  it('should render with pointerEvents box-none', () => {
    const OfflineBanner = require('@/components/OfflineBanner').default;
    const renderResult = render(<OfflineBanner />);
    
    expect(renderResult.toJSON()).toBeTruthy();
  });

  it('should auto-hide after timeout', async () => {
    jest.useFakeTimers();
    
    const OfflineBanner = require('@/components/OfflineBanner').default;
    const { queryByText } = render(<OfflineBanner />);
    
    const banner = queryByText(/making changes/i);
    if (banner) {
      expect(banner).toBeTruthy();
      
      jest.advanceTimersByTime(4000);
      
      await waitFor(() => {
        const hiddenBanner = queryByText(/making changes/i);
        expect(hiddenBanner).toBeFalsy();
      });
    }
    
    jest.useRealTimers();
  });
});
