import { Stack, useRouter } from 'expo-router';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Calendar, ChevronDown, ChevronUp } from 'lucide-react-native';
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
  scheduledBy?: string;
  scheduledCreatedAt?: any;
  createdAt: any;
  updatedAt: any;
};

export default function QCScheduledScreen() {
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
      console.log('❌ QC SCHEDULED - No siteId');
      setIsLoading(false);
      return;
    }

    console.log('🔍 QC SCHEDULED - Setting up listener for siteId:', user.siteId);
    setIsLoading(true);

    const requestsRef = collection(db, 'requests');
    const q = query(
      requestsRef,
      where('type', '==', 'QC_REQUEST'),
      where('siteId', '==', user.siteId),
      where('status', '==', 'scheduled'),
      orderBy('scheduledAt', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        console.log('📊 QC SCHEDULED - Received', snapshot.docs.length, 'documents');
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
        console.error('❌ QC SCHEDULED - Error:', err);
        setIsLoading(false);
      }
    );

    return () => {
      console.log('🔴 QC SCHEDULED - Cleaning up listener');
      unsubscribe();
    };
  }, [user?.siteId]);

  const formatScheduledDate = (timestamp?: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
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

  const renderRequest = (request: QCRequest) => {
    const isExpanded = expandedCards.has(request.id);

    return (
      <View key={request.id} style={styles.requestCard}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => toggleCard(request.id)}
        >
          <View style={styles.requestHeader}>
            <View style={styles.statusBadge}>
              <Calendar size={16} color="#3b82f6" />
              <Text style={styles.statusText}>
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

            <View style={styles.requestMeta}>
              <Text style={styles.metaLabel}>Supervisor:</Text>
              <Text style={styles.metaValue}>{request.requestedByName || request.requestedBy || request.supervisorId}</Text>
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

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Scheduled Inspections',
          headerStyle: {
            backgroundColor: '#3b82f6',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: '600' as const,
          },
        }}
      />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <Calendar size={32} color="#3b82f6" />
          <Text style={styles.headerTitle}>Scheduled QC Inspections</Text>
          <Text style={styles.headerSubtitle}>
            {requests.length} scheduled visit{requests.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Loading scheduled inspections...</Text>
          </View>
        ) : (
          <View style={styles.section}>
            {requests.length > 0 ? (
              requests.map(request => renderRequest(request))
            ) : (
              <View style={styles.emptyContainer}>
                <Calendar size={48} color="#cbd5e1" />
                <Text style={styles.emptyText}>No scheduled QC visits</Text>
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
    backgroundColor: '#dbeafe',
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    color: '#3b82f6',
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
    backgroundColor: '#eff6ff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
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
});
