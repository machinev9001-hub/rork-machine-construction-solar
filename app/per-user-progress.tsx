import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { ArrowLeft, List } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { ActivityModuleConfig } from '@/types';
import { useTheme } from '@/utils/hooks/useTheme';

type ActivityProgress = {
  taskId: string;
  taskName: string;
  activityId: string;
  activityName: string;
  qcValue: number;
  unverifiedValue: number;
  scopeValue: number;
  boqValue: number;
  percentage: number;
  unverifiedPercentage: number;
  boqPercentage: number;
  boqUnverifiedPercentage: number;
  unit: string;
  pvArea?: string;
  blockNumber?: string;
};

const LEGACY_SUBMENU_MAP: Record<string, string> = {
  foundations: 'foundation',
};

function normalizeSubMenuKey(key: string): string {
  const normalized = key.toLowerCase().trim();
  return LEGACY_SUBMENU_MAP[normalized] ?? normalized;
}

async function fetchActivitiesBySubMenu(
  siteId: string,
  supervisorId: string,
  subMenuKey: string
): Promise<ActivityProgress[]> {
  console.log('\n🔍 ============================================== 🔍');
  console.log('🔍 ACTIVITIES BY SUB-MENU - START');
  console.log('🔍 Site ID:', siteId);
  console.log('🔍 Supervisor ID:', supervisorId);
  console.log('🔍 Sub-Menu:', subMenuKey);
  console.log('🔍 ============================================== 🔍\n');

  try {
    const tasksRef = collection(db, 'tasks');
    const tasksQuery = query(tasksRef, where('siteId', '==', siteId));
    const tasksSnapshot = await getDocs(tasksQuery);
    
    const taskMap = new Map<string, { name: string; pvArea?: string; blockNumber?: string }>();
    tasksSnapshot.docs.forEach(doc => {
      const taskData = doc.data();
      taskMap.set(doc.id, {
        name: taskData.name || 'Unnamed Task',
        pvArea: taskData.pvArea,
        blockNumber: taskData.blockArea,
      });
    });
    
    const taskIds = Array.from(taskMap.keys());

    console.log('🔍 Found', taskIds.length, 'tasks for site');

    if (taskIds.length === 0) {
      console.log('🔍 No tasks found, returning empty result\n');
      return [];
    }

    const allActivities: any[] = [];
    for (let i = 0; i < taskIds.length; i += 10) {
      const batch = taskIds.slice(i, i + 10);
      const activitiesRef = collection(db, 'activities');
      const activitiesQuery = query(activitiesRef, where('taskId', 'in', batch));
      const activitiesSnapshot = await getDocs(activitiesQuery);
      allActivities.push(...activitiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }

    console.log('🔍 Found', allActivities.length, 'activities for site\n');

    const activities: ActivityProgress[] = [];

    for (const activity of allActivities) {
      const activitySupervisorId = activity.supervisorInputBy || '';
      const taskId = activity.taskId || '';
      const activitySubMenuKey = normalizeSubMenuKey(activity.subMenuKey || '');

      if (activitySupervisorId !== supervisorId) {
        console.log('   ❌ SKIPPED | Activity:', activity.name, '| Different supervisor');
        continue;
      }

      if (activitySubMenuKey !== subMenuKey) {
        console.log('   ❌ SKIPPED | Activity:', activity.name, '| Different sub-menu');
        continue;
      }

      let scopeValue = typeof activity.scopeValue === 'number'
        ? activity.scopeValue
        : (activity.scopeValue?.value || 0);
      let qcValue = activity.qcValue || activity.qc?.value || 0;
      let unverifiedValue = activity.supervisorInputValue || 0;
      const isHandoff = activity.cablingHandoff || activity.terminationHandoff;

      const moduleConfig = activity.moduleConfig as ActivityModuleConfig | undefined;
      const isGridBased = moduleConfig?.baseBlockType === 'GRID_TYPE_ROW_PROGRESS';

      if (isGridBased && moduleConfig?.gridConfig) {
        console.log('   🔷 GRID-BASED ACTIVITY detected:', activity.name);
        
        const gridProgressRef = collection(db, 'gridCellProgress');
        const gridProgressQuery = query(
          gridProgressRef,
          where('activityId', '==', activity.id),
          where('taskId', '==', taskId),
          where('siteId', '==', siteId)
        );
        const gridProgressSnapshot = await getDocs(gridProgressQuery);
        
        const completedCells = gridProgressSnapshot.docs.filter(
          doc => doc.data().status === 'completed'
        );
        const valuePerCell = moduleConfig.gridConfig.scopeValue || 1;
        const totalCells = (moduleConfig.gridConfig.flexibleColumns || []).reduce(
          (sum, col) => sum + col.rows, 0
        );
        
        qcValue = completedCells.filter(doc => !doc.data().isLocked).length * valuePerCell;
        unverifiedValue = completedCells.length * valuePerCell;
        scopeValue = totalCells * valuePerCell;
      }

      const boqQuantity = moduleConfig?.boqQuantity || 0;
      
      if (!isHandoff && scopeValue > 0) {
        const percentage = scopeValue > 0 ? (qcValue / scopeValue) * 100 : 0;
        const unverifiedPercentage = scopeValue > 0 ? (unverifiedValue / scopeValue) * 100 : 0;
        const boqPercentage = boqQuantity > 0 ? (qcValue / boqQuantity) * 100 : 0;
        const boqUnverifiedPercentage = boqQuantity > 0 ? (unverifiedValue / boqQuantity) * 100 : 0;
        const taskInfo = taskMap.get(taskId);
        const unit = typeof activity.unit === 'string' 
          ? activity.unit 
          : activity.unit?.canonical || 'm';

        activities.push({
          taskId,
          taskName: taskInfo?.name || 'Unnamed Task',
          activityId: activity.id,
          activityName: activity.name || 'Unnamed Activity',
          qcValue,
          unverifiedValue,
          scopeValue,
          boqValue: boqQuantity,
          percentage: Math.min(percentage, 100),
          unverifiedPercentage: Math.min(unverifiedPercentage, 100),
          boqPercentage: Math.min(boqPercentage, 100),
          boqUnverifiedPercentage: Math.min(boqUnverifiedPercentage, 100),
          unit,
          pvArea: taskInfo?.pvArea,
          blockNumber: taskInfo?.blockNumber,
        });

        console.log('   ✅ INCLUDED | Activity:', activity.name, '| Local Scope:', percentage.toFixed(2), '% | BOQ:', boqPercentage.toFixed(2), '%');
      }
    }

    activities.sort((a, b) => b.percentage - a.percentage);

    console.log('\n🔍 ============================================== 🔍');
    console.log('🔍 ACTIVITIES BY SUB-MENU - FINAL RESULT');
    console.log('🔍 Total Activities:', activities.length);
    activities.forEach(item => {
      console.log(`🔍 ${item.taskName} - ${item.activityName}: ${item.percentage.toFixed(2)}% (${item.qcValue.toFixed(2)}/${item.scopeValue.toFixed(2)} ${item.unit})`);
    });
    console.log('🔍 ============================================== 🔍\n');

    return activities;
  } catch (error) {
    console.error('❌ ACTIVITIES BY SUB-MENU - ERROR:', error);
    return [];
  }
}

export default function PerUserProgressScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const supervisorId = params.supervisorId as string;
  const supervisorName = params.supervisorName as string;
  const subMenuKey = normalizeSubMenuKey((params.subMenuKey as string) ?? '');
  const subMenuName = params.subMenuName as string;

  console.log('🔍 ACTIVITIES SCREEN - Params:');
  console.log('   supervisorId:', supervisorId);
  console.log('   supervisorName:', supervisorName);
  console.log('   subMenuKey:', subMenuKey);
  console.log('   subMenuName:', subMenuName);
  
  const { data: activities, isLoading, error } = useQuery({
    queryKey: ['activitiesBySubMenu', user?.siteId, supervisorId, subMenuKey],
    queryFn: () => fetchActivitiesBySubMenu(user?.siteId!, supervisorId, subMenuKey),
    enabled: !!user?.siteId && !!supervisorId && !!subMenuKey,
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: subMenuName || 'Activities',
          headerStyle: {
            backgroundColor: theme.surface,
          },
          headerTintColor: theme.text,
          headerTitleStyle: {
            fontWeight: '600' as const,
          },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft size={24} color={theme.text} strokeWidth={2} />
            </TouchableOpacity>
          ),
        }}
      />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.header, { backgroundColor: theme.cardBg }]}>
          <List size={24} color="#4285F4" strokeWidth={2.5} />
          <Text style={[styles.headerTitle, { color: theme.background }]}>Activities Progress</Text>
        </View>

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4285F4" />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading activities...</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Failed to load activities</Text>
          </View>
        )}

        {!isLoading && !error && activities && (
          <View style={styles.activitiesContainer}>
            {activities.length === 0 ? (
              <View style={styles.emptyState}>
                <List size={48} color="#9ca3af" strokeWidth={1.5} />
                <Text style={styles.emptyStateText}>No activities available</Text>
                <Text style={styles.emptyStateSubtext}>
                  Activities will appear here once work is logged
                </Text>
              </View>
            ) : (
              activities.map((activity) => (
                <TouchableOpacity 
                  key={activity.activityId} 
                  style={[styles.activityCard, { backgroundColor: theme.cardBg }]}
                  onPress={() => router.push({
                    pathname: '/activity-detail',
                    params: { 
                      activityId: activity.activityId,
                      taskId: activity.taskId,
                      supervisorId,
                    }
                  })}
                  activeOpacity={0.7}
                >
                  <View style={styles.activityCardHeader}>
                    <View style={styles.activityInfo}>
                      <Text style={styles.taskLabel}>{activity.taskName}</Text>
                      <Text style={[styles.activityName, { color: theme.background }]}>{activity.activityName}</Text>
                    </View>
                  </View>

                  <View style={styles.activityProgressSection}>
                    {activity.boqValue > 0 && (
                      <View style={styles.scopeTypeSection}>
                        <Text style={styles.scopeTypeHeader}>BOQ</Text>
                        <View style={styles.gridRow}>
                          <View style={styles.gridCell}>
                            <Text style={styles.gridCellLabel}>QC VERIFIED</Text>
                            <Text style={styles.gridCellValue}>{activity.boqPercentage.toFixed(1)}%</Text>
                            <Text style={styles.gridCellStats}>
                              {activity.qcValue.toFixed(1)} / {activity.boqValue.toFixed(1)} {activity.unit}
                            </Text>
                          </View>
                          <View style={styles.gridCell}>
                            <Text style={styles.gridCellLabel}>UNVERIFIED</Text>
                            <Text style={styles.gridCellValue}>{activity.boqUnverifiedPercentage.toFixed(1)}%</Text>
                            <Text style={styles.gridCellStats}>
                              {activity.unverifiedValue.toFixed(1)} / {activity.boqValue.toFixed(1)} {activity.unit}
                            </Text>
                          </View>
                        </View>
                      </View>
                    )}

                    {activity.scopeValue > 0 && (
                      <View style={[styles.scopeTypeSection, { marginTop: activity.boqValue > 0 ? 12 : 0 }]}>
                        <Text style={styles.scopeTypeHeader}>Local Scope</Text>
                        <View style={styles.gridRow}>
                          <View style={styles.gridCell}>
                            <Text style={styles.gridCellLabel}>QC VERIFIED</Text>
                            <Text style={styles.gridCellValue}>{activity.percentage.toFixed(1)}%</Text>
                            <Text style={styles.gridCellStats}>
                              {activity.qcValue.toFixed(1)} / {activity.scopeValue.toFixed(1)} {activity.unit}
                            </Text>
                          </View>
                          <View style={styles.gridCell}>
                            <Text style={styles.gridCellLabel}>UNVERIFIED</Text>
                            <Text style={styles.gridCellValue}>{activity.unverifiedPercentage.toFixed(1)}%</Text>
                            <Text style={styles.gridCellStats}>
                              {activity.unverifiedValue.toFixed(1)} / {activity.scopeValue.toFixed(1)} {activity.unit}
                            </Text>
                          </View>
                        </View>
                      </View>
                    )}

                    {!activity.boqValue && activity.scopeValue === 0 && (
                      <View style={styles.noScopeContainer}>
                        <Text style={styles.noScopeText}>No BOQ or Local Scope set</Text>
                      </View>
                    )}
                  </View>

                </TouchableOpacity>
              ))
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
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#202124',
    letterSpacing: -0.3,
  },
  loadingContainer: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#5f6368',
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
    color: '#5f6368',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
  },
  activitiesContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 14,
  },
  activityCard: {
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  activityCardHeader: {
    marginBottom: 16,
  },
  activityInfo: {
    flex: 1,
  },
  taskLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: '#5f6368',
    marginBottom: 4,
  },
  activityName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#202124',
  },
  activityProgressSection: {
    gap: 16,
  },
  scopeTypeSection: {
    marginBottom: 8,
  },
  scopeTypeHeader: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#202124',
    marginBottom: 12,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  gridCell: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e8eaed',
  },
  gridCellLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: '#5f6368',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  gridCellValue: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: '#202124',
    marginBottom: 4,
  },
  gridCellStats: {
    fontSize: 11,
    color: '#80868b',
  },
  noScopeContainer: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  noScopeText: {
    fontSize: 13,
    color: '#9aa0a6',
    fontStyle: 'italic' as const,
  },
  activityProgressItem: {
    flex: 1,
  },
  activityProgressLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: '#5f6368',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  activityProgressPercent: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: '#202124',
    marginBottom: 8,
  },
  activityProgressBar: {
    height: 6,
    backgroundColor: '#e8eaed',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  activityProgressFillVerified: {
    height: '100%',
    backgroundColor: '#34A853',
    borderRadius: 3,
  },
  activityProgressFillUnverified: {
    height: '100%',
    backgroundColor: '#FBBC04',
    borderRadius: 3,
  },
  activityProgressStats: {
    fontSize: 11,
    color: '#80868b',
    fontWeight: '500' as const,
  },
  activityProgressDivider: {
    width: 1,
    backgroundColor: '#e8eaed',
  },
});
