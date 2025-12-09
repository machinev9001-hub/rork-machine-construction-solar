import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { ArrowLeft, BarChart3, CheckCircle, ClipboardCheck } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import BottomTabBar from '@/components/BottomTabBar';
import NetInfo from '@react-native-community/netinfo';
import { getCachedActivityInstancesByTask } from '@/utils/sitePackCache';
import { subMenuActivities } from '@/constants/activities';
import { ActivityModuleConfig, FlexibleColumnConfig } from '@/types';
import HandoverCard from '@/components/HandoverCard';
import { findMatchingSupervisors, MatchingSupervisor } from '@/utils/handover';
import { useState } from 'react';
import { getMicroModulesForPlacement } from '@/utils/activityModuleHelpers';


const LEGACY_SUBMENU_MAP: Record<string, string> = {
  foundations: 'foundation',
};

function normalizeSubMenuKey(key: string): string {
  const normalized = key.toLowerCase().trim();
  return LEGACY_SUBMENU_MAP[normalized] ?? normalized;
}

type ActivityProgress = {
  activityId: string;
  activityName: string;
  qcValue: number;
  unverifiedValue: number;
  scopeValue: number;
  percentage: number;
  unverifiedPercentage: number;
  unit: string;
  moduleConfig?: ActivityModuleConfig;
};

type ActivityModuleConfigLookup = {
  byName: Map<string, ActivityModuleConfig>;
  byId: Map<string, ActivityModuleConfig>;
};

async function fetchActivityModuleConfigs(
  siteId: string,
  masterAccountId: string,
  subMenuKey: string
): Promise<ActivityModuleConfigLookup> {
  console.log('\n🔧 Fetching activity module configurations...');
  console.log('🔧 Site ID:', siteId);
  console.log('🔧 Sub-Menu Key:', subMenuKey);

  const lookup: ActivityModuleConfigLookup = {
    byName: new Map<string, ActivityModuleConfig>(),
    byId: new Map<string, ActivityModuleConfig>(),
  };

  try {
    const netInfo = await NetInfo.fetch();
    const isOffline = !netInfo.isConnected;

    if (isOffline) {
      console.log('🔧 Cannot load module configs offline');
      return lookup;
    }

    const menuItemsRef = collection(db, 'menuItems');
    const menuQuery = query(
      menuItemsRef,
      where('siteId', '==', siteId),
      where('masterAccountId', '==', masterAccountId),
      where('level', '==', 'activity')
    );

    const snapshot = await getDocs(menuQuery);
    console.log('🔧 Found', snapshot.docs.length, 'activity menu items');

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      if (!data.moduleConfig) {
        continue;
      }

      const activityName = data.name?.toUpperCase() || '';
      const moduleConfig = data.moduleConfig as ActivityModuleConfig;

      lookup.byId.set(docSnap.id, moduleConfig);
      if (activityName) {
        lookup.byName.set(activityName, moduleConfig);
      }

      console.log('🔧 Loaded config for:', activityName || docSnap.id, '-> Base:', moduleConfig.baseBlockType);
    }

    console.log('🔧 Total configs loaded (byId):', lookup.byId.size);
  } catch (error) {
    console.error('❌ Error fetching activity module configs:', error);
  }

  return lookup;
}

