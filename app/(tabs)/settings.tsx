import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Building2, ChevronDown, ChevronUp, LogOut, User as UserIcon, Bug, QrCode, Scan, Clock, FileText, AlertTriangle, Package, Settings as SettingsIcon, Info } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, getRoleAccentColor } from '@/constants/colors';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isControlSystemsExpanded, setIsControlSystemsExpanded] = useState(false);
  const [isReportsExpanded, setIsReportsExpanded] = useState(false);
  const [isAssetManagementExpanded, setIsAssetManagementExpanded] = useState(false);
  const [isMasterControlsExpanded, setIsMasterControlsExpanded] = useState(false);
  const [isSiteSetupExpanded, setIsSiteSetupExpanded] = useState(false);
  const roleAccentColor = getRoleAccentColor(user?.role);

  const isMasterOrPlanner = user?.role === 'master' || user?.role === 'Planner';
  const isMaster = user?.role === 'master';
  const isHSE = user?.role === 'HSE' || user?.role === 'Onboarding & Inductions';
  const canPrintQR = isMasterOrPlanner || isHSE;
  const canUseFaceClock = ['Planner', 'Supervisor', 'HSE', 'HR'].includes(user?.role || '');

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
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: 'Settings',
          headerStyle: {
            backgroundColor: Colors.headerBg,
          },
          headerTintColor: Colors.text,
        }}
      />
      <View style={[styles.headerBorder, { backgroundColor: roleAccentColor }]} />
      
      <ScrollView style={styles.content}>
        {!isMasterOrPlanner && (
          <View style={styles.profileHeader}>
            <View style={styles.profileIconContainer}>
              <UserIcon size={48} color="#3b82f6" />
            </View>
            <Text style={styles.profileName}>{user?.name}</Text>
            <Text style={styles.profileRole}>{user?.role}</Text>
          </View>
        )}

        {canUseFaceClock && !isMasterOrPlanner && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Attendance</Text>
            
            <View style={styles.menuCard}>
              <TouchableOpacity 
                style={styles.menuButton}
                onPress={() => router.push('/face-enrollment' as any)}
              >
                <View style={styles.menuButtonContent}>
                  <View style={styles.menuIcon}>
                    <Scan size={24} color="#8B5CF6" />
                  </View>
                  <View style={styles.menuContent}>
                    <Text style={styles.menuTitle}>Face Enrollment</Text>
                    <Text style={styles.menuDescription}>Enroll your face for clock-in</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.menuCard}>
              <TouchableOpacity 
                style={styles.menuButton}
                onPress={() => router.push('/face-clock' as any)}
              >
                <View style={styles.menuButtonContent}>
                  <View style={styles.menuIcon}>
                    <Clock size={24} color="#10B981" />
                  </View>
                  <View style={styles.menuContent}>
                    <Text style={styles.menuTitle}>Face Clock In/Out</Text>
                    <Text style={styles.menuDescription}>Clock in/out using facial recognition</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {canPrintQR && !isMasterOrPlanner && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>HSE Tools</Text>
            
            <View style={styles.menuCard}>
              <TouchableOpacity 
                style={styles.menuButton}
                onPress={() => router.push('/print-qr-codes' as any)}
              >
                <View style={styles.menuButtonContent}>
                  <View style={styles.menuIcon}>
                    <QrCode size={24} color="#8b5cf6" />
                  </View>
                  <View style={styles.menuContent}>
                    <Text style={styles.menuTitle}>Print QR Access Cards</Text>
                    <Text style={styles.menuDescription}>Generate and print employee QR codes</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {isMasterOrPlanner && (
          <>
            <View style={styles.section}>
              <View style={styles.menuCard}>
                <TouchableOpacity 
                  style={styles.expandableHeader}
                  onPress={() => setIsSiteSetupExpanded(!isSiteSetupExpanded)}
                >
                  <View style={styles.expandableHeaderContent}>
                    <View style={styles.menuIcon}>
                      <SettingsIcon size={24} color="#10B981" />
                    </View>
                    <View style={styles.menuContent}>
                      <Text style={styles.menuTitle}>Site Setup</Text>
                      <Text style={styles.menuDescription}>Users, sites, menus, and subcontractors</Text>
                    </View>
                  </View>
                  {isSiteSetupExpanded ? (
                    <ChevronUp size={20} color="#64748b" />
                  ) : (
                    <ChevronDown size={20} color="#64748b" />
                  )}
                </TouchableOpacity>

              {isSiteSetupExpanded && (
                <View style={styles.expandedContent}>
                  <View style={styles.subMenuCard}>
                    <TouchableOpacity 
                      style={styles.subMenuItem}
                      onPress={() => router.push('/master-pv-blocks' as any)}
                    >
                      <View style={styles.subMenuIcon}>
                        <Package size={20} color="#f59e0b" />
                      </View>
                      <View style={styles.subMenuContent}>
                        <Text style={styles.subMenuTitle}>PV Areas & Blocks</Text>
                        <Text style={styles.subMenuDescription}>Manage site areas and blocks</Text>
                      </View>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.subMenuCard}>
                    <TouchableOpacity 
                      style={styles.subMenuItem}
                      onPress={() => router.push('/master-menu-manager' as any)}
                    >
                      <View style={styles.subMenuIcon}>
                        <FileText size={20} color="#ef4444" />
                      </View>
                      <View style={styles.subMenuContent}>
                        <Text style={styles.subMenuTitle}>Menu Manager</Text>
                        <Text style={styles.subMenuDescription}>Manage menu structure and activities</Text>
                      </View>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.subMenuCard}>
                    <TouchableOpacity 
                      style={styles.subMenuItem}
                      onPress={() => router.push('/plant-asset-types' as any)}
                    >
                      <View style={styles.subMenuIcon}>
                        <Package size={20} color="#10B981" />
                      </View>
                      <View style={styles.subMenuContent}>
                        <Text style={styles.subMenuTitle}>Plant Asset Types</Text>
                        <Text style={styles.subMenuDescription}>Manage plant asset types</Text>
                      </View>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.subMenuCard}>
                    <TouchableOpacity 
                      style={styles.subMenuItem}
                      onPress={() => router.push('/manage-users' as any)}
                    >
                      <View style={styles.subMenuIcon}>
                        <UserIcon size={20} color="#8B5CF6" />
                      </View>
                      <View style={styles.subMenuContent}>
                        <Text style={styles.subMenuTitle}>Users</Text>
                        <Text style={styles.subMenuDescription}>Add and manage site users</Text>
                      </View>
                    </TouchableOpacity>
                  </View>

                </View>
              )}
            </View>
            </View>

            <View style={styles.section}>
              <View style={styles.menuCard}>
                <TouchableOpacity 
                  style={styles.expandableHeader}
                  onPress={() => setIsControlSystemsExpanded(!isControlSystemsExpanded)}
                >
                  <View style={styles.expandableHeaderContent}>
                    <View style={styles.menuIcon}>
                      <Scan size={24} color="#8B5CF6" />
                    </View>
                    <View style={styles.menuContent}>
                      <Text style={styles.menuTitle}>Access Control</Text>
                      <Text style={styles.menuDescription}>Facial recognition and access control</Text>
                    </View>
                  </View>
                  {isControlSystemsExpanded ? (
                    <ChevronUp size={20} color="#64748b" />
                  ) : (
                    <ChevronDown size={20} color="#64748b" />
                  )}
                </TouchableOpacity>

              {isControlSystemsExpanded && (
                <View style={styles.expandedContent}>
                  {user?.siteId && (
                    <View style={styles.subMenuCard}>
                      <TouchableOpacity 
                        style={styles.subMenuItem}
                        onPress={() => router.push({ pathname: '/site-face-settings', params: { siteId: user.siteId } } as any)}
                      >
                        <View style={styles.subMenuIcon}>
                          <Scan size={20} color="#8B5CF6" />
                        </View>
                        <View style={styles.subMenuContent}>
                          <Text style={styles.subMenuTitle}>Face Clock-In Settings</Text>
                          <Text style={styles.subMenuDescription}>Configure face recognition for attendance</Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  )}

                  <View style={styles.subMenuCard}>
                    <TouchableOpacity 
                      style={styles.subMenuItem}
                      onPress={() => router.push('/face-enrollment' as any)}
                    >
                      <View style={styles.subMenuIcon}>
                        <Scan size={20} color="#10B981" />
                      </View>
                      <View style={styles.subMenuContent}>
                        <Text style={styles.subMenuTitle}>Face Enrollment</Text>
                        <Text style={styles.subMenuDescription}>Enroll your face for clock-in</Text>
                      </View>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.subMenuCard}>
                    <TouchableOpacity 
                      style={styles.subMenuItem}
                      onPress={() => router.push('/face-clock' as any)}
                    >
                      <View style={styles.subMenuIcon}>
                        <Clock size={20} color="#3b82f6" />
                      </View>
                      <View style={styles.subMenuContent}>
                        <Text style={styles.subMenuTitle}>Face Clock In/Out</Text>
                        <Text style={styles.subMenuDescription}>Clock in/out using facial recognition</Text>
                      </View>
                    </TouchableOpacity>
                  </View>

                  {canPrintQR && (
                    <View style={styles.subMenuCard}>
                      <TouchableOpacity 
                        style={styles.subMenuItem}
                        onPress={() => router.push('/print-qr-codes' as any)}
                      >
                        <View style={styles.subMenuIcon}>
                          <QrCode size={20} color="#f59e0b" />
                        </View>
                        <View style={styles.subMenuContent}>
                          <Text style={styles.subMenuTitle}>Print QR Access Cards</Text>
                          <Text style={styles.subMenuDescription}>Generate and print employee QR codes</Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </View>
            </View>

            <View style={styles.section}>
              <View style={styles.menuCard}>
                <TouchableOpacity 
                  style={styles.expandableHeader}
                  onPress={() => setIsReportsExpanded(!isReportsExpanded)}
                >
                  <View style={styles.expandableHeaderContent}>
                    <View style={styles.menuIcon}>
                      <FileText size={24} color="#4285F4" />
                    </View>
                    <View style={styles.menuContent}>
                      <Text style={styles.menuTitle}>Reports & Billing</Text>
                      <Text style={styles.menuDescription}>Dashboard, reports, and billing</Text>
                    </View>
                  </View>
                  {isReportsExpanded ? (
                    <ChevronUp size={20} color="#64748b" />
                  ) : (
                    <ChevronDown size={20} color="#64748b" />
                  )}
                </TouchableOpacity>

                {isReportsExpanded && (
                  <View style={styles.expandedContent}>
                    <View style={styles.subMenuCard}>
                      <TouchableOpacity 
                        style={styles.subMenuItem}
                        onPress={() => router.push('/master-dashboard' as any)}
                      >
                        <View style={styles.subMenuIcon}>
                          <FileText size={20} color="#4285F4" />
                        </View>
                        <View style={styles.subMenuContent}>
                          <Text style={styles.subMenuTitle}>Dashboard</Text>
                          <Text style={styles.subMenuDescription}>View project analytics and overview</Text>
                        </View>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.subMenuCard}>
                      <TouchableOpacity 
                        style={styles.subMenuItem}
                        onPress={() => router.push('/progress-report' as any)}
                      >
                        <View style={styles.subMenuIcon}>
                          <FileText size={20} color="#10B981" />
                        </View>
                        <View style={styles.subMenuContent}>
                          <Text style={styles.subMenuTitle}>Progress Report</Text>
                          <Text style={styles.subMenuDescription}>Track project progress</Text>
                        </View>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.subMenuCard}>
                      <TouchableOpacity 
                        style={styles.subMenuItem}
                        onPress={() => router.push('/billing-config' as any)}
                      >
                        <View style={styles.subMenuIcon}>
                          <FileText size={20} color="#f59e0b" />
                        </View>
                        <View style={styles.subMenuContent}>
                          <Text style={styles.subMenuTitle}>Billing</Text>
                          <Text style={styles.subMenuDescription}>Configure billing settings</Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.menuCard}>
                <TouchableOpacity 
                  style={styles.expandableHeader}
                  onPress={() => setIsAssetManagementExpanded(!isAssetManagementExpanded)}
                >
                  <View style={styles.expandableHeaderContent}>
                    <View style={styles.menuIcon}>
                      <Package size={24} color="#10B981" />
                    </View>
                    <View style={styles.menuContent}>
                      <Text style={styles.menuTitle}>Market Place</Text>
                      <Text style={styles.menuDescription}>Plant assets and marketplace</Text>
                    </View>
                  </View>
                  {isAssetManagementExpanded ? (
                    <ChevronUp size={20} color="#64748b" />
                  ) : (
                    <ChevronDown size={20} color="#64748b" />
                  )}
                </TouchableOpacity>

                {isAssetManagementExpanded && (
                  <View style={styles.expandedContent}>
                    <View style={styles.subMenuCard}>
                      <TouchableOpacity 
                        style={styles.subMenuItem}
                        onPress={() => router.push('/plant-asset-marketplace' as any)}
                      >
                        <View style={styles.subMenuIcon}>
                          <Package size={20} color="#3b82f6" />
                        </View>
                        <View style={styles.subMenuContent}>
                          <Text style={styles.subMenuTitle}>Plant Asset Marketplace</Text>
                          <Text style={styles.subMenuDescription}>Browse available plant assets (VAS)</Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.menuCard}>
                <TouchableOpacity 
                  style={styles.expandableHeader}
                  onPress={() => setIsMasterControlsExpanded(!isMasterControlsExpanded)}
                >
                  <View style={styles.expandableHeaderContent}>
                    <View style={styles.menuIcon}>
                      <Building2 size={24} color="#3b82f6" />
                    </View>
                    <View style={styles.menuContent}>
                      <Text style={styles.menuTitle}>Master Controls</Text>
                      <Text style={styles.menuDescription}>Company and permissions</Text>
                    </View>
                  </View>
                  {isMasterControlsExpanded ? (
                    <ChevronUp size={20} color="#64748b" />
                  ) : (
                    <ChevronDown size={20} color="#64748b" />
                  )}
                </TouchableOpacity>

              {isMasterControlsExpanded && (
                <View style={styles.expandedContent}>
                  <View style={styles.subMenuCard}>
                    <TouchableOpacity 
                      style={styles.subMenuItem}
                      onPress={() => router.push('/master-sites' as any)}
                    >
                      <View style={styles.subMenuIcon}>
                        <Building2 size={20} color="#10B981" />
                      </View>
                      <View style={styles.subMenuContent}>
                        <Text style={styles.subMenuTitle}>Sites</Text>
                        <Text style={styles.subMenuDescription}>Manage site locations</Text>
                      </View>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.subMenuCard}>
                    <TouchableOpacity 
                      style={styles.subMenuItem}
                      onPress={() => router.push('/account-info' as any)}
                    >
                      <View style={styles.subMenuIcon}>
                        <Info size={20} color="#10B981" />
                      </View>
                      <View style={styles.subMenuContent}>
                        <Text style={styles.subMenuTitle}>Account Information</Text>
                        <Text style={styles.subMenuDescription}>View your account details</Text>
                      </View>
                    </TouchableOpacity>
                  </View>

                  {isMaster && (
                    <View style={styles.subMenuCard}>
                      <TouchableOpacity 
                        style={styles.subMenuItem}
                        onPress={() => router.push('/company-settings' as any)}
                      >
                        <View style={styles.subMenuIcon}>
                          <Building2 size={20} color="#3b82f6" />
                        </View>
                        <View style={styles.subMenuContent}>
                          <Text style={styles.subMenuTitle}>Company Settings</Text>
                          <Text style={styles.subMenuDescription}>Configure company details (Master Only)</Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  )}

                  {user?.role === 'master' && (
                    <View style={styles.subMenuCard}>
                      <TouchableOpacity style={styles.subMenuItem}>
                        <View style={styles.subMenuIcon}>
                          <UserIcon size={20} color="#8B5CF6" />
                        </View>
                        <View style={styles.subMenuContent}>
                          <Text style={styles.subMenuTitle}>Permissions</Text>
                          <Text style={styles.subMenuDescription}>Manage user permissions</Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </View>
            </View>
          </>
        )}

        {isMasterOrPlanner && <View style={styles.developerToolsSpacer} />}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Developer Tools</Text>
          
          <View style={styles.menuCard}>
            <TouchableOpacity 
              style={styles.menuButton}
              onPress={() => router.push('/debug-info' as any)}
              testID="debug-info-button"
            >
              <View style={styles.menuButtonContent}>
                <View style={styles.menuIcon}>
                  <Bug size={24} color="#f59e0b" />
                </View>
                <View style={styles.menuContent}>
                  <Text style={styles.menuTitle}>Debug Info</Text>
                  <Text style={styles.menuDescription}>View system diagnostics</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {isMaster && (
            <View style={styles.menuCard}>
              <TouchableOpacity 
                style={styles.menuButton}
                onPress={() => router.push('/diagnose-site-data' as any)}
                testID="diagnose-site-data-button"
              >
                <View style={styles.menuButtonContent}>
                  <View style={styles.menuIcon}>
                    <AlertTriangle size={24} color="#ef4444" />
                  </View>
                  <View style={styles.menuContent}>
                    <Text style={styles.menuTitle}>Site Data Diagnostic</Text>
                    <Text style={styles.menuDescription}>Check for site isolation issues</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.menuCard}>
            <TouchableOpacity 
              style={styles.logoutButton}
              onPress={handleLogout}
            >
              <View style={styles.menuButtonContent}>
                <View style={styles.logoutIcon}>
                  <LogOut size={24} color="#ef4444" />
                </View>
                <View style={styles.menuContent}>
                  <Text style={styles.logoutText}>Log Out</Text>
                  <Text style={styles.logoutDescription}>Sign out from this device</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>v1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerBorder: {
    height: 2,
    width: '100%',
  },
  content: {
    flex: 1,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  profileIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: Colors.accent,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.accent,
    textTransform: 'capitalize',
  },
  section: {
    marginTop: 12,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 12,
    marginLeft: 4,
  },
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  menuCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  label: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  value: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  menuButton: {
    padding: 16,
  },
  menuButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  expandableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  expandableHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  expandedContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  subMenuCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 10,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 1,
  },
  subMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  subMenuIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  subMenuContent: {
    flex: 1,
  },
  subMenuTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#000000',
    marginBottom: 2,
  },
  subMenuDescription: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#000000',
    marginBottom: 2,
  },
  menuDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  footer: {
    padding: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  logoutButton: {
    padding: 16,
  },
  logoutIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#ef4444',
    marginBottom: 2,
  },
  logoutDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  developerToolsSpacer: {
    height: 12,
  },

});
