import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, TextInput, Alert, Switch, Modal, FlatList } from 'react-native';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronDown, ChevronUp, Lock, AlertCircle, Link2, ChevronRight, RefreshCw, Plus, ChevronLeft } from 'lucide-react-native';
import UnitSelectorModal from '@/components/UnitSelectorModal';
import { Unit } from '@/utils/unitConversion';
import { subMenuActivities } from '@/constants/activities';
import type { ActivityStatus as ImportedActivityStatus, CanonicalUnit, CompletedTodayLock, ActivityModuleConfig } from '@/types';

import { checkAndApplyTimeLock, checkAndUnlockNewDay } from '@/utils/completedTodayLock';
import HandoverCard from '@/components/HandoverCard';
import { findMatchingSupervisors, MatchingSupervisor } from '@/utils/handover';
import TaskLockingOverlay from '@/components/TaskLockingOverlay';
import { taskLockCache } from '@/utils/taskLockCache';
import ActivityGridView from '@/components/ActivityGridView';
import { isMicroModuleEnabled, getMicroModulePlacement } from '@/utils/activityModuleHelpers';
import PlantRequestModal from '@/components/PlantRequestModal';
import StaffRequestModal from '@/components/StaffRequestModal';
import MaterialsRequestModal from '@/components/MaterialsRequestModal';


