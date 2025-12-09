import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  User,
  LogOut,
  Briefcase,
  Phone,
  Building2,
  Shield,
  Bell,
  FileText,
  HelpCircle,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';

export default function AccountsSettingsScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/login');
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <User size={48} color="#1e3a8a" />
          </View>
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
          <View style={styles.roleBadge}>
            <Shield size={14} color="#1e3a8a" />
            <Text style={styles.roleText}>{user?.role || 'Accounts'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Details</Text>
          
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <User size={18} color="#64748b" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Full Name</Text>
                <Text style={styles.infoValue}>{user?.name || 'N/A'}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Briefcase size={18} color="#64748b" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>User ID</Text>
                <Text style={styles.infoValue}>{user?.userId || 'N/A'}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Shield size={18} color="#64748b" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Role</Text>
                <Text style={styles.infoValue}>{user?.role || 'N/A'}</Text>
              </View>
            </View>

            {user?.companyName && (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}>
                    <Building2 size={18} color="#64748b" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Company</Text>
                    <Text style={styles.infoValue}>{user.companyName}</Text>
                  </View>
                </View>
              </>
            )}

            {user?.companyContactMobile && (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}>
                    <Phone size={18} color="#64748b" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Company Contact</Text>
                    <Text style={styles.infoValue}>{user.companyContactMobile}</Text>
                  </View>
                </View>
              </>
            )}

            {user?.siteName && (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}>
                    <Building2 size={18} color="#64748b" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Site</Text>
                    <Text style={styles.infoValue}>{user.siteName}</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemIcon}>
              <Bell size={20} color="#1e3a8a" />
            </View>
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemTitle}>Notifications</Text>
              <Text style={styles.menuItemDescription}>Manage notification preferences</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemIcon}>
              <FileText size={20} color="#1e3a8a" />
            </View>
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemTitle}>Export Settings</Text>
              <Text style={styles.menuItemDescription}>Configure default export options</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemIcon}>
              <HelpCircle size={20} color="#1e3a8a" />
            </View>
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemTitle}>Help & Support</Text>
              <Text style={styles.menuItemDescription}>Get help and contact support</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemIcon}>
              <FileText size={20} color="#1e3a8a" />
            </View>
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemTitle}>Documentation</Text>
              <Text style={styles.menuItemDescription}>View user guides and documentation</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <View style={styles.logoutIconContainer}>
              <LogOut size={22} color="#ef4444" />
            </View>
            <View style={styles.logoutContent}>
              <Text style={styles.logoutTitle}>Log Out</Text>
              <Text style={styles.logoutDescription}>Sign out from this device</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Accounts Dashboard v1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  profileSection: {
    backgroundColor: '#ffffff',
    paddingVertical: 32,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  avatarContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#1e3a8a',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#1e293b',
    marginBottom: 8,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dbeafe',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 6,
  },
  roleText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1e3a8a',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#475569',
    marginBottom: 12,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginLeft: 60,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  menuItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1e293b',
    marginBottom: 2,
  },
  menuItemDescription: {
    fontSize: 13,
    color: '#64748b',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fee2e2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  logoutIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logoutContent: {
    flex: 1,
  },
  logoutTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#ef4444',
    marginBottom: 2,
  },
  logoutDescription: {
    fontSize: 13,
    color: '#64748b',
  },
  footer: {
    paddingVertical: 32,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#94a3b8',
  },
});
