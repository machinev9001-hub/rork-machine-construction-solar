import { Stack, useRouter } from 'expo-router';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { ClipboardList, ListTodo, AlertCircle, Cable, Zap, Truck, Power, Settings, MapPin, MessageCircle, BookOpen, Home } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useTheme } from '@/utils/hooks/useTheme';
import { HeaderTitleWithSync, StandardHeaderRight, StandardSiteIndicator } from '@/components/HeaderSyncStatus';

export default function MasterPlannerScreen() {
  const { user } = useAuth();
  const { theme, commonStyles } = useTheme();
  const router = useRouter();
  const [taskRequestCount, setTaskRequestCount] = useState(0);
  const [activityRequestCount, setActivityRequestCount] = useState(0);
  const [qcRequestCount, setQcRequestCount] = useState(0);
  const [cablingRequestCount, setCablingRequestCount] = useState(0);
  const [terminationRequestCount, setTerminationRequestCount] = useState(0);
  const [surveyorRequestCount, setSurveyorRequestCount] = useState(0);
  const [concreteRequestCount, setConcreteRequestCount] = useState(0);
  const [commissioningRequestCount, setCommissioningRequestCount] = useState(0);



  const isMaster = user?.role === 'master';

  useEffect(() => {
    if (!user?.siteId) return;

    const requestsRef = collection(db, 'requests');
    
    const taskRequestQuery = query(
      requestsRef,
      where('type', '==', 'TASK_REQUEST'),
      where('siteId', '==', user.siteId)
    );

    const unsubscribeTask = onSnapshot(taskRequestQuery, (snapshot) => {
      const count = snapshot.docs.filter(doc => {
        const d = doc.data() as any;
        const status = (d.status || '').toString().toUpperCase();
        return !d.archived && status === 'PENDING';
      }).length;
      setTaskRequestCount(count);
      console.log('📊 Task Requests:', count, '(from', snapshot.docs.length, 'total)');
    });

    const activityRequestQuery = query(
      requestsRef,
      where('type', '==', 'SCOPE_REQUEST'),
      where('siteId', '==', user.siteId)
    );

    const unsubscribeActivity = onSnapshot(activityRequestQuery, (snapshot) => {
      const count = snapshot.docs.filter(doc => {
        const d = doc.data() as any;
        const status = (d.status || '').toString().toUpperCase();
        return !d.archived && status === 'PENDING';
      }).length;
      setActivityRequestCount(count);
      console.log('📊 Scope Requests:', count, '(from', snapshot.docs.length, 'total)');
    });

    const qcRequestQuery = query(
      requestsRef,
      where('type', '==', 'QC_REQUEST'),
      where('siteId', '==', user.siteId)
    );

    const unsubscribeQc = onSnapshot(qcRequestQuery, (snapshot) => {
      const count = snapshot.docs.filter(doc => {
        const d = doc.data() as any;
        const status = (d.status || '').toString().toUpperCase();
        return status === 'PENDING';
      }).length;
      setQcRequestCount(count);
      console.log('📊 QC Requests:', count, '(from', snapshot.docs.length, 'total)');
    });

    const cablingRequestQuery = query(
      requestsRef,
      where('type', '==', 'CABLING_REQUEST'),
      where('siteId', '==', user.siteId)
    );

    const unsubscribeCabling = onSnapshot(cablingRequestQuery, (snapshot) => {
      const count = snapshot.docs.filter(doc => {
        const d = doc.data() as any;
        const status = (d.status || '').toString().toUpperCase();
        return !d.archived && status === 'PENDING';
      }).length;
      setCablingRequestCount(count);
      console.log('📊 Cabling Requests:', count, '(from', snapshot.docs.length, 'total)');
    });

    const terminationRequestQuery = query(
      requestsRef,
      where('type', '==', 'TERMINATION_REQUEST'),
      where('siteId', '==', user.siteId)
    );

    const unsubscribeTermination = onSnapshot(terminationRequestQuery, (snapshot) => {
      const count = snapshot.docs.filter(doc => {
        const d = doc.data() as any;
        const status = (d.status || '').toString().toUpperCase();
        return !d.archived && status === 'PENDING';
      }).length;
      setTerminationRequestCount(count);
      console.log('📊 Termination Requests:', count, '(from', snapshot.docs.length, 'total)');
    });

    const surveyorRequestsRef = collection(db, 'handoverRequests');
    const surveyorRequestQuery = query(
      surveyorRequestsRef,
      where('siteId', '==', user.siteId),
      where('requestType', '==', 'SURVEYOR_REQUEST')
    );

    const unsubscribeSurveyor = onSnapshot(surveyorRequestQuery, (snapshot) => {
      const count = snapshot.docs.filter((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>;
        const status = (data.status || '').toString().toUpperCase();
        return status === 'PENDING';
      }).length;
      setSurveyorRequestCount(count);
      console.log('📊 Surveyor Requests:', count, '(from', snapshot.docs.length, 'total)');
    });

    const concreteRequestQuery = query(
      requestsRef,
      where('type', '==', 'CONCRETE_REQUEST'),
      where('siteId', '==', user.siteId)
    );

    const unsubscribeConcrete = onSnapshot(concreteRequestQuery, (snapshot) => {
      const count = snapshot.docs.filter(doc => {
        const d = doc.data() as any;
        const status = (d.status || '').toString().toUpperCase();
        return !d.archived && status === 'PENDING';
      }).length;
      setConcreteRequestCount(count);
      console.log('📊 Concrete Requests:', count, '(from', snapshot.docs.length, 'total)');
    });

    const commissioningRequestsRef = collection(db, 'handoverRequests');
    const commissioningRequestQuery = query(
      commissioningRequestsRef,
      where('siteId', '==', user.siteId),
      where('requestType', '==', 'COMMISSIONING_REQUEST')
    );

    const unsubscribeCommissioning = onSnapshot(commissioningRequestQuery, (snapshot) => {
      const count = snapshot.docs.filter((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>;
        const status = (data.status || '').toString().toUpperCase();
        return status === 'PENDING';
      }).length;
      setCommissioningRequestCount(count);
      console.log('📊 Commissioning Requests:', count, '(from', snapshot.docs.length, 'total)');
    });

    return () => {
      unsubscribeTask();
      unsubscribeActivity();
      unsubscribeQc();
      unsubscribeCabling();
      unsubscribeTermination();
      unsubscribeSurveyor();
      unsubscribeConcrete();
      unsubscribeCommissioning();
    };
  }, [user?.siteId]);





  return (
    <View style={commonStyles.container}>
      <Stack.Screen
        options={{
          headerTitle: () => <HeaderTitleWithSync title="Planner" />,
          headerRight: () => <StandardHeaderRight />,
          headerStyle: {
            backgroundColor: theme.headerBg,
          },
          headerTintColor: theme.text,
        }}
      />
      <StandardSiteIndicator />
      <View style={commonStyles.headerBorder} />
      
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
        <View style={styles.subtitleContainer}>
          <Text style={styles.subtitle}>Project Planning & Resource Allocation</Text>
        </View>

        <View style={styles.menuContainer}>
          <View style={styles.gridContainer}>
            <TouchableOpacity 
              style={styles.menuItem} 
              activeOpacity={0.7}
              onPress={() => router.push('/planner-task-requests')}
            >
              {taskRequestCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{taskRequestCount}</Text>
                </View>
              )}
              <View style={styles.iconContainer}>
                <ClipboardList size={28} color="#fff" strokeWidth={2.5} />
              </View>
              <Text style={styles.menuText}>Task Requests</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem} 
              activeOpacity={0.7}
              onPress={() => router.push('/planner-activity-requests')}
            >
              {activityRequestCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{activityRequestCount}</Text>
                </View>
              )}
              <View style={styles.iconContainer}>
                <ListTodo size={28} color="#fff" strokeWidth={2.5} />
              </View>
              <Text style={styles.menuText}>Scope Requests</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem} 
              activeOpacity={0.7}
              onPress={() => router.push('/planner-qc-requests')}
            >
              {qcRequestCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{qcRequestCount}</Text>
                </View>
              )}
              <View style={styles.iconContainer}>
                <AlertCircle size={28} color="#fff" strokeWidth={2.5} />
              </View>
              <Text style={styles.menuText}>QC Requests</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem} 
              activeOpacity={0.7}
              onPress={() => router.push('/planner-cabling-requests')}
            >
              {cablingRequestCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{cablingRequestCount}</Text>
                </View>
              )}
              <View style={styles.iconContainer}>
                <Cable size={28} color="#fff" strokeWidth={2.5} />
              </View>
              <Text style={styles.menuText}>Cabling Requests</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem} 
              activeOpacity={0.7}
              onPress={() => router.push('/planner-termination-requests')}
            >
              {terminationRequestCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{terminationRequestCount}</Text>
                </View>
              )}
              <View style={styles.iconContainer}>
                <Zap size={28} color="#fff" strokeWidth={2.5} />
              </View>
              <Text style={styles.menuText}>Termination Requests</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem} 
              activeOpacity={0.7}
              onPress={() => router.push('/planner-surveyor-requests')}
              testID="planner-menu-surveyor-requests"
            >
              {surveyorRequestCount > 0 && (
                <View style={[styles.badge, styles.surveyorBadge]}>
                  <Text style={styles.badgeText}>{surveyorRequestCount}</Text>
                </View>
              )}
              <View style={[styles.iconContainer, styles.iconContainerSurveyor]}>
                <MapPin size={28} color="#fff" strokeWidth={2.5} />
              </View>
              <Text style={styles.menuText}>Surveyor Requests</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem} 
              activeOpacity={0.7}
              onPress={() => router.push('/planner-concrete-requests')}
              testID="planner-menu-concrete-requests"
            >
              {concreteRequestCount > 0 && (
                <View style={[styles.badge, styles.concreteBadge]}>
                  <Text style={styles.badgeText}>{concreteRequestCount}</Text>
                </View>
              )}
              <View style={[styles.iconContainer, styles.iconContainerConcrete]}>
                <Truck size={28} color="#fff" strokeWidth={2.5} />
              </View>
              <Text style={styles.menuText}>Concrete Requests</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem} 
              activeOpacity={0.7}
              onPress={() => router.push('/planner-commissioning-requests')}
              testID="planner-menu-commissioning-requests"
            >
              {commissioningRequestCount > 0 && (
                <View style={[styles.badge, styles.commissioningBadge]}>
                  <Text style={styles.badgeText}>{commissioningRequestCount}</Text>
                </View>
              )}
              <View style={[styles.iconContainer, styles.iconContainerCommissioning]}>
                <Power size={28} color="#fff" strokeWidth={2.5} />
              </View>
              <Text style={styles.menuText}>Commissioning Requests</Text>
            </TouchableOpacity>
          </View>
        </View>

        {isMaster && (
          <View style={styles.masterBanner}>
            <View style={styles.masterBadge}>
              <Text style={styles.masterBadgeText}>Master Mode</Text>
            </View>
          </View>
        )}
        
        <View style={styles.bottomSpacer} />
      </ScrollView>
      
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.footerButton}
          onPress={() => router.push('/')}
          activeOpacity={0.7}
        >
          <Home size={24} color="#FFD600" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.footerButton}
          onPress={() => router.push('/company-settings')}
          activeOpacity={0.7}
        >
          <Settings size={24} color="#FFD600" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({

  subtitleContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#000000',
  },
  subtitle: {
    fontSize: 14,
    color: '#A0A0A0',
    fontWeight: '400' as const,
  },
  menuContainer: {
    paddingTop: 20,
  },
  gridContainer: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  menuItem: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    paddingVertical: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
    position: 'relative',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainerSurveyor: {
    backgroundColor: '#0891b2',
  },
  iconContainerConcrete: {
    backgroundColor: '#f97316',
  },
  iconContainerCommissioning: {
    backgroundColor: '#10b981',
  },
  menuText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
  },
  masterBanner: {
    marginHorizontal: 20,
    marginTop: 24,
    alignItems: 'center',
  },
  masterBadge: {
    backgroundColor: '#EA4335',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  masterBadgeText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  badge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#EA4335',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
      },
    }),
  },
  surveyorBadge: {
    backgroundColor: '#0891b2',
  },
  concreteBadge: {
    backgroundColor: '#f97316',
  },
  commissioningBadge: {
    backgroundColor: '#10b981',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#fff',
    textAlign: 'center',
    ...Platform.select({
      android: {
        lineHeight: 16,
        includeFontPadding: false,
      },
      default: {
        lineHeight: 16,
      },
    }),
  },
  bottomSpacer: {
    height: 100,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  footerButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  countersSection: {
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 20,
  },
  countersScrollContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  counterCard: {
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    minWidth: 140,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: '#333333',
  },
  counterLabel: {
    fontSize: 12,
    color: '#5f6368',
    fontWeight: '500' as const,
    marginBottom: 8,
    textAlign: 'center',
  },
  counterValue: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#34A853',
    letterSpacing: -0.5,
  },
  headerRight: {
    marginRight: 16,
    alignItems: 'flex-end' as const,
  },

  siteIndicator: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    paddingVertical: 6,
    gap: 4,
    backgroundColor: '#000000',
  },
  siteIndicatorText: {
    fontSize: 11,
    color: '#A0A0A0',
    fontWeight: '500' as const,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
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
