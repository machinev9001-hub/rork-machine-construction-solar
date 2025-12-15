import { Stack, useRouter } from 'expo-router';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, Modal, Platform, Alert } from 'react-native';
import { AlertCircle, CheckCircle, XCircle, Clock, Calendar, Archive, ChevronDown, ChevronUp, MessageCircle, BookOpen } from 'lucide-react-native';
import TimestampFooter from '@/components/TimestampFooter';
import { useTheme } from '@/utils/hooks/useTheme';
import { HeaderTitleWithSync, StandardHeaderRight, StandardSiteIndicator } from '@/components/HeaderSyncStatus';
import { useAuth } from '@/contexts/AuthContext';
import { useMutation } from '@tanstack/react-query';
import { collection, query, where, orderBy, doc, updateDoc, Timestamp, onSnapshot, getDoc, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useState, useEffect } from 'react';
import { lockCompletedToday } from '@/utils/completedTodayLock';
import DateTimePicker from '@react-native-community/datetimepicker';

type QCRequest = {
  id: string;
  type: string;
  status: 'pending' | 'scheduled' | 'completed' | 'rejected' | 'cancelled';
  requestedBy: string;
  requestedByName?: string;
  supervisorId?: string;
  plannerId?: string;
  qcId?: string;
  taskId?: string;
  activityId?: string;
  activityName?: string;
  subMenuName?: string;
  mainMenuName?: string;
  siteId?: string;
  note?: string;
  scheduledAt?: Timestamp;
  scheduledBy?: string;
  scheduledCreatedAt?: Timestamp;
  qcValue?: number;
  qcUnit?: string;
  qcCompletedAt?: Timestamp;
  qcCompletedBy?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  scopeValue?: number;
  pvArea?: string;
  blockNumber?: string;
  scopeAdjusted?: boolean;
};

