import { useState, useCallback, useRef, useEffect } from 'react';
import { collection, doc, addDoc, getDocs, query, where, serverTimestamp, updateDoc } from 'firebase/firestore';
import NetInfo from '@react-native-community/netinfo';
import { db } from '../../config/firebase';
import { subMenuActivities } from '../../constants/activities';
import { checkAndUnlockNewDay } from '../completedTodayLock';
import type { ActivityStatus, CanonicalUnit, CompletedTodayLock } from '../../types';
import { Unit } from '../unitConversion';
import { cacheActivitiesForTask, getCachedActivitiesForTask, CachedActivity } from '../taskCache';
import { isGridTypeActivity, autoApproveGridScope } from '../activityModuleHelpers';

export type ActivityDetail = {
  id: string;
  name: string;
  status: ActivityStatus;
  scopeValue: number;
  scopeApproved: boolean;
  qcValue: number;
  completedToday: number;
  targetTomorrow: number;
  unit: string;
  scopeUnit?: string;
  canonicalUnit?: CanonicalUnit;
  supervisorInputValue?: number;
  supervisorInputUnit?: string;
  supervisorInputAt?: any;
  supervisorInputBy?: string;
  supervisorInputLocked?: boolean;
  completedTodayLock?: CompletedTodayLock;
  updatedAt: string;
  notes: string;
  scopeRequested: boolean;
  qcRequested: boolean;
  cablingRequested: boolean;
  terminationRequested: boolean;
  scopePolicy: 'NORMAL' | 'NONE';
  qcStatus?: 'not_requested' | 'requested' | 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'rejected';
  qcScheduledAt?: any;
  cablingHandoff?: {
    targetModule: 'mv-cable' | 'dc-cable' | 'lv-cable';
  };
  terminationHandoff?: {
    targetModule: 'dc-terminations' | 'lv-terminations';
  };

  drillingHandoff?: boolean;
};

type DayHistory = {
  date: string;
  completedValue: number;
  unit: string;
  percentage: string;
  scopeValue: number;
  scopeApproved: boolean;
  qcStatus?: string;
  materialToggle?: boolean;
  plantToggle?: boolean;
  workersToggle?: boolean;
};

