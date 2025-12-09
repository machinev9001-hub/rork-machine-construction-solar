import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  Calendar, 
  Package, 
  Truck, 
  Settings,
  ClipboardList,
  CheckCircle,
  Grid
} from 'lucide-react-native';

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  path: string;
}

const adminTools: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/master-dashboard' },
  { id: 'sites', label: 'Sites', icon: Building2, path: '/master-sites' },
  { id: 'users', label: 'Manage Users', icon: Users, path: '/manage-users' },
  { id: 'planner', label: 'Planner', icon: Calendar, path: '/master-planner' },
  { id: 'supervisor', label: 'Supervisor', icon: ClipboardList, path: '/master-supervisor' },
  { id: 'plant', label: 'Plant Manager', icon: Package, path: '/master-plant-manager' },
  { id: 'staff', label: 'Staff Manager', icon: Users, path: '/master-staff-manager' },
  { id: 'logistics', label: 'Logistics', icon: Truck, path: '/master-logistics-manager' },
  { id: 'pv-blocks', label: 'PV Areas & Blocks', icon: Grid, path: '/master-pv-blocks' },
];

const insights: MenuItem[] = [
  { id: 'per-user-progress', label: 'Per User Progress', icon: Users, path: '/per-user-progress' },
  { id: 'qc-requests', label: 'QC Requests', icon: ClipboardList, path: '/qc-requests' },
  { id: 'qc-scheduled', label: 'QC Scheduled', icon: Calendar, path: '/qc-scheduled' },
  { id: 'qc-completed', label: 'QC Completed', icon: CheckCircle, path: '/qc-completed' },
];

export default function WebDashboardSidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const handleNavigation = (path: string) => {
    router.push(path as any);
  };

  const isActive = (path: string) => {
    return pathname === path;
  };

  return (
    <View style={styles.sidebar}>
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <LayoutDashboard size={28} color="#4285F4" strokeWidth={2.5} />
        </View>
        <Text style={styles.logoText}>VANTAGE</Text>
      </View>

      <ScrollView style={styles.menuContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.menuSection}>
          <Text style={styles.sectionLabel}>Admin tools</Text>
          {adminTools.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.menuItem, active && styles.menuItemActive]}
                onPress={() => handleNavigation(item.path)}
                activeOpacity={0.7}
              >
                <Icon 
                  size={20} 
                  color={active ? '#4285F4' : '#5f6368'} 
                  strokeWidth={active ? 2.5 : 2}
                />
                <Text style={[styles.menuItemText, active && styles.menuItemTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionLabel}>Insights</Text>
          {insights.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.menuItem, active && styles.menuItemActive]}
                onPress={() => handleNavigation(item.path)}
                activeOpacity={0.7}
              >
                <Icon 
                  size={20} 
                  color={active ? '#4285F4' : '#5f6368'} 
                  strokeWidth={active ? 2.5 : 2}
                />
                <Text style={[styles.menuItemText, active && styles.menuItemTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.menuSection}>
          <TouchableOpacity
            style={[styles.menuItem, isActive('/settings') && styles.menuItemActive]}
            onPress={() => handleNavigation('/settings')}
            activeOpacity={0.7}
          >
            <Settings 
              size={20} 
              color={isActive('/settings') ? '#4285F4' : '#5f6368'} 
              strokeWidth={isActive('/settings') ? 2.5 : 2}
            />
            <Text style={[
              styles.menuItemText, 
              isActive('/settings') && styles.menuItemTextActive
            ]}>
              Settings
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 260,
    backgroundColor: '#ffffff',
    borderRightWidth: 1,
    borderRightColor: '#e8eaed',
    paddingTop: 24,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 32,
    gap: 12,
  },
  logoContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e8f0fe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#202124',
    letterSpacing: -0.5,
  },
  menuContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  menuSection: {
    marginBottom: 32,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#80868b',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 12,
    marginBottom: 4,
  },
  menuItemActive: {
    backgroundColor: '#e8f0fe',
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#5f6368',
    flex: 1,
  },
  menuItemTextActive: {
    fontWeight: '600' as const,
    color: '#4285F4',
  },
});
