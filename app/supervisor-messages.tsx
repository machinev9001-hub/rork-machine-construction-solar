import { Stack, useRouter } from 'expo-router';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  FileText,
  TrendingUp,
  ChevronRight,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import React, { useState } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import BottomTabBar from '@/components/BottomTabBar';
import { AppTheme } from '@/constants/colors';
import { useTheme } from '@/utils/hooks/useTheme';

type Request = {
  id: string;
  type: string;
  status: string;
  fromUserId: string;
  toUserId: string;
  requestId: string;
  note?: string;
  read: boolean;
  createdAt: any;
  siteId: string;
  taskId?: string;
  activityId?: string;
  fromUserName?: string;
  pvArea?: string;
  blockNumber?: string;
  activityName?: string;
};

const getRequestIcon = (type: string) => {
  switch (type) {
    case 'handover_request':
      return User;
    case 'task_request':
      return FileText;
    case 'qc_request':
      return CheckCircle2;
    case 'scope_request':
      return TrendingUp;
    default:
      return Bell;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'approved':
      return '#10b981';
    case 'rejected':
      return '#ef4444';
    case 'pending':
      return '#f59e0b';
    case 'responded':
      return '#3b82f6';
    default:
      return '#6b7280';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'approved':
      return CheckCircle2;
    case 'rejected':
      return AlertCircle;
    case 'pending':
      return Clock;
    default:
      return Bell;
  }
};

