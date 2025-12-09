import AsyncStorage from '@react-native-async-storage/async-storage';

export type CachedTask = {
  id: string;
  name: string;
  status: string;
  taskAccessRequested: boolean;
  pvArea?: string;
  blockArea?: string;
  specialArea?: string;
  location?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  lastUpdatedAt?: string;
};

export type CachedActivity = {
  id: string;
  name: string;
  status: string;
  scopeValue: number;
  scopeApproved: boolean;
  qcValue: number;
  completedToday: number;
  targetTomorrow: number;
  unit: string;
  scopeUnit?: string;
  supervisorInputValue?: number;
  supervisorInputUnit?: string;
  supervisorInputAt?: string;
  supervisorInputBy?: string;
  supervisorInputLocked?: boolean;
  notes?: string;
  qcStatus?: string;
  qcScheduledAt?: string;
  completedTodayLock?: Record<string, unknown>;
  scopeRequested?: boolean;
  qcRequested?: boolean;
  cablingRequested?: boolean;
  terminationRequested?: boolean;
  scopePolicy?: string;
  canonicalUnit?: string;
  drillingHandoff?: boolean;
  metadata?: Record<string, unknown>;
  cablingHandoff?: Record<string, unknown>;
  terminationHandoff?: Record<string, unknown>;
  updatedAt?: string;
};

interface CachedTasksPayload {
  cachedAt: string;
  tasks: CachedTask[];
}

interface CachedActivitiesPayload {
  cachedAt: string;
  activities: CachedActivity[];
}

const TASK_CACHE_PREFIX = '@cached_tasks_v2';
const ACTIVITY_CACHE_PREFIX = '@cached_activities_v2';

const sanitizeSegment = (segment: string): string =>
  segment.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();

const buildTaskCacheKey = (siteId: string, supervisorId: string, subActivity: string): string => {
  const siteKey = sanitizeSegment(siteId || 'unknown_site');
  const supervisorKey = sanitizeSegment(supervisorId || 'unknown_supervisor');
  const subActivityKey = sanitizeSegment(subActivity || 'unknown_subactivity');
  return `${TASK_CACHE_PREFIX}:${siteKey}:${supervisorKey}:${subActivityKey}`;
};

const buildActivityCacheKey = (taskId: string): string => {
  const taskKey = sanitizeSegment(taskId || 'unknown_task');
  return `${ACTIVITY_CACHE_PREFIX}:${taskKey}`;
};

export async function cacheTasksForSubActivity(params: {
  siteId: string;
  supervisorId: string;
  subActivity: string;
  tasks: CachedTask[];
}): Promise<void> {
  try {
    const { siteId, supervisorId, subActivity, tasks } = params;
    const key = buildTaskCacheKey(siteId, supervisorId, subActivity);
    const payload: CachedTasksPayload = {
      cachedAt: new Date().toISOString(),
      tasks,
    };
    await AsyncStorage.setItem(key, JSON.stringify(payload));
    console.log('[TaskCache] Cached tasks for key:', key, 'count:', tasks.length);
  } catch (error) {
    console.error('[TaskCache] Failed to cache tasks:', error);
  }
}

export async function getCachedTasksForSubActivity(params: {
  siteId: string;
  supervisorId: string;
  subActivity: string;
}): Promise<CachedTask[]> {
  try {
    const { siteId, supervisorId, subActivity } = params;
    const key = buildTaskCacheKey(siteId, supervisorId, subActivity);
    const stored = await AsyncStorage.getItem(key);
    if (!stored) {
      console.log('[TaskCache] No cached tasks for key:', key);
      return [];
    }

    const payload: CachedTasksPayload = JSON.parse(stored);
    console.log('[TaskCache] Loaded cached tasks for key:', key, 'count:', payload.tasks.length, 'cachedAt:', payload.cachedAt);
    return payload.tasks;
  } catch (error) {
    console.error('[TaskCache] Failed to read cached tasks:', error);
    return [];
  }
}

export async function updateCachedTask(params: {
  siteId: string;
  supervisorId: string;
  subActivity: string;
  taskId: string;
  updater: (task: CachedTask) => CachedTask;
}): Promise<void> {
  try {
    const { siteId, supervisorId, subActivity, taskId, updater } = params;
    const tasks = await getCachedTasksForSubActivity({ siteId, supervisorId, subActivity });
    if (tasks.length === 0) {
      return;
    }

    const updatedTasks = tasks.map((task) => (task.id === taskId ? updater(task) : task));

    await cacheTasksForSubActivity({ siteId, supervisorId, subActivity, tasks: updatedTasks });
    console.log('[TaskCache] Task updated in cache:', taskId);
  } catch (error) {
    console.error('[TaskCache] Failed to update cached task:', error);
  }
}

export async function cacheActivitiesForTask(params: {
  taskId: string;
  activities: CachedActivity[];
}): Promise<void> {
  try {
    const { taskId, activities } = params;
    const key = buildActivityCacheKey(taskId);
    const payload: CachedActivitiesPayload = {
      cachedAt: new Date().toISOString(),
      activities,
    };
    await AsyncStorage.setItem(key, JSON.stringify(payload));
    console.log('[TaskCache] Cached activities for task:', taskId, 'count:', activities.length);
  } catch (error) {
    console.error('[TaskCache] Failed to cache activities:', error);
  }
}

export async function getCachedActivitiesForTask(taskId: string): Promise<CachedActivity[]> {
  try {
    const key = buildActivityCacheKey(taskId);
    const stored = await AsyncStorage.getItem(key);
    if (!stored) {
      console.log('[TaskCache] No cached activities for task:', taskId);
      return [];
    }

    const payload: CachedActivitiesPayload = JSON.parse(stored);
    console.log('[TaskCache] Loaded cached activities for task:', taskId, 'count:', payload.activities.length, 'cachedAt:', payload.cachedAt);
    return payload.activities;
  } catch (error) {
    console.error('[TaskCache] Failed to read cached activities:', error);
    return [];
  }
}

export async function clearCachedTaskDataForSubActivity(params: {
  siteId: string;
  supervisorId: string;
  subActivity: string;
}): Promise<void> {
  try {
    const { siteId, supervisorId, subActivity } = params;
    const key = buildTaskCacheKey(siteId, supervisorId, subActivity);
    await AsyncStorage.removeItem(key);
    console.log('[TaskCache] Cleared task cache for key:', key);
  } catch (error) {
    console.error('[TaskCache] Failed to clear task cache:', error);
  }
}

export async function clearCachedActivitiesForTask(taskId: string): Promise<void> {
  try {
    const key = buildActivityCacheKey(taskId);
    await AsyncStorage.removeItem(key);
    console.log('[TaskCache] Cleared activity cache for task:', taskId);
  } catch (error) {
    console.error('[TaskCache] Failed to clear activity cache:', error);
  }
}