import { db } from '@/config/firebase';
import {
  collection,
  doc,
  updateDoc,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import NetInfo from '@react-native-community/netinfo';
import { queueFirestoreOperation } from '@/utils/offlineQueue';
import React from "react";

type ActivityStatus = ImportedActivityStatus;

type ActivityDetail = {
  id: string;
  name: string;
  status: ActivityStatus;
  scopeValue: number;
  scopeApproved: boolean;
  qcValue: number;
  completedToday: number;
  targetTomorrow: number;
  unit: string;
  completedTodayUnit?: string;
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
  surveyorHandoff?: boolean;
  moduleConfig?: ActivityModuleConfig;
  diaryPriority?: boolean;
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

type SupervisorTaskSummary = {
  id: string;
  name?: string;
  status?: string;
  taskAccessRequested?: boolean;
  pvArea?: string;
  blockArea?: string;
  specialArea?: string;
  location?: string;
  notes?: string;
  concreteRequested?: boolean;
  concreteQuantity?: number;
  concreteUnit?: Unit;
  createdAtMillis?: number;
  createdAt?: any;
  everApproved?: boolean;
  approvedBy?: string;
};

const UNIT_CANDIDATES: readonly Unit[] = ['mm', 'cm', 'm', 'km', 'm²', 'm³', 'L', 'kg', 't', 'N', 'Pa', 'V', 'W', '°C', '°F', 'Units', 'Qnty'] as const;

const isUnitValue = (value: unknown): value is Unit =>
  typeof value === 'string' && (UNIT_CANDIDATES as readonly string[]).includes(value as string);

const activityColors: Record<string, string> = {
  drilling: '#4285F4',
  trenching: '#4285F4',
  cabling: '#4285F4',
  terminations: '#4285F4',
  inverters: '#4285F4',
  mechanical: '#4285F4',
  casting: '#4285F4',
  structures: '#4285F4',
  commissioning: '#10b981',
};

const targetModuleNames: Record<string, string> = {
  'mv-cable': 'MV Cable',
  'dc-cable': 'DC Cable',
  'lv-cable': 'LV Cable',
  'dc-terminations': 'DC Terminations',
  'lv-terminations': 'LV Terminations',
};

export default function SupervisorTaskDetailScreen() {
  const { activity, subActivity, subMenuId, name } = useLocalSearchParams<{
    activity: string;
    subActivity: string;
    subMenuId?: string;
    name: string;
  }>();
  const { user } = useAuth();
  const router = useRouter();

  const [allTasksForSubActivity, setAllTasksForSubActivity] = useState<any[]>([]);
  const [currentTaskIndex, setCurrentTaskIndex] = useState<number>(0);

  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [taskAccessRequested, setTaskAccessRequested] = useState<boolean>(false);
  const [activities, setActivities] = useState<ActivityDetail[]>([]);
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);
  const [taskDetailsExpanded, setTaskDetailsExpanded] = useState<boolean>(true);
  const [taskProgressData, setTaskProgressData] = useState<{ unverified: number; verified: number }>({ unverified: 0, verified: 0 });
  const [requestResourcesExpanded, setRequestResourcesExpanded] = useState<boolean>(false);
  const [plantRequestExpanded, setPlantRequestExpanded] = useState<boolean>(false);
  const [staffRequestExpanded, setStaffRequestExpanded] = useState<boolean>(false);
  const [materialsRequestExpanded, setMaterialsRequestExpanded] = useState<boolean>(false);
  const [concreteRequestExpanded, setConcreteRequestExpanded] = useState<boolean>(false);
  
  const [pvArea, setPvArea] = useState<string>('');
  const [blockArea, setBlockArea] = useState<string>('');
  const [specialArea, setSpecialArea] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [taskId, setTaskId] = useState<string>('');
  const [taskName, setTaskName] = useState<string>('');

  const [scopeModalVisible, setScopeModalVisible] = useState<boolean>(false);
  const [scopeRequestNote, setScopeRequestNote] = useState<string>('');
  const [unitModalVisible, setUnitModalVisible] = useState<boolean>(false);
  const [selectedActivityForUnit, setSelectedActivityForUnit] = useState<string | null>(null);
  const [tempCompletedValues, setTempCompletedValues] = useState<Record<string, string>>({});
  const [tempCompletedUnits, setTempCompletedUnits] = useState<Record<string, Unit>>({});
  const [tempTargetTomorrowValues, setTempTargetTomorrowValues] = useState<Record<string, string>>({});
  const [activityHistory, setActivityHistory] = useState<Record<string, DayHistory[]>>({});
  const [hasShownDailyWarning, setHasShownDailyWarning] = useState<Record<string, boolean>>({});
  const [archiveModalVisible, setArchiveModalVisible] = useState<Record<string, boolean>>({});
  const [archivedMonths, setArchivedMonths] = useState<Record<string, { month: string; year: string; label: string }[]>>({});
  const [selectedArchivedMonth, setSelectedArchivedMonth] = useState<Record<string, string | null>>({});
  const [archivedHistory, setArchivedHistory] = useState<Record<string, DayHistory[]>>({});
  
  const [handoverModalVisible, setHandoverModalVisible] = useState<boolean>(false);
  const [matchingSupervisors, setMatchingSupervisors] = useState<MatchingSupervisor[]>([]);
  const [isLoadingSupervisors, setIsLoadingSupervisors] = useState<boolean>(false);
  const [selectedActivityForHandover, setSelectedActivityForHandover] = useState<string | null>(null);
  const [handoverRequested, setHandoverRequested] = useState<Record<string, boolean>>({});
  const [concreteRequested, setConcreteRequested] = useState<boolean>(false);
  const [concreteQuantity, setConcreteQuantity] = useState<string>('');
  const [concreteUnit, setConcreteUnit] = useState<Unit>('m³');
  const [concreteUnitModalVisible, setConcreteUnitModalVisible] = useState<boolean>(false);
  const [plantModalVisible, setPlantModalVisible] = useState<boolean>(false);
  const [staffModalVisible, setStaffModalVisible] = useState<boolean>(false);
  const [materialsModalVisible, setMaterialsModalVisible] = useState<boolean>(false);
  
  const [isCheckingLock, setIsCheckingLock] = useState<boolean>(true);
  const lockCheckAbortController = useRef<AbortController | null>(null);


  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (subActivity && activity) {
      loadAllTasksForSubActivity();
    }
  }, [subActivity, activity]);

  useEffect(() => {
    if (!taskId) return;

    console.log('📡 Setting up real-time listener for task:', taskId);
    
    const taskRef = doc(db, 'tasks', taskId);
    const unsubscribe = onSnapshot(taskRef, (snapshot) => {
      if (snapshot.exists()) {
        const taskData = snapshot.data();
        const everApproved = taskData.everApproved || taskData.approvedBy;
        const willBeLocked = taskData.status === 'LOCKED' && !everApproved;
        
        console.log('📊 REALTIME UPDATE - Task status:', taskData.status);
        console.log('📊 REALTIME UPDATE - everApproved:', everApproved);
        console.log('📊 REALTIME UPDATE - Setting isLocked to:', willBeLocked);
        console.log('📊 REALTIME UPDATE - taskAccessRequested:', taskData.taskAccessRequested);
        console.log('📊 REALTIME UPDATE - Current taskId:', taskId);
        console.log('📊 REALTIME UPDATE - Task createdAt:', taskData.createdAt?.toDate?.().toISOString());
        console.log('📊 REALTIME UPDATE - Task updatedAt:', taskData.updatedAt?.toDate?.().toISOString());
        console.log('📊 REALTIME UPDATE - Task approvedBy:', taskData.approvedBy);
        console.log('📊 REALTIME UPDATE - Task approvedAt:', taskData.approvedAt?.toDate?.().toISOString());
        
        if (taskData.status === 'LOCKED' && everApproved) {
          console.log('🔒🛡️ PROTECTION ACTIVE: Task status is LOCKED but everApproved=true!');
          console.log('🛡️ Ignoring LOCKED status - task will remain UNLOCKED');
          console.log('🛡️ This prevents re-locking after first approval');
        }
        
        setIsLocked(willBeLocked);
        setTaskAccessRequested(taskData.taskAccessRequested || false);
        setTaskName(taskData.name || '');
        setPvArea(taskData.pvArea || '');
        setBlockArea(taskData.blockArea || '');
        setSpecialArea(taskData.specialArea || '');
        setLocation(taskData.location || '');
        setNotes(taskData.notes || '');
      }
    });

    return () => {
      console.log('🔴 Cleaning up task listener');
      unsubscribe();
    };
  }, [taskId]);

  useEffect(() => {
    if (!taskId || !subActivity) return;

    console.log('📡 Setting up real-time listener for activities, taskId:', taskId);
    
    const activitiesRef = collection(db, 'activities');
    const q = query(activitiesRef, where('taskId', '==', taskId));
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      console.log('📊 ACTIVITIES REALTIME UPDATE - Received', snapshot.docs.length, 'activities');
      
      let activitiesForSubmenu = subMenuActivities[subActivity || ''];
      
      const effectiveSubMenuId = subMenuId || subActivity;
      
      if (!activitiesForSubmenu || activitiesForSubmenu.length === 0) {
        console.log('📋 No hardcoded activities found, checking dynamic menu items...');
        console.log('📋 Using effectiveSubMenuId in realtime listener:', effectiveSubMenuId);
        console.log('🔄 FORCE REFRESH: Fetching latest menuItems from Firestore (no cache)');
        try {
          const menusRef = collection(db, 'menuItems');
          const activityQuery = query(
            menusRef,
            where('level', '==', 'activity'),
            where('parentSubMenuId', '==', effectiveSubMenuId),
            where('siteId', '==', user?.siteId)
          );
          const activitySnapshot = await getDocs(activityQuery);
          
          const dynamicActivities: any[] = [];
          activitySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const moduleConfig = data.moduleConfig;
            
            console.log(`📝 Activity: ${data.name} - Fresh moduleConfig from Firestore:`, JSON.stringify(moduleConfig, null, 2));
            
            dynamicActivities.push({
              id: docSnap.id,
              name: data.name || 'Unnamed Activity',
              unit: 'Units',
              scopePolicy: 'NORMAL',
              moduleConfig: moduleConfig,
            });
          });
          
          dynamicActivities.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
          activitiesForSubmenu = dynamicActivities;
          console.log('📋 Loaded', dynamicActivities.length, 'dynamic activities from menuItems');
          console.log('✅ FRESH DATA: All moduleConfigs should now reflect latest changes');
        } catch (error) {
          console.error('❌ Error loading dynamic activities:', error);
          activitiesForSubmenu = [];
        }
      }
      const updatedActivities: ActivityDetail[] = [];

      for (const activityConfig of activitiesForSubmenu || []) {
        const activityDoc = snapshot.docs.find(
          (doc) => doc.data().activityId === activityConfig.id
        );

        if (activityDoc) {
          const data = activityDoc.data();
          const scopeUnit = data.scope?.unit || data.scopeUnit || '';
          
          console.log('📊 [REALTIME] Activity:', activityConfig.id, '- qc.status:', data.qc?.status, '- canonical:', data.unit?.canonical);
          console.log('📊 [REALTIME] Activity moduleConfig from Firestore:', data.moduleConfig);
          console.log('📊 [REALTIME] Activity moduleConfig from config:', activityConfig.moduleConfig);
          
          try {
            await checkAndUnlockNewDay({
              taskId: taskId,
              activityId: activityConfig.id,
            });
          } catch (error) {
            console.error('❌ [REALTIME] Error checking unlock for new day:', error);
          }
          
          const totalProgress = data.completedToday || 0;
          console.log('📊 [REALTIME] Activity:', activityConfig.id, '- completedToday from document:', totalProgress);
          
          const finalModuleConfig = data.moduleConfig || activityConfig.moduleConfig;
          console.log('📊 [REALTIME] Final moduleConfig being used:', finalModuleConfig);
          
          updatedActivities.push({
            id: activityConfig.id,
            name: activityConfig.name,
            status: data.status as ActivityStatus,
            scopeValue: data.scopeValue || 0,
            scopeApproved: data.scopeApproved || false,
            qcValue: data.qcValue || 0,
            completedToday: totalProgress,
            targetTomorrow: data.targetTomorrow || 0,
            unit: data.unit?.canonical || activityConfig.unit,
            completedTodayUnit: data.completedTodayUnit || data.unit?.canonical || activityConfig.unit,
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
            moduleConfig: finalModuleConfig,
            diaryPriority: data.diaryPriority || false,
          });
        } else if (activityConfig.drillingHandoff) {
          console.log('📊 Adding handover activity from config:', activityConfig.id, activityConfig.name);
          updatedActivities.push({
            id: activityConfig.id,
            name: activityConfig.name,
            status: 'LOCKED' as ActivityStatus,
            scopeValue: 0,
            scopeApproved: false,
            qcValue: 0,
            completedToday: 0,
            targetTomorrow: 0,
            unit: activityConfig.unit || 'Units',
            scopeUnit: activityConfig.unit || 'Units',
            updatedAt: '',
            notes: '',
            scopeRequested: false,
            qcRequested: false,
            cablingRequested: false,
            terminationRequested: false,
            scopePolicy: 'NONE',
            qcStatus: 'not_requested',
            cablingHandoff: activityConfig.cablingHandoff,
            terminationHandoff: activityConfig.terminationHandoff,

            drillingHandoff: activityConfig.drillingHandoff,
            moduleConfig: activityConfig.moduleConfig,
          });
        }
      }

      setActivities(updatedActivities);
      
      calculateTaskProgress(updatedActivities);
      
      for (const activityConfig of activitiesForSubmenu || []) {
        const activityDoc = snapshot.docs.find(
          (doc) => doc.data().activityId === activityConfig.id
        );
        
        if (activityDoc) {
          const historyRef = collection(db, 'activities', activityDoc.id, 'history');
          const historySnapshot = await getDocs(historyRef);
          
          const historyData: DayHistory[] = [];
          historySnapshot.docs.forEach((historyDoc) => {
            const data = historyDoc.data();
            historyData.push({
              date: data.date || historyDoc.id,
              completedValue: data.completedValue || 0,
              unit: data.unit || activityConfig.unit,
              percentage: data.percentage || '—',
              scopeValue: data.scopeValue || 0,
              scopeApproved: data.scopeApproved || false,
              qcStatus: data.qcStatus,
              materialToggle: data.materialToggle,
              plantToggle: data.plantToggle,
              workersToggle: data.workersToggle,
            });
          });
          
          historyData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          const last7Days = historyData.slice(0, 7);
          
          setActivityHistory((prev) => ({
            ...prev,
            [activityConfig.id]: last7Days,
          }));
        }
      }

    });

    return () => {
      console.log('🔴 Cleaning up activities listener');
      unsubscribe();
    };
  }, [taskId, subActivity]);

  const loadAllTasksForSubActivity = async () => {
    if (!subActivity || !activity || !user?.userId || !user?.siteId) {
      console.log('❌ Missing required data:', { subActivity, activity, userId: user?.userId, siteId: user?.siteId });
      setIsCheckingLock(false);
      return;
    }

    try {
      console.log('📋 Loading all tasks for:', { activity, subActivity, userId: user.userId, siteId: user.siteId });
      console.log('⏱️ [LOCK-CHECK-TIMING] Task load START');
      const loadStartTime = performance.now();
      
      const netInfo = await NetInfo.fetch();
      const isOffline = !netInfo.isConnected;
      console.log('🌐 Network status:', isOffline ? 'OFFLINE' : 'ONLINE');

      const tasksRef = collection(db, 'tasks');
      const q = query(
        tasksRef,
        where('subActivity', '==', subActivity),
        where('supervisorId', '==', user.userId),
        where('siteId', '==', user.siteId)
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const tasks = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as SupervisorTaskSummary[];
        
        tasks.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return timeB - timeA;
        });
        
        console.log('📊 Found', tasks.length, 'task(s) for this sub-activity (sorted newest first)');
        setAllTasksForSubActivity(tasks);
        
        const firstTask = tasks[0];
        const taskStatus = firstTask.status;
        const everApproved = firstTask.everApproved || firstTask.approvedBy;
        const taskAccessRequested = firstTask.taskAccessRequested || false;
        
        console.log('🔍 First task status:', taskStatus);
        console.log('🔍 First task everApproved:', everApproved);
        console.log('🔍 First task taskAccessRequested:', taskAccessRequested);
        console.log('🔍 isOffline:', isOffline);
        
        console.log('⏱️ [LOCK-CHECK-TIMING] Checking lock state (with cache)');
        const lockCheckStart = performance.now();
        
        let lockState = await taskLockCache.get(firstTask.id);
        
        if (lockState) {
          console.log('⏱️ [LOCK-CHECK-TIMING] Cache HIT in', Math.round(performance.now() - lockCheckStart), 'ms');
        } else {
          console.log('⏱️ [LOCK-CHECK-TIMING] Cache MISS, fetching from server...');
          
          if (lockCheckAbortController.current) {
            lockCheckAbortController.current.abort();
          }
          lockCheckAbortController.current = new AbortController();
          
          lockState = await taskLockCache.checkLockState(
            firstTask.id,
            lockCheckAbortController.current.signal
          );
          console.log('⏱️ [LOCK-CHECK-TIMING] Server fetch complete in', Math.round(performance.now() - lockCheckStart), 'ms');
        }
        
        const willBeLocked = lockState 
          ? lockState.isLocked 
          : (taskStatus === 'LOCKED' && !everApproved);
        
        if (willBeLocked && !taskAccessRequested) {
          console.log('🚫 LOCKED + NOT APPROVED + NO REQUEST');
          console.log('   Task is locked, will show toggle UI for task access request');
        }
        
        if (willBeLocked) {
          console.log('🚫 LOCKED + NOT APPROVED + REQUEST PENDING');
          console.log('   Will show toggle UI for task access request');
          console.log('   Task will load normally and show locked state with toggle');
        }
        
        setTaskId(firstTask.id);
        setTaskName(firstTask.name || '');
        setIsLocked(willBeLocked);
        setTaskAccessRequested(lockState?.taskAccessRequested ?? taskAccessRequested);
        setPvArea(firstTask.pvArea || '');
        setBlockArea(firstTask.blockArea || '');
        setSpecialArea(firstTask.specialArea || '');
        setLocation(firstTask.location || '');
        setNotes(firstTask.notes || '');
        
        setIsCheckingLock(false);
        const loadElapsed = Math.round(performance.now() - loadStartTime);
        console.log('⏱️ [LOCK-CHECK-TIMING] Total task load complete in', loadElapsed, 'ms');

        await loadActivities(firstTask.id);
      } else {
        console.log('📝 No existing tasks - Creating first task...');
        
        const countQuery = query(
          tasksRef,
          where('subActivity', '==', subActivity),
          where('supervisorId', '==', user.userId),
          where('siteId', '==', user.siteId)
        );
        const countSnapshot = await getDocs(countQuery);
        const taskNumber = countSnapshot.size + 1;
        const defaultTaskName = `Task ${taskNumber}`;
        
        const newTaskRef = await addDoc(collection(db, 'tasks'), {
          activity,
          subActivity,
          supervisorId: user.userId,
          siteId: user.siteId,
          name: defaultTaskName,
          status: 'LOCKED',
          taskAccessRequested: false,
          pvArea: '',
          blockArea: '',
          specialArea: '',
          location: '',
          notes: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: user.userId,
        });
        
        const newTask = {
          id: newTaskRef.id,
          activity,
          subActivity,
          supervisorId: user.userId,
          siteId: user.siteId,
          name: defaultTaskName,
          status: 'LOCKED',
          taskAccessRequested: false,
          pvArea: '',
          blockArea: '',
          specialArea: '',
          location: '',
          notes: '',
        };
        
        console.log('✅ Created new task:', newTaskRef.id, '- Name:', defaultTaskName);
        setAllTasksForSubActivity([newTask]);
        setTaskId(newTaskRef.id);
        setTaskName(defaultTaskName);
        setIsLocked(true);
        setIsCheckingLock(false);
        
        await taskLockCache.set({
          taskId: newTaskRef.id,
          isLocked: true,
          everApproved: false,
          taskAccessRequested: false,
          status: 'LOCKED',
          timestamp: Date.now(),
        });

        await initializeActivities(newTaskRef.id);
      }
    } catch (error) {
      console.error('❌ Error loading tasks:', error);
      setIsCheckingLock(false);
      Alert.alert('Error', 'Failed to load task data. Please try again.');
    }
  };

  const initializeActivities = async (taskDocId: string) => {
    let activitiesForSubmenu = subMenuActivities[subActivity || ''];
    
    const effectiveSubMenuId = subMenuId || subActivity;
    console.log('📋 [initializeActivities] Using subMenuId:', effectiveSubMenuId);
    
    if (!activitiesForSubmenu || activitiesForSubmenu.length === 0) {
      console.log('📋 [initializeActivities] No hardcoded activities, checking dynamic menu items...');
      try {
        const menusRef = collection(db, 'menuItems');
        const activityQuery = query(
          menusRef,
          where('level', '==', 'activity'),
          where('parentSubMenuId', '==', effectiveSubMenuId),
          where('siteId', '==', user?.siteId)
        );
        const activitySnapshot = await getDocs(activityQuery);
        
        const dynamicActivities: any[] = [];
        activitySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          console.log('📋 [initializeActivities] Activity from menu:', data.name, 'moduleConfig:', JSON.stringify(data.moduleConfig));
          dynamicActivities.push({
            id: docSnap.id,
            name: data.name || 'Unnamed Activity',
            unit: 'Units',
            scopePolicy: 'NORMAL',
            moduleConfig: data.moduleConfig,
          });
        });
        
        dynamicActivities.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        activitiesForSubmenu = dynamicActivities;
        console.log('📋 [initializeActivities] Loaded', dynamicActivities.length, 'dynamic activities');
      } catch (error) {
        console.error('❌ [initializeActivities] Error loading dynamic activities:', error);
      }
    }
    
    if (!activitiesForSubmenu || activitiesForSubmenu.length === 0) return;

    const activitiesRef = collection(db, 'activities');
    const initialActivities: ActivityDetail[] = [];

    for (const act of activitiesForSubmenu) {
      console.log('🔧 Initializing activity:', act.id, '- drillingHandoff:', act.drillingHandoff);
      
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
      
      console.log('📋 [initializeActivities] Saving activity to Firestore with moduleConfig:', JSON.stringify(act.moduleConfig));
      const activityData = {
        taskId: taskDocId,
        activityId: act.id,
        name: act.name,
        mainMenu: activity || '',
        subMenuKey: subActivity || '',
        status: 'LOCKED',
        scopeValue: 0,
        scopeApproved: false,
        qcValue: 0,
        completedToday: 0,
        targetTomorrow: 0,
        unit: act.unit || '',
        notes: '',
        scopeRequested: false,
        qcRequested: false,
        cablingRequested: false,
        terminationRequested: false,
        scopePolicy: act.scopePolicy || 'NORMAL',
        moduleConfig: act.moduleConfig || null,
        supervisorInputBy: user?.userId || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: user?.userId || '',
      };

      const docRef = await addDoc(activitiesRef, activityData);
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
        unit: act.unit || '',
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
        moduleConfig: act.moduleConfig,
      });
    }

    console.log('🔧 Initialized', initialActivities.length, 'activities for task');
    setActivities(initialActivities);
  };

  const loadActivities = async (taskDocId: string) => {
    try {
      console.log('🔄 [loadActivities] Clearing tempCompletedValues state for new task');
      setTempCompletedValues({});
      setTempCompletedUnits({});
      setTempTargetTomorrowValues({});
      
      const activitiesRef = collection(db, 'activities');
      const q = query(activitiesRef, where('taskId', '==', taskDocId));
      const snapshot = await getDocs(q);

      let activitiesForSubmenu = subMenuActivities[subActivity || ''];
      
      const effectiveSubMenuId = subMenuId || subActivity;
      console.log('📋 [loadActivities] Using subMenuId:', effectiveSubMenuId);
      
      if (!activitiesForSubmenu || activitiesForSubmenu.length === 0) {
        console.log('📋 [loadActivities] No hardcoded activities, checking dynamic menu items...');
        try {
          const menusRef = collection(db, 'menuItems');
          const activityQuery = query(
            menusRef,
            where('level', '==', 'activity'),
            where('parentSubMenuId', '==', effectiveSubMenuId),
            where('siteId', '==', user?.siteId)
          );
          const activitySnapshot = await getDocs(activityQuery);
          
          const dynamicActivities: any[] = [];
          activitySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            console.log('📋 [loadActivities] Activity from menu:', data.name, 'moduleConfig:', JSON.stringify(data.moduleConfig));
            dynamicActivities.push({
              id: docSnap.id,
              name: data.name || 'Unnamed Activity',
              unit: 'Units',
              scopePolicy: 'NORMAL',
              moduleConfig: data.moduleConfig,
            });
          });
          
          dynamicActivities.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
          activitiesForSubmenu = dynamicActivities;
          console.log('📋 [loadActivities] Loaded', dynamicActivities.length, 'dynamic activities');
        } catch (error) {
          console.error('❌ [loadActivities] Error loading dynamic activities:', error);
          activitiesForSubmenu = [];
        }
      }
      const loadedActivities: ActivityDetail[] = [];

      for (const activityConfig of activitiesForSubmenu || []) {
        const activityDoc = snapshot.docs.find(
          (doc) => doc.data().activityId === activityConfig.id
        );

        if (activityDoc) {
          const data = activityDoc.data();
          const scopeUnit = data.scope?.unit || data.scopeUnit || '';
          
          try {
            await checkAndUnlockNewDay({
              taskId: taskDocId,
              activityId: activityConfig.id,
            });
          } catch (error) {
            console.error('Error checking unlock for new day:', error);
          }
          
          const totalProgress = data.completedToday || 0;
          console.log('📊 Initial load - Activity:', activityConfig.id, '- completedToday from document:', totalProgress);
          
          console.log('📋 [loadActivities] Loading activity from Firestore - moduleConfig from DB:', JSON.stringify(data.moduleConfig), 'from config:', JSON.stringify(activityConfig.moduleConfig));
          
          const finalModuleConfig = data.moduleConfig || activityConfig.moduleConfig;
          
          if (!data.moduleConfig && activityConfig.moduleConfig) {
            console.log('⚠️ [loadActivities] Activity document missing moduleConfig, syncing from menu item config...');
            try {
              await updateDoc(activityDoc.ref, {
                moduleConfig: activityConfig.moduleConfig,
                updatedAt: serverTimestamp(),
                updatedBy: user?.userId || 'system-sync',
              });
              console.log('✅ [loadActivities] ModuleConfig synced to activity document');
            } catch (syncError) {
              console.error('❌ [loadActivities] Failed to sync moduleConfig:', syncError);
            }
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
            unit: data.unit?.canonical || activityConfig.unit,
            completedTodayUnit: data.completedTodayUnit || data.unit?.canonical || activityConfig.unit,
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
            moduleConfig: finalModuleConfig,
            diaryPriority: data.diaryPriority || false,
          });
        } else {
          console.log('⚠️ Activity missing in Firestore, creating:', activityConfig.id);
          
          if (activityConfig.drillingHandoff) {
            loadedActivities.push({
              id: activityConfig.id,
              name: activityConfig.name,
              status: 'LOCKED' as ActivityStatus,
              scopeValue: 0,
              scopeApproved: false,
              qcValue: 0,
              completedToday: 0,
              targetTomorrow: 0,
              unit: activityConfig.unit || 'Units',
              updatedAt: '',
              notes: '',
              scopeRequested: false,
              qcRequested: false,
              cablingRequested: false,
              terminationRequested: false,
              scopePolicy: 'NONE',
              cablingHandoff: activityConfig.cablingHandoff,
              terminationHandoff: activityConfig.terminationHandoff,
              drillingHandoff: activityConfig.drillingHandoff,
            });
          } else {
            const activityData = {
              taskId: taskDocId,
              activityId: activityConfig.id,
              name: activityConfig.name,
              mainMenu: activity || '',
              subMenuKey: subActivity || '',
              status: 'LOCKED',
              supervisorInputBy: user?.userId || '',
              scopeValue: 0,
              scopeApproved: false,
              qcValue: 0,
              completedToday: 0,
              targetTomorrow: 0,
              unit: activityConfig.unit || 'Units',
              notes: '',
              scopeRequested: false,
              qcRequested: false,
              cablingRequested: false,
              terminationRequested: false,
              scopePolicy: activityConfig.scopePolicy || 'NORMAL',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              updatedBy: user?.userId || '',
            };

            await addDoc(activitiesRef, activityData);
            console.log('✅ Created missing activity in Firestore:', activityConfig.id);

            loadedActivities.push({
              id: activityConfig.id,
              name: activityConfig.name,
              status: 'LOCKED' as ActivityStatus,
              scopeValue: 0,
              scopeApproved: false,
              qcValue: 0,
              completedToday: 0,
              targetTomorrow: 0,
              unit: activityConfig.unit || 'Units',
              updatedAt: '',
              notes: '',
              scopeRequested: false,
              qcRequested: false,
              cablingRequested: false,
              terminationRequested: false,
              scopePolicy: activityConfig.scopePolicy || 'NORMAL',
              cablingHandoff: activityConfig.cablingHandoff,
              terminationHandoff: activityConfig.terminationHandoff,
              drillingHandoff: activityConfig.drillingHandoff,
            });
          }
        }
      }

      console.log('Loaded activities:', loadedActivities.length);
      setActivities(loadedActivities);
      calculateTaskProgress(loadedActivities);
    } catch (error) {
      console.error('Error loading activities:', error);
    }
  };

  const formatTimestamp = (timestamp: any): string => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString();
  };

  const color = activity ? activityColors[activity] || '#10b981' : '#10b981';
  const decodedName = name ? decodeURIComponent(name) : 'Task';

  const getStatusColor = (status: ActivityStatus): string => {
    switch (status) {
      case 'LOCKED':
        return '#94a3b8';
      case 'OPEN':
        return '#f59e0b';
      case 'DONE':
        return '#10b981';
      case 'HANDOFF_SENT':
        return '#8b5cf6';
      default:
        return '#94a3b8';
    }
  };

  const getStatusBackground = (status: ActivityStatus): string => {
    switch (status) {
      case 'LOCKED':
        return '#f1f5f9';
      case 'OPEN':
        return '#fef3c7';
      case 'DONE':
        return '#d1fae5';
      case 'HANDOFF_SENT':
        return '#ede9fe';
      default:
        return '#f1f5f9';
    }
  };

  const calculatePercentage = (qc: number, scope: number, scopeApproved: boolean): string => {
    if (!scopeApproved || scope === 0) return '—';
    return ((qc / scope) * 100).toFixed(2);
  };



  const handleToggleCablingRequest = async (activityId: string, value: boolean) => {
    try {
      const activity = activities.find((a) => a.id === activityId);
      if (!activity?.cablingHandoff) return;

      const newStatus = value ? 'HANDOFF_SENT' : 'LOCKED';
      console.log(`Cabling request ${value ? 'sent' : 'cancelled'} for activity: ${activityId}`);

      setActivities((prev) =>
        prev.map((act) =>
          act.id === activityId
            ? { ...act, cablingRequested: value, status: newStatus as ActivityStatus }
            : act
        )
      );

      const activitiesRef = collection(db, 'activities');
      const q = query(
        activitiesRef,
        where('taskId', '==', taskId),
        where('activityId', '==', activityId)
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const activityDocId = snapshot.docs[0].id;
        
        await updateDoc(doc(db, 'activities', activityDocId), {
          cablingRequested: value,
          status: newStatus,
          updatedAt: serverTimestamp(),
        });

        if (value) {
          await addDoc(collection(db, 'requests'), {
            type: 'CABLING_REQUEST',
            taskId: taskId,
            activityId: activityId,
            targetModule: activity.cablingHandoff.targetModule,
            requestedBy: user?.userId,
            siteId: user?.siteId,
            activityName: activity.name,
            subActivityName: decodedName,
            status: 'PENDING',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          console.log('CABLING_REQUEST created, target:', activity.cablingHandoff.targetModule, 'siteId:', user?.siteId);
        } else {
          const requestsRef = collection(db, 'requests');
          const reqQuery = query(
            requestsRef,
            where('type', '==', 'CABLING_REQUEST'),
            where('siteId', '==', user?.siteId),
            where('taskId', '==', taskId),
            where('activityId', '==', activityId),
            where('status', '==', 'PENDING')
          );
          const reqSnapshot = await getDocs(reqQuery);
          
          for (const reqDoc of reqSnapshot.docs) {
            await updateDoc(doc(db, 'requests', reqDoc.id), {
              status: 'CANCELLED',
              updatedAt: serverTimestamp(),
            });
          }
          console.log('CABLING_REQUEST cancelled');
        }
      }
    } catch (error) {
      console.error('Error handling cabling request:', error);
      Alert.alert('Error', 'Failed to update cabling request');
    }
  };

  const handleToggleTerminationRequest = async (activityId: string, value: boolean) => {
    try {
      const activity = activities.find((a) => a.id === activityId);
      if (!activity?.terminationHandoff) return;

      const newStatus = value ? 'HANDOFF_SENT' : 'LOCKED';
      console.log(`Termination request ${value ? 'sent' : 'cancelled'} for activity: ${activityId}`);

      setActivities((prev) =>
        prev.map((act) =>
          act.id === activityId
            ? { ...act, terminationRequested: value, status: newStatus as ActivityStatus }
            : act
        )
      );

      const activitiesRef = collection(db, 'activities');
      const q = query(
        activitiesRef,
        where('taskId', '==', taskId),
        where('activityId', '==', activityId)
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const activityDocId = snapshot.docs[0].id;
        
        await updateDoc(doc(db, 'activities', activityDocId), {
          terminationRequested: value,
          status: newStatus,
          updatedAt: serverTimestamp(),
        });

        if (value) {
          await addDoc(collection(db, 'requests'), {
            type: 'TERMINATION_REQUEST',
            taskId: taskId,
            activityId: activityId,
            targetModule: activity.terminationHandoff.targetModule,
            requestedBy: user?.userId,
            siteId: user?.siteId,
            activityName: activity.name,
            subActivityName: decodedName,
            status: 'PENDING',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          console.log('TERMINATION_REQUEST created, target:', activity.terminationHandoff.targetModule, 'siteId:', user?.siteId);
        } else {
          const requestsRef = collection(db, 'requests');
          const reqQuery = query(
            requestsRef,
            where('type', '==', 'TERMINATION_REQUEST'),
            where('siteId', '==', user?.siteId),
            where('taskId', '==', taskId),
            where('activityId', '==', activityId),
            where('status', '==', 'PENDING')
          );
          const reqSnapshot = await getDocs(reqQuery);
          
          for (const reqDoc of reqSnapshot.docs) {
            await updateDoc(doc(db, 'requests', reqDoc.id), {
              status: 'CANCELLED',
              updatedAt: serverTimestamp(),
            });
          }
          console.log('TERMINATION_REQUEST cancelled');
        }
      }
    } catch (error) {
      console.error('Error handling termination request:', error);
      Alert.alert('Error', 'Failed to update termination request');
    }
  };

  const handleToggleHandoverRequest = async (activityId: string, value: boolean) => {
    try {
      const activity = activities.find((a) => a.id === activityId);
      
      if (!value) {
        console.log('Cancelling handover request for activity:', activityId);
        setHandoverRequested((prev) => ({ ...prev, [activityId]: false }));
        
        const requestsRef = collection(db, 'requests');
        const reqQuery = query(
          requestsRef,
          where('type', '==', 'HANDOVER_REQUEST'),
          where('fromSupervisorId', '==', user?.userId),
          where('fromTaskId', '==', taskId),
          where('activityId', '==', activityId),
          where('status', '==', 'PENDING')
        );
        const reqSnapshot = await getDocs(reqQuery);
        
        for (const reqDoc of reqSnapshot.docs) {
          await updateDoc(doc(db, 'requests', reqDoc.id), {
            status: 'CANCELLED',
            updatedAt: serverTimestamp(),
          });
        }
        console.log('Handover request cancelled');
        return;
      }
      
      if (!pvArea || !blockArea) {
        Alert.alert('Missing Information', 'Please ensure PV Area and Block Number are set before requesting handover.');
        return;
      }
      
      console.log('🔄 [handleToggleHandoverRequest] Starting handover request for activity:', activityId);
      setSelectedActivityForHandover(activityId);
      setIsLoadingSupervisors(true);
      setHandoverModalVisible(true);
      
      const matching = await findMatchingSupervisors({
        currentSupervisorId: user?.userId || '',
        subMenuKey: subActivity || '',
        activityId,
        pvArea,
        blockNumber: blockArea,
        siteId: user?.siteId || '',
      });
      
      console.log('📋 Found matching supervisors:', matching.length);
      setMatchingSupervisors(matching);
      setIsLoadingSupervisors(false);
      
      if (matching.length === 0) {
        console.log('ℹ️ No matching supervisors found - routing to Planner for appointment');
        await sendHandoverToPlanner(activityId, activity);
      }
    } catch (error) {
      console.error('Error handling handover request:', error);
      setIsLoadingSupervisors(false);
      Alert.alert('Error', 'Failed to load matching supervisors');
    }
  };

  const sendHandoverToPlanner = async (activityId: string, activity: ActivityDetail | undefined) => {
    if (!activity) return;

    try {
      console.log('📤 [sendHandoverToPlanner] Creating planner handover request');
      
      const tasksRef = collection(db, 'tasks');
      const taskDoc = await getDocs(query(tasksRef, where('__name__', '==', taskId)));
      const taskData = taskDoc.docs[0]?.data();
      
      const handoverRequestRef = await addDoc(collection(db, 'requests'), {
        type: 'HANDOVER_REQUEST',
        fromSupervisorId: user?.userId,
        fromTaskId: taskId,
        activityId,
        activityName: activity.name,
        subMenuKey: subActivity,
        subMenuName: decodedName,
        pvArea,
        blockNumber: blockArea,
        specialArea,
        siteId: user?.siteId,
        masterAccountId: taskData?.masterAccountId || user?.masterAccountId,
        status: 'PENDING',
        handoverMode: 'PLANNER_APPOINTMENT',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      console.log('✅ Planner handover request created with ID:', handoverRequestRef.id);
      
      setHandoverRequested((prev) => ({
        ...prev,
        [activityId]: true,
      }));
      
      setHandoverModalVisible(false);
      Alert.alert(
        'Request Sent to Planner',
        'No matching supervisors found. Your handover request has been sent to the Planner for team appointment.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error sending handover to planner:', error);
      Alert.alert('Error', 'Failed to send handover request to Planner');
      throw error;
    }
  };

  const handleSendHandoverRequest = async (toSupervisorId: string, toTaskId: string) => {
    if (!selectedActivityForHandover) return;
    
    try {
      const activity = activities.find((a) => a.id === selectedActivityForHandover);
      if (!activity) return;

      console.log('📤 [handleSendHandoverRequest] Creating handover request:', {
        from: user?.userId,
        to: toSupervisorId,
        activity: selectedActivityForHandover,
        fromTaskId: taskId,
        toTaskId,
      });
      
      const tasksRef = collection(db, 'tasks');
      const taskDoc = await getDocs(query(tasksRef, where('__name__', '==', taskId)));
      const taskData = taskDoc.docs[0]?.data();

      const handoverRequestRef = await addDoc(collection(db, 'requests'), {
        type: 'HANDOVER_REQUEST',
        fromSupervisorId: user?.userId,
        toSupervisorId,
        fromTaskId: taskId,
        toTaskId,
        activityId: selectedActivityForHandover,
        activityName: activity.name,
        subMenuKey: subActivity,
        subMenuName: decodedName,
        pvArea,
        blockNumber: blockArea,
        specialArea,
        siteId: user?.siteId,
        masterAccountId: taskData?.masterAccountId || user?.masterAccountId,
        status: 'PENDING',
        handoverMode: 'SUPERVISOR_TO_SUPERVISOR',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      console.log('✅ Handover request created with ID:', handoverRequestRef.id);
      
      setHandoverRequested((prev) => ({
        ...prev,
        [selectedActivityForHandover]: true,
      }));
      
      Alert.alert('Success', 'Handover request sent successfully');
    } catch (error) {
      console.error('Error creating handover request:', error);
      Alert.alert('Error', 'Failed to send handover request');
      throw error;
    }
  };

  const handleToggleConcreteRequest = async (value: boolean) => {
    try {
      if (value) {
        if (!concreteQuantity || parseFloat(concreteQuantity) <= 0) {
          Alert.alert('Quantity Required', 'Please enter a valid quantity for the concrete order.');
          return;
        }
        
        console.log('Creating concrete request with quantity:', concreteQuantity, concreteUnit);
        await addDoc(collection(db, 'requests'), {
          type: 'CONCRETE_REQUEST',
          taskId: taskId,
          requestedBy: user?.userId,
          siteId: user?.siteId,
          status: 'PENDING',
          pvArea: pvArea,
          blockNumber: blockArea,
          specialArea: specialArea || '',
          subActivity: subActivity,
          subActivityName: decodedName,
          quantity: parseFloat(concreteQuantity),
          unit: concreteUnit,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        console.log('✅ CONCRETE_REQUEST created for task:', taskId);

        await updateDoc(doc(db, 'tasks', taskId), {
          concreteRequested: true,
          updatedAt: serverTimestamp(),
        });
        
        setConcreteRequested(true);
      } else {
        console.log('Cancelling concrete request');
        const requestsRef = collection(db, 'requests');
        const reqQuery = query(
          requestsRef,
          where('type', '==', 'CONCRETE_REQUEST'),
          where('taskId', '==', taskId),
          where('status', '==', 'PENDING')
        );
        const reqSnapshot = await getDocs(reqQuery);
        
        for (const reqDoc of reqSnapshot.docs) {
          await updateDoc(doc(db, 'requests', reqDoc.id), {
            status: 'CANCELLED',
            updatedAt: serverTimestamp(),
          });
        }
        console.log('CONCRETE_REQUEST cancelled');

        await updateDoc(doc(db, 'tasks', taskId), {
          concreteRequested: false,
          updatedAt: serverTimestamp(),
        });
        
        setConcreteRequested(false);
        setConcreteQuantity('');
        setConcreteUnit('m³');
      }
    } catch (error) {
      console.error('Error handling concrete request:', error);
      Alert.alert('Error', 'Failed to update concrete request');
    }
  };

  const handleToggleTaskAccess = async (value: boolean) => {
    try {
      const netInfo = await NetInfo.fetch();
      const isOffline = !netInfo.isConnected;
      console.log('🔓 handleToggleTaskAccess - value:', value, '- isOffline:', isOffline);

      setTaskAccessRequested(value);

      if (value) {
        console.log('📤 Creating TASK_REQUEST');
        
        if (isOffline) {
          console.log('📡 OFFLINE - Queueing task access request');
          await queueFirestoreOperation(
            {
              type: 'add',
              collection: 'requests',
              data: {
                type: 'TASK_REQUEST',
                taskId: taskId,
                requestedBy: user?.userId,
                siteId: user?.siteId,
                subActivity: subActivity,
                subActivityName: decodedName,
                status: 'PENDING',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              },
            },
            {
              priority: 'P0',
              entityType: 'taskRequest',
            }
          );

          await queueFirestoreOperation(
            {
              type: 'update',
              collection: 'tasks',
              docId: taskId,
              data: {
                taskAccessRequested: true,
                updatedAt: serverTimestamp(),
              },
            },
            {
              priority: 'P0',
              entityType: 'taskRequest',
            }
          );

          console.log('✅ Task access request queued (will sync when online)');
        } else {
          await addDoc(collection(db, 'requests'), {
            type: 'TASK_REQUEST',
            taskId: taskId,
            requestedBy: user?.userId,
            siteId: user?.siteId,
            subActivity: subActivity,
            subActivityName: decodedName,
            status: 'PENDING',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          console.log('✅ TASK_REQUEST created for task:', taskId);

          await updateDoc(doc(db, 'tasks', taskId), {
            taskAccessRequested: true,
            updatedAt: serverTimestamp(),
          });
        }

        console.log('✅ Task access request sent');
      } else {
        console.log('❌ Cancelling task access request');
        
        if (isOffline) {
          console.log('📡 OFFLINE - Cannot cancel request while offline');
          Alert.alert(
            'Offline Mode',
            'You cannot cancel requests while offline. Please try again when you have an internet connection.'
          );
          setTaskAccessRequested(true);
          return;
        }

        const requestsRef = collection(db, 'requests');
        const reqQuery = query(
          requestsRef,
          where('type', '==', 'TASK_REQUEST'),
          where('taskId', '==', taskId),
          where('status', '==', 'PENDING')
        );
        const reqSnapshot = await getDocs(reqQuery);

        for (const reqDoc of reqSnapshot.docs) {
          await updateDoc(doc(db, 'requests', reqDoc.id), {
            status: 'CANCELLED',
            updatedAt: serverTimestamp(),
          });
        }
        console.log('TASK_REQUEST cancelled');

        await updateDoc(doc(db, 'tasks', taskId), {
          taskAccessRequested: false,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error('Error handling task access request:', error);
      Alert.alert('Error', 'Failed to update task access request');
      setTaskAccessRequested(!value);
    }
  };

  const handleToggleQCRequest = async (activityId: string, value: boolean) => {
    try {
      const activity = activities.find((a) => a.id === activityId);
      
      const { isQCToggleLocked } = await import('@/utils/completedTodayLock');
      const qcToggleLocked = await isQCToggleLocked({ taskId, activityId });
      
      if (qcToggleLocked) {
        console.log('🔒 Cannot change QC toggle - QC has already completed inspection today');
        Alert.alert(
          'QC Toggle Locked', 
          'The QC toggle is locked because a QC inspection was completed today. The toggle will unlock tomorrow.'
        );
        return;
      }
      
      const compositeKey = `${taskId}-${activityId}`;
      const hasTempValue = tempCompletedValues[compositeKey] && parseFloat(tempCompletedValues[compositeKey]) > 0;
      
      if (value && hasTempValue) {
        console.log('⚠️ Cannot create QC request - supervisor has unsaved input');
        Alert.alert(
          'Cannot Request QC', 
          'You have an unsaved value in the input field. Please submit your "Completed Today" value first before requesting QC inspection.'
        );
        return;
      }
      
      if (value && (!activity?.completedToday || activity.completedToday <= 0)) {
        console.log('⚠️ Cannot create QC request - no completed today value');
        Alert.alert(
          'Cannot Request QC', 
          'You must submit a "Completed Today" value before requesting a QC inspection.'
        );
        return;
      }
      
      if (value && activity?.qcStatus && ['pending', 'scheduled', 'in_progress'].includes(activity.qcStatus)) {
        console.log('⚠️ Cannot create QC request - active request exists with status:', activity.qcStatus);
        Alert.alert('QC Request Pending', 'A QC inspection is already scheduled or in progress for this activity.');
        return;
      }
      
      if (value) {
        console.log('🔍 [QC DUPLICATE CHECK] Checking for existing pending QC requests...');
        const requestsRef = collection(db, 'requests');
        const existingReqQuery = query(
          requestsRef,
          where('type', '==', 'QC_REQUEST'),
          where('siteId', '==', user?.siteId),
          where('taskId', '==', taskId),
          where('activityId', '==', activityId),
          where('status', 'in', ['pending', 'scheduled', 'in_progress'])
        );
        const existingReqSnapshot = await getDocs(existingReqQuery);
        
        if (!existingReqSnapshot.empty) {
          console.log('🚫 [QC DUPLICATE CHECK] Found', existingReqSnapshot.docs.length, 'active QC request(s) - BLOCKING duplicate creation');
          console.log('   Existing request IDs:', existingReqSnapshot.docs.map(d => d.id).join(', '));
          Alert.alert(
            'Duplicate QC Request', 
            'A QC request already exists for this activity. Please wait for the current request to be completed or cancelled before creating a new one.'
          );
          return;
        }
        console.log('✅ [QC DUPLICATE CHECK] No active requests found - proceeding with creation');
      }

      console.log(`QC request ${value ? 'sent' : 'cancelled'} for activity: ${activityId}`);

      setActivities((prev) =>
        prev.map((act) =>
          act.id === activityId ? { ...act, qcRequested: value } : act
        )
      );

      const activitiesRef = collection(db, 'activities');
      const q = query(
        activitiesRef,
        where('taskId', '==', taskId),
        where('activityId', '==', activityId)
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const activityDocId = snapshot.docs[0].id;
        
        if (value) {
          const activityDetail = activities.find((a) => a.id === activityId);
          const requestRef = await addDoc(collection(db, 'requests'), {
            type: 'QC_REQUEST',
            taskId: taskId,
            activityId: activityId,
            requestedBy: user?.userId,
            siteId: user?.siteId,
            activityName: activityDetail?.name || 'Unknown Activity',
            subActivityName: decodedName,
            status: 'pending',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          console.log('✅ QC_REQUEST created with siteId:', user?.siteId, 'requestId:', requestRef.id);
          
          await updateDoc(doc(db, 'activities', activityDocId), {
            qcRequested: true,
            'qc.status': 'pending',
            'qc.lastRequestId': requestRef.id,
            'qc.lastUpdatedAt': serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          const requestsRef = collection(db, 'requests');
          const reqQuery = query(
            requestsRef,
            where('type', '==', 'QC_REQUEST'),
            where('siteId', '==', user?.siteId),
            where('taskId', '==', taskId),
            where('activityId', '==', activityId),
            where('status', '==', 'pending')
          );
          const reqSnapshot = await getDocs(reqQuery);
          
          for (const reqDoc of reqSnapshot.docs) {
            await updateDoc(doc(db, 'requests', reqDoc.id), {
              status: 'CANCELLED',
              updatedAt: serverTimestamp(),
            });
          }
          console.log('QC_REQUEST cancelled');
          
          await updateDoc(doc(db, 'activities', activityDocId), {
            qcRequested: false,
            'qc.status': 'not_requested',
            'qc.lastRequestId': null,
            updatedAt: serverTimestamp(),
          });
        }
      }
    } catch (error) {
      console.error('Error handling QC request:', error);
      Alert.alert('Error', 'Failed to update QC request');
    }
  };



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
            const previousData = snapshot.docs[0].data();
            
            await updateDoc(doc(db, 'activities', activityDocId), {
              completedToday: activity.completedToday,
              targetTomorrow: activity.targetTomorrow,
              notes: activity.notes,
              qcValue: activity.qcValue,
              diaryPriority: activity.diaryPriority || false,
              updatedAt: serverTimestamp(),
              updatedBy: user?.userId,
            });
          }
        }
        console.log('✅ Auto-save complete');
      } catch (error) {
        console.error('❌ Auto-save error:', error);
      } finally {
        setIsSaving(false);
        console.log('💾 Auto-save finished - isSaving set to false');
      }
    }, 5000);
  }, [taskId, activities, user]);

  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, []);



  const handleToggleDiaryPriority = async (activityId: string, value: boolean) => {
    try {
      console.log('🚩 Toggle diary priority for activity:', activityId, 'to:', value);
      
      setActivities((prev) =>
        prev.map((act) =>
          act.id === activityId ? { ...act, diaryPriority: value } : act
        )
      );

      const activitiesRef = collection(db, 'activities');
      const q = query(
        activitiesRef,
        where('taskId', '==', taskId),
        where('activityId', '==', activityId)
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const activityDocId = snapshot.docs[0].id;
        await updateDoc(doc(db, 'activities', activityDocId), {
          diaryPriority: value,
          updatedAt: serverTimestamp(),
        });
        console.log('✅ Diary priority updated in Firestore');
      }
    } catch (error) {
      console.error('❌ Error updating diary priority:', error);
      Alert.alert('Error', 'Failed to update priority flag');
    }
  };

  const handleSubmitToDiary = async (activityId: string) => {
    try {
      const activity = activities.find(a => a.id === activityId);
      if (!activity || !activity.notes || activity.notes.trim() === '') {
        Alert.alert('No Note', 'Please add a note before submitting to the diary.');
        return;
      }

      console.log('📝 Submitting note to diary for activity:', activityId);

      const activitiesRef = collection(db, 'activities');
      const q = query(
        activitiesRef,
        where('taskId', '==', taskId),
        where('activityId', '==', activityId)
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const activityDocId = snapshot.docs[0].id;
        const activityData = snapshot.docs[0].data();

        const diaryEntriesRef = collection(db, 'activities', activityDocId, 'diaryEntries');
        await addDoc(diaryEntriesRef, {
          note: activity.notes,
          isPriority: activity.diaryPriority || false,
          submittedAt: serverTimestamp(),
          submittedBy: user?.userId,
          submittedByName: user?.name || user?.userId,
          taskId: taskId,
          activityId: activityId,
          activityName: activity.name,
          siteId: user?.siteId,
        });

        await updateDoc(doc(db, 'activities', activityDocId), {
          notes: '',
          diaryPriority: false,
          updatedAt: serverTimestamp(),
        });

        setActivities((prev) =>
          prev.map((act) =>
            act.id === activityId ? { ...act, notes: '', diaryPriority: false } : act
          )
        );

        console.log('✅ Note submitted to diary and cleared');
        Alert.alert('Success', 'Note submitted to diary');
      }
    } catch (error) {
      console.error('❌ Error submitting to diary:', error);
      Alert.alert('Error', 'Failed to submit note to diary');
    }
  };

  const updateActivityValue = async (
    activityId: string,
    field: 'targetTomorrow' | 'notes',
    value: string,
  ) => {
    setActivities((prev) =>
      prev.map((act) => {
        if (act.id !== activityId) {
          return act;
        }

        if (field === 'notes') {
          return { ...act, notes: value };
        }

        const numericValue = parseFloat(value);
        return { ...act, targetTomorrow: Number.isFinite(numericValue) ? numericValue : 0 };
      }),
    );
    triggerAutoSave();
  };

  const handleSubmitCompletedToday = async (activityId: string, value: number, unit: string): Promise<boolean | undefined> => {
    console.log('🔔 [handleSubmitCompletedToday] Starting - activityId:', activityId, 'value:', value, 'unit:', unit);
    
    try {
      const activitiesRef = collection(db, 'activities');
      const q = query(
        activitiesRef,
        where('taskId', '==', taskId),
        where('activityId', '==', activityId)
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.error('❌ Activity not found');
        Alert.alert('Error', 'Activity not found');
        return;
      }
      
      const activityDocId = snapshot.docs[0].id;
      const previousData = snapshot.docs[0].data();
      const activity = activities.find(a => a.id === activityId);
      
      console.log('📊 Previous scopeApproved:', previousData.scopeApproved);
      console.log('📊 Previous completedToday:', previousData.completedToday);
      console.log('📊 New value:', value);
      console.log('📊 Scope policy:', previousData.scopePolicy);
      
      return await proceedWithSubmission(activityDocId, previousData, activity, activityId, value, unit, false);
    } catch (error) {
      console.error('❌ Error in handleSubmitCompletedToday:', error);
      Alert.alert('Error', 'Failed to update progress');
    }
  };

  const proceedWithSubmission = async (
    activityDocId: string,
    previousData: any,
    activity: ActivityDetail | undefined,
    activityId: string,
    value: number,
    unit: string,
    shouldLockImmediately: boolean
  ): Promise<boolean> => {
    try {
      const netInfo = await NetInfo.fetch();
      const isOffline = !netInfo.isConnected;
      
      console.log('📝 [proceedWithSubmission] Handling progressEntry for today');
      console.log('   Network:', isOffline ? 'OFFLINE' : 'ONLINE');
      console.log('   ActivityDocId:', activityDocId);
      console.log('   SupervisorId:', user?.userId);
      console.log('   Value:', value);
      console.log('   Unit:', unit);
      
      const canonicalUnitValue = previousData.unit?.canonical || previousData.canonicalUnit?.canonical || unit;
      const progressEntriesRef = collection(db, 'activities', activityDocId, 'progressEntries');
      
      const today = new Date().toISOString().split('T')[0];
      console.log('📅 Today\'s date:', today);
      
      const existingEntriesSnap = await getDocs(
        query(
          progressEntriesRef,
          where('supervisorId', '==', user?.userId || ''),
          where('taskId', '==', taskId),
          where('activityId', '==', activityId)
        )
      );
      
      let todayEntry: any = null;
      existingEntriesSnap.docs.forEach((doc) => {
        const entryData = doc.data();
        const entryDate = entryData.enteredAt?.toDate?.();
        if (entryDate) {
          const entryDateStr = entryDate.toISOString().split('T')[0];
          if (entryDateStr === today) {
            todayEntry = { id: doc.id, data: entryData };
            console.log('🔍 Found existing entry for today:', doc.id);
          }
        }
      });
      
      if (todayEntry) {
        console.log('🔄 Updating existing entry - OLD value:', todayEntry.data.value, '➡️ NEW value:', value);
        
        const updateData = {
          value: value,
          unit: unit,
          canonicalUnit: canonicalUnitValue,
          enteredAt: serverTimestamp(),
        };
        
        if (isOffline) {
          console.log('📡 OFFLINE - Queueing progressEntry update');
          await queueFirestoreOperation(
            {
              type: 'update',
              collection: `activities/${activityDocId}/progressEntries`,
              docId: todayEntry.id,
              data: updateData,
            },
            {
              priority: 'P0',
              entityType: 'completedToday',
            }
          );
        } else {
          await updateDoc(doc(db, 'activities', activityDocId, 'progressEntries', todayEntry.id), updateData);
        }
        console.log('✅ Updated progressEntry document:', todayEntry.id);
      } else {
        console.log('➕ Creating new progressEntry for today');
        const progressEntryData = {
          supervisorId: user?.userId || '',
          supervisorName: user?.name || user?.userId || '',
          enteredAt: serverTimestamp(),
          value: value,
          unit: unit,
          canonicalUnit: canonicalUnitValue,
          taskId: taskId,
          activityId: activityId,
          siteId: user?.siteId || '',
          source: 'manual',
        };
        
        if (isOffline) {
          console.log('📡 OFFLINE - Queueing progressEntry creation');
          const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await queueFirestoreOperation(
            {
              type: 'add',
              collection: `activities/${activityDocId}/progressEntries`,
              data: progressEntryData,
            },
            {
              priority: 'P0',
              entityType: 'completedToday',
            }
          );
          console.log('✅ Queued progressEntry creation (will sync when online)');
        } else {
          const newProgressEntry = await addDoc(progressEntriesRef, progressEntryData);
          console.log('✅ Created progressEntry document with ID:', newProgressEntry.id);
        }
      }
      
      const totalProgress = value;
      
      console.log('📊 [CANONICAL RULES] Today\'s submission value:', totalProgress, unit);
      console.log('   Per COMPLETED_TODAY_SUBMISSION_RULES.md:');
      console.log('   - ONE submission per day (total work completed today)');
      console.log('   - This value REPLACES any previous submission for today');
      console.log('   - Historical entries preserved in progressEntries subcollection');
      
      const updatePayload: any = {
        completedToday: totalProgress,
        completedTodayUnit: unit,
        completedTodayUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: user?.userId,
        supervisorInputBy: previousData.supervisorInputBy || user?.userId,
      };
      
      console.log('🔒 [LOCK] Checking if QC interaction lock should be applied');
      const qcHasInteracted = previousData.qc?.status === 'completed';
      
      if (qcHasInteracted && !previousData.completedTodayLock?.isLocked) {
        console.log('🔒 [QC LOCK] QC has completed - applying QC_INTERACTION lock');
        const now = new Date();
        const lockDate = now.toISOString().split('T')[0];
        
        updatePayload['completedTodayLock.isLocked'] = true;
        updatePayload['completedTodayLock.lockType'] = 'QC_INTERACTION';
        updatePayload['completedTodayLock.lockedAt'] = serverTimestamp();
        updatePayload['completedTodayLock.lockedValue'] = totalProgress;
        updatePayload['completedTodayLock.lockedUnit'] = unit;
        updatePayload['completedTodayLock.lockDate'] = lockDate;
        
        console.log('🔒 [QC LOCK] Applied QC interaction lock - supervisor can no longer edit');
      } else if (previousData.completedTodayLock?.isLocked && previousData.completedTodayLock?.lockType === 'QC_INTERACTION') {
        console.log('ℹ️ [LOCK] Already locked by QC interaction - cannot edit');
      } else {
        console.log('✅ [NO LOCK] Supervisor can continue editing until QC interaction or time lock at 23:45');
      }
      
      if (isOffline) {
        console.log('📡 OFFLINE - Queueing activity update');
        await queueFirestoreOperation(
          {
            type: 'update',
            collection: 'activities',
            docId: activityDocId,
            data: updatePayload,
          },
          {
            priority: 'P0',
            entityType: 'completedToday',
          }
        );
      } else {
        await updateDoc(doc(db, 'activities', activityDocId), updatePayload);
      }
      
      console.log('✅ [CANONICAL RULES] Updated completedToday to:', totalProgress, unit, qcHasInteracted ? '(QC LOCKED)' : '(EDITABLE)');
      console.log('   This is the supervisor\'s TOTAL work completed today (not a sum of multiple entries)');
      
      console.log('🧱 Checking for concrete request status...');
      const tasksRef = collection(db, 'tasks');
      const taskDoc = await getDocs(query(tasksRef, where('__name__', '==', taskId)));
      if (!taskDoc.empty) {
        const data = taskDoc.docs[0].data();
        setConcreteRequested(data.concreteRequested || false);
      }

      console.log('📊 [SCOPE REQUEST CHECK]');
      console.log('   previousData.scopeApproved:', previousData.scopeApproved);
      console.log('   previousData.scopeRequested:', previousData.scopeRequested);
      console.log('   previousData.scopePolicy:', previousData.scopePolicy);
      console.log('   previousData.scopeEverSet:', previousData.scopeEverSet);
      console.log('   value:', value);
      
      const scopeNeverSet = !previousData.scopeApproved && !previousData.scopeEverSet;
      const hasProgressValue = value > 0;
      const isNormalPolicy = previousData.scopePolicy === 'NORMAL';
      const scopeNotYetRequested = !previousData.scopeRequested;
      
      console.log('   scopeNeverSet:', scopeNeverSet);
      console.log('   hasProgressValue:', hasProgressValue);
      console.log('   isNormalPolicy:', isNormalPolicy);
      console.log('   scopeNotYetRequested:', scopeNotYetRequested);
      
      if (scopeNeverSet && hasProgressValue && isNormalPolicy && scopeNotYetRequested) {
        console.log('🔔 [SCOPE REQUEST] Creating scope request for activity:', activityId);
        console.log('   First completed today value submitted:', value, unit);
        
        try {
          const requestsRef = collection(db, 'requests');
          const scopeRequestData = {
            type: 'SCOPE_REQUEST',
            status: 'PENDING',
            siteId: user?.siteId || '',
            supervisorId: user?.userId || '',
            activityId: activityId,
            taskId: taskId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          
          if (isOffline) {
            console.log('📡 OFFLINE - Queueing scope request');
            await queueFirestoreOperation(
              {
                type: 'add',
                collection: 'requests',
                data: scopeRequestData,
              },
              {
                priority: 'P0',
                entityType: 'activityRequest',
              }
            );
          } else {
            await addDoc(requestsRef, scopeRequestData);
            console.log('✅ Scope request created successfully');
          }
          
          const activityUpdateData: any = {
            scopeRequested: true,
            updatedAt: serverTimestamp(),
          };
          
          if (isOffline) {
            await queueFirestoreOperation(
              {
                type: 'update',
                collection: 'activities',
                docId: activityDocId,
                data: activityUpdateData,
              },
              {
                priority: 'P0',
                entityType: 'activityRequest',
              }
            );
          } else {
            await updateDoc(doc(db, 'activities', activityDocId), activityUpdateData);
          }
          
          console.log('✅ Activity marked as scopeRequested = true');
          
          setActivities((prev) =>
            prev.map((act) =>
              act.id === activityId ? { ...act, scopeRequested: true } : act
            )
          );
        } catch (error) {
          console.error('❌ Error creating scope request:', error);
        }
      }
      
      console.log('🔄 Updating UI with totalProgress:', totalProgress);
      
      setActivities((prev) =>
        prev.map((act) =>
          act.id === activityId
            ? { 
                ...act, 
                completedToday: totalProgress,
                completedTodayLock: qcHasInteracted && !previousData.completedTodayLock?.isLocked ? {
                  isLocked: true,
                  lockType: 'QC_INTERACTION',
                  lockedAt: new Date(),
                  lockedValue: totalProgress,
                  lockedUnit: unit,
                  lockDate: new Date().toISOString().split('T')[0],
                } : previousData.completedTodayLock
              }
            : act
        )
      );
      
      Alert.alert('Success', qcHasInteracted ? 'Progress submitted and locked by QC interaction' : 'Progress submitted successfully');
      return true;
    } catch (error) {
      console.error('❌ Error in proceedWithSubmission:', error);
      Alert.alert('Error', 'Failed to update progress');
      return false;
    }
  };

  const calculateTaskProgress = async (activityList: ActivityDetail[]) => {
    console.log('📊 [TASK %] Calculating task progress from', activityList.length, 'activities...');
    
    let totalScope = 0;
    let totalUnverified = 0;
    let totalVerified = 0;
    let activityCount = 0;
    let unverifiedPercentSum = 0;
    let verifiedPercentSum = 0;
    
    for (const activity of activityList) {
      const hasHandoff = activity.cablingHandoff || activity.terminationHandoff;
      
      if (hasHandoff) {
        console.log(`⏭️ [TASK %] Skipping ${activity.name}: hasHandoff=true`);
        continue;
      }
      
      const isGridActivity = activity.moduleConfig?.baseBlockType === 'GRID_TYPE_ROW_PROGRESS' && activity.moduleConfig.gridConfig;
      
      if (isGridActivity) {
        console.log(`📊 [TASK %] Grid Activity: ${activity.name}`);
        
        const gridConfig = activity.moduleConfig!.gridConfig!;
        const totalCells = (gridConfig.flexibleColumns || []).reduce((sum, col) => sum + col.rows, 0);
        const valuePerCell = gridConfig.scopeValue || 1;
        const totalScopeForGrid = totalCells * valuePerCell;
        
        const completedValue = activity.completedToday || 0;
        const qcValue = activity.qcValue || 0;
        
        const unverifiedPercent = totalScopeForGrid > 0 ? (completedValue / totalScopeForGrid) * 100 : 0;
        const verifiedPercent = totalScopeForGrid > 0 ? (qcValue / totalScopeForGrid) * 100 : 0;
        
        console.log(`   Total cells: ${totalCells}`);
        console.log(`   Value per cell: ${valuePerCell}`);
        console.log(`   Total scope: ${totalScopeForGrid}`);
        console.log(`   Completed: ${completedValue} = ${unverifiedPercent.toFixed(2)}%`);
        console.log(`   QC Verified: ${qcValue} = ${verifiedPercent.toFixed(2)}%`);
        
        unverifiedPercentSum += unverifiedPercent;
        verifiedPercentSum += verifiedPercent;
        activityCount++;
      } else if (activity.scopeValue > 0) {
        console.log(`📊 [TASK %] Standard Activity: ${activity.name}`);
        
        const completedValue = activity.completedToday || 0;
        const qcValue = activity.qcValue || 0;
        const scopeValue = activity.scopeValue;
        
        const unverifiedPercent = (completedValue / scopeValue) * 100;
        const verifiedPercent = (qcValue / scopeValue) * 100;
        
        console.log(`   Scope: ${scopeValue}`);
        console.log(`   Completed: ${completedValue} = ${unverifiedPercent.toFixed(2)}%`);
        console.log(`   QC Verified: ${qcValue} = ${verifiedPercent.toFixed(2)}%`);
        
        unverifiedPercentSum += unverifiedPercent;
        verifiedPercentSum += verifiedPercent;
        activityCount++;
      } else {
        console.log(`⏭️ [TASK %] Skipping ${activity.name}: no scope value`);
      }
    }
    
    const avgUnverifiedPercent = activityCount > 0 ? unverifiedPercentSum / activityCount : 0;
    const avgVerifiedPercent = activityCount > 0 ? verifiedPercentSum / activityCount : 0;
    
    console.log(`📊 [TASK %] FINAL CALCULATION:`);
    console.log(`   Activities counted: ${activityCount}`);
    console.log(`   Average Unverified: ${avgUnverifiedPercent.toFixed(2)}%`);
    console.log(`   Average Verified: ${avgVerifiedPercent.toFixed(2)}%`);
    
    setTaskProgressData({
      unverified: avgUnverifiedPercent,
      verified: avgVerifiedPercent,
    });
  };

  const toggleExpand = (activityId: string) => {
    setExpandedActivity((prev) => (prev === activityId ? null : activityId));
  };

  useEffect(() => {
    if (!expandedActivity) return;
    
    const activity = activities.find(a => a.id === expandedActivity);
    if (!activity) return;
    
    const isLocked = activity.completedTodayLock?.isLocked || activity.qcStatus === 'completed';
    const hasHandoff = activity.cablingHandoff || activity.terminationHandoff;
    
    if (!isLocked && !hasHandoff && !hasShownDailyWarning[expandedActivity]) {
      setTimeout(() => {
        Alert.alert(
          'Daily Submission Notice',
          'You can only submit your TOTALS once a day for this Activity',
          [
            {
              text: 'OK',
              onPress: () => {
                console.log('✅ User acknowledged daily submission limit');
                setHasShownDailyWarning(prev => ({ ...prev, [expandedActivity]: true }));
              }
            }
          ]
        );
      }, 300);
    }
  }, [expandedActivity, activities, hasShownDailyWarning]);

  if (isCheckingLock) {
    return (
      <View style={styles.container}>
        <TaskLockingOverlay visible={true} message="Checking task access..." />
      </View>
    );
  }

  if (isLocked) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: decodedName,
            headerStyle: {
              backgroundColor: color,
            },
            headerTintColor: '#fff',
            headerRight: () => (
              <View style={styles.headerRightPlaceholder} />
            ),
          }}
        />
        
        <View style={[styles.lockedHeader, { backgroundColor: color }]}>
          <Text style={styles.lockedSiteName}>{user?.siteName?.toUpperCase() || 'ABC SOLAR'}</Text>
        </View>

        <View style={styles.lockedContainer}>
          <Lock size={64} color="#cbd5e1" />
          <Text style={styles.lockedTitle}>Task Locked</Text>
          <Text style={styles.lockedMessage}>Request Access from Planner</Text>
          
          <View style={styles.toggleContainer}>
            <Text style={styles.toggleLabel}>
              {taskAccessRequested ? 'Request Sent' : 'Request Access'}
            </Text>
            <Switch
              value={taskAccessRequested}
              onValueChange={handleToggleTaskAccess}
              trackColor={{ false: '#e2e8f0', true: color }}
              thumbColor="#fff"
              ios_backgroundColor="#e2e8f0"
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: decodedName,
          headerStyle: {
            backgroundColor: color,
          },
          headerTintColor: '#fff',
          headerRight: () => (
            <View style={styles.headerRightContainer}>
              {isSaving && (
                <View style={styles.savingIndicator}>
                  <Text style={styles.savingText}>Saving...</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.addTaskButton}
                onPress={() => {
                  router.push({
                    pathname: '/supervisor-task-request',
                    params: {
                      activity: activity || '',
                      subActivity: subActivity || '',
                      name: name || '',
                      currentTaskId: taskId,
                      isAddTaskRequest: 'true',
                      subMenuId: subMenuId || subActivity || '',
                    },
                  });
                }}
                activeOpacity={0.7}
              >
                <Plus size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      
      <View style={styles.headerCard}>
        <View style={styles.headerLeftContent}>
          <Text style={styles.siteName}>{user?.siteName?.toUpperCase() || 'ABC SOLAR'}</Text>
          {allTasksForSubActivity.length > 1 && (
            <View style={styles.carouselNav}>
              <TouchableOpacity 
                style={[styles.carouselButton, currentTaskIndex === 0 && styles.carouselButtonDisabled]}
                onPress={async () => {
                  if (currentTaskIndex > 0) {
                    setIsCheckingLock(true);
                    const newIndex = currentTaskIndex - 1;
                    setCurrentTaskIndex(newIndex);
                    const task = allTasksForSubActivity[newIndex];
                    
                    const lockState = await taskLockCache.get(task.id);
                    const willBeLocked = lockState 
                      ? lockState.isLocked 
                      : (task.status === 'LOCKED' && !(task.everApproved || task.approvedBy));
                    
                    setTaskId(task.id);
                    setTaskName(task.name || '');
                    setIsLocked(willBeLocked);
                    setTaskAccessRequested(lockState?.taskAccessRequested ?? (task.taskAccessRequested || false));
                    setPvArea(task.pvArea || '');
                    setBlockArea(task.blockArea || '');
                    setSpecialArea(task.specialArea || '');
                    setLocation(task.location || '');
                    setNotes(task.notes || '');
                    setIsCheckingLock(false);
                    await loadActivities(task.id);
                  }
                }}
                disabled={currentTaskIndex === 0}
              >
                <ChevronLeft size={20} color={currentTaskIndex === 0 ? '#94a3b8' : '#fff'} />
              </TouchableOpacity>
              <Text style={styles.carouselText}>
                Task {currentTaskIndex + 1} of {allTasksForSubActivity.length}
              </Text>
              <TouchableOpacity 
                style={[styles.carouselButton, currentTaskIndex === allTasksForSubActivity.length - 1 && styles.carouselButtonDisabled]}
                onPress={async () => {
                  if (currentTaskIndex < allTasksForSubActivity.length - 1) {
                    setIsCheckingLock(true);
                    const newIndex = currentTaskIndex + 1;
                    setCurrentTaskIndex(newIndex);
                    const task = allTasksForSubActivity[newIndex];
                    
                    const lockState = await taskLockCache.get(task.id);
                    const willBeLocked = lockState 
                      ? lockState.isLocked 
                      : (task.status === 'LOCKED' && !(task.everApproved || task.approvedBy));
                    
                    setTaskId(task.id);
                    setTaskName(task.name || '');
                    setIsLocked(willBeLocked);
                    setTaskAccessRequested(lockState?.taskAccessRequested ?? (task.taskAccessRequested || false));
                    setPvArea(task.pvArea || '');
                    setBlockArea(task.blockArea || '');
                    setSpecialArea(task.specialArea || '');
                    setLocation(task.location || '');
                    setNotes(task.notes || '');
                    setIsCheckingLock(false);
                    await loadActivities(task.id);
                  }
                }}
                disabled={currentTaskIndex === allTasksForSubActivity.length - 1}
              >
                <ChevronRight size={20} color={currentTaskIndex === allTasksForSubActivity.length - 1 ? '#94a3b8' : '#fff'} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.topBlock}>
          <View style={styles.compactInfoCard}>
            <View style={styles.taskDetailsTopRow}>
              <View style={styles.taskTitleAndDetailsColumn}>
                <Text style={styles.taskDetailsHeader}>{taskName || `TASK ${currentTaskIndex + 1}`}</Text>
                <View style={styles.compactTaskDetails}>
                  <Text style={styles.compactDetailRow}>PV Area: <Text style={styles.infoValueInline}>{pvArea || '—'}</Text></Text>
                  <Text style={styles.compactDetailRow}>Block Number: <Text style={styles.infoValueInline}>{blockArea || '—'}</Text></Text>
                </View>
              </View>
              <View style={styles.totalTaskProgressBox}>
                <Text style={styles.totalTaskProgressLabel}>TASK %</Text>
                <View style={styles.progressPercentagesRow}>
                  <View style={styles.verifiedPercentageBox}>
                    <Text style={styles.progressPercentageLabel}>Verified</Text>
                    <Text style={styles.verifiedProgressValue}>{taskProgressData.verified.toFixed(1)}%</Text>
                  </View>
                  <View style={styles.unverifiedPercentageBox}>
                    <Text style={styles.progressPercentageLabel}>Unverified</Text>
                    <Text style={styles.unverifiedProgressValue}>{taskProgressData.unverified.toFixed(1)}%</Text>
                  </View>
                </View>
              </View>
            </View>
            {(specialArea || location) && (
              <>
                {specialArea && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Special Area:</Text>
                    <Text style={styles.infoValue}>{specialArea}</Text>
                  </View>
                )}
                {location && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Location:</Text>
                    <Text style={styles.infoValue}>{location}</Text>
                  </View>
                )}
              </>
            )}
            {notes && (
              <TouchableOpacity
                style={styles.expandNotesButton}
                onPress={() => setTaskDetailsExpanded(!taskDetailsExpanded)}
                activeOpacity={0.7}
              >
                <Text style={styles.expandNotesText}>Notes</Text>
                {taskDetailsExpanded ? (
                  <ChevronUp size={16} color="#4285F4" />
                ) : (
                  <ChevronDown size={16} color="#4285F4" />
                )}
              </TouchableOpacity>
            )}
          </View>
          
          {taskDetailsExpanded && notes && (
            <View style={styles.notesExpandedSection}>
              <Text style={styles.notesContent}>{notes}</Text>
            </View>
          )}
        </View>

        <View style={styles.activitiesSection}>
          <Text style={styles.sectionTitle}>Activities</Text>
          
          <View style={styles.requestCardsContainer}>
            <TouchableOpacity
              style={styles.requestCardsHeader}
              onPress={() => setRequestResourcesExpanded(!requestResourcesExpanded)}
              activeOpacity={0.7}
            >
              <View>
                <Text style={styles.requestCardsTitle}>Request Resources</Text>
                <Text style={styles.requestCardsSubtitle}>Request plant, staff, or materials for this task</Text>
              </View>
              {requestResourcesExpanded ? (
                <ChevronUp size={20} color="#666" />
              ) : (
                <ChevronDown size={20} color="#666" />
              )}
            </TouchableOpacity>
            
            {requestResourcesExpanded && (
            <View style={styles.requestCardsContent}>
              <View style={styles.independentRequestBlock}>
                <TouchableOpacity
                  style={styles.independentRequestHeader}
                  onPress={() => {
                    console.log('[SupervisorTaskDetail] Plant Request clicked');
                    console.log('[SupervisorTaskDetail] user?.masterAccountId:', user?.masterAccountId);
                    console.log('[SupervisorTaskDetail] user?.siteId:', user?.siteId);
                    setPlantModalVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.independentRequestHeaderContent}>
                    <Text style={styles.independentRequestTitle}>🚜 Plant Request</Text>
                    <Text style={styles.independentRequestSubtitle}>Request plant equipment</Text>
                  </View>
                  <ChevronRight size={18} color="#666" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.independentRequestBlock}>
                <TouchableOpacity
                  style={styles.independentRequestHeader}
                  onPress={() => {
                    console.log('[SupervisorTaskDetail] Staff Request clicked');
                    console.log('[SupervisorTaskDetail] user?.masterAccountId:', user?.masterAccountId);
                    console.log('[SupervisorTaskDetail] user?.siteId:', user?.siteId);
                    setStaffModalVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.independentRequestHeaderContent}>
                    <Text style={styles.independentRequestTitle}>👷 Staff Request</Text>
                    <Text style={styles.independentRequestSubtitle}>Request additional staff</Text>
                  </View>
                  <ChevronRight size={18} color="#666" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.independentRequestBlock}>
                <TouchableOpacity
                  style={styles.independentRequestHeader}
                  onPress={() => {
                    console.log('[SupervisorTaskDetail] Materials Request clicked');
                    console.log('[SupervisorTaskDetail] user?.masterAccountId:', user?.masterAccountId);
                    console.log('[SupervisorTaskDetail] user?.siteId:', user?.siteId);
                    setMaterialsModalVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.independentRequestHeaderContent}>
                    <Text style={styles.independentRequestTitle}>📦 Materials Request</Text>
                    <Text style={styles.independentRequestSubtitle}>Request materials</Text>
                  </View>
                  <ChevronRight size={18} color="#666" />
                </TouchableOpacity>
              </View>
            </View>
            )}
          </View>
          
          {activities.filter(act => !act.drillingHandoff).map((activityItem) => {
            const isExpanded = expandedActivity === activityItem.id;
            const percentage = calculatePercentage(
              activityItem.qcValue, 
              activityItem.scopeValue, 
              activityItem.scopeApproved
            );
            const showScopePendingBanner = activityItem.status === 'OPEN' && !activityItem.scopeApproved;
            const isHandoff = activityItem.status === 'HANDOFF_SENT';
            const hasHandoff = activityItem.cablingHandoff || activityItem.terminationHandoff;
            
            const concreteRequestAbove = isMicroModuleEnabled(activityItem.moduleConfig, 'CONCRETE_REQUEST') && 
              getMicroModulePlacement(activityItem.moduleConfig, 'CONCRETE_REQUEST') === 'above';
            const concreteRequestInside = isMicroModuleEnabled(activityItem.moduleConfig, 'CONCRETE_REQUEST') && 
              getMicroModulePlacement(activityItem.moduleConfig, 'CONCRETE_REQUEST') === 'inside';
            
            return (
              <React.Fragment key={activityItem.id}>
                {concreteRequestAbove && (
                  <View style={styles.concreteRequestCard}>
                    <TouchableOpacity
                      style={styles.concreteRequestHeader}
                      onPress={() => setConcreteRequestExpanded(!concreteRequestExpanded)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.concreteRequestTitle}>CONCRETE REQUEST - {activityItem.name.toUpperCase()}</Text>
                      {concreteRequestExpanded ? (
                        <ChevronUp size={20} color="#f97316" />
                      ) : (
                        <ChevronDown size={20} color="#f97316" />
                      )}
                    </TouchableOpacity>
                    
                    {concreteRequestExpanded && (
                      <>
                        {!concreteRequested && (
                          <View style={styles.concreteQuantityInputBlock}>
                            <Text style={styles.concreteQuantityLabel}>Quantity *</Text>
                            <View style={styles.quantityInputRow}>
                              <TextInput
                                style={styles.concreteQuantityInput}
                                value={concreteQuantity}
                                onChangeText={setConcreteQuantity}
                                keyboardType="numeric"
                                placeholder="Enter quantity"
                                placeholderTextColor="#94a3b8"
                              />
                              <TouchableOpacity 
                                style={styles.unitSelectorButton}
                                onPress={() => setConcreteUnitModalVisible(true)}
                              >
                                <Text style={styles.unitSelectorButtonText}>{concreteUnit}</Text>
                                <ChevronDown size={16} color="#64748b" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
                        
                        <View style={styles.toggleRequestRow}>
                          <View style={styles.toggleRequestTextContainer}>
                            <Text style={[styles.toggleRequestLabel, { color: concreteRequested ? '#f97316' : '#64748b' }]}>
                              {concreteRequested ? '✓ Concrete Requested' : 'Request Concrete'}
                            </Text>
                            {concreteRequested && (
                              <Text style={styles.toggleSubtext}>
                                Concrete request sent to planner • {concreteQuantity} {concreteUnit}
                              </Text>
                            )}
                          </View>
                          <Switch
                            value={concreteRequested}
                            onValueChange={handleToggleConcreteRequest}
                            trackColor={{ false: '#e2e8f0', true: '#f97316' }}
                            thumbColor="#fff"
                            ios_backgroundColor="#e2e8f0"
                          />
                        </View>
                      </>
                    )}
                  </View>
                )}
                <View style={styles.activityCard}>
                <TouchableOpacity
                  style={styles.activityHeader}
                  onPress={() => toggleExpand(activityItem.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.activityHeaderLeft}>
                    <Text style={styles.activityName}>{activityItem.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <View style={[styles.statusBadge, { backgroundColor: getStatusBackground(activityItem.status) }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(activityItem.status) }]}>
                          {activityItem.status}
                        </Text>
                      </View>
                      {(activityItem.completedTodayLock?.isLocked || activityItem.qcStatus === 'completed') && activityItem.scopeValue > 0 && (() => {
                        const unverifiedAmount = Math.max(activityItem.scopeValue - activityItem.qcValue, 0);
                        return unverifiedAmount > 0;
                      })() && (
                        <Text style={styles.inlineUnverifiedText}>
                          {Math.max(activityItem.scopeValue - activityItem.qcValue, 0)}{activityItem.unit} unverified
                        </Text>
                      )}
                    </View>
                  </View>
                  {isExpanded ? (
                    <ChevronUp size={20} color="#64748b" />
                  ) : (
                    <ChevronDown size={20} color="#64748b" />
                  )}
                </TouchableOpacity>





                {concreteRequestInside && (
                  <View style={styles.concreteRequestCard}>
                    <TouchableOpacity
                      style={styles.concreteRequestHeader}
                      onPress={() => setConcreteRequestExpanded(!concreteRequestExpanded)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.concreteRequestTitle}>CONCRETE REQUEST</Text>
                      {concreteRequestExpanded ? (
                        <ChevronUp size={20} color="#f97316" />
                      ) : (
                        <ChevronDown size={20} color="#f97316" />
                      )}
                    </TouchableOpacity>
                    
                    {concreteRequestExpanded && (
                      <>
                        {!concreteRequested && (
                          <View style={styles.concreteQuantityInputBlock}>
                            <Text style={styles.concreteQuantityLabel}>Quantity *</Text>
                            <View style={styles.quantityInputRow}>
                              <TextInput
                                style={styles.concreteQuantityInput}
                                value={concreteQuantity}
                                onChangeText={setConcreteQuantity}
                                keyboardType="numeric"
                                placeholder="Enter quantity"
                                placeholderTextColor="#94a3b8"
                              />
                              <TouchableOpacity 
                                style={styles.unitSelectorButton}
                                onPress={() => setConcreteUnitModalVisible(true)}
                              >
                                <Text style={styles.unitSelectorButtonText}>{concreteUnit}</Text>
                                <ChevronDown size={16} color="#64748b" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
                        
                        <View style={styles.toggleRequestRow}>
                          <View style={styles.toggleRequestTextContainer}>
                            <Text style={[styles.toggleRequestLabel, { color: concreteRequested ? '#f97316' : '#64748b' }]}>
                              {concreteRequested ? '✓ Concrete Requested' : 'Request Concrete'}
                            </Text>
                            {concreteRequested && (
                              <Text style={styles.toggleSubtext}>
                                Concrete request sent to planner • {concreteQuantity} {concreteUnit}
                              </Text>
                            )}
                          </View>
                          <Switch
                            value={concreteRequested}
                            onValueChange={handleToggleConcreteRequest}
                            trackColor={{ false: '#e2e8f0', true: '#f97316' }}
                            thumbColor="#fff"
                            ios_backgroundColor="#e2e8f0"
                          />
                        </View>
                      </>
                    )}
                  </View>
                )}

                {showScopePendingBanner && (
                  <View style={styles.scopePendingBanner}>
                    <AlertCircle size={16} color="#f59e0b" />
                    <Text style={styles.scopePendingText}>Scope pending - Planner to set value</Text>
                  </View>
                )}

                {isHandoff && (activityItem.cablingHandoff || activityItem.terminationHandoff) && (
                  <View style={styles.handoffBanner}>
                    <Link2 size={16} color="#8b5cf6" />
                    <Text style={styles.handoffText}>
                      Handoff sent to {targetModuleNames[
                        (activityItem.cablingHandoff?.targetModule || activityItem.terminationHandoff?.targetModule)!
                      ]}
                    </Text>
                  </View>
                )}

                {activityItem.cablingHandoff && (
                  <View style={styles.toggleRequestRow}>
                    <Text style={[styles.toggleRequestLabel, { color: activityItem.cablingRequested ? '#8b5cf6' : '#64748b' }]}>
                      {activityItem.cablingRequested ? 'Cabling Requested' : 'Request Cabling'}
                    </Text>
                    <Switch
                      value={activityItem.cablingRequested}
                      onValueChange={(val) => handleToggleCablingRequest(activityItem.id, val)}
                      trackColor={{ false: '#e2e8f0', true: '#8b5cf6' }}
                      thumbColor="#fff"
                      ios_backgroundColor="#e2e8f0"
                    />
                  </View>
                )}

                {activityItem.terminationHandoff && (
                  <View style={styles.toggleRequestRow}>
                    <Text style={[styles.toggleRequestLabel, { color: activityItem.terminationRequested ? '#8b5cf6' : '#64748b' }]}>
                      {activityItem.terminationRequested ? 'Termination Requested' : 'Request Termination'}
                    </Text>
                    <Switch
                      value={activityItem.terminationRequested}
                      onValueChange={(val) => handleToggleTerminationRequest(activityItem.id, val)}
                      trackColor={{ false: '#e2e8f0', true: '#8b5cf6' }}
                      thumbColor="#fff"
                      ios_backgroundColor="#e2e8f0"
                    />
                  </View>
                )}

                {!hasHandoff && ['mv-cable-laying', 'dc-cable-laying', 'lv-cable-laying'].includes(activityItem.id) && (
                  <View style={styles.toggleRequestRow}>
                    <View style={styles.toggleRequestTextContainer}>
                      <Text style={[styles.toggleRequestLabel, { color: handoverRequested[activityItem.id] ? '#8b5cf6' : '#64748b' }]}>
                        {handoverRequested[activityItem.id] ? '🔄 Handover Requested' : 'Request Handover'}
                      </Text>
                      {handoverRequested[activityItem.id] && (
                        <Text style={styles.toggleSubtext}>
                          Handover request sent to supervisor
                        </Text>
                      )}
                    </View>
                    <Switch
                      value={handoverRequested[activityItem.id] || false}
                      onValueChange={(val) => handleToggleHandoverRequest(activityItem.id, val)}
                      trackColor={{ false: '#e2e8f0', true: '#8b5cf6' }}
                      thumbColor="#fff"
                      ios_backgroundColor="#e2e8f0"
                    />
                  </View>
                )}

                {isExpanded && !hasHandoff && (
                  <View style={styles.expandedContent}>
                    {activityItem.moduleConfig?.baseBlockType === 'GRID_TYPE_ROW_PROGRESS' && activityItem.moduleConfig.gridConfig ? (
                      <View style={styles.gridSection}>
                        <Text style={styles.inputLabel}>Grid Progress Tracking:</Text>
                        <ActivityGridView
                          gridConfig={activityItem.moduleConfig.gridConfig}
                          activityId={activityItem.id}
                          activityName={activityItem.name}
                          taskId={taskId}
                          siteId={user?.siteId || ''}
                          supervisorId={user?.userId || ''}
                          supervisorName={user?.name || ''}
                          onCellPress={(cell) => console.log('Cell pressed:', cell)}
                        />
                      </View>
                    ) : (
                      <View style={styles.inputBlock}>
                        {(() => {
                          const isLocked = activityItem.completedTodayLock?.isLocked;
                          const qcStatus = activityItem.qcStatus;
                          const shouldShowLocked = isLocked || qcStatus === 'completed';
                        
                        console.log(`🔐 [LOCK CHECK] Activity: ${activityItem.id}`);
                        console.log(`   completedTodayLock.isLocked: ${isLocked}`);
                        console.log(`   qcStatus: ${qcStatus}`);
                        console.log(`   lockDate: ${activityItem.completedTodayLock?.lockDate}`);
                        console.log(`   TODAY: ${new Date().toISOString().split('T')[0]}`);
                        console.log(`   shouldShowLocked: ${shouldShowLocked} - Locked when completedTodayLock.isLocked=true OR qcStatus='completed'`);
                        
                        return shouldShowLocked;
                      })() ? (
                        <View style={styles.lockedCompactDisplay}>
                          <Text style={styles.lockedCompactText}>🔒 Input locked - QC completed for this activity</Text>
                        </View>
                      ) : (
                        <>
                          {activityItem.moduleConfig?.boqUnit && (
                            <View style={styles.boqUnitInfoBanner}>
                              <Text style={styles.boqUnitInfoText}>
                                📊 BOQ Unit: {activityItem.moduleConfig.boqUnit}
                                {activityItem.moduleConfig.boqQuantity && ` (${activityItem.moduleConfig.boqQuantity.toLocaleString()} ${activityItem.moduleConfig.boqUnit})`}
                              </Text>
                            </View>
                          )}
                          <View style={styles.completedTodayRow}>
                            <TextInput
                              key={`input-${taskId}-${activityItem.id}`}
                              style={[styles.inputField, styles.completedTodayInput]}
                              value={tempCompletedValues[`${taskId}-${activityItem.id}`] ?? ''}
                              onChangeText={(text) => {
                                const compositeKey = `${taskId}-${activityItem.id}`;
                                console.log(`[INPUT] Task ${taskId}, Activity ${activityItem.id} - Text changed:`, text);
                                setTempCompletedValues(prev => {
                                  const updated = { ...prev, [compositeKey]: text };
                                  console.log(`[INPUT] Updated tempCompletedValues for key ${compositeKey}:`, updated);
                                  return updated;
                                });
                              }}
                              keyboardType="numeric"
                              placeholder="0"
                              placeholderTextColor="#94a3b8"
                            />
                            {activityItem.moduleConfig?.boqUnit ? (
                              <View style={styles.unitDisplayBox}>
                                <Text style={styles.unitDisplayText}>{activityItem.moduleConfig.boqUnit}</Text>
                              </View>
                            ) : (
                              <TouchableOpacity
                                style={styles.unitSelectButton}
                                onPress={() => {
                                  setSelectedActivityForUnit(`${taskId}-${activityItem.id}`);
                                  setUnitModalVisible(true);
                                }}
                              >
                                <Text style={styles.unitSelectButtonText}>{tempCompletedUnits[`${taskId}-${activityItem.id}`] || activityItem.unit || 'm'}</Text>
                                <ChevronRight size={16} color="#4285F4" />
                              </TouchableOpacity>
                            )}
                          </View>
                          <TouchableOpacity
                            style={[styles.submitButtonFull, { backgroundColor: color }]}
                            onPress={async () => {
                              const compositeKey = `${taskId}-${activityItem.id}`;
                              const value = parseFloat(tempCompletedValues[compositeKey] || '0');
                              const unit = activityItem.moduleConfig?.boqUnit || tempCompletedUnits[compositeKey] || activityItem.unit || 'm';
                              console.log(`[SUBMIT] Submitting for key: ${compositeKey}, value: ${value}, unit: ${unit}`);
                              if (value && value > 0) {
                                const success = await handleSubmitCompletedToday(activityItem.id, value, unit);
                                if (success !== false) {
                                  console.log(`[SUBMIT] Success - clearing temp value for key: ${compositeKey}`);
                                  setTempCompletedValues(prev => ({ ...prev, [compositeKey]: '' }));
                                } else {
                                  console.log(`[SUBMIT] Failed - keeping temp value for key: ${compositeKey}`);
                                }
                              } else {
                                Alert.alert('Invalid Value', 'Please enter a valid number greater than 0');
                              }
                            }}
                          >
                            <Text style={styles.submitButtonText}>Submit</Text>
                          </TouchableOpacity>
                          {activityItem.completedToday > 0 && !tempCompletedValues[`${taskId}-${activityItem.id}`] && (
                            <View style={styles.currentProgressDisplay}>
                              <Text style={styles.currentProgressLabel}>Today&apos;s Submission:</Text>
                              <View style={styles.submissionValueRow}>
                                <Text style={styles.currentProgressValue}>
                                  {activityItem.completedToday} {activityItem.completedTodayUnit || activityItem.unit}
                                </Text>
                                <TouchableOpacity 
                                  style={styles.editButton}
                                  onPress={() => {
                                    const compositeKey = `${taskId}-${activityItem.id}`;
                                    console.log('✏️ [EDIT MODE] Setting edit mode for:', compositeKey);
                                    console.log('   Current value:', activityItem.completedToday);
                                    setTempCompletedValues(prev => ({ ...prev, [compositeKey]: String(activityItem.completedToday) }));
                                    if (!activityItem.moduleConfig?.boqUnit) {
                                      setTempCompletedUnits(prev => ({ ...prev, [compositeKey]: (activityItem.completedTodayUnit as Unit) || (activityItem.unit as Unit) || 'm' }));
                                    }
                                  }}
                                >
                                  <Text style={styles.editButtonText}>Edit</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          )}
                        </>
                      )}
                      </View>
                    )}

                    <View style={styles.inputBlock}>
                      <Text style={styles.inputLabel}>Target Tomorrow:</Text>
                      <TextInput
                        key={`target-${taskId}-${activityItem.id}`}
                        style={styles.inputField}
                        value={tempTargetTomorrowValues[`${taskId}-${activityItem.id}`] ?? (activityItem.targetTomorrow > 0 ? String(activityItem.targetTomorrow) : '')}
                        onChangeText={(val) => {
                          const compositeKey = `${taskId}-${activityItem.id}`;
                          setTempTargetTomorrowValues(prev => ({ ...prev, [compositeKey]: val }));
                          updateActivityValue(activityItem.id, 'targetTomorrow', val);
                        }}
                        keyboardType="numeric"
                        placeholder={`Enter value in ${activityItem.unit || 'm'}`}
                        placeholderTextColor="#94a3b8"
                      />
                    </View>
                    <View style={styles.inputBlock}>
                      <View style={styles.diaryHeaderRow}>
                        <Text style={styles.inputLabel}>Daily Diary:</Text>
                        <TouchableOpacity
                          style={styles.priorityCheckbox}
                          onPress={() => handleToggleDiaryPriority(activityItem.id, !activityItem.diaryPriority)}
                          activeOpacity={0.7}
                        >
                          <View style={[
                            styles.checkbox,
                            activityItem.diaryPriority && styles.checkboxActive,
                            activityItem.diaryPriority && { backgroundColor: '#ef4444', borderColor: '#ef4444' }
                          ]}>
                            {activityItem.diaryPriority && (
                              <AlertCircle size={14} color="#fff" />
                            )}
                          </View>
                          <Text style={[
                            styles.priorityLabel,
                            activityItem.diaryPriority && { color: '#ef4444', fontWeight: '600' as const }
                          ]}>
                            Mark as Urgent
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <TextInput
                        style={[styles.inputField, styles.textArea]}
                        value={activityItem.notes}
                        onChangeText={(val) => updateActivityValue(activityItem.id, 'notes', val)}
                        placeholder="Add notes for yourself..."
                        placeholderTextColor="#94a3b8"
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                      />
                      {activityItem.notes && activityItem.notes.trim() !== '' && (
                        <TouchableOpacity
                          style={styles.submitDiaryButton}
                          onPress={() => handleSubmitToDiary(activityItem.id)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.submitDiaryButtonText}>Submit to Diary</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    {activityItem.updatedAt && (
                      <Text style={styles.timestamp}>Updated {activityItem.updatedAt}</Text>
                    )}

                    {!hasHandoff && isMicroModuleEnabled(activityItem.moduleConfig, 'QC_REQUEST') && getMicroModulePlacement(activityItem.moduleConfig, 'QC_REQUEST') === 'inside' && (
                      <View style={styles.toggleRequestRow}>
                        <View style={styles.toggleRequestTextContainer}>
                          <Text style={[styles.toggleRequestLabel, { color: activityItem.qcRequested || ['pending', 'scheduled', 'in_progress'].includes(activityItem.qcStatus || '') ? '#ec4899' : '#94a3b8' }]}>
                            {activityItem.qcStatus === 'scheduled' ? '📅 QC Scheduled' : 
                             activityItem.qcStatus === 'pending' ? '⏳ QC Pending' :
                             activityItem.qcStatus === 'in_progress' ? '🔄 QC In Progress' :
                             activityItem.qcStatus === 'completed' ? '✅ QC Completed' :
                             activityItem.qcRequested ? '✓ QC Requested' : 'Request QC'}
                          </Text>
                          {['pending', 'scheduled', 'in_progress'].includes(activityItem.qcStatus || '') && (
                            <Text style={styles.toggleSubtext}>
                              Toggle locked until inspection complete
                            </Text>
                          )}
                        </View>
                        <View pointerEvents={['pending', 'scheduled', 'in_progress'].includes(activityItem.qcStatus || '') ? 'none' : 'auto'}>
                          <Switch
                            value={activityItem.qcRequested || ['pending', 'scheduled', 'in_progress'].includes(activityItem.qcStatus || '')}
                            onValueChange={(val) => handleToggleQCRequest(activityItem.id, val)}
                            disabled={['pending', 'scheduled', 'in_progress'].includes(activityItem.qcStatus || '')}
                            trackColor={{ false: '#e2e8f0', true: '#ec4899' }}
                            thumbColor="#fff"
                            ios_backgroundColor="#e2e8f0"
                          />
                        </View>
                      </View>
                    )}

                    {!hasHandoff && (activityItem.scopeApproved || activityItem.qcValue > 0) && (
                      <View style={styles.valuesBlock}>
                        <View style={styles.progressSectionHeader}>
                          <Text style={styles.progressSectionTitle}>Local Scope</Text>
                        </View>
                        <View style={styles.valueRow}>
                          <Text style={styles.valueLabel}>QC Value Input:</Text>
                          <Text style={styles.valueAmount}>{activityItem.qcValue} {activityItem.unit}</Text>
                        </View>
                        <View style={styles.valueRow}>
                          <Text style={styles.valueLabel}>Scope Value Input:</Text>
                          <Text style={styles.valueAmount}>{activityItem.scopeValue} {activityItem.unit}</Text>
                        </View>
                        <View style={styles.valueRow}>
                          <Text style={styles.valueLabel}>% Completed (QC Verified):</Text>
                          <Text style={styles.valueAmount}>{percentage}%</Text>
                        </View>
                        <View style={styles.valueRow}>
                          <Text style={styles.valueLabel}>% Completed (Unverified):</Text>
                          <Text style={styles.valueAmount}>
                            {(() => {
                              if (!activityItem.scopeApproved || activityItem.scopeValue === 0) return '—';
                              const inputValue = activityItem.completedToday || 0;
                              return ((inputValue / activityItem.scopeValue) * 100).toFixed(2) + '%';
                            })()}
                          </Text>
                        </View>
                      </View>
                    )}

                    {!hasHandoff && (
                      <View style={styles.historyScrollContainer}>
                        <View style={styles.historyHeaderRow}>
                          <Text style={styles.historyTitle}>Last 7 Days</Text>
                          <TouchableOpacity
                            style={styles.archiveButton}
                            onPress={async () => {
                              console.log('📂 Opening archive for activity:', activityItem.id);
                              setArchiveModalVisible(prev => ({ ...prev, [activityItem.id]: true }));
                              
                              const activitiesRef = collection(db, 'activities');
                              const q = query(
                                activitiesRef,
                                where('taskId', '==', taskId),
                                where('activityId', '==', activityItem.id)
                              );
                              const snapshot = await getDocs(q);
                              
                              if (!snapshot.empty) {
                                const activityDocId = snapshot.docs[0].id;
                                const historyRef = collection(db, 'activities', activityDocId, 'history');
                                const historySnapshot = await getDocs(historyRef);
                                
                                const allHistory: DayHistory[] = [];
                                historySnapshot.docs.forEach((historyDoc) => {
                                  const data = historyDoc.data();
                                  allHistory.push({
                                    date: data.date || historyDoc.id,
                                    completedValue: data.completedValue || 0,
                                    unit: data.unit || activityItem.unit,
                                    percentage: data.percentage || '—',
                                    scopeValue: data.scopeValue || 0,
                                    scopeApproved: data.scopeApproved || false,
                                    qcStatus: data.qcStatus,
                                    materialToggle: data.materialToggle,
                                    plantToggle: data.plantToggle,
                                    workersToggle: data.workersToggle,
                                  });
                                });
                                
                                allHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                                
                                const monthsMap = new Map<string, { month: string; year: string; label: string }>();
                                allHistory.forEach((entry) => {
                                  const date = new Date(entry.date);
                                  const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                                  if (!monthsMap.has(monthKey)) {
                                    monthsMap.set(monthKey, {
                                      month: String(date.getMonth() + 1).padStart(2, '0'),
                                      year: String(date.getFullYear()),
                                      label: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
                                    });
                                  }
                                });
                                
                                const months = Array.from(monthsMap.values()).sort((a, b) => {
                                  const dateA = new Date(`${a.year}-${a.month}-01`);
                                  const dateB = new Date(`${b.year}-${b.month}-01`);
                                  return dateB.getTime() - dateA.getTime();
                                });
                                
                                console.log('📅 Found', months.length, 'archived months for activity:', activityItem.id);
                                setArchivedMonths(prev => ({ ...prev, [activityItem.id]: months }));
                              }
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.archiveButtonText}>Archive</Text>
                          </TouchableOpacity>
                        </View>
                        <FlatList
                          horizontal
                          data={activityHistory[activityItem.id]}
                          keyExtractor={(item) => item.date}
                          showsHorizontalScrollIndicator={false}
                          renderItem={({ item }) => (
                            <View style={styles.historyCard}>
                              <Text style={styles.historyDate}>{new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                              <View style={styles.historyValueRow}>
                                <Text style={styles.historyLabel}>Completed:</Text>
                                <Text style={styles.historyValue}>{item.completedValue} {item.unit}</Text>
                              </View>
                              <View style={styles.historyValueRow}>
                                <Text style={styles.historyLabel}>% Done:</Text>
                                <Text style={styles.historyPercentage}>{item.percentage}%</Text>
                              </View>
                              {(item.qcStatus || item.materialToggle !== undefined || item.plantToggle !== undefined || item.workersToggle !== undefined) && (
                                <View style={styles.historyTogglesSection}>
                                  <Text style={styles.historyTogglesTitle}>Status:</Text>
                                  {item.qcStatus && (
                                    <View style={styles.historyToggleRow}>
                                      <Text style={styles.historyToggleLabel}>QC: {item.qcStatus === 'completed' ? '✅' : '⏳'}</Text>
                                    </View>
                                  )}
                                  {item.materialToggle !== undefined && (
                                    <View style={styles.historyToggleRow}>
                                      <Text style={styles.historyToggleLabel}>Material: {item.materialToggle ? '✅' : '❌'}</Text>
                                    </View>
                                  )}
                                  {item.plantToggle !== undefined && (
                                    <View style={styles.historyToggleRow}>
                                      <Text style={styles.historyToggleLabel}>Plant: {item.plantToggle ? '✅' : '❌'}</Text>
                                    </View>
                                  )}
                                  {item.workersToggle !== undefined && (
                                    <View style={styles.historyToggleRow}>
                                      <Text style={styles.historyToggleLabel}>Workers: {item.workersToggle ? '✅' : '❌'}</Text>
                                    </View>
                                  )}
                                </View>
                              )}
                            </View>
                          )}
                          contentContainerStyle={styles.historyScrollContent}
                        />
                      </View>
                    )}


                  </View>
                )}

                {isExpanded && isHandoff && hasHandoff && (
                  <View style={styles.expandedContent}>
                    <View style={styles.handoffInfoBlock}>
                      <Text style={styles.handoffInfoTitle}>
                        This activity is managed in {targetModuleNames[
                          (activityItem.cablingHandoff?.targetModule || activityItem.terminationHandoff?.targetModule)!
                        ]} module
                      </Text>
                      <Text style={styles.handoffInfoText}>
                        Progress tracking and scope values are handled in the {activityItem.terminationHandoff ? 'Termination' : 'Cabling'} section.
                      </Text>
                      <TouchableOpacity 
                        style={[styles.viewCablingButton, { backgroundColor: '#8b5cf6' }]}
                        onPress={() => {
                          const targetModule = activityItem.cablingHandoff?.targetModule || activityItem.terminationHandoff?.targetModule;
                          console.log('Navigate to module:', targetModule);
                        }}
                      >
                        <Link2 size={16} color="#fff" />
                        <Text style={styles.viewCablingButtonText}>View in {activityItem.terminationHandoff ? 'Termination' : 'Cabling'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                </View>
                
                {isMicroModuleEnabled(activityItem.moduleConfig, 'HANDOVER_CARDS') && 
                 getMicroModulePlacement(activityItem.moduleConfig, 'HANDOVER_CARDS') === 'between' && (
                  <View style={styles.handoverCardContainer}>
                    <View style={styles.handoverCardContent}>
                      <View style={styles.handoverCardHeader}>
                        <Text style={styles.handoverCardTitle}>Cross Teams Handover Cards</Text>
                        <Text style={styles.handoverCardSubtitle}>
                          {handoverRequested[activityItem.id] 
                            ? 'Handover request sent' 
                            : 'Hand over this task to another supervisor'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.handoverToggle,
                          handoverRequested[activityItem.id] && styles.handoverToggleActive,
                        ]}
                        onPress={() => handleToggleHandoverRequest(activityItem.id, !handoverRequested[activityItem.id])}
                        activeOpacity={0.8}
                      >
                        <View
                          style={[
                            styles.handoverToggleThumb,
                            handoverRequested[activityItem.id] && styles.handoverToggleThumbActive,
                          ]}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </React.Fragment>
            );
          })}
        </View>


      </ScrollView>

      <Modal visible={scopeModalVisible} transparent animationType="fade" onRequestClose={() => setScopeModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Request Scope</Text>
            <Text style={styles.modalSubtitle}>Optional note to Planner</Text>
            <TextInput
              style={[styles.inputField, styles.textArea]}
              value={scopeRequestNote}
              onChangeText={setScopeRequestNote}
              placeholder="Add context or constraints..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setScopeModalVisible(false)} style={[styles.modalButton, { backgroundColor: '#e2e8f0' }]} activeOpacity={0.8}>
                <Text style={[styles.modalButtonText, { color: '#0f172a' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  setScopeModalVisible(false);
                }}
                style={[styles.modalButton, { backgroundColor: color }]}
                activeOpacity={0.8}
              >
                <Text style={styles.modalButtonText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <UnitSelectorModal
        visible={unitModalVisible}
        onClose={() => setUnitModalVisible(false)}
        onSelect={(unit) => {
          if (selectedActivityForUnit) {
            setTempCompletedUnits(prev => ({ ...prev, [selectedActivityForUnit]: unit }));
          }
          setUnitModalVisible(false);
        }}
        currentUnit={(() => {
          if (!selectedActivityForUnit) return 'm';
          if (tempCompletedUnits[selectedActivityForUnit]) return tempCompletedUnits[selectedActivityForUnit];
          
          const activityId = selectedActivityForUnit.split('-').pop();
          const activity = activities.find(a => a.id === activityId);
          return (activity?.unit || 'm') as Unit;
        })()}
        title="Select Unit"
      />
      
      <HandoverCard
        visible={handoverModalVisible}
        onClose={() => {
          setHandoverModalVisible(false);
          setSelectedActivityForHandover(null);
          setMatchingSupervisors([]);
        }}
        onSelectSupervisor={handleSendHandoverRequest}
        matchingSupervisors={matchingSupervisors}
        isLoading={isLoadingSupervisors}
        activityName={selectedActivityForHandover ? activities.find(a => a.id === selectedActivityForHandover)?.name || '' : ''}
        pvArea={pvArea}
        blockNumber={blockArea}
      />
      
      <UnitSelectorModal
        visible={concreteUnitModalVisible}
        onClose={() => setConcreteUnitModalVisible(false)}
        onSelect={(unit) => {
          setConcreteUnit(unit);
          setConcreteUnitModalVisible(false);
        }}
        currentUnit={concreteUnit}
        title="Select Unit for Concrete"
      />
      
      <PlantRequestModal
        visible={plantModalVisible}
        onClose={() => setPlantModalVisible(false)}
        onSubmit={async (entries) => {
          console.log('[SupervisorTaskDetail] Plant request submitted:', entries);
          
          try {
            for (const entry of entries) {
              const requestData = {
                type: 'PLANT_ALLOCATION_REQUEST',
                status: 'PENDING',
                siteId: user?.siteId || '',
                masterAccountId: user?.masterAccountId || '',
                requestedBy: user?.userId || '',
                requestedByName: user?.name || '',
                supervisorId: user?.userId || '',
                supervisorName: user?.name || '',
                taskId: taskId,
                activityId: '',
                plantType: entry.plantType,
                quantity: parseInt(entry.quantity, 10),
                purpose: `Plant request for ${name || activity}`,
                duration: 'As needed',
                pvArea: pvArea || '',
                blockArea: blockArea || '',
                archived: false,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              };

              console.log('[SupervisorTaskDetail] Creating plant request with data:', requestData);

              const netInfo = await NetInfo.fetch();
              if (!netInfo.isConnected) {
                console.log('[SupervisorTaskDetail] Offline - queueing plant request');
                await queueFirestoreOperation(
                  { type: 'add', collection: 'requests', data: requestData },
                  { priority: 'P0', entityType: 'activityRequest' }
                );
              } else {
                const docRef = await addDoc(collection(db, 'requests'), requestData);
                console.log('[SupervisorTaskDetail] ✅ Plant request created with ID:', docRef.id);
              }
            }

            Alert.alert(
              'Request Submitted',
              `Plant request with ${entries.length} item(s) has been submitted successfully.`,
              [
                {
                  text: 'OK',
                  onPress: () => setPlantModalVisible(false),
                },
              ]
            );
          } catch (error) {
            console.error('[SupervisorTaskDetail] ❌ Error creating plant request:', error);
            Alert.alert(
              'Error',
              'Failed to submit plant request. Please try again.',
              [{ text: 'OK' }]
            );
          }
        }}
        masterAccountId={user?.masterAccountId || ''}
        siteId={user?.siteId || ''}
      />
      
      <StaffRequestModal
        visible={staffModalVisible}
        onClose={() => setStaffModalVisible(false)}
        onSubmit={async (entries) => {
          console.log('[SupervisorTaskDetail] Staff request submitted:', entries);
          
          try {
            for (const entry of entries) {
              const requestData = {
                type: 'STAFF_REQUEST',
                status: 'PENDING',
                siteId: user?.siteId || '',
                masterAccountId: user?.masterAccountId || '',
                requestedBy: user?.userId || '',
                requestedByName: user?.name || '',
                supervisorId: user?.userId || '',
                supervisorName: user?.name || '',
                taskId: taskId,
                activityId: '',
                employeeType: entry.employeeType,
                quantity: parseInt(entry.quantity, 10),
                purpose: `Staff request for ${name || activity}`,
                duration: 'As needed',
                pvArea: pvArea || '',
                blockArea: blockArea || '',
                archived: false,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              };

              console.log('[SupervisorTaskDetail] Creating staff request with data:', requestData);

              const netInfo = await NetInfo.fetch();
              if (!netInfo.isConnected) {
                console.log('[SupervisorTaskDetail] Offline - queueing staff request');
                await queueFirestoreOperation(
                  { type: 'add', collection: 'requests', data: requestData },
                  { priority: 'P0', entityType: 'activityRequest' }
                );
              } else {
                const docRef = await addDoc(collection(db, 'requests'), requestData);
                console.log('[SupervisorTaskDetail] ✅ Staff request created with ID:', docRef.id);
              }
            }

            Alert.alert(
              'Request Submitted',
              `Staff request with ${entries.length} item(s) has been submitted successfully.`,
              [
                {
                  text: 'OK',
                  onPress: () => setStaffModalVisible(false),
                },
              ]
            );
          } catch (error) {
            console.error('[SupervisorTaskDetail] ❌ Error creating staff request:', error);
            Alert.alert(
              'Error',
              'Failed to submit staff request. Please try again.',
              [{ text: 'OK' }]
            );
          }
        }}
        masterAccountId={user?.masterAccountId || ''}
        siteId={user?.siteId || ''}
      />
      
      {activities.filter(act => !act.drillingHandoff).map((activityItem) => (
        <Modal
          key={`archive-${activityItem.id}`}
          visible={archiveModalVisible[activityItem.id] || false}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setArchiveModalVisible(prev => ({ ...prev, [activityItem.id]: false }));
            setSelectedArchivedMonth(prev => ({ ...prev, [activityItem.id]: null }));
          }}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.archiveModalCard}>
              <View style={styles.archiveModalHeader}>
                <Text style={styles.archiveModalTitle}>
                  {selectedArchivedMonth[activityItem.id] 
                    ? archivedMonths[activityItem.id]?.find(m => `${m.year}-${m.month}` === selectedArchivedMonth[activityItem.id])?.label || 'Archive'
                    : 'Select Month'}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setArchiveModalVisible(prev => ({ ...prev, [activityItem.id]: false }));
                    setSelectedArchivedMonth(prev => ({ ...prev, [activityItem.id]: null }));
                  }}
                  style={styles.closeButton}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
              
              {!selectedArchivedMonth[activityItem.id] ? (
                <ScrollView style={styles.monthsScrollView}>
                  {archivedMonths[activityItem.id]?.length > 0 ? (
                    archivedMonths[activityItem.id].map((monthData) => (
                      <TouchableOpacity
                        key={`${monthData.year}-${monthData.month}`}
                        style={styles.monthButton}
                        onPress={async () => {
                          const monthKey = `${monthData.year}-${monthData.month}`;
                          console.log('📅 Loading archive for month:', monthKey);
                          setSelectedArchivedMonth(prev => ({ ...prev, [activityItem.id]: monthKey }));
                          
                          const activitiesRef = collection(db, 'activities');
                          const q = query(
                            activitiesRef,
                            where('taskId', '==', taskId),
                            where('activityId', '==', activityItem.id)
                          );
                          const snapshot = await getDocs(q);
                          
                          if (!snapshot.empty) {
                            const activityDocId = snapshot.docs[0].id;
                            const historyRef = collection(db, 'activities', activityDocId, 'history');
                            const historySnapshot = await getDocs(historyRef);
                            
                            const monthHistory: DayHistory[] = [];
                            historySnapshot.docs.forEach((historyDoc) => {
                              const data = historyDoc.data();
                              const entryDate = new Date(data.date || historyDoc.id);
                              const entryMonthKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`;
                              
                              if (entryMonthKey === monthKey) {
                                monthHistory.push({
                                  date: data.date || historyDoc.id,
                                  completedValue: data.completedValue || 0,
                                  unit: data.unit || activityItem.unit,
                                  percentage: data.percentage || '—',
                                  scopeValue: data.scopeValue || 0,
                                  scopeApproved: data.scopeApproved || false,
                                  qcStatus: data.qcStatus,
                                  materialToggle: data.materialToggle,
                                  plantToggle: data.plantToggle,
                                  workersToggle: data.workersToggle,
                                });
                              }
                            });
                            
                            monthHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                            console.log('📊 Loaded', monthHistory.length, 'entries for month:', monthKey);
                            setArchivedHistory(prev => ({ ...prev, [activityItem.id]: monthHistory }));
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.monthButtonText}>{monthData.label}</Text>
                        <ChevronRight size={20} color="#4285F4" />
                      </TouchableOpacity>
                    ))
                  ) : (
                    <Text style={styles.noArchiveText}>No archived history available</Text>
                  )}
                </ScrollView>
              ) : (
                <View>
                  <TouchableOpacity
                    style={styles.backToMonthsButton}
                    onPress={() => setSelectedArchivedMonth(prev => ({ ...prev, [activityItem.id]: null }))}
                    activeOpacity={0.7}
                  >
                    <ChevronLeft size={18} color="#4285F4" />
                    <Text style={styles.backToMonthsText}>Back to Months</Text>
                  </TouchableOpacity>
                  
                  <FlatList
                    data={archivedHistory[activityItem.id] || []}
                    keyExtractor={(item) => item.date}
                    showsVerticalScrollIndicator={true}
                    style={styles.archivedHistoryList}
                    renderItem={({ item }) => (
                      <View style={styles.archivedHistoryCard}>
                        <Text style={styles.archivedHistoryDate}>
                          {new Date(item.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </Text>
                        <View style={styles.archivedHistoryRow}>
                          <View style={styles.archivedHistoryValueRow}>
                            <Text style={styles.historyLabel}>Completed:</Text>
                            <Text style={styles.historyValue}>{item.completedValue} {item.unit}</Text>
                          </View>
                          <View style={styles.archivedHistoryValueRow}>
                            <Text style={styles.historyLabel}>% Done:</Text>
                            <Text style={styles.historyPercentage}>{item.percentage}%</Text>
                          </View>
                        </View>
                        {(item.qcStatus || item.materialToggle !== undefined || item.plantToggle !== undefined || item.workersToggle !== undefined) && (
                          <View style={styles.historyTogglesSection}>
                            <Text style={styles.historyTogglesTitle}>Status:</Text>
                            {item.qcStatus && (
                              <View style={styles.historyToggleRow}>
                                <Text style={styles.historyToggleLabel}>QC: {item.qcStatus === 'completed' ? '✅' : '⏳'}</Text>
                              </View>
                            )}
                            {item.materialToggle !== undefined && (
                              <View style={styles.historyToggleRow}>
                                <Text style={styles.historyToggleLabel}>Material: {item.materialToggle ? '✅' : '❌'}</Text>
                              </View>
                            )}
                            {item.plantToggle !== undefined && (
                              <View style={styles.historyToggleRow}>
                                <Text style={styles.historyToggleLabel}>Plant: {item.plantToggle ? '✅' : '❌'}</Text>
                              </View>
                            )}
                            {item.workersToggle !== undefined && (
                              <View style={styles.historyToggleRow}>
                                <Text style={styles.historyToggleLabel}>Workers: {item.workersToggle ? '✅' : '❌'}</Text>
                              </View>
                            )}
                          </View>
                        )}
                      </View>
                    )}
                  />
                </View>
              )}
            </View>
          </View>
        </Modal>
      ))}
      
      <MaterialsRequestModal
        visible={materialsModalVisible}
        onClose={() => setMaterialsModalVisible(false)}
        onSubmit={async (entries) => {
          console.log('[SupervisorTaskDetail] Materials request submitted:', entries);
          
          try {
            for (const entry of entries) {
              const requestData = {
                type: 'MATERIALS_REQUEST',
                status: 'PENDING',
                siteId: user?.siteId || '',
                masterAccountId: user?.masterAccountId || '',
                requestedBy: user?.userId || '',
                requestedByName: user?.name || '',
                supervisorId: user?.userId || '',
                supervisorName: user?.name || '',
                taskId: taskId,
                activityId: '',
                materialName: entry.materialName,
                quantity: parseFloat(entry.quantity),
                unit: entry.unit,
                purpose: `Materials request for ${name || activity}`,
                pvArea: pvArea || '',
                blockArea: blockArea || '',
                archived: false,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              };

              console.log('[SupervisorTaskDetail] Creating materials request with data:', requestData);

              const netInfo = await NetInfo.fetch();
              if (!netInfo.isConnected) {
                console.log('[SupervisorTaskDetail] Offline - queueing materials request');
                await queueFirestoreOperation(
                  { type: 'add', collection: 'requests', data: requestData },
                  { priority: 'P0', entityType: 'activityRequest' }
                );
              } else {
                const docRef = await addDoc(collection(db, 'requests'), requestData);
                console.log('[SupervisorTaskDetail] ✅ Materials request created with ID:', docRef.id);
              }
            }

            Alert.alert(
              'Request Submitted',
              `Materials request with ${entries.length} item(s) has been submitted successfully.`,
              [
                {
                  text: 'OK',
                  onPress: () => setMaterialsModalVisible(false),
                },
              ]
            );
          } catch (error) {
            console.error('[SupervisorTaskDetail] ❌ Error creating materials request:', error);
            Alert.alert(
              'Error',
              'Failed to submit materials request. Please try again.',
              [{ text: 'OK' }]
            );
          }
        }}
        masterAccountId={user?.masterAccountId || ''}
        siteId={user?.siteId || ''}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  headerCard: {
    backgroundColor: '#000',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerLeftContent: {
    flex: 1,
  },
  siteName: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#9CA3AF',
    letterSpacing: 0.8,
    marginBottom: 8,
    textTransform: 'uppercase' as const,
  },
  carouselNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  carouselButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselButtonDisabled: {
    opacity: 0.4,
  },
  carouselText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#fff',
    letterSpacing: 0.3,
  },

  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 8,
  },
  addTaskButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  savingIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 12,
  },
  savingText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600' as const,
  },
  scrollView: {
    flex: 1,
  },
  topBlock: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  compactInfoCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  taskDetailsHeader: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  taskDetailsTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  taskTitleAndDetailsColumn: {
    flex: 1,
    marginRight: 12,
  },
  compactTaskDetails: {
    marginTop: 6,
    gap: 2,
  },
  compactDetailRow: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#9CA3AF',
  },
  totalTaskProgressBox: {
    alignItems: 'flex-end',
  },
  totalTaskProgressLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: '#9CA3AF',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  progressPercentagesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  verifiedPercentageBox: {
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  unverifiedPercentageBox: {
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  progressPercentageLabel: {
    fontSize: 9,
    fontWeight: '600' as const,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  verifiedProgressValue: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: '#34A853',
  },
  unverifiedProgressValue: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: '#FBBC04',
  },
  totalTaskProgressValue: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#3b82f6',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#9CA3AF',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#4285F4',
  },
  infoValueInline: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#4285F4',
  },
  expandNotesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  expandNotesText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#4285F4',
  },
  notesExpandedSection: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  notesContent: {
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: '#5f6368',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  fieldRow: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: '#5f6368',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dadce0',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#202124',
  },
  readOnlyInput: {
    backgroundColor: '#f8f9fa',
    color: '#5f6368',
  },
  textArea: {
    minHeight: 60,
    paddingTop: 10,
  },
  activitiesSection: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  surveyorRequestSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#e8eaed',
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activityName: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: '#202124',
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },
  unitChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#FFFAE6',
    borderWidth: 1,
    borderColor: '#F5D90A',
    marginLeft: 8,
  },
  unitChipText: {
    color: '#7A5B00',
    fontWeight: '700' as const,
    fontSize: 11,
  },
  scopePendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  scopePendingText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#f59e0b',
    flex: 1,
  },
  handoffBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ede9fe',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  handoffText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#8b5cf6',
    flex: 1,
  },
  activitySummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  percentageText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#f59e0b',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  expandedContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  valuesBlock: {
    backgroundColor: '#E8EAED',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  progressSectionHeader: {
    marginTop: 4,
    marginBottom: 8,
  },
  progressSectionTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#64748b',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  progressSectionDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 12,
  },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  valueLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#0c4a6e',
  },
  valueAmount: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#0c4a6e',
  },
  scopeAndProgressBlock: {
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    marginTop: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#0ea5e9',
  },
  scopeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scopeLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#0c4a6e',
  },
  scopeValue: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#0369a1',
  },
  inputBlock: {
    marginBottom: 16,
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#202124',
  },
  unitBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  unitBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#92400e',
  },
  inputField: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dadce0',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#202124',
  },
  lockedInputField: {
    backgroundColor: '#f1f5f9',
    borderColor: '#fbbf24',
    borderWidth: 2,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  lockedInputText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#92400e',
    textAlign: 'center',
  },
  inputWithButton: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'stretch',
  },
  addButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 70,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  currentProgressDisplay: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f0f9ff',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#0ea5e9',
  },
  currentProgressLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#0c4a6e',
  },
  currentProgressValue: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#0369a1',
  },
  submissionValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  editButton: {
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  permanentProgressCard: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#10b981',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressCardLabel: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#065f46',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  progressCardValue: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: '#059669',
  },
  progressBarContainerCard: {
    height: 12,
    backgroundColor: '#d1fae5',
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#6ee7b7',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  progressBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  progressBarLabelText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#047857',
  },
  noScopeIndicator: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  noScopeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#92400e',
    textAlign: 'center',
  },
  qcCompletedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  qcCompletedText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#065f46',
    flex: 1,
  },
  timestamp: {
    fontSize: 11,
    color: '#5f6368',
    marginTop: 12,
    textAlign: 'right',
  },
  lockedHeader: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  lockedSiteName: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: '#fff',
    letterSpacing: 0.3,
  },

  lockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  lockedTitle: {
    fontSize: 22,
    fontWeight: '500' as const,
    color: '#202124',
    marginTop: 24,
  },
  lockedMessage: {
    fontSize: 15,
    color: '#5f6368',
    marginTop: 8,
    marginBottom: 32,
  },
  headerRightPlaceholder: {
    width: 20,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 8,
    minWidth: 240,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#dadce0',
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#202124',
    marginRight: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  toggleRequestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
  },
  toggleRequestLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    letterSpacing: 0.3,
  },
  toggleSubtext: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
    fontWeight: '400' as const,
  },
  handoffInfoBlock: {
    backgroundColor: '#faf5ff',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9d5ff',
  },
  handoffInfoTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#7c3aed',
    marginBottom: 8,
  },
  handoffInfoText: {
    fontSize: 13,
    color: '#6b21a8',
    marginBottom: 12,
    lineHeight: 18,
  },
  viewCablingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  viewCablingButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  requestButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  requestButtonText: {
    color: '#fff',
    fontWeight: '700' as const,
    fontSize: 13,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    marginBottom: 8,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 12,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: '700' as const,
  },
  debugPanel: {
    marginTop: 24,
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
    width: '100%',
    maxWidth: 320,
  },
  debugPanelOpen: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 8,
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#fbbf24',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#e2e8f0',
    marginBottom: 4,
  },
  canonicalUnitBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  canonicalUnitText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#1e40af',
  },
  unitSelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#e3f2fd',
    borderWidth: 1,
    borderColor: '#4285F4',
  },
  unitSelectorButtonText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#4285F4',
  },
  unitSelectorButtonTextDisabled: {
    color: '#94a3b8',
  },
  readOnlyProgressField: {
    backgroundColor: '#f1f5f9',
    justifyContent: 'center' as const,
  },
  readOnlyProgressText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#1e293b',
  },
  noUnitBadge: {
    backgroundColor: '#fff3cd',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  noUnitText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#856404',
  },
  helperText: {
    fontSize: 11,
    color: '#f59e0b',
    marginTop: 6,
    fontStyle: 'italic' as const,
  },
  toggleRequestTextContainer: {
    flex: 1,
  },
  completedTodayRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'stretch',
  },
  completedTodayInput: {
    flex: 1,
  },
  gridSection: {
    marginBottom: 16,
  },
  unitSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: '#e3f2fd',
    borderWidth: 1,
    borderColor: '#4285F4',
    minWidth: 70,
    justifyContent: 'center',
  },
  unitSelectButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#4285F4',
  },
  unitDisplayBox: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: '#e8f5e9',
    borderWidth: 1,
    borderColor: '#34A853',
    minWidth: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unitDisplayText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#34A853',
  },
  boqUnitInfoBanner: {
    backgroundColor: '#e8f5e9',
    borderLeftWidth: 4,
    borderLeftColor: '#34A853',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  boqUnitInfoText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#1b5e20',
    lineHeight: 16,
  },
  addMetricButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 70,
  },
  addMetricButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  submitButtonFull: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  lockedValueDisplay: {
    backgroundColor: '#fff3cd',
    borderWidth: 2,
    borderColor: '#fbbf24',
    borderRadius: 8,
    padding: 16,
  },
  lockedValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  lockedValueLabel: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#92400e',
  },
  lockedValue: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: '#92400e',
  },
  lockedInfoText: {
    fontSize: 12,
    color: '#92400e',
    lineHeight: 18,
    fontStyle: 'italic' as const,
  },
  historyScrollContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  historyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#202124',
  },
  archiveButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#e3f2fd',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#4285F4',
  },
  archiveButtonText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#4285F4',
  },
  historyScrollContent: {
    paddingRight: 16,
  },
  historyCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginRight: 12,
    minWidth: 160,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  historyDate: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#4285F4',
    marginBottom: 8,
    textAlign: 'center',
  },
  historyValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  historyLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: '#64748b',
  },
  historyValue: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#0f172a',
  },
  historyPercentage: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#059669',
  },
  historyTogglesSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  historyTogglesTitle: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: '#64748b',
    marginBottom: 4,
  },
  historyToggleRow: {
    marginBottom: 2,
  },
  historyToggleLabel: {
    fontSize: 10,
    fontWeight: '500' as const,
    color: '#475569',
  },
  totalProgressCard: {
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalProgressLabel: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#1e40af',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  totalProgressValue: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: '#3b82f6',
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  noHandoffText: {
    fontSize: 14,
    color: '#64748b',
    fontStyle: 'italic' as const,
    textAlign: 'center',
    paddingVertical: 20,
  },
  concreteRequestCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 2,
    borderColor: '#f97316',
  },
  concreteRequestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  concreteRequestTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#f97316',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  concreteQuantityInputBlock: {
    marginTop: 16,
    marginBottom: 12,
  },
  concreteQuantityLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#64748b',
    marginBottom: 6,
  },
  concreteQuantityInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#f97316',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#202124',
  },
  quantityInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'stretch',
  },
  handoverCardContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 2,
    borderColor: '#8b5cf6',
  },
  handoverCardHeader: {
    marginBottom: 12,
  },
  handoverCardTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#8b5cf6',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  handoverCardSubtitle: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  handoverRequestButton: {
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderColor: '#8b5cf6',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  handoverRequestButtonActive: {
    backgroundColor: '#ede9fe',
  },
  handoverRequestButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#8b5cf6',
    letterSpacing: 0.3,
  },
  handoverRequestButtonSubtext: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '500' as const,
  },
  handoverCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  handoverToggle: {
    width: 51,
    height: 31,
    borderRadius: 16,
    backgroundColor: '#e2e8f0',
    padding: 2,
    justifyContent: 'center',
  },
  handoverToggleActive: {
    backgroundColor: '#8b5cf6',
  },
  handoverToggleThumb: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  handoverToggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  requestCardsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  requestCardsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 0,
  },
  requestCardsContent: {
    paddingTop: 16,
  },
  requestCardsTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#3b82f6',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  requestCardsSubtitle: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  requestCardBlock: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  requestCardHeader: {
    marginBottom: 10,
  },
  requestCardTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#202124',
    marginBottom: 4,
  },
  requestCardDescription: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 16,
  },
  requestCardButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  requestCardButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
    letterSpacing: 0.3,
  },
  independentRequestBlock: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  independentRequestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#fff',
  },
  independentRequestHeaderContent: {
    flex: 1,
  },
  independentRequestTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#202124',
    marginBottom: 2,
  },
  independentRequestSubtitle: {
    fontSize: 12,
    color: '#64748b',
  },
  independentRequestContent: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  requestInstructionText: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    paddingVertical: 8,
  },
  inlineUnverifiedText: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: '#3b82f6',
  },
  lockedCompactDisplay: {
    backgroundColor: '#fff3cd',
    borderWidth: 1,
    borderColor: '#fbbf24',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  lockedCompactText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#92400e',
  },
  diaryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priorityCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  checkboxActive: {
    borderWidth: 0,
  },
  priorityLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: '#64748b',
  },
  submitDiaryButton: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#3b82f6',
    borderRadius: 6,
    alignItems: 'center',
  },
  submitDiaryButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#fff',
  },
  archiveModalCard: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  archiveModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#4285F4',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  archiveModalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#fff',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#fff',
  },
  monthsScrollView: {
    maxHeight: 400,
    padding: 16,
  },
  monthButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  monthButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#202124',
  },
  noArchiveText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    paddingVertical: 32,
    fontStyle: 'italic' as const,
  },
  backToMonthsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backToMonthsText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#4285F4',
  },
  archivedHistoryList: {
    maxHeight: 450,
    padding: 16,
  },
  archivedHistoryCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  archivedHistoryDate: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#4285F4',
    marginBottom: 10,
  },
  archivedHistoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  archivedHistoryValueRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
