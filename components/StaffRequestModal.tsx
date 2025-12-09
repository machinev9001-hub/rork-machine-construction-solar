import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { X, Plus, Trash2, Users, ChevronDown, Calendar } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';

type StaffEntry = {
  id: string;
  employeeType: string;
  quantity: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (entries: StaffEntry[], requiredDate: Date) => void;
  masterAccountId: string;
  siteId: string;
};

export default function StaffRequestModal({ visible, onClose, onSubmit, masterAccountId, siteId }: Props) {
  const [entries, setEntries] = useState<StaffEntry[]>([
    { id: '1', employeeType: '', quantity: '' }
  ]);
  const [employeeTypes, setEmployeeTypes] = useState<string[]>([]);
  const [isLoadingTypes, setIsLoadingTypes] = useState(false);
  const [showDropdown, setShowDropdown] = useState<string | null>(null);
  const [requiredDate, setRequiredDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const loadEmployeeTypes = useCallback(async () => {
    console.log('👥 ==================== STAFF REQUEST MODAL ====================');
    console.log('👥 [StaffRequestModal] loadEmployeeTypes called');
    console.log('👥 [StaffRequestModal] masterAccountId:', masterAccountId);
    console.log('👥 [StaffRequestModal] siteId:', siteId);
    
    if (!masterAccountId) {
      console.log('👥 [StaffRequestModal] ❌ No masterAccountId, cannot load employee types');
      console.log('👥 ================================================================');
      setIsLoadingTypes(false);
      return;
    }

    setIsLoadingTypes(true);
    try {
      const employeesRef = collection(db, 'employees');
      const q = query(
        employeesRef,
        where('masterAccountId', '==', masterAccountId),
        where('status', '==', 'ACTIVE')
      );
      
      console.log('👥 [StaffRequestModal] Executing query...');
      const snapshot = await getDocs(q);
      console.log('👥 [StaffRequestModal] Query complete. Docs returned:', snapshot.size);
      
      const types = new Set<string>();
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        const isArchived = data.archived === true;
        console.log('[StaffRequestModal] Employee doc:', doc.id, 'Role:', data.role, 'Status:', data.status, 'Archived:', data.archived);
        
        if (data.role && !isArchived) {
          types.add(data.role);
        }
      });
      
      const sortedTypes = Array.from(types).sort();
      console.log('👥 [StaffRequestModal] ✅ Loaded employee types:', sortedTypes);
      console.log('👥 ================================================================');
      setEmployeeTypes(sortedTypes);
    } catch (error) {
      console.error('[StaffRequestModal] ❌ Error loading employee types:', error);
      Alert.alert('Error', 'Failed to load employee types');
    } finally {
      setIsLoadingTypes(false);
    }
  }, [masterAccountId, siteId]);

  useEffect(() => {
    if (visible) {
      loadEmployeeTypes();
    }
  }, [visible, loadEmployeeTypes]);

  const addEntry = () => {
    const newId = String(Date.now());
    setEntries([...entries, { id: newId, employeeType: '', quantity: '' }]);
  };

  const removeEntry = (id: string) => {
    if (entries.length === 1) {
      Alert.alert('Error', 'You must have at least one entry');
      return;
    }
    setEntries(entries.filter(entry => entry.id !== id));
  };

  const updateEntry = (id: string, field: 'employeeType' | 'quantity', value: string) => {
    setEntries(entries.map(entry => 
      entry.id === id ? { ...entry, [field]: value } : entry
    ));
    if (field === 'employeeType') {
      setShowDropdown(null);
    }
  };

  const handleSubmit = () => {
    const validEntries = entries.filter(e => e.employeeType && e.quantity);
    
    if (validEntries.length === 0) {
      Alert.alert('Error', 'Please add at least one employee type with quantity');
      return;
    }

    for (const entry of validEntries) {
      const qty = parseInt(entry.quantity, 10);
      if (isNaN(qty) || qty <= 0) {
        Alert.alert('Error', 'Please enter valid quantities (positive numbers)');
        return;
      }
    }

    onSubmit(validEntries, requiredDate);
    setEntries([{ id: '1', employeeType: '', quantity: '' }]);
    setRequiredDate(new Date());
    setShowDropdown(null);
  };

  const handleClose = () => {
    setEntries([{ id: '1', employeeType: '', quantity: '' }]);
    setRequiredDate(new Date());
    setShowDropdown(null);
    onClose();
  };

  const formatDate = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const onDateChange = (_event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setRequiredDate(selectedDate);
    }
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
              <View style={[styles.iconContainer, { backgroundColor: '#f3e8ff' }]}>
                <Users size={24} color="#8b5cf6" strokeWidth={2.5} />
              </View>
              <View>
                <Text style={styles.modalTitle}>Staff Request</Text>
                <Text style={styles.modalSubtitle}>Request staff resources</Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X size={24} color="#5f6368" strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {isLoadingTypes ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#8b5cf6" />
                <Text style={styles.loadingText}>Loading employee types...</Text>
              </View>
            ) : employeeTypes.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Users size={48} color="#9ca3af" strokeWidth={1.5} />
                <Text style={styles.emptyText}>No employee types available</Text>
                <Text style={styles.emptySubtext}>
                  Add employees to your site first
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.instructionText}>
                  Select employee type and enter requested quantity for each role
                </Text>

                <View style={styles.datePickerContainer}>
                  <Text style={styles.inputLabel}>Required Date *</Text>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Calendar size={20} color="#8b5cf6" strokeWidth={2} />
                    <Text style={styles.dateButtonText}>{formatDate(requiredDate)}</Text>
                  </TouchableOpacity>
                </View>

                {showDatePicker && (
                  <DateTimePicker
                    value={requiredDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onDateChange}
                    minimumDate={new Date()}
                  />
                )}

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
                      <Text style={styles.inputLabel}>Employee Type / Role *</Text>
                      <TouchableOpacity
                        style={styles.dropdownButton}
                        onPress={() => setShowDropdown(showDropdown === entry.id ? null : entry.id)}
                      >
                        <Text style={[styles.dropdownText, !entry.employeeType && styles.placeholderText]}>
                          {entry.employeeType || 'Select employee type'}
                        </Text>
                        <ChevronDown size={20} color="#5f6368" strokeWidth={2} />
                      </TouchableOpacity>
                      
                      {showDropdown === entry.id && (
                        <View style={styles.dropdown}>
                          <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                            {employeeTypes.map((type) => (
                              <TouchableOpacity
                                key={type}
                                style={styles.dropdownItem}
                                onPress={() => updateEntry(entry.id, 'employeeType', type)}
                              >
                                <Text style={styles.dropdownItemText}>{type}</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Quantity *</Text>
                      <TextInput
                        style={styles.textInput}
                        value={entry.quantity}
                        onChangeText={(text) => updateEntry(entry.id, 'quantity', text)}
                        placeholder="Enter quantity"
                        placeholderTextColor="#9ca3af"
                        keyboardType="numeric"
                      />
                    </View>

                    {entry.employeeType && entry.quantity && (
                      <View style={styles.previewBadge}>
                        <Text style={styles.previewText}>
                          {entry.employeeType} / {entry.quantity}
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
                  <Plus size={20} color="#8b5cf6" strokeWidth={2.5} />
                  <Text style={styles.addButtonText}>Add Another Role</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>

          {!isLoadingTypes && employeeTypes.length > 0 && (
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
          )}
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
  inputLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#202124',
    marginBottom: 8,
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#e8eaed',
  },
  dropdownText: {
    fontSize: 14,
    color: '#202124',
    flex: 1,
  },
  placeholderText: {
    color: '#9ca3af',
  },
  dropdown: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1.5,
    borderColor: '#e8eaed',
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#202124',
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
    backgroundColor: '#f3e8ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#e9d5ff',
  },
  previewText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#5b21b6',
  },
  datePickerContainer: {
    marginBottom: 20,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#e8eaed',
  },
  dateButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#202124',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f3e8ff',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e9d5ff',
    marginTop: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#8b5cf6',
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#5f6368',
    marginTop: 16,
  },
  emptyContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#5f6368',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
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
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#ffffff',
  },
});
