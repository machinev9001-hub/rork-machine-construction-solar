import { Stack, router } from 'expo-router';
import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Database, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { seedMenuData, checkExistingMenus } from '@/utils/seedMenuData';
import { mainMenuItems, subMenuActivities } from '@/constants/activities';

export default function SeedMenusScreen() {
  const { user } = useAuth();
  const [isSeeding, setIsSeeding] = useState(false);
  const [existingCount, setExistingCount] = useState<number | null>(null);
  const [isCheckingExisting, setIsCheckingExisting] = useState(false);
  const [seedResult, setSeedResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleCheckExisting = async () => {
    if (!user?.siteId) {
      Alert.alert('Error', 'No site selected');
      return;
    }

    setIsCheckingExisting(true);
    try {
      const count = await checkExistingMenus(user.siteId);
      setExistingCount(count);
    } catch (error) {
      console.error('Error checking existing menus:', error);
      Alert.alert('Error', 'Failed to check existing menus');
    } finally {
      setIsCheckingExisting(false);
    }
  };

  const handleSeedMenus = async () => {
    if (!user?.siteId) {
      Alert.alert('Error', 'No site selected');
      return;
    }

    const isMaster = user?.role === 'master';
    const effectiveMasterAccountId = isMaster ? (user?.masterAccountId || user?.id) : user?.masterAccountId;

    if (!effectiveMasterAccountId) {
      Alert.alert('Error', 'Master account information missing');
      return;
    }

    Alert.alert(
      'Confirm Seed',
      existingCount && existingCount > 0
        ? `This site already has ${existingCount} menu items. This will ADD new items (not replace). Continue?`
        : 'This will create all main menus, sub menus, and activities from the constants. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Seed',
          onPress: async () => {
            setIsSeeding(true);
            setSeedResult(null);
            try {
              await seedMenuData(user.siteId!, effectiveMasterAccountId);
              setSeedResult({
                success: true,
                message: 'All menus and activities have been successfully created!',
              });
              Alert.alert('Success', 'Menu data seeded successfully!', [
                {
                  text: 'Go to Menu Manager',
                  onPress: () => router.push('/master-menu-manager'),
                },
                { text: 'OK' },
              ]);
            } catch (error) {
              console.error('Seeding error:', error);
              setSeedResult({
                success: false,
                message: error instanceof Error ? error.message : 'Unknown error occurred',
              });
              Alert.alert('Error', 'Failed to seed menu data. Check console for details.');
            } finally {
              setIsSeeding(false);
              handleCheckExisting();
            }
          },
        },
      ]
    );
  };

  const subMenusCount = Object.keys(subMenuActivities).length;
  const activitiesCount = Object.values(subMenuActivities).reduce((sum, activities) => sum + activities.length, 0);
  const totalItems = mainMenuItems.length + subMenusCount + activitiesCount;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Seed Menu Data',
          headerStyle: { backgroundColor: '#ffffff' },
          headerTintColor: '#202124',
          headerTitleStyle: { fontWeight: '600', fontSize: 20 },
        }}
      />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Database size={64} color="#4285F4" />
          </View>

          <Text style={styles.title}>Seed Menu Data</Text>
          <Text style={styles.description}>
            This will populate your database with all predefined main menus, sub menus, and activities from the
            constants file.
          </Text>

          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{mainMenuItems.length}</Text>
              <Text style={styles.statLabel}>Main Menus</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{subMenusCount}</Text>
              <Text style={styles.statLabel}>Sub Menus</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{activitiesCount}</Text>
              <Text style={styles.statLabel}>Activities</Text>
            </View>
            <View style={[styles.statCard, styles.totalCard]}>
              <Text style={[styles.statValue, styles.totalValue]}>{totalItems}</Text>
              <Text style={[styles.statLabel, styles.totalLabel]}>Total Items</Text>
            </View>
          </View>

          <View style={styles.infoBox}>
            <AlertCircle size={20} color="#fbbc04" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoTitle}>Important</Text>
              <Text style={styles.infoText}>
                • This operation will ADD new items to the database{'\n'}
                • Existing items will NOT be deleted or modified{'\n'}
                • You can run this multiple times safely{'\n'}
                • Check existing items before seeding
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, styles.checkButton]}
            onPress={handleCheckExisting}
            disabled={isCheckingExisting || isSeeding}
          >
            {isCheckingExisting ? (
              <ActivityIndicator size="small" color="#4285F4" />
            ) : (
              <>
                <Database size={20} color="#4285F4" />
                <Text style={styles.checkButtonText}>Check Existing Items</Text>
              </>
            )}
          </TouchableOpacity>

          {existingCount !== null && (
            <View style={[styles.resultBox, existingCount > 0 ? styles.warningBox : styles.successBox]}>
              {existingCount > 0 ? (
                <AlertCircle size={20} color="#fbbc04" />
              ) : (
                <CheckCircle2 size={20} color="#34a853" />
              )}
              <Text style={styles.resultText}>
                {existingCount > 0
                  ? `Found ${existingCount} existing menu items for this site`
                  : 'No existing menu items found - safe to seed'}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, styles.seedButton, isSeeding && styles.seedButtonDisabled]}
            onPress={handleSeedMenus}
            disabled={isSeeding}
          >
            {isSeeding ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.seedButtonText}>Seeding...</Text>
              </>
            ) : (
              <>
                <Database size={20} color="#fff" />
                <Text style={styles.seedButtonText}>Seed Menu Data</Text>
              </>
            )}
          </TouchableOpacity>

          {seedResult && (
            <View style={[styles.resultBox, seedResult.success ? styles.successBox : styles.errorBox]}>
              {seedResult.success ? (
                <CheckCircle2 size={20} color="#34a853" />
              ) : (
                <AlertCircle size={20} color="#ea4335" />
              )}
              <Text style={styles.resultText}>{seedResult.message}</Text>
            </View>
          )}

          <View style={styles.menuPreview}>
            <Text style={styles.previewTitle}>Menu Structure Preview</Text>
            {mainMenuItems.map((mainMenu) => (
              <View key={mainMenu.id} style={styles.previewItem}>
                <Text style={styles.previewMainMenu}>📋 {mainMenu.name}</Text>
                {Object.entries(subMenuActivities)
                  .filter(([key]) => {
                    const subMenuMap: Record<string, string> = {
                      'mv-cable-trench': 'trenching',
                      'dc-cable-trench': 'trenching',
                      'lv-cable-trench': 'trenching',
                      'road-crossings': 'trenching',
                      'mv-cable': 'cabling',
                      'dc-cable': 'cabling',
                      'lv-cable': 'cabling',
                      'earthing': 'cabling',
                      'dc-terminations': 'terminations',
                      'lv-terminations': 'terminations',
                      'mv-terminations': 'terminations',
                      'inverter-stations': 'inverters',
                      'inverter-installations': 'inverters',
                      'pile-drilling': 'drilling',
                      'foundation-drilling': 'drilling',
                      'cable-drilling': 'drilling',
                      'foundation': 'mechanical',
                      'torque-tightening': 'mechanical',
                      'module-installation': 'mechanical',
                      'tracker-assembly': 'mechanical',
                      'functional-testing': 'commissioning',
                      'performance-testing': 'commissioning',
                      'safety-compliance': 'commissioning',
                    };
                    return subMenuMap[key] === mainMenu.id;
                  })
                  .map(([subMenuKey, activities]) => (
                    <View key={subMenuKey} style={styles.previewSubMenu}>
                      <Text style={styles.previewSubMenuText}>
                        └─ {subMenuKey.replace(/-/g, ' ').toUpperCase()} ({activities.length} activities)
                      </Text>
                    </View>
                  ))}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  iconContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#202124',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#5f6368',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  totalCard: {
    backgroundColor: '#4285F4',
    minWidth: '100%',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#202124',
    marginBottom: 4,
  },
  totalValue: {
    color: '#fff',
  },
  statLabel: {
    fontSize: 14,
    color: '#5f6368',
  },
  totalLabel: {
    color: '#fff',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#fef7e0',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#fbbc04',
  },
  infoTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#202124',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#5f6368',
    lineHeight: 20,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  checkButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#4285F4',
  },
  checkButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4285F4',
  },
  seedButton: {
    backgroundColor: '#4285F4',
  },
  seedButtonDisabled: {
    opacity: 0.6,
  },
  seedButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  resultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 12,
  },
  successBox: {
    backgroundColor: '#e6f4ea',
    borderWidth: 1,
    borderColor: '#34a853',
  },
  warningBox: {
    backgroundColor: '#fef7e0',
    borderWidth: 1,
    borderColor: '#fbbc04',
  },
  errorBox: {
    backgroundColor: '#fce8e6',
    borderWidth: 1,
    borderColor: '#ea4335',
  },
  resultText: {
    flex: 1,
    fontSize: 14,
    color: '#202124',
    lineHeight: 20,
  },
  menuPreview: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#202124',
    marginBottom: 16,
  },
  previewItem: {
    marginBottom: 16,
  },
  previewMainMenu: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4285F4',
    marginBottom: 8,
  },
  previewSubMenu: {
    marginLeft: 16,
    marginBottom: 4,
  },
  previewSubMenuText: {
    fontSize: 14,
    color: '#5f6368',
  },
});
