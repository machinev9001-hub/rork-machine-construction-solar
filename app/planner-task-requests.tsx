import { Stack, useRouter } from 'expo-router';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, Modal, TextInput, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ClipboardList, CheckCircle, XCircle, Clock, Archive, ChevronDown, ChevronUp, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import TimestampFooter from '../components/TimestampFooter';
import { useAuth } from '../contexts/AuthContext';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useButtonProtection } from '../utils/hooks/useButtonProtection';
import { useSyncOnFocus } from '../utils/hooks/useSyncOnFocus';
import { collection, query, where, doc, updateDoc, Timestamp, orderBy, getDoc, getDocs, onSnapshot, DocumentData, addDoc, deleteDoc } from 'firebase/firestore';
import { queueFirestoreOperation } from '../utils/offlineQueue';

import { subMenuActivities } from '../constants/activities';
import { db } from '../config/firebase';
import { RequestType, RequestStatus } from '../types';
import { useState, useEffect, useMemo } from 'react';

type TaskRequest = {
  id: string;
  type: RequestType;
  status: RequestStatus;
  requestedBy: string;
  requestedByName?: string;
  requestedAt: Timestamp;
  taskId?: string;
  taskName?: string;
  subMenuName?: string;
  mainMenuName?: string;
  activity?: string;
  subActivity?: string;
  description?: string;
  siteId?: string;
  archived?: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  updatedBy?: string;
  approvedAt?: Timestamp;
  approvedBy?: string;
  rejectedAt?: Timestamp;
  rejectedBy?: string;
  requestType?: 'INITIAL_TASK_ACCESS' | 'ADD_NEW_TASK_PAGE';
  pvArea?: string;
  blockNumber?: string;
  specialArea?: string;
  notes?: string;
};

