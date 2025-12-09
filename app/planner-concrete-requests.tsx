import { Stack, useRouter } from 'expo-router';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, Modal, Alert, Platform } from 'react-native';
import { Drill, CheckCircle, XCircle, Clock, Archive, ChevronDown, ChevronUp, Calendar, ExternalLink } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useMutation } from '@tanstack/react-query';
import { collection, query, where, orderBy, doc, updateDoc, Timestamp, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { RequestType, RequestStatus } from '@/types';
import { getCachedUserNameAsync } from '@/utils/userCache';
import { useState, useEffect } from 'react';

type ConcreteRequest = {
  id: string;
  type: RequestType;
  status: RequestStatus;
  requestedBy: string;
  requestedByName?: string;
  requestedAt: Timestamp;
  taskId?: string;
  pvArea?: string;
  blockNumber?: string;
  specialArea?: string;
  subActivity?: string;
  subActivityName?: string;
  siteId?: string;
  archived?: boolean;
  scheduledAt?: Timestamp;
  scheduledBy?: string;
  quantity?: number;
  unit?: string;
};

export default function PlannerConcreteRequestsScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'incoming' | 'scheduled' | 'archived'>('incoming');
  const [requests, setRequests] = useState<ConcreteRequest[]>([]);
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
      console.log('❌ PLANNER CONCRETE QUERY - No siteId');
      setIsLoading(false);
      return;
    }

    console.log('🔍 PLANNER CONCRETE REALTIME - Setting up listener for siteId:', user.siteId);
    setIsLoading(true);

    const requestsRef = collection(db, 'requests');
    const q = query(
      requestsRef,
      where('type', '==', 'CONCRETE_REQUEST'),
      where('siteId', '==', user.siteId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        console.log('📊 PLANNER CONCRETE REALTIME - Received', snapshot.docs.length, 'documents');
        
        const results: ConcreteRequest[] = await Promise.all(
          snapshot.docs.map(async (docSnap) => {
            const data = docSnap.data();
            const requestedByName = data.requestedBy 
              ? await getCachedUserNameAsync(data.requestedBy) || data.requestedBy
              : undefined;
            
            return {
              id: docSnap.id,
              ...data,
              requestedByName,
            } as ConcreteRequest;
          })
        );
        
        setRequests(results);
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        console.error('❌ PLANNER CONCRETE REALTIME - Error:', err);
        setError(err as Error);
        setIsLoading(false);
      }
    );

    return () => {
      console.log('🔴 PLANNER CONCRETE REALTIME - Cleaning up listener');
      unsubscribe();
    };
  }, [user?.siteId]);

  const scheduleMutation = useMutation({
    mutationFn: async ({ requestId, scheduledAt }: { requestId: string; scheduledAt: Date }) => {
      console.log('🗓️ Scheduling concrete request:', requestId, 'for:', scheduledAt);
      
      const requestRef = doc(db, 'requests', requestId);
      await updateDoc(requestRef, {
        status: 'scheduled',
        scheduledAt: Timestamp.fromDate(scheduledAt),
        scheduledBy: user?.userId || 'unknown',
        updatedAt: Timestamp.now(),
      });
      
      console.log('✅ Concrete request scheduled successfully');
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
      console.log('🔄 Updating concrete request:', requestId, 'to status:', status);
      
      const requestRef = doc(db, 'requests', requestId);
      const requestDoc = await getDoc(requestRef);
      
      if (!requestDoc.exists()) {
        throw new Error('Request not found');
      }
      
      const requestData = requestDoc.data();
      console.log('📄 Request data:', JSON.stringify(requestData, null, 2));
      
      if (requestData.taskId) {
        const taskRef = doc(db, 'tasks', requestData.taskId);
        
        if (status === 'APPROVED') {
          await updateDoc(taskRef, {
            concreteRequested: false,
            concreteApproved: true,
            updatedAt: Timestamp.now(),
            approvedBy: user?.userId,
            approvedAt: Timestamp.now(),
          });
          console.log('✅ Concrete request approved');
        } else if (status === 'REJECTED') {
          await updateDoc(taskRef, {
            concreteRequested: false,
            updatedAt: Timestamp.now(),
          });
          console.log('❌ Concrete request rejected');
        }
      }
      
      const updateData: any = {
        status,
        updatedAt: Timestamp.now(),
        updatedBy: user?.userId || 'unknown',
        archived: status === 'APPROVED' || status === 'REJECTED',
      };
      
      await updateDoc(requestRef, updateData);
      console.log('✅ Concrete request updated and archived');
    },
    onSuccess: () => {
      console.log('✅ Concrete request mutation completed');
    },
    onError: (error) => {
      console.error('❌ Concrete request mutation error:', error);
    },
  });

  const handleApprove = (requestId: string) => {
    console.log('Approving concrete request:', requestId);
    updateRequestMutation.mutate({ 
      requestId, 
      status: 'APPROVED'
    });
  };

  const handleReject = (requestId: string) => {
    console.log('Rejecting concrete request:', requestId);
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

  const handleGoToTask = (request: ConcreteRequest) => {
    if (!request.taskId) {
      Alert.alert('Error', 'Task information not available');
      return;
    }
    router.push(`/supervisor-task-detail?activity=mechanical&subActivity=tracker-installation&name=${encodeURIComponent('Tracker Installation')}`);
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

  const renderRequest = (request: ConcreteRequest, isPending: boolean) => {
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

          <Text style={styles.requestTitle}>{request.subActivityName || 'Tracker Installation'}</Text>
          
          <View style={styles.keyInfoRow}>
            <View style={styles.keyInfoItem}>
              <Text style={styles.keyInfoLabel}>Quantity:</Text>
              <Text style={styles.keyInfoValue}>{request.quantity || 0} {request.unit || 'm³'}</Text>
            </View>
          </View>
          
          <View style={styles.keyInfoRow}>
            <View style={styles.keyInfoItem}>
              <Text style={styles.keyInfoLabel}>PV Area:</Text>
              <Text style={styles.keyInfoValue}>{request.pvArea || 'N/A'}</Text>
            </View>
            <View style={styles.keyInfoItem}>
              <Text style={styles.keyInfoLabel}>Block:</Text>
              <Text style={styles.keyInfoValue}>{request.blockNumber || 'N/A'}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedContent}>
            <View style={styles.quantityHighlight}>
              <Text style={styles.quantityHighlightLabel}>Concrete Quantity:</Text>
              <Text style={styles.quantityHighlightValue}>{request.quantity || 0} {request.unit || 'm³'}</Text>
            </View>

            {request.specialArea && (
              <View style={styles.specialAreaBlock}>
                <Text style={styles.taskDetailLabel}>Special Area:</Text>
                <Text style={styles.specialAreaText}>{request.specialArea}</Text>
              </View>
            )}

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
                  <Text style={styles.actionButtonText}>Approve</Text>
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
                  <Calendar size={20} color="#f97316" />
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
          title: 'Concrete Requests',
          headerStyle: {
            backgroundColor: '#f97316',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: '600' as const,
          },
        }}
      />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <Drill size={32} color="#f97316" />
          <Text style={styles.headerTitle}>Concrete Requests</Text>
          <Text style={styles.headerSubtitle}>
            {pendingCount} pending approval
          </Text>
          <Text style={styles.infoText}>
            Tracker Installation teams request concrete delivery
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
            <Drill size={20} color={activeTab === 'incoming' ? '#f97316' : '#64748b'} />
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
            <Calendar size={18} color={activeTab === 'scheduled' ? '#f97316' : '#64748b'} />
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
            <Archive size={18} color={activeTab === 'archived' ? '#f97316' : '#64748b'} />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#f97316" />
            <Text style={styles.loadingText}>Loading requests...</Text>
          </View>
        ) : (
          <View style={styles.section}>
            {activeTab === 'incoming' && (
              incomingRequests.length > 0 ? (
                incomingRequests.map(request => renderRequest(request, request.status === 'PENDING'))
              ) : (
                <View style={styles.emptyContainer}>
                  <Drill size={48} color="#cbd5e1" />
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
            <Text style={styles.modalTitle}>Schedule Concrete Delivery</Text>
            <Text style={styles.modalSubtitle}>Select delivery date</Text>
            
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
    backgroundColor: '#fff7ed',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#f97316',
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
  specialAreaBlock: {
    backgroundColor: '#fef3c7',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  specialAreaText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#92400e',
    marginTop: 4,
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
    backgroundColor: '#f97316',
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
    backgroundColor: '#fff7ed',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#64748b',
  },
  activeTabText: {
    color: '#f97316',
    fontWeight: '600' as const,
  },
  badge: {
    backgroundColor: '#f97316',
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
  keyInfoRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  keyInfoItem: {
    flex: 1,
    backgroundColor: '#fff7ed',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#f97316',
  },
  keyInfoLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: '#92400e',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  keyInfoValue: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: '#ea580c',
  },
  quantityHighlight: {
    backgroundColor: '#fef3c7',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#f59e0b',
    marginBottom: 16,
    alignItems: 'center',
  },
  quantityHighlightLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#92400e',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  quantityHighlightValue: {
    fontSize: 28,
    fontWeight: '900' as const,
    color: '#b45309',
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
    backgroundColor: '#fff7ed',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  scheduledDateText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#ea580c',
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
    backgroundColor: '#f97316',
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
