import { Stack, useRouter } from 'expo-router';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Switch, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Package, CheckCircle, XCircle, Clock, Archive, ChevronRight, RotateCcw, Calendar } from 'lucide-react-native';
import TimestampFooter from '../components/TimestampFooter';
import { useAuth } from '../contexts/AuthContext';
import { useMutation } from '@tanstack/react-query';
import { useButtonProtection } from '../utils/hooks/useButtonProtection';
import { useSyncOnFocus } from '../utils/hooks/useSyncOnFocus';
import { collection, query, where, orderBy, doc, updateDoc, Timestamp, onSnapshot, getDocs, getDoc } from 'firebase/firestore';
import { queueFirestoreOperation } from '../utils/offlineQueue';
import { db } from '../config/firebase';
import { RequestStatus } from '../types';
import { useState, useEffect, useMemo } from 'react';
import { restoreRequest, archiveRequestsByMonth, groupRequestsByMonth, getMonthLabel } from '../utils/requestArchive';
import * as Haptics from 'expo-haptics';

type MaterialRequest = {
  id: string;
  type: 'LOGISTICS_REQUEST';
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
  materialDescription?: string;
  quantity?: number;
  unit?: string;
  urgency?: 'low' | 'medium' | 'high' | 'critical';
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

export default function MaterialRequestsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { protectAction } = useButtonProtection();
  useSyncOnFocus();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'incoming' | 'scheduled' | 'archived'>('incoming');
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedRequests, setExpandedRequests] = useState<Record<string, boolean>>({});
  const [optimisticallyHiddenCards, setOptimisticallyHiddenCards] = useState<Set<string>>(() => new Set<string>());
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  useEffect(() => {
    if (!user?.siteId) {
      console.log('❌ MATERIALS REQUEST QUERY - No siteId');
      setIsLoading(false);
      return;
    }

    console.log('🔍 MATERIALS REQUEST REALTIME - Setting up listener for siteId:', user.siteId);
    setIsLoading(true);

    const requestsRef = collection(db, 'requests');
    const q = query(
      requestsRef,
      where('type', '==', 'LOGISTICS_REQUEST'),
      where('siteId', '==', user.siteId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        console.log('📊 MATERIALS REQUEST REALTIME - Received', snapshot.docs.length, 'documents');
        const results: MaterialRequest[] = [];
        
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          const requestData: MaterialRequest = {
            id: docSnap.id,
            ...data
          } as MaterialRequest;

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
        console.error('❌ MATERIALS REQUEST REALTIME - Error:', err);
        setIsLoading(false);
      }
    );

    return () => {
      console.log('🔴 MATERIALS REQUEST REALTIME - Cleaning up listener');
      unsubscribe();
    };
  }, [user?.siteId]);

  const updateRequestMutation = useMutation({
    mutationFn: async ({ 
      requestId, 
      status, 
      scheduledDate,
    }: { 
      requestId: string; 
      status: RequestStatus;
      scheduledDate?: Date;
    }) => {
      console.log('🔄 [Optimistic] Updating material request:', requestId, 'to status:', status);
      const requestRef = doc(db, 'requests', requestId);
      
      if (status === 'APPROVED' || status === 'scheduled') {
        const updateData: any = {
          status: scheduledDate ? 'scheduled' : 'APPROVED',
          updatedAt: Timestamp.now(),
          updatedBy: user?.userId || 'unknown',
        };

        if (scheduledDate) {
          updateData.scheduledDeliveryDate = Timestamp.fromDate(scheduledDate);
        }

        if (!scheduledDate) {
          updateData.archived = true;
          updateData.approvedAt = Timestamp.now();
          updateData.approvedBy = user?.userId || 'unknown';
        }

        await queueFirestoreOperation(
          { type: 'update', collection: 'requests', docId: requestId, data: updateData },
          { priority: 'P0', entityType: 'activityRequest' }
        );
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
      console.log('✅ [Optimistic] Material request mutation completed');
      setOptimisticallyHiddenCards((prev) => {
        const next = new Set(prev);
        next.delete(variables.requestId);
        return next;
      });
    },
    onError: (error, variables) => {
      console.error('❌ [Optimistic] Material request mutation error:', error);
      setOptimisticallyHiddenCards((prev) => {
        const next = new Set(prev);
        next.delete(variables.requestId);
        return next;
      });
      Alert.alert('Error', 'Failed to update request. Please try again.');
    },
  });

  const handleApproveInternal = (requestId: string) => {
    console.log('[Optimistic] Approving material request:', requestId);
    setOptimisticallyHiddenCards((prev) => new Set(prev).add(requestId));
    updateRequestMutation.mutate({ requestId, status: 'APPROVED' });
  };

  const handleScheduleInternal = (requestId: string) => {
    console.log('[Optimistic] Scheduling material request:', requestId);
    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + 1);
    
    setOptimisticallyHiddenCards((prev) => new Set(prev).add(requestId));
    updateRequestMutation.mutate({ requestId, status: 'scheduled', scheduledDate });
  };

  const handleRejectInternal = (requestId: string) => {
    console.log('[Optimistic] Rejecting material request:', requestId);
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

  const getUrgencyColor = (urgency?: string) => {
    switch (urgency) {
      case 'critical': return '#ef4444';
      case 'high': return '#f59e0b';
      case 'medium': return '#3b82f6';
      case 'low': return '#10b981';
      default: return '#64748b';
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
              const result = await archiveRequestsByMonth(user.siteId!, 'LOGISTICS_REQUEST', user.userId!);
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

  const renderRequest = (request: MaterialRequest, showActions: boolean) => {
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
            {request.urgency && (
              <View style={[styles.urgencyBadge, { backgroundColor: `${getUrgencyColor(request.urgency)}20` }]}>
                <Text style={[styles.urgencyText, { color: getUrgencyColor(request.urgency) }]}>
                  {request.urgency.toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.requestTitle}>{request.materialDescription || 'Material Request'}</Text>
          
          {request.quantity && (
            <View style={styles.quantityRow}>
              <Text style={styles.quantityLabel}>Quantity:</Text>
              <Text style={styles.quantityValue}>{request.quantity} {request.unit || 'units'}</Text>
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
              <Clock size={16} color="#3b82f6" />
              <Text style={styles.scheduledDateLabel}>Scheduled Delivery:</Text>
              <Text style={styles.scheduledDateValue}>{formatTimestamp(request.scheduledDeliveryDate)}</Text>
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
          title: 'Material Requests',
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
          <Package size={32} color="#059669" />
          <Text style={styles.headerTitle}>Material Requests</Text>
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
            <Package size={20} color={activeTab === 'incoming' ? '#059669' : '#64748b'} />
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
            <Clock size={20} color={activeTab === 'scheduled' ? '#059669' : '#64748b'} />
            <Text style={[styles.tabText, activeTab === 'scheduled' && styles.activeTabText]}>
              Scheduled
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'archived' && styles.activeTab]}
            activeOpacity={0.7}
            onPress={() => setActiveTab('archived')}
          >
            <Archive size={20} color={activeTab === 'archived' ? '#059669' : '#64748b'} />
            <Text style={[styles.tabText, activeTab === 'archived' && styles.activeTabText]}>
              Archive
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
                incomingRequests.map(request => renderRequest(request, true))
              ) : (
                <View style={styles.emptyContainer}>
                  <Package size={48} color="#cbd5e1" />
                  <Text style={styles.emptyText}>No incoming requests</Text>
                </View>
              )
            ) : activeTab === 'scheduled' ? (
              scheduledRequests.length > 0 ? (
                scheduledRequests.map(request => renderRequest(request, false))
              ) : (
                <View style={styles.emptyContainer}>
                  <Clock size={48} color="#cbd5e1" />
                  <Text style={styles.emptyText}>No scheduled deliveries</Text>
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
                        <Calendar size={18} color="#059669" />
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
    backgroundColor: '#f8fafc',
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
  urgencyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  urgencyText: {
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
  },
  requestTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#1e293b',
    marginBottom: 8,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#059669',
  },
  quantityLabel: {
    fontSize: 13,
    color: '#064e3b',
    marginRight: 8,
    fontWeight: '600' as const,
  },
  quantityValue: {
    fontSize: 15,
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
    color: '#64748b',
    marginRight: 6,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#1e293b',
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
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    color: '#1e293b',
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
    backgroundColor: '#f8fafc',
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
    color: '#334155',
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
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  activeTab: {
    backgroundColor: '#d1fae5',
  },
  tabText: {
    fontSize: 13,
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
  taskDetailsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  taskDetailItem: {
    flex: 1,
    backgroundColor: '#f0fdf4',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#059669',
  },
  taskDetailLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#064e3b',
    textTransform: 'uppercase' as const,
    marginBottom: 2,
  },
  taskDetailValue: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#1e293b',
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
    backgroundColor: '#059669',
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
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  monthHeaderText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  monthBadge: {
    backgroundColor: '#059669',
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
