import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

const POSTHOG_FLUSH_ENABLED = process.env.EXPO_PUBLIC_POSTHOG_FLUSH_ENABLED === 'true';
const ANALYTICS_ENDPOINT = process.env.EXPO_PUBLIC_ANALYTICS_ENDPOINT ?? 'https://analytics.rork.app/collect';
const FLUSH_TIMEOUT_MS = 10000;

interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
  timestamp: number;
}

class SafeAnalytics {
  private eventQueue: AnalyticsEvent[] = [];
  private isOnline: boolean = true;
  private flushInProgress: boolean = false;
  private maxRetries: number = 3;
  private retryDelay: number = 5000;

  constructor() {
    this.initNetworkListener();
  }

  private initNetworkListener() {
    try {
      NetInfo.addEventListener((state) => {
        const wasOffline = !this.isOnline;
        this.isOnline = state.isConnected ?? false;

        if (wasOffline && this.isOnline && this.eventQueue.length > 0) {
          console.log('[SafeAnalytics] Network restored, flushing queued events');
          void this.safeFlush();
        }
      });
    } catch (error) {
      console.warn('[SafeAnalytics] Failed to attach NetInfo listener, defaulting to always-online mode', error);
    }
  }

  setNetworkStatus(isOnline: boolean) {
    console.log(`[SafeAnalytics] Network status set to: ${isOnline ? 'online' : 'offline'}`);
    const wasOffline = !this.isOnline;
    this.isOnline = isOnline;

    if (wasOffline && this.isOnline && this.eventQueue.length > 0) {
      void this.safeFlush();
    }
  }

  getQueuedEvents(): AnalyticsEvent[] {
    return [...this.eventQueue];
  }

  track(eventName: string, properties?: Record<string, any>) {
    try {
      const event: AnalyticsEvent = {
        name: eventName,
        properties,
        timestamp: Date.now(),
      };

      this.eventQueue.push(event);

      if (this.isOnline && !this.flushInProgress) {
        void this.safeFlush();
      }
    } catch (error) {
      console.error('[SafeAnalytics] Error tracking event:', error);
    }
  }

  async safeFlush(retryCount: number = 0): Promise<void> {
    if (this.flushInProgress) {
      console.log('[SafeAnalytics] Flush already in progress, skipping');
      return;
    }

    if (!this.isOnline) {
      console.log('[SafeAnalytics] Offline - deferring flush');
      return;
    }

    if (this.eventQueue.length === 0) {
      console.log('[SafeAnalytics] No queued events to flush');
      return;
    }

    this.flushInProgress = true;
    const eventsToSend = [...this.eventQueue];

    try {
      await this.transmitEvents(eventsToSend);
      this.eventQueue = this.eventQueue.slice(eventsToSend.length);
      await this.flushProviders();
      console.log('[SafeAnalytics] Flush completed successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('AbortError')) {
        console.warn('[SafeAnalytics] Failed to flush analytics: timeout');
      } else {
        console.warn(`[SafeAnalytics] Failed to flush analytics: ${errorMessage}`);
      }

      if (retryCount < this.maxRetries - 1) {
        console.log(
          `[SafeAnalytics] Retrying flush (${retryCount + 1}/${this.maxRetries}) in ${this.retryDelay}ms`
        );
        this.flushInProgress = false;
        await this.wait(this.retryDelay);
        await this.safeFlush(retryCount + 1);
        return;
      }

      console.error('[SafeAnalytics] Max retry attempts reached');
    } finally {
      this.flushInProgress = false;
    }
  }

  private async transmitEvents(events: AnalyticsEvent[]): Promise<void> {
    if (typeof fetch !== 'function') {
      console.warn('[SafeAnalytics] Fetch API unavailable, skipping flush');
      return;
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
    const timeoutId = controller
      ? setTimeout(() => {
          controller.abort();
        }, FLUSH_TIMEOUT_MS)
      : undefined;

    try {
      const response = await fetch(ANALYTICS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Rork-Platform': Platform.OS,
        },
        body: JSON.stringify({ events }),
        signal: controller?.signal,
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      console.log(`[SafeAnalytics] Sent ${events.length} events`);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  private wait(duration: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, duration);
    });
  }

  private async flushProviders(): Promise<void> {
    const flushPromises: Promise<void>[] = [];

    if (typeof (global as Record<string, any>).posthog !== 'undefined') {
      if (POSTHOG_FLUSH_ENABLED) {
        console.log('[SafeAnalytics] PostHog flush enabled via env flag, attempting flush');
        flushPromises.push(
          this.safeProviderFlush('PostHog', async () => {
            await (global as Record<string, any>).posthog.flush();
          })
        );
      } else {
        console.log('[SafeAnalytics] PostHog flush disabled (EXPO_PUBLIC_POSTHOG_FLUSH_ENABLED !== "true")');
      }
    }

    await Promise.allSettled(flushPromises);
  }

  private async safeProviderFlush(
    providerName: string,
    flushFn: () => Promise<void>
  ): Promise<void> {
    try {
      console.log(`[SafeAnalytics] Flushing ${providerName}...`);
      await Promise.race([
        flushFn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), FLUSH_TIMEOUT_MS)
        ),
      ]);
      console.log(`[SafeAnalytics] ${providerName} flushed successfully`);
    } catch (error) {
      console.error(`[SafeAnalytics] ${providerName} flush failed (non-fatal):`, error);
    }
  }

  clearQueue() {
    console.log(`[SafeAnalytics] Clearing ${this.eventQueue.length} queued events`);
    this.eventQueue = [];
  }

  getQueueSize(): number {
    return this.eventQueue.length;
  }
}

export const analytics = new SafeAnalytics();

export { SafeAnalytics };

export const trackEvent = (name: string, properties?: Record<string, any>) =>
  analytics.track(name, properties);

export const safeFlush = () => analytics.safeFlush();

export const getAnalyticsQueueSize = () => analytics.getQueueSize();
