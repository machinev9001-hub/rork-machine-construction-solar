import { SafeAnalytics } from '@/utils/analytics';

global.fetch = jest.fn();

describe('Safe Analytics (Task 6)', () => {
  let analytics: SafeAnalytics;

  beforeEach(() => {
    jest.clearAllMocks();
    analytics = new SafeAnalytics();
  });

  describe('Network Error Handling', () => {
    it('should not crash on network error during flush', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      await expect(analytics.safeFlush()).resolves.not.toThrow();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to flush analytics')
      );
      
      consoleSpy.mockRestore();
    });

    it('should queue events when offline', async () => {
      analytics.setNetworkStatus(false);
      
      analytics.track('test_event', { key: 'value' });
      
      expect(analytics.getQueuedEvents()).toHaveLength(1);
    });

    it('should flush queued events when network returns', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });
      
      analytics.setNetworkStatus(false);
      analytics.track('event1', {});
      analytics.track('event2', {});
      
      expect(analytics.getQueuedEvents()).toHaveLength(2);
      
      analytics.setNetworkStatus(true);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(analytics.getQueuedEvents()).toHaveLength(0);
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout after 10 seconds', async () => {
      jest.useFakeTimers();
      
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 15000))
      );
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const flushPromise = analytics.safeFlush();
      
      jest.advanceTimersByTime(10000);
      
      await flushPromise;
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('timeout')
      );
      
      consoleSpy.mockRestore();
      jest.useRealTimers();
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed flush up to 3 times', async () => {
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        });
      
      analytics.track('test_event', {});
      
      await analytics.safeFlush();
      
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should give up after 3 failed attempts', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      analytics.track('test_event', {});
      
      await analytics.safeFlush();
      
      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Max retry attempts')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Event Tracking', () => {
    it('should track events with properties', () => {
      const event = 'user_login';
      const properties = { userId: '123', method: 'qr' };
      
      analytics.track(event, properties);
      
      const queued = analytics.getQueuedEvents();
      expect(queued[0]).toMatchObject({
        event,
        properties,
      });
    });

    it('should add timestamp to tracked events', () => {
      analytics.track('test_event', {});
      
      const queued = analytics.getQueuedEvents();
      expect(queued[0].timestamp).toBeDefined();
      expect(typeof queued[0].timestamp).toBe('number');
    });
  });

  describe('App Stability', () => {
    it('should not prevent app from starting on analytics error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Critical error'));
      
      const startTime = Date.now();
      
      await analytics.safeFlush();
      
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(100);
    });

    it('should isolate analytics errors from app logic', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => {
        throw new Error('Synchronous error');
      });
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      expect(() => {
        analytics.track('test', {});
        analytics.safeFlush();
      }).not.toThrow();
      
      consoleSpy.mockRestore();
    });
  });
});