export default function SupervisorNotificationsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { theme, commonStyles } = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const requestsQuery = useQuery({
    queryKey: ['supervisor-notifications', user?.userId, user?.siteId],
    queryFn: async () => {
      if (!user?.userId || !user?.siteId) return [];

      console.log('📬 [Notifications] Fetching requests for:', user.userId);

      const requestsRef = collection(db, 'requests');
      const requestsQueryRef = query(
        requestsRef,
        where('toUserId', '==', user.userId),
        where('siteId', '==', user.siteId),
        where('archived', '==', false),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(requestsQueryRef);
      const requests: Request[] = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        
        let fromUserName = data.fromUserId;
        try {
          const usersRef = collection(db, 'users');
          const userQuery = query(
            usersRef,
            where('userId', '==', data.fromUserId),
            where('siteId', '==', user.siteId)
          );
          const userSnapshot = await getDocs(userQuery);
          if (!userSnapshot.empty) {
            fromUserName = userSnapshot.docs[0].data().name || data.fromUserId;
          }
        } catch (error) {
          console.error('Error fetching user name:', error);
        }

        requests.push({
          id: docSnap.id,
          type: data.type,
          status: data.status,
          fromUserId: data.fromUserId,
          toUserId: data.toUserId,
          requestId: data.requestId,
          note: data.note,
          read: data.read,
          createdAt: data.createdAt,
          siteId: data.siteId,
          taskId: data.taskId,
          activityId: data.activityId,
          fromUserName,
          pvArea: data.pvArea,
          blockNumber: data.blockNumber,
          activityName: data.activityName,
        });
      }

      console.log('📬 [Notifications] Loaded', requests.length, 'requests');
      return requests;
    },
    enabled: !!user?.userId && !!user?.siteId,
    refetchInterval: 30000,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const requestRef = doc(db, 'requests', requestId);
      await updateDoc(requestRef, {
        read: true,
        readAt: Timestamp.now(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supervisor-notifications'] });
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await requestsQuery.refetch();
    setRefreshing(false);
  };

  const handleRequestPress = async (request: Request) => {
    if (!request.read) {
      markAsReadMutation.mutate(request.id);
    }

    if (request.type === 'handover_request' && request.taskId) {
      router.push({
        pathname: '/supervisor-task-detail',
        params: {
          taskId: request.taskId,
          activityId: request.activityId,
          subMenuId: request.requestId,
        },
      });
    }
  };

  const formatTimestamp = (timestamp: any): string => {
    if (!timestamp) return 'N/A';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch {
      return 'N/A';
    }
  };

  const getRequestTitle = (request: Request): string => {
    switch (request.type) {
      case 'handover_request':
        return 'Handover Request';
      case 'task_request':
        return 'Task Request';
      case 'qc_request':
        return 'QC Request';
      case 'scope_request':
        return 'Scope Request';
      default:
        return 'Notification';
    }
  };

  const getRequestDescription = (request: Request): string => {
    const from = request.fromUserName || request.fromUserId;
    
    switch (request.type) {
      case 'handover_request':
        if (request.pvArea && request.blockNumber) {
          return `${from} wants to hand over PV ${request.pvArea} Block ${request.blockNumber}`;
        }
        return `${from} sent you a handover request`;
      case 'task_request':
        return `${from} sent you a task request`;
      case 'qc_request':
        return `${from} sent you a QC request`;
      case 'scope_request':
        return `${from} sent you a scope request`;
      default:
        return request.note || 'New notification';
    }
  };

  const unreadCount = (requestsQuery.data || []).filter((r) => !r.read).length;

  return (
    <View style={[commonStyles.container, styles.container]}>
      <Stack.Screen
        options={{
          title: 'Notifications',
          headerRight: () => (
            <View style={styles.headerRight}>
              <Text style={commonStyles.headerText}>{user?.name || 'User'}</Text>
              <Text style={commonStyles.headerSubtext}>{user?.companyName || 'Company'}</Text>
              {unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
                </View>
              )}
            </View>
          ),
          headerStyle: {
            backgroundColor: theme.headerBg,
          },
          headerTintColor: theme.text,
          headerTitleStyle: {
            fontWeight: '600' as const,
            fontSize: 20,
          },
        }}
      />
      <View style={commonStyles.headerBorder} />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.accent]} />
        }
      >
        <View style={[styles.headerSection, { backgroundColor: theme.background }]}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Notifications & Requests</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            {unreadCount > 0
              ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
              : 'All caught up!'}
          </Text>
        </View>

        {requestsQuery.isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.accent} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading notifications...</Text>
          </View>
        ) : requestsQuery.error ? (
          <View style={styles.errorContainer}>
            <AlertCircle size={48} color="#ef4444" />
            <Text style={[styles.errorText, { color: theme.text }]}>Failed to load notifications</Text>
            <TouchableOpacity style={[styles.retryButton, { backgroundColor: theme.accent }]} onPress={() => requestsQuery.refetch()}>
              <Text style={[styles.retryButtonText, { color: theme.background }]}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (requestsQuery.data || []).length === 0 ? (
          <View style={styles.emptyContainer}>
            <Bell size={64} color={theme.border} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No Notifications</Text>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              You&apos;ll see handover requests, task notifications, and other alerts here
            </Text>
          </View>
        ) : (
          <View style={styles.requestsSection}>
            {(requestsQuery.data || []).map((request) => {
              const IconComponent = getRequestIcon(request.type);
              const StatusIcon = getStatusIcon(request.status);
              const statusColor = getStatusColor(request.status);

              return (
                <TouchableOpacity
                  key={request.id}
                  style={[styles.requestCard, { backgroundColor: theme.surface, borderColor: theme.border }, !request.read && styles.requestCardUnread]}
                  activeOpacity={0.7}
                  onPress={() => handleRequestPress(request)}
                >
                  <View style={styles.requestIconContainer}>
                    <View style={[styles.requestIcon, { backgroundColor: statusColor + '20' }]}>
                      <IconComponent size={24} color={statusColor} strokeWidth={2} />
                    </View>
                    {!request.read && <View style={styles.unreadDot} />}
                  </View>

                  <View style={styles.requestContent}>
                    <View style={styles.requestHeader}>
                      <Text style={[styles.requestTitle, { color: theme.text }]}>{getRequestTitle(request)}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: theme.background }]}>
                        <StatusIcon size={12} color={statusColor} strokeWidth={2.5} />
                        <Text style={[styles.statusText, { color: statusColor }]}>
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.requestDescription, { color: theme.textSecondary }]} numberOfLines={2}>
                      {getRequestDescription(request)}
                    </Text>

                    {request.note && (
                      <View style={[styles.noteContainer, { backgroundColor: theme.background }]}>
                        <Text style={[styles.noteLabel, { color: theme.textSecondary }]}>Note:</Text>
                        <Text style={[styles.noteText, { color: theme.text }]} numberOfLines={2}>
                          {request.note}
                        </Text>
                      </View>
                    )}

                    <View style={styles.requestFooter}>
                      <Clock size={12} color="#9aa0a6" />
                      <Text style={styles.timestamp}>{formatTimestamp(request.createdAt)}</Text>
                      <ChevronRight size={16} color="#9aa0a6" style={styles.chevron} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
      <BottomTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  headerRight: {
    marginRight: 16,
    alignItems: 'flex-end',
  },
  unreadBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  unreadBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#ffffff',
  },
  headerSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      },
    }),
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  requestsSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
  requestCard: {
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      },
    }),
  },
  requestCardUnread: {
    borderLeftWidth: 4,
    borderLeftColor: AppTheme.accent,
  },
  requestIconContainer: {
    position: 'relative',
  },
  requestIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  requestContent: {
    flex: 1,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  requestTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
  requestDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  noteContainer: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  noteLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  noteText: {
    fontSize: 13,
    lineHeight: 18,
  },
  requestFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timestamp: {
    fontSize: 12,
    color: '#9aa0a6',
    fontWeight: '500' as const,
  },
  chevron: {
    marginLeft: 'auto',
  },
  loadingContainer: {
    paddingVertical: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    marginTop: 12,
  },
  errorContainer: {
    paddingVertical: 80,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginTop: 16,
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  emptyContainer: {
    paddingVertical: 80,
    paddingHorizontal: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  bottomSpacer: {
    height: 32,
  },
});
