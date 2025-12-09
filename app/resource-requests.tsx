import { Stack } from 'expo-router';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Package, Users, Box, Clock, Archive, CheckCircle, XCircle } from 'lucide-react-native';

import { useAuth } from '../contexts/AuthContext';
import { useMutation } from '@tanstack/react-query';
import { useButtonProtection } from '../utils/hooks/useButtonProtection';
import { useSyncOnFocus } from '../utils/hooks/useSyncOnFocus';
import { collection, query, where, orderBy, doc, Timestamp, onSnapshot, getDocs, getDoc } from 'firebase/firestore';
import { queueFirestoreOperation } from '../utils/offlineQueue';
import { db } from '../config/firebase';
import { RequestStatus } from '../types';
import { useState, useEffect, useMemo } from 'react';
import { RequestCard } from '../components/RequestCard';

type BaseRequest = {
  id: string;
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
  archived?: boolean;
  supervisorId?: string;
  supervisorName?: string;
  pvArea?: string;
  blockArea?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  updatedBy?: string;
  approvedAt?: Timestamp;
  approvedBy?: string;
  notes?: string;
};

type PlantRequest = BaseRequest & {
  type: 'PLANT_REQUEST';
  plantType: string;
  quantity: number;
  scheduledDeliveryDate?: Timestamp;
};

type MaterialRequest = BaseRequest & {
  type: 'MATERIALS_REQUEST';
  materialName: string;
  quantity: number;
  unit: string;
};

type StaffRequest = BaseRequest & {
  type: 'STAFF_REQUEST';
  employeeType: string;
  quantity: number;
  scheduledStartDate?: Timestamp;
};

type ResourceRequest = PlantRequest | MaterialRequest | StaffRequest;

type RequestTypeFilter = 'all' | 'PLANT_REQUEST' | 'MATERIALS_REQUEST' | 'STAFF_REQUEST';

