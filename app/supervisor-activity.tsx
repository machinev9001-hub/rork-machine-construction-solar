import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { Cable, Zap, Shovel, Drill, Settings, Box, Activity, LayoutGrid } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import React, { useState, useEffect } from 'react';
import BottomTabBar from '@/components/BottomTabBar';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useTheme } from '@/utils/hooks/useTheme';

type SubActivity = {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
};

type MenuItem = {
  id: string;
  siteId: string;
  masterAccountId: string;
  level: 'main' | 'sub' | 'activity';
  name: string;
  parentMainMenuId?: string;
  parentSubMenuId?: string;
  sortOrder: number;
  createdAt: any;
};

export default function SupervisorActivityScreen() {
  const { activity, menuId, parentColor, parentIcon } = useLocalSearchParams<{ 
    activity: string; 
    menuId: string;
    parentColor?: string;
    parentIcon?: string;
  }>();
  const { user } = useAuth();
  const { theme, roleAccentColor, commonStyles } = useTheme();
  const router = useRouter();

  const [mainMenu, setMainMenu] = useState<MenuItem | null>(null);
  const [subMenus, setSubMenus] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadMenuData = async () => {
      if (!user?.siteId || (!activity && !menuId)) {
        setIsLoading(false);
        return;
      }

      try {
        console.log('📋 [Supervisor Activity] Loading menus for:', { activity, menuId });
        const menusRef = collection(db, 'menuItems');
        
        const mainMenuQuery = query(
          menusRef,
          where('siteId', '==', user.siteId),
          where('level', '==', 'main')
        );
        
        const mainMenuSnapshot = await getDocs(mainMenuQuery);
        let foundMainMenu: MenuItem | undefined;
        
        mainMenuSnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const menuSlug = data.name.toLowerCase().replace(/\s+/g, '-');
          
          if ((menuId && docSnap.id === menuId) || (activity && menuSlug === activity)) {
            foundMainMenu = {
              id: docSnap.id,
              siteId: data.siteId,
              masterAccountId: data.masterAccountId,
              level: data.level,
              name: data.name,
              parentMainMenuId: data.parentMainMenuId,
              parentSubMenuId: data.parentSubMenuId,
              sortOrder: data.sortOrder,
              createdAt: data.createdAt,
            } as MenuItem;
          }
        });

        if (foundMainMenu) {
          console.log('📋 Found main menu:', foundMainMenu.name, 'with ID:', foundMainMenu.id);
          setMainMenu(foundMainMenu);
          
          const subMenuQuery = query(
            menusRef,
            where('siteId', '==', user.siteId),
            where('level', '==', 'sub'),
            where('parentMainMenuId', '==', foundMainMenu.id)
          );
          
          const subMenuSnapshot = await getDocs(subMenuQuery);
          const loadedSubMenus: MenuItem[] = [];
          
          subMenuSnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            loadedSubMenus.push({
              id: docSnap.id,
              siteId: data.siteId,
              masterAccountId: data.masterAccountId,
              level: data.level,
              name: data.name,
              parentMainMenuId: data.parentMainMenuId,
              parentSubMenuId: data.parentSubMenuId,
              sortOrder: data.sortOrder,
              createdAt: data.createdAt,
            } as MenuItem);
          });
          
          loadedSubMenus.sort((a, b) => a.sortOrder - b.sortOrder);
          console.log('📋 Loaded', loadedSubMenus.length, 'sub menus for main menu:', foundMainMenu.name);
          setSubMenus(loadedSubMenus);
        } else {
          console.warn('⚠️ No main menu found for:', { activity, menuId });
        }
      } catch (error) {
        console.error('❌ Error loading menu data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMenuData();
  }, [user?.siteId, activity, menuId]);

  const getParentIcon = (): React.ComponentType<any> => {
    const iconMap: Record<string, React.ComponentType<any>> = {
      'Pickaxe': Shovel,
      'Cable': Cable,
      'Zap': Zap,
      'Power': Box,
      'Drill': Drill,
      'Settings': Settings,
      'CheckCircle': Activity,
    };
    return iconMap[parentIcon || ''] || LayoutGrid;
  };

  const ParentIconComponent = getParentIcon();
  
  const subActivities: SubActivity[] = subMenus.map((subMenu) => ({
    id: subMenu.id,
    name: subMenu.name,
    icon: ParentIconComponent,
  }));

  const title = mainMenu?.name || 'Activity';
  const color = parentColor || roleAccentColor;

  const handleSubActivityPress = (subActivity: SubActivity) => {
    console.log(`Sub-activity pressed: ${subActivity.id}`, subActivity.name);
    const subActivitySlug = subActivity.name.toLowerCase().replace(/\s+/g, '-');
    router.push({
      pathname: '/supervisor-task-detail',
      params: {
        activity: activity || '',
        subActivity: subActivitySlug,
        subMenuId: subActivity.id,
        name: encodeURIComponent(subActivity.name),
      },
    });
  };

  if (isLoading) {
    return (
      <View style={[commonStyles.container, styles.loadingContainer]}>
        <Stack.Screen
          options={{
            title: 'Loading...',
            headerStyle: { backgroundColor: theme.headerBg },
            headerTintColor: theme.text,
            headerTitleStyle: { fontWeight: '600' as const },
          }}
        />
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading menu items...</Text>
      </View>
    );
  }

  return (
    <View style={[commonStyles.container, styles.container]}>
      <Stack.Screen
        options={{
          title: title,
          headerRight: () => (
            <View style={styles.headerRight}>
              <Text style={commonStyles.headerText}>{user?.name || 'User'}</Text>
              <Text style={commonStyles.headerSubtext}>{user?.companyName || 'Company'}</Text>
            </View>
          ),
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
        <View style={[styles.headerSection, { backgroundColor: theme.background }]}>
          <View style={styles.headerCard}>
            <View style={styles.headerLeft}>
              <Text style={[styles.siteName, { color: theme.text }]}>{title}</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Select a task type</Text>
            </View>
          </View>
        </View>

        {subActivities.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <LayoutGrid size={48} color={theme.border} />
            <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>No sub menus available</Text>
            <Text style={[styles.emptyStateSubtext, { color: theme.textSecondary }]}>Contact your administrator to add sub menu items</Text>
          </View>
        ) : (
          <View style={styles.activitiesSection}>
            <View style={styles.gridContainer}>
              {subActivities.map((subActivity) => {
                return (
                  <TouchableOpacity
                    key={subActivity.id}
                    style={[styles.activityCard, { backgroundColor: theme.cardBg }]}
                    activeOpacity={0.7}
                    onPress={() => handleSubActivityPress(subActivity)}
                  >
                    <View style={[styles.iconContainer, { backgroundColor: color }]}>
                      <ParentIconComponent size={28} color="#fff" strokeWidth={2.5} />
                    </View>
                    <Text style={styles.activityName}>{subActivity.name}</Text>
                  </TouchableOpacity>
                );
              })}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600' as const,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  headerSection: {
    paddingBottom: 0,
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
    paddingTop: 16,
    paddingBottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
    gap: 4,
  },
  siteName: {
    fontSize: 24,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '400' as const,
    letterSpacing: 0.1,
  },
  activitiesSection: {
    paddingTop: 20,
  },
  gridContainer: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  activityCard: {
    width: '47.5%',
    borderRadius: 16,
    padding: 20,
    paddingVertical: 28,
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
    fontSize: 15,
    fontWeight: '600' as const,
    textAlign: 'center',
    letterSpacing: 0.1,
    width: '100%',
    color: '#000000',
  },
  headerRight: {
    marginRight: 16,
    alignItems: 'flex-end',
  },
  bottomSpacer: {
    height: 32,
  },
});
