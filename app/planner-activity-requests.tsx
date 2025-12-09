import { Stack } from 'expo-router';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, Alert, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ListTodo, CheckCircle, XCircle, Clock, Archive, ChevronDown, ChevronUp, ChevronRight, FolderArchive, Calendar as CalendarIcon } from 'lucide-react-native';
import TimestampFooter from '../components/TimestampFooter';
import { useAuth } from '../contexts/AuthContext';
import { useMutation } from '@tanstack/react-query';
import { useButtonProtection } from '../utils/hooks/useButtonProtection';
import { useSyncOnFocus } from '../utils/hooks/useSyncOnFocus';
import { collection, query, where, orderBy, doc, updateDoc, Timestamp, onSnapshot, getDocs, getDoc } from 'firebase/firestore';
import { queueFirestoreOperation } from '../utils/offlineQueue';
import { db } from '../config/firebase';
import { RequestType, RequestStatus } from '../types';
import { useState, useEffect, useMemo } from 'react';
import { approveScopeRequest as approveScopeRequestUtil } from '../utils/scope';
import UnitSelectorModal from '../components/UnitSelectorModal';
import type { Unit } from '../utils/unitConversion';
import { restoreRequest, groupRequestsByMonth, getMonthLabel, archiveRequestsByMonth } from '../utils/requestArchive';

type ActivityRequest = {
  id: string;
  type: RequestType;
  status: RequestStatus;
  requestedBy: string;
  requestedAt: Timestamp;
  taskId?: string;
  activityId?: string;
  activityName?: string;
  subMenuName?: string;
  mainMenuName?: string;
  siteId?: string;
  scope?: number;
  archived?: boolean;
  archivedAt?: Timestamp;
  supervisorId?: string;
  supervisorName?: string;
  pvArea?: string;
  blockArea?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  updatedBy?: string;
  approvedAt?: Timestamp;
  approvedBy?: string;
  monthlyArchive?: { year: number; month: number; };
};

