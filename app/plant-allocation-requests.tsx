import { Stack, useRouter } from 'expo-router';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Modal, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Truck, CheckCircle, XCircle, Clock, Archive, Calendar, ChevronDown, ChevronUp, Package, X, LayoutGrid, MapPin, RotateCcw } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import TimestampFooter from '../components/TimestampFooter';
import { useAuth } from '../contexts/AuthContext';
import { useMutation } from '@tanstack/react-query';
import { useButtonProtection } from '../utils/hooks/useButtonProtection';
import { useSyncOnFocus } from '../utils/hooks/useSyncOnFocus';
import { collection, query, where, orderBy, doc, Timestamp, onSnapshot, getDocs, getDoc } from 'firebase/firestore';
import { queueFirestoreOperation } from '../utils/offlineQueue';
import { db } from '../config/firebase';
import { RequestStatus, PlantAsset } from '../types';
import { useState, useEffect, useMemo } from 'react';
import { restoreRequest, archiveRequestsByMonth, groupRequestsByMonth, getMonthLabel } from '../utils/requestArchive';
import * as Haptics from 'expo-haptics';

type PlantRequest = {
  id: string;
  type: 'PLANT_ALLOCATION_REQUEST';
  status: RequestStatus;
  requestedBy: string;
  requestedByName?: string;
  requestedAt: Timestamp;
  taskId?: string;
  activityId?: string;
  activityName?: string;
  subMenuName?: string;
  mainMenuName?: string;
  siteId?: string;
  plantType?: string;
  quantity?: number;
  purpose?: string;
  duration?: string;
  archived?: boolean;
  supervisorId?: string;
  supervisorName?: string;
  pvArea?: string;
  blockArea?: string;
  scheduledDeliveryDate?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  updatedBy?: string;
  approvedAt?: Timestamp;
  approvedBy?: string;
  notes?: string;
};