export default function PlannerTaskRequestsScreen() {
  const { user } = useAuth();
  const { protectAction } = useButtonProtection();
  useSyncOnFocus();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'incoming' | 'archived'>('incoming');
  const [requests, setRequests] = useState<TaskRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [pvArea, setPvArea] = useState('');
  const [blockNumber, setBlockNumber] = useState('');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [showColumnMultiPicker, setShowColumnMultiPicker] = useState(false);
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(() => new Set<string>());
  const [optimisticallyHiddenCards, setOptimisticallyHiddenCards] = useState<Set<string>>(() => new Set<string>());
  const [showPvAreaPicker, setShowPvAreaPicker] = useState(false);
  const [showBlockPicker, setShowBlockPicker] = useState(false);

  const [, setSelectedBlock] = useState<{ id: string; name: string } | null>(null);
  
  const { data: pvAreas = [], isLoading: loadingPvAreas } = useQuery({
    queryKey: ['pvAreas', user?.siteId],
    queryFn: async () => {
      if (!user?.siteId) return [];
      const q = query(
        collection(db, 'pvAreas'),
        where('siteId', '==', user.siteId)
      );
      const snapshot = await getDocs(q);
      const areas = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
      }));
      return areas.sort((a, b) => {
        const numA = parseInt(a.name);
        const numB = parseInt(b.name);
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }
        return a.name.localeCompare(b.name);
      });
    },
    enabled: !!user?.siteId,
  });

  const { data: blockAreas = [], isLoading: loadingBlocks } = useQuery({
    queryKey: ['blockAreas', user?.siteId],
    queryFn: async () => {
      console.log('🔍 [BLOCK AREAS QUERY] Starting fetch for siteId:', user?.siteId);
      if (!user?.siteId) {
        console.log('❌ [BLOCK AREAS QUERY] No siteId, returning empty array');
        return [];
      }
      const q = query(
        collection(db, 'blockAreas'),
        where('siteId', '==', user.siteId)
      );
      console.log('🔍 [BLOCK AREAS QUERY] Executing query...');
      const snapshot = await getDocs(q);
      console.log('📊 [BLOCK AREAS QUERY] Got', snapshot.docs.length, 'documents from Firestore');
      
      const blocks = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log('📄 [BLOCK AREA DOC]', doc.id, 'Raw data:', JSON.stringify(data, null, 2));
        
        return {
          id: doc.id,
          name: data.name || 'Unnamed Block',
          pvAreaId: data.pvAreaId || '',
          pvAreaName: data.pvAreaName || '',
        };
      });
      
      console.log('📊 [BLOCK AREAS] Processed', blocks.length, 'blocks');
      
      const sorted = blocks.sort((a, b) => {
        const numA = parseInt(a.name);
        const numB = parseInt(b.name);
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }
        return a.name.localeCompare(b.name);
      });
      
      console.log('✅ [BLOCK AREAS QUERY] Returning', sorted.length, 'sorted blocks');
      sorted.forEach(block => {
        console.log(`   - Block: ${block.name} (ID: ${block.id}, PV Area: ${block.pvAreaName})`);
      });
      
      return sorted;
    },
    enabled: !!user?.siteId,
  });

  const filteredBlocks = useMemo(() => {
    if (!pvArea) {
      return blockAreas;
    }
    
    const selectedPvAreaData = pvAreas.find(p => p.name === pvArea);
    
    if (!selectedPvAreaData) {
      return blockAreas;
    }
    
    const filtered = blockAreas.filter(b => b.pvAreaId === selectedPvAreaData.id);
    
    return filtered;
  }, [pvArea, blockAreas, pvAreas]);

  const { data: availableColumns = [], isLoading: loadingColumns } = useQuery({
    queryKey: ['available-columns', selectedRequestId, pvArea, blockNumber, user?.siteId],
    queryFn: async () => {
      if (!selectedRequestId || !pvArea || !blockNumber || !user?.siteId) {
        console.log('❌ [AVAILABLE COLUMNS] Missing params:', { selectedRequestId, pvArea, blockNumber, siteId: user?.siteId });
        return [];
      }

      const request = requests.find(r => r.id === selectedRequestId);
      if (!request) {
        console.log('❌ [AVAILABLE COLUMNS] Request not found');
        return [];
      }

      console.log('🔍 [AVAILABLE COLUMNS] Fetching for activity:', request.subActivity);
      console.log('🔍 [AVAILABLE COLUMNS] PV Area:', pvArea, 'Block:', blockNumber);

      try {
        const menusRef = collection(db, 'menuItems');
        const activityQuery = query(
          menusRef,
          where('level', '==', 'activity'),
          where('siteId', '==', user.siteId)
        );
        const activitySnapshot = await getDocs(activityQuery);

        const subMenuSlug = request.subActivity;
        let activityConfig = null;

        activitySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.parentSubMenuId) {
            const activitySlug = data.name?.toLowerCase().replace(/\s+/g, '-');
            if (activitySlug === subMenuSlug || data.parentSubMenuId === subMenuSlug) {
              if (data.moduleConfig?.gridConfig) {
                activityConfig = data.moduleConfig.gridConfig as any;
                console.log('✅ [AVAILABLE COLUMNS] Found grid config for activity:', data.name);
                console.log('📊 [AVAILABLE COLUMNS] Grid config:', JSON.stringify(activityConfig, null, 2));
              }
            }
          }
        });

        if (!activityConfig || !(activityConfig as any).flexibleColumns) {
          console.log('⚠️ [AVAILABLE COLUMNS] No grid configuration found for this activity');
          return [];
        }

        const selectedPvAreaData = pvAreas.find(p => p.name === pvArea);
        const selectedBlockData = blockAreas.find(b => b.name === blockNumber);

        if ((activityConfig as any).pvAreaId !== selectedPvAreaData?.id || (activityConfig as any).blockAreaId !== selectedBlockData?.id) {
          console.log('⚠️ [AVAILABLE COLUMNS] Selected PV Area/Block does not match activity grid config');
          console.log('   Activity expects:', (activityConfig as any).pvAreaName, (activityConfig as any).blockAreaName);
          console.log('   Planner selected:', pvArea, blockNumber);
          return [];
        }

        const columns = ((activityConfig as any).flexibleColumns as { column: string; rows: number }[]).map(col => col.column);
        console.log('✅ [AVAILABLE COLUMNS] Available columns:', columns);
        return columns;
      } catch (error) {
        console.error('❌ [AVAILABLE COLUMNS] Error:', error);
        return [];
      }
    },
    enabled: !!selectedRequestId && !!pvArea && !!blockNumber && !!user?.siteId && showApprovalModal,
  });

  const toggleColumn = (column: string) => {
    console.log('🔵 [TOGGLE COLUMN] Toggling column:', column);
    console.log('🔵 [TOGGLE COLUMN] Current selectedColumns:', selectedColumns);
    setSelectedColumns(prev => {
      if (prev.includes(column)) {
        const updated = prev.filter(c => c !== column);
        console.log('🔵 [TOGGLE COLUMN] Column removed, new list:', updated);
        return updated;
      }
      const updated = [...prev, column];
      console.log('🔵 [TOGGLE COLUMN] Column added, new list:', updated);
      return updated;
    });
  };

  const toggleCard = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  useEffect(() => {
    if (!user?.siteId) {
      console.log('❌ PLANNER QUERY - No siteId, returning empty array');
      setIsLoading(false);
      return;
    }

    console.log('🔍 PLANNER REALTIME - Setting up listener for siteId:', user.siteId);
    setIsLoading(true);

    const requestsRef = collection(db, 'requests');
    const q = query(
      requestsRef,
      where('type', '==', 'TASK_REQUEST'),
      where('siteId', '==', user.siteId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        console.log('📊 PLANNER REALTIME - Received', snapshot.docs.length, 'documents');
        const results: TaskRequest[] = [];
        
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          const requestData: TaskRequest = {
            id: docSnap.id,
            ...data
          } as TaskRequest;

          const mainMenuNames: Record<string, string> = {
            'trenching': 'TRENCHING',
            'cabling': 'CABLING',
            'terminations': 'TERMINATIONS',
            'inverters': 'INVERTERS',
            'drilling': 'DRILLING',
            'mechanical': 'MECHANICAL',
          };
          
          const subMenuNames: Record<string, string> = {
            'mv-cable-trench': 'MV CABLE TRENCH',
            'dc-cable-trench': 'DC CABLE TRENCH',
            'lv-cable-trench': 'LV CABLE TRENCH',
            'road-crossings': 'ROAD CROSSINGS',
            'mv-cable': 'MV CABLE',
            'dc-cable': 'DC CABLE',
            'lv-cable': 'LV CABLE',
            'earthing': 'EARTHING',
            'dc-terminations': 'DC TERMINATIONS (MC4S)',
            'lv-terminations': 'LV TERMINATIONS',
            'inverter-stations': 'INVERTER STATIONS',
            'inverter-installations': 'INVERTER INSTALLATIONS',
            'pile-drilling': 'PILE DRILLING',
            'foundation-drilling': 'FOUNDATION DRILLING',
            'cable-drilling': 'CABLE DRILLING',
            'tracker-assembly': 'TRACKER ASSEMBLY',
            'module-installation': 'MODULE INSTALLATION',
            'torque-tightening': 'TORQUE TIGHTENING',
          };

          if (data.taskId) {
            try {
              const taskDoc = await getDoc(doc(db, 'tasks', data.taskId));
              if (taskDoc.exists()) {
                const taskData = taskDoc.data();
                const mainMenuId = taskData.activity;
                const subMenuId = taskData.subActivity;
                
                requestData.mainMenuName = mainMenuNames[mainMenuId] || mainMenuId?.toUpperCase() || 'N/A';
                requestData.subMenuName = subMenuNames[subMenuId] || subMenuId?.toUpperCase() || 'N/A';
                requestData.taskName = requestData.mainMenuName || 'Task Request';
              }
            } catch (err) {
              console.error('Error fetching task data:', err);
            }
          } else if (data.activity && data.subActivity) {
            requestData.mainMenuName = mainMenuNames[data.activity] || data.activity?.toUpperCase() || 'N/A';
            requestData.subMenuName = subMenuNames[data.subActivity] || data.subMenuName || data.subActivity?.toUpperCase() || 'N/A';
            requestData.taskName = data.taskName || requestData.mainMenuName || 'Task Request';
          }

          if (data.requestedBy) {
            try {
              const usersQ = query(
                collection(db, 'users'),
                where('userId', '==', data.requestedBy)
              );
              const usersSnap = await getDocs(usersQ);
              if (!usersSnap.empty) {
                requestData.requestedByName = usersSnap.docs[0].data().name || data.requestedBy;
              }
            } catch (err) {
              console.error('Error fetching user name:', err);
            }
          }

          results.push(requestData);
        }
        
        console.log('📊 PLANNER REALTIME - Results:', JSON.stringify(results, null, 2));
        setRequests(results);
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        console.error('❌ PLANNER REALTIME - Error:', err);
        setError(err as Error);
        setIsLoading(false);
      }
    );

    return () => {
      console.log('🔴 PLANNER REALTIME - Cleaning up listener');
      unsubscribe();
    };
  }, [user?.siteId]);

  const deleteRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      console.log('🗑️ Deleting request:', requestId);
      const requestRef = doc(db, 'requests', requestId);
      await deleteDoc(requestRef);
      console.log('✅ Request deleted successfully');
    },
    onSuccess: () => {
      console.log('✅ Delete mutation completed');
    },
    onError: (error) => {
      console.error('❌ Delete mutation error:', error);
      Alert.alert('Error', 'Failed to delete request. Please try again.');
    },
  });

  const updateRequestMutation = useMutation({
    mutationFn: async ({ requestId, status, taskDetails }: { requestId: string; status: RequestStatus; taskDetails?: { pvArea?: string; blockNumber?: string; selectedColumns?: string[]; rejectionNotes?: string } }) => {
      console.log('🔄 [Optimistic] Updating request:', requestId, 'to status:', status);
      
      const requestRef = doc(db, 'requests', requestId);
      const requestDoc = await getDoc(requestRef);
      
      if (!requestDoc.exists()) {
        throw new Error('Request not found');
      }
      
      const requestData = requestDoc.data();
      console.log('📄 Request data:', JSON.stringify(requestData, null, 2));
      console.log('📄 Request taskId:', requestData.taskId);
      console.log('📄 Request siteId:', requestData.siteId);
      console.log('📄 Request subActivity:', requestData.subActivity);
      console.log('📄 Request supervisorId:', requestData.requestedBy);
      
      let createdTaskId: string | null = null;
      
      if (status === 'APPROVED') {
        if (requestData.requestType === 'ADD_NEW_TASK_PAGE' || requestData.requestType === 'INITIAL_TASK_ACCESS' || !requestData.taskId) {
          console.log('🆕 Creating new Task Page for subActivity:', requestData.subActivity);
          console.log('📝 Using Planner-provided details:', { pvArea: taskDetails?.pvArea, blockNumber: taskDetails?.blockNumber });
          console.log('📝 Request type:', requestData.requestType);
          console.log('📝 CRITICAL DATA CHECK:');
          console.log('   - activity:', requestData.activity);
          console.log('   - subActivity:', requestData.subActivity);
          console.log('   - supervisorId:', requestData.requestedBy);
          console.log('   - siteId:', requestData.siteId);
          
          const newTaskRef = await addDoc(collection(db, 'tasks'), {
            activity: requestData.activity,
            subActivity: requestData.subActivity,
            supervisorId: requestData.requestedBy,
            siteId: requestData.siteId,
            status: 'OPEN',
            taskAccessRequested: false,
            everApproved: true,
            pvArea: taskDetails?.pvArea || '',
            blockArea: taskDetails?.blockNumber || '',
            allocatedColumns: taskDetails?.selectedColumns || [],
            location: '',
            notes: '',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            createdBy: user?.userId || 'unknown',
            approvedBy: user?.userId || 'unknown',
            approvedAt: Timestamp.now(),
          });
          
          console.log('✅ New Task Page created with ID:', newTaskRef.id);
          console.log('✅ Task Data:', {
            id: newTaskRef.id,
            activity: requestData.activity,
            subActivity: requestData.subActivity,
            supervisorId: requestData.requestedBy,
            status: 'OPEN',
            everApproved: true,
          });
          
          createdTaskId = newTaskRef.id;
          
          let activitiesForSubmenu = subMenuActivities[requestData.subActivity];
          
          if (!activitiesForSubmenu || activitiesForSubmenu.length === 0) {
            console.log('📋 No hardcoded activities found, checking dynamic menu items...');
            try {
              const menusRef = collection(db, 'menuItems');
              const subMenuQuery = query(
                menusRef,
                where('level', '==', 'sub'),
                where('siteId', '==', requestData.siteId)
              );
              const subMenuSnapshot = await getDocs(subMenuQuery);
              
              let matchingSubMenuId: string | undefined;
              subMenuSnapshot.forEach((doc) => {
                const data = doc.data();
                const subMenuSlug = data.name.toLowerCase().replace(/\s+/g, '-');
                if (subMenuSlug === requestData.subActivity) {
                  matchingSubMenuId = doc.id;
                  console.log('✅ Found matching sub menu:', doc.id, data.name);
                }
              });
              
              if (matchingSubMenuId) {
                const activityQuery = query(
                  menusRef,
                  where('level', '==', 'activity'),
                  where('parentSubMenuId', '==', matchingSubMenuId),
                  where('siteId', '==', requestData.siteId)
                );
                const activitySnapshot = await getDocs(activityQuery);
                
                const dynamicActivities: any[] = [];
                activitySnapshot.forEach((docSnap) => {
                  const data = docSnap.data();
                  console.log('📋 [DYNAMIC ACTIVITY]', docSnap.id, data.name, 'moduleConfig:', JSON.stringify(data.moduleConfig, null, 2));
                  dynamicActivities.push({
                    id: docSnap.id,
                    name: data.name || 'Unnamed Activity',
                    unit: 'Units',
                    scopePolicy: 'NORMAL',
                    moduleConfig: data.moduleConfig,
                    sortOrder: data.sortOrder || 0,
                  });
                });
                
                dynamicActivities.sort((a, b) => a.sortOrder - b.sortOrder);
                activitiesForSubmenu = dynamicActivities;
                console.log('📋 Loaded', dynamicActivities.length, 'dynamic activities for task creation');
                console.log('📋 Activities with moduleConfig:', dynamicActivities.filter(a => a.moduleConfig).length);
              }
            } catch (error) {
              console.error('❌ Error loading dynamic activities:', error);
            }
          }
          
          if (activitiesForSubmenu && activitiesForSubmenu.length > 0) {
            console.log('📝 Initializing', activitiesForSubmenu.length, 'activities for new Task Page');
            
            const createdActivityDocs: { id: string; name: string; menuItemId: string; moduleConfig?: any }[] = [];
            
            for (const actConfig of activitiesForSubmenu) {
              console.log('🔵 [CREATE ACTIVITY] Creating activity for:', actConfig.name);
              console.log('🔵 [CREATE ACTIVITY] menuItemId:', actConfig.id);
              console.log('🔵 [CREATE ACTIVITY] Has moduleConfig:', !!actConfig.moduleConfig);
              if (actConfig.moduleConfig) {
                console.log('🔵 [CREATE ACTIVITY] moduleConfig:', JSON.stringify(actConfig.moduleConfig, null, 2));
              }
              
              const activityDocRef = await addDoc(collection(db, 'activities'), {
                taskId: newTaskRef.id,
                activityId: actConfig.id,
                name: actConfig.name,
                mainMenu: requestData.activity || '',
                subMenuKey: requestData.subActivity || '',
                status: 'OPEN',
                scopeValue: 0,
                scopeApproved: false,
                qcValue: 0,
                completedToday: 0,
                targetTomorrow: 0,
                unit: actConfig.unit || 'Units',
                notes: '',
                scopeRequested: false,
                qcRequested: false,
                cablingRequested: false,
                terminationRequested: false,
                scopePolicy: actConfig.scopePolicy || 'NORMAL',
                supervisorInputBy: requestData.requestedBy,
                siteId: requestData.siteId,
                moduleConfig: actConfig.moduleConfig || null,
                boqQuantity: actConfig.moduleConfig?.boqQuantity || null,
                boqUnit: actConfig.moduleConfig?.boqUnit || null,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                updatedBy: user?.userId || '',
              });
              
              createdActivityDocs.push({
                id: activityDocRef.id,
                name: actConfig.name,
                menuItemId: actConfig.id,
                moduleConfig: actConfig.moduleConfig,
              });
              
              console.log('✅ [CREATE ACTIVITY] Created activity doc:', activityDocRef.id, 'for menuItem:', actConfig.id);
              console.log('✅ [CREATE ACTIVITY] Saved moduleConfig:', actConfig.moduleConfig ? 'YES' : 'NO');
            }
            
            console.log('✅ All activities initialized for new Task Page');
          } else {
            console.warn('⚠️ No activities found for subActivity:', requestData.subActivity);
          }
        } else if (requestData.taskId) {
          console.log('🔓 Unlocking existing task with taskId:', requestData.taskId);
          const taskRef = doc(db, 'tasks', requestData.taskId);
          const taskDoc = await getDoc(taskRef);
          
          if (!taskDoc.exists()) {
            console.error('❌ Task not found with ID:', requestData.taskId);
            throw new Error('Task not found');
          }
          
          console.log('📄 Task before update:', JSON.stringify(taskDoc.data(), null, 2));
          
          await updateDoc(taskRef, {
            status: 'OPEN',
            taskAccessRequested: false,
            everApproved: true,
            updatedAt: Timestamp.now(),
            approvedBy: user?.userId || 'unknown',
            approvedAt: Timestamp.now(),
            ...(taskDetails?.pvArea && { pvArea: taskDetails.pvArea }),
            ...(taskDetails?.blockNumber && { blockArea: taskDetails.blockNumber }),
            ...(taskDetails?.selectedColumns && { allocatedColumns: taskDetails.selectedColumns }),
          });
          console.log('✅ Task unlocked successfully');
          
          const updatedTaskDoc = await getDoc(taskRef);
          console.log('📄 Task after update:', JSON.stringify(updatedTaskDoc.data(), null, 2));
          
          console.log('🔓 Now unlocking ALL activities for this task');
          const activitiesRef = collection(db, 'activities');
          const activitiesQuery = query(
            activitiesRef,
            where('taskId', '==', requestData.taskId)
          );
          const activitiesSnapshot = await getDocs(activitiesQuery);
          
          console.log('📊 Found', activitiesSnapshot.docs.length, 'activities to unlock');
          
          const unlockPromises = activitiesSnapshot.docs.map((activityDoc: DocumentData) => {
            console.log('🔓 Unlocking activity:', activityDoc.data().activityId);
            return updateDoc(doc(db, 'activities', activityDoc.id), {
              status: 'OPEN',
              updatedAt: Timestamp.now(),
              updatedBy: user?.userId || 'unknown',
            });
          });
          
          await Promise.all(unlockPromises);
          console.log('✅ All activities unlocked successfully');
          
          createdTaskId = requestData.taskId;
        }
      }
      
      const updatePayload: any = {
        status,
        updatedAt: Timestamp.now(),
        updatedBy: user?.userId || 'unknown',
        archived: status === 'APPROVED' || status === 'REJECTED',
        ...(taskDetails?.pvArea && { pvArea: taskDetails.pvArea }),
        ...(taskDetails?.blockNumber && { blockNumber: taskDetails.blockNumber }),
        ...(taskDetails?.selectedColumns && { allocatedColumns: taskDetails.selectedColumns }),
        ...(taskDetails?.rejectionNotes && { rejectionNotes: taskDetails.rejectionNotes }),
      };

      await queueFirestoreOperation(
        { type: 'update', collection: 'requests', docId: requestId, data: updatePayload },
        { priority: 'P0', entityType: 'taskRequest' }
      );
      console.log('✅ [Optimistic] Request queued for background sync');
      
      return { createdTaskId };
    },
    onSuccess: (result, variables) => {
      console.log('✅ [Optimistic] Request mutation completed successfully');
      console.log('✅ [OPTIMISTIC] Result:', JSON.stringify(result));
      setOptimisticallyHiddenCards((prev) => {
        const next = new Set(prev);
        next.delete(variables.requestId);
        return next;
      });
      
      if (variables.status === 'APPROVED') {
        console.log('✅ [TASK APPROVED] Task approved successfully');
      }
    },
    onError: (error, variables) => {
      console.error('❌ [Optimistic] Request mutation error:', error);
      setOptimisticallyHiddenCards((prev) => {
        const next = new Set(prev);
        next.delete(variables.requestId);
        return next;
      });
      Alert.alert('Error', 'Failed to update request. Please try again.');
    },
  });

  const handleApprove = (requestId: string) => {
    setSelectedRequestId(requestId);
    setShowApprovalModal(true);
  };

  const handleReject = (requestId: string) => {
    setSelectedRequestId(requestId);
    setShowRejectionModal(true);
  };

  const submitApprovalInternal = () => {
    console.log('🟢 [SUBMIT APPROVAL] Button pressed');
    console.log('🟢 [SUBMIT APPROVAL] selectedRequestId:', selectedRequestId);
    console.log('🟢 [SUBMIT APPROVAL] pvArea:', pvArea);
    console.log('🟢 [SUBMIT APPROVAL] blockNumber:', blockNumber);
    console.log('🟢 [SUBMIT APPROVAL] selectedColumns:', selectedColumns);
    
    if (!selectedRequestId) {
      console.log('❌ [SUBMIT APPROVAL] No selectedRequestId, returning');
      return;
    }
    
    if (!pvArea.trim() || !blockNumber.trim()) {
      console.log('❌ [SUBMIT APPROVAL] Missing required fields');
      Alert.alert('Required', 'Please select PV Area and Block Number');
      return;
    }

    console.log('✅ [SUBMIT APPROVAL] Validation passed, calling mutation');
    console.log('[Optimistic] Approving task request:', selectedRequestId);
    
    setOptimisticallyHiddenCards((prev) => new Set(prev).add(selectedRequestId));
    
    updateRequestMutation.mutate({
      requestId: selectedRequestId,
      status: 'APPROVED',
      taskDetails: {
        pvArea: pvArea.trim(),
        blockNumber: blockNumber.trim(),
        selectedColumns: selectedColumns,
      },
    });
    
    console.log('✅ [SUBMIT APPROVAL] Mutation called, closing modal');
    setShowApprovalModal(false);
    setPvArea('');
    setBlockNumber('');
    setSelectedColumns([]);
    setSelectedBlock(null);
    setSelectedRequestId(null);
  };

  const submitRejectionInternal = () => {
    if (!selectedRequestId) return;
    
    if (!rejectionNotes.trim()) {
      Alert.alert('Required', 'Please enter a reason for rejection');
      return;
    }

    console.log('[Optimistic] Rejecting task request:', selectedRequestId);
    
    setOptimisticallyHiddenCards((prev) => new Set(prev).add(selectedRequestId));
    
    updateRequestMutation.mutate({
      requestId: selectedRequestId,
      status: 'REJECTED',
      taskDetails: {
        rejectionNotes: rejectionNotes.trim(),
      },
    });
    
    setShowRejectionModal(false);
    setRejectionNotes('');
    setSelectedRequestId(null);
  };

  const runProtectedApprovalSubmit = () => {
    const execute = protectAction('submit-approval', submitApprovalInternal);
    void execute();
  };

  const runProtectedRejectionSubmit = () => {
    const execute = protectAction('submit-rejection', submitRejectionInternal);
    void execute();
  };

  const incomingRequests = requests.filter(r => !r.archived && !optimisticallyHiddenCards.has(r.id));
  const archivedRequests = requests.filter(r => r.archived);
  const pendingCount = requests.filter(r => {
    const status = (r.status || '').toString().toUpperCase();
    return status === 'PENDING' && !r.archived;
  }).length;

  const getStatusColor = (status: RequestStatus) => {
    switch (status) {
      case 'APPROVED': return '#10b981';
      case 'REJECTED': return '#ef4444';
      case 'CANCELLED': return '#6b7280';
      default: return '#f59e0b';
    }
  };

  const getStatusIcon = (status: RequestStatus) => {
    switch (status) {
      case 'APPROVED': return CheckCircle;
      case 'REJECTED': return XCircle;
      default: return Clock;
    }
  };

  const formatTimestamp = (timestamp?: Timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate();
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  const handleDeleteRequest = (requestId: string) => {
    deleteRequestMutation.mutate(requestId);
  };

  const renderRequest = (request: TaskRequest, isPending: boolean) => {
    const StatusIcon = getStatusIcon(request.status);
    const statusColor = getStatusColor(request.status);
    const isExpanded = expandedCards.has(request.id);
    const isCancelled = request.status?.toUpperCase() === 'CANCELLED';

    const handleLongPress = () => {
      if (isCancelled) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
        Alert.alert(
          'Delete Request',
          'Are you sure you want to permanently delete this cancelled request?',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => handleDeleteRequest(request.id),
            },
          ]
        );
      }
    };

    return (
      <View key={request.id} style={[styles.requestCard, isCancelled && styles.cancelledCard]}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => toggleCard(request.id)}
          onLongPress={handleLongPress}
          delayLongPress={600}
        >
          <View style={styles.requestHeader}>
            <View style={styles.headerLeft}>
              <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
                <StatusIcon size={16} color={statusColor} />
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {request.status}
                </Text>
              </View>
              {isCancelled && (
                <View style={styles.deleteHint}>
                  <Trash2 size={12} color="#94a3b8" />
                  <Text style={styles.deleteHintText}>Hold to delete</Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.requestTime}>
                {formatTimestamp(request.requestedAt)}
              </Text>
              {isExpanded ? <ChevronUp size={20} color="#64748b" /> : <ChevronDown size={20} color="#64748b" />}
            </View>
          </View>

          <Text style={styles.requestTitle}>{request.mainMenuName || 'Task Request'}</Text>
          <Text style={styles.compactInfo}>
            {request.subMenuName}
          </Text>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedContent}>
            <View style={styles.taskDetailsRow}>
              <View style={styles.taskDetailItem}>
                <Text style={styles.taskDetailLabel}>Main Menu:</Text>
                <Text style={styles.taskDetailValue}>{request.mainMenuName || 'N/A'}</Text>
              </View>
              <View style={styles.taskDetailItem}>
                <Text style={styles.taskDetailLabel}>Sub Menu:</Text>
                <Text style={styles.taskDetailValue}>{request.subMenuName || 'N/A'}</Text>
              </View>
            </View>
            
            {request.description && (
              <Text style={styles.requestDescription}>{request.description}</Text>
            )}

            <View style={styles.requestMeta}>
              <Text style={styles.metaLabel}>Requested by:</Text>
              <Text style={styles.metaValue}>{request.requestedByName || request.requestedBy}</Text>
            </View>

            {isPending && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.approveButton]}
                  activeOpacity={0.8}
                  onPress={() => handleApprove(request.id)}
                  disabled={updateRequestMutation.isPending}
                >
                  <CheckCircle size={18} color="#fff" />
                  <Text style={styles.actionButtonText}>Approve</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.rejectButton]}
                  activeOpacity={0.8}
                  onPress={() => handleReject(request.id)}
                  disabled={updateRequestMutation.isPending}
                >
                  <XCircle size={18} color="#fff" />
                  <Text style={styles.actionButtonText}>Reject</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
        
        <TimestampFooter
          createdAt={request.createdAt || request.requestedAt}
          createdBy={request.requestedByName || request.requestedBy}
          updatedAt={request.approvedAt || request.rejectedAt || request.updatedAt}
          updatedBy={request.approvedBy || request.rejectedBy || request.updatedBy}
          actionLabel={request.status === 'APPROVED' ? 'Approved' : request.status === 'REJECTED' ? 'Rejected' : 'Updated'}
        />
      </View>
    );
  };

  const scrollContentStyle = useMemo(() => ({
    paddingBottom: Math.max(insets.bottom + 140, 180),
  }), [insets.bottom]);

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 0) }]}> 
      <Stack.Screen
        options={{
          title: 'Task Requests',
          headerStyle: {
            backgroundColor: '#059669',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: '600' as const,
          },
        }}
      />
      
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, scrollContentStyle]}
      >
        <View style={styles.headerCard}>
          <ClipboardList size={32} color="#059669" />
          <Text style={styles.headerTitle}>Task Requests</Text>
          <Text style={styles.headerSubtitle}>
            {pendingCount} pending approval
          </Text>
          {user?.siteId && (
            <Text style={styles.debugText}>SiteID: {user.siteId}</Text>
          )}
          {error && (
            <Text style={styles.errorText}>Error: {String(error)}</Text>
          )}
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'incoming' && styles.activeTab]}
            activeOpacity={0.7}
            onPress={() => setActiveTab('incoming')}
          >
            <ClipboardList size={20} color={activeTab === 'incoming' ? '#059669' : '#64748b'} />
            <Text style={[styles.tabText, activeTab === 'incoming' && styles.activeTabText]}>
              Incoming
            </Text>
            {pendingCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'archived' && styles.activeTab]}
            activeOpacity={0.7}
            onPress={() => setActiveTab('archived')}
          >
            <Archive size={20} color={activeTab === 'archived' ? '#059669' : '#64748b'} />
            <Text style={[styles.tabText, activeTab === 'archived' && styles.activeTabText]}>
              Archived
            </Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#059669" />
            <Text style={styles.loadingText}>Loading requests...</Text>
          </View>
        ) : (
          <View style={styles.section}>
            {activeTab === 'incoming' ? (
              incomingRequests.length > 0 ? (
                incomingRequests.map(request => renderRequest(request, request.status === 'PENDING'))
              ) : (
                <View style={styles.emptyContainer}>
                  <ClipboardList size={48} color="#cbd5e1" />
                  <Text style={styles.emptyText}>No incoming requests</Text>
                </View>
              )
            ) : (
              archivedRequests.length > 0 ? (
                archivedRequests.map(request => renderRequest(request, false))
              ) : (
                <View style={styles.emptyContainer}>
                  <Archive size={48} color="#cbd5e1" />
                  <Text style={styles.emptyText}>No archived requests</Text>
                </View>
              )
            )}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showApprovalModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowApprovalModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Approve Task Request</Text>
            <Text style={styles.modalSubtitle}>Enter task area details</Text>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>PV Area *</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => {
                  console.log('🟠 [PV AREA PICKER] Button pressed - Opening picker modal');
                  console.log('🟠 [PV AREA PICKER] Current pvAreas count:', pvAreas.length);
                  console.log('🟠 [PV AREA PICKER] Loading state:', loadingPvAreas);
                  pvAreas.forEach((area, idx) => {
                    console.log(`   ${idx + 1}. PV Area: ${area.name} (ID: ${area.id})`);
                  });
                  setShowPvAreaPicker(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.pickerButtonText, !pvArea && styles.pickerPlaceholder]}>
                  {pvArea || 'Select PV Area'}
                </Text>
                <ChevronDown size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Block Number *</Text>
              <TouchableOpacity
                style={[styles.pickerButton, !pvArea && styles.pickerButtonDisabled]}
                onPress={() => {
                  console.log('🟠 [BLOCK PICKER] Button pressed');
                  console.log('🟠 [BLOCK PICKER] Current pvArea selected:', pvArea);
                  console.log('🟠 [BLOCK PICKER] Total blockAreas:', blockAreas.length);
                  console.log('🟠 [BLOCK PICKER] Filtered blocks count:', filteredBlocks.length);
                  console.log('🟠 [BLOCK PICKER] Loading state:', loadingBlocks);
                  
                  if (pvArea) {
                    console.log('✅ [BLOCK PICKER] PV Area selected, opening picker modal');
                    console.log('🟠 [BLOCK PICKER] Filtered blocks to show:');
                    filteredBlocks.forEach((block, idx) => {
                      console.log(`   ${idx + 1}. Block: ${block.name} (ID: ${block.id}, PV Area: ${block.pvAreaName})`);
                      console.log(`      - pvAreaId: ${block.pvAreaId}`);
                    });
                    setShowBlockPicker(true);
                  } else {
                    console.log('❌ [BLOCK PICKER] No PV Area selected, showing alert');
                    Alert.alert('Info', 'Please select a PV Area first');
                  }
                }}
                activeOpacity={0.7}
                disabled={!pvArea}
              >
                <Text style={[styles.pickerButtonText, !blockNumber && styles.pickerPlaceholder]}>
                  {blockNumber || 'Select Block Number'}
                </Text>
                <ChevronDown size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Columns (Optional - From Activity Grid Config)</Text>
              {loadingColumns ? (
                <View style={styles.loadingColumnsContainer}>
                  <ActivityIndicator size="small" color="#059669" />
                  <Text style={styles.loadingColumnsText}>Loading available columns...</Text>
                </View>
              ) : availableColumns.length > 0 ? (
                <>
                  <TouchableOpacity
                    style={styles.pickerButton}
                    onPress={() => {
                      console.log('🟠 [COLUMN PICKER] Button pressed');
                      console.log('🟠 [COLUMN PICKER] Available columns:', availableColumns);
                      setShowColumnMultiPicker(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pickerButtonText, selectedColumns.length === 0 && styles.pickerPlaceholder]}>
                      {selectedColumns.length === 0 ? 'Select Columns (Optional)' : `${selectedColumns.length} column(s) selected: ${selectedColumns.join(', ')}`}
                    </Text>
                    <ChevronDown size={20} color="#64748b" />
                  </TouchableOpacity>
                  <Text style={styles.columnHint}>Select which columns this supervisor will work on</Text>
                </>
              ) : null}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowApprovalModal(false);
                  setPvArea('');
                  setBlockNumber('');
                  setSelectedColumns([]);
                  setSelectedBlock(null);
                }}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonApprove]}
                onPress={runProtectedApprovalSubmit}
                disabled={updateRequestMutation.isPending}
              >
                <Text style={styles.modalButtonText}>
                  {updateRequestMutation.isPending ? 'Approving...' : 'Approve'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showRejectionModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowRejectionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reject Task Request</Text>
            <Text style={styles.modalSubtitle}>Please provide a reason</Text>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Rejection Notes *</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                value={rejectionNotes}
                onChangeText={setRejectionNotes}
                placeholder="Enter reason for rejection..."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowRejectionModal(false);
                  setRejectionNotes('');
                }}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonReject]}
                onPress={runProtectedRejectionSubmit}
                disabled={updateRequestMutation.isPending}
              >
                <Text style={styles.modalButtonText}>
                  {updateRequestMutation.isPending ? 'Rejecting...' : 'Reject'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showPvAreaPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPvAreaPicker(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContent}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select PV Area</Text>
              <TouchableOpacity
                onPress={() => setShowPvAreaPicker(false)}
                style={styles.pickerCloseButton}
              >
                <Text style={styles.pickerCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerScroll}>
              {loadingPvAreas ? (
                <ActivityIndicator size="large" color="#059669" style={{ marginVertical: 20 }} />
              ) : pvAreas.length === 0 ? (
                <View style={styles.pickerEmpty}>
                  <Text style={styles.pickerEmptyText}>No PV Areas found</Text>
                  <Text style={styles.pickerEmptySubtext}>Add PV Areas in Settings first</Text>
                </View>
              ) : (
                pvAreas.map((area) => (
                  <TouchableOpacity
                    key={area.id}
                    style={[
                      styles.pickerItem,
                      pvArea === area.name && styles.pickerItemSelected,
                    ]}
                    onPress={() => {
                      setPvArea(area.name);
                      setBlockNumber('');
                      setSelectedColumns([]);
                      setSelectedBlock(null);
                      setShowPvAreaPicker(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        pvArea === area.name && styles.pickerItemTextSelected,
                      ]}
                    >
                      {area.name}
                    </Text>
                    {pvArea === area.name && (
                      <CheckCircle size={20} color="#059669" />
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showBlockPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowBlockPicker(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContent}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Block Number</Text>
              <TouchableOpacity
                onPress={() => setShowBlockPicker(false)}
                style={styles.pickerCloseButton}
              >
                <Text style={styles.pickerCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerScroll}>
              {loadingBlocks ? (
                <ActivityIndicator size="large" color="#059669" style={{ marginVertical: 20 }} />
              ) : filteredBlocks.length === 0 ? (
                <View style={styles.pickerEmpty}>
                  <Text style={styles.pickerEmptyText}>No Block Numbers found</Text>
                  <Text style={styles.pickerEmptySubtext}>
                    {pvArea ? `No blocks in ${pvArea}` : 'Select a PV Area first'}
                  </Text>
                </View>
              ) : (
                filteredBlocks.map((block) => {
                  console.log('🔵 [RENDER BLOCK ITEM]', block.id, block.name);
                  return (
                    <TouchableOpacity
                      key={block.id}
                      style={[
                        styles.pickerItem,
                        blockNumber === block.name && styles.pickerItemSelected,
                      ]}
                      onPress={() => {
                        console.log('✅ [BLOCK SELECTED]', block.name);
                        console.log('🔍 [BLOCK SELECTED] Block ID:', block.id);
                        setBlockNumber(block.name);
                        setSelectedBlock(block);
                        setSelectedColumns([]);
                        setShowBlockPicker(false);
                        console.log('✅ [BLOCK SELECTED] State updated successfully');
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.pickerItemText,
                          blockNumber === block.name && styles.pickerItemTextSelected,
                        ]}
                      >
                        {block.name}
                      </Text>
                      {blockNumber === block.name && (
                        <CheckCircle size={20} color="#059669" />
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showColumnMultiPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowColumnMultiPicker(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContent}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Columns</Text>
              <TouchableOpacity
                onPress={() => {
                  console.log('🟢 [COLUMN PICKER] Done button pressed');
                  console.log('🟢 [COLUMN PICKER] Final selectedColumns:', selectedColumns);
                  setShowColumnMultiPicker(false);
                }}
                style={styles.pickerCloseButton}
              >
                <Text style={styles.pickerCloseText}>Done</Text>
              </TouchableOpacity>
            </View>
            {selectedColumns.length > 0 && (
              <View style={styles.selectedColumnsHeader}>
                <Text style={styles.selectedColumnsText}>
                  {selectedColumns.length} column(s) selected
                </Text>
              </View>
            )}
            <ScrollView style={styles.pickerScroll}>
              {loadingColumns ? (
                <View style={styles.loadingColumnsContainer}>
                  <ActivityIndicator size="large" color="#059669" />
                  <Text style={styles.loadingColumnsText}>Loading columns...</Text>
                </View>
              ) : availableColumns.length === 0 ? (
                <View style={styles.pickerEmpty}>
                  <Text style={styles.pickerEmptyText}>No Columns Available</Text>
                  <Text style={styles.pickerEmptySubtext}>
                    This activity doesn&apos;t have grid columns configured in Menu Manager
                  </Text>
                </View>
              ) : (
                availableColumns.map((column: string) => (
                  <TouchableOpacity
                    key={column}
                    style={[
                      styles.pickerItem,
                      selectedColumns.includes(column) && styles.pickerItemSelected,
                    ]}
                    onPress={() => {
                      console.log('🟣 [COLUMN ITEM] Column tapped:', column);
                      toggleColumn(column);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        selectedColumns.includes(column) && styles.pickerItemTextSelected,
                      ]}
                    >
                      {column}
                    </Text>
                    {selectedColumns.includes(column) && (
                      <CheckCircle size={20} color="#059669" />
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 48,
  },
  headerCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1e293b',
    marginTop: 12,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#64748b',
    marginHorizontal: 16,
    marginBottom: 12,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  requestCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
  },
  requestTime: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500' as const,
  },
  requestTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#1e293b',
    marginBottom: 4,
  },
  requestSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 8,
  },
  requestDescription: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 12,
  },
  requestMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  metaLabel: {
    fontSize: 13,
    color: '#64748b',
    marginRight: 6,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 6,
  },
  approveButton: {
    backgroundColor: '#10b981',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#94a3b8',
  },
  debugText: {
    marginTop: 8,
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'monospace' as const,
  },
  errorText: {
    marginTop: 8,
    fontSize: 12,
    color: '#ef4444',
    fontFamily: 'monospace' as const,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  activeTab: {
    backgroundColor: '#d1fae5',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#64748b',
  },
  activeTabText: {
    color: '#059669',
    fontWeight: '600' as const,
  },
  badge: {
    backgroundColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1e293b',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 20,
  },
  modalField: {
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#334155',
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#1e293b',
  },
  modalTextArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#f1f5f9',
  },
  modalButtonApprove: {
    backgroundColor: '#10b981',
  },
  modalButtonReject: {
    backgroundColor: '#ef4444',
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
  },
  modalButtonTextCancel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#475569',
  },
  taskDetailsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  taskDetailItem: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#059669',
  },
  taskDetailLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#64748b',
    textTransform: 'uppercase' as const,
    marginBottom: 2,
  },
  taskDetailValue: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#1e293b',
  },
  compactInfo: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  expandedContent: {
    marginTop: 12,
  },
  cancelledCard: {
    opacity: 0.7,
    borderLeftWidth: 4,
    borderLeftColor: '#6b7280',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
  },
  deleteHintText: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500' as const,
  },
  pickerButton: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerButtonDisabled: {
    opacity: 0.5,
  },
  pickerButtonText: {
    fontSize: 15,
    color: '#1e293b',
  },
  pickerPlaceholder: {
    color: '#94a3b8',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  pickerContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
    paddingBottom: 20,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  pickerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1e293b',
    letterSpacing: -0.3,
  },
  pickerCloseButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
  },
  pickerCloseText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#059669',
  },
  pickerScroll: {
    maxHeight: 400,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    minHeight: 64,
  },
  pickerItemSelected: {
    backgroundColor: '#d1fae5',
    borderLeftWidth: 4,
    borderLeftColor: '#059669',
    paddingLeft: 28,
  },
  pickerItemText: {
    fontSize: 17,
    color: '#334155',
    fontWeight: '500' as const,
    letterSpacing: -0.2,
  },
  pickerItemTextSelected: {
    color: '#059669',
    fontWeight: '700' as const,
  },
  pickerEmpty: {
    padding: 40,
    alignItems: 'center',
  },
  pickerEmptyText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#64748b',
  },
  pickerEmptySubtext: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
    textAlign: 'center',
  },
  selectedColumnsHeader: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#a7f3d0',
  },
  selectedColumnsText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#059669',
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  infoBoxText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1e40af',
    marginBottom: 8,
  },
  infoBoxSubtext: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  loadingColumnsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
  },
  loadingColumnsText: {
    fontSize: 13,
    color: '#64748b',
  },
  columnHint: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
});
