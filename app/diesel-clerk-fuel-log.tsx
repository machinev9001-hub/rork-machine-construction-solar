import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, ScrollView, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Fuel, Gauge, X, Save } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { PlantAsset } from '@/types';

type FuelLog = {
  id?: string;
  assetId: string;
  assetType: string;
  plantNumber?: string;
  registrationNumber?: string;
  fuelAmount: number;
  bowserOpeningReading: number;
  bowserClosingReading: number;
  meterReading: number;
  meterType: 'HOUR_METER' | 'ODOMETER';
  date: string;
  timestamp: any;
  loggedBy: string;
  loggedByName: string;
  siteId?: string;
  siteName?: string;
  masterAccountId: string;
  companyId?: string;
  notes?: string;
  createdAt: any;
};

export default function DieselClerkFuelLogScreen() {
  const { plantAssetId } = useLocalSearchParams<{ plantAssetId: string }>();
  const { user } = useAuth();
  const [plantAsset, setPlantAsset] = useState<PlantAsset | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [bowserOpeningReading, setBowserOpeningReading] = useState('');
  const [bowserClosingReading, setBowserClosingReading] = useState('');
  const [meterReading, setMeterReading] = useState('');
  const [meterType, setMeterType] = useState<'HOUR_METER' | 'ODOMETER'>('HOUR_METER');
  const [notes, setNotes] = useState('');

  const litresDecanted = bowserOpeningReading && bowserClosingReading 
    ? Math.max(0, parseFloat(bowserClosingReading) - parseFloat(bowserOpeningReading))
    : 0;

  useEffect(() => {
    fetchPlantAsset();
  }, [plantAssetId]);

  const fetchPlantAsset = async () => {
    if (!plantAssetId || !user?.masterAccountId) {
      Alert.alert('Error', 'Missing plant asset information');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      console.log('[DieselClerkFuelLog] Fetching plant asset:', plantAssetId);

      const assetsRef = collection(db, 'plantAssets');
      const q = query(
        assetsRef,
        where('assetId', '==', plantAssetId),
        where('masterAccountId', '==', user.masterAccountId)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        console.log('[DieselClerkFuelLog] Plant asset not found');
        Alert.alert(
          'Asset Not Found',
          `Could not find plant asset with ID: ${plantAssetId}`,
          [{ text: 'OK', onPress: () => router.back() }]
        );
        setIsLoading(false);
        return;
      }

      const assetData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as PlantAsset;
      console.log('[DieselClerkFuelLog] Found plant asset:', assetData);
      setPlantAsset(assetData);
    } catch (error) {
      console.error('[DieselClerkFuelLog] Error fetching plant asset:', error);
      Alert.alert('Error', 'Failed to load plant asset information');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveFuelLog = async () => {
    if (!plantAsset || !user) {
      Alert.alert('Error', 'Missing required information');
      return;
    }

    if (!bowserOpeningReading.trim() || parseFloat(bowserOpeningReading) < 0) {
      Alert.alert('Validation Error', 'Please enter a valid bowser opening reading');
      return;
    }

    if (!bowserClosingReading.trim() || parseFloat(bowserClosingReading) < 0) {
      Alert.alert('Validation Error', 'Please enter a valid bowser closing reading');
      return;
    }

    if (parseFloat(bowserClosingReading) < parseFloat(bowserOpeningReading)) {
      Alert.alert('Validation Error', 'Bowser closing reading must be greater than or equal to opening reading');
      return;
    }

    if (!meterReading.trim() || parseFloat(meterReading) < 0) {
      Alert.alert('Validation Error', 'Please enter a valid meter reading');
      return;
    }

    try {
      setIsSaving(true);

      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];

      const fuelLogData: Omit<FuelLog, 'id'> = {
        assetId: plantAsset.assetId,
        assetType: plantAsset.type,
        plantNumber: plantAsset.plantNumber,
        registrationNumber: plantAsset.registrationNumber,
        fuelAmount: litresDecanted,
        bowserOpeningReading: parseFloat(bowserOpeningReading),
        bowserClosingReading: parseFloat(bowserClosingReading),
        meterReading: parseFloat(meterReading),
        meterType,
        date: dateStr,
        timestamp: serverTimestamp(),
        loggedBy: user.id,
        loggedByName: user.name,
        siteId: plantAsset.siteId || user.siteId,
        siteName: plantAsset.assignedSite || user.siteName,
        masterAccountId: user.masterAccountId || '',
        companyId: user.currentCompanyId,
        notes: notes.trim() || undefined,
        createdAt: serverTimestamp(),
      };

      console.log('[DieselClerkFuelLog] Saving fuel log:', fuelLogData);

      await addDoc(collection(db, 'fuelLogs'), fuelLogData);

      Alert.alert(
        'Success',
        'Fuel log saved successfully',
        [
          {
            text: 'Log Another',
            onPress: () => {
              setBowserOpeningReading('');
              setBowserClosingReading('');
              setMeterReading('');
              setNotes('');
            }
          },
          {
            text: 'Done',
            style: 'cancel',
            onPress: () => router.back()
          }
        ]
      );
    } catch (error) {
      console.error('[DieselClerkFuelLog] Error saving fuel log:', error);
      Alert.alert('Error', 'Failed to save fuel log. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f59e0b" />
          <Text style={styles.loadingText}>Loading plant asset...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!plantAsset) {
    return (
      <SafeAreaView style={styles.container}>
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
        <Text style={styles.headerTitle}>Fuel Log</Text>
        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
          <X size={24} color="#1e293b" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <View style={styles.assetCard}>
          <View style={styles.assetIconContainer}>
            <Fuel size={32} color="#f59e0b" strokeWidth={2.5} />
          </View>
          <View style={styles.assetInfo}>
            <Text style={styles.assetType}>{plantAsset.type}</Text>
            <Text style={styles.assetId}>{plantAsset.assetId}</Text>
            {plantAsset.plantNumber && (
              <Text style={styles.assetDetail}>Plant #: {plantAsset.plantNumber}</Text>
            )}
            {plantAsset.registrationNumber && (
              <Text style={styles.assetDetail}>Reg: {plantAsset.registrationNumber}</Text>
            )}
            {plantAsset.currentOperator && (
              <Text style={styles.assetDetail}>Operator: {plantAsset.currentOperator}</Text>
            )}
          </View>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Bowser Meter Readings</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bowser Opening Reading (Liters) *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter opening reading"
              value={bowserOpeningReading}
              onChangeText={setBowserOpeningReading}
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bowser Closing Reading (Liters) *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter closing reading"
              value={bowserClosingReading}
              onChangeText={setBowserClosingReading}
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.calculatedField}>
            <Text style={styles.calculatedLabel}>Litres Decanted</Text>
            <Text style={styles.calculatedValue}>{litresDecanted.toFixed(2)} L</Text>
          </View>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Machine Meter Reading</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Meter Type *</Text>
            <View style={styles.meterTypeContainer}>
              <TouchableOpacity
                style={[
                  styles.meterTypeButton,
                  meterType === 'HOUR_METER' && styles.meterTypeButtonActive
                ]}
                onPress={() => setMeterType('HOUR_METER')}
              >
                <Gauge size={20} color={meterType === 'HOUR_METER' ? '#fff' : '#64748b'} />
                <Text
                  style={[
                    styles.meterTypeText,
                    meterType === 'HOUR_METER' && styles.meterTypeTextActive
                  ]}
                >
                  Hour Meter
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.meterTypeButton,
                  meterType === 'ODOMETER' && styles.meterTypeButtonActive
                ]}
                onPress={() => setMeterType('ODOMETER')}
              >
                <Gauge size={20} color={meterType === 'ODOMETER' ? '#fff' : '#64748b'} />
                <Text
                  style={[
                    styles.meterTypeText,
                    meterType === 'ODOMETER' && styles.meterTypeTextActive
                  ]}
                >
                  Odometer
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              {meterType === 'HOUR_METER' ? 'Hour Meter Reading' : 'Odometer Reading'} *
            </Text>
            <TextInput
              style={styles.input}
              placeholder={`Enter ${meterType === 'HOUR_METER' ? 'hours' : 'kilometers'}`}
              value={meterReading}
              onChangeText={setMeterReading}
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Notes (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Add any additional notes..."
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            Date: {new Date().toLocaleDateString()}
          </Text>
          <Text style={styles.infoText}>
            Logged by: {user?.name}
          </Text>
          <Text style={styles.infoText}>
            Site: {plantAsset.assignedSite || user?.siteName || 'N/A'}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
          disabled={isSaving}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSaveFuelLog}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Save size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Save Log</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  errorText: {
    fontSize: 18,
    color: '#ef4444',
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#0f172a',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  assetCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  assetIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fef3c7',
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
    color: '#f59e0b',
    marginBottom: 8,
  },
  assetDetail: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 2,
  },
  formSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#0f172a',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1e293b',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },
  calculatedField: {
    backgroundColor: '#dbeafe',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  calculatedLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1e40af',
  },
  calculatedValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1e40af',
  },
  meterTypeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  meterTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  meterTypeButtonActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  meterTypeText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#64748b',
  },
  meterTypeTextActive: {
    color: '#fff',
  },
  infoCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  infoText: {
    fontSize: 14,
    color: '#1e40af',
    marginBottom: 6,
    fontWeight: '500' as const,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#64748b',
  },
  saveButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#f59e0b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
