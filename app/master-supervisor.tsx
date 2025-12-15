import { Stack, useRouter } from 'expo-router';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { Drill, Pickaxe, Cable, Zap, Power, Settings, CheckCircle, Menu as MenuIcon, Bell, BookOpen, MessageCircle } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import React from "react";
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';
import BottomTabBar from '@/components/BottomTabBar';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/utils/hooks/useTheme';
import { HeaderTitleWithSync, StandardHeaderRight, StandardSiteIndicator } from '@/components/HeaderSyncStatus';
import { ActivityModuleConfig } from '@/types';

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

type MainMenuWithProgress = {
  menuItem: MenuItemType;
  qcValue: number;
  unverifiedValue: number;
  scopeValue: number;
  percentage: number;
  unverifiedPercentage: number;
  subMenuCount: number;
  activityCount: number;
};

const LEGACY_SUBMENU_MAP: Record<string, string> = {
  foundations: 'foundation',
};

function normalizeSubMenuKey(key: string): string {
  const normalized = key.toLowerCase().trim();
  return LEGACY_SUBMENU_MAP[normalized] ?? normalized;
}

const getIconForMenu = (menuName: string) => {
  const nameLower = menuName.toLowerCase();
  if (nameLower.includes('cabl')) return Cable;
  if (nameLower.includes('commiss')) return CheckCircle;
  if (nameLower.includes('drill')) return Drill;
  if (nameLower.includes('invert')) return Power;
  if (nameLower.includes('mech')) return Settings;
  if (nameLower.includes('term')) return Zap;
  if (nameLower.includes('trench')) return Pickaxe;
  return MenuIcon;
};

