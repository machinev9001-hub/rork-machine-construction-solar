import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, ScrollView, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, X, Save, Truck } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, doc, addDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { PlantAsset } from '@/types';

export default function LogBreakdownScreen() {
  const { plantAssetId } = useLocalSearchParams<{ plantAssetId: string }>();
  const { user } = useAuth();
  const [plantAsset, setPlantAsset] = useState<PlantAsset | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [breakdownNotes, setBreakdownNotes] = useState('');
  const selectedDate = new Date().toISOString().split('T')[0];

  const loadPlantAsset = useCallback(async () => {
    if (!plantAssetId) {
      Alert.alert('Error', 'Missing plant asset ID');
      router.back();
      return;
    }

    if (!user?.masterAccountId) {
      Alert.alert('Error', 'User account not properly initialized');
      router.back();
      return;
    }

    try {
      setIsLoading(true);
      
      const trimmedPlantAssetId = plantAssetId.trim();
      console.log('[LogBreakdown] Searching for plant asset:', {
        assetId: trimmedPlantAssetId,
        masterAccountId: user.masterAccountId
      });
      
      const plantAssetsQuery = query(
        collection(db, 'plantAssets'),
        where('assetId', '==', trimmedPlantAssetId),
        where('masterAccountId', '==', user.masterAccountId)
      );

      const snapshot = await getDocs(plantAssetsQuery);
      console.log('[LogBreakdown] Query results:', snapshot.size, 'documents found');

      if (!snapshot.empty) {
        const plantDoc = snapshot.docs[0];
        const plantData = { id: plantDoc.id, ...plantDoc.data() } as PlantAsset;
        console.log('[LogBreakdown] Found plant asset:', plantData.assetId);
        setPlantAsset(plantData);
      } else {
        console.error('[LogBreakdown] No plant asset found with ID:', trimmedPlantAssetId);
        Alert.alert(
          'Plant Asset Not Found', 
          `Could not find plant asset with ID: ${trimmedPlantAssetId}`,
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }
    } catch (error: any) {
      console.error('[LogBreakdown] Error loading plant asset:', error);
      Alert.alert(
        'Firebase Error', 
        `Failed to load plant asset: ${error?.message || 'Unknown error'}`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } finally {
      setIsLoading(false);
    }
  }, [plantAssetId, user?.masterAccountId]);

  useEffect(() => {
    loadPlantAsset();
  }, [loadPlantAsset]);

  const handleSaveBreakdown = async () => {
    if (!plantAsset) {
      Alert.alert('Error', 'Plant asset not loaded');
      return;
    }

    if (!user?.masterAccountId || !user?.siteId) {
      Alert.alert('Error', 'User account not properly initialized');
      return;
    }

    try {
      setIsSaving(true);
      console.log('[LogBreakdown] Starting breakdown logging process...');
      console.log('[LogBreakdown] Date:', selectedDate);
      console.log('[LogBreakdown] Plant Asset Doc ID:', plantAsset.id);

      const plantAssetDocId = plantAsset.id;
      const timesheetsCollectionPath = `plantAssets/${plantAssetDocId}/timesheets`;
      const timesheetsRef = collection(db, timesheetsCollectionPath);
      
      const existingQuery = query(
        timesheetsRef,
        where('date', '==', selectedDate),
        where('isAdjustment', '!=', true)
      );

      const existingSnapshot = await getDocs(existingQuery);
      console.log('[LogBreakdown] Existing timesheets found:', existingSnapshot.size);

      if (!existingSnapshot.empty) {
        const existingDoc = existingSnapshot.docs[0];
        const existingData = existingDoc.data() as any;
        
        console.log('[LogBreakdown] Existing timesheet:', existingData);

        if (existingData?.isBreakdown) {
          Alert.alert(
            'Breakdown Already Logged',
            'A breakdown has already been logged for this date. Do you want to update the notes?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Update',
                onPress: async () => {
                  const timesheetDocRef = doc(timesheetsRef, existingDoc.id);
                  await updateDoc(timesheetDocRef, {
                    breakdownNotes: breakdownNotes || existingData.breakdownNotes || '',
                    breakdownLoggedBy: user.name || 'Unknown',
                    breakdownLoggedByUserId: user.id,
                    breakdownLoggedAt: Timestamp.now(),
                  });

                  console.log('[LogBreakdown] ✅ Breakdown notes updated');
                  
                  Alert.alert(
                    'Success',
                    'Breakdown notes updated successfully',
                    [{ text: 'OK', onPress: () => router.back() }]
                  );
                }
              }
            ]
          );
          setIsSaving(false);
          return;
        }

        const timesheetDocRef = doc(timesheetsRef, existingDoc.id);
        await updateDoc(timesheetDocRef, {
          isBreakdown: true,
          breakdownNotes: breakdownNotes || '',
          breakdownLoggedBy: user.name || 'Unknown',
          breakdownLoggedByUserId: user.id,
          breakdownLoggedAt: Timestamp.now(),
        });

        console.log('[LogBreakdown] ✅ Breakdown flag added to existing timesheet');
      } else {
        const currentOperator = plantAsset.currentOperator || 'Unknown Operator';
        const currentOperatorId = plantAsset.currentOperatorId || '';

        const newTimesheetData = {
          date: selectedDate,
          openHours: 0,
          closeHours: 0,
          totalHours: 0,
          operatorName: currentOperator,
          operatorId: currentOperatorId,
          isBreakdown: true,
          breakdownNotes: breakdownNotes || '',
          breakdownLoggedBy: user.name || 'Unknown',
          breakdownLoggedByUserId: user.id,
          breakdownLoggedAt: Timestamp.now(),
          isRainDay: false,
          isStrikeDay: false,
          hasAttachment: false,
          inclementWeather: false,
          scheduledMaintenance: false,
          verified: false,
          createdAt: Timestamp.now(),
          masterAccountId: user.masterAccountId,
          siteId: user.siteId,
          plantAssetDocId: plantAssetDocId,
        };

        const newDocRef = await addDoc(timesheetsRef, newTimesheetData);
        console.log('[LogBreakdown] ✅ New breakdown timesheet created:', newDocRef.id);
        console.log('[LogBreakdown] Created with data:', newTimesheetData);
      }

      Alert.alert(
        'Success',
        'Breakdown logged successfully. This will appear in the timesheet.',
        [{ text: 'OK', onPress: () => router.back() }]
      );

    } catch (error: any) {
      console.error('[LogBreakdown] Error saving breakdown:', error);
      Alert.alert('Error', `Failed to log breakdown: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
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
          <View style={styles.headerTitleRow}>
            <AlertTriangle size={28} color="#f59e0b" strokeWidth={2.5} />
            <Text style={styles.headerTitle}>Log Breakdown</Text>
          </View>
          <Text style={styles.headerSubtitle}>Report equipment breakdown</Text>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
          <X size={24} color="#64748b" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <View style={styles.warningBanner}>
          <AlertTriangle size={20} color="#f59e0b" strokeWidth={2.5} />
          <Text style={styles.warningText}>
            This will create a breakdown entry in the timesheet for the selected date
          </Text>
        </View>

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
            {plantAsset.currentOperator && (
              <Text style={styles.assetDetail}>Operator: {plantAsset.currentOperator}</Text>
            )}
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formLabel}>Breakdown Date</Text>
          <View style={styles.dateDisplay}>
            <Text style={styles.dateText}>{selectedDate}</Text>
            <Text style={styles.dateHint}>Today</Text>
          </View>
          
          <Text style={[styles.formLabel, { marginTop: 24 }]}>Breakdown Notes (Optional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Describe the breakdown, issues, or required repairs..."
            placeholderTextColor="#94a3b8"
            value={breakdownNotes}
            onChangeText={setBreakdownNotes}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              • A timesheet entry will be created for this date{'\n'}
              • Operator cannot undo this breakdown flag{'\n'}
              • Plant manager can undo any breakdown{'\n'}
              • Entry will save automatically at 23:55 if no hours logged
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSaveBreakdown}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Save size={20} color="#fff" strokeWidth={2.5} />
              <Text style={styles.saveButtonText}>Log Breakdown</Text>
            </>
          )}
        </TouchableOpacity>
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginLeft: 40,
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
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#92400e',
    lineHeight: 18,
  },
  assetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
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
  assetDetail: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#0f172a',
    marginBottom: 8,
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#0f172a',
  },
  dateHint: {
    fontSize: 13,
    color: '#64748b',
  },
  notesInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 16,
    fontSize: 15,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minHeight: 120,
  },
  infoBox: {
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  infoText: {
    fontSize: 13,
    color: '#0c4a6e',
    lineHeight: 20,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
