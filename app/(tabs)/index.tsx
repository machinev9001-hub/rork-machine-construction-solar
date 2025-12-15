import { Stack, router } from 'expo-router';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useCallback, useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, getRoleAccentColor } from '@/constants/colors';
import { 
  Users, ClipboardList, 
  CheckCircle2, Wrench, Truck,
  HardHat, UserCheck
} from 'lucide-react-native';
import { StandardHeaderRight, StandardSiteIndicator } from '@/components/HeaderSyncStatus';
import { normalizeRole } from '@/utils/roles';

type MenuItem = {
  title: string;
  icon: any;
  route: string;
  roles: string[];
  bgColor: string;
  iconColor: string;
};

const MENU_ITEMS: MenuItem[] = [
  {
    title: 'Planner',
    icon: ClipboardList,
    route: '/master-planner',
    roles: ['master', 'Planner'],
    bgColor: '#34A853',
    iconColor: '#fff',
  },
  {
    title: 'Supervisor',
    icon: UserCheck,
    route: '/master-supervisor',
    roles: ['master', 'Supervisor'],
    bgColor: '#FBBC04',
    iconColor: '#fff',
  },

  {
    title: 'QC Requests',
    icon: CheckCircle2,
    route: '/qc-requests',
    roles: ['master', 'QC'],
    bgColor: '#ec4899',
    iconColor: '#fff',
  },
  {
    title: 'Plant Manager',
    icon: Wrench,
    route: '/master-plant-manager',
    roles: ['master', 'Plant Manager'],
    bgColor: '#f59e0b',
    iconColor: '#fff',
  },
  {
    title: 'Staff Manager',
    icon: Users,
    route: '/master-staff-manager',
    roles: ['master', 'Staff Manager', 'HR'],
    bgColor: '#8b5cf6',
    iconColor: '#fff',
  },
  {
    title: 'Logistics',
    icon: Truck,
    route: '/master-logistics-manager',
    roles: ['master', 'Logistics Manager'],
    bgColor: '#0ea5e9',
    iconColor: '#fff',
  },
  {
    title: 'Onboarding',
    icon: HardHat,
    route: '/onboarding-dashboard',
    roles: ['master', 'Admin', 'HSE', 'Onboarding & Inductions'],
    bgColor: '#3b82f6',
    iconColor: '#fff',
  },
];

export default function HomeScreen() {
  const { user } = useAuth();
  const roleAccentColor = getRoleAccentColor(user?.role);
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const normalizedRole = useMemo(() => normalizeRole(user?.role), [user?.role]);

  const filteredMenuItems = useMemo(() => (
    MENU_ITEMS.filter((item) =>
      item.roles.some((role) => normalizeRole(role) === normalizedRole)
    )
  ), [normalizedRole]);

  const handleMenuPress = (route: string) => {
    router.push(route as any);
  };

  const handleRefresh = useCallback(async () => {
    console.log('HomeScreen: pull-to-refresh triggered');
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries();
    } catch (error) {
      console.error('HomeScreen: refresh failed', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient]);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Home',
          headerStyle: {
            backgroundColor: Colors.headerBg,
          },
          headerTintColor: Colors.text,
          headerRight: () => <StandardHeaderRight />,
        }}
      />
      <StandardSiteIndicator />
      <View style={[styles.headerBorder, { backgroundColor: roleAccentColor }]} />
      
      <ScrollView 
        testID="home-scroll"
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={(
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.text}
            titleColor={Colors.text}
          />
        )}
      >
        <View style={styles.grid}>
          {filteredMenuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <TouchableOpacity
                key={index}
                style={styles.menuCard}
                onPress={() => handleMenuPress(item.route)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconContainer, { backgroundColor: item.bgColor }]}>
                  <Icon size={36} color={item.iconColor} strokeWidth={2.5} />
                </View>
                <Text style={styles.menuTitle}>{item.title}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerBorder: {
    height: 2,
    width: '100%',
  },
  siteIndicator: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 4,
  },
  siteIndicatorText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  headerRight: {
    marginRight: 16,
    alignItems: 'flex-end',
  },
  headerUserName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },

  headerCompanyName: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  menuCard: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardBg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  iconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.background,
    textAlign: 'center' as const,
  },
});
