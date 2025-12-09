import { Stack, useRouter } from 'expo-router';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { CheckCircle, XCircle, Calendar, ChevronDown, ChevronUp, Archive } from 'lucide-react-native';
import TimestampFooter from '@/components/TimestampFooter';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useState, useEffect } from 'react';

type QCRequest = {
  id: string;
  type: string;
  status: 'pending' | 'scheduled' | 'completed' | 'rejected';
  requestedBy: string;
  requestedByName?: string;
  supervisorId?: string;
  taskId?: string;
  activityId?: string;
  activityName?: string;
  subMenuName?: string;
  mainMenuName?: string;
  siteId?: string;
  note?: string;
  scheduledAt?: any;
  qcValue?: number;
  qcUnit?: string;
  qcCompletedAt?: any;
  qcCompletedBy?: string;
  createdAt: any;
  updatedAt: any;
};

export default function QCCompletedScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<QCRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  
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
      console.log('❌ QC COMPLETED - No siteId');
      setIsLoading(false);
      return;
    }

    console.log('🔍 QC COMPLETED - Setting up listener for siteId:', user.siteId);
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
        console.log('📊 QC COMPLETED - Received', snapshot.docs.length, 'documents');
        const results: QCRequest[] = [];
        
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          
          if (data.status !== 'completed' && data.status !== 'rejected') {
            continue;
          }
          
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
        
        setRequests(results);
        setIsLoading(false);
      },
      (err) => {
        console.error('❌ QC COMPLETED - Error:', err);
        setIsLoading(false);
      }
    );

    return () => {
      console.log('🔴 QC COMPLETED - Cleaning up listener');
      unsubscribe();
    };
  }, [user?.siteId]);

  const formatScheduledDate = (timestamp?: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#10b981';
      case 'rejected': return '#ef4444';
      default: return '#64748b';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return CheckCircle;
      case 'rejected': return XCircle;
      default: return Archive;
    }
  };

  const renderRequest = (request: QCRequest) => {
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

            {request.status === 'completed' && request.qcValue !== undefined && (
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
          actionLabel={request.status === 'completed' ? 'Completed' : request.status === 'rejected' ? 'Rejected' : 'Updated'}
        />
      </View>
    );
  };

  const completedCount = requests.filter(r => r.status === 'completed').length;
  const rejectedCount = requests.filter(r => r.status === 'rejected').length;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Completed Inspections',
          headerStyle: {
            backgroundColor: '#10b981',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: '600' as const,
          },
        }}
      />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <CheckCircle size={32} color="#10b981" />
          <Text style={styles.headerTitle}>Inspection History</Text>
          <Text style={styles.headerSubtitle}>
            {completedCount} completed • {rejectedCount} rejected
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={styles.loadingText}>Loading history...</Text>
          </View>
        ) : (
          <View style={styles.section}>
            {requests.length > 0 ? (
              requests.map(request => renderRequest(request))
            ) : (
              <View style={styles.emptyContainer}>
                <Archive size={48} color="#cbd5e1" />
                <Text style={styles.emptyText}>No completed inspections</Text>
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
    backgroundColor: '#f0fdf4',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#10b981',
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
});
