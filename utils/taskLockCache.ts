import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '@/config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

const LOCK_CACHE_KEY = '@task_lock_cache';
const CACHE_TTL = 30000;

export type TaskLockState = {
  taskId: string;
  isLocked: boolean;
  everApproved: boolean;
  taskAccessRequested: boolean;
  timestamp: number;
  status: string;
};

type LockCache = Record<string, TaskLockState>;

class TaskLockCache {
  private cache: LockCache = {};
  private initPromise: Promise<void> | null = null;

  async init() {
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = (async () => {
      console.log('[TaskLockCache] Initializing...');
      try {
        const stored = await AsyncStorage.getItem(LOCK_CACHE_KEY);
        if (stored) {
          this.cache = JSON.parse(stored);
          console.log('[TaskLockCache] Loaded', Object.keys(this.cache).length, 'cached entries');
        }
      } catch (error) {
        console.error('[TaskLockCache] Init error:', error);
      }
    })();
    
    return this.initPromise;
  }

  async get(taskId: string): Promise<TaskLockState | null> {
    await this.init();
    
    const cached = this.cache[taskId];
    if (!cached) return null;
    
    const age = Date.now() - cached.timestamp;
    if (age > CACHE_TTL) {
      console.log('[TaskLockCache] Stale entry for', taskId, '(age:', Math.round(age / 1000), 's)');
      delete this.cache[taskId];
      return null;
    }
    
    console.log('[TaskLockCache] HIT for', taskId, '- isLocked:', cached.isLocked, '(age:', Math.round(age / 1000), 's)');
    return cached;
  }

  async set(lockState: TaskLockState) {
    await this.init();
    
    this.cache[lockState.taskId] = {
      ...lockState,
      timestamp: Date.now(),
    };
    
    try {
      await AsyncStorage.setItem(LOCK_CACHE_KEY, JSON.stringify(this.cache));
      console.log('[TaskLockCache] Cached lock state for', lockState.taskId, '- isLocked:', lockState.isLocked);
    } catch (error) {
      console.error('[TaskLockCache] Error saving cache:', error);
    }
  }

  async checkLockState(taskId: string, abortSignal?: AbortSignal): Promise<TaskLockState | null> {
    const startTime = performance.now();
    
    try {
      console.log('[TaskLockCache] 🔍 Checking lock state for task:', taskId);
      
      if (abortSignal?.aborted) {
        console.log('[TaskLockCache] ⚠️ Request aborted before fetch');
        return null;
      }
      
      const taskRef = collection(db, 'tasks');
      const q = query(taskRef, where('__name__', '==', taskId));
      const snapshot = await getDocs(q);
      
      if (abortSignal?.aborted) {
        console.log('[TaskLockCache] ⚠️ Request aborted after fetch');
        return null;
      }
      
      if (snapshot.empty) {
        console.log('[TaskLockCache] ❌ Task not found');
        return null;
      }
      
      const taskDoc = snapshot.docs[0];
      const data = taskDoc.data();
      
      const everApproved = data.everApproved || data.approvedBy;
      const willBeLocked = data.status === 'LOCKED' && !everApproved;
      
      const lockState: TaskLockState = {
        taskId,
        isLocked: willBeLocked,
        everApproved: !!everApproved,
        taskAccessRequested: data.taskAccessRequested || false,
        status: data.status || 'UNKNOWN',
        timestamp: Date.now(),
      };
      
      await this.set(lockState);
      
      const elapsed = Math.round(performance.now() - startTime);
      console.log('[TaskLockCache] ✅ Lock check complete in', elapsed, 'ms - isLocked:', lockState.isLocked);
      
      return lockState;
    } catch (error) {
      const elapsed = Math.round(performance.now() - startTime);
      console.error('[TaskLockCache] ❌ Error checking lock state (after', elapsed, 'ms):', error);
      return null;
    }
  }

  async prefetchLockStates(taskIds: string[]) {
    console.log('[TaskLockCache] 🔄 Prefetching lock states for', taskIds.length, 'tasks...');
    
    const promises = taskIds.map(taskId => 
      this.checkLockState(taskId).catch(err => {
        console.warn('[TaskLockCache] Prefetch failed for', taskId, ':', err);
        return null;
      })
    );
    
    await Promise.all(promises);
    console.log('[TaskLockCache] ✅ Prefetch complete');
  }

  async invalidate(taskId: string) {
    await this.init();
    delete this.cache[taskId];
    
    try {
      await AsyncStorage.setItem(LOCK_CACHE_KEY, JSON.stringify(this.cache));
      console.log('[TaskLockCache] Invalidated cache for', taskId);
    } catch (error) {
      console.error('[TaskLockCache] Error invalidating cache:', error);
    }
  }

  async clearAll() {
    this.cache = {};
    try {
      await AsyncStorage.removeItem(LOCK_CACHE_KEY);
      console.log('[TaskLockCache] Cleared all cache');
    } catch (error) {
      console.error('[TaskLockCache] Error clearing cache:', error);
    }
  }
}

export const taskLockCache = new TaskLockCache();
