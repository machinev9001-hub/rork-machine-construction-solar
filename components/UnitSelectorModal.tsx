import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Unit } from '@/utils/unitConversion';
import { UNIT_LABELS, ALL_UNITS } from '@/constants/units';

type UnitSelectorModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (unit: Unit) => void;
  currentUnit?: Unit;
  canonicalUnit?: Unit;
  title?: string;
};

const UNITS: Unit[] = ALL_UNITS as unknown as Unit[];

export default function UnitSelectorModal({
  visible,
  onClose,
  onSelect,
  currentUnit,
  canonicalUnit,
  title = 'Select Unit',
}: UnitSelectorModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          {canonicalUnit && (
            <Text style={styles.modalSubtitle}>
              Values will be converted to {canonicalUnit}
            </Text>
          )}
          <ScrollView style={styles.unitsList}>
            {UNITS.map((unit) => (
              <TouchableOpacity
                key={unit}
                style={[
                  styles.unitOption,
                  currentUnit === unit && styles.unitOptionSelected,
                ]}
                onPress={() => {
                  onSelect(unit);
                }}
              >
                <Text
                  style={[
                    styles.unitOptionText,
                    currentUnit === unit && styles.unitOptionTextSelected,
                  ]}
                >
                  {UNIT_LABELS[unit]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#0f172a',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 16,
  },
  unitsList: {
    maxHeight: 300,
  },
  unitOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  unitOptionSelected: {
    backgroundColor: '#e3f2fd',
    borderColor: '#4285F4',
  },
  unitOptionText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: '#334155',
  },
  unitOptionTextSelected: {
    color: '#4285F4',
    fontWeight: '700' as const,
  },
  closeButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#0f172a',
  },
});
