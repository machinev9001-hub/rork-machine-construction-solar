import { Stack, router } from 'expo-router';
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Building2, CheckCircle, ChevronDown, X, ArrowLeft } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { addDoc, collection, serverTimestamp, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { INDUSTRY_SECTORS } from '@/constants/industrySectors';

export default function CompanySetupScreen() {
  const { masterAccount, user, refreshMasterAccount } = useAuth();
  const [legalEntityName, setLegalEntityName] = useState('');
  const [alias, setAlias] = useState('');
  const [address, setAddress] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [adminContact, setAdminContact] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [companyRegistrationNr, setCompanyRegistrationNr] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [industrySector, setIndustrySector] = useState('');
  const [showSectorModal, setShowSectorModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateCompany = async () => {
    if (!legalEntityName.trim()) {
      Alert.alert('Error', 'Please enter company legal entity name');
      return;
    }

    if (!alias.trim()) {
      Alert.alert('Error', 'Please enter company alias/short name');
      return;
    }

    if (!address.trim()) {
      Alert.alert('Error', 'Please enter company address');
      return;
    }

    if (!contactNumber.trim()) {
      Alert.alert('Error', 'Please enter contact number');
      return;
    }

    if (!adminContact.trim()) {
      Alert.alert('Error', 'Please enter admin contact');
      return;
    }

    if (!adminEmail.trim()) {
      Alert.alert('Error', 'Please enter admin email');
      return;
    }

    if (!companyRegistrationNr.trim()) {
      Alert.alert('Error', 'Please enter company registration number');
      return;
    }

    if (!vatNumber.trim()) {
      Alert.alert('Error', 'Please enter VAT number');
      return;
    }

    if (!industrySector) {
      Alert.alert('Error', 'Please select an industry sector');
      return;
    }

    const creatorId = masterAccount?.id || user?.id;
    if (!creatorId) {
      Alert.alert('Error', 'You must be logged in to create a company');
      return;
    }

    setIsLoading(true);
    console.log('[CompanySetup] Starting company creation...');

    try {
      console.log('[CompanySetup] Saving to database...');
      
      const companyRef = await addDoc(collection(db, 'companies'), {
        legalEntityName: legalEntityName.trim(),
        alias: alias.trim(),
        address: address.trim(),
        contactNumber: contactNumber.trim(),
        adminContact: adminContact.trim(),
        adminEmail: adminEmail.trim(),
        companyRegistrationNr: companyRegistrationNr.trim(),
        vatNumber: vatNumber.trim(),
        industrySector: industrySector,
        status: 'Active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: creatorId,
      });

      console.log('[CompanySetup] ✅ Company saved with ID:', companyRef.id);

      // Update the appropriate account type with the new company ID
      if (masterAccount) {
        console.log('[CompanySetup] Updating master account with new company ID...');
        const masterRef = doc(db, 'masterAccounts', masterAccount.id);
        await updateDoc(masterRef, {
          companyIds: arrayUnion(companyRef.id)
        });
        console.log('[CompanySetup] ✅ Master account updated');
      } else if (user && user.role !== 'master') {
        // Only update users collection if it's not a master account
        console.log('[CompanySetup] Updating regular user with new company ID...');
        const userRef = doc(db, 'users', user.id);
        await updateDoc(userRef, {
          companyIds: arrayUnion(companyRef.id)
        });
        console.log('[CompanySetup] ✅ User updated');
      } else if (user && user.role === 'master' && user.masterAccountId) {
        // If user object represents a master account, update masterAccounts collection
        console.log('[CompanySetup] User is a master account, updating masterAccounts collection...');
        const masterRef = doc(db, 'masterAccounts', user.masterAccountId);
        await updateDoc(masterRef, {
          companyIds: arrayUnion(companyRef.id)
        });
        console.log('[CompanySetup] ✅ Master account (via user object) updated');
      }
      
      console.log('[CompanySetup] ✅ All updates complete!');
      
      // Refresh master account state to get the updated companyIds
      console.log('[CompanySetup] Refreshing master account state...');
      await refreshMasterAccount();
      console.log('[CompanySetup] ✅ Master account state refreshed');
      
      Alert.alert('Success', 'Company created successfully', [
        {
          text: 'OK',
          onPress: async () => {
            console.log('[CompanySetup] Success alert acknowledged, navigating...');
            
            // Clear form fields
            setLegalEntityName('');
            setAlias('');
            setAddress('');
            setContactNumber('');
            setAdminContact('');
            setAdminEmail('');
            setCompanyRegistrationNr('');
            setVatNumber('');
            setIndustrySector('');
            
            // Force navigation after clearing form
            setIsLoading(false);
            
            // Navigate to company selector to pick the new company
            console.log('[CompanySetup] Navigating to company-selector to select new company');
            router.replace('/company-selector');
          }
        }
      ]);
    } catch (error) {
      console.error('[CompanySetup] ❌ Error creating company:', error);
      setIsLoading(false);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create company. Please try again.';
      Alert.alert('Error', errorMessage);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <Modal
        visible={showSectorModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSectorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Industry Sector</Text>
              <TouchableOpacity onPress={() => setShowSectorModal(false)}>
                <X size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sectorList}>
              {INDUSTRY_SECTORS.map((sector) => (
                <TouchableOpacity
                  key={sector}
                  style={[
                    styles.sectorItem,
                    industrySector === sector && styles.sectorItemSelected,
                  ]}
                  onPress={() => {
                    setIndustrySector(sector);
                    setShowSectorModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.sectorItemText,
                      industrySector === sector && styles.sectorItemTextSelected,
                    ]}
                  >
                    {sector}
                  </Text>
                  {industrySector === sector && (
                    <CheckCircle size={20} color="#3b82f6" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      <LinearGradient colors={['#1e3a8a', '#3b82f6', '#60a5fa']} style={styles.gradient}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <TouchableOpacity
              style={styles.exitButton}
              onPress={() => router.back()}
              disabled={isLoading}
            >
              <ArrowLeft size={24} color="#fff" />
              <Text style={styles.exitButtonText}>Exit</Text>
            </TouchableOpacity>

            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <Building2 size={48} color="#fff" strokeWidth={2} />
              </View>
              <Text style={styles.title}>Setup Your Company</Text>
              <Text style={styles.subtitle}>
                Enter your company details to get started
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Industry Sector *</Text>
                <TouchableOpacity
                  style={styles.selectorButton}
                  onPress={() => setShowSectorModal(true)}
                  disabled={isLoading}
                >
                  <Text style={[styles.selectorText, !industrySector && styles.placeholderText]}>
                    {industrySector || 'Select industry sector'}
                  </Text>
                  <ChevronDown size={20} color="#64748b" />
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Legal Entity Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., ABC Construction (Pty) Ltd"
                  placeholderTextColor="#94a3b8"
                  value={legalEntityName}
                  onChangeText={setLegalEntityName}
                  autoCapitalize="words"
                  editable={!isLoading}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Company Alias/Short Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., ABC Construction"
                  placeholderTextColor="#94a3b8"
                  value={alias}
                  onChangeText={setAlias}
                  autoCapitalize="words"
                  editable={!isLoading}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Company Address *</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Enter full company address"
                  placeholderTextColor="#94a3b8"
                  value={address}
                  onChangeText={setAddress}
                  multiline
                  numberOfLines={3}
                  editable={!isLoading}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Contact Number *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., +27 12 345 6789"
                  placeholderTextColor="#94a3b8"
                  value={contactNumber}
                  onChangeText={setContactNumber}
                  keyboardType="phone-pad"
                  editable={!isLoading}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Admin Contact *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Admin contact number"
                  placeholderTextColor="#94a3b8"
                  value={adminContact}
                  onChangeText={setAdminContact}
                  keyboardType="phone-pad"
                  editable={!isLoading}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Admin Email *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="admin@company.com"
                  placeholderTextColor="#94a3b8"
                  value={adminEmail}
                  onChangeText={setAdminEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!isLoading}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Company Registration Number *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 2021/123456/07"
                  placeholderTextColor="#94a3b8"
                  value={companyRegistrationNr}
                  onChangeText={setCompanyRegistrationNr}
                  editable={!isLoading}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>VAT Number *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 4123456789"
                  placeholderTextColor="#94a3b8"
                  value={vatNumber}
                  onChangeText={setVatNumber}
                  editable={!isLoading}
                />
              </View>

              <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleCreateCompany}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#1e3a8a" />
                ) : (
                  <>
                    <CheckCircle size={20} color="#1e3a8a" />
                    <Text style={styles.buttonText}>Create Company</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e3a8a',
  },
  gradient: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 96,
    height: 96,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#cbd5e1',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  form: {
    gap: 20,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1e293b',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1e3a8a',
  },
  selectorButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorText: {
    fontSize: 16,
    color: '#1e293b',
  },
  placeholderText: {
    color: '#94a3b8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  sectorList: {
    paddingHorizontal: 16,
  },
  sectorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    marginVertical: 4,
  },
  sectorItemSelected: {
    backgroundColor: '#eff6ff',
  },
  sectorItemText: {
    fontSize: 16,
    color: '#475569',
    flex: 1,
  },
  sectorItemTextSelected: {
    color: '#3b82f6',
    fontWeight: '600' as const,
  },
  exitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  exitButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
});
