import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { X, Plus, Trash2, Box } from 'lucide-react-native';

type MaterialEntry = {
  id: string;
  materialName: string;
  quantity: string;
  unit: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (entries: MaterialEntry[]) => void;
  masterAccountId: string;
  siteId: string;
};

export default function MaterialsRequestModal({ visible, onClose, onSubmit }: Props) {
  const [entries, setEntries] = useState<MaterialEntry[]>([
    { id: '1', materialName: '', quantity: '', unit: '' }
  ]);

  const addEntry = () => {
    const newId = String(Date.now());
    setEntries([...entries, { id: newId, materialName: '', quantity: '', unit: '' }]);
  };

  const removeEntry = (id: string) => {
    if (entries.length === 1) {
      Alert.alert('Error', 'You must have at least one entry');
      return;
    }
    setEntries(entries.filter(entry => entry.id !== id));
  };

  const updateEntry = (id: string, field: keyof MaterialEntry, value: string) => {
    setEntries(entries.map(entry => 
      entry.id === id ? { ...entry, [field]: value } : entry
    ));
  };

  const handleSubmit = () => {
    const validEntries = entries.filter(e => e.materialName && e.quantity && e.unit);
    
    if (validEntries.length === 0) {
      Alert.alert('Error', 'Please add at least one material with quantity and unit');
      return;
    }

    for (const entry of validEntries) {
      const qty = parseFloat(entry.quantity);
      if (isNaN(qty) || qty <= 0) {
        Alert.alert('Error', 'Please enter valid quantities (positive numbers)');
        return;
      }
    }

    onSubmit(validEntries);
    setEntries([{ id: '1', materialName: '', quantity: '', unit: '' }]);
  };

  const handleClose = () => {
    setEntries([{ id: '1', materialName: '', quantity: '', unit: '' }]);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconContainer, { backgroundColor: '#e0f2fe' }]}>
                <Box size={24} color="#0284c7" strokeWidth={2.5} />
              </View>
              <View>
                <Text style={styles.modalTitle}>Materials Request</Text>
                <Text style={styles.modalSubtitle}>Request materials for this task</Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X size={24} color="#5f6368" strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.instructionText}>
              Enter material name, quantity, and unit for each item
            </Text>

            {entries.map((entry, index) => (
              <View key={entry.id} style={styles.entryCard}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryLabel}>Item {index + 1}</Text>
                  {entries.length > 1 && (
                    <TouchableOpacity
                      onPress={() => removeEntry(entry.id)}
                      style={styles.removeButton}
                    >
                      <Trash2 size={18} color="#ef4444" strokeWidth={2} />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Material Name *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={entry.materialName}
                    onChangeText={(text) => updateEntry(entry.id, 'materialName', text)}
                    placeholder="e.g., Cement, Steel bars, Sand"
                    placeholderTextColor="#9ca3af"
                  />
                </View>

                <View style={styles.rowInputs}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Quantity *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={entry.quantity}
                      onChangeText={(text) => updateEntry(entry.id, 'quantity', text)}
                      placeholder="Enter qty"
                      placeholderTextColor="#9ca3af"
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Unit *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={entry.unit}
                      onChangeText={(text) => updateEntry(entry.id, 'unit', text)}
                      placeholder="e.g., kg, m³"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                </View>

                {entry.materialName && entry.quantity && entry.unit && (
                  <View style={styles.previewBadge}>
                    <Text style={styles.previewText}>
                      {entry.materialName} / {entry.quantity} {entry.unit}
                    </Text>
                  </View>
                )}
              </View>
            ))}

            <TouchableOpacity
              style={styles.addButton}
              onPress={addEntry}
              activeOpacity={0.7}
            >
              <Plus size={20} color="#0284c7" strokeWidth={2.5} />
              <Text style={styles.addButtonText}>Add Another Material</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              activeOpacity={0.7}
            >
              <Text style={styles.submitButtonText}>Submit Request</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e8eaed',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#202124',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#5f6368',
    marginTop: 2,
  },
  closeButton: {
    padding: 8,
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  instructionText: {
    fontSize: 14,
    color: '#5f6368',
    marginBottom: 20,
    lineHeight: 20,
  },
  entryCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#e8eaed',
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  entryLabel: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#202124',
  },
  removeButton: {
    padding: 4,
  },
  inputGroup: {
    marginBottom: 12,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#202124',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#e8eaed',
    fontSize: 14,
    color: '#202124',
  },
  previewBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  previewText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#075985',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#e0f2fe',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#bae6fd',
    marginTop: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#0284c7',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e8eaed',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e8eaed',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#5f6368',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#0284c7',
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#ffffff',
  },
});