export default function PlannerActivityRequestsScreen() {
  const { user } = useAuth();
  const { protectAction } = useButtonProtection();
  useSyncOnFocus();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'incoming' | 'archived'>('incoming');
  const [requests, setRequests] = useState<ActivityRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [scopeInputs, setScopeInputs] = useState<Record<string, string>>({});
  const [scopeUnits, setScopeUnits] = useState<Partial<Record<string, Unit>>>({});
  const [expandedRequests, setExpandedRequests] = useState<Record<string, boolean>>({});
  const [applyDefaultToAll, setApplyDefaultToAll] = useState<Record<string, boolean>>({});
  const [unitModalVisible, setUnitModalVisible] = useState<boolean>(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [optimisticallyHiddenCards, setOptimisticallyHiddenCards] = useState<Set<string>>(() => new Set<string>());
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user?.siteId) {
      console.log('❌ PLANNER ACTIVITY QUERY - No siteId');
      setIsLoading(false);
      return;
    }

    console.log('🔍 PLANNER ACTIVITY REALTIME - Setting up listener for siteId:', user.siteId);
    setIsLoading(true);

    const requestsRef = collection(db, 'requests');
    const q = query(
      requestsRef,
      where('type', '==', 'SCOPE_REQUEST'),
      where('siteId', '==', user.siteId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        console.log('📊 PLANNER ACTIVITY REALTIME - Received', snapshot.docs.length, 'documents');
        const results: ActivityRequest[] = [];
        
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          const requestData: ActivityRequest = {
            id: docSnap.id,
            ...data
          } as ActivityRequest;

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

          if (data.supervisorId) {
            try {
              const usersQ = query(
                collection(db, 'users'),
                where('userId', '==', data.supervisorId)
              );
              const usersSnap = await getDocs(usersQ);
              if (!usersSnap.empty) {
                requestData.supervisorName = usersSnap.docs[0].data().name || data.supervisorId;
              }
            } catch (err) {
              console.error('Error fetching supervisor name:', err);
            }
          }

          results.push(requestData);
        }
        
        setRequests(results);
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        console.error('❌ PLANNER ACTIVITY REALTIME - Error:', err);
        setError(err as Error);
        setIsLoading(false);
      }
    );

    return () => {
      console.log('🔴 PLANNER ACTIVITY REALTIME - Cleaning up listener');
      unsubscribe();
    };
  }, [user?.siteId]);

  const restoreMutation = useMutation({
    mutationFn: async ({ requestId }: { requestId: string }) => {
      console.log('🔄 Restoring request:', requestId);
      await restoreRequest(requestId, user?.userId || 'unknown');
    },
    onSuccess: () => {
      console.log('✅ Request restored successfully');
    },
    onError: (error) => {
      console.error('❌ Error restoring request:', error);
      Alert.alert('Error', 'Failed to restore request. Please try again.');
    },
  });

  const organizeMutation = useMutation({
    mutationFn: async () => {
      if (!user?.siteId) throw new Error('No siteId');
      console.log('📦 Organizing archive...');
      return await archiveRequestsByMonth(user.siteId, 'SCOPE_REQUEST', user?.userId || 'unknown');
    },
    onSuccess: (result) => {
      console.log('✅ Archive organized:', result);
      Alert.alert(
        'Archive Organized',
        `Successfully organized ${result.archived} requests into ${result.byMonth.length} monthly archives.`,
        [{ text: 'OK' }]
      );
    },
    onError: (error) => {
      console.error('❌ Error organizing archive:', error);
      Alert.alert('Error', 'Failed to organize archive. Please try again.');
    },
  });

  const updateRequestMutation = useMutation({
    mutationFn: async ({ 
      requestId, 
      status, 
      scope,
      unit,
      applyToAllActivities,
    }: { 
      requestId: string; 
      status: RequestStatus;
      scope?: number;
      unit?: Unit;
      applyToAllActivities?: boolean;
    }) => {
      console.log('🔄 [Optimistic] Updating activity request:', requestId, 'to status:', status);
      const requestRef = doc(db, 'requests', requestId);
      const requestDoc = await getDoc(requestRef);
      if (!requestDoc.exists()) throw new Error('Request not found');
      const requestData = requestDoc.data();

      if (status === 'APPROVED' && scope && unit) {
        await approveScopeRequestUtil(requestId, scope, unit, user?.userId || 'unknown');
        console.log('✅ Scope approved via helper with unit:', unit);

        if (applyToAllActivities && requestData.taskId) {
          console.log('🔄 Applying default scope to ALL activities in task:', requestData.taskId);
          const activitiesRef = collection(db, 'activities');
          const q = query(
            activitiesRef,
            where('taskId', '==', requestData.taskId)
          );
          const activitiesSnap = await getDocs(q);
          
          const batchUpdates: Promise<void>[] = [];
          activitiesSnap.forEach((actDoc) => {
            const actData = actDoc.data();
            console.log('  📝 Overriding scope for activity:', actDoc.id, '(previous:', actData.scopeValue, ')');
            
            const updatePayload: any = {
              scope: { value: scope, unit, setBy: user?.userId || 'unknown', setAt: Timestamp.now() },
              scopeValue: scope,
              scopeApproved: true,
              status: 'OPEN',
              scopeRequested: false,
              updatedAt: Timestamp.now(),
            };

            updatePayload.unit = {
              canonical: unit,
              setBy: user?.userId || 'unknown',
              setAt: Timestamp.now(),
            };

            batchUpdates.push(updateDoc(doc(db, 'activities', actDoc.id), updatePayload));
          });
          
          await Promise.all(batchUpdates);
          console.log('✅ Applied default scope to ALL', batchUpdates.length, 'activities (overriding previous values)');
        }
      } else if (status === 'REJECTED') {
        // Minimal reject flow: keep backwards-compatible fields
        if (requestData.activityId && requestData.taskId) {
          const activitiesRef = collection(db, 'activities');
          const q = query(
            activitiesRef,
            where('taskId', '==', requestData.taskId),
            where('activityId', '==', requestData.activityId)
          );
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            const activityDocId = snapshot.docs[0].id;
            await queueFirestoreOperation(
              { type: 'update', collection: 'activities', docId: activityDocId, data: {
                scopeRequested: false,
                status: 'LOCKED',
                updatedAt: Timestamp.now(),
              }},
              { priority: 'P0', entityType: 'activityRequest' }
            );
          }
        }
        await queueFirestoreOperation(
          { type: 'update', collection: 'requests', docId: requestId, data: {
            status: 'REJECTED',
            updatedAt: Timestamp.now(),
            updatedBy: user?.userId || 'unknown',
            archived: true,
            archivedAt: Timestamp.now(),
          }},
          { priority: 'P0', entityType: 'activityRequest' }
        );
      }
    },
    onSuccess: (_, variables) => {
      setScopeInputs({});
      console.log('✅ [Optimistic] Activity request mutation completed');
      setOptimisticallyHiddenCards((prev) => {
        const next = new Set(prev);
        next.delete(variables.requestId);
        return next;
      });
    },
    onError: (error, variables) => {
      console.error('❌ [Optimistic] Activity request mutation error:', error);
      setOptimisticallyHiddenCards((prev) => {
        const next = new Set(prev);
        next.delete(variables.requestId);
        return next;
      });
      Alert.alert('Error', 'Failed to update request. Please try again.');
    },
  });

  const handleApproveInternal = (request: ActivityRequest) => {
    const scopeValue = scopeInputs[request.id];
    const unit = scopeUnits[request.id] ?? 'm';
    const applyToAll = applyDefaultToAll[request.id] || false;

    if (!scopeValue || isNaN(Number(scopeValue)) || Number(scopeValue) <= 0) {
      Alert.alert('Scope Required', 'Please enter a valid scope value before approving');
      return;
    }

    console.log('[Optimistic] Approving activity request:', request.id, 'with scope:', scopeValue, unit, 'applyToAll:', applyToAll);
    
    setOptimisticallyHiddenCards((prev) => new Set(prev).add(request.id));
    
    updateRequestMutation.mutate({ 
      requestId: request.id, 
      status: 'APPROVED',
      scope: Number(scopeValue),
      unit,
      applyToAllActivities: applyToAll,
    });
  };

  const handleRejectInternal = (requestId: string) => {
    console.log('[Optimistic] Rejecting activity request:', requestId);
    
    setOptimisticallyHiddenCards((prev) => new Set(prev).add(requestId));
    
    updateRequestMutation.mutate({ requestId, status: 'REJECTED' });
  };

  const incomingRequests = requests.filter(r => !r.archived && !optimisticallyHiddenCards.has(r.id));
  const archivedRequests = requests.filter(r => r.archived);
  const groupedArchives = groupRequestsByMonth(archivedRequests);
  const sortedMonthKeys = Object.keys(groupedArchives).sort((a, b) => {
    const [yearA, monthA] = a.split('-').map(Number);
    const [yearB, monthB] = b.split('-').map(Number);
    if (yearA !== yearB) return yearB - yearA;
    return monthB - monthA;
  });
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

  const renderRequest = (request: ActivityRequest, isPending: boolean) => {
    const StatusIcon = getStatusIcon(request.status);
    const statusColor = getStatusColor(request.status);
    const isExpanded = expandedRequests[request.id] || false;
    console.log('🔍 Rendering request:', request.id, 'isPending:', isPending, 'status:', request.status, 'isExpanded:', isExpanded);

    const runApproveAction = () => {
      const execute = protectAction(
        `approve-${request.id}`,
        () => handleApproveInternal(request)
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
            console.log('🔄 Toggle expand for request:', request.id, 'current:', isExpanded, 'new:', !isExpanded);
            setExpandedRequests(prev => ({ ...prev, [request.id]: !isExpanded }));
          }}
          activeOpacity={0.7}
        >
          <View style={styles.requestHeader}>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
              <StatusIcon size={16} color={statusColor} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {request.status}
              </Text>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.requestTime}>
                {formatTimestamp(request.requestedAt)}
              </Text>
              {isPending && (
                isExpanded ? <ChevronUp size={20} color="#64748b" /> : <ChevronDown size={20} color="#64748b" />
              )}
            </View>
          </View>

          <Text style={styles.requestTitle}>{request.mainMenuName || 'Scope Request'}</Text>
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

          <View style={styles.requestMeta}>
            <Text style={styles.metaLabel}>Supervisor:</Text>
            <Text style={styles.metaValue}>{request.supervisorName || request.requestedBy}</Text>
          </View>

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
        </TouchableOpacity>

        {request.scope && (
          <View style={styles.scopeDisplay}>
            <Text style={styles.scopeLabel}>Approved Scope:</Text>
            <Text style={styles.scopeValue}>{request.scope}</Text>
          </View>
        )}

        {isExpanded && isPending && (
          <>
            <View style={styles.scopeInputSection}>
              <View style={styles.scopeInstructions}>
                <Text style={styles.instructionsText}>
                  Set the scope value for this activity. The supervisor will need to match this metric in their progress tracking.
                </Text>
              </View>

              <View style={styles.scopeInputContainer}>
                <Text style={styles.inputLabel}>Scope Value *</Text>
                <TextInput
                  style={styles.scopeInput}
                  value={scopeInputs[request.id] || ''}
                  onChangeText={(text) => setScopeInputs(prev => ({ ...prev, [request.id]: text }))}
                  placeholder="Enter scope (e.g., 100)"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.unitSelectorRow}>
                <Text style={styles.inputLabel}>Unit / Metric *</Text>
                <TouchableOpacity
                  style={styles.unitSelectButton}
                  onPress={() => {
                    setSelectedRequestId(request.id);
                    setUnitModalVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.unitSelectButtonText}>{scopeUnits[request.id] ?? 'm'}</Text>
                  <ChevronRight size={16} color="#4285F4" />
                </TouchableOpacity>
              </View>

              <View style={styles.defaultToggleRow}>
                <View style={styles.defaultToggleTextContainer}>
                  <Text style={styles.defaultToggleLabel}>Apply as Default to All Activities</Text>
                  <Text style={styles.defaultToggleHint}>
                    Sets this scope value for all pending activities in this task and removes their &ldquo;scope pending&rdquo; messages
                  </Text>
                </View>
                <Switch
                  value={applyDefaultToAll[request.id] || false}
                  onValueChange={(val) => setApplyDefaultToAll((prev) => ({ ...prev, [request.id]: val }))}
                  trackColor={{ false: '#e2e8f0', true: '#ea580c' }}
                  thumbColor="#fff"
                  ios_backgroundColor="#e2e8f0"
                />
              </View>
            </View>

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
          </>
        )}
        
        <TimestampFooter
          createdAt={request.createdAt || request.requestedAt}
          createdBy={request.supervisorName || request.requestedBy}
          updatedAt={request.approvedAt || request.updatedAt}
          updatedBy={request.approvedBy || request.updatedBy}
          actionLabel={request.status === 'APPROVED' ? 'Approved' : request.status === 'REJECTED' ? 'Rejected' : 'Updated'}
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
          title: 'Scope Requests',
          headerStyle: {
            backgroundColor: '#ea580c',
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
          <ListTodo size={32} color="#ea580c" />
          <Text style={styles.headerTitle}>Activity Scope Requests</Text>
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
            <ListTodo size={20} color={activeTab === 'incoming' ? '#ea580c' : '#64748b'} />
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
            <Archive size={20} color={activeTab === 'archived' ? '#ea580c' : '#64748b'} />
            <Text style={[styles.tabText, activeTab === 'archived' && styles.activeTabText]}>
              Archived
            </Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ea580c" />
            <Text style={styles.loadingText}>Loading requests...</Text>
          </View>
        ) : (
          <View style={styles.section}>
            {activeTab === 'incoming' ? (
              incomingRequests.length > 0 ? (
                incomingRequests.map(request => renderRequest(request, request.status === 'PENDING' || (request as any).status === 'pending'))
              ) : (
                <View style={styles.emptyContainer}>
                  <ListTodo size={48} color="#cbd5e1" />
                  <Text style={styles.emptyText}>No incoming requests</Text>
                </View>
              )
            ) : (
              <>
                {archivedRequests.length > 0 && (
                  <View style={styles.archiveActionsBar}>
                    <TouchableOpacity
                      style={styles.organizeButton}
                      onPress={() => {
                        Alert.alert(
                          'Organize Archive',
                          'This will organize archived requests by month and year. Current month requests will remain unorganized.',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Organize',
                              onPress: () => organizeMutation.mutate(),
                            },
                          ]
                        );
                      }}
                      disabled={organizeMutation.isPending}
                    >
                      <FolderArchive size={18} color="#ea580c" />
                      <Text style={styles.organizeButtonText}>
                        {organizeMutation.isPending ? 'Organizing...' : 'Organize by Month'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
                {sortedMonthKeys.length > 0 ? (
                  sortedMonthKeys.map(monthKey => {
                    const archive = groupedArchives[monthKey];
                    const isExpanded = expandedMonths[monthKey] || false;
                    const monthLabel = getMonthLabel(archive.month, archive.year);
                    
                    return (
                      <View key={monthKey} style={styles.monthSection}>
                        <TouchableOpacity
                          style={styles.monthHeader}
                          onPress={() => setExpandedMonths(prev => ({ ...prev, [monthKey]: !isExpanded }))}
                          activeOpacity={0.7}
                        >
                          <View style={styles.monthHeaderLeft}>
                            <CalendarIcon size={20} color="#ea580c" />
                            <Text style={styles.monthTitle}>{monthLabel}</Text>
                            <View style={styles.monthBadge}>
                              <Text style={styles.monthBadgeText}>{archive.requests.length}</Text>
                            </View>
                          </View>
                          {isExpanded ? (
                            <ChevronUp size={20} color="#64748b" />
                          ) : (
                            <ChevronDown size={20} color="#64748b" />
                          )}
                        </TouchableOpacity>
                        {isExpanded && archive.requests.map(request => {
                          const handleRestore = () => {
                            const execute = protectAction(
                              `restore-${request.id}`,
                              () => restoreMutation.mutate({ requestId: request.id })
                            );
                            void execute();
                          };
                          
                          return (
                            <View key={request.id} style={styles.requestCard}>
                              <TouchableOpacity
                                onPress={() => {
                                  setExpandedRequests(prev => ({ ...prev, [request.id]: !expandedRequests[request.id] }));
                                }}
                                activeOpacity={0.7}
                              >
                                <View style={styles.requestHeader}>
                                  <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(request.status)}20` }]}>
                                    {(() => {
                                      const StatusIcon = getStatusIcon(request.status);
                                      return <StatusIcon size={16} color={getStatusColor(request.status)} />;
                                    })()}
                                    <Text style={[styles.statusText, { color: getStatusColor(request.status) }]}>
                                      {request.status}
                                    </Text>
                                  </View>
                                  <TouchableOpacity
                                    style={styles.restoreButton}
                                    onPress={handleRestore}
                                    activeOpacity={0.7}
                                  >
                                    <Text style={styles.restoreButtonText}>Restore</Text>
                                  </TouchableOpacity>
                                </View>

                                <Text style={styles.requestTitle}>{request.mainMenuName || 'Scope Request'}</Text>
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
                              </TouchableOpacity>

                              <TimestampFooter
                                createdAt={request.createdAt || request.requestedAt}
                                createdBy={request.supervisorName || request.requestedBy}
                                updatedAt={request.approvedAt || request.updatedAt}
                                updatedBy={request.approvedBy || request.updatedBy}
                                actionLabel={request.status === 'APPROVED' ? 'Approved' : request.status === 'REJECTED' ? 'Rejected' : 'Updated'}
                              />
                            </View>
                          );
                        })}
                      </View>
                    );
                  })
                ) : archivedRequests.length > 0 ? (
                  archivedRequests.map(request => {
                    const handleRestore = () => {
                      const execute = protectAction(
                        `restore-${request.id}`,
                        () => restoreMutation.mutate({ requestId: request.id })
                      );
                      void execute();
                    };
                    
                    return (
                      <View key={request.id} style={styles.requestCard}>
                        <TouchableOpacity
                          onPress={() => {
                            setExpandedRequests(prev => ({ ...prev, [request.id]: !expandedRequests[request.id] }));
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={styles.requestHeader}>
                            <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(request.status)}20` }]}>
                              {(() => {
                                const StatusIcon = getStatusIcon(request.status);
                                return <StatusIcon size={16} color={getStatusColor(request.status)} />;
                              })()}
                              <Text style={[styles.statusText, { color: getStatusColor(request.status) }]}>
                                {request.status}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={styles.restoreButton}
                              onPress={handleRestore}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.restoreButtonText}>Restore</Text>
                            </TouchableOpacity>
                          </View>

                          <Text style={styles.requestTitle}>{request.mainMenuName || 'Scope Request'}</Text>
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
                        </TouchableOpacity>

                        <TimestampFooter
                          createdAt={request.createdAt || request.requestedAt}
                          createdBy={request.supervisorName || request.requestedBy}
                          updatedAt={request.approvedAt || request.updatedAt}
                          updatedBy={request.approvedBy || request.updatedBy}
                          actionLabel={request.status === 'APPROVED' ? 'Approved' : request.status === 'REJECTED' ? 'Rejected' : 'Updated'}
                        />
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
      
      <UnitSelectorModal
        visible={unitModalVisible}
        onClose={() => {
          setUnitModalVisible(false);
          setSelectedRequestId(null);
        }}
        onSelect={(unit: Unit) => {
          if (selectedRequestId) {
            setScopeUnits((prev) => ({ ...prev, [selectedRequestId]: unit }));
          }
          setUnitModalVisible(false);
          setSelectedRequestId(null);
        }}
        currentUnit={(selectedRequestId ? scopeUnits[selectedRequestId] : undefined) ?? 'm'}
        title="Select Unit / Metric"
      />
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  scopeInputSection: {
    marginTop: 12,
  },
  scopeInstructions: {
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#0284c7',
  },
  instructionsText: {
    fontSize: 12,
    color: '#0c4a6e',
    lineHeight: 16,
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
  locationInfoRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
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
    backgroundColor: '#ffedd5',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#64748b',
  },
  activeTabText: {
    color: '#ea580c',
    fontWeight: '600' as const,
  },
  unitSelectorRow: {
    marginBottom: 12,
  },
  unitSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#e3f2fd',
    borderWidth: 1,
    borderColor: '#4285F4',
  },
  unitSelectButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#4285F4',
  },
  badge: {
    backgroundColor: '#ea580c',
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
  defaultToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#fff5f1',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fed7aa',
    marginTop: 12,
  },
  defaultToggleTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  defaultToggleLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1e293b',
    marginBottom: 4,
  },
  defaultToggleHint: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 16,
  },
  taskDetailsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  taskDetailItem: {
    flex: 1,
    backgroundColor: '#fff5f1',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#ea580c',
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
  archiveActionsBar: {
    marginHorizontal: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  organizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffedd5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  organizeButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#ea580c',
  },
  monthSection: {
    marginBottom: 12,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  monthHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  monthTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  monthBadge: {
    backgroundColor: '#ea580c',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  monthBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#fff',
  },
  restoreButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#d1fae5',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  restoreButtonText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#059669',
  },
});
