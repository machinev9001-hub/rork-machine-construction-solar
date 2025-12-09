import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { ArrowLeft, Activity, Grid3x3, ClipboardCheck, Package, Users, Boxes } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { doc, getDoc, collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import NetInfo from '@react-native-community/netinfo';
import { getCachedActivityInstanceById } from '@/utils/sitePackCache';
import { getCachedUsers } from '@/utils/userCache';
import ActivityGridView from '@/components/ActivityGridView';
import { ActivityModuleConfig } from '@/types';
import { getMicroModulesForPlacement } from '@/utils/activityModuleHelpers';
import PlantRequestModal from '@/components/PlantRequestModal';
import { useState } from 'react';

type ActivityDetail = {
  activityId: string;
  activityName: string;
  qcValue: number;
  scopeValue: number;
  percentage: number;
  unit: string;
  taskName: string;
  subMenuName: string;
  supervisorName: string;
  scopeApproved: boolean;
  isHandoff: boolean;
  contributionToTask: number;
  moduleConfig?: ActivityModuleConfig;
  parentMainMenuId?: string;
  parentSubMenuId?: string;
};

async function fetchActivityDetail(
  activityId: string,
  taskId: string,
  supervisorId: string,
  siteId: string
): Promise<ActivityDetail | null> {
  console.log('\n🔍 ============================================== 🔍');
  console.log('🔍 ACTIVITY DETAIL - START');
  console.log('🔍 Activity ID:', activityId);
  console.log('🔍 Task ID:', taskId);
  console.log('🔍 Supervisor ID:', supervisorId);
  console.log('🔍 ============================================== 🔍\n');

  try {
    const netInfo = await NetInfo.fetch();
    const isOffline = !netInfo.isConnected;
    console.log('🔍 Network Status:', isOffline ? 'OFFLINE' : 'ONLINE');

    let activity: any;
    let scopeValue: number;
    let qcValue: number;
    let scopeApproved: boolean;
    let isHandoff: boolean;
    let taskName = 'Unknown Task';
    let supervisorName = 'Unknown Supervisor';
    let subMenuKey = '';
    let activityName = 'Unnamed Activity';
    let unit = 'm';
    let moduleConfig: ActivityModuleConfig | undefined;
    let parentMainMenuId: string | undefined;
    let parentSubMenuId: string | undefined;

    if (isOffline) {
      console.log('🔍 Loading activity from CACHE...');
      const cachedInstance = await getCachedActivityInstanceById(activityId);
      
      if (!cachedInstance) {
        console.log('❌ Activity not found in cache\n');
        return null;
      }

      activity = cachedInstance;
      scopeValue = cachedInstance.scopeValue;
      qcValue = cachedInstance.qcValue;
      scopeApproved = cachedInstance.scopeApproved;
      isHandoff = cachedInstance.cablingHandoff || cachedInstance.terminationHandoff || false;
      subMenuKey = cachedInstance.subMenuKey || '';
      activityName = cachedInstance.name;
      unit = cachedInstance.unit || 'm';

      try {
        const cachedUsers = await getCachedUsers();
        const supervisor = cachedUsers.find(u => u.userId === supervisorId);
        if (supervisor) {
          supervisorName = supervisor.name;
        }
      } catch (error) {
        console.warn('⚠️ Could not load supervisor name from cache:', error);
      }
    } else {
      console.log('🔍 Loading activity from FIRESTORE...');
      const activityRef = doc(db, 'activities', activityId);
      const activityDoc = await getDoc(activityRef);

      if (!activityDoc.exists()) {
        console.log('❌ Activity not found\n');
        return null;
      }

      activity = activityDoc.data();
      scopeValue = typeof activity.scopeValue === 'number'
        ? activity.scopeValue
        : (activity.scopeValue?.value || 0);
      qcValue = activity.qcValue || activity.qc?.value || 0;
      scopeApproved = activity.scopeApproved || false;
      isHandoff = activity.cablingHandoff || activity.terminationHandoff;
      subMenuKey = activity.subMenuKey || '';
      activityName = activity.name || 'Unnamed Activity';
      unit = activity.unit || 'm';
      moduleConfig = activity.moduleConfig;

      const taskRef = doc(db, 'tasks', taskId);
      const taskDoc = await getDoc(taskRef);
      taskName = taskDoc.exists() ? taskDoc.data().name : 'Unknown Task';

      const supervisorRef = doc(db, 'users', supervisorId);
      const supervisorDoc = await getDoc(supervisorRef);
      supervisorName = supervisorDoc.exists() ? supervisorDoc.data().name : 'Unknown Supervisor';
    }

    const percentage = scopeValue > 0 ? (qcValue / scopeValue) * 100 : 0;
    const subMenuName = subMenuKey
      .split('-')
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    let contributionToTask = 0;
    if (scopeApproved && !isHandoff && scopeValue > 0) {
      contributionToTask = percentage;
    }

    console.log('✅ Activity Detail Loaded:', activityName);
    console.log('   Progress:', percentage.toFixed(2), '%');
    console.log('   QC:', qcValue, '| Scope:', scopeValue);
    console.log('   Approved:', scopeApproved, '| Handoff:', isHandoff);
    console.log('   Contribution to Task:', contributionToTask.toFixed(2), '%');
    console.log('   Module Config:', moduleConfig?.baseBlockType || 'None');
    console.log('🔍 ============================================== 🔍\n');

    return {
      activityId,
      activityName,
      qcValue,
      scopeValue,
      percentage: Math.min(percentage, 100),
      unit,
      taskName,
      subMenuName,
      supervisorName,
      scopeApproved,
      isHandoff,
      contributionToTask,
      moduleConfig,
      parentMainMenuId,
      parentSubMenuId,
    };
  } catch (error) {
    console.error('❌ ACTIVITY DETAIL - ERROR:', error);
    return null;
  }
}

export default function ActivityDetailScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const activityId = params.activityId as string;
  const taskId = params.taskId as string;
  const supervisorId = params.supervisorId as string;
  const [plantModalVisible, setPlantModalVisible] = useState(false);
  const [staffModalVisible, setStaffModalVisible] = useState(false);
  const [materialsModalVisible, setMaterialsModalVisible] = useState(false);

  const { data: activity, isLoading, error } = useQuery({
    queryKey: ['activityDetail', activityId, taskId, supervisorId, user?.siteId],
    queryFn: () => fetchActivityDetail(activityId, taskId, supervisorId, user?.siteId || ''),
    enabled: !!activityId && !!taskId && !!supervisorId && !!user?.siteId,
  });

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: activity?.activityName || 'Activity Detail',
          headerStyle: {
            backgroundColor: '#ffffff',
          },
          headerTintColor: '#202124',
          headerTitleStyle: {
            fontWeight: '600' as const,
          },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft size={24} color="#202124" strokeWidth={2} />
            </TouchableOpacity>
          ),
        }}
      />

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={styles.loadingText}>Loading activity details...</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load activity details</Text>
        </View>
      )}

      {!isLoading && !error && activity && (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Activity size={24} color="#4285F4" strokeWidth={2.5} />
            <Text style={styles.headerTitle}>Activity Details</Text>
          </View>

          <View style={styles.progressCard}>
            <Text style={styles.progressLabel}>Completion Progress</Text>
            <Text style={styles.progressPercentage}>{activity.percentage.toFixed(1)}%</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${Math.min(activity.percentage, 100)}%` }]} />
            </View>
            <View style={styles.progressStats}>
              <Text style={styles.progressStatsText}>
                {activity.qcValue.toFixed(1)} / {activity.scopeValue.toFixed(1)} {activity.unit}
              </Text>
            </View>
          </View>

          {activity.moduleConfig?.baseBlockType === 'GRID_TYPE_ROW_PROGRESS' && activity.moduleConfig.gridConfig ? (
            <View style={styles.gridSection}>
              {(() => {
                const modulesAbove = getMicroModulesForPlacement(activity.moduleConfig, 'above');
                return modulesAbove.length > 0 ? (
                  <View style={styles.microModulesAbove}>
                    {modulesAbove.map((module) => {
                      if (module === 'QC_REQUEST') {
                        return (
                          <TouchableOpacity
                            key={`qc-above-${activity.activityId}`}
                            style={styles.qcRequestButton}
                            onPress={() => {
                              Alert.alert('QC Request', `Request QC for ${activity.activityName}`);
                            }}
                            activeOpacity={0.7}
                          >
                            <View style={styles.qcRequestButtonContent}>
                              <ClipboardCheck size={20} color="#10b981" strokeWidth={2.5} />
                              <View style={styles.qcRequestButtonText}>
                                <Text style={styles.qcRequestButtonTitle}>QC Request</Text>
                                <Text style={styles.qcRequestButtonSubtitle}>Request quality control inspection</Text>
                              </View>
                            </View>
                          </TouchableOpacity>
                        );
                      }
                      if (module === 'PLANT_REQUEST') {
                        return (
                          <TouchableOpacity
                            key={`plant-above-${activity.activityId}`}
                            style={[styles.requestCard, styles.requestCardPlant]}
                            onPress={() => {
                              console.log('[ActivityDetail] Plant card clicked');
                              console.log('[ActivityDetail] user?.masterAccountId:', user?.masterAccountId);
                              console.log('[ActivityDetail] user?.siteId:', user?.siteId);
                              setPlantModalVisible(true);
                            }}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.requestCardIcon, { backgroundColor: '#fef3c7' }]}>
                              <Package size={24} color="#f59e0b" strokeWidth={2.5} />
                            </View>
                            <Text style={styles.requestCardLabel}>Plant Request</Text>
                          </TouchableOpacity>
                        );
                      }
                      if (module === 'MATERIALS_REQUEST') {
                        return (
                          <TouchableOpacity
                            key={`materials-above-${activity.activityId}`}
                            style={[styles.requestCard, styles.requestCardMaterials]}
                            onPress={() => setMaterialsModalVisible(true)}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.requestCardIcon, { backgroundColor: '#e0e7ff' }]}>
                              <Boxes size={24} color="#6366f1" strokeWidth={2.5} />
                            </View>
                            <Text style={styles.requestCardLabel}>Materials Request</Text>
                          </TouchableOpacity>
                        );
                      }
                      if (module === 'STAFF_REQUEST') {
                        return (
                          <TouchableOpacity
                            key={`staff-above-${activity.activityId}`}
                            style={[styles.requestCard, styles.requestCardStaff]}
                            onPress={() => setStaffModalVisible(true)}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.requestCardIcon, { backgroundColor: '#dbeafe' }]}>
                              <Users size={24} color="#3b82f6" strokeWidth={2.5} />
                            </View>
                            <Text style={styles.requestCardLabel}>Staff Request</Text>
                          </TouchableOpacity>
                        );
                      }
                      return null;
                    })}
                  </View>
                ) : null;
              })()}
              
              <View style={styles.gridCard}>
                <ActivityGridView
                  gridConfig={activity.moduleConfig.gridConfig}
                  activityId={activity.activityId}
                  activityName={activity.activityName}
                  taskId={taskId}
                  siteId={user?.siteId || ''}
                  supervisorId={supervisorId}
                  supervisorName={activity.supervisorName}
                  onCellPress={(cell) => console.log('Cell pressed:', cell)}
                  moduleConfig={activity.moduleConfig}
                />
              </View>
            </View>
          ) : (
            <View style={styles.placeholderGridCard}>
              <View style={styles.placeholderHeader}>
                <Grid3x3 size={20} color="#9aa0a6" strokeWidth={2} />
                <Text style={styles.placeholderTitle}>No Grid Configuration</Text>
              </View>
              <Text style={styles.placeholderDescription}>
                This activity does not have a grid layout configured. To enable grid tracking, edit this activity in Menu Manager and select the &quot;Grid Type Block (Row Progress)&quot; base block type.
              </Text>
            </View>
          )}

          <View style={styles.detailsCard}>
            <Text style={styles.sectionTitle}>Activity Information</Text>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Activity Name</Text>
              <Text style={styles.detailValue}>{activity.activityName}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Task</Text>
              <Text style={styles.detailValue}>{activity.taskName}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Sub-Menu</Text>
              <Text style={styles.detailValue}>{activity.subMenuName}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Supervisor</Text>
              <Text style={styles.detailValue}>{activity.supervisorName}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Unit</Text>
              <Text style={styles.detailValue}>{activity.unit}</Text>
            </View>
          </View>

          <View style={styles.metricsCard}>
            <Text style={styles.sectionTitle}>Progress Metrics</Text>

            <View style={styles.metricRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>QC Value</Text>
                <Text style={styles.metricValue}>{activity.qcValue.toFixed(1)}</Text>
                <Text style={styles.metricUnit}>{activity.unit}</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Allocated Scope</Text>
                <Text style={styles.metricValue}>{activity.scopeValue.toFixed(1)}</Text>
                <Text style={styles.metricUnit}>{activity.unit}</Text>
              </View>
            </View>

            <View style={styles.metricRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>% Complete</Text>
                <Text style={styles.metricValue}>{activity.percentage.toFixed(1)}%</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Contribution to Task</Text>
                <Text style={styles.metricValue}>{activity.contributionToTask.toFixed(1)}%</Text>
              </View>
            </View>
          </View>

          <View style={styles.statusCard}>
            <Text style={styles.sectionTitle}>Status Information</Text>

            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Scope Approved</Text>
              <View style={[styles.statusBadge, activity.scopeApproved ? styles.statusApproved : styles.statusPending]}>
                <Text style={[styles.statusBadgeText, activity.scopeApproved ? styles.statusApprovedText : styles.statusPendingText]}>
                  {activity.scopeApproved ? 'Approved' : 'Pending'}
                </Text>
              </View>
            </View>

            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Handoff Activity</Text>
              <View style={[styles.statusBadge, activity.isHandoff ? styles.statusHandoff : styles.statusNormal]}>
                <Text style={[styles.statusBadgeText, activity.isHandoff ? styles.statusHandoffText : styles.statusNormalText]}>
                  {activity.isHandoff ? 'Yes' : 'No'}
                </Text>
              </View>
            </View>

            {(!activity.scopeApproved || activity.isHandoff) && (
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>
                  {!activity.scopeApproved
                    ? '⚠️ This activity is not yet approved and does not contribute to total progress'
                    : '⚠️ This is a handoff activity and does not contribute to total progress'}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {!isLoading && !error && !activity && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Activity not found</Text>
        </View>
      )}

      <PlantRequestModal
        visible={plantModalVisible}
        onClose={() => setPlantModalVisible(false)}
        onSubmit={async (entries) => {
          console.log('🚀 ============================================== 🚀');
          console.log('🚀 [PLANT REQUEST] Submission started');
          console.log('🚀 [PLANT REQUEST] Entries:', JSON.stringify(entries, null, 2));
          console.log('🚀 [PLANT REQUEST] User:', user?.userId, user?.name);
          console.log('🚀 [PLANT REQUEST] Site:', user?.siteId);
          console.log('🚀 ============================================== 🚀');
          
          try {
            for (const entry of entries) {
              const requestData = {
                type: 'PLANT_ALLOCATION_REQUEST',
                status: 'PENDING',
                requestedBy: user?.userId || 'unknown',
                requestedByName: user?.name || '',
                requestedAt: Timestamp.now(),
                createdAt: Timestamp.now(),
                siteId: user?.siteId || '',
                masterAccountId: user?.masterAccountId || '',
                taskId: taskId || '',
                activityId: activityId || '',
                activityName: activity?.activityName || '',
                plantType: entry.plantType,
                quantity: parseInt(entry.quantity, 10),
                archived: false,
                supervisorId: user?.userId || '',
                supervisorName: user?.name || '',
              };
              
              console.log('📝 [PLANT REQUEST] Request data prepared:');
              console.log(JSON.stringify(requestData, null, 2));
              
              const requestsRef = collection(db, 'requests');
              const docRef = await addDoc(requestsRef, requestData);
              
              console.log('✅ ============================================== ✅');
              console.log('✅ [PLANT REQUEST] Request created successfully!');
              console.log('✅ [PLANT REQUEST] Document ID:', docRef.id);
              console.log('✅ [PLANT REQUEST] Written data:', JSON.stringify(requestData, null, 2));
              console.log('✅ [PLANT REQUEST] To verify, open Plant Manager → Allocation Requests');
              console.log('✅ [PLANT REQUEST] Query will look for:');
              console.log('   - type === PLANT_ALLOCATION_REQUEST');
              console.log('   - siteId ===', user?.siteId);
              console.log('   - status === PENDING');
              console.log('   - archived === false');
              console.log('✅ ============================================== ✅');
            }
            
            Alert.alert(
              'Request Submitted',
              `Plant request with ${entries.length} item(s) has been submitted successfully. Check Plant Manager → Allocation Requests to see it.`,
              [
                {
                  text: 'OK',
                  onPress: () => setPlantModalVisible(false),
                },
              ]
            );
          } catch (error) {
            console.error('❌ ============================================== ❌');
            console.error('❌ [PLANT REQUEST] Error creating plant request:', error);
            console.error('❌ ============================================== ❌');
            Alert.alert(
              'Error',
              'Failed to submit plant request. Please try again.',
              [
                {
                  text: 'OK',
                },
              ]
            );
          }
        }}
        masterAccountId={user?.masterAccountId || ''}
        siteId={user?.siteId || ''}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  backButton: {
    marginLeft: 16,
    padding: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    gap: 12,
    backgroundColor: '#ffffff',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#202124',
    letterSpacing: -0.3,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
  },
  loadingText: {
    fontSize: 14,
    color: '#5f6368',
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 20,
    padding: 24,
    backgroundColor: '#fee',
    borderRadius: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#c62828',
    textAlign: 'center',
  },
  progressCard: {
    backgroundColor: '#4285F4',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 24,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 8,
  },
  progressPercentage: {
    fontSize: 48,
    fontWeight: '700' as const,
    color: '#ffffff',
    marginBottom: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 4,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressStatsText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  detailsCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#202124',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e8eaed',
  },
  detailLabel: {
    fontSize: 14,
    color: '#5f6368',
    fontWeight: '500' as const,
  },
  detailValue: {
    fontSize: 14,
    color: '#202124',
    fontWeight: '600' as const,
    flex: 1,
    textAlign: 'right',
    marginLeft: 16,
  },
  metricsCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  metricRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#E8EAED',
    padding: 12,
    borderRadius: 8,
  },
  metricDivider: {
    width: 1,
    backgroundColor: '#e8eaed',
    marginHorizontal: 12,
  },
  metricLabel: {
    fontSize: 12,
    color: '#5f6368',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#202124',
    marginBottom: 4,
  },
  metricUnit: {
    fontSize: 12,
    color: '#80868b',
  },
  statusCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 14,
    color: '#5f6368',
    fontWeight: '500' as const,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusApproved: {
    backgroundColor: '#e6f4ea',
  },
  statusPending: {
    backgroundColor: '#fef7e0',
  },
  statusHandoff: {
    backgroundColor: '#e8eaed',
  },
  statusNormal: {
    backgroundColor: '#e8f0fe',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  statusApprovedText: {
    color: '#137333',
  },
  statusPendingText: {
    color: '#ea8600',
  },
  statusHandoffText: {
    color: '#5f6368',
  },
  statusNormalText: {
    color: '#1967d2',
  },
  warningBox: {
    backgroundColor: '#fef7e0',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#ea8600',
  },
  warningText: {
    fontSize: 13,
    color: '#7c4a03',
    lineHeight: 20,
  },
  gridCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  placeholderGridCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e8eaed',
    borderStyle: 'dashed' as const,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  placeholderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  placeholderTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#5f6368',
  },
  placeholderDescription: {
    fontSize: 13,
    color: '#5f6368',
    lineHeight: 20,
  },
  gridSection: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  microModulesAbove: {
    marginBottom: 12,
    gap: 8,
  },
  qcRequestButton: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#86efac',
  },
  qcRequestButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qcRequestButtonText: {
    flex: 1,
  },
  qcRequestButtonTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#065f46',
    marginBottom: 2,
  },
  qcRequestButtonSubtitle: {
    fontSize: 12,
    color: '#047857',
  },
  requestCardsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#e8eaed',
  },
  requestCardsTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#202124',
    marginBottom: 12,
  },
  requestCardsGrid: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  requestCard: {
    flex: 1,
    minWidth: 100,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 10,
  },
  requestCardPlant: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  requestCardStaff: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  requestCardMaterials: {
    backgroundColor: '#eef2ff',
    borderColor: '#c7d2fe',
  },
  requestCardIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestCardLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#202124',
  },
});
