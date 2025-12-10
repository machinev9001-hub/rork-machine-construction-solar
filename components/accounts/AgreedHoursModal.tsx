import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { X, Check } from 'lucide-react-native';

type ViewMode = 'plant' | 'man';

type AgreedHoursData = {
  agreedHours?: number;
  agreedNormalHours?: number;
  agreedOvertimeHours?: number;
  agreedSundayHours?: number;
  agreedPublicHolidayHours?: number;
  agreedNotes?: string;
};

type TimesheetEntry = {
  id: string;
  date: string;
  operatorName: string;
  assetType?: string;
  plantNumber?: string;
  totalHours?: number;
  totalManHours?: number;
  normalHours?: number;
  overtimeHours?: number;
  sundayHours?: number;
  publicHolidayHours?: number;
  agreedHours?: number;
  agreedNormalHours?: number;
  agreedOvertimeHours?: number;
  agreedSundayHours?: number;
  agreedPublicHolidayHours?: number;
  agreedNotes?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: AgreedHoursData) => Promise<void>;
  timesheet: TimesheetEntry | null;
  viewMode: ViewMode;
};

export default function AgreedHoursModal({
  visible,
  onClose,
  onSubmit,
  timesheet,
  viewMode,
}: Props) {
  const [agreedHours, setAgreedHours] = useState<string>('');
  const [agreedNormalHours, setAgreedNormalHours] = useState<string>('');
  const [agreedOvertimeHours, setAgreedOvertimeHours] = useState<string>('');
  const [agreedSundayHours, setAgreedSundayHours] = useState<string>('');
  const [agreedPublicHolidayHours, setAgreedPublicHolidayHours] = useState<string>('');
  const [agreedNotes, setAgreedNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (timesheet) {
      if (viewMode === 'plant') {
        setAgreedHours(timesheet.agreedHours?.toString() || timesheet.totalHours?.toString() || '');
      } else {
        setAgreedNormalHours(timesheet.agreedNormalHours?.toString() || timesheet.normalHours?.toString() || '');
        setAgreedOvertimeHours(timesheet.agreedOvertimeHours?.toString() || timesheet.overtimeHours?.toString() || '');
        setAgreedSundayHours(timesheet.agreedSundayHours?.toString() || timesheet.sundayHours?.toString() || '');
        setAgreedPublicHolidayHours(timesheet.agreedPublicHolidayHours?.toString() || timesheet.publicHolidayHours?.toString() || '');
      }
      setAgreedNotes(timesheet.agreedNotes || '');
    }
  }, [timesheet, viewMode]);

  const handleSubmit = async () => {
    if (viewMode === 'plant') {
      const hours = parseFloat(agreedHours);
      if (isNaN(hours) || hours < 0) {
        Alert.alert('Invalid Input', 'Please enter a valid number for agreed hours');
        return;
      }
    } else {
      const normal = parseFloat(agreedNormalHours || '0');
      const overtime = parseFloat(agreedOvertimeHours || '0');
      const sunday = parseFloat(agreedSundayHours || '0');
      const publicHoliday = parseFloat(agreedPublicHolidayHours || '0');
      
      if (isNaN(normal) || isNaN(overtime) || isNaN(sunday) || isNaN(publicHoliday)) {
        Alert.alert('Invalid Input', 'Please enter valid numbers for all hour fields');
        return;
      }
      
      if (normal < 0 || overtime < 0 || sunday < 0 || publicHoliday < 0) {
        Alert.alert('Invalid Input', 'Hours cannot be negative');
        return;
      }
    }

    setSubmitting(true);
    try {
      const data: AgreedHoursData = {
        agreedNotes,
      };

      if (viewMode === 'plant') {
        data.agreedHours = parseFloat(agreedHours);
      } else {
        data.agreedNormalHours = parseFloat(agreedNormalHours || '0');
        data.agreedOvertimeHours = parseFloat(agreedOvertimeHours || '0');
        data.agreedSundayHours = parseFloat(agreedSundayHours || '0');
        data.agreedPublicHolidayHours = parseFloat(agreedPublicHolidayHours || '0');
      }

      await onSubmit(data);
      handleClose();
    } catch (error) {
      console.error('[AgreedHoursModal] Submit error:', error);
      Alert.alert('Error', 'Failed to save agreed hours');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setAgreedHours('');
    setAgreedNormalHours('');
    setAgreedOvertimeHours('');
    setAgreedSundayHours('');
    setAgreedPublicHolidayHours('');
    setAgreedNotes('');
    onClose();
  };

  if (!timesheet) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Agree Hours for Billing</Text>
              <Text style={styles.subtitle}>
                {new Date(timesheet.date).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
              <Text style={styles.subtitle}>
                {viewMode === 'plant'
                  ? `${timesheet.assetType || 'Asset'} - ${timesheet.plantNumber || 'N/A'}`
                  : timesheet.operatorName}
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {viewMode === 'plant' ? (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  Agreed Total Hours <Text style={styles.required}>*</Text>
                </Text>
                <Text style={styles.hint}>
                  Plant Manager: {timesheet.totalHours?.toFixed(1) || 0}h
                </Text>
                <TextInput
                  style={styles.input}
                  value={agreedHours}
                  onChangeText={setAgreedHours}
                  keyboardType="decimal-pad"
                  placeholder="0.0"
                />
              </View>
            ) : (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Agreed Normal Hours</Text>
                  <Text style={styles.hint}>
                    Plant Manager: {timesheet.normalHours?.toFixed(1) || 0}h
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={agreedNormalHours}
                    onChangeText={setAgreedNormalHours}
                    keyboardType="decimal-pad"
                    placeholder="0.0"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Agreed Overtime Hours</Text>
                  <Text style={styles.hint}>
                    Plant Manager: {timesheet.overtimeHours?.toFixed(1) || 0}h
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={agreedOvertimeHours}
                    onChangeText={setAgreedOvertimeHours}
                    keyboardType="decimal-pad"
                    placeholder="0.0"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Agreed Sunday Hours</Text>
                  <Text style={styles.hint}>
                    Plant Manager: {timesheet.sundayHours?.toFixed(1) || 0}h
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={agreedSundayHours}
                    onChangeText={setAgreedSundayHours}
                    keyboardType="decimal-pad"
                    placeholder="0.0"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Agreed Public Holiday Hours</Text>
                  <Text style={styles.hint}>
                    Plant Manager: {timesheet.publicHolidayHours?.toFixed(1) || 0}h
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={agreedPublicHolidayHours}
                    onChangeText={setAgreedPublicHolidayHours}
                    keyboardType="decimal-pad"
                    placeholder="0.0"
                  />
                </View>
              </>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Billing Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={agreedNotes}
                onChangeText={setAgreedNotes}
                placeholder="Add notes about agreed hours..."
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={submitting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Check size={20} color="#ffffff" />
                  <Text style={styles.submitButtonText}>Agree Hours</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modal: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1e293b',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1e293b',
    marginBottom: 4,
  },
  required: {
    color: '#ef4444',
  },
  hint: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#1e293b',
    backgroundColor: '#ffffff',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#64748b',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#10b981',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#ffffff',
  },
});
