import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch
} from 'react-native';
import { Clock, Calendar, User, FileText, Send, Coffee, AlertCircle } from 'lucide-react-native';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { queueFirestoreOperation } from '@/utils/offlineQueue';
import NetInfo from '@react-native-community/netinfo';
import { isPublicHoliday, isSunday as checkIsSunday } from '@/utils/publicHolidays';

interface OperatorManHoursTimesheetProps {
  operatorId: string;
  operatorName: string;
  masterAccountId: string;
  companyId?: string;
  siteId?: string;
  siteName?: string;
}

export default function OperatorManHoursTimesheet({
  operatorId,
  operatorName,
  masterAccountId,
  companyId,
  siteId,
  siteName
}: OperatorManHoursTimesheetProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [stopTime, setStopTime] = useState('');
  const [noLunchBreak, setNoLunchBreak] = useState(false);
  const [isSunday, setIsSunday] = useState(false);
  const [isPubHol, setIsPubHol] = useState(false);
  const [publicHolidayName, setPublicHolidayName] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const today = new Date();
    const sundayCheck = checkIsSunday(today);
    const holidayCheck = isPublicHoliday(today, 'South Africa');
    
    setIsSunday(sundayCheck);
    setIsPubHol(holidayCheck.isHoliday);
    setPublicHolidayName(holidayCheck.holidayName || '');
    
    console.log('[OperatorManHours] Date detection:', {
      date: today.toISOString().split('T')[0],
      isSunday: sundayCheck,
      isPublicHoliday: holidayCheck.isHoliday,
      holidayName: holidayCheck.holidayName
    });
  }, []);

  const calculateManHours = (
    start: string, 
    stop: string, 
    noLunch: boolean,
    isSun: boolean,
    isPubHol: boolean
  ): {
    totalHours: number;
    normalHours: number;
    overtimeHours: number;
    sundayHours: number;
    publicHolidayHours: number;
  } => {
    if (!start || !stop) {
      return { totalHours: 0, normalHours: 0, overtimeHours: 0, sundayHours: 0, publicHolidayHours: 0 };
    }

    // Parse times (expected format: HH:MM)
    const [startHour, startMin] = start.split(':').map(Number);
    const [stopHour, stopMin] = stop.split(':').map(Number);

    if (isNaN(startHour) || isNaN(startMin) || isNaN(stopHour) || isNaN(stopMin)) {
      return { totalHours: 0, normalHours: 0, overtimeHours: 0, sundayHours: 0, publicHolidayHours: 0 };
    }

    // Convert to minutes
    const startMinutes = startHour * 60 + startMin;
    const stopMinutes = stopHour * 60 + stopMin;

    // Calculate difference in minutes
    let totalMinutes = stopMinutes - startMinutes;

    // Handle crossing midnight
    if (totalMinutes < 0) {
      totalMinutes += 24 * 60;
    }

    // Deduct lunch break (1 hour) unless "No Lunch Break" is toggled
    if (!noLunch) {
      totalMinutes -= 60; // Subtract 1 hour for lunch
    }

    // Convert to hours (decimal)
    const totalHours = Math.max(0, totalMinutes / 60);

    // Categorize hours
    let normalHours = 0;
    let overtimeHours = 0;
    let sundayHours = 0;
    let publicHolidayHours = 0;

    // If it's a public holiday, all hours go to public holiday category
    if (isPubHol) {
      publicHolidayHours = totalHours;
    }
    // If it's a Sunday, all hours go to Sunday category
    else if (isSun) {
      sundayHours = totalHours;
    }
    // Otherwise, split between normal and overtime
    else {
      const standardHours = 9; // Standard work day is 9 hours
      if (totalHours <= standardHours) {
        normalHours = totalHours;
      } else {
        normalHours = standardHours;
        overtimeHours = totalHours - standardHours;
      }
    }

    return {
      totalHours,
      normalHours,
      overtimeHours,
      sundayHours,
      publicHolidayHours
    };
  };

  const formatTime = (value: string): string => {
    // Remove non-numeric characters
    const numbers = value.replace(/[^\d]/g, '');
    
    if (numbers.length === 0) return '';
    if (numbers.length <= 2) return numbers;
    
    // Format as HH:MM
    const hours = numbers.substring(0, 2);
    const minutes = numbers.substring(2, 4);
    
    // Validate hours and minutes
    const hourNum = parseInt(hours);
    const minNum = parseInt(minutes);
    
    if (hourNum > 23) return '23:' + (minutes || '');
    if (minNum > 59) return hours + ':59';
    
    return hours + ':' + minutes;
  };

  const handleTimeChange = (value: string, setter: (value: string) => void) => {
    const formatted = formatTime(value);
    setter(formatted);
  };

  const validateTimesheet = (): boolean => {
    if (!startTime || !stopTime) {
      Alert.alert('Error', 'Please enter both start and stop times');
      return false;
    }

    // Validate time format
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime)) {
      Alert.alert('Error', 'Invalid start time format. Use HH:MM (24-hour format)');
      return false;
    }

    if (!timeRegex.test(stopTime)) {
      Alert.alert('Error', 'Invalid stop time format. Use HH:MM (24-hour format)');
      return false;
    }

    const hoursBreakdown = calculateManHours(startTime, stopTime, noLunchBreak, isSunday, isPubHol);
    if (hoursBreakdown.totalHours === 0) {
      Alert.alert('Error', 'Total hours cannot be zero');
      return false;
    }

    if (hoursBreakdown.totalHours > 24) {
      Alert.alert('Error', 'Total hours cannot exceed 24 hours in a day');
      return false;
    }

    return true;
  };

  const handleSubmitTimesheet = async () => {
    if (!validateTimesheet()) return;

    try {
      setIsSubmitting(true);

      const hoursBreakdown = calculateManHours(startTime, stopTime, noLunchBreak, isSunday, isPubHol);

      // Create the timesheet entry in operatorTimesheets collection
      const timesheetData = {
        // Core fields
        operatorId,
        operatorName,
        date: new Date().toISOString().split('T')[0],
        
        // Time tracking
        startTime,
        stopTime,
        noLunchBreak,
        isSunday,
        isPublicHoliday: isPubHol,
        publicHolidayName: isPubHol ? publicHolidayName : undefined,
        totalManHours: hoursBreakdown.totalHours,
        normalHours: hoursBreakdown.normalHours,
        overtimeHours: hoursBreakdown.overtimeHours,
        sundayHours: hoursBreakdown.sundayHours,
        publicHolidayHours: hoursBreakdown.publicHolidayHours,
        
        // Site info
        siteId,
        siteName,
        
        // Additional fields
        notes: notes.trim() || undefined,
        masterAccountId,
        companyId,
        status: 'DRAFT', // Start as DRAFT, can be submitted later
      };

      // Check network status
      const netInfo = await NetInfo.fetch();
      
      if (netInfo.isConnected) {
        // Online: Direct Firebase write
        await addDoc(collection(db, 'operatorTimesheets'), {
          ...timesheetData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        
        console.log('[OperatorManHoursTimesheet] Timesheet submitted online');
      } else {
        // Offline: Queue with P0 priority (critical sync)
        await queueFirestoreOperation(
          {
            type: 'add',
            collection: 'operatorTimesheets',
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
        
        console.log('[OperatorManHoursTimesheet] Timesheet queued offline with P0 priority');
      }

      const isOffline = !(await NetInfo.fetch()).isConnected;
      
      let summaryMessage = `Man hours ${isOffline ? 'saved for sync' : 'submitted successfully'}\n` +
        `Start: ${startTime}\n` +
        `Stop: ${stopTime}\n` +
        `Lunch: ${noLunchBreak ? 'No lunch break' : '1 hour lunch deducted'}\n` +
        `Total: ${hoursBreakdown.totalHours.toFixed(2)}h`;
      
      if (hoursBreakdown.normalHours > 0) {
        summaryMessage += `\nNormal: ${hoursBreakdown.normalHours.toFixed(2)}h`;
      }
      if (hoursBreakdown.overtimeHours > 0) {
        summaryMessage += `\nOvertime: ${hoursBreakdown.overtimeHours.toFixed(2)}h`;
      }
      if (hoursBreakdown.sundayHours > 0) {
        summaryMessage += `\nSunday: ${hoursBreakdown.sundayHours.toFixed(2)}h`;
      }
      if (hoursBreakdown.publicHolidayHours > 0) {
        summaryMessage += `\nPublic Holiday: ${hoursBreakdown.publicHolidayHours.toFixed(2)}h`;
      }
      
      if (isOffline) {
        summaryMessage += '\n\n⚡ Will sync when online (Priority: HIGH)';
      }

      Alert.alert(
        'Success',
        summaryMessage,
        [
          {
            text: 'OK',
            onPress: () => {
              // Reset form
              setStartTime('');
              setStopTime('');
              setNoLunchBreak(false);
              setNotes('');
              
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              const sundayCheck = checkIsSunday(tomorrow);
              const holidayCheck = isPublicHoliday(tomorrow, 'South Africa');
              setIsSunday(sundayCheck);
              setIsPubHol(holidayCheck.isHoliday);
              setPublicHolidayName(holidayCheck.holidayName || '');
            }
          }
        ]
      );
    } catch (error) {
      console.error('[OperatorManHoursTimesheet] Error submitting:', error);
      Alert.alert('Error', 'Failed to submit man hours');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentBreakdown = startTime && stopTime 
    ? calculateManHours(startTime, stopTime, noLunchBreak, isSunday, isPubHol)
    : { totalHours: 0, normalHours: 0, overtimeHours: 0, sundayHours: 0, publicHolidayHours: 0 };

  return (
    <View style={styles.container}>
      {/* Hours Counter Blocks */}
      <View style={styles.counterContainer}>
        <View style={[styles.counterBlock, styles.normalCounter]}>
          <Text style={styles.counterLabel}>Normal Hours</Text>
          <Text style={styles.counterValue}>{currentBreakdown.normalHours.toFixed(1)}h</Text>
        </View>
        <View style={[styles.counterBlock, styles.overtimeCounter]}>
          <Text style={styles.counterLabel}>Overtime</Text>
          <Text style={styles.counterValue}>{currentBreakdown.overtimeHours.toFixed(1)}h</Text>
        </View>
        <View style={[styles.counterBlock, styles.sundayCounter]}>
          <Text style={styles.counterLabel}>Sundays</Text>
          <Text style={styles.counterValue}>{currentBreakdown.sundayHours.toFixed(1)}h</Text>
        </View>
        <View style={[styles.counterBlock, styles.holidayCounter]}>
          <Text style={styles.counterLabel}>Holidays</Text>
          <Text style={styles.counterValue}>{currentBreakdown.publicHolidayHours.toFixed(1)}h</Text>
        </View>
      </View>

      <View style={styles.formCard}>
        <View style={styles.header}>
          <User size={24} color="#3b82f6" />
          <Text style={styles.sectionTitle}>Operator Man Hours</Text>
        </View>

        {/* Date Display */}
        <View style={styles.dateDisplay}>
          <Calendar size={16} color="#64748b" />
          <Text style={styles.dateText}>Date: {new Date().toLocaleDateString()}</Text>
        </View>

        {/* Operator Info */}
        <View style={styles.operatorInfo}>
          <Text style={styles.infoLabel}>Operator:</Text>
          <Text style={styles.infoValue}>{operatorName}</Text>
        </View>
        {siteName && (
          <View style={styles.operatorInfo}>
            <Text style={styles.infoLabel}>Site:</Text>
            <Text style={styles.infoValue}>{siteName}</Text>
          </View>
        )}

        {/* Time Entry Section */}
        <View style={styles.timeSection}>
          <Text style={styles.subsectionTitle}>Work Hours</Text>

          <View style={styles.inputGroup}>
            <View style={styles.inputHeader}>
              <Clock size={20} color="#10b981" />
              <Text style={styles.inputLabel}>Start Time *</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="HH:MM (24-hour format)"
              placeholderTextColor="#94a3b8"
              value={startTime}
              onChangeText={(value) => handleTimeChange(value, setStartTime)}
              keyboardType="numeric"
              maxLength={5}
              editable={!isSubmitting}
            />
            <Text style={styles.helperText}>e.g., 08:00 for 8:00 AM</Text>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputHeader}>
              <Clock size={20} color="#ef4444" />
              <Text style={styles.inputLabel}>Stop Time *</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="HH:MM (24-hour format)"
              placeholderTextColor="#94a3b8"
              value={stopTime}
              onChangeText={(value) => handleTimeChange(value, setStopTime)}
              keyboardType="numeric"
              maxLength={5}
              editable={!isSubmitting}
            />
            <Text style={styles.helperText}>e.g., 17:30 for 5:30 PM</Text>
          </View>

          {/* Lunch Break Toggle */}
          <View style={styles.lunchBreakRow}>
            <View style={styles.lunchBreakHeader}>
              <Coffee size={20} color="#8b5cf6" />
              <Text style={styles.toggleLabel}>No Lunch Break (adds 1 hour)</Text>
            </View>
            <Switch
              value={noLunchBreak}
              onValueChange={setNoLunchBreak}
              trackColor={{ false: '#e2e8f0', true: '#ddd6fe' }}
              thumbColor={noLunchBreak ? '#8b5cf6' : '#f4f4f5'}
              disabled={isSubmitting}
            />
          </View>
          <Text style={styles.helperText}>By default, 1 hour is deducted for lunch. Toggle this if no lunch was taken.</Text>

          {/* Auto-detected Day Type */}
          {(isSunday || isPubHol) && (
            <View style={styles.autoDetectedBanner}>
              <AlertCircle size={20} color="#0369a1" />
              <View style={styles.autoDetectedText}>
                <Text style={styles.autoDetectedTitle}>Auto-detected:</Text>
                <Text style={styles.autoDetectedValue}>
                  {isPubHol ? `${publicHolidayName} (Public Holiday)` : 'Sunday'}
                </Text>
                <Text style={styles.autoDetectedNote}>
                  Hours will be tracked separately for wage calculations
                </Text>
              </View>
            </View>
          )}

          {/* Total Hours Display */}
          {startTime && stopTime && (() => {
            const breakdown = calculateManHours(startTime, stopTime, noLunchBreak, isSunday, isPubHol);
            return (
              <View style={styles.totalHoursDisplay}>
                <Text style={styles.totalHoursLabel}>Hours Breakdown:</Text>
                <Text style={styles.totalHoursValue}>
                  Total: {breakdown.totalHours.toFixed(2)} hours
                </Text>
                
                <View style={styles.breakdownContainer}>
                  {breakdown.normalHours > 0 && (
                    <View style={styles.breakdownRow}>
                      <View style={[styles.breakdownDot, { backgroundColor: '#10b981' }]} />
                      <Text style={styles.breakdownText}>Normal: {breakdown.normalHours.toFixed(2)}h</Text>
                    </View>
                  )}
                  {breakdown.overtimeHours > 0 && (
                    <View style={styles.breakdownRow}>
                      <View style={[styles.breakdownDot, { backgroundColor: '#f59e0b' }]} />
                      <Text style={styles.breakdownText}>Overtime: {breakdown.overtimeHours.toFixed(2)}h</Text>
                    </View>
                  )}
                  {breakdown.sundayHours > 0 && (
                    <View style={styles.breakdownRow}>
                      <View style={[styles.breakdownDot, { backgroundColor: '#f59e0b' }]} />
                      <Text style={styles.breakdownText}>Sunday: {breakdown.sundayHours.toFixed(2)}h</Text>
                    </View>
                  )}
                  {breakdown.publicHolidayHours > 0 && (
                    <View style={styles.breakdownRow}>
                      <View style={[styles.breakdownDot, { backgroundColor: '#ef4444' }]} />
                      <Text style={styles.breakdownText}>Public Holiday: {breakdown.publicHolidayHours.toFixed(2)}h</Text>
                    </View>
                  )}
                </View>
                
                {!noLunchBreak && !isSunday && !isPubHol && (
                  <Text style={styles.lunchNote}>*1 hour deducted for lunch</Text>
                )}
              </View>
            );
          })()}
        </View>

        {/* Notes */}
        <View style={styles.inputGroup}>
          <View style={styles.inputHeader}>
            <FileText size={20} color="#3b82f6" />
            <Text style={styles.inputLabel}>Notes</Text>
          </View>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Add any notes about today's work..."
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
              <Text style={styles.submitButtonText}>Submit Man Hours</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Standard workday: 9 hours (after 1h lunch). Overtime is calculated for hours exceeding this.
          </Text>
          <Text style={styles.infoText}>
            Sunday and Public Holiday hours are tracked separately.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  dateText: {
    fontSize: 13,
    color: '#64748b',
    marginLeft: 8,
  },
  operatorInfo: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748b',
    marginRight: 8,
  },
  infoValue: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '600',
  },
  timeSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
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
  helperText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 6,
    marginLeft: 4,
  },
  lunchBreakRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  lunchBreakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleLabel: {
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '500',
  },
  totalHoursDisplay: {
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  totalHoursLabel: {
    fontSize: 14,
    color: '#15803d',
    fontWeight: '600',
    marginBottom: 4,
  },
  totalHoursValue: {
    fontSize: 18,
    color: '#15803d',
    fontWeight: '700',
  },
  lunchNote: {
    fontSize: 11,
    color: '#15803d',
    marginTop: 4,
    fontStyle: 'italic',
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
  infoBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  infoText: {
    fontSize: 12,
    color: '#1e40af',
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 4,
  },
  breakdownContainer: {
    marginTop: 12,
    gap: 8,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breakdownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  breakdownText: {
    fontSize: 14,
    color: '#15803d',
    fontWeight: '600',
  },
  counterContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  counterBlock: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  normalCounter: {
    backgroundColor: '#d1fae5',
  },
  overtimeCounter: {
    backgroundColor: '#fef3c7',
  },
  sundayCounter: {
    backgroundColor: '#fed7aa',
  },
  holidayCounter: {
    backgroundColor: '#fecaca',
  },
  counterLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  counterValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  autoDetectedBanner: {
    flexDirection: 'row',
    backgroundColor: '#e0f2fe',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#bae6fd',
    gap: 12,
  },
  autoDetectedText: {
    flex: 1,
  },
  autoDetectedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0369a1',
    marginBottom: 2,
  },
  autoDetectedValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0c4a6e',
    marginBottom: 4,
  },
  autoDetectedNote: {
    fontSize: 11,
    color: '#0369a1',
    fontStyle: 'italic',
  },
});