import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '@/config/firebase';
import { dataFreshnessManager } from '@/utils/dataFreshnessSync';

// CRITICAL: AsyncStorage is APPEND-ONLY for operational data
// - Offline queue is saved to AsyncStorage and synced to Firebase when online
// - Once synced to Firebase, queue items are removed from AsyncStorage
// - BUT: All other cached data (users, tasks, activities, etc.) remains in AsyncStorage FOREVER
// - This ensures field workers always have access to historical data offline
// - Only temporary session data (like @user token) is cleared on logout
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  addDoc,
  DocumentData 
} from 'firebase/firestore';
import NetInfo from '@react-native-community/netinfo';
import { OFFLINE_CONFIG } from '@/constants/colors';

const QUEUE_KEY = '@offline_queue';
const SYNC_STATUS_KEY = '@sync_status';

export type QueuePriority = 'P0' | 'P1' | 'P2' | 'P3';

export type EntityType = 
  | 'taskRequest' 
  | 'activityRequest' 
  | 'qcRequest' 
  | 'surveyorRequest'
  | 'plantRequest'
  | 'staffRequest'
  | 'logisticsRequest'
  | 'handoverRequest'
  | 'materialRequest'
  | 'allocation'
  | 'completedToday'
  | 'timesheet'
  | 'image'
  | 'message'
  | 'plantAsset'
  | 'other';

export type QueueOperation = 
  | { type: 'set'; collection: string; docId: string; data: DocumentData; merge?: boolean }
  | { type: 'update'; collection: string; docId: string; data: DocumentData }
  | { type: 'delete'; collection: string; docId: string }
  | { type: 'add'; collection: string; data: DocumentData };

export interface QueueItem {
  id: string;
  operation: QueueOperation;
  timestamp: number;
  retryCount: number;
  lastError?: string;
  priority: QueuePriority;
  entityType: EntityType;
  estimatedSize: number;
}

export interface SyncStatus {
  lastSyncTime: number | null;
  isSyncing: boolean;
  pendingCount: number;
  failedCount: number;
  p0Count: number;
  p1Count: number;
  p2Count: number;
  p3Count: number;
}

class OfflineQueue {
  private queue: QueueItem[] = [];
  private syncStatus: SyncStatus = {
    lastSyncTime: null,
    isSyncing: false,
    pendingCount: 0,
    failedCount: 0,
    p0Count: 0,
    p1Count: 0,
    p2Count: 0,
    p3Count: 0,
  };
  private listeners: Set<(status: SyncStatus) => void> = new Set();
  private isInitialized = false;
  private syncInProgress = false;
  private netInfoUnsubscribe: (() => void) | null = null;

