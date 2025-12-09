import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Truck, Clock, AlertTriangle, ClipboardList, Fuel, X, CheckSquare } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { PlantAsset } from '@/types';
import { normalizeRole } from '@/utils/roles';

type ActionItem = {
  icon: any;
  label: string;
  description: string;
  color: string;
  backgroundColor: string;
  onPress: () => void;
};

export default function PlantAssetActionsScreen() {
  const { plantAssetId } = useLocalSearchParams<{ plantAssetId: string }>();
  const { user } = useAuth();
  const [plantAsset, setPlantAsset] = useState<PlantAsset | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actions, setActions] = useState<ActionItem[]>([]);

  const buildActionsForRole = useCallback((asset: PlantAsset) => {
    const userRole = normalizeRole(user?.role);
    const availableActions: ActionItem[] = [];

    if (userRole === 'operator') {
      availableActions.push({
        icon: Clock,
        label: 'Record Plant Hours',
        description: 'Log machine operating hours',
        color: '#3b82f6',
        backgroundColor: '#eff6ff',
        onPress: () => {
          router.push({
            pathname: '/operator-plant-hours',
            params: { plantAssetId: asset.assetId }
          });
        }
      });

      availableActions.push({
        icon: CheckSquare,
        label: 'Daily Checklist',
        description: 'Complete daily safety checklist',
        color: '#8b5cf6',
        backgroundColor: '#f5f3ff',
        onPress: () => {
          router.push({
            pathname: '/operator-checklist-plant',
            params: { plantAssetId: asset.assetId }
          });
        }
      });

      availableActions.push({
        icon: AlertTriangle,
        label: 'Log Breakdown',
        description: 'Report equipment breakdown',
        color: '#f59e0b',
        backgroundColor: '#fef3c7',
        onPress: () => {
          router.push({
            pathname: '/log-breakdown',
            params: { plantAssetId: asset.assetId }
          });
        }
      });
    }

    const canLogBreakdownsAndRefuel = [
      'supervisor',
      'hse',
      'planner',
      'master',
      'safety officer',
      'diesel clerk'
    ].includes(userRole);

    if (canLogBreakdownsAndRefuel) {
      availableActions.push({
        icon: AlertTriangle,
        label: 'Log Breakdown',
        description: 'Report equipment breakdown',
        color: '#f59e0b',
        backgroundColor: '#fef3c7',
        onPress: () => {
          router.push({
            pathname: '/log-breakdown',
            params: { plantAssetId: asset.assetId }
          });
        }
      });

      availableActions.push({
        icon: ClipboardList,
        label: 'View Checklist',
        description: 'View plant asset checklist',
        color: '#8b5cf6',
        backgroundColor: '#f5f3ff',
        onPress: () => {
          Alert.alert('Coming Soon', 'Checklist viewing will be available soon');
        }
      });

      availableActions.push({
        icon: Fuel,
        label: 'Log Refueling',
        description: 'Record fuel consumption',
        color: '#10b981',
        backgroundColor: '#d1fae5',
        onPress: () => {
          Alert.alert('Coming Soon', 'Refueling logging will be available soon');
        }
      });
    }

    setActions(availableActions);
  }, [user?.role]);

  const loadPlantAsset = useCallback(async () => {
    if (!plantAssetId) {
      console.error('[PlantAssetActions] Missing plant asset ID');
      Alert.alert('Error', 'Missing plant asset ID');
      router.back();
      return;
    }

    if (!user?.masterAccountId) {
      console.error('[PlantAssetActions] User account not properly initialized');
      Alert.alert('Error', 'User account not properly initialized');
      router.back();
      return;
    }

    try {
      setIsLoading(true);
      
      const trimmedPlantAssetId = plantAssetId.trim();
      console.log('[PlantAssetActions] Searching for plant asset:', {
        assetId: trimmedPlantAssetId,
        masterAccountId: user.masterAccountId
      });
      
      const plantAssetsQuery = query(
        collection(db, 'plantAssets'),
        where('assetId', '==', trimmedPlantAssetId),
        where('masterAccountId', '==', user.masterAccountId)
      );

      const snapshot = await getDocs(plantAssetsQuery);
      console.log('[PlantAssetActions] Query results:', snapshot.size, 'documents found');

      if (!snapshot.empty) {
        const plantDoc = snapshot.docs[0];
        const plantData = { id: plantDoc.id, ...plantDoc.data() } as PlantAsset;
        console.log('[PlantAssetActions] Found plant asset:', plantData.assetId);
        setPlantAsset(plantData);
        buildActionsForRole(plantData);
      } else {
        console.error('[PlantAssetActions] No plant asset found with ID:', trimmedPlantAssetId);
        Alert.alert(
          'Plant Asset Not Found', 
          `Could not find plant asset with ID: ${trimmedPlantAssetId}`,
          [
            { text: 'OK', onPress: () => router.back() }
          ]
        );
      }
    } catch (error: any) {
      console.error('[PlantAssetActions] Error loading plant asset:', error);
      Alert.alert(
        'Firebase Error', 
        `Failed to load plant asset: ${error?.message || 'Unknown error'}`,
        [
          { text: 'OK', onPress: () => router.back() }
        ]
      );
    } finally {
      setIsLoading(false);
    }
  }, [plantAssetId, user?.masterAccountId, buildActionsForRole]);

  useEffect(() => {
    loadPlantAsset();
  }, [loadPlantAsset]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading plant asset...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!plantAsset) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Plant asset not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Plant Asset Actions</Text>
          <Text style={styles.headerSubtitle}>Choose an action to perform</Text>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
          <X size={24} color="#64748b" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <View style={styles.assetCard}>
          <View style={styles.assetIconContainer}>
            <Truck size={32} color="#3b82f6" strokeWidth={2} />
          </View>
          <View style={styles.assetInfo}>
            <Text style={styles.assetType}>{plantAsset.type}</Text>
            {plantAsset.plantNumber && (
              <Text style={styles.assetId}>Plant #: {plantAsset.plantNumber}</Text>
            )}
            <Text style={styles.assetId}>Asset ID: {plantAsset.assetId}</Text>
            {plantAsset.currentAllocation && (
              <View style={styles.locationDetailContainer}>
                <Text style={styles.assetLocation}>
                  Location: {plantAsset.currentAllocation.siteName || 'Unknown Site'}
                </Text>
                {plantAsset.currentAllocation.pvArea && (
                  <Text style={styles.assetLocationDetail}>
                    {plantAsset.currentAllocation.pvArea}
                    {plantAsset.currentAllocation.blockArea ? ` Block ${plantAsset.currentAllocation.blockArea}` : ''}
                  </Text>
                )}
              </View>
            )}
            {!plantAsset.currentAllocation && plantAsset.location && (
              <Text style={styles.assetLocation}>Location: {plantAsset.location}</Text>
            )}
            {plantAsset.subcontractor && (
              <Text style={styles.assetDetail}>Subcontractor: {plantAsset.subcontractor}</Text>
            )}
            {plantAsset.currentOperator && (
              <Text style={styles.assetDetail}>Operator: {plantAsset.currentOperator}</Text>
            )}
          </View>
        </View>

        {actions.length === 0 ? (
          <View style={styles.noActionsContainer}>
            <Text style={styles.noActionsText}>
              No actions available for your role
            </Text>
            <Text style={styles.noActionsSubtext}>
              Contact your supervisor if you believe this is an error
            </Text>
          </View>
        ) : (
          <View style={styles.actionsContainer}>
            <Text style={styles.sectionTitle}>Available Actions</Text>
            {actions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.actionCard, { borderLeftColor: action.color }]}
                onPress={action.onPress}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconContainer, { backgroundColor: action.backgroundColor }]}>
                  <action.icon size={28} color={action.color} strokeWidth={2.5} />
                </View>
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionLabel}>{action.label}</Text>
                  <Text style={styles.actionDescription}>{action.description}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#64748b',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#0f172a',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  assetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  assetIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  assetInfo: {
    flex: 1,
  },
  assetType: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#0f172a',
    marginBottom: 4,
  },
  assetId: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#64748b',
    marginBottom: 2,
  },
  assetLocation: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  locationDetailContainer: {
    marginTop: 2,
  },
  assetLocationDetail: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 1,
    marginLeft: 8,
  },
  assetDetail: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  noActionsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  noActionsText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 8,
  },
  noActionsSubtext: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
  actionsContainer: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#0f172a',
    marginBottom: 8,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderLeftWidth: 4,
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#0f172a',
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
});