const getColorForMenu = (menuName: string) => {
  const colors = ['#4285F4', '#34a853', '#fbbc04', '#ea4335', '#6366f1', '#10b981', '#f59e0b', '#8b5cf6'];
  
  let hash = 0;
  for (let i = 0; i < menuName.length; i++) {
    hash = menuName.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

export default function MasterSupervisorScreen() {
  const { user } = useAuth();
  const { theme, commonStyles } = useTheme();
  const router = useRouter();

  const isMaster = user?.role === 'master';

  const messagesQuery = useQuery({
    queryKey: ['unread-messages-count', user?.userId, user?.siteId],
    queryFn: async () => {
      if (!user?.userId || !user?.siteId) return 0;
      
      const messagesRef = collection(db, 'messages');
      const messagesQueryRef = query(
        messagesRef,
        where('toUserId', '==', user.userId),
        where('siteId', '==', user.siteId),
        where('read', '==', false)
      );
      
      const snapshot = await getDocs(messagesQueryRef);
      return snapshot.size;
    },
    enabled: !!user?.userId && !!user?.siteId,
    refetchInterval: 30000,
  });

  const mainMenusQuery = useQuery({
    queryKey: ['supervisor-main-menus-with-progress', user?.siteId, user?.userId],
    queryFn: async (): Promise<MainMenuWithProgress[]> => {
      if (!user?.siteId || !user?.userId) return [];
      
      console.log('\n🔍 ============================================== 🔍');
      console.log('🔍 SUPERVISOR MAIN MENUS WITH PROGRESS');
      console.log('🔍 Site ID:', user.siteId);
      console.log('🔍 User ID:', user.userId);
      console.log('🔍 ============================================== 🔍\n');
      
      // 1. Get all main menus for the site
      const menusRef = collection(db, 'menuItems');
      const mainMenuQuery = query(
        menusRef,
        where('siteId', '==', user.siteId),
        where('level', '==', 'main')
      );
      const mainMenuSnapshot = await getDocs(mainMenuQuery);
      
      const mainMenus: MenuItemType[] = [];
      mainMenuSnapshot.forEach((doc) => {
        mainMenus.push({
          id: doc.id,
          ...doc.data(),
        } as MenuItemType);
      });
      
      console.log('🔍 Found', mainMenus.length, 'main menus');
      
      // 2. Get all tasks for the site
      const tasksRef = collection(db, 'tasks');
      const tasksQuery = query(tasksRef, where('siteId', '==', user.siteId));
      const tasksSnapshot = await getDocs(tasksQuery);
      const taskIds = tasksSnapshot.docs.map(doc => doc.id);
      
      console.log('🔍 Found', taskIds.length, 'tasks');
      
      if (taskIds.length === 0) {
        console.log('🔍 No tasks, returning empty main menus');
        return mainMenus.sort((a, b) => a.sortOrder - b.sortOrder).map(menu => ({
          menuItem: menu,
          qcValue: 0,
          unverifiedValue: 0,
          scopeValue: 0,
          percentage: 0,
          unverifiedPercentage: 0,
          subMenuCount: 0,
          activityCount: 0,
        }));
      }
      
      // 3. Get all activities for this supervisor
      const allActivities: any[] = [];
      for (let i = 0; i < taskIds.length; i += 10) {
        const batch = taskIds.slice(i, i + 10);
        const activitiesRef = collection(db, 'activities');
        const activitiesQuery = query(activitiesRef, where('taskId', 'in', batch));
        const activitiesSnapshot = await getDocs(activitiesQuery);
        allActivities.push(...activitiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
      
      console.log('🔍 Found', allActivities.length, 'total activities');
      
      // 4. Filter activities for this supervisor
      const supervisorActivities = allActivities.filter(
        activity => activity.supervisorInputBy === user.userId
      );
      
      console.log('🔍 Found', supervisorActivities.length, 'activities for this supervisor');
      
      // 5. Get all sub menus
      const subMenuQuery = query(
        menusRef,
        where('siteId', '==', user.siteId),
        where('level', '==', 'sub')
      );
      const subMenuSnapshot = await getDocs(subMenuQuery);
      const subMenuMap = new Map<string, MenuItemType>();
      subMenuSnapshot.forEach((doc) => {
        const data = doc.data() as MenuItemType;
        subMenuMap.set(doc.id, data);
      });
      
      console.log('🔍 Found', subMenuMap.size, 'sub menus');
      
      // 6. Calculate progress per main menu
      const mainMenuProgress = new Map<string, {
        qc: number;
        unverified: number;
        scope: number;
        subMenus: Set<string>;
        activities: Set<string>;
      }>();
      
      for (const activity of supervisorActivities) {
        const activitySubMenuKey = normalizeSubMenuKey(activity.subMenuKey || '');
        
        // Find the sub menu by matching the key
        let matchedSubMenu: MenuItemType | null = null;
        for (const [, subMenu] of subMenuMap.entries()) {
          const subMenuKey = normalizeSubMenuKey(subMenu.key || subMenu.name.toLowerCase().replace(/\s+/g, '-'));
          if (subMenuKey === activitySubMenuKey) {
            matchedSubMenu = subMenu;
            break;
          }
        }
        
        if (!matchedSubMenu || !matchedSubMenu.parentMainMenuId) {
          console.log(`🔍 ⚠️ Activity "${activity.name}" (${activity.id}) - NO MATCHED SUBMENU`);
          console.log(`   subMenuKey: "${activitySubMenuKey}", available submenus:`, Array.from(subMenuMap.entries()).map(([key, val]) => `"${key}" (${val.name})`));
          continue;
        }
        
        const mainMenuId = matchedSubMenu.parentMainMenuId;
        
        if (!mainMenuProgress.has(mainMenuId)) {
          mainMenuProgress.set(mainMenuId, {
            qc: 0,
            unverified: 0,
            scope: 0,
            subMenus: new Set(),
            activities: new Set(),
          });
        }
        
        const progress = mainMenuProgress.get(mainMenuId)!;
        
        let scopeValue = typeof activity.scopeValue === 'number'
          ? activity.scopeValue
          : (activity.scopeValue?.value || 0);
        const scopeApproved = activity.scopeApproved || false;
        let qcValue = activity.qcValue || activity.qc?.value || 0;
        let unverifiedValue = activity.supervisorInputValue || 0;
        const isHandoff = activity.cablingHandoff || activity.terminationHandoff;
        
        const moduleConfig = activity.moduleConfig as ActivityModuleConfig | undefined;
        const isGridBased = moduleConfig?.baseBlockType === 'GRID_TYPE_ROW_PROGRESS';
        
        console.log(`🔍 Activity "${activity.name}" (${activity.id}):`);
        console.log(`   MainMenu: ${matchedSubMenu.parentMainMenuId} | SubMenu: ${activitySubMenuKey}`);
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
        
        const willCount = !isHandoff && scopeApproved && scopeValue > 0;
        console.log(`   Will count toward progress: ${willCount}`);
        
        if (willCount) {
          progress.qc += qcValue;
          progress.unverified += unverifiedValue;
          progress.scope += scopeValue;
          progress.subMenus.add(activitySubMenuKey);
          progress.activities.add(activity.id);
          console.log(`   ✅ COUNTED - Main menu progress now: QC ${progress.qc}/${progress.scope}`);
        } else {
          console.log(`   ❌ NOT COUNTED - Reason: ${isHandoff ? 'is handoff' : !scopeApproved ? 'scope not approved' : 'scope is 0'}`);
        }
      }
      
      // 7. Build result
      const result: MainMenuWithProgress[] = mainMenus.map(menu => {
        const progress = mainMenuProgress.get(menu.id);
        
        if (!progress) {
          return {
            menuItem: menu,
            qcValue: 0,
            unverifiedValue: 0,
            scopeValue: 0,
            percentage: 0,
            unverifiedPercentage: 0,
            subMenuCount: 0,
            activityCount: 0,
          };
        }
        
        const percentage = progress.scope > 0 ? (progress.qc / progress.scope) * 100 : 0;
        const unverifiedPercentage = progress.scope > 0 ? (progress.unverified / progress.scope) * 100 : 0;
        
        return {
          menuItem: menu,
          qcValue: progress.qc,
          unverifiedValue: progress.unverified,
          scopeValue: progress.scope,
          percentage: Math.min(percentage, 100),
          unverifiedPercentage: Math.min(unverifiedPercentage, 100),
          subMenuCount: progress.subMenus.size,
          activityCount: progress.activities.size,
        };
      });
      
      result.sort((a, b) => a.menuItem.sortOrder - b.menuItem.sortOrder);
      
      console.log('\n🔍 ============================================== 🔍');
      console.log('🔍 MAIN MENU PROGRESS RESULTS');
      result.forEach(item => {
        console.log(`🔍 ${item.menuItem.name}: ${item.percentage.toFixed(2)}% (${item.activityCount} activities, ${item.subMenuCount} sub-menus)`);
      });
      console.log('🔍 ============================================== 🔍\n');
      
      return result;
    },
    enabled: !!user?.siteId && !!user?.userId,
  });

  const visibleActivities = (mainMenusQuery.data || []).filter((item) => {
    if (!user?.disabledMenus || user.disabledMenus.length === 0) {
      return true;
    }
    return !user.disabledMenus.includes(item.menuItem.name);
  });

  console.log('[Supervisor] User disabledMenus:', user?.disabledMenus);
  console.log('[Supervisor] Visible menus:', visibleActivities.map(a => a.menuItem.name));

  const handleMainMenuPress = (mainMenuItem: MainMenuWithProgress, color: string, icon: string) => {
    console.log(`Main menu pressed: ${mainMenuItem.menuItem.name} (${mainMenuItem.menuItem.id})`);
    const mainMenuKey = mainMenuItem.menuItem.name.toLowerCase().replace(/\s+/g, '-');
    router.push({
      pathname: '/supervisor-activity',
      params: {
        activity: mainMenuKey,
        menuId: mainMenuItem.menuItem.id,
        parentColor: color,
        parentIcon: icon,
      }
    });
  };

  return (
    <View style={[commonStyles.container, styles.container]}>
      <Stack.Screen
        options={{
          headerTitle: () => <HeaderTitleWithSync title="Supervisor" />,
          headerRight: () => (
            <View style={styles.headerRightContainer}>
              <TouchableOpacity
                style={styles.messagesButton}
                onPress={() => router.push('/supervisor-messages')}
                activeOpacity={0.7}
              >
                <Bell size={22} color={theme.text} strokeWidth={2} />
                {(messagesQuery.data || 0) > 0 && (
                  <View style={styles.messageBadge}>
                    <Text style={styles.messageBadgeText}>
                      {messagesQuery.data! > 99 ? '99+' : messagesQuery.data}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <StandardHeaderRight />
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
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>

        {mainMenusQuery.isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4285F4" />
          </View>
        ) : mainMenusQuery.error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Error loading menus</Text>
          </View>
        ) : visibleActivities.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MenuIcon size={48} color="#dadce0" />
            <Text style={styles.emptyText}>No menu items available</Text>
            <Text style={styles.emptySubtext}>Contact your administrator to add menu items</Text>
          </View>
        ) : (
          <View style={styles.activitiesSection}>
            <View style={styles.gridContainer}>
              {visibleActivities.map((item, index) => {
                const IconComponent = getIconForMenu(item.menuItem.name);
                const color = getColorForMenu(item.menuItem.name);
                const iconName = IconComponent.name || 'Menu';
                return (
                  <TouchableOpacity
                    key={item.menuItem.id}
                    style={styles.activityCard}
                    activeOpacity={0.7}
                    onPress={() => handleMainMenuPress(item, color, iconName)}
                  >
                    <View style={[styles.iconContainer, { backgroundColor: color }]}>
                      <IconComponent size={28} color="#fff" strokeWidth={2.5} />
                    </View>
                    <Text style={styles.activityName}>{item.menuItem.name}</Text>

                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {isMaster && (
          <View style={styles.masterBanner}>
            <View style={styles.masterBadge}>
              <Text style={styles.masterBadgeText}>Master Mode</Text>
            </View>
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
    backgroundColor: '#000000',
    paddingBottom: 24,
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
  headerCard: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },

  subtitle: {
    fontSize: 14,
    color: '#A0A0A0',
    paddingHorizontal: 20,
    fontWeight: '400' as const,
    letterSpacing: 0.1,
  },
  activitiesSection: {
    paddingTop: 12,
  },
  gridContainer: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  activityCard: {
    width: '47.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    paddingVertical: 20,
    alignItems: 'center',
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
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  activityName: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
    letterSpacing: 0.1,
    marginBottom: 8,
  },
  progressContainer: {
    width: '100%',
    marginTop: 8,
    gap: 6,
  },
  progressStats: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    width: '100%',
  },
  progressLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: '#5f6368',
  },
  miniProgressBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#e8eaed',
    borderRadius: 2,
    overflow: 'hidden',
  },
  miniProgressFillVerified: {
    height: '100%',
    backgroundColor: '#34A853',
    borderRadius: 2,
  },
  statsText: {
    fontSize: 9,
    color: '#80868b',
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
  bottomSpacer: {
    height: 32,
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
    color: '#ea4335',
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
    color: '#5f6368',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9aa0a6',
    marginTop: 8,
    textAlign: 'center',
  },
  headerRight: {
    marginRight: 16,
    alignItems: 'flex-end',
  },
  headerUserName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#202124',
  },
  headerCompanyName: {
    fontSize: 11,
    color: '#80868b',
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  messagesButton: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    borderWidth: 2.5,
    borderColor: '#ffffff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
      },
    }),
  },
  messageBadgeText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: '#ffffff',
    letterSpacing: -0.3,
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
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      },
    }),
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