  async init(timeoutMs: number = 4000) {
    if (this.isInitialized) {
      console.log('[OfflineQueue] Already initialized, skipping');
      return;
    }

    if (!OFFLINE_CONFIG.ENABLE_OFFLINE_QUEUE) {
      console.log('[OfflineQueue] Offline queue disabled via config');
      this.isInitialized = true;
      return;
    }

    console.log('[OfflineQueue] Initializing (with timeout:', timeoutMs, 'ms)...');

    try {
      await Promise.race([
        this._initInternal(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('offlineQueue_init_timeout')), timeoutMs)
        )
      ]);
      this.isInitialized = true;
      console.log('[OfflineQueue] Initialized successfully');
    } catch (err: any) {
      console.warn('[OfflineQueue] init timed out or failed (will continue without blocking UI):', err?.message);
      this.isInitialized = true;
      setTimeout(() => {
        if (!this.netInfoUnsubscribe) {
          console.log('[OfflineQueue] Retrying background initialization...');
          this._initInternal().catch(e => console.warn('[OfflineQueue] background re-init failed:', e));
        }
      }, 3000);
    }
  }

  private async _initInternal() {
    if (this.netInfoUnsubscribe) {
      console.log('[OfflineQueue] Cleaning up old NetInfo listener before init');
      this.netInfoUnsubscribe();
      this.netInfoUnsubscribe = null;
    }
    
    await Promise.all([
      this.loadQueue(),
      this.loadSyncStatus()
    ]);
    
    this.netInfoUnsubscribe = NetInfo.addEventListener((state: any) => {
      console.log('[OfflineQueue] Network state changed:', state.isConnected);
      if (state.isConnected && !this.syncInProgress) {
        this.syncQueue().catch(e => console.warn('[OfflineQueue] syncQueue error:', e));
      }
    });
    
    console.log('[OfflineQueue] _initInternal complete');
  }

  private async loadQueue() {
    console.log('[OfflineQueue] loadQueue START');
    try {
      const stored = await AsyncStorage.getItem(QUEUE_KEY);
      console.log('[OfflineQueue] loadQueue - AsyncStorage.getItem returned');
      if (stored) {
        this.queue = JSON.parse(stored);
        console.log('[OfflineQueue] loadQueue - parsed items count:', this.queue.length);
      } else {
        console.log('[OfflineQueue] loadQueue - no stored items');
      }
      console.log('[OfflineQueue] loadQueue COMPLETE');
    } catch (error) {
      console.error('[OfflineQueue] loadQueue ERROR:', error);
    }
  }

  private async saveQueue() {
    try {
      // Save pending operations to AsyncStorage
      // Once synced to Firebase, items are removed from queue
      // All other AsyncStorage data (cached tasks, users, etc.) remains permanently
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
      
      const pending = this.queue.filter(item => item.retryCount < 3);
      const failed = this.queue.filter(item => item.retryCount >= 3);
      
      await this.updateSyncStatus({
        pendingCount: pending.length,
        failedCount: failed.length,
        p0Count: pending.filter(item => item.priority === 'P0').length,
        p1Count: pending.filter(item => item.priority === 'P1').length,
        p2Count: pending.filter(item => item.priority === 'P2').length,
        p3Count: pending.filter(item => item.priority === 'P3').length,
      });
    } catch (error) {
      console.error('[OfflineQueue] Error saving queue:', error);
    }
  }

  private async loadSyncStatus() {
    console.log('[OfflineQueue] loadSyncStatus START');
    try {
      const stored = await AsyncStorage.getItem(SYNC_STATUS_KEY);
      console.log('[OfflineQueue] loadSyncStatus - AsyncStorage.getItem returned');
      if (stored) {
        this.syncStatus = JSON.parse(stored);
        console.log('[OfflineQueue] loadSyncStatus - parsed status:', {
          pendingCount: this.syncStatus.pendingCount,
          isSyncing: this.syncStatus.isSyncing,
          failedCount: this.syncStatus.failedCount,
        });
        this.notifyListeners();
        console.log('[OfflineQueue] loadSyncStatus - notified listeners');
      } else {
        console.log('[OfflineQueue] loadSyncStatus - no stored status');
      }
      console.log('[OfflineQueue] loadSyncStatus COMPLETE');
    } catch (error) {
      console.error('[OfflineQueue] loadSyncStatus ERROR:', error);
    }
  }

  private async updateSyncStatus(updates: Partial<SyncStatus>) {
    this.syncStatus = { ...this.syncStatus, ...updates };
    try {
      await AsyncStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(this.syncStatus));
      this.notifyListeners();
    } catch (error) {
      console.error('[OfflineQueue] Error saving sync status:', error);
    }
  }

  subscribe(listener: (status: SyncStatus) => void) {
    this.listeners.add(listener);
    listener(this.syncStatus);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.syncStatus));
  }

  async enqueue(
    operation: QueueOperation, 
    options?: { 
      priority?: QueuePriority; 
      entityType?: EntityType; 
      estimatedSize?: number;
    }
  ): Promise<string> {
    if (!OFFLINE_CONFIG.ENABLE_OFFLINE_QUEUE) {
      console.log('[OfflineQueue] Queue is disabled, skipping operation:', operation.type);
      return 'skipped';
    }
    
    if (!this.isInitialized) {
      await this.init();
    }

    const priority = options?.priority || this.inferPriority(operation, options?.entityType);
    const entityType = options?.entityType || this.inferEntityType(operation);
    const estimatedSize = options?.estimatedSize || this.estimateSize(operation);

    const item: QueueItem = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      operation,
      timestamp: Date.now(),
      retryCount: 0,
      priority,
      entityType,
      estimatedSize,
    };

    this.queue.push(item);
    await this.saveQueue();

    console.log(
      '[OfflineQueue] Enqueued:', 
      operation.type, 
      operation.collection,
      '| Priority:', priority,
      '| Type:', entityType,
      '| Size:', estimatedSize
    );

    if (!this.syncInProgress) {
      const netInfo = await NetInfo.fetch();
      if (netInfo.isConnected) {
        this.syncQueue();
      }
    }

    return item.id;
  }

  async syncQueue(mode: 'auto' | 'critical' | 'full' = 'auto') {
    if (!this.isInitialized) {
      await this.init();
    }

    if (this.syncInProgress) {
      console.log('[OfflineQueue] Sync already in progress, skipping');
      return;
    }
    
    if (this.queue.length === 0) {
      return;
    }

    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log('[OfflineQueue] No internet connection, skipping sync');
      return;
    }

    this.syncInProgress = true;
    await this.updateSyncStatus({ isSyncing: true });

    console.log('[OfflineQueue] Starting sync (mode:', mode, ') of', this.queue.length, 'items');

    const MAX_BURST_BYTES = mode === 'full' ? 2 * 1024 * 1024 : 250 * 1024;
    const MAX_P0_ONLY_BYTES = 100 * 1024;

    const itemsToProcess = [...this.queue]
      .filter(item => item.retryCount < 3)
      .sort((a, b) => {
        const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return a.timestamp - b.timestamp;
      });

    let processedCount = 0;
    let errorCount = 0;
    let totalBytes = 0;
    let p0Bytes = 0;

    for (const item of itemsToProcess) {
      if (mode === 'critical' && item.priority !== 'P0') {
        continue;
      }

      if (item.priority === 'P0' && p0Bytes < MAX_P0_ONLY_BYTES) {
        p0Bytes += item.estimatedSize;
      } else if (totalBytes >= MAX_BURST_BYTES) {
        console.log('[OfflineQueue] Burst budget reached. Remaining:', itemsToProcess.length - processedCount);
        break;
      }

      try {
        await this.executeOperation(item.operation);
        
        // Remove from queue after successful sync
        // This is the ONLY time we remove data from AsyncStorage in the offline system
        this.queue = this.queue.filter(i => i.id !== item.id);
        totalBytes += item.estimatedSize;
        processedCount++;
        
        console.log(
          '[OfflineQueue] Synced:', 
          item.priority, 
          item.entityType, 
          '(' + Math.round(item.estimatedSize / 1024) + 'KB)'
        );

        // Notify on P0 sync completion
        if (item.priority === 'P0') {
          const entityId = item.operation.type === 'add' 
            ? 'new' 
            : (item.operation as any).docId || 'unknown';
          
          await dataFreshnessManager.notifyP0SyncComplete({
            entityType: item.entityType,
            entityId,
            message: `${item.entityType} synced to server`,
          });
        }
      } catch (error: any) {
        console.error('[OfflineQueue] Error syncing item:', error);
        
        const itemIndex = this.queue.findIndex(i => i.id === item.id);
        if (itemIndex !== -1) {
          this.queue[itemIndex].retryCount++;
          this.queue[itemIndex].lastError = error.message;
          errorCount++;
        }
      }
    }

    await this.saveQueue();
    await this.updateSyncStatus({
      isSyncing: false,
      lastSyncTime: Date.now(),
    });

    this.syncInProgress = false;

    console.log(
      '[OfflineQueue] Sync complete.',
      'Processed:', processedCount,
      'Errors:', errorCount,
      'Bytes:', Math.round(totalBytes / 1024) + 'KB'
    );

    if (this.queue.length > 0 && errorCount === 0 && mode === 'auto') {
      setTimeout(() => this.syncQueue('auto'), 5000);
    }
  }

  private async executeOperation(operation: QueueOperation) {
    switch (operation.type) {
      case 'set': {
        const docRef = doc(db, operation.collection, operation.docId);
        await setDoc(docRef, operation.data, { merge: operation.merge ?? false });
        break;
      }
      case 'update': {
        const docRef = doc(db, operation.collection, operation.docId);
        await updateDoc(docRef, operation.data);
        break;
      }
      case 'delete': {
        const docRef = doc(db, operation.collection, operation.docId);
        await deleteDoc(docRef);
        break;
      }
      case 'add': {
        const collectionRef = collection(db, operation.collection);
        await addDoc(collectionRef, operation.data);
        break;
      }
    }
  }

  getSyncStatus(): SyncStatus {
    return this.syncStatus;
  }

  getQueuedItems(): QueueItem[] {
    return [...this.queue];
  }

  async clearFailedItems() {
    this.queue = this.queue.filter(item => item.retryCount < 3);
    await this.saveQueue();
    console.log('[OfflineQueue] Cleared failed items');
  }

  async retryFailedItems() {
    this.queue.forEach(item => {
      if (item.retryCount >= 3) {
        item.retryCount = 0;
        item.lastError = undefined;
      }
    });
    await this.saveQueue();
    await this.syncQueue('auto');
    console.log('[OfflineQueue] Retrying failed items');
  }

  private inferPriority(operation: QueueOperation, entityType?: EntityType): QueuePriority {
    const type = entityType || this.inferEntityType(operation);
    
    const p0Types: EntityType[] = [
      'taskRequest',
      'activityRequest',
      'qcRequest',
      'surveyorRequest',
      'plantRequest',
      'staffRequest',
      'logisticsRequest',
      'handoverRequest',
      'materialRequest',
      'allocation',
      'timesheet', // Moved to P0 for critical sync of operator hours
      'plantAsset', // Critical for plant allocation tracking
    ];

    if (p0Types.includes(type)) return 'P0';
    if (type === 'completedToday') return 'P2';
    if (type === 'image') return 'P3';
    if (type === 'message') return 'P1';
    
    return 'P1';
  }

  private inferEntityType(operation: QueueOperation): EntityType {
    if (operation.type === 'add' || operation.type === 'set' || operation.type === 'update') {
      const data = operation.type === 'update' ? operation.data : operation.data;
      
      if (operation.collection.includes('request') || operation.collection.includes('Request')) {
        if (data?.requestType?.includes('TASK') || data?.requestType?.includes('ACTIVITY')) {
          return 'taskRequest';
        }
        if (data?.requestType?.includes('QC')) return 'qcRequest';
        if (data?.requestType?.includes('SURVEY')) return 'surveyorRequest';
        if (data?.requestType?.includes('PLANT')) return 'plantRequest';
        if (data?.requestType?.includes('STAFF')) return 'staffRequest';
        if (data?.requestType?.includes('LOGISTICS')) return 'logisticsRequest';
        if (data?.requestType?.includes('HANDOVER')) return 'handoverRequest';
        if (data?.requestType?.includes('MATERIAL')) return 'materialRequest';
        return 'activityRequest';
      }
      
      if (operation.collection.includes('allocation') || operation.collection.includes('assignment')) {
        return 'allocation';
      }
      
      if (data?.completedToday !== undefined || operation.collection.includes('activities')) {
        return 'completedToday';
      }
      
      if (operation.collection.includes('timesheet') || 
          operation.collection.includes('operatorManHours') || 
          operation.collection.includes('PlantAssetHours') ||
          data?.hours !== undefined || 
          data?.startTime !== undefined || 
          data?.openHours !== undefined) {
        return 'timesheet';
      }
      
      if (operation.collection.includes('image') || data?.imageUrl || data?.imageData) {
        return 'image';
      }
      
      if (operation.collection.includes('message')) {
        return 'message';
      }
    }
    
    return 'other';
  }

  private estimateSize(operation: QueueOperation): number {
    try {
      const dataStr = JSON.stringify(
        operation.type === 'update' || operation.type === 'set' || operation.type === 'add' 
          ? operation.data 
          : {}
      );
      
      let size = dataStr.length;
      
      if (dataStr.includes('imageData') || dataStr.includes('base64')) {
        size = size * 1.5;
      }
      
      return Math.max(size, 500);
    } catch {
      return 1000;
    }
  }
}

export const offlineQueue = new OfflineQueue();

export async function queueFirestoreOperation(
  operation: QueueOperation,
  options?: {
    priority?: QueuePriority;
    entityType?: EntityType;
    estimatedSize?: number;
  }
): Promise<string> {
  return await offlineQueue.enqueue(operation, options);
}

export function useOfflineQueue() {
  return offlineQueue;
}
