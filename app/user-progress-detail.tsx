import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { ArrowLeft, FolderTree, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { calculatePerUserScopeProgress, calculateBOQProgress } from '@/utils/progressCalculations';
import React from 'react';
import { useTheme } from '@/utils/hooks/useTheme';



export default function UserProgressDetailScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const supervisorId = params.supervisorId as string;
  const supervisorName = params.supervisorName as string;

  const { data: userProgressData, isLoading: isLoadingProgress, error: progressError } = useQuery({
    queryKey: ['userTaskProgress', user?.siteId, supervisorId],
    queryFn: async () => {
      if (!user?.siteId) return null;
      const allProgress = await calculatePerUserScopeProgress(user.siteId);
      return allProgress.find(p => p.supervisorId === supervisorId) || null;
    },
    enabled: !!user?.siteId && !!supervisorId,
  });

  const byMainMenu = React.useMemo(() => userProgressData?.byMainMenu || {}, [userProgressData]);
  const [boqProgressData, setBoqProgressData] = React.useState<Record<string, { qcVerified: number; unverified: number; boqScope: number }>>({});
  const [expandedMenus, setExpandedMenus] = React.useState<Set<string>>(new Set());

  const toggleMenu = (menuKey: string) => {
    setExpandedMenus(prev => {
      const newSet = new Set(prev);
      if (newSet.has(menuKey)) {
        newSet.delete(menuKey);
      } else {
        newSet.add(menuKey);
      }
      return newSet;
    });
  };

  const { data: boqProgress } = useQuery({
    queryKey: ['boqProgress', user?.siteId],
    queryFn: async () => {
      if (!user?.siteId) return null;
      return await calculateBOQProgress(user.siteId);
    },
    enabled: !!user?.siteId,
  });

  React.useEffect(() => {
    if (boqProgress && userProgressData) {
      const boqData: Record<string, { qcVerified: number; unverified: number; boqScope: number }> = {};
      Object.keys(byMainMenu).forEach(mainMenuKey => {
        const boqMainMenuData = boqProgress.byMainMenu[mainMenuKey];
        if (boqMainMenuData) {
          boqData[mainMenuKey] = {
            qcVerified: boqMainMenuData.qc || 0,
            unverified: boqMainMenuData.unverified || 0,
            boqScope: boqMainMenuData.boqScope || 0,
          };
        } else {
          boqData[mainMenuKey] = { qcVerified: 0, unverified: 0, boqScope: 0 };
        }
      });
      setBoqProgressData(boqData);
    }
  }, [boqProgress, userProgressData, byMainMenu]);
  const supervisorTasks = userProgressData?.taskBreakdown || [];

  console.log('[UserProgress] ========== DEBUGGING ==========');
  console.log('[UserProgress] byMainMenu keys:', Object.keys(byMainMenu));
  console.log('[UserProgress] supervisorTasks count:', supervisorTasks.length);
  
  Object.entries(byMainMenu).forEach(([key, data]) => {
    console.log(`[UserProgress] Main Menu "${key}":`, {
      scope: data.scope,
      qc: data.qc,
      unverified: data.unverified,
      percentage: data.percentage
    });
  });

  const mainMenuItems = Object.entries(byMainMenu)
    .map(([menuKey, progressData]) => ({
      mainMenu: menuKey.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
      mainMenuKey: menuKey,
      qc: progressData.qc || 0,
      unverified: progressData.unverified || 0,
      scope: progressData.scope || 0,
      percentage: progressData.percentage || 0,
      unverifiedPercentage: progressData.unverifiedPercentage || 0,
    }))
    .sort((a, b) => a.mainMenu.localeCompare(b.mainMenu));
  
  console.log('[UserProgress] Final mainMenuItems:', mainMenuItems.map(item => `${item.mainMenu} (${item.percentage.toFixed(1)}%)`).join(', '));

  console.log('[UserProgress] Final mainMenuItems count:', mainMenuItems.length);
  console.log('[UserProgress] ========== END DEBUG ==========');

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: supervisorName || 'User Progress',
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
          <FolderTree size={24} color="#4285F4" strokeWidth={2.5} />
          <Text style={[styles.headerTitle, { color: theme.background }]}>Main Activities</Text>
        </View>

        {isLoadingProgress && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4285F4" />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading task breakdown...</Text>
          </View>
        )}

        {progressError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Failed to load task breakdown</Text>
          </View>
        )}

        {!isLoadingProgress && !progressError && mainMenuItems && (
          <View style={styles.mainMenuContainer}>
            {mainMenuItems.length === 0 ? (
              <View style={styles.emptyState}>
                <FolderTree size={48} color="#9ca3af" strokeWidth={1.5} />
                <Text style={styles.emptyStateText}>No activity data available</Text>
                <Text style={styles.emptyStateSubtext}>
                  Activities will appear here once work is logged
                </Text>
              </View>
            ) : (
              mainMenuItems.map((item) => {
                const isExpanded = expandedMenus.has(item.mainMenuKey);
                return (
                  <View key={item.mainMenu} style={[styles.mainMenuCard, { backgroundColor: theme.cardBg }]}>
                    <TouchableOpacity
                      onPress={() => toggleMenu(item.mainMenuKey)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.mainMenuHeader}>
                        <View style={styles.mainMenuIconContainer}>
                          <FolderTree size={28} color="#4285F4" strokeWidth={2.5} />
                        </View>
                        <View style={styles.mainMenuInfo}>
                          <Text style={[styles.mainMenuName, { color: theme.background }]}>{item.mainMenu}</Text>
                          <Text style={[styles.mainMenuSubtitle, { color: theme.textSecondary }]}>Main Activity</Text>
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
                        onPress={() => router.push({
                          pathname: '/sub-menu-detail',
                          params: {
                            supervisorId,
                            supervisorName,
                            mainMenu: item.mainMenuKey,
                            mainMenuName: item.mainMenu,
                          }
                        })}
                        activeOpacity={0.7}
                      >
                        <View style={styles.mainMenuProgressSection}>
                    {boqProgressData[item.mainMenuKey] && boqProgressData[item.mainMenuKey].boqScope > 0 && (
                      <View style={styles.scopeTypeSection}>
                        <Text style={styles.scopeTypeHeader}>BOQ</Text>
                        <View style={styles.gridRow}>
                          <View style={styles.gridCell}>
                            <Text style={styles.gridCellLabel}>QC VERIFIED</Text>
                            <Text style={styles.gridCellValue}>
                              {boqProgressData[item.mainMenuKey].boqScope > 0
                                ? ((boqProgressData[item.mainMenuKey].qcVerified / boqProgressData[item.mainMenuKey].boqScope) * 100).toFixed(1)
                                : '0.0'}%
                            </Text>
                            <Text style={styles.gridCellStats}>
                              {boqProgressData[item.mainMenuKey].qcVerified.toFixed(1)} / {boqProgressData[item.mainMenuKey].boqScope.toFixed(1)}
                            </Text>
                          </View>
                          <View style={styles.gridCell}>
                            <Text style={styles.gridCellLabel}>UNVERIFIED</Text>
                            <Text style={styles.gridCellValue}>
                              {boqProgressData[item.mainMenuKey].boqScope > 0
                                ? ((boqProgressData[item.mainMenuKey].unverified / boqProgressData[item.mainMenuKey].boqScope) * 100).toFixed(1)
                                : '0.0'}%
                            </Text>
                            <Text style={styles.gridCellStats}>
                              {boqProgressData[item.mainMenuKey].unverified.toFixed(1)} / {boqProgressData[item.mainMenuKey].boqScope.toFixed(1)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    )}

                    {item.scope > 0 && (
                      <View style={[styles.scopeTypeSection, { marginTop: boqProgressData[item.mainMenuKey]?.boqScope > 0 ? 12 : 0 }]}>
                        <Text style={styles.scopeTypeHeader}>Local Scope</Text>
                        <View style={styles.gridRow}>
                          <View style={styles.gridCell}>
                            <Text style={styles.gridCellLabel}>QC VERIFIED</Text>
                            <Text style={styles.gridCellValue}>{item.percentage.toFixed(1)}%</Text>
                            <Text style={styles.gridCellStats}>
                              {item.qc.toFixed(1)} / {item.scope.toFixed(1)}
                            </Text>
                          </View>
                          <View style={styles.gridCell}>
                            <Text style={styles.gridCellLabel}>UNVERIFIED</Text>
                            <Text style={styles.gridCellValue}>{item.unverifiedPercentage.toFixed(1)}%</Text>
                            <Text style={styles.gridCellStats}>
                              {item.unverified.toFixed(1)} / {item.scope.toFixed(1)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    )}

                          {!boqProgressData[item.mainMenuKey]?.boqScope && item.scope === 0 && (
                            <View style={styles.noScopeContainer}>
                              <Text style={styles.noScopeText}>No BOQ or Local Scope set</Text>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
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
  mainMenuContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 16,
  },
  mainMenuCard: {
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  mainMenuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  mainMenuIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#e8f0fe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainMenuInfo: {
    flex: 1,
  },
  mainMenuName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#202124',
    marginBottom: 2,
  },
  mainMenuSubtitle: {
    fontSize: 12,
    color: '#5f6368',
    fontWeight: '500' as const,
  },
  mainMenuProgressSection: {
    gap: 16,
  },
  mainMenuProgressItem: {
    flex: 1,
  },
  mainMenuProgressLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: '#5f6368',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  mainMenuProgressPercent: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: '#202124',
    marginBottom: 8,
  },
  mainMenuProgressBar: {
    height: 6,
    backgroundColor: '#e8eaed',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  mainMenuProgressFillVerified: {
    height: '100%',
    backgroundColor: '#34A853',
    borderRadius: 3,
  },
  mainMenuProgressFillUnverified: {
    height: '100%',
    backgroundColor: '#FBBC04',
    borderRadius: 3,
  },
  mainMenuProgressStats: {
    fontSize: 11,
    color: '#80868b',
    fontWeight: '500' as const,
  },
  mainMenuProgressDivider: {
    width: 1,
    backgroundColor: '#e8eaed',
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
});