export default function ResourceRequestsScreen() {
  const { user } = useAuth();
  const { protectAction } = useButtonProtection();
  useSyncOnFocus();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'incoming' | 'archived'>('incoming');
  const [requestTypeFilter, setRequestTypeFilter] = useState<RequestTypeFilter>('all');
  const [requests, setRequests] = useState<ResourceRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedRequests, setExpandedRequests] = useState<Record<string, boolean>>({});
  const [optimisticallyHiddenCards, setOptimisticallyHiddenCards] = useState<Set<string>>(() => new Set<string>());

  useEffect(() => {
    if (!user?.siteId) {
      console.log('❌ RESOURCE REQUEST QUERY - No siteId');
      setIsLoading(false);
      return;
    }

    console.log('🔍 RESOURCE REQUEST REALTIME - Setting up listener for siteId:', user.siteId);
    setIsLoading(true);

    const requestsRef = collection(db, 'requests');
    const q = query(
      requestsRef,
      where('siteId', '==', user.siteId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        console.log('📊 RESOURCE REQUEST REALTIME - Received', snapshot.docs.length, 'documents');
        const results: ResourceRequest[] = [];
        
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          
          if (data.type !== 'PLANT_REQUEST' && data.type !== 'MATERIALS_REQUEST' && data.type !== 'STAFF_REQUEST') {
            continue;
          }

          const requestData: any = {
            id: docSnap.id,
            ...data
          };

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

          results.push(requestData as ResourceRequest);
        }
        
        setRequests(results);
        setIsLoading(false);
      },
      (err) => {
        console.error('❌ RESOURCE REQUEST REALTIME - Error:', err);
        setIsLoading(false);
      }
    );

    return () => {
      console.log('🔴 RESOURCE REQUEST REALTIME - Cleaning up listener');
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
      console.log('🔄 [Optimistic] Updating resource request:', requestId, 'to status:', status);
      
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
      console.log('✅ [Optimistic] Resource request mutation completed');
      setOptimisticallyHiddenCards((prev) => {
        const next = new Set(prev);
        next.delete(variables.requestId);
        return next;
      });
    },
    onError: (error, variables) => {
      console.error('❌ [Optimistic] Resource request mutation error:', error);
      setOptimisticallyHiddenCards((prev) => {
        const next = new Set(prev);
        next.delete(variables.requestId);
        return next;
      });
      Alert.alert('Error', 'Failed to update request. Please try again.');
    },
  });

  const handleApproveInternal = (requestId: string) => {
    console.log('[Optimistic] Approving resource request:', requestId);
    setOptimisticallyHiddenCards((prev) => new Set(prev).add(requestId));
    updateRequestMutation.mutate({ requestId, status: 'APPROVED' });
  };

  const handleRejectInternal = (requestId: string) => {
    console.log('[Optimistic] Rejecting resource request:', requestId);
    setOptimisticallyHiddenCards((prev) => new Set(prev).add(requestId));
    updateRequestMutation.mutate({ requestId, status: 'REJECTED' });
  };

  const filteredRequests = useMemo(() => {
    let filtered = requests;
    
    if (activeTab === 'incoming') {
      filtered = filtered.filter(r => r.status === 'PENDING' && !r.archived && !optimisticallyHiddenCards.has(r.id));
    } else {
      filtered = filtered.filter(r => r.archived);
    }

    if (requestTypeFilter !== 'all') {
      filtered = filtered.filter(r => r.type === requestTypeFilter);
    }

    return filtered;
  }, [requests, activeTab, requestTypeFilter, optimisticallyHiddenCards]);

  const pendingCount = requests.filter(r => r.status === 'PENDING' && !r.archived && !optimisticallyHiddenCards.has(r.id)).length;
  const plantCount = requests.filter(r => r.type === 'PLANT_REQUEST' && r.status === 'PENDING' && !r.archived && !optimisticallyHiddenCards.has(r.id)).length;
  const materialsCount = requests.filter(r => r.type === 'MATERIALS_REQUEST' && r.status === 'PENDING' && !r.archived && !optimisticallyHiddenCards.has(r.id)).length;
  const staffCount = requests.filter(r => r.type === 'STAFF_REQUEST' && r.status === 'PENDING' && !r.archived && !optimisticallyHiddenCards.has(r.id)).length;

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



  const getRequestIcon = (type: ResourceRequest['type']) => {
    switch (type) {
      case 'PLANT_REQUEST': return Package;
      case 'MATERIALS_REQUEST': return Box;
      case 'STAFF_REQUEST': return Users;
    }
  };

  const getRequestColor = (type: ResourceRequest['type']) => {
    switch (type) {
      case 'PLANT_REQUEST': return '#f59e0b';
      case 'MATERIALS_REQUEST': return '#0284c7';
      case 'STAFF_REQUEST': return '#8b5cf6';
    }
  };

  const getRequestTitle = (request: ResourceRequest) => {
    switch (request.type) {
      case 'PLANT_REQUEST':
        return `${request.plantType} (${request.quantity})`;
      case 'MATERIALS_REQUEST':
        return `${request.materialName} (${request.quantity} ${request.unit})`;
      case 'STAFF_REQUEST':
        return `${request.employeeType} (${request.quantity})`;
    }
  };

  const getRequestSubtitle = (request: ResourceRequest) => {
    const parts: string[] = [];
    
    if (request.mainMenuName) parts.push(request.mainMenuName);
    if (request.subMenuName) parts.push(request.subMenuName);
    
    return parts.join(' • ') || 'Resource Request';
  };

  const renderRequest = (request: ResourceRequest, showActions: boolean) => {
    const StatusIcon = getStatusIcon(request.status);
    const statusColor = getStatusColor(request.status);
    const RequestIcon = getRequestIcon(request.type);
    const requestColor = getRequestColor(request.type);
    const isExpanded = expandedRequests[request.id] || false;

    const runApproveAction = () => {
      const execute = protectAction(
        `approve-${request.id}`,
        () => handleApproveInternal(request.id)
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
      <RequestCard
        key={request.id}
        id={request.id}
        isExpanded={isExpanded}
        onToggle={() => setExpandedRequests(prev => ({ ...prev, [request.id]: !isExpanded }))}
        statusBadge={
          <View style={styles.statusBadgeContainer}>
            <View style={[styles.typeBadge, { backgroundColor: `${requestColor}20` }]}>
              <RequestIcon size={14} color={requestColor} />
              <Text style={[styles.typeText, { color: requestColor }]}>
                {request.type.replace('_REQUEST', '')}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
              <StatusIcon size={14} color={statusColor} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {request.status}
              </Text>
            </View>
          </View>
        }
        timestamp={request.createdAt || request.requestedAt}
        title={getRequestTitle(request)}
        subtitle={getRequestSubtitle(request)}
        status={request.status}
      >
        <View style={styles.expandedContent}>
          <View style={styles.detailsSection}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Requested by:</Text>
              <Text style={styles.detailValue}>{request.requestedByName || request.requestedBy}</Text>
            </View>

            {(request.pvArea || request.blockArea) && (
              <View style={styles.locationSection}>
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

            {request.notes && (
              <View style={styles.notesContainer}>
                <Text style={styles.notesLabel}>Notes:</Text>
                <Text style={styles.notesText}>{request.notes}</Text>
              </View>
            )}
          </View>

          {showActions && (
            <View style={styles.actionButtons}>
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
        </View>
      </RequestCard>
    );
  };

  const scrollContentStyle = useMemo(() => ({
    paddingBottom: Math.max(insets.bottom + 120, 160),
  }), [insets.bottom]);

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 0) }]}> 
      <Stack.Screen
        options={{
          title: 'Resource Requests',
          headerStyle: {
            backgroundColor: '#6366f1',
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
          <Box size={32} color="#6366f1" />
          <Text style={styles.headerTitle}>Resource Requests</Text>
          <Text style={styles.headerSubtitle}>
            {pendingCount} pending approval
          </Text>
        </View>

        <View style={styles.quickStatsRow}>
          <View style={[styles.quickStatCard, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}>
            <Package size={20} color="#f59e0b" />
            <Text style={[styles.quickStatValue, { color: '#92400e' }]}>{plantCount}</Text>
            <Text style={[styles.quickStatLabel, { color: '#92400e' }]}>Plant</Text>
          </View>
          
          <View style={[styles.quickStatCard, { backgroundColor: '#e0f2fe', borderColor: '#bae6fd' }]}>
            <Box size={20} color="#0284c7" />
            <Text style={[styles.quickStatValue, { color: '#075985' }]}>{materialsCount}</Text>
            <Text style={[styles.quickStatLabel, { color: '#075985' }]}>Materials</Text>
          </View>
          
          <View style={[styles.quickStatCard, { backgroundColor: '#f3e8ff', borderColor: '#e9d5ff' }]}>
            <Users size={20} color="#8b5cf6" />
            <Text style={[styles.quickStatValue, { color: '#5b21b6' }]}>{staffCount}</Text>
            <Text style={[styles.quickStatLabel, { color: '#5b21b6' }]}>Staff</Text>
          </View>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'incoming' && styles.activeTab]}
            activeOpacity={0.7}
            onPress={() => setActiveTab('incoming')}
          >
            <Clock size={20} color={activeTab === 'incoming' ? '#6366f1' : '#64748b'} />
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
            <Archive size={20} color={activeTab === 'archived' ? '#6366f1' : '#64748b'} />
            <Text style={[styles.tabText, activeTab === 'archived' && styles.activeTabText]}>
              Archive
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            <TouchableOpacity
              style={[styles.filterChip, requestTypeFilter === 'all' && styles.activeFilterChip]}
              onPress={() => setRequestTypeFilter('all')}
            >
              <Text style={[styles.filterChipText, requestTypeFilter === 'all' && styles.activeFilterChipText]}>
                All
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.filterChip, requestTypeFilter === 'PLANT_REQUEST' && styles.activeFilterChip]}
              onPress={() => setRequestTypeFilter('PLANT_REQUEST')}
            >
              <Package size={16} color={requestTypeFilter === 'PLANT_REQUEST' ? '#fff' : '#64748b'} />
              <Text style={[styles.filterChipText, requestTypeFilter === 'PLANT_REQUEST' && styles.activeFilterChipText]}>
                Plant
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.filterChip, requestTypeFilter === 'MATERIALS_REQUEST' && styles.activeFilterChip]}
              onPress={() => setRequestTypeFilter('MATERIALS_REQUEST')}
            >
              <Box size={16} color={requestTypeFilter === 'MATERIALS_REQUEST' ? '#fff' : '#64748b'} />
              <Text style={[styles.filterChipText, requestTypeFilter === 'MATERIALS_REQUEST' && styles.activeFilterChipText]}>
                Materials
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.filterChip, requestTypeFilter === 'STAFF_REQUEST' && styles.activeFilterChip]}
              onPress={() => setRequestTypeFilter('STAFF_REQUEST')}
            >
              <Users size={16} color={requestTypeFilter === 'STAFF_REQUEST' ? '#fff' : '#64748b'} />
              <Text style={[styles.filterChipText, requestTypeFilter === 'STAFF_REQUEST' && styles.activeFilterChipText]}>
                Staff
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loadingText}>Loading requests...</Text>
          </View>
        ) : (
          <View style={styles.section}>
            {filteredRequests.length > 0 ? (
              filteredRequests.map(request => renderRequest(request, activeTab === 'incoming'))
            ) : (
              <View style={styles.emptyContainer}>
                <Box size={48} color="#cbd5e1" />
                <Text style={styles.emptyText}>No requests found</Text>
                <Text style={styles.emptySubtext}>
                  {activeTab === 'incoming' ? 'All requests have been processed' : 'No archived requests'}
                </Text>
              </View>
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
  quickStatsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  quickStatCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  quickStatValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    marginTop: 8,
  },
  quickStatLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
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
  statusBadgeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
  },
  expandedContent: {
    marginTop: 12,
  },
  detailsSection: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13,
    color: '#64748b',
    marginRight: 6,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  locationSection: {
    flexDirection: 'row',
    gap: 8,
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
  notesContainer: {
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
    fontWeight: '600' as const,
  },
  emptySubtext: {
    marginTop: 4,
    fontSize: 13,
    color: '#cbd5e1',
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
    backgroundColor: '#eef2ff',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#64748b',
  },
  activeTabText: {
    color: '#6366f1',
    fontWeight: '600' as const,
  },
  badge: {
    backgroundColor: '#6366f1',
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
  filterContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  filterScroll: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  activeFilterChip: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#64748b',
  },
  activeFilterChipText: {
    color: '#fff',
  },
});
