import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch
} from 'react-native';
import { Clock, Truck, FileText, Send, Calendar, CloudRain, AlertCircle, Wrench } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { PlantAsset, OperatorAssetHours } from '@/types';

interface PlantAssetTimesheetProps {
  operatorId: string;
  operatorName: string;
  masterAccountId: string;
  siteId?: string;
  siteName?: string;
}

export default function PlantAssetTimesheet({
  operatorId,
  operatorName,
  masterAccountId,
  siteId,
  siteName
}: PlantAssetTimesheetProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assignedAssets, setAssignedAssets] = useState<PlantAsset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<PlantAsset | null>(null);
  const [openHours, setOpenHours] = useState('');
  const [closingHours, setClosingHours] = useState('');
  const [notes, setNotes] = useState('');
  const [showOpenTimePicker, setShowOpenTimePicker] = useState(false);
  const [showClosingTimePicker, setShowClosingTimePicker] = useState(false);
  const [openTime, setOpenTime] = useState(new Date());
  const [closingTime, setClosingTime] = useState(new Date());
  const [isRainDay, setIsRainDay] = useState(false);
  const [isStrikeDay, setIsStrikeDay] = useState(false);
  const [isBreakdown, setIsBreakdown] = useState(false);

  useEffect(() => {
    const loadAssets = async () => {
      try {
        setIsLoading(true);
        const plantAssetsQuery = query(
          collection(db, 'plantAssets'),
          where('masterAccountId', '==', masterAccountId),
          where('currentOperatorId', '==', operatorId),
          where('archived', '!=', true)
        );

        const snapshot = await getDocs(plantAssetsQuery);
        const assets = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as PlantAsset));

        setAssignedAssets(assets);
        if (assets.length === 1) {
          setSelectedAsset(assets[0]);
        }
      } catch (error) {
        console.error('[PlantAssetTimesheet] Error loading assets:', error);
        Alert.alert('Error', 'Failed to load assigned assets');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadAssets();
  }, [operatorId, masterAccountId]);



  const formatTime = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const calculateTotalHours = (open: string, closing: string): number => {
    if (!open || !closing) return 0;

    const [openHours, openMinutes] = open.split(':').map(Number);
    const [closeHours, closeMinutes] = closing.split(':').map(Number);

    const openTotalMinutes = openHours * 60 + openMinutes;
    const closeTotalMinutes = closeHours * 60 + closeMinutes;

    let diffMinutes = closeTotalMinutes - openTotalMinutes;
    
    // Handle overnight shift
    if (diffMinutes < 0) {
      diffMinutes += 24 * 60;
    }

    return Number((diffMinutes / 60).toFixed(2));
  };

  const handleOpenTimeChange = (_event: any, selected?: Date) => {
    setShowOpenTimePicker(false);
    if (selected) {
      setOpenTime(selected);
      setOpenHours(formatTime(selected));
    }
  };

  const handleClosingTimeChange = (_event: any, selected?: Date) => {
    setShowClosingTimePicker(false);
    if (selected) {
      setClosingTime(selected);
      setClosingHours(formatTime(selected));
    }
  };

  const validateTimesheet = (): boolean => {
    if (!selectedAsset) {
      Alert.alert('Error', 'Please select a plant asset');
      return false;
    }

    if (!openHours || !closingHours) {
      Alert.alert('Error', 'Please enter both opening and closing hours');
      return false;
    }

    const totalHours = calculateTotalHours(openHours, closingHours);
    if (totalHours === 0) {
      Alert.alert('Error', 'Invalid hours: Opening and closing times cannot be the same');
      return false;
    }

    if (totalHours > 24) {
      Alert.alert('Error', 'Total hours cannot exceed 24 hours');
      return false;
    }

    return true;
  };

  const handleSubmitTimesheet = async () => {
    if (!validateTimesheet()) return;

    try {
      setIsSubmitting(true);

      const totalHours = calculateTotalHours(openHours, closingHours);

      const operatorAssetHours: Omit<OperatorAssetHours, 'id' | 'createdAt' | 'updatedAt'> = {
        operatorId,
        operatorName,
        assetId: selectedAsset!.assetId,
        assetType: selectedAsset!.type,
        assetSiteId: selectedAsset!.siteId || '',
        date: new Date().toISOString().split('T')[0],
        openHours,
        closingHours,
        totalHours,
        siteId,
        siteName,
        masterAccountId,
        notes: notes.trim(),
        status: 'SUBMITTED',
        submittedAt: serverTimestamp(),
        isRainDay,
        isStrikeDay,
        isBreakdown
      };

      await addDoc(collection(db, 'operatorAssetHours'), operatorAssetHours);

      Alert.alert(
        'Success',
        `Plant asset hours submitted successfully\nTotal Hours: ${totalHours}`,
        [
          {
            text: 'OK',
            onPress: () => {
              setOpenHours('');
              setClosingHours('');
              setNotes('');
              setOpenTime(new Date());
              setClosingTime(new Date());
              setIsRainDay(false);
              setIsStrikeDay(false);
              setIsBreakdown(false);
              if (assignedAssets.length > 1) {
                setSelectedAsset(null);
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('[PlantAssetTimesheet] Error submitting:', error);
      Alert.alert('Error', 'Failed to submit plant asset hours');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading assigned assets...</Text>
      </View>
    );
  }

  if (assignedAssets.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Truck size={48} color="#94a3b8" />
        <Text style={styles.emptyTitle}>No Plant Assets Assigned</Text>
        <Text style={styles.emptyText}>
          You don&apos;t have any plant assets assigned to you at the moment.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>Plant Asset Hours</Text>

        {/* Asset Selection */}
        {assignedAssets.length > 1 && (
          <View style={styles.inputGroup}>
            <View style={styles.inputHeader}>
              <Truck size={20} color="#3b82f6" />
              <Text style={styles.inputLabel}>Select Asset *</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.assetSelector}>
              {assignedAssets.map((asset) => (
                <TouchableOpacity
                  key={asset.id}
                  style={[
                    styles.assetCard,
                    selectedAsset?.id === asset.id && styles.assetCardSelected
                  ]}
                  onPress={() => setSelectedAsset(asset)}
                >
                  <Text style={[
                    styles.assetType,
                    selectedAsset?.id === asset.id && styles.assetTypeSelected
                  ]}>
                    {asset.type}
                  </Text>
                  <Text style={[
                    styles.assetId,
                    selectedAsset?.id === asset.id && styles.assetIdSelected
                  ]}>
                    Site ID: {asset.assetId}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Selected Asset Info */}
        {selectedAsset && (
          <View style={styles.selectedAssetInfo}>
            <View style={styles.assetInfoRow}>
              <Text style={styles.assetInfoLabel}>Asset:</Text>
              <Text style={styles.assetInfoValue}>{selectedAsset.type}</Text>
            </View>
            <View style={styles.assetInfoRow}>
              <Text style={styles.assetInfoLabel}>Site ID:</Text>
              <Text style={styles.assetInfoValue}>{selectedAsset.assetId}</Text>
            </View>
            {selectedAsset.registrationNumber && (
              <View style={styles.assetInfoRow}>
                <Text style={styles.assetInfoLabel}>Reg #:</Text>
                <Text style={styles.assetInfoValue}>{selectedAsset.registrationNumber}</Text>
              </View>
            )}
          </View>
        )}

        {/* Date Display */}
        <View style={styles.dateDisplay}>
          <Calendar size={16} color="#64748b" />
          <Text style={styles.dateText}>Date: {new Date().toLocaleDateString()}</Text>
        </View>

        {/* Open Hours */}
        <View style={styles.inputGroup}>
          <View style={styles.inputHeader}>
            <Clock size={20} color="#10b981" />
            <Text style={styles.inputLabel}>Open Hours *</Text>
          </View>
          <TouchableOpacity 
            style={styles.timeInput}
            onPress={() => setShowOpenTimePicker(true)}
            disabled={isSubmitting}
          >
            <Text style={openHours ? styles.timeText : styles.timePlaceholder}>
              {openHours || 'Tap to set opening time'}
            </Text>
          </TouchableOpacity>
        </View>

        {showOpenTimePicker && (
          <DateTimePicker
            value={openTime}
            mode="time"
            is24Hour={true}
            display="default"
            onChange={handleOpenTimeChange}
          />
        )}

        {/* Closing Hours */}
        <View style={styles.inputGroup}>
          <View style={styles.inputHeader}>
            <Clock size={20} color="#ef4444" />
            <Text style={styles.inputLabel}>Closing Hours *</Text>
          </View>
          <TouchableOpacity 
            style={styles.timeInput}
            onPress={() => setShowClosingTimePicker(true)}
            disabled={isSubmitting}
          >
            <Text style={closingHours ? styles.timeText : styles.timePlaceholder}>
              {closingHours || 'Tap to set closing time'}
            </Text>
          </TouchableOpacity>
        </View>

        {showClosingTimePicker && (
          <DateTimePicker
            value={closingTime}
            mode="time"
            is24Hour={true}
            display="default"
            onChange={handleClosingTimeChange}
          />
        )}

        {/* Total Hours Display */}
        {openHours && closingHours && (
          <View style={styles.totalHoursDisplay}>
            <Text style={styles.totalHoursLabel}>Total Hours:</Text>
            <Text style={styles.totalHoursValue}>
              {calculateTotalHours(openHours, closingHours)} hours
            </Text>
          </View>
        )}

        {/* Event Toggles */}
        <View style={styles.eventTogglesContainer}>
          <Text style={styles.eventTogglesTitle}>Event Conditions</Text>
          <Text style={styles.eventTogglesHelperText}>
            Mark any special conditions that occurred during this shift
          </Text>

          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <CloudRain size={20} color={isRainDay ? '#3b82f6' : '#64748b'} />
              <Text style={[styles.toggleLabel, isRainDay && styles.toggleLabelActive]}>
                Rain Day
              </Text>
            </View>
            <Switch
              value={isRainDay}
              onValueChange={setIsRainDay}
              trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
              thumbColor={isRainDay ? '#ffffff' : '#f3f4f6'}
              disabled={isSubmitting}
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <AlertCircle size={20} color={isStrikeDay ? '#3b82f6' : '#64748b'} />
              <Text style={[styles.toggleLabel, isStrikeDay && styles.toggleLabelActive]}>
                Strike Day
              </Text>
            </View>
            <Switch
              value={isStrikeDay}
              onValueChange={setIsStrikeDay}
              trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
              thumbColor={isStrikeDay ? '#ffffff' : '#f3f4f6'}
              disabled={isSubmitting}
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <Wrench size={20} color={isBreakdown ? '#3b82f6' : '#64748b'} />
              <Text style={[styles.toggleLabel, isBreakdown && styles.toggleLabelActive]}>
                Breakdown
              </Text>
            </View>
            <Switch
              value={isBreakdown}
              onValueChange={setIsBreakdown}
              trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
              thumbColor={isBreakdown ? '#ffffff' : '#f3f4f6'}
              disabled={isSubmitting}
            />
          </View>
        </View>

        {/* Notes */}
        <View style={styles.inputGroup}>
          <View style={styles.inputHeader}>
            <FileText size={20} color="#3b82f6" />
            <Text style={styles.inputLabel}>Notes (Optional)</Text>
          </View>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Add any notes about the work done..."
            placeholderTextColor="#94a3b8"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            editable={!isSubmitting}
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmitTimesheet}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Send size={20} color="#fff" />
              <Text style={styles.submitButtonText}>Submit Asset Hours</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.helpText}>
          Plant asset hours will be submitted for approval and tracking.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginLeft: 8,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#0f172a',
  },
  textArea: {
    height: 80,
    paddingTop: 12,
  },
  assetSelector: {
    maxHeight: 100,
  },
  assetCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    marginRight: 12,
    minWidth: 140,
  },
  assetCardSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  assetType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  assetTypeSelected: {
    color: '#fff',
  },
  assetId: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  assetIdSelected: {
    color: '#dbeafe',
  },
  selectedAssetInfo: {
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  assetInfoRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  assetInfoLabel: {
    fontSize: 13,
    color: '#64748b',
    marginRight: 8,
  },
  assetInfoValue: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '600',
    flex: 1,
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  dateText: {
    fontSize: 13,
    color: '#64748b',
    marginLeft: 8,
  },
  timeInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
  },
  timeText: {
    fontSize: 15,
    color: '#0f172a',
  },
  timePlaceholder: {
    fontSize: 15,
    color: '#94a3b8',
  },
  totalHoursDisplay: {
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalHoursLabel: {
    fontSize: 14,
    color: '#15803d',
    fontWeight: '600',
  },
  totalHoursValue: {
    fontSize: 16,
    color: '#15803d',
    fontWeight: '700',
  },
  submitButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  eventTogglesContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  eventTogglesTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#0f172a',
    marginBottom: 4,
  },
  eventTogglesHelperText: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 16,
    lineHeight: 18,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500' as const,
  },
  toggleLabelActive: {
    color: '#0f172a',
    fontWeight: '600' as const,
  },
});