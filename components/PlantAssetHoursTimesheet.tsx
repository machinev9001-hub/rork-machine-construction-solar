import { useState, useEffect, useCallback } from 'react';
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
import { Clock, FileText, Send, Calendar, CloudRain, AlertCircle, Gauge, Link2, Lock, Trash2 } from 'lucide-react-native';
import { collection, addDoc, doc, serverTimestamp, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { queueFirestoreOperation } from '@/utils/offlineQueue';
import NetInfo from '@react-native-community/netinfo';
import { PlantAssetTimesheet } from '@/types';

interface PlantAssetHoursTimesheetProps {
  operatorId: string;
  operatorName: string;
  masterAccountId: string;
  companyId?: string;
  siteId?: string;
  siteName?: string;
  scannedAssetId: string;
  scannedAssetType?: string;
  scannedAssetLocation?: string;
  plantAssetDocId: string;
}

export default function PlantAssetHoursTimesheet({
  operatorId,
  operatorName,
  masterAccountId,
  companyId,
  siteId,
  siteName,
  scannedAssetId,
  scannedAssetType,
  scannedAssetLocation,
  plantAssetDocId
}: PlantAssetHoursTimesheetProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [meterType, setMeterType] = useState<'HOUR_METER' | 'ODOMETER'>('HOUR_METER');
  const [openHours, setOpenHours] = useState('');
  const [closeHours, setCloseHours] = useState('');
  const [notes, setNotes] = useState('');
  const [openHoursCommitted, setOpenHoursCommitted] = useState(false);
  
  // Status toggles
  const [logBreakdown, setLogBreakdown] = useState(false);
  const [scheduledMaintenance, setScheduledMaintenance] = useState(false);
  const [rainDay, setRainDay] = useState(false);
  const [strikeDay, setStrikeDay] = useState(false);
  const [hasAttachment, setHasAttachment] = useState(false);
  
  // Weather toggles
  const [inclementWeather, setInclementWeather] = useState(false);
  const [weatherNotes, setWeatherNotes] = useState('');
  
  // Lock states
  const [isLocked, setIsLocked] = useState(false);
  const [hasSubmittedToday, setHasSubmittedToday] = useState(false);
  const [todayDate, setTodayDate] = useState(new Date().toISOString().split('T')[0]);

  const loadTodaysTimesheet = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const assetDocRef = doc(db, 'plantAssets', plantAssetDocId);
      const timesheetsQuery = query(
        collection(assetDocRef, 'timesheets'),
        where('date', '==', today),
        where('operatorId', '==', operatorId)
      );
      
      const snapshot = await getDocs(timesheetsQuery);
      
      if (!snapshot.empty) {
        const timesheet = snapshot.docs[0].data() as PlantAssetTimesheet;
        console.log('[PlantAssetHoursTimesheet] Found existing timesheet for today');
        
        // Populate form with submitted values (locked state)
        setMeterType(timesheet.meterType || 'HOUR_METER');
        setOpenHours(timesheet.openHours.toString());
        setCloseHours(timesheet.closeHours.toString());
        setNotes(timesheet.notes || '');
        setLogBreakdown(timesheet.logBreakdown || false);
        setOpenHoursCommitted(true);
        setScheduledMaintenance(timesheet.scheduledMaintenance || false);
        setRainDay(timesheet.rainDay || false);
        setStrikeDay(timesheet.strikeDay || false);
        setHasAttachment(timesheet.hasAttachment || false);
        setInclementWeather(timesheet.inclementWeather || false);
        setWeatherNotes(timesheet.weatherNotes || '');
        setHasSubmittedToday(true);
      } else {
        console.log('[PlantAssetHoursTimesheet] No timesheet found for today');
        setHasSubmittedToday(false);
      }
    } catch (error) {
      console.error('[PlantAssetHoursTimesheet] Error loading timesheet:', error);
    }
  }, [plantAssetDocId, operatorId]);
  
  useEffect(() => {
    loadTodaysTimesheet();
    
    const checkTimeLock = setInterval(() => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const currentDate = now.toISOString().split('T')[0];
      
      // Check if date changed (crossed midnight)
      if (currentDate !== todayDate) {
        console.log('[PlantAssetHoursTimesheet] New day detected, clearing form');
        clearForm();
        setTodayDate(currentDate);
        setIsLocked(false);
        setHasSubmittedToday(false);
        return;
      }
      
      // Lock at 23:55 permanently
      if (hours === 23 && minutes >= 55) {
        console.log('[PlantAssetHoursTimesheet] Time lock activated at 23:55');
        setIsLocked(true);
      }
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(checkTimeLock);
  }, [todayDate, loadTodaysTimesheet]);
  
  const clearForm = () => {
    setOpenHours('');
    setCloseHours('');
    setNotes('');
    setWeatherNotes('');
    setLogBreakdown(false);
    setOpenHoursCommitted(false);
    setScheduledMaintenance(false);
    setRainDay(false);
    setStrikeDay(false);
    setHasAttachment(false);
    setInclementWeather(false);
  };

  const calculateTotalHours = (open: string, close: string): number => {
    if (!open || !close) return 0;
    
    const openNum = parseFloat(open);
    const closeNum = parseFloat(close);
    
    if (isNaN(openNum) || isNaN(closeNum)) return 0;
    
    const total = closeNum - openNum;
    return total >= 0 ? total : 0;
  };

  const validateTimesheet = (): boolean => {
    if (!openHoursCommitted) {
      Alert.alert('Error', 'Please commit the opening reading first');
      return false;
    }
    
    const meterLabel = meterType === 'HOUR_METER' ? 'hour' : 'odometer';

    if (!openHours || !closeHours) {
      Alert.alert('Error', `Please enter both opening and closing ${meterLabel} readings`);
      return false;
    }

    const openNum = parseFloat(openHours);
    const closeNum = parseFloat(closeHours);

    if (isNaN(openNum) || isNaN(closeNum)) {
      Alert.alert('Error', `Please enter valid numeric values for ${meterLabel} readings`);
      return false;
    }

    if (closeNum < openNum) {
      Alert.alert('Error', `Closing ${meterLabel} reading cannot be less than opening reading`);
      return false;
    }

    const totalHours = closeNum - openNum;
    if (totalHours === 0) {
      Alert.alert('Error', `Total ${meterType === 'HOUR_METER' ? 'hours' : 'kilometers'} cannot be zero`);
      return false;
    }

    if (inclementWeather && !weatherNotes.trim()) {
      Alert.alert('Error', 'Please provide weather details when inclement weather is selected');
      return false;
    }

    return true;
  };

  const handleDeleteTimesheet = async () => {
    Alert.alert(
      'Delete Timesheet',
      'Are you sure you want to delete today\'s timesheet? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const today = new Date().toISOString().split('T')[0];
              const assetDocRef = doc(db, 'plantAssets', plantAssetDocId);
              const timesheetsQuery = query(
                collection(assetDocRef, 'timesheets'),
                where('date', '==', today),
                where('operatorId', '==', operatorId)
              );
              
              const snapshot = await getDocs(timesheetsQuery);
              
              if (!snapshot.empty) {
                const timesheetDocId = snapshot.docs[0].id;
                await deleteDoc(doc(db, 'plantAssets', plantAssetDocId, 'timesheets', timesheetDocId));
                console.log('[PlantAssetHoursTimesheet] Deleted timesheet:', timesheetDocId);
                
                Alert.alert('Success', 'Timesheet deleted successfully');
                
                // Clear form and reset state
                clearForm();
                setHasSubmittedToday(false);
                setIsLocked(false);
                setOpenHoursCommitted(false);
              } else {
                Alert.alert('Error', 'No timesheet found to delete');
              }
            } catch (error) {
              console.error('[PlantAssetHoursTimesheet] Error deleting timesheet:', error);
              Alert.alert('Error', 'Failed to delete timesheet');
            }
          },
        },
      ]
    );
  };

  const handleSubmitTimesheet = async () => {
    if (!validateTimesheet()) return;

    try {
      setIsSubmitting(true);

      const openNum = parseFloat(openHours);
      const closeNum = parseFloat(closeHours);
      const totalHours = calculateTotalHours(openHours, closeHours);

      const timesheetData: Omit<PlantAssetTimesheet, 'id' | 'createdAt' | 'updatedAt'> & { 
        meterType?: 'HOUR_METER' | 'ODOMETER';
        rainDay?: boolean;
        strikeDay?: boolean;
        hasAttachment?: boolean;
      } = {
        assetId: scannedAssetId,
        date: new Date().toISOString().split('T')[0],
        meterType,
        openHours: openNum,
        closeHours: closeNum,
        totalHours,
        operatorId,
        operatorName,
        logBreakdown,
        scheduledMaintenance,
        rainDay,
        strikeDay,
        hasAttachment,
        inclementWeather,
        weatherNotes: inclementWeather ? weatherNotes.trim() : undefined,
        siteId,
        siteName,
        notes: notes.trim() || undefined,
        masterAccountId,
        companyId
      };

      // Check network status
      const netInfo = await NetInfo.fetch();
      
      if (netInfo.isConnected) {
        // Online: Direct Firebase write
        const assetDocRef = doc(db, 'plantAssets', plantAssetDocId);
        await addDoc(collection(assetDocRef, 'timesheets'), {
          ...timesheetData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        
        console.log('[PlantAssetHoursTimesheet] Timesheet submitted online');
      } else {
        // Offline: Queue with P0 priority (critical sync)
        await queueFirestoreOperation(
          {
            type: 'add',
            collection: `plantAssets/${plantAssetDocId}/timesheets`,
            data: {
              ...timesheetData,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          },
          {
            priority: 'P0', // Critical priority for timesheet data
            entityType: 'timesheet',
            estimatedSize: 1024 // ~1KB for timesheet data
          }
        );
        
        console.log('[PlantAssetHoursTimesheet] Timesheet queued offline with P0 priority');
      }

      const statusItems = [];
      if (logBreakdown) statusItems.push('Breakdown');
      if (scheduledMaintenance) statusItems.push('Maintenance');
      if (rainDay) statusItems.push('Rain Day');
      if (strikeDay) statusItems.push('Strike Day');
      if (hasAttachment) statusItems.push('Has Attachment');
      const statusSummary = statusItems.length > 0 ? statusItems.join(', ') : 'None';

      const isOffline = !(await NetInfo.fetch()).isConnected;
      
      const meterLabel = meterType === 'HOUR_METER' ? 'hours' : 'km';
      
      // Lock values after submission - they remain visible but read-only
      setHasSubmittedToday(true);
      
      Alert.alert(
        'Success',
        `Plant asset ${isOffline ? 'saved for sync' : 'submitted successfully'}\n` +
        `Meter Type: ${meterType === 'HOUR_METER' ? 'Hour Meter' : 'Odometer'}\n` +
        `Total: ${totalHours.toFixed(2)} ${meterLabel}\n` +
        (statusSummary !== 'None' ? `Status: ${statusSummary}\n` : '') +
        (inclementWeather ? `Weather Impact: Yes` : '') +
        (isOffline ? '\n\n⚡ Will sync when online (Priority: HIGH)' : '') +
        '\n\n✓ Times can be edited until 23:55, then locked permanently.',
        [
          {
            text: 'OK'
          }
        ]
      );
    } catch (error) {
      console.error('[PlantAssetHoursTimesheet] Error submitting:', error);
      Alert.alert('Error', 'Failed to submit plant asset hours');
    } finally {
      setIsSubmitting(false);
    }
  };



  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>Plant Asset Hours</Text>

        {/* Scanned Asset Info */}
        <View style={styles.selectedAssetInfo}>
          <View style={styles.assetInfoRow}>
            <Text style={styles.assetInfoLabel}>Asset ID:</Text>
            <Text style={styles.assetInfoValue}>{scannedAssetId}</Text>
          </View>
          {scannedAssetType && (
            <View style={styles.assetInfoRow}>
              <Text style={styles.assetInfoLabel}>Type:</Text>
              <Text style={styles.assetInfoValue}>{scannedAssetType}</Text>
            </View>
          )}
          {scannedAssetLocation && (
            <View style={styles.assetInfoRow}>
              <Text style={styles.assetInfoLabel}>Location:</Text>
              <Text style={styles.assetInfoValue}>{scannedAssetLocation}</Text>
            </View>
          )}
          <View style={styles.assetInfoRow}>
            <Text style={styles.assetInfoLabel}>Operator:</Text>
            <Text style={styles.assetInfoValue}>{operatorName}</Text>
          </View>
        </View>

        {/* Date Display with Lock Status */}
        <View style={styles.dateDisplay}>
          <Calendar size={16} color="#64748b" />
          <Text style={styles.dateText}>Date: {new Date().toLocaleDateString()}</Text>
          {(hasSubmittedToday && !isLocked) && (
            <View style={styles.editableTag}>
              <Text style={styles.editableTagText}>Editable until 23:55</Text>
            </View>
          )}
          {isLocked && (
            <View style={styles.lockedTag}>
              <Lock size={12} color="#dc2626" />
              <Text style={styles.lockedTagText}>Locked</Text>
            </View>
          )}
        </View>

        {/* Meter Type Selector */}
        <View style={styles.meterTypeSection}>
          <Text style={styles.subsectionTitle}>Meter Type</Text>
          <View style={styles.meterTypeButtons}>
            <TouchableOpacity
              style={[
                styles.meterTypeButton,
                meterType === 'HOUR_METER' && styles.meterTypeButtonActive
              ]}
              onPress={() => setMeterType('HOUR_METER')}
              disabled={isSubmitting}
            >
              <Clock size={20} color={meterType === 'HOUR_METER' ? '#fff' : '#3b82f6'} />
              <Text style={[
                styles.meterTypeText,
                meterType === 'HOUR_METER' && styles.meterTypeTextActive
              ]}>Hour Meter</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.meterTypeButton,
                meterType === 'ODOMETER' && styles.meterTypeButtonActive
              ]}
              onPress={() => setMeterType('ODOMETER')}
              disabled={isSubmitting}
            >
              <Gauge size={20} color={meterType === 'ODOMETER' ? '#fff' : '#3b82f6'} />
              <Text style={[
                styles.meterTypeText,
                meterType === 'ODOMETER' && styles.meterTypeTextActive
              ]}>Odometer (km)</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Readings */}
        <View style={styles.readingsSection}>
          <Text style={styles.subsectionTitle}>
            {meterType === 'HOUR_METER' ? 'Hour Meter Readings' : 'Odometer Readings (km)'}
          </Text>
          
          <View style={styles.inputGroup}>
            <View style={styles.inputHeader}>
              <Clock size={20} color="#10b981" />
              <Text style={styles.inputLabel}>
                {meterType === 'HOUR_METER' ? 'Opening Hours *' : 'Opening Reading (km) *'}
              </Text>
            </View>
            <TextInput
              style={[
                styles.input,
                openHoursCommitted && styles.inputCommitted,
                (hasSubmittedToday && !isLocked) && styles.inputEditable,
                isLocked && styles.inputLocked
              ]}
              placeholder={meterType === 'HOUR_METER' ? 'Enter opening hour meter reading' : 'Enter opening odometer reading (km)'}
              placeholderTextColor="#94a3b8"
              value={openHours}
              onChangeText={setOpenHours}
              keyboardType="decimal-pad"
              editable={!isSubmitting && !isLocked && !openHoursCommitted}
            />
            {openHoursCommitted && !hasSubmittedToday ? (
              <Text style={styles.committedText}>✓ Opening reading committed</Text>
            ) : null}
            {!openHoursCommitted && openHours.trim().length > 0 && !hasSubmittedToday && (
              <TouchableOpacity
                style={styles.commitButton}
                onPress={() => {
                  const openNum = parseFloat(openHours);
                  if (isNaN(openNum) || openNum < 0) {
                    Alert.alert('Invalid Reading', 'Please enter a valid numeric value');
                  } else {
                    setOpenHoursCommitted(true);
                    Alert.alert('Opening Reading Committed', 'You can now enter the closing reading');
                  }
                }}
              >
                <Text style={styles.commitButtonText}>Commit Opening Reading</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputHeader}>
              <Clock size={20} color="#ef4444" />
              <Text style={styles.inputLabel}>
                {meterType === 'HOUR_METER' ? 'Closing Hours *' : 'Closing Reading (km) *'}
              </Text>
            </View>
            <TextInput
              style={[
                styles.input,
                !openHoursCommitted && styles.inputDisabledPlant,
                (hasSubmittedToday && !isLocked) && styles.inputEditable,
                isLocked && styles.inputLocked
              ]}
              placeholder={openHoursCommitted ? (meterType === 'HOUR_METER' ? 'Enter closing hour meter reading' : 'Enter closing odometer reading (km)') : 'Commit opening reading first'}
              placeholderTextColor="#94a3b8"
              value={closeHours}
              onChangeText={setCloseHours}
              keyboardType="decimal-pad"
              editable={!isSubmitting && !isLocked && openHoursCommitted}
            />
            {!openHoursCommitted && !hasSubmittedToday ? (
              <Text style={styles.warningText}>⚠️ Please commit opening reading first</Text>
            ) : null}
          </View>

          {openHours && closeHours && (
            <View style={styles.totalHoursDisplay}>
              <Text style={styles.totalHoursLabel}>Total {meterType === 'HOUR_METER' ? 'Hours' : 'Distance'}:</Text>
              <Text style={styles.totalHoursValue}>
                {calculateTotalHours(openHours, closeHours).toFixed(2)} {meterType === 'HOUR_METER' ? 'hours' : 'km'}
              </Text>
            </View>
          )}
        </View>

        {/* Status Toggles */}
        <View style={styles.logBreakdownSection}>
          <Text style={styles.subsectionTitle}>Equipment Status</Text>
          <Text style={styles.helperText}>Optional: Select if applicable</Text>
          
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Breakdown</Text>
            <Switch
              value={logBreakdown}
              onValueChange={setLogBreakdown}
              trackColor={{ false: '#e2e8f0', true: '#fecaca' }}
              thumbColor={logBreakdown ? '#ef4444' : '#f4f4f5'}
            />
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Scheduled Maintenance</Text>
            <Switch
              value={scheduledMaintenance}
              onValueChange={setScheduledMaintenance}
              trackColor={{ false: '#e2e8f0', true: '#bfdbfe' }}
              thumbColor={scheduledMaintenance ? '#3b82f6' : '#f4f4f5'}
            />
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Rain Day</Text>
            <Switch
              value={rainDay}
              onValueChange={setRainDay}
              trackColor={{ false: '#e2e8f0', true: '#bae6fd' }}
              thumbColor={rainDay ? '#0ea5e9' : '#f4f4f5'}
            />
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Strike Day</Text>
            <Switch
              value={strikeDay}
              onValueChange={setStrikeDay}
              trackColor={{ false: '#e2e8f0', true: '#fed7aa' }}
              thumbColor={strikeDay ? '#fb923c' : '#f4f4f5'}
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleLabelWithIcon}>
              <Link2 size={18} color="#8b5cf6" />
              <Text style={styles.toggleLabel}>Attachment</Text>
            </View>
            <Switch
              value={hasAttachment}
              onValueChange={setHasAttachment}
              trackColor={{ false: '#e2e8f0', true: '#ddd6fe' }}
              thumbColor={hasAttachment ? '#8b5cf6' : '#f4f4f5'}
            />
          </View>
        </View>

        {/* Weather Impact */}
        <View style={styles.weatherSection}>
          <View style={styles.toggleRow}>
            <View style={styles.weatherHeader}>
              <CloudRain size={20} color="#64748b" />
              <Text style={styles.toggleLabel}>Inclement Weather</Text>
            </View>
            <Switch
              value={inclementWeather}
              onValueChange={setInclementWeather}
              trackColor={{ false: '#e2e8f0', true: '#fbbf24' }}
              thumbColor={inclementWeather ? '#f59e0b' : '#f4f4f5'}
            />
          </View>

          {inclementWeather && (
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe weather impact (rain, wind, etc.) *"
              placeholderTextColor="#94a3b8"
              value={weatherNotes}
              onChangeText={setWeatherNotes}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
              editable={!isSubmitting}
            />
          )}
        </View>

        {/* Notes */}
        <View style={styles.inputGroup}>
          <View style={styles.inputHeader}>
            <FileText size={20} color="#3b82f6" />
            <Text style={styles.inputLabel}>Additional Notes</Text>
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
        {!hasSubmittedToday && (
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
                <Text style={styles.submitButtonText}>Submit Plant Hours</Text>
              </>
            )}
          </TouchableOpacity>
        )}
        
        {hasSubmittedToday && !isLocked && (
          <>
            <TouchableOpacity
              style={[styles.updateButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleSubmitTimesheet}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Send size={20} color="#fff" />
                  <Text style={styles.submitButtonText}>Update Plant Hours</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButtonMain}
              onPress={handleDeleteTimesheet}
              disabled={isSubmitting}
            >
              <Trash2 size={20} color="#fff" />
              <Text style={styles.deleteButtonText}>Delete Timesheet</Text>
            </TouchableOpacity>
          </>
        )}
        
        {isLocked && (
          <View style={styles.lockedButton}>
            <Lock size={20} color="#dc2626" />
            <Text style={styles.lockedButtonText}>Timesheet Locked at 23:55</Text>
          </View>
        )}

        <View style={styles.infoBox}>
          <AlertCircle size={16} color="#3b82f6" />
          <Text style={styles.infoText}>
            Plant hours are permanently recorded with the asset and persist across operator changes.
          </Text>
        </View>
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
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 20,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
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
  assetReg: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  assetRegSelected: {
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
  readingsSection: {
    marginBottom: 20,
  },
  totalHoursDisplay: {
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: -8,
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
  logBreakdownSection: {
    marginBottom: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  toggleLabel: {
    fontSize: 15,
    color: '#0f172a',
  },
  toggleLabelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  meterTypeSection: {
    marginBottom: 20,
  },
  meterTypeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  meterTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#3b82f6',
    backgroundColor: '#fff',
  },
  meterTypeButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  meterTypeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3b82f6',
  },
  meterTypeTextActive: {
    color: '#fff',
  },
  weatherSection: {
    marginBottom: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  weatherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationSection: {
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
  },
  flex1: {
    flex: 1,
  },
  ml8: {
    marginLeft: 8,
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
  helperText: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    gap: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#1e40af',
    flex: 1,
    lineHeight: 18,
  },
  editableTag: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 'auto' as any,
  },
  editableTagText: {
    fontSize: 11,
    color: '#92400e',
    fontWeight: '600' as const,
  },
  lockedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 'auto' as any,
    gap: 4,
  },
  lockedTagText: {
    fontSize: 11,
    color: '#dc2626',
    fontWeight: '600' as const,
  },
  inputEditable: {
    borderColor: '#fbbf24',
    backgroundColor: '#fffbeb',
  },
  inputLocked: {
    borderColor: '#fca5a5',
    backgroundColor: '#fef2f2',
  },
  updateButton: {
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  lockedButton: {
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    borderWidth: 2,
    borderColor: '#fca5a5',
  },
  lockedButtonText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  deleteButtonMain: {
    backgroundColor: '#dc2626',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  commitButton: {
    backgroundColor: '#10b981',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  commitButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600' as const,
  },
  committedText: {
    fontSize: 12,
    color: '#10b981',
    marginTop: 6,
    marginLeft: 4,
    fontWeight: '600' as const,
  },
  warningText: {
    fontSize: 12,
    color: '#f59e0b',
    marginTop: 6,
    marginLeft: 4,
    fontWeight: '600' as const,
  },
  inputDisabledPlant: {
    backgroundColor: '#f1f5f9',
    opacity: 0.6,
  },
  inputCommitted: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
});