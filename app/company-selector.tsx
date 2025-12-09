import { Stack, router, useFocusEffect } from 'expo-router';
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Building2, ChevronRight, Plus, Edit2, X, Save, ChevronDown, CheckCircle } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Company } from '@/types';
import { INDUSTRY_SECTORS } from '@/constants/industrySectors';

export default function CompanySelectorScreen() {
  const { user, masterAccount, selectCompany, refreshMasterAccount } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const loadInProgress = useRef(false);
  const hasLoadedOnce = useRef(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editForm, setEditForm] = useState<Partial<Company>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showSectorModal, setShowSectorModal] = useState(false);

  const handleSelectCompany = useCallback(async (company: Company) => {
    console.log('[CompanySelector] Company selected:', company.alias);
    
    if (!selectCompany) {
      console.error('[CompanySelector] selectCompany function not available');
      return;
    }

    const result = await selectCompany(company.id);
    
    if (result.success) {
      console.log('[CompanySelector] Company selected successfully');
      console.log('[CompanySelector] User role:', user?.role, 'MasterAccount:', !!masterAccount);
      
      if (user?.role === 'master' || masterAccount) {
        console.log('[CompanySelector] Master account → navigating to /master-sites');
        router.push('/master-sites');
      } else if (user) {
        console.log('[CompanySelector] User role:', user.role);
        
        switch (user.role) {
          case 'Planner':
          case 'Supervisor':
          case 'Admin':
          case 'Plant Manager':
          case 'Staff Manager':
          case 'Logistics Manager':
            router.replace('/(tabs)');
            break;
          case 'QC':
            router.replace('/qc-requests');
            break;
          case 'Onboarding & Inductions':
            router.replace('/onboarding-dashboard');
            break;
          default:
            router.replace('/(tabs)');
            break;
        }
      }
    } else {
      console.error('[CompanySelector] Failed to select company:', result.error);
    }
  }, [selectCompany, user, masterAccount]);

  const loadCompanies = useCallback(async () => {
    if (loadInProgress.current) {
      console.log('[CompanySelector] Load already in progress, skipping');
      return;
    }

    loadInProgress.current = true;
    setIsLoading(true);
    
    try {
      console.log('[CompanySelector] Loading companies...');
      console.log('[CompanySelector] Current user:', user?.userId, 'role:', user?.role);
      console.log('[CompanySelector] Current masterAccount:', masterAccount?.masterId);
      
      // Refresh master account to get latest companyIds
      await refreshMasterAccount();
      
      // Get master data from user or masterAccount
      const masterData = user?.role === 'master' ? user : masterAccount;
      const companyIds = masterData?.companyIds || [];
      
      console.log('[CompanySelector] Found', companyIds.length, 'company IDs');

      if (companyIds.length === 0) {
        console.log('[CompanySelector] No companies found');
        if (masterData && !hasLoadedOnce.current) {
          console.log('[CompanySelector] Redirecting to company setup');
          hasLoadedOnce.current = true;
          router.replace('/company-setup');
          return;
        }
        setCompanies([]);
        setIsLoading(false);
        hasLoadedOnce.current = true;
        loadInProgress.current = false;
        return;
      }

      // Fetch companies from database
      const companiesRef = collection(db, 'companies');
      const companiesQuery = query(
        companiesRef,
        where('__name__', 'in', companyIds)
      );
      const companiesSnapshot = await getDocs(companiesQuery);
      
      const loadedCompanies: Company[] = [];
      companiesSnapshot.forEach((doc) => {
        const data = doc.data();
        loadedCompanies.push({
          id: doc.id,
          legalEntityName: data.legalEntityName,
          alias: data.alias,
          address: data.address,
          contactNumber: data.contactNumber,
          adminContact: data.adminContact,
          adminEmail: data.adminEmail,
          companyRegistrationNr: data.companyRegistrationNr,
          vatNumber: data.vatNumber,
          industrySector: data.industrySector || '',
          status: data.status || 'Active',
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          createdBy: data.createdBy,
        });
      });

      console.log('[CompanySelector] Loaded', loadedCompanies.length, 'companies');
      setCompanies(loadedCompanies);
      setIsLoading(false);
      hasLoadedOnce.current = true;
      loadInProgress.current = false;
    } catch (error) {
      console.error('[CompanySelector] Error loading companies:', error);
      setCompanies([]);
      setIsLoading(false);
      hasLoadedOnce.current = true;
      loadInProgress.current = false;
    }
  }, [user, masterAccount, refreshMasterAccount]);

  // Reset hasLoadedOnce when user/masterAccount changes (e.g., after logout/login)
  useEffect(() => {
    hasLoadedOnce.current = false;
    loadInProgress.current = false;
  }, [user?.id, masterAccount?.id]);

  // Load on mount
  useEffect(() => {
    if (!hasLoadedOnce.current) {
      loadCompanies();
    }
  }, [loadCompanies]);

  // Reload when screen comes into focus (but not on initial mount)
  useFocusEffect(
    useCallback(() => {
      if (hasLoadedOnce.current && !loadInProgress.current) {
        console.log('[CompanySelector] Screen focused, reloading companies');
        loadCompanies();
      }
    }, [loadCompanies])
  );

  const handleCreateCompany = () => {
    console.log('[CompanySelector] Navigating to company setup');
    router.push('/company-setup');
  };

  const handleEditCompany = (company: Company) => {
    console.log('[CompanySelector] Opening edit modal for company:', company.alias);
    setEditingCompany(company);
    setEditForm({
      legalEntityName: company.legalEntityName,
      alias: company.alias,
      address: company.address,
      contactNumber: company.contactNumber,
      adminContact: company.adminContact,
      adminEmail: company.adminEmail,
      companyRegistrationNr: company.companyRegistrationNr,
      vatNumber: company.vatNumber,
      industrySector: company.industrySector,
    });
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingCompany) return;

    if (!editForm.legalEntityName?.trim()) {
      Alert.alert('Error', 'Please enter company legal entity name');
      return;
    }

    if (!editForm.alias?.trim()) {
      Alert.alert('Error', 'Please enter company alias');
      return;
    }

    if (!editForm.address?.trim()) {
      Alert.alert('Error', 'Please enter company address');
      return;
    }

    if (!editForm.contactNumber?.trim()) {
      Alert.alert('Error', 'Please enter contact number');
      return;
    }

    if (!editForm.adminContact?.trim()) {
      Alert.alert('Error', 'Please enter admin contact');
      return;
    }

    if (!editForm.adminEmail?.trim()) {
      Alert.alert('Error', 'Please enter admin email');
      return;
    }

    if (!editForm.companyRegistrationNr?.trim()) {
      Alert.alert('Error', 'Please enter company registration number');
      return;
    }

    if (!editForm.vatNumber?.trim()) {
      Alert.alert('Error', 'Please enter VAT number');
      return;
    }

    if (!editForm.industrySector) {
      Alert.alert('Error', 'Please select an industry sector');
      return;
    }

    setIsSaving(true);

    try {
      const companyRef = doc(db, 'companies', editingCompany.id);
      await updateDoc(companyRef, {
        legalEntityName: editForm.legalEntityName.trim(),
        alias: editForm.alias.trim(),
        address: editForm.address.trim(),
        contactNumber: editForm.contactNumber.trim(),
        adminContact: editForm.adminContact.trim(),
        adminEmail: editForm.adminEmail.trim(),
        companyRegistrationNr: editForm.companyRegistrationNr.trim(),
        vatNumber: editForm.vatNumber.trim(),
        industrySector: editForm.industrySector,
        updatedAt: new Date(),
      });

      console.log('[CompanySelector] Company updated successfully');
      Alert.alert('Success', 'Company details updated successfully');
      setEditModalVisible(false);
      setEditingCompany(null);
      setEditForm({});
      loadCompanies();
    } catch (error) {
      console.error('[CompanySelector] Error updating company:', error);
      Alert.alert('Error', 'Failed to update company details');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseEditModal = () => {
    setEditModalVisible(false);
    setEditingCompany(null);
    setEditForm({});
  };

  // Show loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <LinearGradient colors={['#1e3a8a', '#3b82f6', '#60a5fa']} style={styles.gradient}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Loading your companies...</Text>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // If not loading but no user/master data, redirect to login
  if (!isLoading && !user && !masterAccount) {
    console.log('[CompanySelector] No auth data available, should redirect to login');
    // Don't show anything, let the app routing handle redirect
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <Modal
        visible={editModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseEditModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={handleCloseEditModal}
              disabled={isSaving}
            >
              <X size={24} color="#64748b" />
            </TouchableOpacity>
            <View style={styles.modalHeaderContent}>
              <Building2 size={24} color="#3b82f6" />
              <Text style={styles.modalTitle}>Edit Company</Text>
            </View>
            <TouchableOpacity
              style={styles.modalSaveButton}
              onPress={handleSaveEdit}
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
            style={styles.modalKeyboardView}
          >
            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.modalForm}>
                <View style={styles.modalInputGroup}>
                  <Text style={styles.modalLabel}>Industry Sector *</Text>
                  <TouchableOpacity
                    style={styles.modalSelectorButton}
                    onPress={() => setShowSectorModal(true)}
                    disabled={isSaving}
                  >
                    <Text style={[styles.modalSelectorText, !editForm.industrySector && styles.modalPlaceholder]}>
                      {editForm.industrySector || 'Select industry sector'}
                    </Text>
                    <ChevronDown size={20} color="#64748b" />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalInputGroup}>
                  <Text style={styles.modalLabel}>Legal Entity Name *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g., ABC Construction (Pty) Ltd"
                    placeholderTextColor="#94a3b8"
                    value={editForm.legalEntityName}
                    onChangeText={(text) => setEditForm({ ...editForm, legalEntityName: text })}
                    editable={!isSaving}
                  />
                </View>

                <View style={styles.modalInputGroup}>
                  <Text style={styles.modalLabel}>Company Alias/Short Name *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g., ABC Construction"
                    placeholderTextColor="#94a3b8"
                    value={editForm.alias}
                    onChangeText={(text) => setEditForm({ ...editForm, alias: text })}
                    editable={!isSaving}
                  />
                </View>

                <View style={styles.modalInputGroup}>
                  <Text style={styles.modalLabel}>Company Address *</Text>
                  <TextInput
                    style={[styles.modalInput, styles.modalTextArea]}
                    placeholder="Enter full company address"
                    placeholderTextColor="#94a3b8"
                    value={editForm.address}
                    onChangeText={(text) => setEditForm({ ...editForm, address: text })}
                    multiline
                    numberOfLines={3}
                    editable={!isSaving}
                  />
                </View>

                <View style={styles.modalInputGroup}>
                  <Text style={styles.modalLabel}>Contact Number *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g., +27 12 345 6789"
                    placeholderTextColor="#94a3b8"
                    value={editForm.contactNumber}
                    onChangeText={(text) => setEditForm({ ...editForm, contactNumber: text })}
                    keyboardType="phone-pad"
                    editable={!isSaving}
                  />
                </View>

                <View style={styles.modalInputGroup}>
                  <Text style={styles.modalLabel}>Admin Contact *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Admin contact number"
                    placeholderTextColor="#94a3b8"
                    value={editForm.adminContact}
                    onChangeText={(text) => setEditForm({ ...editForm, adminContact: text })}
                    keyboardType="phone-pad"
                    editable={!isSaving}
                  />
                </View>

                <View style={styles.modalInputGroup}>
                  <Text style={styles.modalLabel}>Admin Email *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="admin@company.com"
                    placeholderTextColor="#94a3b8"
                    value={editForm.adminEmail}
                    onChangeText={(text) => setEditForm({ ...editForm, adminEmail: text })}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!isSaving}
                  />
                </View>

                <View style={styles.modalInputGroup}>
                  <Text style={styles.modalLabel}>Company Registration Number *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g., 2021/123456/07"
                    placeholderTextColor="#94a3b8"
                    value={editForm.companyRegistrationNr}
                    onChangeText={(text) => setEditForm({ ...editForm, companyRegistrationNr: text })}
                    editable={!isSaving}
                  />
                </View>

                <View style={styles.modalInputGroup}>
                  <Text style={styles.modalLabel}>VAT Number *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g., 4123456789"
                    placeholderTextColor="#94a3b8"
                    value={editForm.vatNumber}
                    onChangeText={(text) => setEditForm({ ...editForm, vatNumber: text })}
                    editable={!isSaving}
                  />
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showSectorModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSectorModal(false)}
      >
        <View style={styles.sectorModalOverlay}>
          <View style={styles.sectorModalContent}>
            <View style={styles.sectorModalHeader}>
              <Text style={styles.sectorModalTitle}>Select Industry Sector</Text>
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
                    editForm.industrySector === sector && styles.sectorItemSelected,
                  ]}
                  onPress={() => {
                    setEditForm({ ...editForm, industrySector: sector });
                    setShowSectorModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.sectorItemText,
                      editForm.industrySector === sector && styles.sectorItemTextSelected,
                    ]}
                  >
                    {sector}
                  </Text>
                  {editForm.industrySector === sector && (
                    <CheckCircle size={20} color="#3b82f6" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      <LinearGradient colors={['#1e3a8a', '#3b82f6', '#60a5fa']} style={styles.gradient}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Building2 size={48} color="#fff" strokeWidth={2} />
            <Text style={styles.title}>Select Company</Text>
            <Text style={styles.subtitle}>
              Choose which company you want to access
            </Text>
          </View>

          {companies.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                You are not linked to any companies yet
              </Text>
              {(user?.role === 'master' || masterAccount) && (
                <TouchableOpacity
                  style={styles.createButton}
                  onPress={handleCreateCompany}
                >
                  <Plus size={20} color="#1e3a8a" />
                  <Text style={styles.createButtonText}>Create First Company</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              <FlatList
                data={companies}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={styles.companyCardWrapper}>
                    <TouchableOpacity
                      style={styles.companyCard}
                      onPress={() => handleSelectCompany(item)}
                    >
                      <View style={styles.companyIcon}>
                        <Building2 size={24} color="#3b82f6" />
                      </View>
                      <View style={styles.companyInfo}>
                        <Text style={styles.companyName}>{item.alias}</Text>
                        <Text style={styles.companyLegal}>{item.legalEntityName}</Text>
                      </View>
                      <ChevronRight size={24} color="#94a3b8" />
                    </TouchableOpacity>
                    {(user?.role === 'master' || masterAccount) && (
                      <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => handleEditCompany(item)}
                      >
                        <Edit2 size={18} color="#3b82f6" />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                contentContainerStyle={styles.listContent}
              />

              {(user?.role === 'master' || masterAccount) && (
                <View style={styles.addCompanyContainer}>
                  <TouchableOpacity
                    style={styles.addCompanyLink}
                    onPress={handleCreateCompany}
                  >
                    <Plus size={16} color="#cbd5e1" />
                    <Text style={styles.addCompanyLinkText}>Add New Company</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600' as const,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#cbd5e1',
    textAlign: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  emptyText: {
    fontSize: 16,
    color: '#cbd5e1',
    textAlign: 'center',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1e3a8a',
  },
  listContent: {
    gap: 12,
    paddingBottom: 80,
  },
  companyCardWrapper: {
    position: 'relative',
  },
  companyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  editButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 36,
    height: 36,
    backgroundColor: '#eff6ff',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  companyIcon: {
    width: 48,
    height: 48,
    backgroundColor: '#eff6ff',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyInfo: {
    flex: 1,
    gap: 4,
  },
  companyName: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  companyLegal: {
    fontSize: 14,
    color: '#64748b',
  },
  addCompanyContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingBottom: 24,
  },
  addCompanyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  addCompanyLinkText: {
    fontSize: 15,
    color: '#cbd5e1',
    fontWeight: '500' as const,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  modalSaveButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalKeyboardView: {
    flex: 1,
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  modalForm: {
    gap: 16,
  },
  modalInputGroup: {
    gap: 8,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#475569',
    marginLeft: 4,
  },
  modalInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalTextArea: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  modalSelectorButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalSelectorText: {
    fontSize: 15,
    color: '#1e293b',
  },
  modalPlaceholder: {
    color: '#94a3b8',
  },
  sectorModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sectorModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  sectorModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  sectorModalTitle: {
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
});
