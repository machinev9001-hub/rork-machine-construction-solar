import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { CheckCircle2, Clock, ChevronDown, ChevronUp } from 'lucide-react-native';
import { SupervisorScopeProgress, BOQProgress } from '@/utils/progressCalculations';
import { useRouter } from 'expo-router';
import WeeklyProgressChart from './WeeklyProgressChart';

export type ViewType = 'TASKS_PROGRESS' | 'ACTIVITY_PROGRESS' | 'BOQ_PROGRESS';
export type FilterLevel = 'ALL' | 'PV_AREA' | 'PV_AREA_BLOCK' | 'SUPERVISOR';

interface FilterState {
  level: FilterLevel;
  pvAreaId?: string;
  blockAreaId?: string;
  supervisorId?: string;
}

interface Props {
  siteId: string;
  data: SupervisorScopeProgress[];
  viewType: ViewType;
  filter: FilterState;
  pvAreas: { id: string; name: string }[];
  blockAreas: { id: string; name: string; pvAreaId: string }[];
  supervisors: { id: string; name: string; role: string }[];
  boqProgress?: BOQProgress | null;
}

export default function ProgressViewDashboard({ siteId, data, viewType, filter, pvAreas, blockAreas, supervisors, boqProgress }: Props) {
  const router = useRouter();
  const [expandedSupervisors, setExpandedSupervisors] = useState<Set<string>>(new Set());

  const toggleSupervisor = (supervisorId: string) => {
    setExpandedSupervisors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(supervisorId)) {
        newSet.delete(supervisorId);
      } else {
        newSet.add(supervisorId);
      }
      return newSet;
    });
  };

  const filteredData = useMemo(() => {
    console.log('[ProgressView] Filtering data with filter:', filter);
    console.log('[ProgressView] Available data:', data.length, 'supervisors');
    console.log('[ProgressView] PV Areas:', pvAreas.map(p => `${p.id}:${p.name}`).join(', '));
    console.log('[ProgressView] Block Areas:', blockAreas.map(b => `${b.id}:${b.name}`).join(', '));
    
    if (filter.level === 'SUPERVISOR') {
      if (filter.supervisorId) {
        const filtered = data.filter(supervisor => supervisor.supervisorId === filter.supervisorId);
        console.log('[ProgressView] Filtered by supervisor ID:', filter.supervisorId, '→', filtered.length, 'results');
        return filtered;
      }
      console.log('[ProgressView] Filter level is SUPERVISOR but no supervisorId selected → returning all data');
      return data;
    }
    
    if (filter.level === 'ALL') {
      console.log('[ProgressView] Filter level is ALL → returning all data');
      return data;
    }

    const selectedPvAreaName = pvAreas.find(p => p.id === filter.pvAreaId)?.name;
    const selectedBlockName = blockAreas.find(b => b.id === filter.blockAreaId)?.name;
    
    console.log('[ProgressView] Selected PV Area:', filter.pvAreaId, '→', selectedPvAreaName);
    console.log('[ProgressView] Selected Block:', filter.blockAreaId, '→', selectedBlockName);

    return data.map(supervisor => {
      console.log('[ProgressView] Processing supervisor:', supervisor.supervisorName, '| Tasks:', supervisor.taskBreakdown.length);
      
      const filteredTasks = supervisor.taskBreakdown.filter(task => {
        const parts = task.taskName.split(' - ');
        const taskPvArea = parts[0] || '';
        const taskBlockNumber = parts[1] || '';
        
        console.log(`[ProgressView]   Task: "${task.taskName}" → PV Area: "${taskPvArea}" | Block: "${taskBlockNumber}"`);

        const matchesPvArea = filter.level === 'ALL' || !filter.pvAreaId || taskPvArea === selectedPvAreaName;
        const matchesBlock = filter.level !== 'PV_AREA_BLOCK' || !filter.blockAreaId || taskBlockNumber === selectedBlockName;
        
        console.log(`[ProgressView]     Matches PV Area: ${matchesPvArea} | Matches Block: ${matchesBlock}`);

        return matchesPvArea && matchesBlock;
      });
      
      console.log('[ProgressView]   Filtered tasks:', filteredTasks.length, '/', supervisor.taskBreakdown.length);

      if (filteredTasks.length === 0) {
        console.log('[ProgressView]   ❌ No tasks match filter → supervisor excluded');
        return null;
      }

      const totalQC = filteredTasks.reduce((sum, task) => sum + task.qcValue, 0);
      const totalUnverified = filteredTasks.reduce((sum, task) => sum + task.unverifiedValue, 0);
      const totalScope = filteredTasks.reduce((sum, task) => sum + task.scopeValue, 0);
      const percentage = totalScope > 0 ? (totalQC / totalScope) * 100 : 0;
      const unverifiedPercentage = totalScope > 0 ? (totalUnverified / totalScope) * 100 : 0;
      
      console.log('[ProgressView]   ✅ Supervisor included | QC:', percentage.toFixed(2) + '%', '| Unverified:', unverifiedPercentage.toFixed(2) + '%');

      return {
        ...supervisor,
        taskBreakdown: filteredTasks,
        totalQCValue: totalQC,
        totalUnverifiedValue: totalUnverified,
        totalAllocatedScope: totalScope,
        percentage: Math.min(percentage, 100),
        unverifiedPercentage: Math.min(unverifiedPercentage, 100),
      };
    }).filter(Boolean) as SupervisorScopeProgress[];
  }, [data, filter, pvAreas, blockAreas]);

  const aggregatedActivityData = useMemo(() => {
    if (viewType !== 'ACTIVITY_PROGRESS') return [];

    const activityMap = new Map<string, {
      mainMenu: string;
      qc: number;
      unverified: number;
      scope: number;
    }>();

    filteredData.forEach(supervisor => {
      Object.entries(supervisor.byMainMenu).forEach(([mainMenu, menuData]) => {
        const existing = activityMap.get(mainMenu);
        if (existing) {
          existing.qc += menuData.qc;
          existing.unverified += menuData.unverified;
          existing.scope += menuData.scope;
        } else {
          activityMap.set(mainMenu, {
            mainMenu,
            qc: menuData.qc,
            unverified: menuData.unverified,
            scope: menuData.scope,
          });
        }
      });
    });

    return Array.from(activityMap.values()).map(activity => ({
      ...activity,
      qcPercentage: activity.scope > 0 ? (activity.qc / activity.scope) * 100 : 0,
      unverifiedPercentage: activity.scope > 0 ? (activity.unverified / activity.scope) * 100 : 0,
    })).sort((a, b) => b.qcPercentage - a.qcPercentage);
  }, [filteredData, viewType]);

  const handleSupervisorPress = (supervisor: SupervisorScopeProgress) => {
    router.push({
      pathname: '/user-progress-detail',
      params: {
        supervisorId: supervisor.supervisorId,
        supervisorName: supervisor.supervisorName,
      }
    } as any);
  };

  const getHeaderTitle = () => {
    if (filter.level === 'ALL') return 'All Progress';
    if (filter.level === 'SUPERVISOR') return 'Supervisor Progress';
    if (filter.level === 'PV_AREA') {
      const pvAreaName = pvAreas.find(p => p.id === filter.pvAreaId)?.name;
      return pvAreaName ? `PV Area ${pvAreaName}` : 'PV Area Progress';
    }
    if (filter.level === 'PV_AREA_BLOCK') {
      const pvAreaName = pvAreas.find(p => p.id === filter.pvAreaId)?.name;
      const blockName = blockAreas.find(b => b.id === filter.blockAreaId)?.name;
      if (pvAreaName && blockName) return `${pvAreaName} - Block ${blockName}`;
      if (pvAreaName) return `PV Area ${pvAreaName}`;
      return 'PV Area + Block Progress';
    }
    return 'Progress';
  };

  if (viewType === 'TASKS_PROGRESS') {
    return (
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <WeeklyProgressChart siteId={siteId} />
        
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{getHeaderTitle()}</Text>
          <Text style={styles.headerSubtitle}>
            {filteredData.length} {filteredData.length === 1 ? 'supervisor' : 'supervisors'}
          </Text>
        </View>

        {filteredData.length === 0 ? (
          <View style={styles.emptyState}>
            <Clock size={48} color="#9ca3af" strokeWidth={1.5} />
            <Text style={styles.emptyStateText}>No data available</Text>
            <Text style={styles.emptyStateSubtext}>
              {(filter.level !== 'ALL' && filter.level !== 'SUPERVISOR')
                ? 'Try adjusting your filters'
                : 'Progress data will appear here once supervisors log activities'}
            </Text>
          </View>
        ) : (
          <View style={styles.cardsContainer}>
            {filteredData.map((supervisor) => {
              const isExpanded = expandedSupervisors.has(supervisor.supervisorId);
              return (
                <View key={supervisor.supervisorId} style={styles.supervisorCard}>
                  <TouchableOpacity
                    onPress={() => toggleSupervisor(supervisor.supervisorId)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.supervisorHeader}>
                      <View style={styles.supervisorAvatar}>
                        <Text style={styles.supervisorAvatarText}>
                          {supervisor.supervisorName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.supervisorInfo}>
                        <Text style={styles.supervisorName}>{supervisor.supervisorName}</Text>
                        <Text style={styles.supervisorStats}>
                          {supervisor.taskBreakdown.length} {supervisor.taskBreakdown.length === 1 ? 'task' : 'tasks'} • {supervisor.activitiesCount} {supervisor.activitiesCount === 1 ? 'activity' : 'activities'}
                        </Text>
                      </View>
                      {isExpanded ? (
                        <ChevronUp size={24} color="#5f6368" strokeWidth={2} />
                      ) : (
                        <ChevronDown size={24} color="#5f6368" strokeWidth={2} />
                      )}
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <TouchableOpacity
                      onPress={() => handleSupervisorPress(supervisor)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.progressSection}>
                  {(() => {
                    const boqQCValue = supervisor.boqQCValue || 0;
                    const boqUnverifiedValue = supervisor.boqUnverifiedValue || 0;
                    const boqScope = boqProgress?.totalBOQScope || 0;
                    const boqQCPercentage = boqScope > 0 ? (boqQCValue / boqScope) * 100 : 0;
                    const boqUnverifiedPercentage = boqScope > 0 ? (boqUnverifiedValue / boqScope) * 100 : 0;
                    const hasBOQ = boqScope > 0;

                    return (
                      <>
                        {hasBOQ && (
                          <View style={styles.scopeTypeSection}>
                            <Text style={styles.scopeTypeHeader}>BOQ</Text>
                            <View style={styles.progressGrid}>
                              <View style={styles.progressGridCell}>
                                <View style={styles.progressHeader}>
                                  <CheckCircle2 size={14} color="#34A853" strokeWidth={2} />
                                  <Text style={styles.progressLabel}>QC Verified</Text>
                                </View>
                                <Text style={styles.progressValue}>{boqQCPercentage.toFixed(1)}%</Text>
                                <View style={styles.progressBarBackground}>
                                  <View 
                                    style={[
                                      styles.progressBarFill,
                                      styles.progressBarQC,
                                      { width: `${Math.min(boqQCPercentage, 100)}%` }
                                    ]} 
                                  />
                                </View>
                                <Text style={styles.progressStats}>
                                  {boqQCValue.toFixed(1)} / {boqScope.toFixed(1)}
                                </Text>
                              </View>

                              <View style={styles.progressGridCell}>
                                <View style={styles.progressHeader}>
                                  <Clock size={14} color="#FBBC04" strokeWidth={2} />
                                  <Text style={styles.progressLabel}>Unverified</Text>
                                </View>
                                <Text style={styles.progressValue}>{boqUnverifiedPercentage.toFixed(1)}%</Text>
                                <View style={styles.progressBarBackground}>
                                  <View 
                                    style={[
                                      styles.progressBarFill,
                                      styles.progressBarUnverified,
                                      { width: `${Math.min(boqUnverifiedPercentage, 100)}%` }
                                    ]} 
                                  />
                                </View>
                                <Text style={styles.progressStats}>
                                  {boqUnverifiedValue.toFixed(1)} / {boqScope.toFixed(1)}
                                </Text>
                              </View>
                            </View>
                          </View>
                        )}

                        {supervisor.totalAllocatedScope > 0 && (
                          <View style={[styles.scopeTypeSection, hasBOQ && styles.scopeTypeSectionWithMargin]}>
                            <Text style={styles.scopeTypeHeader}>Local Scope</Text>
                            <View style={styles.progressGrid}>
                              <View style={styles.progressGridCell}>
                                <View style={styles.progressHeader}>
                                  <CheckCircle2 size={14} color="#34A853" strokeWidth={2} />
                                  <Text style={styles.progressLabel}>QC Verified</Text>
                                </View>
                                <Text style={styles.progressValue}>{supervisor.percentage.toFixed(1)}%</Text>
                                <View style={styles.progressBarBackground}>
                                  <View 
                                    style={[
                                      styles.progressBarFill,
                                      styles.progressBarQC,
                                      { width: `${Math.min(supervisor.percentage, 100)}%` }
                                    ]} 
                                  />
                                </View>
                                <Text style={styles.progressStats}>
                                  {supervisor.totalQCValue.toFixed(1)} / {supervisor.totalAllocatedScope.toFixed(1)}
                                </Text>
                              </View>

                              <View style={styles.progressGridCell}>
                                <View style={styles.progressHeader}>
                                  <Clock size={14} color="#FBBC04" strokeWidth={2} />
                                  <Text style={styles.progressLabel}>Unverified</Text>
                                </View>
                                <Text style={styles.progressValue}>{supervisor.unverifiedPercentage.toFixed(1)}%</Text>
                                <View style={styles.progressBarBackground}>
                                  <View 
                                    style={[
                                      styles.progressBarFill,
                                      styles.progressBarUnverified,
                                      { width: `${Math.min(supervisor.unverifiedPercentage, 100)}%` }
                                    ]} 
                                  />
                                </View>
                                <Text style={styles.progressStats}>
                                  {supervisor.totalUnverifiedValue.toFixed(1)} / {supervisor.totalAllocatedScope.toFixed(1)}
                                </Text>
                              </View>
                            </View>
                          </View>
                        )}
                      </>
                    );
                  })()}
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    );
  }

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Activity Progress</Text>
        <Text style={styles.headerSubtitle}>
          Progress breakdown by main activity type
        </Text>
      </View>

      {aggregatedActivityData.length === 0 ? (
        <View style={styles.emptyState}>
          <Clock size={48} color="#9ca3af" strokeWidth={1.5} />
          <Text style={styles.emptyStateText}>No activity data available</Text>
          <Text style={styles.emptyStateSubtext}>
            {(filter.level !== 'ALL' && filter.level !== 'SUPERVISOR')
              ? 'Try adjusting your filters'
              : 'Activity data will appear here once work begins'}
          </Text>
        </View>
      ) : (
        <View style={styles.cardsContainer}>
          {aggregatedActivityData.map((activity) => (
            <View key={activity.mainMenu} style={styles.activityCard}>
              <View style={styles.activityHeader}>
                <Text style={styles.activityName}>
                  {activity.mainMenu.charAt(0).toUpperCase() + activity.mainMenu.slice(1)}
                </Text>
              </View>

              <View style={styles.progressSection}>
                <View style={styles.progressRow}>
                  <View style={styles.progressColumn}>
                    <View style={styles.progressHeader}>
                      <CheckCircle2 size={16} color="#34A853" strokeWidth={2} />
                      <Text style={styles.progressLabel}>QC Verified</Text>
                    </View>
                    <Text style={styles.progressValue}>{activity.qcPercentage.toFixed(2)}%</Text>
                    <View style={styles.progressBarBackground}>
                      <View 
                        style={[
                          styles.progressBarFill,
                          styles.progressBarQC,
                          { width: `${Math.min(activity.qcPercentage, 100)}%` }
                        ]} 
                      />
                    </View>
                    <Text style={styles.progressStats}>
                      {activity.qc.toFixed(2)} / {activity.scope.toFixed(2)}
                    </Text>
                  </View>

                  <View style={styles.progressDivider} />

                  <View style={styles.progressColumn}>
                    <View style={styles.progressHeader}>
                      <Clock size={16} color="#FBBC04" strokeWidth={2} />
                      <Text style={styles.progressLabel}>Unverified</Text>
                    </View>
                    <Text style={styles.progressValue}>{activity.unverifiedPercentage.toFixed(2)}%</Text>
                    <View style={styles.progressBarBackground}>
                      <View 
                        style={[
                          styles.progressBarFill,
                          styles.progressBarUnverified,
                          { width: `${Math.min(activity.unverifiedPercentage, 100)}%` }
                        ]} 
                      />
                    </View>
                    <Text style={styles.progressStats}>
                      {activity.unverified.toFixed(2)} / {activity.scope.toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    padding: 24,
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#202124',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#5f6368',
  },
  cardsContainer: {
    gap: 16,
  },
  supervisorCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e8eaed',
  },
  supervisorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  supervisorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  supervisorAvatarText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#ffffff',
  },
  supervisorInfo: {
    flex: 1,
  },
  supervisorName: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#202124',
    marginBottom: 4,
  },
  supervisorStats: {
    fontSize: 13,
    color: '#5f6368',
  },
  activityCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e8eaed',
  },
  activityHeader: {
    marginBottom: 20,
  },
  activityName: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#202124',
  },
  progressSection: {
    marginTop: 4,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 20,
  },
  progressColumn: {
    flex: 1,
  },
  scopeTypeSection: {
    marginBottom: 8,
  },
  scopeTypeSectionWithMargin: {
    marginTop: 12,
  },
  scopeTypeHeader: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#5f6368',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 12,
  },
  progressGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  progressGridCell: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#5f6368',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  progressValue: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#202124',
    marginBottom: 12,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#e8eaed',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressBarQC: {
    backgroundColor: '#34A853',
  },
  progressBarUnverified: {
    backgroundColor: '#FBBC04',
  },
  progressStats: {
    fontSize: 12,
    color: '#80868b',
    fontWeight: '500' as const,
  },
  progressDivider: {
    width: 1,
    backgroundColor: '#e8eaed',
    marginVertical: 8,
  },
  emptyState: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 18,
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
    maxWidth: 300,
  },
});