export default function QCRequestsScreen() {
  const { user } = useAuth();
  const { theme, commonStyles } = useTheme();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'incoming' | 'scheduled' | 'archived'>('incoming');
  const [requests, setRequests] = useState<QCRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  const [completeModalVisible, setCompleteModalVisible] = useState(false);
  const [selectedCompleteRequest, setSelectedCompleteRequest] = useState<QCRequest | null>(null);
  const [qcValueInput, setQcValueInput] = useState('');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [optimisticallyHiddenCards, setOptimisticallyHiddenCards] = useState<Set<string>>(new Set());
  
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
      console.log('❌ QC REQUESTS - No siteId');
      setIsLoading(false);
      return;
    }

    console.log('🔍 QC REQUESTS - Setting up listener for siteId:', user.siteId);
    setIsLoading(true);

    const requestsRef = collection(db, 'requests');
    const q = query(
      requestsRef,
      where('type', '==', 'QC_REQUEST'),
      where('siteId', '==', user.siteId),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        console.log('📊 QC REQUESTS - Received', snapshot.docs.length, 'documents');
        const results: QCRequest[] = [];
        
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          const requestData: QCRequest = {
            id: docSnap.id,
            ...data
          } as QCRequest;

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
                requestData.pvArea = activityData.pvArea || 'N/A';
                requestData.blockNumber = activityData.blockNumber || 'N/A';
                requestData.scopeAdjusted = activityData.scopeAdjusted || false;
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
              }
            } catch (err) {
              console.error('Error fetching activity data:', err);
            }
          }
          
          if (data.requestedBy || data.supervisorId) {
            const userId = data.requestedBy || data.supervisorId;
            try {
              const usersQ = query(
                collection(db, 'users'),
                where('userId', '==', userId)
              );
              const usersSnap = await getDocs(usersQ);
              if (!usersSnap.empty) {
                requestData.requestedByName = usersSnap.docs[0].data().name || userId;
              }
            } catch (err) {
              console.error('Error fetching user name:', err);
            }
          }

          results.push(requestData);
        }
        
        console.log('✅ Total requests fetched:', results.length);
        console.log('✅ Pending requests:', results.filter(r => r.status.toLowerCase() === 'pending').length);
        console.log('✅ Scheduled requests:', results.filter(r => r.status.toLowerCase() === 'scheduled').length);
        console.log('✅ Completed/Rejected:', results.filter(r => r.status.toLowerCase() === 'completed' || r.status.toLowerCase() === 'rejected').length);
        
        setRequests(results);
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        console.error('❌ QC REQUESTS - Error:', err);
        setError(err as Error);
        setIsLoading(false);
      }
    );

    return () => {
      console.log('🔴 QC REQUESTS - Cleaning up listener');
      unsubscribe();
    };
  }, [user?.siteId]);

  const scheduleMutation = useMutation({
    mutationFn: async ({ requestId, scheduledAt }: { requestId: string; scheduledAt: Date }) => {
      console.log('🗓️ Scheduling QC request:', requestId, 'for:', scheduledAt);
      
      const requestRef = doc(db, 'requests', requestId);
      const requestSnap = await getDoc(requestRef);
      
      if (!requestSnap.exists()) {
        throw new Error('Request not found');
      }
      
      const requestData = requestSnap.data();
      const activityId = requestData.activityId;
      
      await updateDoc(requestRef, {
        status: 'scheduled',
        scheduledAt: Timestamp.fromDate(scheduledAt),
        scheduledBy: user?.userId || 'unknown',
        scheduledCreatedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      
      if (activityId && requestData.taskId) {
        const activitiesRef = collection(db, 'activities');
        const activityQuery = query(
          activitiesRef,
          where('taskId', '==', requestData.taskId),
          where('activityId', '==', activityId)
        );
        const activitySnapshot = await getDocs(activityQuery);
        
        if (!activitySnapshot.empty) {
          const activityDocId = activitySnapshot.docs[0].id;
          await updateDoc(doc(db, 'activities', activityDocId), {
            'qc.status': 'scheduled',
            'qc.scheduledAt': Timestamp.fromDate(scheduledAt),
            'qc.scheduledBy': user?.userId,
            'qc.lastRequestId': requestId,
            updatedAt: Timestamp.now(),
          });
        }
      }
      
      console.log('✅ QC request scheduled successfully');
      return requestId;
    },
    onSuccess: () => {
      console.log('✅ QC schedule mutation completed');
      setScheduleModalVisible(false);
      setSelectedRequestId('');
    },
    onError: (error, variables) => {
      console.error('❌ Schedule mutation error:', error);
      setOptimisticallyHiddenCards((prev) => {
        const next = new Set(prev);
        next.delete(variables.requestId);
        return next;
      });
      Alert.alert('Error', 'Failed to schedule QC');
    },
  });
  
  const completeMutation = useMutation({
    mutationFn: async ({ requestId, qcValue, qcUnit, adjustScope, newScopeValue }: { requestId: string; qcValue: number; qcUnit: string; adjustScope?: boolean; newScopeValue?: number }) => {
      console.log('[Optimistic] ✅ Completing QC request:', requestId, 'value:', qcValue, qcUnit);
      
      const requestRef = doc(db, 'requests', requestId);
      const requestSnap = await getDoc(requestRef);
      
      if (!requestSnap.exists()) {
        throw new Error('Request not found');
      }
      
      const requestData = requestSnap.data();
      const activityId = requestData.activityId;
      
      await updateDoc(requestRef, {
        status: 'completed',
        qcValue,
        qcUnit,
        qcCompletedAt: Timestamp.now(),
        qcCompletedBy: user?.userId || 'unknown',
        updatedAt: Timestamp.now(),
      });
      
      console.log('🔍 Looking for activity with taskId:', requestData.taskId, 'activityId:', activityId);
      
      if (activityId && requestData.taskId) {
        const activitiesRef = collection(db, 'activities');
        const activityQuery = query(
          activitiesRef,
          where('taskId', '==', requestData.taskId),
          where('activityId', '==', activityId)
        );
        const activitySnapshot = await getDocs(activityQuery);
        
        console.log('📊 Found', activitySnapshot.docs.length, 'matching activities');
        
        if (!activitySnapshot.empty) {
          const activityDocId = activitySnapshot.docs[0].id;
          const currentData = activitySnapshot.docs[0].data();
          console.log('📄 Current activity data before update:', JSON.stringify(currentData, null, 2));
          
          const completedTodayValue = currentData.completedToday || 0;
          const completedTodayUnit = currentData.completedTodayUnit || currentData.unit?.canonical || qcUnit;
          
          const currentQcValue = currentData.qcValue || 0;
          const newQcValue = currentQcValue + qcValue;
          console.log('➕ CUMULATIVE QC: Current =', currentQcValue, '+ New =', qcValue, '→ Total =', newQcValue);
          
          const updateData: any = {
            'qc.status': 'completed',
            'qc.completedAt': Timestamp.now(),
            'qc.completedBy': user?.userId,
            qcValue: newQcValue,
            qcRequested: false,
            'qc.lastRequestId': null,
            updatedAt: Timestamp.now(),
            updatedBy: user?.userId,
          };
          
          if (adjustScope && newScopeValue) {
            console.log('📝 Adjusting scope from', currentData.scopeValue, 'to', newScopeValue);
            updateData.scopeValue = newScopeValue;
            updateData.scopeAdjusted = true;
            updateData.scopeAdjustedAt = Timestamp.now();
            updateData.scopeAdjustedBy = user?.userId;
          }
          
          await updateDoc(doc(db, 'activities', activityDocId), updateData);
          
          console.log('🔒 QC Complete: Locking supervisor completedToday input');
          
          await lockCompletedToday({
            taskId: requestData.taskId,
            activityId,
            lockType: 'QC_INTERACTION',
            lockedValue: completedTodayValue,
            lockedUnit: completedTodayUnit,
            qcApprovedValue: qcValue,
            qcApprovedUnit: qcUnit,
          });
          
          const updatedSnap = await getDoc(doc(db, 'activities', activityDocId));
          console.log('✅ Activity updated successfully! New qcValue:', updatedSnap.data()?.qcValue);
          console.log('✅ Full updated data:', JSON.stringify(updatedSnap.data(), null, 2));
        } else {
          console.error('❌ No activity found matching query!');
          throw new Error('Activity not found');
        }
      }
      
      console.log('✅ QC request completed successfully');
    },
    onSuccess: () => {
      console.log('✅ QC complete mutation completed');
      setCompleteModalVisible(false);
      setSelectedCompleteRequest(null);
      setQcValueInput('');
      Alert.alert('Success', 'QC inspection completed');
    },
    onError: (error, variables) => {
      console.error('❌ Complete mutation error:', error);
      setOptimisticallyHiddenCards((prev) => {
        const next = new Set(prev);
        next.delete(variables.requestId);
        return next;
      });
      Alert.alert('Error', 'Failed to complete QC');
    },
  });
  
  const rejectMutation = useMutation({
    mutationFn: async (requestId: string) => {
      console.log('[Optimistic] ❌ Rejecting QC request:', requestId);
      
      const requestRef = doc(db, 'requests', requestId);
      const requestSnap = await getDoc(requestRef);
      
      if (!requestSnap.exists()) {
        throw new Error('Request not found');
      }
      
      const requestData = requestSnap.data();
      const activityId = requestData.activityId;
      
      await updateDoc(requestRef, {
        status: 'rejected',
        updatedAt: Timestamp.now(),
      });
      
      if (activityId && requestData.taskId) {
        const activitiesRef = collection(db, 'activities');
        const activityQuery = query(
          activitiesRef,
          where('taskId', '==', requestData.taskId),
          where('activityId', '==', activityId)
        );
        const activitySnapshot = await getDocs(activityQuery);
        
        if (!activitySnapshot.empty) {
          const activityDocId = activitySnapshot.docs[0].id;
          await updateDoc(doc(db, 'activities', activityDocId), {
            'qc.status': 'not_requested',
            qcRequested: false,
            'qc.lastRequestId': null,
            updatedAt: Timestamp.now(),
          });
          console.log('✅ Activity updated after rejection: qc.status = not_requested, qcRequested = false');
        }
      }
    },
    onSuccess: () => {
      console.log('✅ QC reject mutation completed');
    },
    onError: (error, variables) => {
      console.error('❌ Reject mutation error:', error);
      setOptimisticallyHiddenCards((prev) => {
        const next = new Set(prev);
        next.delete(variables);
        return next;
      });
      Alert.alert('Error', 'Failed to reject request');
    },
  });

  const handleScheduleClick = (requestId: string) => {
    console.log('📅 Opening schedule modal for request:', requestId);
    setSelectedRequestId(requestId);
    const now = new Date();
    setSelectedDate(now);
    setSelectedTime(now);
    setScheduleModalVisible(true);
  };
  
  const handleScheduleCancel = () => {
    console.log('❌ Schedule cancelled for request:', selectedRequestId);
    setScheduleModalVisible(false);
    setSelectedRequestId('');
  };
  
  const handleScheduleSave = () => {
    const combinedDateTime = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      selectedTime.getHours(),
      selectedTime.getMinutes()
    );
    
    scheduleMutation.mutate({ requestId: selectedRequestId, scheduledAt: combinedDateTime });
  };
  
  const handleCompleteClick = async (request: QCRequest) => {
    console.log('✅ Opening complete modal for request:', request.id);
    const activitiesRef = collection(db, 'activities');
    const activityQuery = query(
      activitiesRef,
      where('taskId', '==', request.taskId),
      where('activityId', '==', request.activityId)
    );
    const activitySnapshot = await getDocs(activityQuery);
    
    if (activitySnapshot.empty) {
      Alert.alert('Error', 'Activity not found');
      return;
    }
    
    const activityData = activitySnapshot.docs[0].data();
    const qcUnit = activityData.unit?.canonical || activityData.scope?.unit || 'm';
    const currentQcValue = activityData.qcValue || 0;
    const scopeValue = typeof activityData.scopeValue === 'number' 
      ? activityData.scopeValue 
      : (activityData.scopeValue?.value || 0);
    console.log('📊 [QC Complete] Using canonical unit:', qcUnit, '- Current QC:', currentQcValue, '- Scope:', scopeValue);
    
    setSelectedCompleteRequest({ 
      ...request, 
      qcUnit,
      qcValue: currentQcValue,
      scopeValue 
    } as QCRequest & { scopeValue: number });
    setQcValueInput('');
    setCompleteModalVisible(true);
  };
  
  const handleCompleteCancel = () => {
    console.log('❌ Complete modal cancelled');
    setCompleteModalVisible(false);
    setSelectedCompleteRequest(null);
    setQcValueInput('');
  };
  
  const handleCompleteSave = async () => {
    if (!selectedCompleteRequest || !qcValueInput) {
      Alert.alert('Error', 'Please enter QC value');
      return;
    }
    
    const newQcValue = parseFloat(qcValueInput);
    
    try {
      const activitiesRef = collection(db, 'activities');
      const activityQuery = query(
        activitiesRef,
        where('taskId', '==', selectedCompleteRequest.taskId),
        where('activityId', '==', selectedCompleteRequest.activityId)
      );
      const activitySnapshot = await getDocs(activityQuery);
      
      if (activitySnapshot.empty) {
        Alert.alert('Error', 'Activity not found');
        return;
      }
      
      const activityData = activitySnapshot.docs[0].data();
      const currentQcValue = activityData.qcValue || 0;
      const scopeValue = typeof activityData.scopeValue === 'number' 
        ? activityData.scopeValue 
        : (activityData.scopeValue?.value || 0);
      const scopeApproved = activityData.scopeApproved || false;
      
      const totalQcValue = currentQcValue + newQcValue;
      
      console.log('🔍 QC Validation:');
      console.log('   Current QC:', currentQcValue);
      console.log('   New QC Input:', newQcValue);
      console.log('   Total QC after:', totalQcValue);
      console.log('   Approved Scope:', scopeValue);
      console.log('   Scope Approved:', scopeApproved);
      console.log('   Will exceed scope:', totalQcValue > scopeValue);
      
      if (!scopeApproved) {
        Alert.alert(
          'Scope Not Approved',
          'The scope for this activity has not been approved yet. Please approve the scope before completing QC.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      if (totalQcValue > scopeValue) {
        console.log('⚠️ QC exceeds scope - will auto-adjust scope to match QC');
        Alert.alert(
          'QC Value Exceeds Scope',
          `The total QC value (${totalQcValue.toFixed(2)} ${selectedCompleteRequest.qcUnit}) exceeds the approved scope (${scopeValue.toFixed(2)} ${selectedCompleteRequest.qcUnit}).\n\nThe scope will be automatically adjusted to ${totalQcValue.toFixed(2)} ${selectedCompleteRequest.qcUnit}.\n\nCurrent QC: ${currentQcValue.toFixed(2)}\nNew QC: ${newQcValue.toFixed(2)}\nNew Total: ${totalQcValue.toFixed(2)}\nOld Scope: ${scopeValue.toFixed(2)}\nAdjusted Scope: ${totalQcValue.toFixed(2)}`,
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Continue', 
              onPress: () => {
                completeMutation.mutate({
                  requestId: selectedCompleteRequest.id,
                  qcValue: newQcValue,
                  qcUnit: selectedCompleteRequest.qcUnit || 'm',
                  adjustScope: true,
                  newScopeValue: totalQcValue,
                });
              }
            }
          ]
        );
        return;
      }
      
      console.log('✅ QC Validation passed - proceeding with completion');
      
      completeMutation.mutate({
        requestId: selectedCompleteRequest.id,
        qcValue: newQcValue,
        qcUnit: selectedCompleteRequest.qcUnit || 'm',
      });
    } catch (error) {
      console.error('❌ QC Validation error:', error);
      Alert.alert('Error', 'Failed to validate QC value');
    }
  };

  const formatTimestamp = (timestamp?: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  const formatScheduledDate = (timestamp?: Timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate();
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return '#3b82f6';
      case 'completed': return '#10b981';
      case 'rejected': return '#ef4444';
      case 'cancelled': return '#94a3b8';
      default: return '#f59e0b';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled': return Calendar;
      case 'completed': return CheckCircle;
      case 'rejected': return XCircle;
      case 'cancelled': return XCircle;
      default: return Clock;
    }
  };

  const incomingRequests = requests.filter(r => {
    const status = (r.status || '').toString().toUpperCase();
    return status === 'PENDING' && !optimisticallyHiddenCards.has(r.id);
  });
  const scheduledRequests = requests.filter(r => {
    const status = (r.status || '').toString().toUpperCase();
    return status === 'SCHEDULED' && !optimisticallyHiddenCards.has(r.id);
  }).sort((a, b) => {
    if (!a.scheduledAt || !b.scheduledAt) return 0;
    return a.scheduledAt.toMillis() - b.scheduledAt.toMillis();
  });
  const archivedRequests = requests.filter(r => {
    const status = (r.status || '').toString().toUpperCase();
    return status === 'COMPLETED' || status === 'REJECTED' || status === 'CANCELLED';
  });
  const pendingCount = incomingRequests.length;
  const scheduledCount = scheduledRequests.length;

  const renderIncomingRequest = (request: QCRequest) => {
    const StatusIcon = getStatusIcon(request.status);
    const statusColor = getStatusColor(request.status);
    const isExpanded = expandedCards.has(request.id);

    return (
      <View key={request.id} style={styles.requestCard}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => toggleCard(request.id)}
        >
          <View style={styles.requestHeader}>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
            <StatusIcon size={16} color={statusColor} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {request.status.toUpperCase()}
            </Text>
          </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.requestTime}>
                {formatTimestamp(request.createdAt)}
              </Text>
              {isExpanded ? <ChevronUp size={20} color="#64748b" /> : <ChevronDown size={20} color="#64748b" />}
            </View>
          </View>

          <Text style={styles.requestTitle}>{request.mainMenuName || 'QC Inspection Request'}</Text>
          <Text style={styles.compactInfo}>
            {request.activityName} • {request.subMenuName}
          </Text>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedContent}>
            <View style={styles.taskDetailsRow}>
              <View style={styles.taskDetailItem}>
                <Text style={styles.taskDetailLabel}>Activity:</Text>
                <Text style={styles.taskDetailValue}>{request.activityName || 'N/A'}</Text>
              </View>
              <View style={styles.taskDetailItem}>
                <Text style={styles.taskDetailLabel}>Sub Menu:</Text>
                <Text style={styles.taskDetailValue}>{request.subMenuName || 'N/A'}</Text>
              </View>
            </View>

            <View style={styles.taskDetailsRow}>
              <View style={styles.taskDetailItem}>
                <Text style={styles.taskDetailLabel}>PV Area:</Text>
                <Text style={styles.taskDetailValue}>{request.pvArea || 'N/A'}</Text>
              </View>
              <View style={styles.taskDetailItem}>
                <Text style={styles.taskDetailLabel}>Block Number:</Text>
                <Text style={styles.taskDetailValue}>{request.blockNumber || 'N/A'}</Text>
              </View>
            </View>

            <View style={styles.requestMeta}>
              <Text style={styles.metaLabel}>Supervisor:</Text>
              <Text style={styles.metaValue}>{request.requestedByName || request.requestedBy || request.supervisorId}</Text>
            </View>

            {request.note && (
              <View style={styles.noteDisplay}>
                <Text style={styles.noteLabel}>Note:</Text>
                <Text style={styles.noteText}>{request.note}</Text>
              </View>
            )}

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.scheduleButton]}
                activeOpacity={0.8}
                onPress={() => handleScheduleClick(request.id)}
                disabled={scheduleMutation.isPending}
              >
                <Calendar size={18} color="#fff" />
                <Text style={styles.actionButtonText}>Schedule</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton]}
                activeOpacity={0.8}
                onPress={() => rejectMutation.mutate(request.id)}
                disabled={rejectMutation.isPending}
              >
                <XCircle size={18} color="#fff" />
                <Text style={styles.actionButtonText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        
        <TimestampFooter
          createdAt={request.createdAt}
          createdBy={request.requestedByName || request.requestedBy}
          updatedAt={request.scheduledCreatedAt}
          updatedBy={request.scheduledBy}
          actionLabel="Scheduled"
        />
      </View>
    );
  };
  
  const renderScheduledRequest = (request: QCRequest) => {
    const StatusIcon = getStatusIcon(request.status);
    const statusColor = getStatusColor(request.status);
    const isExpanded = expandedCards.has(request.id);

    return (
      <View key={request.id} style={styles.requestCard}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => toggleCard(request.id)}
        >
          <View style={styles.requestHeader}>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
            <StatusIcon size={16} color={statusColor} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              SCHEDULED
            </Text>
          </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.requestTime}>{formatTimestamp(request.scheduledAt)}</Text>
              {isExpanded ? <ChevronUp size={20} color="#64748b" /> : <ChevronDown size={20} color="#64748b" />}
            </View>
          </View>

          <Text style={styles.requestTitle}>{request.mainMenuName || 'QC Scheduled Visit'}</Text>
          <Text style={styles.compactInfo}>
            {request.activityName} • {request.subMenuName}
          </Text>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedContent}>
            <View style={styles.scheduledTimeBlock}>
              <Calendar size={20} color="#3b82f6" />
              <Text style={styles.scheduledTime}>{formatScheduledDate(request.scheduledAt)}</Text>
            </View>

            <View style={styles.taskDetailsRow}>
              <View style={styles.taskDetailItem}>
                <Text style={styles.taskDetailLabel}>Activity:</Text>
                <Text style={styles.taskDetailValue}>{request.activityName || 'N/A'}</Text>
              </View>
              <View style={styles.taskDetailItem}>
                <Text style={styles.taskDetailLabel}>Sub Menu:</Text>
                <Text style={styles.taskDetailValue}>{request.subMenuName || 'N/A'}</Text>
              </View>
            </View>

            <View style={styles.taskDetailsRow}>
              <View style={styles.taskDetailItem}>
                <Text style={styles.taskDetailLabel}>PV Area:</Text>
                <Text style={styles.taskDetailValue}>{request.pvArea || 'N/A'}</Text>
              </View>
              <View style={styles.taskDetailItem}>
                <Text style={styles.taskDetailLabel}>Block Number:</Text>
                <Text style={styles.taskDetailValue}>{request.blockNumber || 'N/A'}</Text>
              </View>
            </View>

            <View style={styles.requestMeta}>
              <Text style={styles.metaLabel}>Supervisor:</Text>
              <Text style={styles.metaValue}>{request.requestedByName || request.requestedBy || request.supervisorId}</Text>
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.completeButton, { flex: 1 }]}
                activeOpacity={0.8}
                onPress={() => handleCompleteClick(request)}
                disabled={completeMutation.isPending}
              >
                <CheckCircle size={18} color="#fff" />
                <Text style={styles.actionButtonText}>Complete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        
        <TimestampFooter
          createdAt={request.createdAt}
          createdBy={request.requestedByName || request.requestedBy}
          updatedAt={request.qcCompletedAt || request.scheduledCreatedAt}
          updatedBy={request.qcCompletedBy || request.scheduledBy}
          actionLabel={request.status === 'completed' ? 'Completed' : 'Scheduled'}
        />
      </View>
    );
  };
  
  const renderArchivedRequest = (request: QCRequest) => {
    const StatusIcon = getStatusIcon(request.status);
    const statusColor = getStatusColor(request.status);
    const isExpanded = expandedCards.has(request.id);

    return (
      <View key={request.id} style={styles.requestCard}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => toggleCard(request.id)}
        >
          <View style={styles.requestHeader}>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
            <StatusIcon size={16} color={statusColor} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {request.status.toUpperCase()}
            </Text>
          </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.requestTime}>
                {formatTimestamp(request.updatedAt)}
              </Text>
              {isExpanded ? <ChevronUp size={20} color="#64748b" /> : <ChevronDown size={20} color="#64748b" />}
            </View>
          </View>

          <Text style={styles.requestTitle}>{request.mainMenuName || (request.status === 'completed' ? 'QC Completed' : 'QC Request')}</Text>
          <Text style={styles.compactInfo}>
            {request.activityName} • {request.subMenuName}
          </Text>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedContent}>
            <View style={styles.taskDetailsRow}>
              <View style={styles.taskDetailItem}>
                <Text style={styles.taskDetailLabel}>Activity:</Text>
                <Text style={styles.taskDetailValue}>{request.activityName || 'N/A'}</Text>
              </View>
              <View style={styles.taskDetailItem}>
                <Text style={styles.taskDetailLabel}>Sub Menu:</Text>
                <Text style={styles.taskDetailValue}>{request.subMenuName || 'N/A'}</Text>
              </View>
            </View>

            {request.status === 'completed' && request.qcValue && (
              <View style={styles.completedValueBlock}>
                <Text style={styles.completedValueLabel}>QC Value:</Text>
                <Text style={styles.completedValueText}>
                  {request.qcValue} {request.qcUnit}
                </Text>
              </View>
            )}

            {request.scheduledAt && (
              <Text style={styles.archivedMeta}>
                Scheduled: {formatScheduledDate(request.scheduledAt)}
              </Text>
            )}
          </View>
        )}
        
        <TimestampFooter
          createdAt={request.createdAt}
          createdBy={request.requestedByName || request.requestedBy}
          updatedAt={request.qcCompletedAt || request.updatedAt}
          updatedBy={request.qcCompletedBy}
          actionLabel={request.status === 'completed' ? 'Completed' : request.status === 'rejected' ? 'Rejected' : request.status === 'cancelled' ? 'Cancelled' : 'Updated'}
        />
      </View>
    );
  };

  return (
    <View style={commonStyles.container}>
      <Stack.Screen
        options={{
          headerTitle: () => <HeaderTitleWithSync title="QC Requests" />,
          headerRight: () => <StandardHeaderRight />,
          headerStyle: {
            backgroundColor: theme.headerBg,
          },
          headerTintColor: theme.text,
          headerTitleStyle: {
            fontWeight: '600' as const,
          },
        }}
      />
      <View style={commonStyles.headerBorder} />
      <StandardSiteIndicator />
      
      <View style={styles.actionButtonsRow}>
        <TouchableOpacity
          style={styles.halfButton}
          onPress={() => router.push('/daily-diary')}
          activeOpacity={0.7}
        >
          <BookOpen size={18} color="#ffffff" strokeWidth={2} />
          <Text style={styles.halfButtonText}>Daily Diary</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.halfButton, styles.messagesHalfButton]}
          onPress={() => router.push('/messages')}
          activeOpacity={0.7}
        >
          <MessageCircle size={18} color="#ffffff" strokeWidth={2} />
          <Text style={styles.halfButtonText}>Messages</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={commonStyles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <AlertCircle size={32} color="#ec4899" />
          <Text style={styles.headerTitle}>QC Inspection Requests</Text>
          <Text style={styles.headerSubtitle}>
            {pendingCount} pending
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
            <AlertCircle size={18} color={activeTab === 'incoming' ? '#ec4899' : '#64748b'} />
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
            <Calendar size={18} color={activeTab === 'scheduled' ? '#ec4899' : '#64748b'} />
            <Text style={[styles.tabText, activeTab === 'scheduled' && styles.activeTabText]}>
              Scheduled
            </Text>
            {scheduledCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{scheduledCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'archived' && styles.activeTab]}
            activeOpacity={0.7}
            onPress={() => setActiveTab('archived')}
          >
            <Archive size={18} color={activeTab === 'archived' ? '#ec4899' : '#64748b'} />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ec4899" />
            <Text style={styles.loadingText}>Loading requests...</Text>
          </View>
        ) : (
          <View style={styles.section}>
            {activeTab === 'incoming' && (
              incomingRequests.length > 0 ? (
                incomingRequests.map(request => renderIncomingRequest(request))
              ) : (
                <View style={styles.emptyContainer}>
                  <AlertCircle size={48} color="#cbd5e1" />
                  <Text style={styles.emptyText}>No incoming requests</Text>
                </View>
              )
            )}
            
            {activeTab === 'scheduled' && (
              scheduledRequests.length > 0 ? (
                scheduledRequests.map(request => renderScheduledRequest(request))
              ) : (
                <View style={styles.emptyContainer}>
                  <Calendar size={48} color="#cbd5e1" />
                  <Text style={styles.emptyText}>No scheduled QC visits</Text>
                </View>
              )
            )}
            
            {activeTab === 'archived' && (
              archivedRequests.length > 0 ? (
                archivedRequests.map(request => renderArchivedRequest(request))
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
      
      <Modal visible={scheduleModalVisible} transparent animationType="slide" onRequestClose={handleScheduleCancel}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Schedule QC Visit</Text>
            <Text style={styles.modalSubtitle}>Select date and time</Text>
            
            <View style={styles.dateTimeRow}>
              <TouchableOpacity
                style={styles.dateTimeButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Calendar size={16} color="#64748b" />
                <Text style={styles.dateTimeButtonText}>
                  {selectedDate.toLocaleDateString('en-GB')}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.dateTimeButton}
                onPress={() => setShowTimePicker(true)}
              >
                <Clock size={16} color="#64748b" />
                <Text style={styles.dateTimeButtonText}>
                  {selectedTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}
                </Text>
              </TouchableOpacity>
            </View>
            
            {Platform.OS !== 'web' && showDatePicker && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="inline"
                onChange={(event, date) => {
                  setShowDatePicker(false);
                  if (date) setSelectedDate(date);
                }}
              />
            )}
            
            {Platform.OS !== 'web' && showTimePicker && (
              <DateTimePicker
                value={selectedTime}
                mode="time"
                display="spinner"
                is24Hour={true}
                onChange={(event, time) => {
                  setShowTimePicker(false);
                  if (time) setSelectedTime(time);
                }}
              />
            )}
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={handleScheduleCancel}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.modalSaveButton]}
                onPress={handleScheduleSave}
                disabled={scheduleMutation.isPending}
              >
                <Text style={styles.modalSaveText}>Schedule</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      <Modal visible={completeModalVisible} transparent animationType="slide" onRequestClose={handleCompleteCancel}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Complete QC Inspection</Text>
            <Text style={styles.modalSubtitle}>
              Activity: {selectedCompleteRequest?.activityName}
            </Text>
            
            {selectedCompleteRequest && (
              <>
                <View style={styles.scopeInfoBlock}>
                  <View style={styles.scopeInfoRow}>
                    <Text style={styles.scopeInfoLabel}>Current QC:</Text>
                    <Text style={styles.scopeInfoValue}>
                      {(selectedCompleteRequest.qcValue || 0).toFixed(2)} {selectedCompleteRequest.qcUnit}
                    </Text>
                  </View>
                  <View style={styles.scopeInfoRow}>
                    <Text style={styles.scopeInfoLabel}>Approved Scope:</Text>
                    <Text style={styles.scopeInfoValue}>
                      {(selectedCompleteRequest.scopeValue || 0).toFixed(2)} {selectedCompleteRequest.qcUnit}
                    </Text>
                  </View>
                  <View style={[styles.scopeInfoRow, styles.scopeInfoRowHighlight]}>
                    <Text style={styles.scopeInfoLabelHighlight}>Remaining:</Text>
                    <Text style={styles.scopeInfoValueHighlight}>
                      {((selectedCompleteRequest.scopeValue || 0) - (selectedCompleteRequest.qcValue || 0)).toFixed(2)} {selectedCompleteRequest.qcUnit}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.unitInfoBlock}>
                  <Text style={styles.unitInfoLabel}>Unit:</Text>
                  <Text style={styles.unitInfoValue}>{selectedCompleteRequest.qcUnit || 'm'}</Text>
                </View>
              </>
            )}
            
            <View style={styles.inputBlock}>
              <Text style={styles.inputLabel}>QC Value *</Text>
              <TextInput
                style={styles.modalInput}
                value={qcValueInput}
                onChangeText={setQcValueInput}
                placeholder="Enter QC value"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                autoFocus
              />
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={handleCompleteCancel}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.modalSaveButton]}
                onPress={handleCompleteSave}
                disabled={completeMutation.isPending || !qcValueInput}
              >
                <Text style={styles.modalSaveText}>Complete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
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
    color: '#1e293b',
  },
  noteDisplay: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    marginBottom: 12,
  },
  noteLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#64748b',
    marginBottom: 4,
  },
  noteText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
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
  taskDetailsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  taskDetailItem: {
    flex: 1,
    backgroundColor: '#fdf4ff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#ec4899',
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
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 6,
  },
  activeTab: {
    backgroundColor: '#fce7f3',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#64748b',
  },
  activeTabText: {
    color: '#ec4899',
    fontWeight: '600' as const,
  },
  badge: {
    backgroundColor: '#ec4899',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 18,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#fff',
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
  scheduleButton: {
    backgroundColor: '#3b82f6',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  completeButton: {
    backgroundColor: '#10b981',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  scheduledTimeBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dbeafe',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  scheduledTime: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#1e40af',
  },
  completedValueBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#d1fae5',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  completedValueLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#065f46',
  },
  completedValueText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#065f46',
  },
  archivedMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
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
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  dateTimeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  dateTimeButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#334155',
  },
  unitInfoBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fef3c7',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  unitInfoLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#78350f',
  },
  unitInfoValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#78350f',
  },
  scopeInfoBlock: {
    backgroundColor: '#eff6ff',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3b82f6',
    gap: 8,
  },
  scopeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scopeInfoRowHighlight: {
    backgroundColor: '#dbeafe',
    marginHorizontal: -14,
    marginBottom: -12,
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  scopeInfoLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#475569',
  },
  scopeInfoValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  scopeInfoLabelHighlight: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#1e40af',
  },
  scopeInfoValueHighlight: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1e40af',
  },
  inputBlock: {
    marginBottom: 20,
  },
  inputLabel: {
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
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1e293b',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#f1f5f9',
  },
  modalSaveButton: {
    backgroundColor: '#ec4899',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#334155',
  },
  modalSaveText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    gap: 10,
  },
  halfButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  messagesHalfButton: {
    backgroundColor: '#FFD600',
  },
  halfButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#ffffff',
    letterSpacing: 0.2,
  },
});
