import { Stack } from 'expo-router';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, getRoleAccentColor } from '@/constants/colors';
import { User as UserIcon } from 'lucide-react-native';

export default function AccountInfoScreen() {
  const { user } = useAuth();
  const roleAccentColor = getRoleAccentColor(user?.role);

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: 'Account Information',
          headerStyle: {
            backgroundColor: Colors.headerBg,
          },
          headerTintColor: Colors.text,
          headerTitleAlign: 'left',
        }}
      />
      <View style={[styles.headerBorder, { backgroundColor: roleAccentColor }]} />
      
      <ScrollView style={styles.content}>
        <View style={styles.profileHeader}>
          <View style={styles.profileIconContainer}>
            <UserIcon size={56} color={roleAccentColor} />
          </View>
          <Text style={styles.profileName}>{user?.name || 'Unknown User'}</Text>
          <Text style={[styles.profileRole, { color: roleAccentColor }]}>
            {user?.role || 'No Role'}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>User Details</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>Name</Text>
              <Text style={styles.value}>{user?.name || 'N/A'}</Text>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.row}>
              <Text style={styles.label}>User ID</Text>
              <Text style={styles.value}>{user?.userId || 'N/A'}</Text>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.row}>
              <Text style={styles.label}>Role</Text>
              <Text style={styles.value}>{user?.role || 'N/A'}</Text>
            </View>
            
            {user?.employeeIdNumber && (
              <>
                <View style={styles.divider} />
                <View style={styles.row}>
                  <Text style={styles.label}>Employee ID Number</Text>
                  <Text style={styles.value}>{user.employeeIdNumber}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {(user?.siteName || user?.siteId) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Site Information</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.label}>Site</Text>
                <Text style={styles.value}>{user.siteName || 'N/A'}</Text>
              </View>
              
              {user.siteId && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.row}>
                    <Text style={styles.label}>Site ID</Text>
                    <Text style={styles.value}>{user.siteId}</Text>
                  </View>
                </>
              )}
            </View>
          </View>
        )}

        {(user?.companyName || user?.currentCompanyId) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Company Information</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.label}>Company</Text>
                <Text style={styles.value}>{user.companyName || 'N/A'}</Text>
              </View>
              
              {user.currentCompanyId && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.row}>
                    <Text style={styles.label}>Company ID</Text>
                    <Text style={styles.value}>{user.currentCompanyId}</Text>
                  </View>
                </>
              )}
              
              {user.companyContactMobile && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.row}>
                    <Text style={styles.label}>Company Mobile</Text>
                    <Text style={styles.value}>{user.companyContactMobile}</Text>
                  </View>
                </>
              )}
            </View>
          </View>
        )}

        {(user?.supervisorName || user?.supervisorMobile) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Supervisor</Text>
            <View style={styles.card}>
              {user.supervisorName && (
                <>
                  <View style={styles.row}>
                    <Text style={styles.label}>Supervisor Name</Text>
                    <Text style={styles.value}>{user.supervisorName}</Text>
                  </View>
                </>
              )}
              
              {user.supervisorMobile && (
                <>
                  {user.supervisorName && <View style={styles.divider} />}
                  <View style={styles.row}>
                    <Text style={styles.label}>Supervisor Mobile</Text>
                    <Text style={styles.value}>{user.supervisorMobile}</Text>
                  </View>
                </>
              )}
            </View>
          </View>
        )}
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
    backgroundColor: Colors.cardBg,
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
    textAlign: 'center',
  },
  profileRole: {
    fontSize: 16,
    fontWeight: '500' as const,
    textTransform: 'capitalize',
  },
  section: {
    marginTop: 24,
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  label: {
    fontSize: 15,
    color: Colors.textSecondary,
    flex: 1,
  },
  value: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
    flex: 1,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
});