export default function PlantAllocationRequestsScreen() {
  const { user } = useAuth();
  const { protectAction } = useButtonProtection();
  useSyncOnFocus();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'incoming' | 'scheduled' | 'archived'>('incoming');
  const [requests, setRequests] = useState<PlantRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedRequests, setExpandedRequests] = useState<Record<string, boolean>>({});
  const [optimisticallyHiddenCards, setOptimisticallyHiddenCards] = useState<Set<string>>(() => new Set<string>());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [plantAssets, setPlantAssets] = useState<PlantAsset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Record<string, string>>({});
  const [showAssetPicker, setShowAssetPicker] = useState<string | null>(null);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});

  useEffect(() => {
    console.log('\n🎯 ============================================== 🎯');
    console.log('🎯 PLANT REQUEST COMPONENT MOUNTED');
    console.log('🎯 Current user role:', user?.role);
    console.log('🎯 Current user ID:', user?.userId);
    console.log('🎯 Current user name:', user?.name);
    console.log('🎯 Current user siteId:', user?.siteId);
    console.log('🎯 Current user siteName:', user?.siteName);
    console.log('🎯 Current user masterAccountId:', user?.masterAccountId);
    console.log('🎯 Current user companyId:', user?.currentCompanyId);
    console.log('🎯 Full user object:', JSON.stringify(user, null, 2));
    console.log('🎯 ============================================== 🎯\n');
    
    if (!user?.siteId) {
      console.log('❌ ============================================== ❌');
      console.log('❌ PLANT REQUEST QUERY - No siteId!');
      console.log('❌ PLANT REQUEST QUERY - Cannot query without siteId');
      console.log('❌ PLANT REQUEST QUERY - User must have a siteId to view requests');
      console.log('❌ PLANT REQUEST QUERY - Check if Plant Manager user has siteId assigned');
      console.log('❌ ============================================== ❌');
      setIsLoading(false);
      return;
    }

    console.log('🔍 PLANT REQUEST REALTIME - Setting up listener');
    console.log('🔍 PLANT REQUEST REALTIME - user.role:', user.role);
    console.log('🔍 PLANT REQUEST REALTIME - user.userId:', user.userId);
    console.log('🔍 PLANT REQUEST REALTIME - user.siteId:', user.siteId);
    console.log('🔍 PLANT REQUEST REALTIME - user.siteName:', user.siteName);
    console.log('🔍 PLANT REQUEST REALTIME - user.masterAccountId:', user.masterAccountId);
    setIsLoading(true);

    const requestsRef = collection(db, 'requests');
    const q = query(
      requestsRef,
      where('type', '==', 'PLANT_ALLOCATION_REQUEST'),
      where('siteId', '==', user.siteId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        console.log('\n📊 ============================================== 📊');
        console.log('📊 PLANT REQUEST REALTIME - onSnapshot triggered!');
        console.log('📊 PLANT REQUEST REALTIME - Timestamp:', new Date().toISOString());
        console.log('📊 PLANT REQUEST REALTIME - Received', snapshot.docs.length, 'documents');
        console.log('📊 PLANT REQUEST REALTIME - Query Params:');
        console.log('   - type: PLANT_ALLOCATION_REQUEST');
        console.log('   - siteId:', user.siteId, '(' + (user.siteName || 'No site name') + ')');
        console.log('   - orderBy: createdAt desc');
        
        if (snapshot.metadata.fromCache) {
          console.log('   ⚠️ Data is from LOCAL CACHE');
        } else {
          console.log('   ✅ Data is from FIRESTORE SERVER');
        }
        console.log('   📝 Snapshot empty?:', snapshot.empty);
        console.log('   📝 Snapshot size:', snapshot.size);
        console.log('   📝 Query changes:', snapshot.docChanges().length);
        console.log('📊 ============================================== 📊\n');
        
        const results: PlantRequest[] = [];
        
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          
          console.log('\n📄 Processing request:', docSnap.id);
          console.log('   Raw data:', JSON.stringify(data, null, 2));
          console.log('   Type:', data.type);
          console.log('   Status:', data.status);
          console.log('   Archived:', data.archived);
          console.log('   PlantType:', data.plantType);
          console.log('   Quantity:', data.quantity);
          console.log('   SiteId:', data.siteId);
          console.log('   Requested by:', data.requestedBy, '/', data.requestedByName);
          
          const requestData: PlantRequest = {
            id: docSnap.id,
            ...data
          } as PlantRequest;

          if (data.taskId && data.activityId) {
            try {
              const activitiesRef = collection(db, 'activities');
              const activitiesQ = query(
                activitiesRef,
                where('taskId', '==', data.taskId),
                where('activityId', '==', data.activityId)
              );
              const activitiesSnap = await getDocs(activitiesQ);
              if (!activitiesSnap.empty) {
                const activityData = activitiesSnap.docs[0].data();
                requestData.activityName = activityData.name || 'N/A';
              }

              const taskDoc = await getDoc(doc(db, 'tasks', data.taskId));
              if (taskDoc.exists()) {
                const taskData = taskDoc.data();
                const mainMenuId = taskData.activity;
                const subMenuId = taskData.subActivity;
                
                const mainMenuNames: Record<string, string> = {
                  'trenching': 'TRENCHING',
                  'cabling': 'CABLING',
                  'terminations': 'TERMINATIONS',
                  'inverters': 'INVERTERS',
                  'drilling': 'DRILLING',
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
                };
                
                requestData.mainMenuName = mainMenuNames[mainMenuId] || mainMenuId?.toUpperCase() || 'N/A';
                requestData.subMenuName = subMenuNames[subMenuId] || subMenuId?.toUpperCase() || 'N/A';
                requestData.pvArea = taskData.pvArea || '';
                requestData.blockArea = taskData.blockArea || '';
              }
            } catch (err) {
              console.error('Error fetching activity data:', err);
            }
          }

          if (data.supervisorId || data.requestedBy) {
            try {
              const usersQ = query(
                collection(db, 'users'),
                where('userId', '==', data.supervisorId || data.requestedBy)
              );
              const usersSnap = await getDocs(usersQ);
              if (!usersSnap.empty) {
                requestData.requestedByName = usersSnap.docs[0].data().name || data.requestedBy;
                requestData.supervisorName = requestData.requestedByName;
              }
            } catch (err) {
              console.error('Error fetching user name:', err);
            }
          }

          results.push(requestData);
        }
        
        console.log('\n✅ ============================================== ✅');
        console.log('✅ PLANT REQUEST REALTIME - Total processed:', results.length);
        console.log('✅ PLANT REQUEST REALTIME - Results summary:');
        results.forEach((r, idx) => {
          console.log(`   ${idx + 1}. ID: ${r.id}`);
          console.log(`      Status: ${r.status}, Archived: ${r.archived}, Type: ${r.plantType}, Qty: ${r.quantity}`);
        });
        console.log('✅ ============================================== ✅\n');
        
        setRequests(results);
        setIsLoading(false);
      },
      (err) => {
        console.error('\n❌ ============================================== ❌');
        console.error('❌ PLANT REQUEST REALTIME - onSnapshot ERROR!');
        console.error('❌ Error details:', err);
        console.error('❌ Error message:', err.message);
        console.error('❌ Error code:', err.code);
        console.error('❌ ============================================== ❌\n');
        setIsLoading(false);
      }
    );

    return () => {
      console.log('🔴 PLANT REQUEST REALTIME - Cleaning up listener');
      unsubscribe();
    };
  }, [user?.siteId, user?.role, user?.masterAccountId]);

  useEffect(() => {
    const loadPlantAssets = async () => {
      if (!user?.masterAccountId || !user?.siteId) {
        console.log('🚚 No masterAccountId or siteId, cannot load plant assets');
        return;
      }
      
      try {
        console.log('🚚 Loading plant assets for masterAccountId:', user.masterAccountId, 'siteId:', user.siteId);
        const assetsRef = collection(db, 'plantAssets');
        const q = query(
          assetsRef,
          where('masterAccountId', '==', user.masterAccountId),
          where('siteId', '==', user.siteId),
          where('archived', '==', false)
        );
        
        const snapshot = await getDocs(q);
        const assets: PlantAsset[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as PlantAsset));
        
        console.log('🚚 Loaded plant assets:', assets.length);
        console.log('🚚 Asset types:', assets.map(a => a.type));
        console.log('🚚 Full assets data:', JSON.stringify(assets, null, 2));
        setPlantAssets(assets);
      } catch (error) {
        console.error('❌ Error loading plant assets:', error);
        console.error('❌ Error details:', JSON.stringify(error, null, 2));
      }
    };
    
    loadPlantAssets();
  }, [user?.masterAccountId]);

  const updateRequestMutation = useMutation({
    mutationFn: async ({ 
      requestId, 
      status, 
      scheduledDate,
      allocatedAssetId,
    }: { 
      requestId: string; 
      status: RequestStatus;
      scheduledDate?: Date;
      allocatedAssetId?: string;
    }) => {
      console.log('🔄 [Optimistic] Updating plant request:', requestId, 'to status:', status);
      
      if (status === 'APPROVED' || status === 'scheduled') {
        const requestDoc = await getDoc(doc(db, 'requests', requestId));
        if (!requestDoc.exists()) {
          throw new Error('Request not found');
        }
        const requestData = requestDoc.data();
        
        const updateData: any = {
          status: scheduledDate ? 'scheduled' : 'APPROVED',
          updatedAt: Timestamp.now(),
          updatedBy: user?.userId || 'unknown',
        };

        if (scheduledDate) {
          updateData.scheduledDeliveryDate = Timestamp.fromDate(scheduledDate);
        }
        
        if (allocatedAssetId) {
          updateData.allocatedAssetId = allocatedAssetId;
        }

        if (!scheduledDate && status === 'APPROVED') {
          updateData.archived = true;
          updateData.approvedAt = Timestamp.now();
          updateData.approvedBy = user?.userId || 'unknown';
        }

        await queueFirestoreOperation(
          { type: 'update', collection: 'requests', docId: requestId, data: updateData },
          { priority: 'P0', entityType: 'activityRequest' }
        );
        
        if (allocatedAssetId) {
          console.log('🚚 Updating plant asset allocation:', allocatedAssetId);
          const assetUpdateData: any = {
            allocationStatus: 'ALLOCATED',
            currentAllocation: {
              siteId: requestData.siteId || user?.siteId,
              siteName: user?.siteName,
              allocatedAt: Timestamp.now(),
              allocatedBy: user?.userId || 'unknown',
              pvArea: requestData.pvArea,
              blockArea: requestData.blockArea,
              requestId: requestId,
              notes: requestData.purpose || '',
            },
            updatedAt: Timestamp.now(),
            updatedBy: user?.userId || 'unknown',
          };
          
          console.log('🚚 Asset allocation data:', JSON.stringify(assetUpdateData, null, 2));
          
          await queueFirestoreOperation(
            { type: 'update', collection: 'plantAssets', docId: allocatedAssetId, data: assetUpdateData },
            { priority: 'P0', entityType: 'plantAsset' }
          );
        }
      } else if (status === 'REJECTED') {
        await queueFirestoreOperation(
          { type: 'update', collection: 'requests', docId: requestId, data: {
            status: 'REJECTED',
            updatedAt: Timestamp.now(),
            updatedBy: user?.userId || 'unknown',
            archived: true,
          }},
          { priority: 'P0', entityType: 'activityRequest' }
        );
      }
    },
    onSuccess: (_, variables) => {
      console.log('✅ [Optimistic] Plant request mutation completed');
      setOptimisticallyHiddenCards((prev) => {
        const next = new Set(prev);
        next.delete(variables.requestId);
        return next;
      });
    },
    onError: (error, variables) => {
      console.error('❌ [Optimistic] Plant request mutation error:', error);
      setOptimisticallyHiddenCards((prev) => {
        const next = new Set(prev);
        next.delete(variables.requestId);
        return next;
      });
      Alert.alert('Error', 'Failed to update request. Please try again.');
    },
  });

  const handleApproveInternal = (requestId: string) => {
    const asset = selectedAsset[requestId];
    if (!asset) {
      Alert.alert('Error', 'Please select a plant asset before approving');
      return;
    }
    
    const scheduledDateTime = activeRequestId === requestId ? selectedDate : undefined;
    
    console.log('[Optimistic] Approving plant request:', requestId, 'asset:', asset, 'scheduledDate:', scheduledDateTime);
    setOptimisticallyHiddenCards((prev) => new Set(prev).add(requestId));
    updateRequestMutation.mutate({ 
      requestId, 
      status: 'APPROVED',
      allocatedAssetId: asset,
      scheduledDate: scheduledDateTime
    });
  };

  const handleScheduleClick = (requestId: string) => {
    setActiveRequestId(requestId);
    setSelectedDate(new Date());
    if (Platform.OS === 'web') {
      setShowDateTimePicker(true);
    } else {
      setShowDatePicker(true);
    }
  };
  
  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (event.type === 'set' && date) {
        setSelectedDate(date);
        setShowTimePicker(true);
      }
    } else if (Platform.OS === 'ios') {
      if (date) {
        setSelectedDate(date);
      }
    }
  };
  
  const handleTimeChange = (event: any, time?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
      if (event.type === 'set' && time) {
        const newDateTime = new Date(selectedDate);
        newDateTime.setHours(time.getHours());
        newDateTime.setMinutes(time.getMinutes());
        setSelectedDate(newDateTime);
      }
    } else if (Platform.OS === 'ios' && time) {
      const newDateTime = new Date(selectedDate);
      newDateTime.setHours(time.getHours());
      newDateTime.setMinutes(time.getMinutes());
      setSelectedDate(newDateTime);
    }
  };

  const handleWebDateChange = (e: any) => {
    const dateValue = e.target.value;
    if (dateValue) {
      const newDate = new Date(selectedDate);
      const [year, month, day] = dateValue.split('-').map(Number);
      newDate.setFullYear(year);
      newDate.setMonth(month - 1);
      newDate.setDate(day);
      setSelectedDate(newDate);
    }
  };

  const handleWebTimeChange = (e: any) => {
    const timeValue = e.target.value;
    if (timeValue) {
      const newDate = new Date(selectedDate);
      const [hours, minutes] = timeValue.split(':').map(Number);
      newDate.setHours(hours);
      newDate.setMinutes(minutes);
      setSelectedDate(newDate);
    }
  };

  const handleDateTimeConfirm = () => {
    setShowDateTimePicker(false);
    if (Platform.OS === 'ios') {
      setShowDatePicker(false);
      setShowTimePicker(false);
    }
  };

  const handleDateTimeCancel = () => {
    setShowDateTimePicker(false);
    setShowDatePicker(false);
    setShowTimePicker(false);
    setActiveRequestId(null);
  };

  const handleRejectInternal = (requestId: string) => {
    console.log('[Optimistic] Rejecting plant request:', requestId);
    setOptimisticallyHiddenCards((prev) => new Set(prev).add(requestId));
    updateRequestMutation.mutate({ requestId, status: 'REJECTED' });
  };

  const restoreMutation = useMutation({
    mutationFn: async (requestId: string) => {
      console.log('🔄 Restoring request:', requestId);
      if (!user?.userId) {
        throw new Error('User ID not found');
      }
      await restoreRequest(requestId, user.userId);
    },
    onSuccess: () => {
      console.log('✅ Request restored successfully');
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert('Success', 'Request restored to incoming tab');
    },
    onError: (error) => {
      console.error('❌ Error restoring request:', error);
      Alert.alert('Error', 'Failed to restore request. Please try again.');
    },
  });

  const incomingRequests = requests.filter(r => r.status === 'PENDING' && !r.archived && !optimisticallyHiddenCards.has(r.id));
  const scheduledRequests = requests.filter(r => r.status === 'scheduled' && !r.archived);
  const archivedRequests = requests.filter(r => r.archived);
  const pendingCount = incomingRequests.length;

  const groupedArchived = useMemo(() => {
    return groupRequestsByMonth(archivedRequests);
  }, [archivedRequests]);

  const groupedByYear = useMemo(() => {
    const byYear: Record<number, Record<string, { year: number; month: number; requests: PlantRequest[] }>> = {};
    
    Object.entries(groupedArchived).forEach(([key, group]) => {
      const year = group.year;
      if (!byYear[year]) {
        byYear[year] = {};
      }
      byYear[year][key] = group;
    });
    
    return byYear;
  }, [groupedArchived]);

  const sortedYears = useMemo(() => {
    return Object.keys(groupedByYear).map(Number).sort((a, b) => b - a);
  }, [groupedByYear]);

  const getSortedMonthsForYear = (year: number) => {
    const months = groupedByYear[year];
    return Object.entries(months).sort(([keyA], [keyB]) => {
      const [, monthA] = keyA.split('-').map(Number);
      const [, monthB] = keyB.split('-').map(Number);
      return monthB - monthA;
    });
  };
  
  console.log('\n🔢 FILTER RESULTS:');
  console.log('   Total requests:', requests.length);
  console.log('   Incoming (PENDING + not archived):', incomingRequests.length);
  console.log('   Scheduled:', scheduledRequests.length);
  console.log('   Archived:', archivedRequests.length);
  console.log('   Optimistically hidden:', optimisticallyHiddenCards.size);

  const getStatusColor = (status: RequestStatus) => {
    switch (status) {
      case 'APPROVED': return '#10b981';
      case 'scheduled': return '#3b82f6';
      case 'REJECTED': return '#ef4444';
      case 'CANCELLED': return '#6b7280';
      default: return '#f59e0b';
    }
  };

  const getStatusIcon = (status: RequestStatus) => {
    switch (status) {
      case 'APPROVED': return CheckCircle;
      case 'scheduled': return Clock;
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

  const handleCleanupArchive = async () => {
    if (!user?.siteId || !user?.userId) {
      Alert.alert('Error', 'User information not available');
      return;
    }

    Alert.alert(
      'Cleanup Archive',
      'This will organize all archived requests older than the current month into monthly folders. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Cleanup',
          style: 'default',
          onPress: async () => {
            try {
              setIsCleaningUp(true);
              const result = await archiveRequestsByMonth(user.siteId!, 'PLANT_ALLOCATION_REQUEST', user.userId!);
              Alert.alert(
                'Cleanup Complete',
                `Organized ${result.archived} requests into ${result.byMonth.length} monthly archives`
              );
            } catch (error) {
              console.error('Error cleaning up archive:', error);
              Alert.alert('Error', 'Failed to cleanup archive');
            } finally {
              setIsCleaningUp(false);
            }
          },
        },
      ]
    );
  };

  const handleRestore = (requestId: string) => {
    restoreMutation.mutate(requestId);
  };

  const handleSchedulePlant = async (requestId: string) => {
    const asset = selectedAsset[requestId];
    if (!asset) {
      Alert.alert('Error', 'Please select a plant asset before scheduling');
      return;
    }
    
    const scheduledDateTime = activeRequestId === requestId ? selectedDate : undefined;
    
    if (scheduledDateTime) {
      console.log('[SchedulePlant] Scheduling plant for request:', requestId, 'asset:', asset, 'scheduledDate:', scheduledDateTime);
      setOptimisticallyHiddenCards((prev) => new Set(prev).add(requestId));
      updateRequestMutation.mutate({ 
        requestId, 
        status: 'scheduled',
        allocatedAssetId: asset,
        scheduledDate: scheduledDateTime,
      });
    } else {
      console.log('[AllocatePlant] Allocating plant immediately for request:', requestId, 'asset:', asset);
      setOptimisticallyHiddenCards((prev) => new Set(prev).add(requestId));
      updateRequestMutation.mutate({ 
        requestId, 
        status: 'APPROVED',
        allocatedAssetId: asset,
      });
    }
  };

  const handleAllocatePlant = async (requestId: string) => {
    const asset = selectedAsset[requestId];
    if (!asset) {
      Alert.alert('Error', 'Please select a plant asset before allocating');
      return;
    }
    
    console.log('[AllocatePlant] Allocating plant for request:', requestId, 'asset:', asset);
    setOptimisticallyHiddenCards((prev) => new Set(prev).add(requestId));
    updateRequestMutation.mutate({ 
      requestId, 
      status: 'APPROVED',
      allocatedAssetId: asset,
    });
  };

  const handleReschedule = (requestId: string) => {
    setActiveRequestId(requestId);
    setSelectedDate(new Date());
    if (Platform.OS === 'web') {
      setShowDateTimePicker(true);
    } else {
      setShowDatePicker(true);
    }
  };

  const handleRescheduleConfirm = async (requestId: string) => {
    try {
      console.log('[Reschedule] Rescheduling request:', requestId, 'to:', selectedDate);
      await queueFirestoreOperation(
        { type: 'update', collection: 'requests', docId: requestId, data: {
          scheduledDeliveryDate: Timestamp.fromDate(selectedDate),
          updatedAt: Timestamp.now(),
          updatedBy: user?.userId || 'unknown',
          notificationSent: false,
        }},
        { priority: 'P0', entityType: 'activityRequest' }
      );
      Alert.alert('Success', 'Plant allocation rescheduled');
      setActiveRequestId(null);
    } catch (error) {
      console.error('[Reschedule] Error:', error);
      Alert.alert('Error', 'Failed to reschedule request');
    }
  };

  const handleArchiveScheduled = async (requestId: string) => {
    Alert.alert(
      'Archive Request',
      'Are you sure you want to archive this scheduled allocation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('[Archive] Archiving request:', requestId);
              await queueFirestoreOperation(
                { type: 'update', collection: 'requests', docId: requestId, data: {
                  archived: true,
                  archivedAt: Timestamp.now(),
                  updatedAt: Timestamp.now(),
                  updatedBy: user?.userId || 'unknown',
                }},
                { priority: 'P0', entityType: 'activityRequest' }
              );
              Alert.alert('Success', 'Request archived');
            } catch (error) {
              console.error('[Archive] Error:', error);
              Alert.alert('Error', 'Failed to archive request');
            }
          },
        },
      ]
    );
  };

  const renderRequest = (request: PlantRequest, showActions: boolean) => {
    const StatusIcon = getStatusIcon(request.status);
    const statusColor = getStatusColor(request.status);
    const isExpanded = expandedRequests[request.id] || false;
    const isScheduled = request.status === 'scheduled';

    const runApproveAction = () => {
      const execute = protectAction(
        `approve-${request.id}`,
        () => handleApproveInternal(request.id)
      );
      void execute();
    };

    const runScheduleAction = () => {
      const execute = protectAction(
        `schedule-${request.id}`,
        () => handleSchedulePlant(request.id)
      );
      void execute();
    };

    const runAllocateAction = () => {
      const execute = protectAction(
        `allocate-${request.id}`,
        () => handleAllocatePlant(request.id)
      );
      void execute();
    };

    const runRejectAction = () => {
      const execute = protectAction(
        `reject-${request.id}`,
        () => handleRejectInternal(request.id)
      );
      void execute();
    };

    return (
      <View key={request.id} style={styles.requestCard}>
        <TouchableOpacity
          onPress={() => {
            setExpandedRequests(prev => ({ ...prev, [request.id]: !isExpanded }));
          }}
          activeOpacity={0.7}
        >
          <View style={styles.requestHeader}>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
              <StatusIcon size={16} color={statusColor} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {request.status === 'scheduled' ? 'SCHEDULED' : request.status}
              </Text>
            </View>
          </View>

          <View style={styles.titleRow}>
            <Text style={styles.requestTitle}>{request.plantType || 'Plant Allocation Request'}</Text>
            {isExpanded ? 
              <ChevronUp size={20} color="#64748b" /> : 
              <ChevronDown size={20} color="#64748b" />
            }
          </View>
          
          {!isExpanded && request.quantity && (
            <View style={styles.quantityRow}>
              <Text style={styles.quantityLabel}>Quantity:</Text>
              <Text style={styles.quantityValue}>{request.quantity} units</Text>
            </View>
          )}
          
          {isExpanded && (
            <>
              {request.quantity && (
                <View style={styles.quantityRow}>
                  <Text style={styles.quantityLabel}>Quantity:</Text>
                  <Text style={styles.quantityValue}>{request.quantity} units</Text>
                </View>
              )}
              
              {request.purpose && (
                <View style={styles.purposeContainer}>
                  <Text style={styles.purposeLabel}>Purpose:</Text>
                  <Text style={styles.purposeText}>{request.purpose}</Text>
                </View>
              )}

              {request.duration && (
                <View style={styles.durationContainer}>
                  <Clock size={16} color="#64748b" />
                  <Text style={styles.durationLabel}>Duration:</Text>
                  <Text style={styles.durationValue}>{request.duration}</Text>
                </View>
              )}

              <View style={styles.taskDetailsRow}>
                {request.mainMenuName && (
                  <View style={styles.taskDetailItem}>
                    <Text style={styles.taskDetailLabel}>Menu:</Text>
                    <Text style={styles.taskDetailValue}>{request.mainMenuName}</Text>
                  </View>
                )}
                {request.subMenuName && (
                  <View style={styles.taskDetailItem}>
                    <Text style={styles.taskDetailLabel}>Sub Menu:</Text>
                    <Text style={styles.taskDetailValue}>{request.subMenuName}</Text>
                  </View>
                )}
              </View>

              <View style={styles.requestMeta}>
                <Text style={styles.metaLabel}>Requested by:</Text>
                <Text style={styles.metaValue}>{request.requestedByName || request.requestedBy}</Text>
              </View>

              {(request.pvArea || request.blockArea) && (
                <View style={styles.locationInfoRow}>
                  {request.pvArea && (
                    <View style={styles.locationBadge}>
                      <Text style={styles.locationLabel}>PV Area:</Text>
                      <Text style={styles.locationValue}>{request.pvArea}</Text>
                    </View>
                  )}
                  {request.blockArea && (
                    <View style={styles.locationBadge}>
                      <Text style={styles.locationLabel}>Block Area:</Text>
                      <Text style={styles.locationValue}>{request.blockArea}</Text>
                    </View>
                  )}
                </View>
              )}

              {request.scheduledDeliveryDate && (
                <View style={styles.scheduledDateContainer}>
                  <Calendar size={16} color="#3b82f6" />
                  <Text style={styles.scheduledDateLabel}>Scheduled Allocation:</Text>
                  <Text style={styles.scheduledDateValue}>{formatTimestamp(request.scheduledDeliveryDate)}</Text>
                </View>
              )}
              
              {activeRequestId === request.id && selectedDate && (
                <View style={styles.scheduledDateContainer}>
                  <Calendar size={16} color="#3b82f6" />
                  <Text style={styles.scheduledDateLabel}>Selected Date:</Text>
                  <Text style={styles.scheduledDateValue}>{formatTimestamp(Timestamp.fromDate(selectedDate))}</Text>
                </View>
              )}

              {request.notes && (
                <View style={styles.notesContainer}>
                  <Text style={styles.notesLabel}>Notes:</Text>
                  <Text style={styles.notesText}>{request.notes}</Text>
                </View>
              )}
            </>
          )}
        </TouchableOpacity>

        {request.archived && (
          <TouchableOpacity
            style={styles.restoreButton}
            onPress={() => handleRestore(request.id)}
            activeOpacity={0.7}
            disabled={restoreMutation.isPending}
          >
            <RotateCcw size={14} color="#10b981" />
            <Text style={styles.restoreButtonText}>Restore</Text>
          </TouchableOpacity>
        )}

        {showActions && isExpanded && !request.archived && (
          <View style={styles.expandedActions}>
            <TouchableOpacity
              style={styles.scheduleButtonLarge}
              activeOpacity={0.8}
              onPress={() => handleScheduleClick(request.id)}
              disabled={updateRequestMutation.isPending}
            >
              <Calendar size={20} color="#3b82f6" />
              <Text style={styles.scheduleButtonText}>Schedule Allocation</Text>
            </TouchableOpacity>
            
            <View style={styles.assetSelectionContainer}>
              <Text style={styles.assetSelectionLabel}>Select Plant Asset *</Text>
              <TouchableOpacity
                style={styles.assetDropdownButton}
                onPress={() => setShowAssetPicker(showAssetPicker === request.id ? null : request.id)}
              >
                <Package size={18} color="#5f6368" />
                <Text style={[styles.assetDropdownText, !selectedAsset[request.id] && styles.assetPlaceholder]}>
                  {selectedAsset[request.id] ? 
                    plantAssets.find(a => a.id === selectedAsset[request.id])?.assetId || 'Select asset' :
                    'Select asset'}
                </Text>
                <ChevronDown size={18} color="#5f6368" />
              </TouchableOpacity>
              
              {selectedAsset[request.id] && (() => {
                const asset = plantAssets.find(a => a.id === selectedAsset[request.id]);
                const currentPvArea = asset?.currentAllocation?.pvArea;
                const currentBlockArea = asset?.currentAllocation?.blockArea;
                
                if (currentPvArea || currentBlockArea) {
                  return (
                    <View style={styles.currentAllocationInfo}>
                      <Text style={styles.currentAllocationLabel}>Current Location:</Text>
                      <View style={styles.currentAllocationBadges}>
                        {currentPvArea && (
                          <View style={styles.currentAllocationBadge}>
                            <Text style={styles.currentAllocationBadgeText}>PV Area: {currentPvArea}</Text>
                          </View>
                        )}
                        {currentBlockArea && (
                          <View style={styles.currentAllocationBadge}>
                            <Text style={styles.currentAllocationBadgeText}>Block: {currentBlockArea}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                }
                return null;
              })()}
              
              {showAssetPicker === request.id && (
                <View style={styles.assetDropdown}>
                  <ScrollView style={styles.assetDropdownScroll} nestedScrollEnabled>
                    {(() => {
                      console.log('🔍 Filtering assets for request:', request.id);
                      console.log('🔍 Request plantType:', request.plantType);
                      console.log('🔍 All plant assets:', plantAssets.length);
                      console.log('🔍 Asset types available:', plantAssets.map(a => a.type));
                      
                      const matchingAssets = plantAssets.filter(asset => {
                        const typeMatch = asset.type === request.plantType;
                        const notBrokenDown = !asset.breakdownStatus;
                        console.log(`🔍 Asset ${asset.id} (${asset.type}) vs ${request.plantType}: typeMatch=${typeMatch}, breakdownStatus=${asset.breakdownStatus}, notBrokenDown=${notBrokenDown}`);
                        return typeMatch && notBrokenDown;
                      });
                      
                      console.log('🔍 Matching assets:', matchingAssets.length);
                      
                      if (matchingAssets.length === 0) {
                        return (
                          <View style={styles.assetEmptyContainer}>
                            <Text style={styles.assetEmptyText}>No available {request.plantType} assets</Text>
                          </View>
                        );
                      }
                      
                      return matchingAssets.map(asset => (
                        <TouchableOpacity
                          key={asset.id}
                          style={styles.assetDropdownItem}
                          onPress={() => {
                            setSelectedAsset(prev => ({ ...prev, [request.id]: asset.id || '' }));
                            setShowAssetPicker(null);
                          }}
                        >
                          <View style={styles.assetItemContent}>
                            <Text style={styles.assetItemTitle}>{asset.assetId}</Text>
                            <Text style={styles.assetItemSubtitle}>{asset.type}</Text>
                            {asset.location && (
                              <Text style={styles.assetItemLocation}>📍 {asset.location}</Text>
                            )}
                            {(asset.currentAllocation?.pvArea || asset.currentAllocation?.blockArea) && (
                              <View style={styles.assetCurrentLocationRow}>
                                {asset.currentAllocation?.pvArea && (
                                  <Text style={styles.assetCurrentLocationText}>PV: {asset.currentAllocation.pvArea}</Text>
                                )}
                                {asset.currentAllocation?.blockArea && (
                                  <Text style={styles.assetCurrentLocationText}>Block: {asset.currentAllocation.blockArea}</Text>
                                )}
                              </View>
                            )}
                          </View>
                        </TouchableOpacity>
                      ));
                    })()}
                  </ScrollView>
                </View>
              )}
            </View>
            
            <View style={styles.finalActionButtons}>
              {!isScheduled ? (
                <>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    activeOpacity={0.8}
                    onPress={runRejectAction}
                    disabled={updateRequestMutation.isPending}
                  >
                    <XCircle size={18} color="#fff" />
                    <Text style={styles.actionButtonText}>Reject</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.approveButton, !selectedAsset[request.id] && styles.disabledButton]}
                    activeOpacity={0.8}
                    onPress={runScheduleAction}
                    disabled={updateRequestMutation.isPending || !selectedAsset[request.id]}
                  >
                    <Truck size={18} color="#fff" />
                    <Text style={styles.actionButtonText}>Allocate Plant</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#6b7280' }]}
                    activeOpacity={0.8}
                    onPress={() => handleArchiveScheduled(request.id)}
                    disabled={updateRequestMutation.isPending}
                  >
                    <Archive size={18} color="#fff" />
                    <Text style={styles.actionButtonText}>Archive</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#3b82f6' }]}
                    activeOpacity={0.8}
                    onPress={() => handleReschedule(request.id)}
                    disabled={updateRequestMutation.isPending}
                  >
                    <RotateCcw size={18} color="#fff" />
                    <Text style={styles.actionButtonText}>Reschedule</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.approveButton, !selectedAsset[request.id] && styles.disabledButton]}
                    activeOpacity={0.8}
                    onPress={runAllocateAction}
                    disabled={updateRequestMutation.isPending || !selectedAsset[request.id]}
                  >
                    <Truck size={18} color="#fff" />
                    <Text style={styles.actionButtonText}>Allocate Plant</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        )}
        
        <TimestampFooter
          createdAt={request.createdAt || request.requestedAt}
          createdBy={request.requestedByName || request.requestedBy}
          updatedAt={request.approvedAt || request.updatedAt}
          updatedBy={request.approvedBy || request.updatedBy}
          actionLabel={request.status === 'APPROVED' ? 'Approved' : request.status === 'REJECTED' ? 'Rejected' : request.status === 'scheduled' ? 'Scheduled' : 'Updated'}
        />
      </View>
    );
  };

  const scrollContentStyle = useMemo(() => ({
    paddingBottom: Math.max(insets.bottom + 120, 160),
  }), [insets.bottom]);

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 0) }]}> 
      <Stack.Screen
        options={{
          title: 'Plant Allocation Requests',
          headerStyle: {
            backgroundColor: '#000',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: '600' as const,
          },
          headerRight: () => (
            <View style={styles.headerRightContainer}>
              <Text style={styles.headerUserName}>{user?.name || 'User'}</Text>
              <Text style={styles.headerCompanyAlias}>{user?.companyName || ''}</Text>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => router.push('/plant-allocation-overview')}
                activeOpacity={0.7}
              >
                <LayoutGrid size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, scrollContentStyle]}
      >
        <View style={styles.siteBadgeContainer}>
          <MapPin size={14} color="#10b981" />
          <Text style={styles.siteBadgeText}>{user?.siteName || 'Site'}</Text>
        </View>

        <View style={styles.headerCard}>
          <View style={styles.counterBadge}>
            <Text style={styles.counterText}>{pendingCount}</Text>
          </View>
          <Text style={styles.headerTitle}>Plant Allocation Requests</Text>
          <Text style={styles.headerSubtitle}>
            {pendingCount} pending approval
          </Text>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'incoming' && styles.activeTab]}
            activeOpacity={0.7}
            onPress={() => setActiveTab('incoming')}
          >
            <Truck size={20} color={activeTab === 'incoming' ? '#fff' : '#64748b'} />
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
            style={[styles.tab, activeTab === 'scheduled' && styles.activeTab]}
            activeOpacity={0.7}
            onPress={() => setActiveTab('scheduled')}
          >
            <Clock size={20} color={activeTab === 'scheduled' ? '#fff' : '#64748b'} />
            <Text style={[styles.tabText, activeTab === 'scheduled' && styles.activeTabText]}>
              Scheduled
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'archived' && styles.activeTab]}
            activeOpacity={0.7}
            onPress={() => setActiveTab('archived')}
          >
            <Archive size={20} color={activeTab === 'archived' ? '#fff' : '#64748b'} />
            <Text style={[styles.tabText, activeTab === 'archived' && styles.activeTabText]}>
              Archive
            </Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#f59e0b" />
            <Text style={styles.loadingText}>Loading requests...</Text>
          </View>
        ) : (
          <View style={styles.section}>
            {activeTab === 'incoming' ? (
              incomingRequests.length > 0 ? (
                incomingRequests.map(request => renderRequest(request, true))
              ) : (
                <View style={styles.emptyContainer}>
                  <Truck size={48} color="#cbd5e1" />
                  <Text style={styles.emptyText}>No incoming requests</Text>
                </View>
              )
            ) : activeTab === 'scheduled' ? (
              scheduledRequests.length > 0 ? (
                scheduledRequests.map(request => renderRequest(request, true))
              ) : (
                <View style={styles.emptyContainer}>
                  <Clock size={48} color="#cbd5e1" />
                  <Text style={styles.emptyText}>No scheduled allocations</Text>
                </View>
              )
            ) : (
              <>
                {sortedYears.length > 0 && (
                  <View style={styles.cleanupButtonContainer}>
                    <TouchableOpacity
                      style={styles.cleanupButton}
                      onPress={handleCleanupArchive}
                      disabled={isCleaningUp}
                      activeOpacity={0.7}
                    >
                      <Package size={18} color="#fff" />
                      <Text style={styles.cleanupButtonText}>
                        {isCleaningUp ? 'Cleaning up...' : 'Cleanup Archive'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
                {sortedYears.length > 0 ? (
                  sortedYears.map(year => {
                    const monthsForYear = getSortedMonthsForYear(year);
                    const totalRequestsInYear = monthsForYear.reduce((sum, [, group]) => sum + group.requests.length, 0);
                    
                    return (
                      <View key={year} style={styles.yearGroup}>
                        <View style={styles.yearHeader}>
                          <Calendar size={20} color="#10b981" />
                          <Text style={styles.yearHeaderText}>{year}</Text>
                          <View style={styles.yearBadge}>
                            <Text style={styles.yearBadgeText}>{totalRequestsInYear}</Text>
                          </View>
                        </View>
                        
                        {monthsForYear.map(([key, group]) => {
                          const isMonthExpanded = expandedMonths[key];
                          return (
                            <View key={key} style={styles.monthGroup}>
                              <TouchableOpacity
                                style={styles.monthHeader}
                                onPress={() => {
                                  setExpandedMonths(prev => ({ ...prev, [key]: !prev[key] }));
                                }}
                                activeOpacity={0.7}
                              >
                                {isMonthExpanded ? 
                                  <ChevronDown size={16} color="#3b82f6" /> : 
                                  <ChevronUp size={16} color="#3b82f6" />
                                }
                                <Calendar size={16} color="#3b82f6" />
                                <Text style={styles.monthHeaderText}>
                                  {getMonthLabel(group.month, group.year)}
                                </Text>
                                <View style={styles.monthBadge}>
                                  <Text style={styles.monthBadgeText}>{group.requests.length}</Text>
                                </View>
                              </TouchableOpacity>
                              {isMonthExpanded && group.requests.map(request => renderRequest(request, false))}
                            </View>
                          );
                        })}
                      </View>
                    );
                  })
                ) : (
                  <View style={styles.emptyContainer}>
                    <Archive size={48} color="#cbd5e1" />
                    <Text style={styles.emptyText}>No archived requests</Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>
      
      {Platform.OS === 'web' && showDateTimePicker && (
        <Modal
          visible={showDateTimePicker}
          transparent
          animationType="fade"
          onRequestClose={handleDateTimeCancel}
        >
          <View style={styles.dateTimeModalOverlay}>
            <View style={styles.dateTimeModalContainer}>
              <View style={styles.dateTimeModalHeader}>
                <View style={styles.dateTimeHeaderLeft}>
                  <Calendar size={24} color="#3b82f6" />
                  <Text style={styles.dateTimeModalTitle}>Schedule Allocation</Text>
                </View>
                <TouchableOpacity onPress={handleDateTimeCancel} style={styles.dateTimeCloseButton}>
                  <X size={24} color="#64748b" />
                </TouchableOpacity>
              </View>

              <View style={styles.dateTimeModalContent}>
                <View style={styles.dateTimeInputGroup}>
                  <Text style={styles.dateTimeLabel}>Date *</Text>
                  <input
                    type="date"
                    value={selectedDate.toISOString().split('T')[0]}
                    onChange={handleWebDateChange}
                    style={{
                      width: '100%',
                      padding: 12,
                      borderRadius: 8,
                      border: '1.5px solid #e2e8f0',
                      fontSize: 14,
                      fontFamily: 'system-ui',
                      backgroundColor: '#fff',
                    }}
                  />
                </View>

                <View style={styles.dateTimeInputGroup}>
                  <Text style={styles.dateTimeLabel}>Time *</Text>
                  <input
                    type="time"
                    value={`${String(selectedDate.getHours()).padStart(2, '0')}:${String(selectedDate.getMinutes()).padStart(2, '0')}`}
                    onChange={handleWebTimeChange}
                    style={{
                      width: '100%',
                      padding: 12,
                      borderRadius: 8,
                      border: '1.5px solid #e2e8f0',
                      fontSize: 14,
                      fontFamily: 'system-ui',
                      backgroundColor: '#fff',
                    }}
                  />
                </View>

                <View style={styles.selectedDateTimePreview}>
                  <Clock size={16} color="#3b82f6" />
                  <Text style={styles.selectedDateTimeText}>
                    {selectedDate.toLocaleDateString('en-GB', { 
                      day: '2-digit', 
                      month: 'short', 
                      year: 'numeric' 
                    })} at {selectedDate.toLocaleTimeString('en-GB', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </Text>
                </View>
              </View>

              <View style={styles.dateTimeModalFooter}>
                <TouchableOpacity
                  style={styles.dateTimeCancelButton}
                  onPress={handleDateTimeCancel}
                  activeOpacity={0.7}
                >
                  <Text style={styles.dateTimeCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dateTimeConfirmButton}
                  onPress={handleDateTimeConfirm}
                  activeOpacity={0.7}
                >
                  <Text style={styles.dateTimeConfirmButtonText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {Platform.OS === 'ios' && (showDatePicker || showTimePicker) && (
        <Modal
          visible={showDatePicker || showTimePicker}
          transparent
          animationType="slide"
          onRequestClose={handleDateTimeCancel}
        >
          <View style={styles.dateTimeModalOverlay}>
            <View style={styles.dateTimeModalContainer}>
              <View style={styles.dateTimeModalHeader}>
                <View style={styles.dateTimeHeaderLeft}>
                  <Calendar size={24} color="#3b82f6" />
                  <Text style={styles.dateTimeModalTitle}>Schedule Allocation</Text>
                </View>
                <TouchableOpacity onPress={handleDateTimeCancel} style={styles.dateTimeCloseButton}>
                  <X size={24} color="#64748b" />
                </TouchableOpacity>
              </View>

              <View style={styles.dateTimeModalContent}>
                <Text style={styles.dateTimeLabel}>Select Date</Text>
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display="spinner"
                  onChange={handleDateChange}
                  style={styles.iosDatePicker}
                />

                <Text style={[styles.dateTimeLabel, { marginTop: 16 }]}>Select Time</Text>
                <DateTimePicker
                  value={selectedDate}
                  mode="time"
                  display="spinner"
                  onChange={handleTimeChange}
                  style={styles.iosDatePicker}
                />

                <View style={styles.selectedDateTimePreview}>
                  <Clock size={16} color="#3b82f6" />
                  <Text style={styles.selectedDateTimeText}>
                    {selectedDate.toLocaleDateString('en-GB', { 
                      day: '2-digit', 
                      month: 'short', 
                      year: 'numeric' 
                    })} at {selectedDate.toLocaleTimeString('en-GB', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </Text>
                </View>
              </View>

              <View style={styles.dateTimeModalFooter}>
                <TouchableOpacity
                  style={styles.dateTimeCancelButton}
                  onPress={handleDateTimeCancel}
                  activeOpacity={0.7}
                >
                  <Text style={styles.dateTimeCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dateTimeConfirmButton}
                  onPress={handleDateTimeConfirm}
                  activeOpacity={0.7}
                >
                  <Text style={styles.dateTimeConfirmButtonText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {Platform.OS === 'android' && showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}
      
      {Platform.OS === 'android' && showTimePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="time"
          display="default"
          onChange={handleTimeChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 48,
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginRight: 8,
  },
  headerUserName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  headerCompanyAlias: {
    fontSize: 12,
    color: '#94a3b8',
  },
  siteBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#065f46',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  siteBadgeText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#10b981',
  },
  headerCard: {
    backgroundColor: '#1a1a1a',
    margin: 16,
    marginTop: 12,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  counterBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  counterText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#fff',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#fff',
    marginTop: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
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
  requestCard: {
    backgroundColor: '#f4f4f5',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e4e4e7',
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
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  requestTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#0f172a',
    flex: 1,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#172554',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  quantityLabel: {
    fontSize: 13,
    color: '#93c5fd',
    marginRight: 8,
    fontWeight: '600' as const,
  },
  quantityValue: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#3b82f6',
  },
  purposeContainer: {
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f4f4f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e4e4e7',
  },
  purposeLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#475569',
    marginBottom: 4,
  },
  purposeText: {
    fontSize: 13,
    color: '#111827',
    lineHeight: 18,
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    gap: 6,
  },
  durationLabel: {
    fontSize: 13,
    color: '#064e3b',
    fontWeight: '600' as const,
    marginLeft: 4,
  },
  durationValue: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#059669',
  },
  requestMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  metaLabel: {
    fontSize: 13,
    color: '#94a3b8',
    marginRight: 6,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#0f172a',
  },
  locationInfoRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  locationBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f4f4f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d4d4d8',
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#475569',
    marginRight: 6,
  },
  locationValue: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#0f172a',
  },
  scheduledDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  scheduledDateLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#1e40af',
  },
  scheduledDateValue: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#3b82f6',
  },
  notesContainer: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f4f4f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e4e4e7',
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#475569',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 13,
    color: '#111827',
    lineHeight: 18,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
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
  scheduleButton: {
    backgroundColor: '#3b82f6',
  },
  approveButton: {
    backgroundColor: '#10b981',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#fff',
  },
  expandedActions: {
    marginTop: 16,
    gap: 12,
  },
  scheduleButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
    gap: 8,
  },
  scheduleButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#3b82f6',
  },
  assetSelectionContainer: {
    gap: 8,
  },
  assetSelectionLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#0f172a',
  },
  assetDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#f4f4f5',
    borderWidth: 1.5,
    borderColor: '#d4d4d8',
    gap: 8,
  },
  assetDropdownText: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '500' as const,
  },
  assetPlaceholder: {
    color: '#475569',
  },
  assetDropdown: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginTop: 4,
    borderWidth: 1.5,
    borderColor: '#e4e4e7',
    maxHeight: 200,
  },
  assetDropdownScroll: {
    maxHeight: 200,
  },
  assetDropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e4e4e7',
  },
  assetItemContent: {
    gap: 4,
  },
  assetItemTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#0f172a',
  },
  assetItemSubtitle: {
    fontSize: 12,
    color: '#475569',
  },
  assetItemLocation: {
    fontSize: 11,
    color: '#475569',
  },
  assetCurrentLocationRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  assetCurrentLocationText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#3b82f6',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  currentAllocationInfo: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  currentAllocationLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#1e40af',
    marginBottom: 8,
  },
  currentAllocationBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  currentAllocationBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#93c5fd',
  },
  currentAllocationBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#1e40af',
  },
  assetEmptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  assetEmptyText: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
  },
  finalActionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  disabledButton: {
    opacity: 0.5,
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
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#333',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  activeTab: {
    backgroundColor: '#3b82f6',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#94a3b8',
  },
  activeTabText: {
    color: '#fff',
    fontWeight: '600' as const,
  },
  badge: {
    backgroundColor: '#ef4444',
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
  taskDetailsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  taskDetailItem: {
    flex: 1,
    backgroundColor: '#172554',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  taskDetailLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#93c5fd',
    textTransform: 'uppercase' as const,
    marginBottom: 2,
  },
  taskDetailValue: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#fff',
  },
  dateTimeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dateTimeModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  dateTimeModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  dateTimeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateTimeModalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1e293b',
  },
  dateTimeCloseButton: {
    padding: 4,
  },
  dateTimeModalContent: {
    padding: 20,
  },
  dateTimeInputGroup: {
    marginBottom: 16,
  },
  dateTimeLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#334155',
    marginBottom: 8,
  },
  selectedDateTimePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    marginTop: 16,
  },
  selectedDateTimeText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#3b82f6',
  },
  dateTimeModalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  dateTimeCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  dateTimeCancelButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#64748b',
  },
  dateTimeConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
  },
  dateTimeConfirmButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  iosDatePicker: {
    width: '100%',
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#d1fae5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10b981',
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  restoreButtonText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600' as const,
  },
  cleanupButtonContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  cleanupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    backgroundColor: '#3b82f6',
    borderRadius: 10,
  },
  cleanupButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  yearGroup: {
    marginBottom: 24,
  },
  yearHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#065f46',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#10b981',
  },
  yearHeaderText: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#10b981',
  },
  yearBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    minWidth: 32,
    alignItems: 'center',
  },
  yearBadgeText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#fff',
  },
  monthGroup: {
    marginBottom: 16,
    paddingLeft: 8,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  monthHeaderText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  monthBadge: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 28,
    alignItems: 'center',
  },
  monthBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