async function fetchTaskActivities(
  siteId: string,
  masterAccountId: string,
  supervisorId: string,
  taskId: string,
  subMenuKey: string,
  pvArea: string,
  blockNumber: string
): Promise<ActivityProgress[]> {
  const normalizedSubMenuKey = normalizeSubMenuKey(subMenuKey);
  console.log('\n🔍 ============================================== 🔍');
  console.log('🔍 TASK ACTIVITIES - START');
  console.log('🔍 Site ID:', siteId);
  console.log('🔍 Master Account ID:', masterAccountId);
  console.log('🔍 Supervisor ID:', supervisorId);
  console.log('🔍 Task ID:', taskId);
  console.log('🔍 Sub-Menu:', normalizedSubMenuKey);
  console.log('🔍 PV Area:', pvArea);
  console.log('🔍 Block:', blockNumber);
  console.log('🔍 ============================================== 🔍\n');

  const activityConfigLookup = await fetchActivityModuleConfigs(siteId, masterAccountId, normalizedSubMenuKey);

  try {
    const netInfo = await NetInfo.fetch();
    const isOffline = !netInfo.isConnected;
    console.log('🔍 Network Status:', isOffline ? 'OFFLINE' : 'ONLINE');

    let activitiesSnapshot: any[] = [];

    if (isOffline) {
      console.log('🔍 Loading activities from CACHE...');
      const cachedInstances = await getCachedActivityInstancesByTask(taskId);
      console.log('🔍 Found', cachedInstances.length, 'cached activity instances for task\n');
      
      activitiesSnapshot = cachedInstances.map(instance => ({
        id: instance.id,
        data: () => ({
          name: instance.name,
          subMenuKey: instance.subMenuKey,
          supervisorInputBy: instance.supervisorInputBy,
          scopeValue: instance.scopeValue,
          qcValue: instance.qcValue,
          unit: instance.unit,
        }),
      }));
    } else {
      console.log('🔍 Loading activities from FIRESTORE...');
      const activitiesRef = collection(db, 'activities');
      const activitiesQuery = query(activitiesRef, where('taskId', '==', taskId));
      const snapshot = await getDocs(activitiesQuery);
      activitiesSnapshot = snapshot.docs;
      console.log('🔍 Found', snapshot.docs.length, 'activities for task\n');
    }

    const predefinedActivities = subMenuActivities[normalizedSubMenuKey] || [];
    console.log('🔍 Predefined activities for', normalizedSubMenuKey, ':', predefinedActivities.length);

    const activities: ActivityProgress[] = [];

    for (const activityDoc of activitiesSnapshot) {
      const activity = activityDoc.data();
      const activitySupervisorId = activity.supervisorInputBy || '';
      const activitySubMenuKey = normalizeSubMenuKey(activity.subMenuKey || '');

      let scopeValue = typeof activity.scopeValue === 'number'
        ? activity.scopeValue
        : (activity.scopeValue?.value || 0);
      let qcValue = activity.qcValue || activity.qc?.value || 0;
      let unverifiedValue = activity.supervisorInputValue || 0;

      const activityNameUpper = (activity.name || 'Unnamed Activity').toUpperCase();
      const menuActivityId = typeof activity.activityId === 'string' ? activity.activityId : '';
      const configFromId = menuActivityId ? activityConfigLookup.byId.get(menuActivityId) : undefined;
      const configFromName = activityConfigLookup.byName.get(activityNameUpper);
      const moduleConfig = (activity.moduleConfig as ActivityModuleConfig | undefined) || configFromId || configFromName;
      const isGridBased = moduleConfig?.baseBlockType === 'GRID_TYPE_ROW_PROGRESS';

      if (!isOffline && isGridBased && moduleConfig?.gridConfig) {
        console.log('   🔷 GRID-BASED ACTIVITY detected:', activity.name);
        
        const gridProgressRef = collection(db, 'gridCellProgress');
        const gridProgressQuery = query(
          gridProgressRef,
          where('activityId', '==', activityDoc.id),
          where('taskId', '==', taskId),
          where('siteId', '==', siteId)
        );
        const gridProgressSnapshot = await getDocs(gridProgressQuery);
        
        const completedCells = gridProgressSnapshot.docs.filter(
          doc => doc.data().status === 'completed'
        );
        const valuePerCell = moduleConfig.gridConfig.scopeValue || 1;
        const totalCells = (moduleConfig.gridConfig.flexibleColumns || []).reduce(
          (sum: number, col: FlexibleColumnConfig) => sum + col.rows,
          0
        );
        
        const gridQcValue = completedCells.filter(doc => !doc.data().isLocked).length * valuePerCell;
        const gridUnverifiedValue = completedCells.length * valuePerCell;
        const gridScopeValue = totalCells * valuePerCell;
        
        console.log('   🔷 Grid Progress:', {
          completedCells: completedCells.length,
          totalCells,
          valuePerCell,
          gridQcValue,
          gridUnverifiedValue,
          gridScopeValue,
        });
        
        qcValue = gridQcValue;
        unverifiedValue = gridUnverifiedValue;
        scopeValue = gridScopeValue;
      }

      if (activitySupervisorId !== supervisorId) {
        console.log('   ❌ SKIPPED | Activity:', activity.name, '| Different supervisor\n');
        continue;
      }

      if (activitySubMenuKey !== normalizedSubMenuKey) {
        console.log('   ❌ SKIPPED | Activity:', activity.name, '| Different sub-menu\n');
        continue;
      }

      const percentage = scopeValue > 0 ? (qcValue / scopeValue) * 100 : 0;
      const unverifiedPercentage = scopeValue > 0 ? (unverifiedValue / scopeValue) * 100 : 0;

      const unit = typeof activity.unit === 'string' 
        ? activity.unit 
        : activity.unit?.canonical || 'm';

      activities.push({
        activityId: activityDoc.id,
        activityName: activity.name || 'Unnamed Activity',
        qcValue,
        unverifiedValue,
        scopeValue,
        percentage: Math.min(percentage, 100),
        unverifiedPercentage: Math.min(unverifiedPercentage, 100),
        unit,
        moduleConfig,
      });

      console.log('   ✅ INCLUDED | Activity:', activity.name, '| Progress:', percentage.toFixed(2), '%\n');
    }



    console.log('🔍 ============================================== 🔍');
    console.log('🔍 TASK ACTIVITIES - FINAL RESULT');
    console.log('🔍 Total Activities:', activities.length);
    activities.forEach(item => {
      console.log(`🔍 ${item.activityName}: ${item.percentage.toFixed(2)}% (${item.qcValue.toFixed(2)}/${item.scopeValue.toFixed(2)} ${item.unit})`);
    });
    console.log('🔍 ============================================== 🔍\n');

    return activities;
  } catch (error) {
    console.error('❌ TASK ACTIVITIES - ERROR:', error);
    return [];
  }
}

