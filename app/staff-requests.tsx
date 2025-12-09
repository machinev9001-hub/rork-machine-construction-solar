import { Stack, useRouter } from 'expo-router';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Modal, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Users, CheckCircle, XCircle, Clock, Archive, Calendar, ChevronDown, Package, MapPin, Grid, RotateCcw } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import TimestampFooter from '../components/TimestampFooter';
import { useAuth } from '../contexts/AuthContext';
import { useMutation } from '@tanstack/react-query';
import { useButtonProtection } from '../utils/hooks/useButtonProtection';
import { useSyncOnFocus } from '../utils/hooks/useSyncOnFocus';
import { collection, query, where, orderBy, doc, Timestamp, onSnapshot, getDocs, getDoc } from 'firebase/firestore';
import { queueFirestoreOperation } from '../utils/offlineQueue';
import { db } from '../config/firebase';
import { RequestStatus } from '../types';
import { useState, useEffect, useMemo } from 'react';
import { restoreRequest, archiveRequestsByMonth, groupRequestsByMonth, getMonthLabel } from '../utils/requestArchive';
import * as Haptics from 'expo-haptics';

type StaffRequest = {
  id: string;
  type: 'STAFF_REQUEST';
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
  staffType?: string;
  numberOfStaff?: number;
  skillsRequired?: string;
  duration?: string;
  startDate?: string;
  archived?: boolean;
  supervisorId?: string;
  supervisorName?: string;
  pvArea?: string;
  blockArea?: string;
  scheduledAssignmentDate?: Timestamp;
  allocatedEmployeeIds?: string[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  updatedBy?: string;
  approvedAt?: Timestamp;
  approvedBy?: string;
  notes?: string;
};

export default function StaffRequestsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { protectAction } = useButtonProtection();
  useSyncOnFocus();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'incoming' | 'scheduled' | 'archived'>('incoming');
  const [requests, setRequests] = useState<StaffRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedRequests, setExpandedRequests] = useState<Record<string, boolean>>({});
  const [optimisticallyHiddenCards, setOptimisticallyHiddenCards] = useState<Set<string>>(() => new Set<string>());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<Record<string, string[]>>({});
  const [showEmployeePicker, setShowEmployeePicker] = useState<string | null>(null);
  const [pvAreas, setPvAreas] = useState<any[]>([]);
  const [blockAreas, setBlockAreas] = useState<any[]>([]);
  const [selectedPvArea, setSelectedPvArea] = useState<Record<string, string>>({});
  const [selectedBlockArea, setSelectedBlockArea] = useState<Record<string, string>>({});
  const [showPvAreaPicker, setShowPvAreaPicker] = useState<string | null>(null);
  const [showBlockAreaPicker, setShowBlockAreaPicker] = useState<string | null>(null);
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  useEffect(() => {
    if (!user?.siteId) {
      console.log('❌ STAFF REQUEST QUERY - No siteId');
      setIsLoading(false);
      return;
    }

    console.log('🔍 STAFF REQUEST REALTIME - Setting up listener for siteId:', user.siteId);
    setIsLoading(true);

    const requestsRef = collection(db, 'requests');
    const q = query(
      requestsRef,
      where('type', '==', 'STAFF_REQUEST'),
      where('siteId', '==', user.siteId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        console.log('📊 STAFF REQUEST REALTIME - Received', snapshot.docs.length, 'documents');
        const results: StaffRequest[] = [];
        
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          const requestData: StaffRequest = {
            id: docSnap.id,
            ...data
          } as StaffRequest;

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
        
        setRequests(results);
        setIsLoading(false);
      },
      (err) => {
        console.error('❌ STAFF REQUEST REALTIME - Error:', err);
        setIsLoading(false);
      }
    );

    return () => {
      console.log('🔴 STAFF REQUEST REALTIME - Cleaning up listener');
      unsubscribe();
    };
  }, [user?.siteId]);

  useEffect(() => {
    const loadEmployees = async () => {
      if (!user?.masterAccountId) {
        console.log('👥 No masterAccountId, cannot load employees');
        return;
      }
      
      try {
        console.log('👥 Loading employees for masterAccountId:', user.masterAccountId);
        const employeesRef = collection(db, 'employees');
        const q = query(
          employeesRef,
          where('masterAccountId', '==', user.masterAccountId),
          where('status', '==', 'ACTIVE')
        );
        
        const snapshot = await getDocs(q);
        const employeesList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        console.log('👥 Loaded employees:', employeesList.length);
        console.log('👥 Employee roles:', employeesList.map((e: any) => e.role));
        console.log('👥 Full employees data:', JSON.stringify(employeesList, null, 2));
        setEmployees(employeesList);
      } catch (error) {
        console.error('❌ Error loading employees:', error);
        console.error('❌ Error details:', JSON.stringify(error, null, 2));
      }
    };
    
    loadEmployees();
  }, [user?.masterAccountId]);

  useEffect(() => {
    const loadPvAreas = async () => {
      if (!user?.siteId) {
        console.log('📍 No siteId, cannot load PV areas');
        return;
      }
      
      try {
        console.log('📍 Loading PV areas for siteId:', user.siteId);
        const pvAreasRef = collection(db, 'pvAreas');
        const q = query(
          pvAreasRef,
          where('siteId', '==', user.siteId)
        );
        
        const snapshot = await getDocs(q);
        const areasList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        console.log('📍 Loaded PV areas:', areasList.length);
        setPvAreas(areasList);
      } catch (error) {
        console.error('❌ Error loading PV areas:', error);
      }
    };
    
    const loadBlockAreas = async () => {
      if (!user?.siteId) {
        console.log('📍 No siteId, cannot load block areas');
        return;
      }
      
      try {
        console.log('📍 Loading block areas for siteId:', user.siteId);
        const blockAreasRef = collection(db, 'blockAreas');
        const q = query(
          blockAreasRef,
          where('siteId', '==', user.siteId)
        );
        
        const snapshot = await getDocs(q);
        const areasList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        console.log('📍 Loaded block areas:', areasList.length);
        setBlockAreas(areasList);
      } catch (error) {
        console.error('❌ Error loading block areas:', error);
      }
    };
    
    loadPvAreas();
    loadBlockAreas();
  }, [user?.siteId]);

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

  const updateRequestMutation = useMutation({
    mutationFn: async ({ 
      requestId, 
      status, 
      scheduledDate,
      allocatedEmployeeIds,
      pvArea,
      blockArea,
    }: { 
      requestId: string; 
      status: RequestStatus;
      scheduledDate?: Date;
      allocatedEmployeeIds?: string[];
      pvArea?: string;
      blockArea?: string;
    }) => {
      console.log('🔄 [Optimistic] Updating staff request:', requestId, 'to status:', status);
      
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
          updateData.scheduledAssignmentDate = Timestamp.fromDate(scheduledDate);
        }
        
        if (allocatedEmployeeIds) {
          updateData.allocatedEmployeeIds = allocatedEmployeeIds;
        }
        
        if (pvArea) {
          updateData.allocatedPvArea = pvArea;
        }
        
        if (blockArea) {
          updateData.allocatedBlockArea = blockArea;
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
        
        if (allocatedEmployeeIds && allocatedEmployeeIds.length > 0 && pvArea && blockArea) {
          console.log('👥 Updating employee allocations:', allocatedEmployeeIds);
          for (const employeeId of allocatedEmployeeIds) {
            const employeeUpdateData: any = {
              allocationStatus: 'ALLOCATED',
              allocatedPvArea: pvArea,
              allocatedBlockNumber: blockArea,
              allocationDate: Timestamp.now(),
              allocatedBy: user?.userId || 'unknown',
              allocatedToSiteId: requestData.siteId || user?.siteId,
              allocatedToSiteName: user?.siteName,
              updatedAt: Timestamp.now(),
              updatedBy: user?.userId || 'unknown',
            };
            
            console.log('👥 Employee allocation data for', employeeId, ':', JSON.stringify(employeeUpdateData, null, 2));
            
            await queueFirestoreOperation(
              { type: 'update', collection: 'employees', docId: employeeId, data: employeeUpdateData },
              { priority: 'P0', entityType: 'allocation' }
            );
          }
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
      console.log('✅ [Optimistic] Staff request mutation completed');
      setOptimisticallyHiddenCards((prev) => {
        const next = new Set(prev);
        next.delete(variables.requestId);
        return next;
      });
    },
    onError: (error, variables) => {
      console.error('❌ [Optimistic] Staff request mutation error:', error);
      setOptimisticallyHiddenCards((prev) => {
        const next = new Set(prev);
        next.delete(variables.requestId);
        return next;
      });
      Alert.alert('Error', 'Failed to update request. Please try again.');
    },
  });

  const handleApproveInternal = (requestId: string) => {
    const employeeIds = selectedEmployees[requestId];
    const pvArea = selectedPvArea[requestId];
    const blockArea = selectedBlockArea[requestId];
    
    if (!employeeIds || employeeIds.length === 0) {
      Alert.alert('Error', 'Please select at least one employee before approving');
      return;
    }
    
    if (!pvArea) {
      Alert.alert('Error', 'Please select a PV Area before approving');
      return;
    }
    
    if (!blockArea) {
      Alert.alert('Error', 'Please select a Block Area before approving');
      return;
    }
    
    console.log('[Optimistic] Approving staff request:', requestId, 'employees:', employeeIds, 'pvArea:', pvArea, 'blockArea:', blockArea);
    setOptimisticallyHiddenCards((prev) => new Set(prev).add(requestId));
    updateRequestMutation.mutate({ 
      requestId, 
      status: 'APPROVED',
      allocatedEmployeeIds: employeeIds,
      pvArea,
      blockArea
    });
  };

  const handleScheduleInternal = (requestId: string) => {
    console.log('[Optimistic] Scheduling staff request:', requestId);
    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + 1);
    
    setOptimisticallyHiddenCards((prev) => new Set(prev).add(requestId));
    updateRequestMutation.mutate({ requestId, status: 'scheduled', scheduledDate });
  };

  const handleRejectInternal = (requestId: string) => {
    console.log('[Optimistic] Rejecting staff request:', requestId);
    setOptimisticallyHiddenCards((prev) => new Set(prev).add(requestId));
    updateRequestMutation.mutate({ requestId, status: 'REJECTED' });
  };

  const incomingRequests = requests.filter(r => r.status === 'PENDING' && !r.archived && !optimisticallyHiddenCards.has(r.id));
  const scheduledRequests = requests.filter(r => r.status === 'scheduled' && !r.archived);
  const archivedRequests = requests.filter(r => r.archived);
  const pendingCount = incomingRequests.length;

  const groupedArchived = useMemo(() => {
    return groupRequestsByMonth(archivedRequests);
  }, [archivedRequests]);

  const sortedArchivedGroups = useMemo(() => {
    return Object.entries(groupedArchived).sort(([keyA], [keyB]) => {
      const [yearA, monthA] = keyA.split('-').map(Number);
      const [yearB, monthB] = keyB.split('-').map(Number);
      if (yearA !== yearB) return yearB - yearA;
      return monthB - monthA;
    });
  }, [groupedArchived]);

  const getStatusColor = (status: RequestStatus) => {
    switch (status) {
      case 'APPROVED': return '#10b981';
      case 'scheduled': return '#3b82f6';
      case 'REJECTED': return '#ef4444';
      case 'CANCELLED': return '#6b7280';
      default: return '#8b5cf6';
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
              const result = await archiveRequestsByMonth(user.siteId!, 'STAFF_REQUEST', user.userId!);
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

  const renderRequest = (request: StaffRequest, showActions: boolean) => {
    const StatusIcon = getStatusIcon(request.status);
    const statusColor = getStatusColor(request.status);
    const isExpanded = expandedRequests[request.id] || false;

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
        () => handleScheduleInternal(request.id)
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

          <Text style={styles.requestTitle}>{request.staffType || 'Staff Request'}</Text>
          
          {request.numberOfStaff && (
            <View style={styles.quantityRow}>
              <Text style={styles.quantityLabel}>Number of Staff:</Text>
              <Text style={styles.quantityValue}>{request.numberOfStaff} {request.numberOfStaff === 1 ? 'person' : 'people'}</Text>
            </View>
          )}

          {request.skillsRequired && (
            <View style={styles.skillsContainer}>
              <Text style={styles.skillsLabel}>Skills Required:</Text>
              <Text style={styles.skillsText}>{request.skillsRequired}</Text>
            </View>
          )}

          {request.duration && (
            <View style={styles.durationContainer}>
              <Clock size={16} color="#64748b" />
              <Text style={styles.durationLabel}>Duration:</Text>
              <Text style={styles.durationValue}>{request.duration}</Text>
            </View>
          )}

          {request.startDate && (
            <View style={styles.startDateContainer}>
              <Calendar size={16} color="#8b5cf6" />
              <Text style={styles.startDateLabel}>Start Date:</Text>
              <Text style={styles.startDateValue}>{request.startDate}</Text>
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

          {request.scheduledAssignmentDate && (
            <View style={styles.scheduledDateContainer}>
              <Calendar size={16} color="#3b82f6" />
              <Text style={styles.scheduledDateLabel}>Scheduled Assignment:</Text>
              <Text style={styles.scheduledDateValue}>{formatTimestamp(request.scheduledAssignmentDate)}</Text>
            </View>
          )}

          {request.notes && (
            <View style={styles.notesContainer}>
              <Text style={styles.notesLabel}>Notes:</Text>
              <Text style={styles.notesText}>{request.notes}</Text>
            </View>
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

        {showActions && isExpanded && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.scheduleButton]}
              activeOpacity={0.8}
              onPress={runScheduleAction}
              disabled={updateRequestMutation.isPending}
            >
              <Clock size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Schedule</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton]}
              activeOpacity={0.8}
              onPress={runApproveAction}
              disabled={updateRequestMutation.isPending}
            >
              <CheckCircle size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Approve</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              activeOpacity={0.8}
              onPress={runRejectAction}
              disabled={updateRequestMutation.isPending}
            >
              <XCircle size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Reject</Text>
            </TouchableOpacity>
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
          title: 'Staff Requests',
          headerStyle: {
            backgroundColor: '#000',
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
          <Users size={32} color="#8b5cf6" />
          <Text style={styles.headerTitle}>Staff Requests</Text>
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
            <Users size={20} color={activeTab === 'incoming' ? '#8b5cf6' : '#64748b'} />
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
            <Clock size={20} color={activeTab === 'scheduled' ? '#8b5cf6' : '#64748b'} />
            <Text style={[styles.tabText, activeTab === 'scheduled' && styles.activeTabText]}>
              Scheduled
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'archived' && styles.activeTab]}
            activeOpacity={0.7}
            onPress={() => setActiveTab('archived')}
          >
            <Archive size={20} color={activeTab === 'archived' ? '#8b5cf6' : '#64748b'} />
            <Text style={[styles.tabText, activeTab === 'archived' && styles.activeTabText]}>
              Archive
            </Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8b5cf6" />
            <Text style={styles.loadingText}>Loading requests...</Text>
          </View>
        ) : (
          <View style={styles.section}>
            {activeTab === 'incoming' ? (
              incomingRequests.length > 0 ? (
                incomingRequests.map(request => renderRequest(request, true))
              ) : (
                <View style={styles.emptyContainer}>
                  <Users size={48} color="#cbd5e1" />
                  <Text style={styles.emptyText}>No incoming requests</Text>
                </View>
              )
            ) : activeTab === 'scheduled' ? (
              scheduledRequests.length > 0 ? (
                scheduledRequests.map(request => renderRequest(request, false))
              ) : (
                <View style={styles.emptyContainer}>
                  <Clock size={48} color="#cbd5e1" />
                  <Text style={styles.emptyText}>No scheduled assignments</Text>
                </View>
              )
            ) : (
              <>
                {sortedArchivedGroups.length > 0 && (
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
                {sortedArchivedGroups.length > 0 ? (
                  sortedArchivedGroups.map(([key, group]) => (
                    <View key={key} style={styles.monthGroup}>
                      <View style={styles.monthHeader}>
                        <Calendar size={18} color="#8b5cf6" />
                        <Text style={styles.monthHeaderText}>
                          {getMonthLabel(group.month, group.year)}
                        </Text>
                        <View style={styles.monthBadge}>
                          <Text style={styles.monthBadgeText}>{group.requests.length}</Text>
                        </View>
                      </View>
                      {group.requests.map(request => renderRequest(request, false))}
                    </View>
                  ))
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 48,
  },
  headerCard: {
    backgroundColor: '#1a1a1a',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#fff',
    marginTop: 12,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#a0a0a0',
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
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
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
  requestTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#fff',
    marginBottom: 8,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f3e8ff',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#8b5cf6',
  },
  quantityLabel: {
    fontSize: 13,
    color: '#5b21b6',
    marginRight: 8,
    fontWeight: '600' as const,
  },
  quantityValue: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#8b5cf6',
  },
  skillsContainer: {
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#0f0f0f',
    borderRadius: 8,
  },
  skillsLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#64748b',
    marginBottom: 4,
  },
  skillsText: {
    fontSize: 13,
    color: '#d0d0d0',
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
  startDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f3e8ff',
    borderRadius: 8,
    gap: 8,
    marginBottom: 8,
  },
  startDateLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#5b21b6',
  },
  startDateValue: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#8b5cf6',
  },
  requestMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  metaLabel: {
    fontSize: 13,
    color: '#64748b',
    marginRight: 6,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#fff',
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
    backgroundColor: '#0f0f0f',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#64748b',
    marginRight: 6,
  },
  locationValue: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#fff',
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
    backgroundColor: '#0f0f0f',
    borderRadius: 8,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#64748b',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 13,
    color: '#d0d0d0',
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
    borderColor: '#2a2a2a',
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
    backgroundColor: '#2a2a2a',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#64748b',
  },
  activeTabText: {
    color: '#8b5cf6',
    fontWeight: '600' as const,
  },
  badge: {
    backgroundColor: '#8b5cf6',
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
    backgroundColor: '#1a1a1a',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#8b5cf6',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  taskDetailLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#5b21b6',
    textTransform: 'uppercase' as const,
    marginBottom: 2,
  },
  taskDetailValue: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#fff',
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
    backgroundColor: '#8b5cf6',
    borderRadius: 10,
  },
  cleanupButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  monthGroup: {
    marginBottom: 24,
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
    borderColor: '#2a2a2a',
  },
  monthHeaderText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
  },
  monthBadge: {
    backgroundColor: '#8b5cf6',
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
