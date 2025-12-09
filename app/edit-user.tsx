import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
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
  Animated,
  Switch,
} from 'react-native';
import { ArrowLeft, Save, User, ChevronDown, CheckCircle, Lock, Unlock } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { UserRole, SubContractorUser } from '@/types';

const USER_ROLES: UserRole[] = [
  "Admin",
  "Planner",
  "Supervisor",
  "QC",
  "Operator",
  "Plant Manager",
  "Surveyor",
  "Staff Manager",
  "Logistics Manager"
];

export default function EditUserScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(-20)).current;
  
  const [subContractorName, setSubContractorName] = useState('');
  const [legalEntityName, setLegalEntityName] = useState('');
  const [userName, setUserName] = useState('');
  const [name, setName] = useState('');
  const [directPersonalContactNr, setDirectPersonalContactNr] = useState('');
  const [adminContact, setAdminContact] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [companyRegistrationNr, setCompanyRegistrationNr] = useState('');
  const [vatNr, setVatNr] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [originalData, setOriginalData] = useState<SubContractorUser | null>(null);
  const [disabledMenus, setDisabledMenus] = useState<string[]>([]);
  const [isLocked, setIsLocked] = useState(false);

  const MAIN_MENUS: Record<string, string[]> = {
    'Supervisor': ['Trenching', 'Cabling', 'Terminations', 'Inverters', 'Drilling', 'Mechanical', 'Surveyors', 'Casting', 'Structures', 'Commissioning'],
    'QC': ['QC Requests', 'QC Scheduled', 'QC Completed'],
    'Surveyor': ['Surveyor Tasks', 'Gallery', 'Shared Inbox'],
    'Plant Manager': ['Plant Allocation Requests'],
    'Planner': ['Task Requests', 'Scope Requests', 'QC Requests', 'Cabling Requests', 'Termination Requests', 'Surveyor Requests', 'Handover Requests'],
  };

  const getMenusForRole = (role: UserRole | null): string[] => {
    if (!role) return [];
    return MAIN_MENUS[role] || [];
  };

  const toggleMenu = (menuName: string) => {
    setDisabledMenus((prev) => {
      if (prev.includes(menuName)) {
        return prev.filter((m) => m !== menuName);
      } else {
        return [...prev, menuName];
      }
    });
  };

  useEffect(() => {
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUser = async () => {
    if (!userId || !user?.siteId) {
      console.error('[EditUser] Missing required data:', { userId, siteId: user?.siteId });
      Alert.alert('Error', 'User ID or site ID not found');
      router.back();
      return;
    }

    try {
      setIsLoading(true);
      console.log('[EditUser] Loading user with ID:', userId);
      console.log('[EditUser] Current user siteId:', user.siteId);
      
      const userDocRef = doc(db, 'users', userId as string);
      console.log('[EditUser] Document path:', userDocRef.path);
      
      const userDoc = await getDoc(userDocRef);
      console.log('[EditUser] User doc exists:', userDoc.exists());
      
      if (!userDoc.exists()) {
        console.error('[EditUser] Document not found at path:', userDocRef.path);
        Alert.alert('Error', `User not found in database\n\nPath: ${userDocRef.path}`);
        router.back();
        return;
      }

      const docData = userDoc.data();
      console.log('[EditUser] Document data keys:', Object.keys(docData || {}));
      console.log('[EditUser] Document siteId:', docData?.siteId);
      console.log('[EditUser] Document role:', docData?.role);
      console.log('[EditUser] Document userId:', docData?.userId);
      
      const userData = { id: userDoc.id, ...docData } as SubContractorUser;
      
      if (userData.siteId !== user.siteId) {
        console.error('[EditUser] Site mismatch:', { docSite: userData.siteId, userSite: user.siteId });
        Alert.alert('Error', 'You do not have permission to edit this user');
        router.back();
        return;
      }

      setOriginalData(userData);
      setSubContractorName(userData.subContractorName || '');
      setLegalEntityName(userData.legalEntityName || '');
      setUserName(userData.userId || '');
      setName((userData as any).name || userData.subContractorName || '');
      setDirectPersonalContactNr(userData.directPersonalContactNr || '');
      setAdminContact(userData.adminContact || '');
      setAdminEmail(userData.adminEmail || '');
      setCompanyRegistrationNr(userData.companyRegistrationNr || '');
      setVatNr(userData.vatNr || '');
      setSelectedRole(userData.role);
      setDisabledMenus(userData.disabledMenus || []);
      setIsLocked(userData.isLocked || false);
      
      console.log('[EditUser] ✅ User loaded successfully:', userData.userId);
    } catch (error: any) {
      console.error('[EditUser] ❌ Error loading user:', error);
      console.error('[EditUser] Error code:', error?.code);
      console.error('[EditUser] Error message:', error?.message);
      Alert.alert('Error', `Failed to load user\n\nError: ${error?.message || 'Unknown'}`);
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const showToast = () => {
    setShowSuccessToast(true);
    Animated.parallel([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(toastTranslateY, {
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(toastTranslateY, {
          toValue: -20,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowSuccessToast(false);
        router.back();
      });
    }, 1500);
  };

  const handleSave = async () => {
    if (isSaving) {
      console.log('[EditUser] Save already in progress, ignoring duplicate request');
      return;
    }

    if (!user?.siteId || !userId || !originalData) {
      Alert.alert('Error', 'Invalid user data');
      return;
    }

    if (!selectedRole) {
      Alert.alert('Error', 'Please select a user role');
      return;
    }

    if (!subContractorName.trim()) {
      Alert.alert('Error', 'Sub Contractor Name is required');
      return;
    }

    if (!name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    const menusChanged = JSON.stringify(disabledMenus.sort()) !== JSON.stringify((originalData.disabledMenus || []).sort());
    const lockChanged = isLocked !== (originalData.isLocked || false);
    
    const hasChanges = 
      subContractorName !== originalData.subContractorName ||
      legalEntityName !== originalData.legalEntityName ||
      name !== ((originalData as any).name || originalData.subContractorName) ||
      directPersonalContactNr !== originalData.directPersonalContactNr ||
      adminContact !== originalData.adminContact ||
      adminEmail !== originalData.adminEmail ||
      companyRegistrationNr !== originalData.companyRegistrationNr ||
      vatNr !== originalData.vatNr ||
      selectedRole !== originalData.role ||
      menusChanged ||
      lockChanged;

    if (!hasChanges) {
      Alert.alert('No Changes', 'No changes detected');
      return;
    }

    const roleChanged = selectedRole !== originalData.role;
    
    if (roleChanged) {
      Alert.alert(
        'Confirm Role Change',
        `Are you sure you want to change this user's role from "${originalData.role}" to "${selectedRole}"? This will affect their access and permissions.`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => console.log('[EditUser] Role change cancelled by user'),
          },
          {
            text: 'Confirm',
            style: 'destructive',
            onPress: () => performUpdate(roleChanged),
          },
        ]
      );
    } else {
      performUpdate(false);
    }
  };

  const performUpdate = async (roleChanged: boolean) => {
    setIsSaving(true);
    console.log('[EditUser] ========== SAVE STARTED ==========');
    console.log('[EditUser] originalData?.id:', originalData?.id);
    console.log('[EditUser] userId param:', userId);
    console.log('[EditUser] Current user:', user?.userId);
    console.log('[EditUser] Current user siteId:', user?.siteId);
    
    try {
      if (!originalData?.id) {
        console.error('[EditUser] ❌ No document ID found in originalData');
        throw new Error('Document ID not found - originalData.id is missing');
      }

      if (!user?.userId) {
        console.error('[EditUser] ❌ No current user ID found');
        throw new Error('Current user ID not found - cannot track who made the update');
      }
      
      const userRef = doc(db, 'users', originalData.id);
      console.log('[EditUser] Target document path:', userRef.path);
      
      console.log('[EditUser] Verifying document exists before update...');
      const preCheckDoc = await getDoc(userRef);
      if (!preCheckDoc.exists()) {
        console.error('[EditUser] ❌ Document does not exist before update!');
        throw new Error(`Document not found at path: ${userRef.path}`);
      }
      console.log('[EditUser] ✅ Document exists, proceeding with update');
      
      const updateData: any = {
        subContractorName: subContractorName.trim(),
        legalEntityName: legalEntityName.trim(),
        name: name.trim(),
        companyName: subContractorName.trim(),
        companyContactMobile: directPersonalContactNr.trim(),
        directPersonalContactNr: directPersonalContactNr.trim(),
        adminContact: adminContact.trim(),
        adminEmail: adminEmail.trim(),
        companyRegistrationNr: companyRegistrationNr.trim(),
        vatNr: vatNr.trim(),
        role: selectedRole,
        updatedBy: user.userId,
        updatedAt: serverTimestamp(),
        disabledMenus: disabledMenus.length > 0 ? disabledMenus : [],
        isLocked: isLocked,
      };

      if (roleChanged) {
        updateData.roleChangedAt = serverTimestamp();
        updateData.roleChangedBy = user.userId;
        updateData.previousRole = originalData?.role;
        console.log('[EditUser] Role change detected:', { from: originalData?.role, to: selectedRole });
      }
      
      console.log('[EditUser] Update data prepared (fields):', Object.keys(updateData));
      console.log('[EditUser] New role:', updateData.role);
      console.log('[EditUser] Updated by:', updateData.updatedBy);
      
      console.log('[EditUser] Calling setDoc with merge:true...');
      await setDoc(userRef, updateData, { merge: true });
      console.log('[EditUser] ✅ setDoc call completed');
      
      console.log('[EditUser] Verifying update...');
      const verifyDoc = await getDoc(userRef);
      console.log('[EditUser] Verification - doc exists:', verifyDoc.exists());
      
      if (verifyDoc.exists()) {
        const verifyData = verifyDoc.data();
        console.log('[EditUser] Verification - updated role:', verifyData?.role);
        console.log('[EditUser] Verification - updatedBy:', verifyData?.updatedBy);
        console.log('[EditUser] Verification - subContractorName:', verifyData?.subContractorName);
        
        if (verifyData?.role !== selectedRole) {
          console.warn('[EditUser] ⚠️ Role was not updated! Expected:', selectedRole, 'Got:', verifyData?.role);
          throw new Error(`Role update failed - expected ${selectedRole} but got ${verifyData?.role}`);
        } else {
          console.log('[EditUser] ✅ Role update verified successfully');
        }
        
        const updatedUserData = { id: verifyDoc.id, ...verifyData } as SubContractorUser;
        setOriginalData(updatedUserData);
      } else {
        console.error('[EditUser] ❌ Document disappeared after update!');
        throw new Error('Document disappeared after update');
      }
      
      console.log('[EditUser] ========== SAVE COMPLETED ==========');
      setIsSaving(false);
      showToast();
    } catch (error: any) {
      console.error('[EditUser] ❌❌❌ SAVE FAILED ❌❌❌');
      console.error('[EditUser] Error code:', error?.code);
      console.error('[EditUser] Error message:', error?.message);
      console.error('[EditUser] Error name:', error?.name);
      console.error('[EditUser] Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      
      let errorDetails = '';
      if (error?.code === 'permission-denied') {
        errorDetails = '\n\n⚠️ Permission Denied: Your Firestore rules may be blocking this update.';
      } else if (error?.code === 'not-found') {
        errorDetails = '\n\n⚠️ Document not found in database';
      } else if (error?.code === 'unavailable') {
        errorDetails = '\n\n⚠️ Network error or Firestore offline';
      }
      
      Alert.alert(
        'Save Failed',
        `${error?.message || 'Unknown error'}${errorDetails}\n\nError code: ${error?.code || 'unknown'}\n\nCheck console for details.`
      );
      setIsSaving(false);
    }
  };

  if (isLoading && !originalData) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#3b82f6" />
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
          disabled={isLoading}
        >
          <ArrowLeft size={24} color="#1e293b" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <User size={24} color="#3b82f6" />
          <Text style={styles.headerTitle}>Edit User</Text>
        </View>
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isLoading || isSaving}
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
          <View style={styles.form}>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                User ID: {userName}
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Sub Contractor Name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Enter sub contractor name"
                value={subContractorName}
                onChangeText={setSubContractorName}
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Legal Entity Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter legal entity name"
                value={legalEntityName}
                onChangeText={setLegalEntityName}
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Enter user name"
                value={name}
                onChangeText={setName}
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                User Role <Text style={styles.required}>*</Text>
              </Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => setShowRolePicker(!showRolePicker)}
                disabled={isLoading}
              >
                <Text style={[styles.pickerText, !selectedRole && styles.pickerPlaceholder]}>
                  {selectedRole || 'Select user role'}
                </Text>
                <ChevronDown size={20} color="#94a3b8" />
              </TouchableOpacity>
              {showRolePicker && (
                <View style={styles.roleList}>
                  {USER_ROLES.map((role) => (
                    <TouchableOpacity
                      key={role}
                      style={[
                        styles.roleItem,
                        selectedRole === role && styles.roleItemSelected,
                      ]}
                      onPress={() => {
                        setSelectedRole(role);
                        setShowRolePicker(false);
                      }}
                    >
                      <Text style={[
                        styles.roleItemText,
                        selectedRole === role && styles.roleItemTextSelected,
                      ]}>
                        {role}
                      </Text>
                      {role !== originalData?.role && selectedRole === role && (
                        <View style={styles.changeIndicator}>
                          <Text style={styles.changeIndicatorText}>Changed</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {selectedRole && selectedRole !== originalData?.role && (
                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>
                    ⚠️ Changing role from &quot;{originalData?.role}&quot; to &quot;{selectedRole}&quot; will update user permissions immediately
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Direct Personal Contact Nr</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter contact number"
                value={directPersonalContactNr}
                onChangeText={setDirectPersonalContactNr}
                keyboardType="phone-pad"
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Admin Contact</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter admin contact number"
                value={adminContact}
                onChangeText={setAdminContact}
                keyboardType="phone-pad"
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Admin Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter admin email"
                value={adminEmail}
                onChangeText={setAdminEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Company Registration Nr</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter registration number"
                value={companyRegistrationNr}
                onChangeText={setCompanyRegistrationNr}
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>VAT Nr</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter VAT number"
                value={vatNr}
                onChangeText={setVatNr}
                editable={!isLoading}
              />
            </View>

            {selectedRole && getMenusForRole(selectedRole).length > 0 && (
              <View style={styles.menuTogglesSection}>
                <Text style={styles.menuTogglesTitle}>Main Menu Access</Text>
                <Text style={styles.menuTogglesSubtitle}>Toggle off to disable menu items for this user</Text>
                <View style={styles.menuTogglesList}>
                  {getMenusForRole(selectedRole).map((menuName) => {
                    const isDisabled = disabledMenus.includes(menuName);
                    return (
                      <View key={menuName} style={styles.menuToggleItem}>
                        <View style={styles.menuToggleLeft}>
                          <Text style={[styles.menuToggleName, isDisabled && styles.menuToggleNameDisabled]}>
                            {menuName}
                          </Text>
                          <Text style={styles.menuToggleStatus}>
                            {isDisabled ? 'Disabled' : 'Enabled'}
                          </Text>
                        </View>
                        <Switch
                          value={!isDisabled}
                          onValueChange={() => toggleMenu(menuName)}
                          trackColor={{ false: '#e2e8f0', true: '#10b981' }}
                          thumbColor={isDisabled ? '#f4f3f4' : '#fff'}
                          ios_backgroundColor="#e2e8f0"
                          disabled={isLoading}
                        />
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            <View style={styles.lockSection}>
              <View style={styles.lockHeader}>
                {isLocked ? (
                  <Lock size={24} color="#ef4444" />
                ) : (
                  <Unlock size={24} color="#10b981" />
                )}
                <View style={styles.lockHeaderText}>
                  <Text style={styles.lockTitle}>Account Lock</Text>
                  <Text style={styles.lockSubtitle}>
                    {isLocked ? 'This account is currently locked' : 'This account is unlocked'}
                  </Text>
                </View>
              </View>
              <View style={styles.lockToggleRow}>
                <View style={styles.lockToggleLeft}>
                  <Text style={styles.lockToggleLabel}>Lock Account</Text>
                  <Text style={styles.lockToggleDescription}>
                    Locked users cannot login
                  </Text>
                </View>
                <Switch
                  value={isLocked}
                  onValueChange={setIsLocked}
                  trackColor={{ false: '#e2e8f0', true: '#ef4444' }}
                  thumbColor={isLocked ? '#fff' : '#f4f3f4'}
                  ios_backgroundColor="#e2e8f0"
                  disabled={isLoading}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.bottomSaveButton, isSaving && styles.bottomSaveButtonDisabled]}
              onPress={handleSave}
              disabled={isLoading || isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Save size={20} color="#fff" />
                  <Text style={styles.bottomSaveButtonText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {showSuccessToast && (
        <Animated.View
          style={[
            styles.toast,
            {
              opacity: toastOpacity,
              transform: [{ translateY: toastTranslateY }],
              top: insets.top + 80,
            },
          ]}
        >
          <CheckCircle size={20} color="#fff" />
          <Text style={styles.toastText}>User updated successfully!</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  form: {
    gap: 16,
  },
  infoBox: {
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  infoText: {
    fontSize: 13,
    color: '#1e40af',
    fontWeight: '600' as const,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#475569',
    marginLeft: 4,
  },
  required: {
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
  picker: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerText: {
    fontSize: 15,
    color: '#1e293b',
    flex: 1,
  },
  pickerPlaceholder: {
    color: '#94a3b8',
  },
  roleList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 4,
    overflow: 'hidden',
  },
  roleItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roleItemSelected: {
    backgroundColor: '#eff6ff',
  },
  roleItemText: {
    fontSize: 15,
    color: '#1e293b',
  },
  roleItemTextSelected: {
    color: '#3b82f6',
    fontWeight: '600' as const,
  },
  changeIndicator: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  changeIndicatorText: {
    fontSize: 11,
    color: '#92400e',
    fontWeight: '600' as const,
  },
  warningBox: {
    backgroundColor: '#fffbeb',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  warningText: {
    fontSize: 12,
    color: '#92400e',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  toastText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
  },
  bottomSaveButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    shadowColor: '#3b82f6',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  bottomSaveButtonDisabled: {
    opacity: 0.6,
  },
  bottomSaveButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  menuTogglesSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  menuTogglesTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  menuTogglesSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: -8,
  },
  menuTogglesList: {
    gap: 12,
  },
  menuToggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
  },
  menuToggleLeft: {
    flex: 1,
    gap: 4,
  },
  menuToggleName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  menuToggleNameDisabled: {
    color: '#94a3b8',
  },
  menuToggleStatus: {
    fontSize: 12,
    color: '#64748b',
  },
  lockSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 16,
  },
  lockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lockHeaderText: {
    flex: 1,
    gap: 4,
  },
  lockTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  lockSubtitle: {
    fontSize: 13,
    color: '#64748b',
  },
  lockToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
  },
  lockToggleLeft: {
    flex: 1,
    gap: 4,
  },
  lockToggleLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  lockToggleDescription: {
    fontSize: 12,
    color: '#64748b',
  },
});