export default function TaskActivitiesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams();
  const taskId = params.taskId as string;
  const taskName = params.taskName as string;
  const supervisorId = params.supervisorId as string;
  const subMenuKey = normalizeSubMenuKey((params.subMenuKey as string) ?? '');
  const pvArea = params.pvArea as string;
  const blockNumber = params.blockNumber as string;

  const [handoverModalVisible, setHandoverModalVisible] = useState<boolean>(false);
  const [matchingSupervisors, setMatchingSupervisors] = useState<MatchingSupervisor[]>([]);
  const [isLoadingSupervisors, setIsLoadingSupervisors] = useState<boolean>(false);

  const showCommissioningHandover = subMenuKey === 'dc-terminations' || subMenuKey === 'lv-terminations' || subMenuKey === 'mv-terminations';

  console.log('🔍 TASK ACTIVITIES SCREEN - Params:');
  console.log('   taskId:', taskId);
  console.log('   taskName:', taskName);
  console.log('   supervisorId:', supervisorId);
  console.log('   subMenuKey:', subMenuKey);
  console.log('   siteId:', user?.siteId);

  const handleRequestCommissioning = async () => {
    if (!user?.siteId || !user?.userId) {
      Alert.alert('Error', 'User information not available');
      return;
    }

    setIsLoadingSupervisors(true);
    setHandoverModalVisible(true);

    try {
      const supervisors = await findMatchingSupervisors({
        currentSupervisorId: supervisorId,
        subMenuKey: 'commissioning',
        activityId: 'commissioning-handover',
        pvArea: pvArea || '',
        blockNumber: blockNumber || '',
        siteId: user.siteId,
      });

      setMatchingSupervisors(supervisors);
    } catch (error) {
      console.error('❌ Error finding commissioning supervisors:', error);
      Alert.alert('Error', 'Failed to load available commissioning teams');
      setHandoverModalVisible(false);
    } finally {
      setIsLoadingSupervisors(false);
    }
  };

  const sendCommissioningRequestMutation = useMutation({
    mutationFn: async ({ targetSupervisorId, targetTaskId }: { targetSupervisorId: string; targetTaskId: string }) => {
      if (!user?.siteId || !user?.userId) {
        throw new Error('User information not available');
      }

      const requestsRef = collection(db, 'handoverRequests');
      await addDoc(requestsRef, {
        requestType: 'COMMISSIONING_REQUEST',
        siteId: user.siteId,
        fromSupervisorId: supervisorId,
        toSupervisorId: targetSupervisorId,
        taskId: targetTaskId,
        sourceTaskId: taskId,
        activityName: 'Commissioning',
        subMenuKey: 'commissioning',
        subMenuName: 'Commissioning',
        pvArea: pvArea || '',
        blockNumber: blockNumber || '',
        status: 'PENDING',
        createdAt: serverTimestamp(),
        createdBy: user.userId,
        noteFromSender: `Commissioning request from ${taskName}`,
      });

      console.log('✅ Commissioning request sent to supervisor:', targetSupervisorId);
    },
    onSuccess: () => {
      Alert.alert('Success', 'Commissioning request sent successfully');
      setHandoverModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ['taskActivities'] });
    },
    onError: (error) => {
      console.error('❌ Error sending commissioning request:', error);
      Alert.alert('Error', 'Failed to send commissioning request');
    },
  });

  const handleSelectCommissioningSupervisor = async (targetSupervisorId: string, targetTaskId: string) => {
    await sendCommissioningRequestMutation.mutateAsync({ targetSupervisorId, targetTaskId });
  };

  const isMaster = user?.role === 'master';
  const effectiveMasterAccountId = isMaster ? (user?.masterAccountId || user?.id) : user?.masterAccountId;

  const { data: activities, isLoading, error } = useQuery({
    queryKey: ['taskActivities', user?.siteId, effectiveMasterAccountId, supervisorId, taskId, subMenuKey, pvArea, blockNumber],
    queryFn: () => {
      return fetchTaskActivities(
        user?.siteId!,
        effectiveMasterAccountId!,
        supervisorId,
        taskId,
        subMenuKey,
        pvArea || '',
        blockNumber || ''
      );
    },
    enabled: !!user?.siteId && !!supervisorId && !!taskId && !!subMenuKey,
  });

  const totalQc = activities?.reduce((sum, act) => sum + act.qcValue, 0) || 0;
  const totalUnverified = activities?.reduce((sum, act) => sum + act.unverifiedValue, 0) || 0;
  const totalScope = activities?.reduce((sum, act) => sum + act.scopeValue, 0) || 0;
  const totalPercentage = totalScope > 0 ? (totalQc / totalScope) * 100 : 0;
  const totalUnverifiedPercentage = totalScope > 0 ? (totalUnverified / totalScope) * 100 : 0;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: taskName || 'Activity Progress',
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

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <BarChart3 size={24} color="#4285F4" strokeWidth={2.5} />
          <Text style={styles.headerTitle}>Activity Progress</Text>
        </View>

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4285F4" />
            <Text style={styles.loadingText}>Loading activity progress...</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Failed to load activity progress</Text>
          </View>
        )}

        {!isLoading && !error && activities && (
          <View style={styles.activitiesContainer}>
            {activities.length > 0 && (
              <View style={styles.taskProgressCard}>
                <View style={styles.taskProgressHeader}>
                  <Text style={styles.taskProgressTitle}>Task 1</Text>
                  <View style={styles.taskProgressLabels}>
                    <Text style={styles.taskProgressLabelSmall}>TOTAL TASK PROGRESS</Text>
                    <View style={styles.taskProgressPercentages}>
                      <Text style={styles.taskProgressLabelSmall}>Verified</Text>
                      <Text style={styles.taskProgressLabelSmall}>Unverified</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.taskProgressStats}>
                  <View style={styles.taskProgressLeft}>
                    {pvArea && <Text style={styles.taskProgressDetail}>PV Area: {pvArea}</Text>}
                    {blockNumber && <Text style={styles.taskProgressDetail}>Block Number: {blockNumber}</Text>}
                  </View>
                  <View style={styles.taskProgressPercentagesValues}>
                    <Text style={styles.taskProgressPercentVerified}>{totalPercentage.toFixed(0)}%</Text>
                    <Text style={styles.taskProgressPercentUnverified}>{totalUnverifiedPercentage.toFixed(0)}%</Text>
                  </View>
                </View>
              </View>
            )}
            {showCommissioningHandover && (
              <View style={styles.commissioningHandoverSection}>
                <View style={styles.commissioningHandoverCard}>
                  <View style={styles.commissioningHandoverHeader}>
                    <CheckCircle size={24} color="#10b981" strokeWidth={2.5} />
                    <View style={styles.commissioningHandoverHeaderText}>
                      <Text style={styles.commissioningHandoverTitle}>Commissioning Handover</Text>
                      <Text style={styles.commissioningHandoverSubtitle}>Request commissioning team</Text>
                    </View>
                  </View>
                  <Text style={styles.commissioningHandoverDescription}>
                    {subMenuKey === 'dc-terminations' 
                      ? 'DC terminations are complete. Request a commissioning team to proceed with system testing and activation.'
                      : subMenuKey === 'lv-terminations'
                      ? 'LV terminations are complete. Request a commissioning team to proceed with system testing and activation.'
                      : 'MV terminations are complete. Request a commissioning team to proceed with system testing and activation.'}
                  </Text>
                  <TouchableOpacity
                    style={styles.commissioningHandoverButton}
                    onPress={handleRequestCommissioning}
                    activeOpacity={0.7}
                  >
                    <CheckCircle size={20} color="#fff" strokeWidth={2.5} />
                    <Text style={styles.commissioningHandoverButtonText}>Request Commissioning</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            <View style={styles.activitiesSection}>
              {activities.length === 0 ? (
                <View style={styles.emptyState}>
                  <BarChart3 size={48} color="#9ca3af" strokeWidth={1.5} />
                  <Text style={styles.emptyStateText}>No activities available</Text>
                  <Text style={styles.emptyStateSubtext}>
                    Activities will appear here once they are logged
                  </Text>
                </View>
              ) : (
                activities.map((activity) => {
                  const modulesAbove = getMicroModulesForPlacement(activity.moduleConfig, 'above');
                  const modulesInside = getMicroModulesForPlacement(activity.moduleConfig, 'inside');
                  
                  return (
                    <View key={activity.activityId} style={styles.activityWrapper}>
                      {modulesAbove.length > 0 && (
                        <View style={styles.microModulesAbove}>
                          {modulesAbove.map((module) => {
                            if (module === 'QC_REQUEST') {
                              return (
                                <TouchableOpacity
                                  key={`qc-${activity.activityId}`}
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
                            return null;
                          })}
                        </View>
                      )}
                      
                      <TouchableOpacity
                        style={styles.activityCard}
                        onPress={() => router.push({
                          pathname: '/activity-detail',
                          params: {
                            activityId: activity.activityId,
                            taskId,
                            supervisorId,
                          }
                        })}
                        activeOpacity={0.7}
                      >
                        <View style={styles.activityHeader}>
                          <Text style={styles.activityName}>{activity.activityName}</Text>
                          <View style={styles.percentageBadge}>
                            <Text style={styles.percentageBadgeText}>
                              {activity.percentage.toFixed(1)}%
                            </Text>
                          </View>
                        </View>

                        <View style={styles.progressSection}>
                          <View style={styles.progressBarBackground}>
                            <View
                              style={[
                                styles.progressBarFill,
                                { width: `${Math.min(activity.percentage, 100)}%` }
                              ]}
                            />
                          </View>
                        </View>

                        <View style={styles.activityFooter}>
                          <View style={styles.footerStat}>
                            <Text style={styles.footerLabel}>QC Value</Text>
                            <Text style={styles.footerValue}>
                              {activity.qcValue.toFixed(1)} {activity.unit}
                            </Text>
                          </View>
                          <View style={styles.footerDivider} />
                          <View style={styles.footerStat}>
                            <Text style={styles.footerLabel}>Allocated Scope</Text>
                            <Text style={styles.footerValue}>
                              {activity.scopeValue.toFixed(1)} {activity.unit}
                            </Text>
                          </View>
                        </View>
                        
                        {modulesInside.length > 0 && (
                          <View style={styles.microModulesInside}>
                            {modulesInside.map((module) => {
                              if (module === 'QC_REQUEST') {
                                return (
                                  <TouchableOpacity
                                    key={`qc-${activity.activityId}`}
                                    style={styles.qcRequestButtonInside}
                                    onPress={() => {
                                      Alert.alert('QC Request', `Request QC for ${activity.activityName}`);
                                    }}
                                    activeOpacity={0.7}
                                  >
                                    <ClipboardCheck size={18} color="#10b981" strokeWidth={2.5} />
                                    <Text style={styles.qcRequestButtonInsideText}>Request QC Inspection</Text>
                                  </TouchableOpacity>
                                );
                              }
                              return null;
                            })}
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </View>
          </View>
        )}
      </ScrollView>

      <HandoverCard
        visible={handoverModalVisible}
        onClose={() => setHandoverModalVisible(false)}
        onSelectSupervisor={handleSelectCommissioningSupervisor}
        matchingSupervisors={matchingSupervisors}
        isLoading={isLoadingSupervisors}
        activityName="Commissioning"
        pvArea={pvArea || ''}
        blockNumber={blockNumber || ''}
      />

      <BottomTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
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
    backgroundColor: '#000000',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  loadingContainer: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#A0A0A0',
    marginTop: 16,
  },
  errorContainer: {
    margin: 20,
    padding: 24,
    backgroundColor: '#fee',
    borderRadius: 12,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#c62828',
    textAlign: 'center',
  },
  emptyState: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#A0A0A0',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666666',
    marginTop: 8,
    textAlign: 'center',
  },
  activitiesContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  activityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  activityName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#202124',
    flex: 1,
    marginRight: 10,
  },
  percentageBadge: {
    backgroundColor: '#e8f0fe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  percentageBadgeText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#4285F4',
  },
  progressSection: {
    marginBottom: 10,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: '#e8eaed',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4285F4',
    borderRadius: 3,
  },
  activityFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e8eaed',
  },
  footerStat: {
    flex: 1,
    alignItems: 'center',
  },
  footerDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#e8eaed',
  },
  footerLabel: {
    fontSize: 11,
    color: '#666666',
    marginBottom: 3,
  },
  footerValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#202124',
  },
  activitiesSection: {
    gap: 10,
  },
  activityWrapper: {
    marginBottom: 10,
  },
  microModulesAbove: {
    marginBottom: 8,
    gap: 8,
  },
  microModulesInside: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e8eaed',
    gap: 8,
  },
  commissioningHandoverSection: {
    marginBottom: 16,
  },
  commissioningHandoverCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  commissioningHandoverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  commissioningHandoverHeaderText: {
    flex: 1,
  },
  commissioningHandoverTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#065f46',
    marginBottom: 2,
  },
  commissioningHandoverSubtitle: {
    fontSize: 13,
    color: '#047857',
    fontWeight: '500' as const,
  },
  commissioningHandoverDescription: {
    fontSize: 14,
    color: '#065f46',
    lineHeight: 20,
    marginBottom: 16,
  },
  commissioningHandoverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  commissioningHandoverButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#fff',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#202124',
    marginBottom: 12,
    marginTop: 8,
    paddingHorizontal: 4,
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
  qcRequestButtonInside: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0fdf4',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  qcRequestButtonInsideText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#065f46',
  },

  taskProgressCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  taskProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  taskProgressTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#202124',
  },
  taskProgressLabels: {
    alignItems: 'flex-end',
    gap: 4,
  },
  taskProgressLabelSmall: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: '#5f6368',
    textTransform: 'uppercase',
  },
  taskProgressPercentages: {
    flexDirection: 'row',
    gap: 24,
  },
  taskProgressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskProgressLeft: {
    flex: 1,
    gap: 4,
  },
  taskProgressDetail: {
    fontSize: 14,
    color: '#5f6368',
  },
  taskProgressPercentagesValues: {
    flexDirection: 'row',
    gap: 24,
    alignItems: 'center',
  },
  taskProgressPercentVerified: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#34A853',
  },
  taskProgressPercentUnverified: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#FBBC04',
  },
});
