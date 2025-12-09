import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Folder } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import React from "react";
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';
import BottomTabBar from '@/components/BottomTabBar';
import { useQuery } from '@tanstack/react-query';
import { ActivityModuleConfig } from '@/types';
import { useTheme } from '@/utils/hooks/useTheme';

type MenuItemType = {
  id: string;
  siteId: string;
  masterAccountId: string;
  level: 'main' | 'sub' | 'activity';
  name: string;
  key?: string;
  parentMainMenuId?: string;
  parentSubMenuId?: string;
  sortOrder: number;
  createdAt: any;
};

type SubMenuWithProgress = {
  menuItem: MenuItemType;
  qcValue: number;
  unverifiedValue: number;
  scopeValue: number;
  boqValue: number;
  percentage: number;
  unverifiedPercentage: number;
  boqPercentage: number;
  boqUnverifiedPercentage: number;
  activityCount: number;
};

const LEGACY_SUBMENU_MAP: Record<string, string> = {
  foundations: 'foundation',
};

function normalizeSubMenuKey(key: string): string {
  const normalized = key.toLowerCase().trim();
  return LEGACY_SUBMENU_MAP[normalized] ?? normalized;
}

export default function SubMenuDetailScreen() {
  const { supervisorId, supervisorName, mainMenu, mainMenuName } = useLocalSearchParams<{
    supervisorId: string;
    supervisorName: string;
    mainMenu: string;
    mainMenuName: string;
  }>();
  const { user } = useAuth();
  const router = useRouter();
  const { theme, roleAccentColor, commonStyles } = useTheme();

  const subMenusQuery = useQuery({
    queryKey: ['supervisor-sub-menus-with-progress', user?.siteId, supervisorId, mainMenu],
    queryFn: async (): Promise<SubMenuWithProgress[]> => {
      if (!user?.siteId || !supervisorId) return [];
      
      console.log('\n🔍 ============================================== 🔍');
      console.log('🔍 SUPERVISOR SUB MENUS WITH PROGRESS');
      console.log('🔍 Site ID:', user.siteId);
      console.log('🔍 Supervisor ID:', supervisorId);
      console.log('🔍 Main Menu:', mainMenu);
      console.log('🔍 ============================================== 🔍\n');
      
      // 1. Get the main menu item
      const menusRef = collection(db, 'menuItems');
      const mainMenuQuery = query(
        menusRef,
        where('siteId', '==', user.siteId),
        where('level', '==', 'main')
      );
      const mainMenuSnapshot = await getDocs(mainMenuQuery);
      
      let mainMenuId: string | null = null;
      mainMenuSnapshot.forEach((doc) => {
        const data = doc.data();
        const menuSlug = data.name.toLowerCase().replace(/\s+/g, '-');
        if (menuSlug === mainMenu) {
          mainMenuId = doc.id;
        }
      });
      
      if (!mainMenuId) {
        console.log('🔍 Main menu not found');
        return [];
      }
      
      console.log('🔍 Found main menu ID:', mainMenuId);
      
      // 2. Get all sub menus for this main menu
      const subMenuQuery = query(
        menusRef,
        where('siteId', '==', user.siteId),
        where('level', '==', 'sub'),
        where('parentMainMenuId', '==', mainMenuId)
      );
      const subMenuSnapshot = await getDocs(subMenuQuery);
      
      const subMenus: MenuItemType[] = [];
      subMenuSnapshot.forEach((doc) => {
        subMenus.push({
          id: doc.id,
          ...doc.data(),
        } as MenuItemType);
      });
      
      console.log('🔍 Found', subMenus.length, 'sub menus');
      
      // 3. Get all tasks for the supervisor
      const tasksRef = collection(db, 'tasks');
      const tasksQuery = query(
        tasksRef,
        where('siteId', '==', user.siteId),
        where('supervisorId', '==', supervisorId)
      );
      const tasksSnapshot = await getDocs(tasksQuery);
      const taskIds = tasksSnapshot.docs.map(doc => doc.id);
      
      console.log('🔍 Found', taskIds.length, 'tasks for supervisor');
      
      if (taskIds.length === 0) {
        console.log('🔍 No tasks, returning empty sub menus');
        return subMenus.sort((a, b) => a.sortOrder - b.sortOrder).map(menu => ({
          menuItem: menu,
          qcValue: 0,
          unverifiedValue: 0,
          scopeValue: 0,
          boqValue: 0,
          percentage: 0,
          unverifiedPercentage: 0,
          boqPercentage: 0,
          boqUnverifiedPercentage: 0,
          activityCount: 0,
        }));
      }
      
      // 4. Get all activities for this supervisor
      const allActivities: any[] = [];
      for (let i = 0; i < taskIds.length; i += 10) {
        const batch = taskIds.slice(i, i + 10);
        const activitiesRef = collection(db, 'activities');
        const activitiesQuery = query(activitiesRef, where('taskId', 'in', batch));
        const activitiesSnapshot = await getDocs(activitiesQuery);
        allActivities.push(...activitiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
      
      console.log('🔍 Found', allActivities.length, 'total activities');
      
      // 5. Filter activities for this supervisor
      const supervisorActivities = allActivities.filter(
        activity => activity.supervisorInputBy === supervisorId
      );
      
      console.log('🔍 Found', supervisorActivities.length, 'activities for this supervisor');
      
      // 6. Calculate progress per sub menu
      const subMenuProgress = new Map<string, {
        qc: number;
        unverified: number;
        scope: number;
        boq: number;
        activities: Set<string>;
      }>();
      
      for (const activity of supervisorActivities) {
        const activitySubMenuKey = normalizeSubMenuKey(activity.subMenuKey || '');
        
        // Find the sub menu by matching the key
        let matchedSubMenu: MenuItemType | null = null;
        for (const subMenu of subMenus) {
          const subMenuKey = normalizeSubMenuKey(subMenu.key || subMenu.name.toLowerCase().replace(/\s+/g, '-'));
          if (subMenuKey === activitySubMenuKey) {
            matchedSubMenu = subMenu;
            break;
          }
        }
        
        if (!matchedSubMenu) {
          console.log(`🔍 ⚠️ Activity "${activity.name}" (${activity.id}) - NO MATCHED SUBMENU`);
          continue;
        }
        
        const subMenuId = matchedSubMenu.id;
        
        if (!subMenuProgress.has(subMenuId)) {
          subMenuProgress.set(subMenuId, {
            qc: 0,
            unverified: 0,
            scope: 0,
            boq: 0,
            activities: new Set(),
          });
        }
        
        const progress = subMenuProgress.get(subMenuId)!;
        
        let scopeValue = typeof activity.scopeValue === 'number'
          ? activity.scopeValue
          : (activity.scopeValue?.value || 0);
        const scopeApproved = activity.scopeApproved || false;
        let qcValue = activity.qcValue || activity.qc?.value || 0;
        let unverifiedValue = activity.supervisorInputValue || 0;
        const isHandoff = activity.cablingHandoff || activity.terminationHandoff;
        
        const moduleConfig = activity.moduleConfig as ActivityModuleConfig | undefined;
        const isGridBased = moduleConfig?.baseBlockType === 'GRID_TYPE_ROW_PROGRESS';
        const boqQuantity = moduleConfig?.boqQuantity || 0;
        
        console.log(`🔍 Activity "${activity.name}" (${activity.id}):`);
        console.log(`   SubMenu: ${activitySubMenuKey} | SubMenuId: ${subMenuId}`);
        console.log(`   IsGrid: ${isGridBased} | IsHandoff: ${isHandoff} | ScopeApproved: ${scopeApproved}`);
        console.log(`   BEFORE Grid Calc - Scope: ${scopeValue} | QC: ${qcValue} | Unverified: ${unverifiedValue}`);
        
        if (isGridBased && moduleConfig?.gridConfig) {
          const gridProgressRef = collection(db, 'gridCellProgress');
          const gridProgressQuery = query(
            gridProgressRef,
            where('activityId', '==', activity.id),
            where('taskId', '==', activity.taskId),
            where('siteId', '==', user.siteId)
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
          
          console.log(`   AFTER Grid Calc - Scope: ${scopeValue} (${totalCells} cells × ${valuePerCell}) | QC: ${qcValue} | Unverified: ${unverifiedValue} (${completedCells.length} completed)`);
        }
        
        const willCountLocalScope = !isHandoff && scopeApproved && scopeValue > 0;
        const willCountBOQ = !isHandoff && boqQuantity > 0;
        console.log(`   Will count toward local scope: ${willCountLocalScope}`);
        console.log(`   Will count toward BOQ: ${willCountBOQ} (BOQ: ${boqQuantity})`);
        
        if (willCountLocalScope) {
          progress.qc += qcValue;
          progress.unverified += unverifiedValue;
          progress.scope += scopeValue;
          progress.activities.add(activity.id);
          console.log(`   ✅ COUNTED (Local Scope) - Sub menu progress now: QC ${progress.qc}/${progress.scope}`);
        } else {
          console.log(`   ⚠️ NOT COUNTED (Local Scope) - Reason: ${isHandoff ? 'is handoff' : !scopeApproved ? 'scope not approved' : 'scope is 0'}`);
        }
        
        if (willCountBOQ) {
          progress.boq += boqQuantity;
          console.log(`   ✅ COUNTED (BOQ) - Sub menu BOQ now: ${progress.boq}`);
        } else {
          console.log(`   ⚠️ NOT COUNTED (BOQ) - Reason: ${isHandoff ? 'is handoff' : 'no BOQ set'}`);
        }
      }
      
      // 7. Build result - SHOW ALL SUB-MENUS even if 0% progress
      const result: SubMenuWithProgress[] = subMenus.map(menu => {
        const progress = subMenuProgress.get(menu.id);
        
        if (!progress) {
          return {
            menuItem: menu,
            qcValue: 0,
            unverifiedValue: 0,
            scopeValue: 0,
            boqValue: 0,
            percentage: 0,
            unverifiedPercentage: 0,
            boqPercentage: 0,
            boqUnverifiedPercentage: 0,
            activityCount: 0,
          };
        }
        
        const percentage = progress.scope > 0 ? (progress.qc / progress.scope) * 100 : 0;
        const unverifiedPercentage = progress.scope > 0 ? (progress.unverified / progress.scope) * 100 : 0;
        const boqPercentage = progress.boq > 0 ? (progress.qc / progress.boq) * 100 : 0;
        const boqUnverifiedPercentage = progress.boq > 0 ? (progress.unverified / progress.boq) * 100 : 0;
        
        return {
          menuItem: menu,
          qcValue: progress.qc,
          unverifiedValue: progress.unverified,
          scopeValue: progress.scope,
          boqValue: progress.boq,
          percentage: Math.min(percentage, 100),
          unverifiedPercentage: Math.min(unverifiedPercentage, 100),
          boqPercentage: Math.min(boqPercentage, 100),
          boqUnverifiedPercentage: Math.min(boqUnverifiedPercentage, 100),
          activityCount: progress.activities.size,
        };
      });
      
      // Sort by sortOrder, showing ALL menus regardless of progress
      result.sort((a, b) => a.menuItem.sortOrder - b.menuItem.sortOrder);
      
      console.log('\n🔍 ============================================== 🔍');
      console.log('🔍 SUB MENU PROGRESS RESULTS');
      result.forEach(item => {
        console.log(`🔍 ${item.menuItem.name}: ${item.percentage.toFixed(2)}% (${item.activityCount} activities)`);
      });
      console.log('🔍 ============================================== 🔍\n');
      
      return result;
    },
    enabled: !!user?.siteId && !!supervisorId,
  });

  const handleSubMenuPress = (subMenuItem: SubMenuWithProgress) => {
    console.log(`Sub menu pressed: ${subMenuItem.menuItem.name} (${subMenuItem.menuItem.id})`);
    const subMenuKey = normalizeSubMenuKey(subMenuItem.menuItem.key || subMenuItem.menuItem.name.toLowerCase().replace(/\s+/g, '-'));
    router.push({
      pathname: '/per-user-progress',
      params: {
        supervisorId: supervisorId || '',
        supervisorName: supervisorName || '',
        subMenuKey,
        subMenuName: subMenuItem.menuItem.name,
      }
    });
  };

  const color = roleAccentColor;

  return (
    <View style={[commonStyles.container, styles.container]}>
      <Stack.Screen
        options={{
          title: mainMenuName || 'Sub-Menus',
          headerStyle: {
            backgroundColor: theme.surface,
          },
          headerTintColor: theme.text,
          headerTitleStyle: {
            fontWeight: '600' as const,
          },
        }}
      />
      <View style={commonStyles.headerBorder} />
      
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.headerSection}>
          <View style={[styles.headerCard, { backgroundColor: theme.cardBg }]}>
            <View style={styles.headerTitleRow}>
              <Folder size={20} color={color} />
              <Text style={[styles.headerTitle, { color: '#000' }]}>Sub-Menu Breakdown</Text>
            </View>
            <View style={[styles.headerStatsRow, { backgroundColor: theme.surface }]}>
              <View style={styles.headerStat}>
                <Text style={[styles.headerStatLabel, { color: theme.textSecondary }]}>Sub-Menus</Text>
                <Text style={[styles.headerStatValue, { color: theme.text }]}>{(subMenusQuery.data || []).length}</Text>
              </View>
              <View style={[styles.headerStatDivider, { backgroundColor: theme.border }]} />
              <View style={styles.headerStat}>
                <Text style={[styles.headerStatLabel, { color: theme.textSecondary }]}>Activities</Text>
                <Text style={[styles.headerStatValue, { color: theme.text }]}>{(subMenusQuery.data || []).reduce((sum, item) => sum + item.activityCount, 0)}</Text>
              </View>
            </View>
          </View>
        </View>

        {subMenusQuery.isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        ) : subMenusQuery.error ? (
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, { color: theme.errorText }]}>Error loading sub menus</Text>
          </View>
        ) : (subMenusQuery.data || []).length === 0 ? (
          <View style={styles.emptyContainer}>
            <Folder size={48} color={theme.border} />
            <Text style={[styles.emptyText, { color: theme.text }]}>No sub menu items available</Text>
            <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>Contact your administrator to add sub menu items</Text>
          </View>
        ) : (
          <View style={styles.contentSection}>
            <View style={styles.progressCardsRow}>
              {/* QC Verified Progress Card */}
              <View style={[styles.progressCard, { backgroundColor: theme.cardBg, borderLeftColor: theme.successText }]}>
                <Text style={[styles.progressCardLabel, { color: theme.textSecondary }]}>QC VERIFIED PROGRESS</Text>
                <Text style={[styles.progressCardValue, { color: theme.successText }]}>
                  {(subMenusQuery.data || []).reduce((sum, item) => {
                    if (item.scopeValue > 0) {
                      return sum + item.percentage;
                    }
                    return sum;
                  }, 0) / Math.max((subMenusQuery.data || []).filter(item => item.scopeValue > 0).length, 1)}%
                </Text>
                <Text style={[styles.progressCardSubtext, { color: theme.textSecondary }]}>
                  QC: {(subMenusQuery.data || []).reduce((sum, item) => sum + item.qcValue, 0).toFixed(1)} / Scope: {(subMenusQuery.data || []).reduce((sum, item) => sum + item.scopeValue, 0).toFixed(1)}
                </Text>
              </View>
              
              {/* Unverified Progress Card */}
              <View style={[styles.progressCard, { backgroundColor: theme.cardBg, borderLeftColor: theme.warningText }]}>
                <Text style={[styles.progressCardLabel, { color: theme.textSecondary }]}>UNVERIFIED PROGRESS</Text>
                <Text style={[styles.progressCardValue, { color: theme.warningText }]}>
                  {(subMenusQuery.data || []).reduce((sum, item) => {
                    if (item.scopeValue > 0) {
                      return sum + item.unverifiedPercentage;
                    }
                    return sum;
                  }, 0) / Math.max((subMenusQuery.data || []).filter(item => item.scopeValue > 0).length, 1)}%
                </Text>
                <Text style={[styles.progressCardSubtext, { color: theme.textSecondary }]}>
                  User Input: {(subMenusQuery.data || []).reduce((sum, item) => sum + item.unverifiedValue, 0).toFixed(1)} / Scope: {(subMenusQuery.data || []).reduce((sum, item) => sum + item.scopeValue, 0).toFixed(1)}
                </Text>
              </View>
            </View>

            {(subMenusQuery.data || []).map((item, index) => {
              return (
                <TouchableOpacity
                  key={item.menuItem.id}
                  style={[styles.subMenuCard, { backgroundColor: theme.cardBg }]}
                  activeOpacity={0.7}
                  onPress={() => handleSubMenuPress(item)}
                >
                  <View style={styles.subMenuHeader}>
                    <Text style={[styles.subMenuName, { color: '#000' }]}>{item.menuItem.name}</Text>
                    <Text style={[styles.activityCountBadge, { color: theme.textSecondary, backgroundColor: theme.surface }]}>
                      {item.activityCount} {item.activityCount === 1 ? 'activity' : 'activities'}
                    </Text>
                  </View>
                  
                  <View style={styles.subMenuProgressSection}>
                    {item.boqValue > 0 || item.scopeValue > 0 ? (
                      <>
                        {/* BOQ Section */}
                        {item.boqValue > 0 && (
                          <View style={styles.scopeTypeSection}>
                            <Text style={[styles.scopeTypeHeader, { color: '#000' }]}>BOQ</Text>
                            <View style={styles.gridRow}>
                              {/* BOQ - QC Verified */}
                              <View style={[styles.gridCell, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                                <Text style={[styles.gridCellLabel, { color: theme.textSecondary }]}>QC VERIFIED</Text>
                                <Text style={[styles.gridCellValue, { color: theme.text }]}>{item.boqPercentage.toFixed(1)}%</Text>
                                <Text style={[styles.gridCellStats, { color: theme.textSecondary }]}>
                                  {item.qcValue.toFixed(1)} / {item.boqValue.toFixed(1)}
                                </Text>
                              </View>
                              
                              {/* BOQ - Unverified */}
                              <View style={[styles.gridCell, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                                <Text style={[styles.gridCellLabel, { color: theme.textSecondary }]}>UNVERIFIED</Text>
                                <Text style={[styles.gridCellValue, { color: theme.text }]}>{item.boqUnverifiedPercentage.toFixed(1)}%</Text>
                                <Text style={[styles.gridCellStats, { color: theme.textSecondary }]}>
                                  {item.unverifiedValue.toFixed(1)} / {item.boqValue.toFixed(1)}
                                </Text>
                              </View>
                            </View>
                          </View>
                        )}
                        
                        {/* Local Scope Section */}
                        {item.scopeValue > 0 && (
                          <View style={styles.scopeTypeSection}>
                            <Text style={[styles.scopeTypeHeader, { color: '#000' }]}>Local Scope</Text>
                            <View style={styles.gridRow}>
                              {/* Local Scope - QC Verified */}
                              <View style={[styles.gridCell, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                                <Text style={[styles.gridCellLabel, { color: theme.textSecondary }]}>QC VERIFIED</Text>
                                <Text style={[styles.gridCellValue, { color: theme.text }]}>{item.percentage.toFixed(1)}%</Text>
                                <Text style={[styles.gridCellStats, { color: theme.textSecondary }]}>
                                  {item.qcValue.toFixed(1)} / {item.scopeValue.toFixed(1)}
                                </Text>
                              </View>
                              
                              {/* Local Scope - Unverified */}
                              <View style={[styles.gridCell, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                                <Text style={[styles.gridCellLabel, { color: theme.textSecondary }]}>UNVERIFIED</Text>
                                <Text style={[styles.gridCellValue, { color: theme.text }]}>{item.unverifiedPercentage.toFixed(1)}%</Text>
                                <Text style={[styles.gridCellStats, { color: theme.textSecondary }]}>
                                  {item.unverifiedValue.toFixed(1)} / {item.scopeValue.toFixed(1)}
                                </Text>
                              </View>
                            </View>
                          </View>
                        )}
                      </>
                    ) : (
                      <View style={styles.noScopeContainer}>
                        <Text style={[styles.noScopeText, { color: theme.textSecondary }]}>No BOQ or Local Scope set</Text>
                      </View>
                    )}
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
  headerSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerCard: {
    flexDirection: 'column' as const,
    gap: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  headerStatsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderRadius: 8,
    padding: 10,
    gap: 12,
  },
  headerStat: {
    flex: 1,
    alignItems: 'center',
  },
  headerStatDivider: {
    width: 1,
    height: 28,
  },
  headerStatLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  headerStatValue: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  contentSection: {
    paddingHorizontal: 20,
  },
  progressCardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  progressCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    borderLeftWidth: 4,
  },
  progressCardLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  progressCardValue: {
    fontSize: 24,
    fontWeight: '800' as const,
    marginBottom: 4,
  },
  progressCardSubtext: {
    fontSize: 11,
  },
  subMenuCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  subMenuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  subMenuName: {
    fontSize: 16,
    fontWeight: '700' as const,
    flex: 1,
  },
  activityCountBadge: {
    fontSize: 11,
    fontWeight: '600' as const,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  subMenuProgressSection: {
    gap: 12,
  },
  scopeTypeSection: {
    marginBottom: 16,
  },
  scopeTypeHeader: {
    fontSize: 13,
    fontWeight: '700' as const,
    marginBottom: 12,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  gridCell: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
  },
  gridCellLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  gridCellValue: {
    fontSize: 24,
    fontWeight: '800' as const,
    marginBottom: 4,
  },
  gridCellStats: {
    fontSize: 11,
  },
  noScopeContainer: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  noScopeText: {
    fontSize: 13,
    fontStyle: 'italic' as const,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '500' as const,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500' as const,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center' as const,
  },
  bottomSpacer: {
    height: 32,
  },
});
