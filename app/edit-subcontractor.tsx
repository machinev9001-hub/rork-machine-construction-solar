import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { ArrowLeft, Save, Building, User, Phone, Mail, MapPin, FileText, Hash } from 'lucide-react-native';
import { updateSubcontractor, getSubcontractorById } from '@/utils/subcontractorManager';

export default function EditSubcontractorScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [name, setName] = useState('');
  const [legalEntityName, setLegalEntityName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [address, setAddress] = useState('');
  const [companyRegistrationNr, setCompanyRegistrationNr] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [isCrossHire, setIsCrossHire] = useState(false);
  const [crossHireName, setCrossHireName] = useState('');
  const [notes, setNotes] = useState('');

  const [validationErrors, setValidationErrors] = useState<{
    name?: boolean;
    legalEntityName?: boolean;
    contactNumber?: boolean;
    crossHireName?: boolean;
  }>({});

  useEffect(() => {
    loadSubcontractor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSubcontractor = async () => {
    if (!id || typeof id !== 'string') {
      Alert.alert('Error', 'Invalid subcontractor ID');
      router.back();
      return;
    }

    try {
      setIsLoading(true);
      console.log('[EditSubcontractor] Loading subcontractor:', id);
      
      const subcontractor = await getSubcontractorById(id);
      
      if (!subcontractor) {
        Alert.alert('Error', 'Subcontractor not found');
        router.back();
        return;
      }

      setName(subcontractor.name || '');
      setLegalEntityName(subcontractor.legalEntityName || '');
      setContactPerson(subcontractor.contactPerson || '');
      setContactNumber(subcontractor.contactNumber || '');
      setAdminEmail(subcontractor.adminEmail || '');
      setAddress(subcontractor.address || '');
      setCompanyRegistrationNr(subcontractor.companyRegistrationNr || '');
      setVatNumber(subcontractor.vatNumber || '');
      setIsCrossHire(subcontractor.isCrossHire || false);
      setCrossHireName(subcontractor.crossHireName || '');
      setNotes(subcontractor.notes || '');
    } catch (error) {
      console.error('[EditSubcontractor] Error loading subcontractor:', error);
      Alert.alert('Error', 'Failed to load subcontractor');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!id || typeof id !== 'string') {
      Alert.alert('Error', 'Invalid subcontractor ID');
      return;
    }

    const errors: typeof validationErrors = {};

    if (!name.trim()) {
      errors.name = true;
    }

    if (!legalEntityName.trim()) {
      errors.legalEntityName = true;
    }

    if (!contactNumber.trim()) {
      errors.contactNumber = true;
    }

    if (isCrossHire && !crossHireName.trim()) {
      errors.crossHireName = true;
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      Alert.alert('Validation Error', 'Please fill in all required fields.');
      return;
    }

    setValidationErrors({});
    setIsSaving(true);

    try {
      console.log('[EditSubcontractor] Updating subcontractor:', name);
      
      await updateSubcontractor(id, {
        name: name.trim(),
        legalEntityName: legalEntityName.trim(),
        contactPerson: contactPerson.trim() || undefined,
        contactNumber: contactNumber.trim(),
        adminEmail: adminEmail.trim() || undefined,
        address: address.trim() || undefined,
        companyRegistrationNr: companyRegistrationNr.trim() || undefined,
        vatNumber: vatNumber.trim() || undefined,
        isCrossHire,
        crossHireName: isCrossHire ? crossHireName.trim() : undefined,
        notes: notes.trim() || undefined,
      });

      Alert.alert('Success', 'Subcontractor updated successfully', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('[EditSubcontractor] Error updating subcontractor:', error);
      Alert.alert('Error', 'Failed to update subcontractor');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          disabled={isSaving}
        >
          <ArrowLeft size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Subcontractor</Text>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#3b82f6" />
          ) : (
            <Save size={24} color="#3b82f6" />
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Basic Information</Text>

            <View style={styles.inputGroup}>
              <View style={styles.inputLabel}>
                <Building size={18} color={validationErrors.name ? "#ef4444" : "#64748b"} />
                <Text style={[styles.inputLabelText, validationErrors.name && styles.inputLabelTextError]}>
                  Subcontractor Name *
                </Text>
              </View>
              <TextInput
                style={[styles.input, validationErrors.name && styles.inputError]}
                placeholder="Enter subcontractor name"
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  if (validationErrors.name && text.trim()) {
                    setValidationErrors(prev => ({ ...prev, name: false }));
                  }
                }}
                editable={!isSaving}
              />
              {validationErrors.name && (
                <Text style={styles.errorText}>Subcontractor name is required</Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.inputLabel}>
                <FileText size={18} color={validationErrors.legalEntityName ? "#ef4444" : "#64748b"} />
                <Text style={[styles.inputLabelText, validationErrors.legalEntityName && styles.inputLabelTextError]}>
                  Legal Entity Name *
                </Text>
              </View>
              <TextInput
                style={[styles.input, validationErrors.legalEntityName && styles.inputError]}
                placeholder="Enter legal entity name"
                value={legalEntityName}
                onChangeText={(text) => {
                  setLegalEntityName(text);
                  if (validationErrors.legalEntityName && text.trim()) {
                    setValidationErrors(prev => ({ ...prev, legalEntityName: false }));
                  }
                }}
                editable={!isSaving}
              />
              {validationErrors.legalEntityName && (
                <Text style={styles.errorText}>Legal entity name is required</Text>
              )}
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Contact Information</Text>

            <View style={styles.inputGroup}>
              <View style={styles.inputLabel}>
                <User size={18} color="#64748b" />
                <Text style={styles.inputLabelText}>Contact Person</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Enter contact person name"
                value={contactPerson}
                onChangeText={setContactPerson}
                editable={!isSaving}
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.inputLabel}>
                <Phone size={18} color={validationErrors.contactNumber ? "#ef4444" : "#64748b"} />
                <Text style={[styles.inputLabelText, validationErrors.contactNumber && styles.inputLabelTextError]}>
                  Contact Number *
                </Text>
              </View>
              <TextInput
                style={[styles.input, validationErrors.contactNumber && styles.inputError]}
                placeholder="Enter contact number"
                value={contactNumber}
                onChangeText={(text) => {
                  setContactNumber(text);
                  if (validationErrors.contactNumber && text.trim()) {
                    setValidationErrors(prev => ({ ...prev, contactNumber: false }));
                  }
                }}
                keyboardType="phone-pad"
                editable={!isSaving}
              />
              {validationErrors.contactNumber && (
                <Text style={styles.errorText}>Contact number is required</Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.inputLabel}>
                <Mail size={18} color="#64748b" />
                <Text style={styles.inputLabelText}>Admin Email</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Enter admin email"
                value={adminEmail}
                onChangeText={setAdminEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isSaving}
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.inputLabel}>
                <MapPin size={18} color="#64748b" />
                <Text style={styles.inputLabelText}>Address</Text>
              </View>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Enter address"
                value={address}
                onChangeText={setAddress}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                editable={!isSaving}
              />
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Company Details</Text>

            <View style={styles.inputGroup}>
              <View style={styles.inputLabel}>
                <Hash size={18} color="#64748b" />
                <Text style={styles.inputLabelText}>Company Registration Number</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Enter registration number"
                value={companyRegistrationNr}
                onChangeText={setCompanyRegistrationNr}
                editable={!isSaving}
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.inputLabel}>
                <Hash size={18} color="#64748b" />
                <Text style={styles.inputLabelText}>VAT Number</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Enter VAT number"
                value={vatNumber}
                onChangeText={setVatNumber}
                editable={!isSaving}
              />
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Cross-Hire Configuration</Text>

            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text style={styles.switchLabelText}>Cross-Hire Subcontractor</Text>
                <Text style={styles.switchLabelHint}>
                  Enable if this subcontractor owns employees/assets used by you
                </Text>
              </View>
              <Switch
                value={isCrossHire}
                onValueChange={setIsCrossHire}
                trackColor={{ false: '#e2e8f0', true: '#3b82f6' }}
                thumbColor={isCrossHire ? '#fff' : '#f4f3f4'}
                ios_backgroundColor="#e2e8f0"
                disabled={isSaving}
              />
            </View>

            {isCrossHire && (
              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <Building size={18} color={validationErrors.crossHireName ? "#ef4444" : "#64748b"} />
                  <Text style={[styles.inputLabelText, validationErrors.crossHireName && styles.inputLabelTextError]}>
                    Cross-Hire Company Name *
                  </Text>
                </View>
                <TextInput
                  style={[styles.input, validationErrors.crossHireName && styles.inputError]}
                  placeholder="Enter the name of the company that owns the resources"
                  value={crossHireName}
                  onChangeText={(text) => {
                    setCrossHireName(text);
                    if (validationErrors.crossHireName && text.trim()) {
                      setValidationErrors(prev => ({ ...prev, crossHireName: false }));
                    }
                  }}
                  editable={!isSaving}
                />
                {validationErrors.crossHireName && (
                  <Text style={styles.errorText}>Cross-hire company name is required</Text>
                )}
              </View>
            )}

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Cross-hire subcontractors own their employees and plant assets. They are the salary payers 
                and owners, while you hire/use their resources on your projects.
              </Text>
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Notes</Text>

            <View style={styles.inputGroup}>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Add any additional notes..."
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                editable={!isSaving}
              />
            </View>
          </View>

          <View style={styles.noteSection}>
            <Text style={styles.noteText}>* Required fields</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  saveButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 24,
  },
  formSection: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1e293b',
    marginBottom: 4,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputLabelText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#64748b',
  },
  inputLabelTextError: {
    color: '#ef4444',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },
  inputError: {
    borderColor: '#ef4444',
    borderWidth: 2,
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
    fontWeight: '500' as const,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  switchLabel: {
    flex: 1,
    gap: 4,
    marginRight: 16,
  },
  switchLabelText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  switchLabelHint: {
    fontSize: 13,
    color: '#64748b',
  },
  infoBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  infoText: {
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
  noteSection: {
    gap: 8,
    marginTop: 8,
  },
  noteText: {
    fontSize: 13,
    color: '#94a3b8',
    fontStyle: 'italic' as const,
  },
});
