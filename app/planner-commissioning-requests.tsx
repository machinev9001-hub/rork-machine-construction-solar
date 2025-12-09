import { Stack } from 'expo-router';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { Power } from 'lucide-react-native';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { HandoverRequest } from '../types';

export default function PlannerCommissioningRequestsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [requests, setRequests] = useState<HandoverRequest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(() => new Set<string>());
  const [activeTab, setActiveTab] = useState<'incoming' | 'approved' | 'archived'>('incoming');

  useEffect(() => {
    if (!user?.siteId) {
      setIsLoading(false);
      setRequests([]);
      return;
    }

    setIsLoading(true);

    const handoverRequestsRef = collection(db, 'handoverRequests');
    const requestsQuery = query(
      handoverRequestsRef,
      where('siteId', '==', user.siteId),
      where('requestType', '==', 'COMMISSIONING_REQUEST'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      requestsQuery,
      async (snapshot) => {
        const loadedRequests: HandoverRequest[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<HandoverRequest, 'id'>),
        }));

        setRequests(loadedRequests);
        setIsLoading(false);
      },
      (error) => {
        console.error('❌ [PlannerCommissioningRequests] Error loading requests:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.siteId]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 900);
  }, []);

  const handleApprove = useCallback(
    async (requestId: string) => {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.add(requestId);
        return next;
      });

      try {
        console.log('✅ [PlannerCommissioningRequests] Approving request:', requestId);

        const handoverRequestsRef = collection(db, 'handoverRequests');
        await updateDoc(doc(handoverRequestsRef, requestId), {
          status: 'APPROVED',
          noteFromPlanner: 'Approved for commissioning',
          updatedAt: serverTimestamp(),
        });

        console.log('✅ [PlannerCommissioningRequests] Request approved successfully');
      } catch (error) {
        console.error('❌ [PlannerCommissioningRequests] Error approving request:', error);
      } finally {
        setProcessingIds((prev) => {
          const next = new Set(prev);
          next.delete(requestId);
          return next;
        });
      }
    },
    []
  );

  const handleDecline = useCallback(async (requestId: string) => {
    setProcessingIds((prev) => {
      const next = new Set(prev);
      next.add(requestId);
      return next;
    });

    try {
      console.log('❌ [PlannerCommissioningRequests] Declining request:', requestId);

      const handoverRequestsRef = collection(db, 'handoverRequests');
      await updateDoc(doc(handoverRequestsRef, requestId), {
        status: 'REJECTED',
        noteFromPlanner: 'Declined by planner',
        updatedAt: serverTimestamp(),
      });

      console.log('❌ [PlannerCommissioningRequests] Request declined successfully');
    } catch (error) {
      console.error('❌ [PlannerCommissioningRequests] Error declining request:', error);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  }, []);

  const pendingRequests = useMemo(
    () =>
      requests.filter((requestItem) => {
        const normalizedStatus = (requestItem.status ?? '').toString().toUpperCase();
        return normalizedStatus === 'PENDING';
      }),
    [requests]
  );

  const approvedRequests = useMemo(
    () =>
      requests.filter((requestItem) => {
        const normalizedStatus = (requestItem.status ?? '').toString().toUpperCase();
        return normalizedStatus === 'APPROVED';
      }),
    [requests]
  );

  const archivedRequests = useMemo(
    () =>
      requests.filter((requestItem) => {
        const normalizedStatus = (requestItem.status ?? '').toString().toUpperCase();
        return (
          normalizedStatus === 'REJECTED' ||
          normalizedStatus === 'CANCELLED' ||
          normalizedStatus === 'RESOLVED_BY_PLANNER'
        );
      }),
    [requests]
  );

  const pendingCount = pendingRequests.length;
  const approvedCount = approvedRequests.length;
  const archivedCount = archivedRequests.length;

  const selectedRequests = useMemo(() => {
    if (activeTab === 'incoming') {
      return pendingRequests;
    }

    if (activeTab === 'approved') {
      return approvedRequests;
    }

    return archivedRequests;
  }, [activeTab, pendingRequests, approvedRequests, archivedRequests]);

  const listHeaderComponent = useMemo(
    () => (
      <View style={styles.listHeader} testID="commissioning-requests-header">
        <View style={styles.summaryCard}>
          <View style={styles.summaryTopRow}>
            <View style={styles.summaryIcon}>
              <Power size={22} color="#10b981" />
            </View>
            <View style={styles.summaryText}>
              <Text style={styles.summaryTitle}>Commissioning Requests</Text>
              <Text style={styles.summarySubtitle}>
                Approve or decline requests for commissioning work on completed installations.
              </Text>
            </View>
          </View>
          <View style={styles.summaryCounts}>
            <View style={[styles.countCard, styles.countCardFirst]}>
              <Text style={styles.countValue}>{pendingCount}</Text>
              <Text style={styles.countLabel}>Pending</Text>
            </View>
            <View style={[styles.countCard, styles.countCardMiddle]}>
              <Text style={styles.countValue}>{approvedCount}</Text>
              <Text style={styles.countLabel}>Approved</Text>
            </View>
            <View style={styles.countCard}>
              <Text style={styles.countValue}>{archivedCount}</Text>
              <Text style={styles.countLabel}>Archived</Text>
            </View>
          </View>
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity
            testID="commissioning-tab-incoming"
            style={[styles.tabButton, activeTab === 'incoming' && styles.tabButtonActive]}
            activeOpacity={0.7}
            onPress={() => setActiveTab('incoming')}
          >
            <Text style={[styles.tabLabel, activeTab === 'incoming' && styles.tabLabelActive]}>Incoming</Text>
            <View
              style={[
                styles.tabBadge,
                activeTab === 'incoming' ? styles.tabBadgeActive : styles.tabBadgeInactive,
              ]}
            >
              <Text
                style={[
                  styles.tabBadgeText,
                  activeTab === 'incoming' ? styles.tabBadgeTextActive : styles.tabBadgeTextInactive,
                ]}
              >
                {pendingCount}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            testID="commissioning-tab-approved"
            style={[styles.tabButton, activeTab === 'approved' && styles.tabButtonActive]}
            activeOpacity={0.7}
            onPress={() => setActiveTab('approved')}
          >
            <Text style={[styles.tabLabel, activeTab === 'approved' && styles.tabLabelActive]}>Approved</Text>
            <View
              style={[
                styles.tabBadge,
                activeTab === 'approved' ? styles.tabBadgeActive : styles.tabBadgeInactive,
              ]}
            >
              <Text
                style={[
                  styles.tabBadgeText,
                  activeTab === 'approved'
                    ? styles.tabBadgeTextActive
                    : styles.tabBadgeTextInactive,
                ]}
              >
                {approvedCount}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            testID="commissioning-tab-archived"
            style={[styles.tabButton, activeTab === 'archived' && styles.tabButtonActive]}
            activeOpacity={0.7}
            onPress={() => setActiveTab('archived')}
          >
            <Text style={[styles.tabLabel, activeTab === 'archived' && styles.tabLabelActive]}>Archived</Text>
            <View
              style={[
                styles.tabBadge,
                activeTab === 'archived' ? styles.tabBadgeActive : styles.tabBadgeInactive,
              ]}
            >
              <Text
                style={[
                  styles.tabBadgeText,
                  activeTab === 'archived' ? styles.tabBadgeTextActive : styles.tabBadgeTextInactive,
                ]}
              >
                {archivedCount}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    ),
    [activeTab, pendingCount, approvedCount, archivedCount]
  );

  const emptyStateComponent = useMemo(() => {
    const title =
      activeTab === 'incoming'
        ? 'No incoming commissioning requests'
        : activeTab === 'approved'
        ? 'No approved commissioning requests'
        : 'No archived commissioning requests';

    const description =
      activeTab === 'incoming'
        ? 'Supervisors will send requests when termination work is complete and ready for commissioning.'
        : activeTab === 'approved'
        ? 'Approved requests will appear here for tracking.'
        : 'Declined or resolved commissioning requests will surface here for reference.';

    return (
      <View style={styles.emptyState} testID="commissioning-empty-state">
        <Power size={56} color="#cbd5e1" />
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptyText}>{description}</Text>
      </View>
    );
  }, [activeTab]);

  const renderRequestItem = useCallback(
    ({ item }: { item: HandoverRequest }) => {
      const normalizedStatus = (item.status ?? '').toString().toUpperCase();
      const requestId = item.id || '';
      const isProcessing = processingIds.has(requestId);

      return (
        <View style={styles.requestCard}>
          <View style={styles.requestHeader}>
            <Text style={styles.requestTitle}>{item.activityName || 'Commissioning Request'}</Text>
            <View style={[styles.statusBadge, { backgroundColor: normalizedStatus === 'PENDING' ? '#fef3c7' : normalizedStatus === 'APPROVED' ? '#d1fae5' : '#fee2e2' }]}>
              <Text style={[styles.statusText, { color: normalizedStatus === 'PENDING' ? '#b45309' : normalizedStatus === 'APPROVED' ? '#065f46' : '#991b1b' }]}>
                {normalizedStatus}
              </Text>
            </View>
          </View>

          <View style={styles.requestInfo}>
            <Text style={styles.infoLabel}>PV Area: <Text style={styles.infoValue}>{item.pvArea}</Text></Text>
            <Text style={styles.infoLabel}>Block: <Text style={styles.infoValue}>{item.blockNumber}</Text></Text>
            {item.rowNr && (
              <Text style={styles.infoLabel}>Row nr: <Text style={styles.infoValue}>{item.rowNr}</Text></Text>
            )}
            {item.columnNr && (
              <Text style={styles.infoLabel}>Column nr: <Text style={styles.infoValue}>{item.columnNr}</Text></Text>
            )}
            {item.subMenuKey && (
              <Text style={styles.infoLabel}>Sub Menu: <Text style={styles.infoValue}>{item.subMenuKey}</Text></Text>
            )}
          </View>

          {item.noteFromSender && (
            <View style={styles.noteSection}>
              <Text style={styles.noteLabel}>Note:</Text>
              <Text style={styles.noteText}>{item.noteFromSender}</Text>
            </View>
          )}

          {normalizedStatus === 'PENDING' && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.approveButton]}
                onPress={() => handleApprove(requestId)}
                disabled={isProcessing}
                activeOpacity={0.7}
              >
                <Text style={styles.approveButtonText}>{isProcessing ? 'Processing...' : 'Approve'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.declineButton]}
                onPress={() => handleDecline(requestId)}
                disabled={isProcessing}
                activeOpacity={0.7}
              >
                <Text style={styles.declineButtonText}>{isProcessing ? 'Processing...' : 'Decline'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    },
    [handleApprove, handleDecline, processingIds]
  );

  const keyExtractor = useCallback((item: HandoverRequest) => item.id || '', []);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Commissioning Requests',
            headerStyle: { backgroundColor: '#10b981' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: '600' as const },
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>Loading commissioning requests...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Commissioning Requests',
          headerStyle: { backgroundColor: '#10b981' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '600' as const },
        }}
      />

      <FlatList
        data={selectedRequests}
        keyExtractor={keyExtractor}
        renderItem={renderRequestItem}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        ListHeaderComponent={listHeaderComponent}
        ListEmptyComponent={emptyStateComponent}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: 32 + insets.bottom },
          selectedRequests.length === 0 ? styles.listContentEmpty : null,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f9ff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500' as const,
  },
  listHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 6,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  summaryText: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#0f172a',
    marginBottom: 4,
  },
  summarySubtitle: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  summaryCounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  countCard: {
    flex: 1,
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  countCardFirst: {
    marginRight: 12,
  },
  countCardMiddle: {
    marginRight: 12,
  },
  countValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#0f172a',
  },
  countLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#059669',
    marginTop: 6,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 4,
    marginTop: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  tabButtonActive: {
    backgroundColor: '#10b981',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#64748b',
  },
  tabLabelActive: {
    color: '#ffffff',
  },
  tabBadge: {
    marginLeft: 8,
    minWidth: 28,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 12,
    alignItems: 'center',
  },
  tabBadgeInactive: {
    backgroundColor: '#e2e8f0',
  },
  tabBadgeActive: {
    backgroundColor: '#ffffff',
  },
  tabBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  tabBadgeTextInactive: {
    color: '#475569',
  },
  tabBadgeTextActive: {
    color: '#10b981',
  },
  listContent: {
    paddingTop: 8,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#0f172a',
    marginTop: 18,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  requestCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#0f172a',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
  },
  requestInfo: {
    marginBottom: 12,
    gap: 6,
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500' as const,
  },
  infoValue: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '700' as const,
  },
  noteSection: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  noteLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#475569',
    marginBottom: 4,
  },
  noteText: {
    fontSize: 13,
    color: '#0f172a',
    lineHeight: 18,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: '#10b981',
  },
  approveButtonText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#ffffff',
  },
  declineButton: {
    backgroundColor: '#dc2626',
  },
  declineButtonText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#ffffff',
  },
});
