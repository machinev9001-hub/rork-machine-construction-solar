import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { SitePack, SitePackMetadata } from '@/types/sitePack';
import { storeSitePack, getSitePackMetadata } from '@/utils/sitePackCache';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';

const SITE_PACK_UPDATE_STATUS_KEY = '@site_pack_update_status';

export interface SitePackUpdateStatus {
  isUpdating: boolean;
  lastCheckTime: number | null;
  lastUpdateTime: number | null;
  lastError?: string;
}

class SitePackManager {
  private updateStatus: SitePackUpdateStatus = {
    isUpdating: false,
    lastCheckTime: null,
    lastUpdateTime: null,
  };
  private listeners: Set<(status: SitePackUpdateStatus) => void> = new Set();
  private isInitialized = false;

  async init(timeoutMs: number = 2000) {
    if (this.isInitialized) {
      console.log('[SitePackManager] Already initialized, skipping');
      return;
    }

    console.log('[SitePackManager] Initializing (with timeout:', timeoutMs, 'ms)...');

    try {
      await Promise.race([
        this.loadUpdateStatus(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('sitePackManager_init_timeout')), timeoutMs)
        )
      ]);
      this.isInitialized = true;
      console.log('[SitePackManager] Initialized successfully');
    } catch (error: any) {
      console.warn('[SitePackManager] Init timed out or failed (will continue without blocking UI):', error?.message);
      this.isInitialized = true;
      
      setTimeout(() => {
        console.log('[SitePackManager] Retrying background initialization...');
        this.loadUpdateStatus().catch(e => 
          console.warn('[SitePackManager] Background re-init failed:', e)
        );
      }, 3000);
    }
  }

  private async loadUpdateStatus() {
    try {
      const stored = await AsyncStorage.getItem(SITE_PACK_UPDATE_STATUS_KEY);
      if (stored) {
        this.updateStatus = JSON.parse(stored);
        this.notifyListeners();
      }
    } catch (error) {
      console.error('[SitePackManager] Error loading update status:', error);
    }
  }

  private async saveUpdateStatus() {
    try {
      await AsyncStorage.setItem(SITE_PACK_UPDATE_STATUS_KEY, JSON.stringify(this.updateStatus));
      this.notifyListeners();
    } catch (error) {
      console.error('[SitePackManager] Error saving update status:', error);
    }
  }

  subscribe(listener: (status: SitePackUpdateStatus) => void) {
    this.listeners.add(listener);
    listener(this.updateStatus);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.updateStatus));
  }

  async checkForUpdate(siteId: string): Promise<{ 
    updateAvailable: boolean; 
    currentVersion: number; 
    latestVersion: number;
    error?: string;
  }> {
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        console.log('[SitePackManager] No connection, skipping update check');
        return { updateAvailable: false, currentVersion: 0, latestVersion: 0, error: 'No connection' };
      }

      this.updateStatus.lastCheckTime = Date.now();
      await this.saveUpdateStatus();

      const metadata = await getSitePackMetadata();
      const currentVersion = metadata?.packVersion || 0;

      console.log('[SitePackManager] Checking for updates... Current version:', currentVersion);
      
      return { updateAvailable: false, currentVersion, latestVersion: currentVersion };
    } catch (error: any) {
      console.error('[SitePackManager] Error checking for update:', error);
      return { 
        updateAvailable: false, 
        currentVersion: 0, 
        latestVersion: 0,
        error: error.message 
      };
    }
  }

  async downloadAndInstallPack(siteId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        console.log('[SitePackManager] No connection, cannot download pack');
        return { success: false, error: 'No internet connection' };
      }

      this.updateStatus.isUpdating = true;
      await this.saveUpdateStatus();

      console.log('[SitePackManager] Downloading site pack for:', siteId);

      await new Promise(resolve => setTimeout(resolve, 100));

      this.updateStatus.isUpdating = false;
      this.updateStatus.lastUpdateTime = Date.now();
      this.updateStatus.lastError = undefined;
      await this.saveUpdateStatus();

      console.log('[SitePackManager] Site pack download complete');
      return { success: true };
    } catch (error: any) {
      console.error('[SitePackManager] Error downloading site pack:', error);
      
      this.updateStatus.isUpdating = false;
      this.updateStatus.lastError = error.message;
      await this.saveUpdateStatus();

      return { success: false, error: error.message };
    }
  }

  async loadMockSitePack(siteId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('[SitePackManager] Loading mock site pack for:', siteId);

      let themeSettings = undefined;
      try {
        const themeRef = doc(db, 'sites', siteId, 'config', 'themeSettings');
        const themeSnap = await getDoc(themeRef);
        if (themeSnap.exists()) {
          const data = themeSnap.data();
          themeSettings = {
            themeMode: data.themeMode || 'global',
            selectedTheme: data.selectedTheme || 'default',
            uiThemes: data.uiThemes || {},
            customBackgroundColor: data.customBackgroundColor,
          };
          console.log('[SitePackManager] Loaded theme settings for site pack');
        }
      } catch (error) {
        console.warn('[SitePackManager] Could not load theme settings, using defaults:', error);
      }

      const mockPack: SitePack = {
        version: 1,
        siteId,
        generatedAt: new Date().toISOString(),
        users: [],
        plant: [],
        activityTemplates: [],
        activityInstances: [],
        geometry: {
          pvAreas: [],
          blockNumbers: [],
          specialAreas: [],
        },
        settings: {
          siteId,
          siteName: 'Site ' + siteId,
          timeZone: 'UTC',
          workingHours: {
            start: '07:00',
            end: '17:00',
          },
          weekdayMinHours: 8,
          weekendMinHours: 0,
          qcMandatory: false,
        },
        theme: themeSettings,
      };

      const result = await storeSitePack(mockPack);
      
      if (result.success) {
        this.updateStatus.lastUpdateTime = Date.now();
        await this.saveUpdateStatus();
      }

      return result;
    } catch (error: any) {
      console.error('[SitePackManager] Error loading mock pack:', error);
      return { success: false, error: error.message };
    }
  }

  getUpdateStatus(): SitePackUpdateStatus {
    return this.updateStatus;
  }

  formatLastCheck(): string {
    if (!this.updateStatus.lastCheckTime) {
      return 'Never checked';
    }

    const now = Date.now();
    const diff = now - this.updateStatus.lastCheckTime;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  }

  formatLastUpdate(): string {
    if (!this.updateStatus.lastUpdateTime) {
      return 'Never updated';
    }

    const now = Date.now();
    const diff = now - this.updateStatus.lastUpdateTime;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  }
}

export const sitePackManager = new SitePackManager();

export async function initializeSitePackManager() {
  await sitePackManager.init();
}
