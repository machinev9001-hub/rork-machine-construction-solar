import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import type { Unit } from '@/utils/unitConversion';

type CompletedTodayInputProps = {
  value: string;
  unit: Unit;
  isLocked: boolean;
  lockedValue?: number;
  lockedUnit?: string;
  completedToday: number;
  onValueChange: (text: string) => void;
  onUnitPress: () => void;
  onSubmit: () => Promise<void>;
  onEdit: () => void;
  lockType?: string;
  primaryColor: string;
};

export const CompletedTodayInput = React.memo<CompletedTodayInputProps>(({
  value,
  unit,
  isLocked,
  lockedValue,
  lockedUnit,
  completedToday,
  onValueChange,
  onUnitPress,
  onSubmit,
  onEdit,
  lockType,
  primaryColor,
}) => {
  if (isLocked) {
    return (
      <View style={styles.lockedValueDisplay}>
        <View style={styles.lockedValueRow}>
          <Text style={styles.lockedValueLabel}>🔒 Locked Value:</Text>
          <Text style={styles.lockedValue}>
            {lockedValue ?? completedToday} {lockedUnit ?? unit}
          </Text>
        </View>
        <Text style={styles.lockedInfoText}>
          This value was locked by {lockType === 'QC_INTERACTION' ? 'QC interaction' : 'time lock'} and cannot be edited.
        </Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.inputField, styles.input]}
          value={value}
          onChangeText={onValueChange}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor="#94a3b8"
        />
        <TouchableOpacity
          style={styles.unitSelectButton}
          onPress={onUnitPress}
        >
          <Text style={styles.unitSelectButtonText}>{unit}</Text>
          <ChevronRight size={16} color="#4285F4" />
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={[styles.submitButton, { backgroundColor: primaryColor }]}
        onPress={onSubmit}
      >
        <Text style={styles.submitButtonText}>Submit</Text>
      </TouchableOpacity>
      {completedToday > 0 && (
        <View style={styles.currentProgressDisplay}>
          <Text style={styles.currentProgressLabel}>Today&apos;s Submission:</Text>
          <View style={styles.submissionValueRow}>
            <Text style={styles.currentProgressValue}>
              {completedToday} {unit}
            </Text>
            <TouchableOpacity 
              style={styles.editButton}
              onPress={onEdit}
            >
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </>
  );
});

CompletedTodayInput.displayName = 'CompletedTodayInput';

const styles = StyleSheet.create({
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'stretch',
  },
  input: {
    flex: 1,
  },
  inputField: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dadce0',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#202124',
  },
  unitSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: '#e3f2fd',
    borderWidth: 1,
    borderColor: '#4285F4',
    minWidth: 70,
    justifyContent: 'center',
  },
  unitSelectButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4285F4',
  },
  submitButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  currentProgressDisplay: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f0f9ff',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#0ea5e9',
  },
  currentProgressLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0c4a6e',
  },
  currentProgressValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0369a1',
  },
  submissionValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  editButton: {
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  lockedValueDisplay: {
    backgroundColor: '#fff3cd',
    borderWidth: 2,
    borderColor: '#fbbf24',
    borderRadius: 8,
    padding: 16,
  },
  lockedValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  lockedValueLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400e',
  },
  lockedValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#92400e',
  },
  lockedInfoText: {
    fontSize: 12,
    color: '#92400e',
    lineHeight: 18,
    fontStyle: 'italic',
  },
});
