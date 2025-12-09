import { Stack, useRouter } from 'expo-router';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, Modal, Alert, Platform } from 'react-native';
import { Cable, CheckCircle, XCircle, Clock, Archive, ChevronDown, ChevronUp, Calendar, ExternalLink } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useMutation } from '@tanstack/react-query';
import { collection, query, where, orderBy, doc, updateDoc, Timestamp, onSnapshot, getDocs, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { RequestType, RequestStatus } from '@/types';
import { useState, useEffect } from 'react';

type CablingRequest = {
  id: string;
  type: RequestType;
  status: RequestStatus;
  requestedBy: string;
  requestedByName?: string;
  requestedAt: Timestamp;
  taskId?: string;
  activityId?: string;
  activityName?: string;
  subMenuName?: string;
  mainMenuName?: string;
  targetModule?: string;
  siteId?: string;
  cablingDeepLink?: string;
  archived?: boolean;
  scheduledAt?: Timestamp;
  scheduledBy?: string;
};

export default function PlannerCablingRequestsScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'incoming' | 'scheduled' | 'archived'>('incoming');
  const [requests, setRequests] = useState<CablingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [selectedRequestForSchedule, setSelectedRequestForSchedule] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const router = useRouter();
  
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
      console.log('❌ PLANNER CABLING QUERY - No siteId');
      setIsLoading(false);
      return;
    }

    console.log('🔍 PLANNER CABLING REALTIME - Setting up listener for siteId:', user.siteId);
    setIsLoading(true);

    const requestsRef = collection(db, 'requests');
    const q = query(
      requestsRef,
      where('type', '==', 'CABLING_REQUEST'),
      where('siteId', '==', user.siteId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        console.log('📊 PLANNER CABLING REALTIME - Received', snapshot.docs.length, 'documents');
        const results: CablingRequest[] = [];
        
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          const requestData: CablingRequest = {
            id: docSnap.id,
            ...data
          } as CablingRequest;

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
              }
            } catch (err) {
              console.error('Error fetching activity data:', err);
            }
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
        
        setRequests(results);
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        console.error('❌ PLANNER CABLING REALTIME - Error:', err);
        setError(err as Error);
        setIsLoading(false);
      }
    );

    return () => {
      console.log('🔴 PLANNER CABLING REALTIME - Cleaning up listener');
      unsubscribe();
    };
  }, [user?.siteId]);

  const scheduleMutation = useMutation({
    mutationFn: async ({ requestId, scheduledAt }: { requestId: string; scheduledAt: Date }) => {
      console.log('🗓️ Scheduling cabling request:', requestId, 'for:', scheduledAt);
      
      const requestRef = doc(db, 'requests', requestId);
      await updateDoc(requestRef, {
        status: 'scheduled',
        scheduledAt: Timestamp.fromDate(scheduledAt),
        scheduledBy: user?.userId || 'unknown',
        updatedAt: Timestamp.now(),
      });
      
      console.log('✅ Cabling request scheduled successfully');
    },
    onSuccess: () => {
      setScheduleModalVisible(false);
      setSelectedRequestForSchedule('');
      Alert.alert('Success', 'Request scheduled successfully');
    },
    onError: (error) => {
      console.error('❌ Schedule mutation error:', error);
      Alert.alert('Error', 'Failed to schedule request');
    },
  });

  const updateRequestMutation = useMutation({
    mutationFn: async ({ 
      requestId, 
      status
    }: { 
      requestId: string; 
      status: RequestStatus;
    }) => {
      console.log('🔄 Updating cabling request:', requestId, 'to status:', status);
      
      const requestRef = doc(db, 'requests', requestId);
      const requestDoc = await getDoc(requestRef);
      
      if (!requestDoc.exists()) {
        throw new Error('Request not found');
      }
      
      const requestData = requestDoc.data();
      console.log('📄 Request data:', JSON.stringify(requestData, null, 2));
      
      // Update the activity document
      if (requestData.taskId && requestData.activityId) {
        const activitiesRef = collection(db, 'activities');
        const q = query(
          activitiesRef,
          where('taskId', '==', requestData.taskId),
          where('activityId', '==', requestData.activityId)
        );
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const activityDocId = snapshot.docs[0].id;
          console.log('🔓 Updating activity document:', activityDocId);
          
          if (status === 'APPROVED') {
            // Approve: Keep handoff sent status but clear request flag
            await updateDoc(doc(db, 'activities', activityDocId), {
              cablingRequested: false, // ⚠️ Reset toggle
              cablingApproved: true,
              updatedAt: Timestamp.now(),
              approvedBy: user?.userId,
              approvedAt: Timestamp.now(),
            });
            console.log('✅ Cabling handoff approved');
          } else if (status === 'REJECTED') {
            // Reject: Reset status and toggle
            await updateDoc(doc(db, 'activities', activityDocId), {
              cablingRequested: false, // ⚠️ Reset toggle
              status: 'LOCKED',
              updatedAt: Timestamp.now(),
            });
            console.log('❌ Cabling handoff request rejected');
          }
        } else {
          console.error('❌ Activity document not found');
        }
      }
      
      // Update the request document
      const updateData: any = {
        status,
        updatedAt: Timestamp.now(),
        updatedBy: user?.userId || 'unknown',
        archived: status === 'APPROVED' || status === 'REJECTED', // ⚠️ Archive on approve/reject
      };
      
      await updateDoc(requestRef, updateData);
      console.log('✅ Cabling request updated and archived');
    },
    onSuccess: () => {
      console.log('✅ Cabling request mutation completed');
    },
    onError: (error) => {
      console.error('❌ Cabling request mutation error:', error);
    },
  });

  const handleApprove = (requestId: string) => {
    console.log('Approving cabling request:', requestId);
    updateRequestMutation.mutate({ 
      requestId, 
      status: 'APPROVED'
    });
  };

  const handleReject = (requestId: string) => {
    console.log('Rejecting cabling request:', requestId);
    updateRequestMutation.mutate({ requestId, status: 'REJECTED' });
  };

  const handleScheduleClick = (requestId: string) => {
    setSelectedRequestForSchedule(requestId);
    setSelectedDate(new Date());
    setScheduleModalVisible(true);
  };

  const handleScheduleSave = () => {
    scheduleMutation.mutate({ requestId: selectedRequestForSchedule, scheduledAt: selectedDate });
  };

  const handleGoToTask = (request: CablingRequest) => {
    if (!request.taskId || !request.activityId) {
      Alert.alert('Error', 'Task information not available');
      return;
    }
    router.push(`/supervisor-task-detail?activity=${request.activityId}&subActivity=${request.taskId}&name=${encodeURIComponent(request.activityName || 'Activity')}`);
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

  const formatScheduledDate = (timestamp?: Timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate();
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const incomingRequests = requests.filter(r => !r.archived && r.status !== 'scheduled');
  const scheduledRequests = requests.filter(r => r.status === 'scheduled');
  const archivedRequests = requests.filter(r => r.archived);
  const pendingCount = requests.filter(r => r.status === 'PENDING' && !r.archived).length;
  const scheduledCount = scheduledRequests.length;

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

  const getTargetModuleLabel = (targetModule?: string) => {
    switch (targetModule) {
      case 'mv-cable': return 'MV Cable Module';
      case 'dc-cable': return 'DC Cable Module';
      case 'lv-cable': return 'LV Cable Module';
      default: return 'Cables Module';
    }
  };

  const renderRequest = (request: CablingRequest, isPending: boolean) => {
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
              {request.status}
            </Text>
          </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.requestTime}>
                {formatTimestamp(request.requestedAt)}
              </Text>
              {isExpanded ? <ChevronUp size={20} color="#64748b" /> : <ChevronDown size={20} color="#64748b" />}
            </View>
          </View>

          <Text style={styles.requestTitle}>{request.mainMenuName || 'Cabling Handoff Request'}</Text>
          <Text style={styles.compactInfo}>
            {request.activityName} • {request.subMenuName} → {getTargetModuleLabel(request.targetModule)}
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

            <View style={styles.targetModule}>
              <Cable size={16} color="#7c3aed" />
              <Text style={styles.targetModuleText}>
                → {getTargetModuleLabel(request.targetModule)}
              </Text>
            </View>

            <View style={styles.requestMeta}>
              <Text style={styles.metaLabel}>Requested by:</Text>
              <Text style={styles.metaValue}>{request.requestedByName || request.requestedBy}</Text>
            </View>

            {isPending && request.status === 'PENDING' && (
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
                  style={[styles.actionButton, styles.approveButton]}
                  activeOpacity={0.8}
                  onPress={() => handleApprove(request.id)}
                  disabled={updateRequestMutation.isPending}
                >
                  <CheckCircle size={18} color="#fff" />
                  <Text style={styles.actionButtonText}>Hand Off</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.rejectButton]}
                  activeOpacity={0.8}
                  onPress={() => handleReject(request.id)}
                  disabled={updateRequestMutation.isPending}
                >
                  <XCircle size={18} color="#fff" />
                  <Text style={styles.actionButtonText}>Decline</Text>
                </TouchableOpacity>
              </View>
            )}

            {isPending && request.status === 'scheduled' && request.scheduledAt && (
              <View style={styles.scheduledInfo}>
                <View style={styles.scheduledDateBlock}>
                  <Calendar size={20} color="#7c3aed" />
                  <Text style={styles.scheduledDateText}>
                    Scheduled: {formatScheduledDate(request.scheduledAt)}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.actionButton, styles.deepLinkButton]}
                  activeOpacity={0.8}
                  onPress={() => handleGoToTask(request)}
                >
                  <ExternalLink size={18} color="#fff" />
                  <Text style={styles.actionButtonText}>Go to Task</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Cabling Requests',
          headerStyle: {
            backgroundColor: '#7c3aed',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: '600' as const,
          },
        }}
      />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <Cable size={32} color="#7c3aed" />
          <Text style={styles.headerTitle}>Cabling Handoff Requests</Text>
          <Text style={styles.headerSubtitle}>
            {pendingCount} pending approval
          </Text>
          <Text style={styles.infoText}>
            Trenching teams request cable laying handoff to Cables module
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
            <Cable size={20} color={activeTab === 'incoming' ? '#7c3aed' : '#64748b'} />
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
            <Calendar size={18} color={activeTab === 'scheduled' ? '#7c3aed' : '#64748b'} />
            <Text style={[styles.tabText, activeTab === 'scheduled' && styles.activeTabText]}>
              Schedules
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
            <Archive size={18} color={activeTab === 'archived' ? '#7c3aed' : '#64748b'} />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#7c3aed" />
            <Text style={styles.loadingText}>Loading requests...</Text>
          </View>
        ) : (
          <View style={styles.section}>
            {activeTab === 'incoming' && (
              incomingRequests.length > 0 ? (
                incomingRequests.map(request => renderRequest(request, request.status === 'PENDING'))
              ) : (
                <View style={styles.emptyContainer}>
                  <Cable size={48} color="#cbd5e1" />
                  <Text style={styles.emptyText}>No incoming requests</Text>
                </View>
              )
            )}

            {activeTab === 'scheduled' && (
              scheduledRequests.length > 0 ? (
                scheduledRequests.map(request => renderRequest(request, true))
              ) : (
                <View style={styles.emptyContainer}>
                  <Calendar size={48} color="#cbd5e1" />
                  <Text style={styles.emptyText}>No scheduled requests</Text>
                </View>
              )
            )}

            {activeTab === 'archived' && (
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

      <Modal visible={scheduleModalVisible} transparent animationType="slide" onRequestClose={() => setScheduleModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Schedule Handover</Text>
            <Text style={styles.modalSubtitle}>Select start date</Text>
            
            <TouchableOpacity
              style={styles.dateTimeButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Calendar size={16} color="#64748b" />
              <Text style={styles.dateTimeButtonText}>
                {selectedDate.toLocaleDateString('en-GB')}
              </Text>
            </TouchableOpacity>
            
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
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setScheduleModalVisible(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonApprove]}
                onPress={handleScheduleSave}
                disabled={scheduleMutation.isPending}
              >
                <Text style={styles.modalButtonText}>Schedule</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
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
  infoText: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 16,
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
  taskDetailsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  taskDetailItem: {
    flex: 1,
    backgroundColor: '#faf5ff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#7c3aed',
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
  targetModule: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f5f3ff',
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  targetModuleText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#7c3aed',
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
  scopeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    marginBottom: 12,
  },
  scopeLabel: {
    fontSize: 13,
    color: '#64748b',
    marginRight: 8,
  },
  scopeValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#059669',
  },
  scopeInputContainer: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#334155',
    marginBottom: 6,
  },
  scopeInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
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
  scheduleButton: {
    backgroundColor: '#3b82f6',
  },
  approveButton: {
    backgroundColor: '#10b981',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  deepLinkButton: {
    backgroundColor: '#7c3aed',
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
    backgroundColor: '#ede9fe',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#64748b',
  },
  activeTabText: {
    color: '#7c3aed',
    fontWeight: '600' as const,
  },
  badge: {
    backgroundColor: '#7c3aed',
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
  compactInfo: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  expandedContent: {
    marginTop: 12,
  },
  scheduledInfo: {
    marginTop: 12,
  },
  scheduledDateBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ede9fe',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  scheduledDateText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#6d28d9',
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
  dateTimeButton: {
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
    marginBottom: 20,
  },
  dateTimeButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#334155',
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
});
