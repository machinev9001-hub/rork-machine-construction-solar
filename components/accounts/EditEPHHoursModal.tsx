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
import { X, Save } from 'lucide-react-native';

type TimesheetEntry = {
  id: string;
  date: string;
  operatorName: string;
  assetType?: string;
  plantNumber?: string;
  totalHours?: number;
  openHours?: string | number;
  closeHours?: string | number;
  isBreakdown?: boolean;
  isRainDay?: boolean;
  isStrikeDay?: boolean;
  isPublicHoliday?: boolean;
  notes?: string;
};

type EditedValues = {
  totalHours: number;
  openHours: string;
  closeHours: string;
  isBreakdown: boolean;
  isRainDay: boolean;
  isStrikeDay: boolean;
  isPublicHoliday: boolean;
  adminNotes: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSave: (editedValues: EditedValues) => Promise<void>;
  timesheet: TimesheetEntry | null;
};

export default function EditEPHHoursModal({
  visible,
  onClose,
  onSave,
  timesheet,
}: Props) {
  const [totalHours, setTotalHours] = useState<string>('');
  const [openHours, setOpenHours] = useState<string>('');
  const [closeHours, setCloseHours] = useState<string>('');
  const [isBreakdown, setIsBreakdown] = useState(false);
  const [isRainDay, setIsRainDay] = useState(false);
  const [isStrikeDay, setIsStrikeDay] = useState(false);
  const [isPublicHoliday, setIsPublicHoliday] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (timesheet) {
      setTotalHours(timesheet.totalHours?.toString() || '');
      setOpenHours(timesheet.openHours?.toString() || '');
      setCloseHours(timesheet.closeHours?.toString() || '');
      setIsBreakdown(timesheet.isBreakdown || false);
      setIsRainDay(timesheet.isRainDay || false);
      setIsStrikeDay(timesheet.isStrikeDay || false);
      setIsPublicHoliday(timesheet.isPublicHoliday || false);
      setAdminNotes(timesheet.notes || '');
    }
  }, [timesheet]);

  const handleSave = async () => {
    const hours = parseFloat(totalHours);
    if (isNaN(hours) || hours < 0) {
      Alert.alert('Invalid Input', 'Please enter a valid number for total hours');
      return;
    }

    setSubmitting(true);
    try {
      await onSave({
        totalHours: hours,
        openHours,
        closeHours,
        isBreakdown,
        isRainDay,
        isStrikeDay,
        isPublicHoliday,
        adminNotes,
      });
      handleClose();
    } catch (error) {
      console.error('[EditEPHHoursModal] Error saving:', error);
      Alert.alert('Error', 'Failed to save edited hours');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setTotalHours('');
    setOpenHours('');
    setCloseHours('');
    setIsBreakdown(false);
    setIsRainDay(false);
    setIsStrikeDay(false);
    setIsPublicHoliday(false);
    setAdminNotes('');
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
              <Text style={styles.title}>Edit Hours (Admin)</Text>
              <Text style={styles.subtitle}>
                {new Date(timesheet.date).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
              <Text style={styles.subtitle}>
                {timesheet.assetType} - {timesheet.plantNumber}
              </Text>
              <Text style={styles.subtitle}>Operator: {timesheet.operatorName}</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                ⚠️ Changes will require subcontractor re-approval before finalizing
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Total Hours <Text style={styles.required}>*</Text>
              </Text>
              <Text style={styles.hint}>
                Plant Manager: {timesheet.totalHours?.toFixed(1) || 0}h
              </Text>
              <TextInput
                style={styles.input}
                value={totalHours}
                onChangeText={setTotalHours}
                keyboardType="decimal-pad"
                placeholder="0.0"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Open Hours</Text>
                <TextInput
                  style={styles.input}
                  value={openHours}
                  onChangeText={setOpenHours}
                  placeholder="08:00"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Close Hours</Text>
                <TextInput
                  style={styles.input}
                  value={closeHours}
                  onChangeText={setCloseHours}
                  placeholder="17:00"
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </View>

            <View style={styles.checkboxGroup}>
              <Text style={styles.label}>Day Conditions</Text>
              
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => setIsBreakdown(!isBreakdown)}
              >
                <View style={[styles.checkboxBox, isBreakdown && styles.checkboxBoxChecked]}>
                  {isBreakdown && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>Breakdown</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => setIsRainDay(!isRainDay)}
              >
                <View style={[styles.checkboxBox, isRainDay && styles.checkboxBoxChecked]}>
                  {isRainDay && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>Rain Day</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => setIsStrikeDay(!isStrikeDay)}
              >
                <View style={[styles.checkboxBox, isStrikeDay && styles.checkboxBoxChecked]}>
                  {isStrikeDay && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>Strike Day</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => setIsPublicHoliday(!isPublicHoliday)}
              >
                <View style={[styles.checkboxBox, isPublicHoliday && styles.checkboxBoxChecked]}>
                  {isPublicHoliday && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>Public Holiday</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Admin Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={adminNotes}
                onChangeText={setAdminNotes}
                placeholder="Add notes about the edits..."
                placeholderTextColor="#9ca3af"
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
              onPress={handleSave}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Save size={20} color="#ffffff" />
                  <Text style={styles.submitButtonText}>Save Edits</Text>
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
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  warningBox: {
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  warningText: {
    fontSize: 13,
    color: '#92400e',
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
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
  checkboxGroup: {
    marginBottom: 20,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxChecked: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  checkmark: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '700' as const,
  },
  checkboxLabel: {
    fontSize: 15,
    color: '#1e293b',
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
    backgroundColor: '#3b82f6',
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