export function useActivityManagement(
  taskId: string,
  subActivity: string | undefined,
  userId: string | undefined
) {
  const [activities, setActivities] = useState<ActivityDetail[]>([]);
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);
  const [tempCompletedValues, setTempCompletedValues] = useState<Record<string, string>>({});
  const [tempCompletedUnits, setTempCompletedUnits] = useState<Record<string, Unit>>({});
  const [tempTargetTomorrowValues, setTempTargetTomorrowValues] = useState<Record<string, string>>({});
  const [activityHistory, setActivityHistory] = useState<Record<string, DayHistory[]>>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);
  
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const formatTimestamp = useCallback((timestamp: any): string => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString();
  }, []);

  const initializeActivities = useCallback(async (taskDocId: string) => {
    const activitiesForSubmenu = subMenuActivities[subActivity || ''];
    if (!activitiesForSubmenu) return;

    const netInfo = await NetInfo.fetch();
    const isOffline = !netInfo.isConnected;
    if (isOffline) {
      console.log('⚠️ Skipping activity initialization while offline');
      return;
    }

    const activitiesRef = collection(db, 'activities');
    const initialActivities: ActivityDetail[] = [];

    for (const act of activitiesForSubmenu) {
      console.log('🔧 Initializing activity:', act.id);
      
      if (act.drillingHandoff) {
        console.log('✅ Handover activity - adding to state only (no Firestore document)');
        initialActivities.push({
          id: act.id,
          name: act.name,
          status: 'LOCKED' as ActivityStatus,
          scopeValue: 0,
          scopeApproved: false,
          qcValue: 0,
          completedToday: 0,
          targetTomorrow: 0,
          unit: act.unit || 'Units',
          updatedAt: '',
          notes: '',
          scopeRequested: false,
          qcRequested: false,
          cablingRequested: false,
          terminationRequested: false,
          scopePolicy: 'NONE',
          cablingHandoff: act.cablingHandoff,
          terminationHandoff: act.terminationHandoff,
          drillingHandoff: act.drillingHandoff,
        });
        continue;
      }
      
      const activityData: Record<string, unknown> = {
        taskId: taskDocId,
        activityId: act.id,
        name: act.name,
        mainMenu: '',
        subMenuKey: subActivity || '',
        status: 'LOCKED',
        scopeValue: 0,
        scopeApproved: false,
        qcValue: 0,
        completedToday: 0,
        targetTomorrow: 0,
        unit: act.unit || 'Units',
        notes: '',
        scopeRequested: false,
        qcRequested: false,
        cablingRequested: false,
        terminationRequested: false,
        scopePolicy: act.scopePolicy || 'NORMAL',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: userId || '',
      };

      await addDoc(activitiesRef, activityData);
      console.log('Created activity:', act.id);

      initialActivities.push({
        id: act.id,
        name: act.name,
        status: 'LOCKED' as ActivityStatus,
        scopeValue: 0,
        scopeApproved: false,
        qcValue: 0,
        completedToday: 0,
        targetTomorrow: 0,
        unit: act.unit || 'Units',
        updatedAt: '',
        notes: '',
        scopeRequested: false,
        qcRequested: false,
        cablingRequested: false,
        terminationRequested: false,
        scopePolicy: act.scopePolicy || 'NORMAL',
        cablingHandoff: act.cablingHandoff,
        terminationHandoff: act.terminationHandoff,
        drillingHandoff: act.drillingHandoff,
      });
    }

    console.log('🔧 Initialized', initialActivities.length, 'activities for task');
    setActivities(initialActivities);
  }, [subActivity, userId]);

  const loadActivities = useCallback(async (taskDocId: string) => {
    const activitiesForSubmenu = subMenuActivities[subActivity || ''];

    const toCachedActivity = (activity: ActivityDetail): CachedActivity => ({
      id: activity.id,
      name: activity.name,
      status: activity.status,
      scopeValue: activity.scopeValue,
      scopeApproved: activity.scopeApproved,
      qcValue: activity.qcValue,
      completedToday: activity.completedToday,
      targetTomorrow: activity.targetTomorrow,
      unit: activity.unit,
      scopeUnit: activity.scopeUnit,
      supervisorInputValue: activity.supervisorInputValue,
      supervisorInputUnit: activity.supervisorInputUnit,
      supervisorInputAt: activity.supervisorInputAt,
      supervisorInputBy: activity.supervisorInputBy,
      supervisorInputLocked: activity.supervisorInputLocked,
      notes: activity.notes,
      qcStatus: activity.qcStatus,
      qcScheduledAt: activity.qcScheduledAt,
      completedTodayLock: activity.completedTodayLock ? { ...activity.completedTodayLock } : undefined,
      scopeRequested: activity.scopeRequested,
      qcRequested: activity.qcRequested,
      cablingRequested: activity.cablingRequested,
      terminationRequested: activity.terminationRequested,
      scopePolicy: activity.scopePolicy,
      canonicalUnit: activity.canonicalUnit as any,
      drillingHandoff: activity.drillingHandoff,
      metadata: {
        taskId: taskDocId,
        subActivity,
      },
      cablingHandoff: activity.cablingHandoff,
      terminationHandoff: activity.terminationHandoff,
      updatedAt: activity.updatedAt,
    });

    const mapCachedActivity = (cached: CachedActivity): ActivityDetail => {
      const config = activitiesForSubmenu?.find((item) => item.id === cached.id);
      return {
        id: cached.id,
        name: cached.name || config?.name || cached.id,
        status: (cached.status as ActivityStatus) || 'LOCKED',
        scopeValue: cached.scopeValue ?? 0,
        scopeApproved: Boolean(cached.scopeApproved),
        qcValue: cached.qcValue ?? 0,
        completedToday: cached.completedToday ?? 0,
        targetTomorrow: cached.targetTomorrow ?? 0,
        unit: cached.unit || config?.unit || 'Units',
        scopeUnit: cached.scopeUnit || config?.unit,
        supervisorInputValue: cached.supervisorInputValue,
        supervisorInputUnit: cached.supervisorInputUnit,
        supervisorInputAt: cached.supervisorInputAt,
        supervisorInputBy: cached.supervisorInputBy,
        supervisorInputLocked: cached.supervisorInputLocked,
        completedTodayLock: cached.completedTodayLock as CompletedTodayLock | undefined,
        updatedAt: cached.updatedAt || '',
        notes: cached.notes || '',
        scopeRequested: Boolean(cached.scopeRequested),
        qcRequested: Boolean(cached.qcRequested),
        cablingRequested: Boolean(cached.cablingRequested),
        terminationRequested: Boolean(cached.terminationRequested),
        scopePolicy: (cached.scopePolicy as 'NORMAL' | 'NONE') || (config?.scopePolicy || 'NORMAL'),
        qcStatus: (cached.qcStatus as ActivityDetail['qcStatus']) || 'not_requested',
        qcScheduledAt: cached.qcScheduledAt,
        cablingHandoff: cached.cablingHandoff as any,
        terminationHandoff: cached.terminationHandoff as any,
        drillingHandoff: cached.drillingHandoff ?? config?.drillingHandoff ?? false,
        canonicalUnit: cached.canonicalUnit as any,
      };
    };

    const applyActivities = (items: ActivityDetail[]) => {
      console.log('Loaded activities:', items.length);
      setActivities(items);
    };

    try {
      console.log('🔄 [loadActivities] Clearing tempCompletedValues state for new task');
      setTempCompletedValues({});
      setTempCompletedUnits({});
      setTempTargetTomorrowValues({});

      const netInfo = await NetInfo.fetch();
      const isOffline = !netInfo.isConnected;
      console.log('📡 Network status (activities):', isOffline ? 'OFFLINE' : 'ONLINE');

      if (isOffline) {
        const cachedActivities = await getCachedActivitiesForTask(taskDocId);
        if (cachedActivities.length > 0) {
          console.log('📦 Using cached activities (offline) count:', cachedActivities.length);
          applyActivities(cachedActivities.map(mapCachedActivity));
          return;
        }
        console.log('⚠️ No cached activities found for offline mode');
      }

      const activitiesRef = collection(db, 'activities');
      const q = query(activitiesRef, where('taskId', '==', taskDocId));
      const snapshot = await getDocs(q);

      const loadedActivities: ActivityDetail[] = [];

      for (const activityConfig of activitiesForSubmenu || []) {
        const activityDoc = snapshot.docs.find(
          (docItem) => docItem.data().activityId === activityConfig.id
        );

        if (activityDoc) {
          const data = activityDoc.data();
          const scopeUnit = data.scope?.unit || activityConfig.unit;

          try {
            await checkAndUnlockNewDay({
              taskId: taskDocId,
              activityId: activityConfig.id,
            });
          } catch (error) {
            console.error('Error checking unlock for new day:', error);
          }

          let totalProgress = data.completedToday || 0;

          try {
            const progressEntriesRef = collection(db, 'activities', activityDoc.id, 'progressEntries');
            const progressSnap = await getDocs(progressEntriesRef);

            if (!progressSnap.empty) {
              totalProgress = progressSnap.docs.reduce((sum, entry) => {
                const entryData = entry.data();
                return sum + (entryData.value || 0);
              }, 0);
              console.log('📊 Initial load - Activity:', activityConfig.id, '- Calculated total from', progressSnap.docs.length, 'entries:', totalProgress);
            }
          } catch (error) {
            console.error('Error fetching progressEntries during load:', error);
          }

          loadedActivities.push({
            id: activityConfig.id,
            name: activityConfig.name,
            status: data.status as ActivityStatus,
            scopeValue: data.scopeValue || 0,
            scopeApproved: data.scopeApproved || false,
            qcValue: data.qcValue || 0,
            completedToday: totalProgress,
            targetTomorrow: data.targetTomorrow || 0,
            unit: activityConfig.unit || 'Units',
            scopeUnit: scopeUnit,
            supervisorInputValue: data.supervisorInputValue,
            supervisorInputUnit: data.supervisorInputUnit,
            supervisorInputAt: data.supervisorInputAt,
            supervisorInputBy: data.supervisorInputBy,
            supervisorInputLocked: data.supervisorInputLocked,
            completedTodayLock: data.completedTodayLock,
            updatedAt: data.updatedAt ? formatTimestamp(data.updatedAt) : '',
            notes: data.notes || '',
            scopeRequested: data.scopeRequested || false,
            qcRequested: data.qcRequested || false,
            cablingRequested: data.cablingRequested || false,
            terminationRequested: data.terminationRequested || false,
            scopePolicy: activityConfig.scopePolicy || 'NORMAL',
            qcStatus: data.qc?.status || 'not_requested',
            qcScheduledAt: data.qc?.scheduledAt,
            cablingHandoff: activityConfig.cablingHandoff,
            terminationHandoff: activityConfig.terminationHandoff,
            drillingHandoff: activityConfig.drillingHandoff,
            canonicalUnit: data.unit as CanonicalUnit | undefined,
          });
        }
      }

      applyActivities(loadedActivities);

      await cacheActivitiesForTask({
        taskId: taskDocId,
        activities: loadedActivities.map(toCachedActivity),
      });
    } catch (error) {
      console.error('Error loading activities:', error);

      const cachedActivities = await getCachedActivitiesForTask(taskDocId);
      if (cachedActivities.length > 0) {
        console.log('📦 Fallback to cached activities after error. Count:', cachedActivities.length);
        applyActivities(cachedActivities.map(mapCachedActivity));
      }
    }
  }, [subActivity, formatTimestamp]);

  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }

    autoSaveTimer.current = setTimeout(async () => {
      if (!taskId || activities.length === 0) {
        console.log('⏭️ Skipping auto-save - no taskId or activities');
        return;
      }
      
      console.log('💾 Auto-saving...');
      setIsSaving(true);
      
      try {
        const activitiesRef = collection(db, 'activities');
        for (const activity of activities) {
          const q = query(
            activitiesRef,
            where('taskId', '==', taskId),
            where('activityId', '==', activity.id)
          );
          const snapshot = await getDocs(q);
          
          if (!snapshot.empty) {
            const activityDocId = snapshot.docs[0].id;
            
            await updateDoc(doc(db, 'activities', activityDocId), {
              completedToday: activity.completedToday,
              targetTomorrow: activity.targetTomorrow,
              notes: activity.notes,
              qcValue: activity.qcValue,
              updatedAt: serverTimestamp(),
              updatedBy: userId,
            });
          }
        }
        console.log('✅ Auto-save complete');
      } catch (error) {
        console.error('❌ Auto-save error:', error);
      } finally {
        setIsSaving(false);
      }
    }, 5000);
  }, [taskId, activities, userId]);

  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, []);

  const updateActivityValue = useCallback((activityId: string, field: string, value: string) => {
    const parsedValue: string | number = field === 'notes' ? value : (parseFloat(value) || 0);
    
    setActivities((prev) =>
      prev.map((act) => {
        if (act.id === activityId) {
          return { ...act, [field]: parsedValue } as ActivityDetail;
        }
        return act;
      })
    );
    triggerAutoSave();
  }, [triggerAutoSave]);

  const toggleExpand = useCallback((activityId: string) => {
    setExpandedActivity((prev) => (prev === activityId ? null : activityId));
  }, []);

  return {
    activities,
    expandedActivity,
    tempCompletedValues,
    tempCompletedUnits,
    tempTargetTomorrowValues,
    activityHistory,
    isSaving,
    setActivities,
    setExpandedActivity,
    setTempCompletedValues,
    setTempCompletedUnits,
    setTempTargetTomorrowValues,
    setActivityHistory,
    initializeActivities,
    loadActivities,
    updateActivityValue,
    toggleExpand,
  };
}
