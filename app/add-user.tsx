import { Stack, router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
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
import { ArrowLeft, Save, UserPlus, ChevronDown, CheckCircle, Search, Users } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import NetInfo from '@react-native-community/netinfo';
import { queueFirestoreOperation } from '@/utils/offlineQueue';
import { db } from '@/config/firebase';
import { UserRole, Employee } from '@/types';
import { getUserRoleOptions } from '@/constants/roles';

export default function AddUserScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(-20)).current;

  
  const [showEmployeePicker, setShowEmployeePicker] = useState(false);
  const [employees, setEmployees] = useState<(Employee & { id: string })[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<(Employee & { id: string }) | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [disabledMenus, setDisabledMenus] = useState<string[]>([]);
  
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const userRoles = useMemo(() => getUserRoleOptions(), []);

  const generateUserId = (): string => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `USER-${timestamp}${random}`;
  };

  const loadEmployees = async (role: string) => {
    if (!user?.siteId || !user?.masterAccountId) return;
    
    try {
      setIsLoadingEmployees(true);
      const employeesRef = collection(db, 'employees');
      const employeesQuery = query(
        employeesRef,
        where('siteId', '==', user.siteId),
        where('masterAccountId', '==', user.masterAccountId),
        where('role', '==', role)
      );
      
      const snapshot = await getDocs(employeesQuery);
      const employeesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as (Employee & { id: string })[];
      
      setEmployees(employeesList);
    } catch (error) {
      console.error('[AddUser] Error loading employees:', error);
      Alert.alert('Error', 'Failed to load employees');
    } finally {
      setIsLoadingEmployees(false);
    }
  };

  const handleEmployeeSelect = (employee: Employee & { id: string }) => {
    setSelectedEmployee(employee);
    setShowEmployeePicker(false);
  };

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchQuery.toLowerCase())
  );



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
      console.log('[AddUser] Save already in progress, ignoring duplicate request');
      return;
    }

    if (!user?.siteId) {
      Alert.alert('Error', 'No site ID found');
      return;
    }

    if (!selectedEmployee) {
      Alert.alert('Error', 'Please select an employee');
      return;
    }

    if (!selectedRole) {
      Alert.alert('Error', 'Please select a user role');
      return;
    }

    setIsLoading(true);
    setIsSaving(true);

    try {
      const usersRef = collection(db, 'users');
      
      const existingUserQuery = query(
        usersRef,
        where('siteId', '==', user.siteId),
        where('employeeRecordId', '==', selectedEmployee.id)
      );
      const existingUserSnapshot = await getDocs(existingUserQuery);
      
      if (!existingUserSnapshot.empty) {
        Alert.alert('Error', 'This employee already has a user account');
        setIsLoading(false);
        setIsSaving(false);
        return;
      }

      const userId = generateUserId();

      console.log('[AddUser] Creating new user with ID:', userId);

      const userData = {
        userId,
        name: selectedEmployee.name,
        subContractorName: selectedEmployee.name,
        userName: selectedEmployee.name,
        companyName: selectedEmployee.name,
        companyContactMobile: selectedEmployee.contact,
        directPersonalContactNr: selectedEmployee.contact,
        adminEmail: selectedEmployee.email || '',
        role: selectedRole,
        siteId: user.siteId,
        siteName: user.siteName,
        masterAccountId: user.masterAccountId,
        companyId: user.currentCompanyId || null,
        createdBy: user.userId,
        createdAt: Date.now(),
        disabledMenus: disabledMenus.length > 0 ? disabledMenus : [],
        employeeRecordId: selectedEmployee.id,
        employeeIdNumber: selectedEmployee.employeeIdNumber || null,
      };

      const netInfo = await NetInfo.fetch();
      const isOnline = netInfo.isConnected;

      console.log('[AddUser] Network status:', isOnline ? 'Online' : 'Offline');

      if (isOnline) {
        const userDocRef = await addDoc(collection(db, 'users'), userData);
        
        const employeeRef = doc(db, 'employees', selectedEmployee.id);
        await updateDoc(employeeRef, {
          linkedUserId: userDocRef.id,
          linkedUserRole: selectedRole,
          updatedAt: serverTimestamp(),
        });
        console.log('[AddUser] User saved to Firebase');
      } else {
        await queueFirestoreOperation(
          {
            type: 'add',
            collection: 'users',
            data: userData,
          },
          {
            priority: 'P1',
            entityType: 'other',
          }
        );
        console.log('[AddUser] User queued for offline sync');
      }

      console.log('[AddUser] User created successfully:', userId);
      setIsLoading(false);
      setIsSaving(false);
      showToast();
    } catch (error) {
      console.error('[AddUser] Error creating user:', error);
      Alert.alert('Error', 'Failed to create user. Please try again.');
      setIsLoading(false);
      setIsSaving(false);
    }
  };

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
          <UserPlus size={24} color="#3b82f6" />
          <Text style={styles.headerTitle}>Add User</Text>
        </View>
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isLoading || isSaving}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#3b82f6" />
          ) : (
            <Save size={24} color={isSaving ? "#94a3b8" : "#3b82f6"} />
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
                First select the user role, then choose an employee with that role from the Onboarding database to assign menu access permissions.
              </Text>
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
                  {selectedRole || 'Select user role first'}
                </Text>
                <ChevronDown size={20} color="#94a3b8" />
              </TouchableOpacity>
              {showRolePicker && (
                <View style={styles.roleList}>
                  {userRoles.map((role) => (
                    <TouchableOpacity
                      key={role}
                      style={styles.roleItem}
                      onPress={() => {
                        setSelectedRole(role);
                        setShowRolePicker(false);
                        setSelectedEmployee(null);
                        setEmployees([]);
                        loadEmployees(role);
                      }}
                    >
                      <Text style={styles.roleItemText}>{role}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {selectedRole && (
              <View style={styles.employeeSection}>
                <Text style={styles.sectionTitle}>Select {selectedRole} Employee</Text>
                <TouchableOpacity
                  style={styles.employeePickerButton}
                  onPress={() => setShowEmployeePicker(!showEmployeePicker)}
                  disabled={isLoading}
                >
                  <Users size={20} color="#3b82f6" />
                  <Text style={[styles.employeePickerText, !selectedEmployee && styles.employeePickerPlaceholder]}>
                    {selectedEmployee ? selectedEmployee.name : `Select ${selectedRole}`}
                  </Text>
                  <ChevronDown size={20} color="#94a3b8" />
                </TouchableOpacity>
                {showEmployeePicker && (
                  <View style={styles.employeeList}>
                    <View style={styles.employeeSearchContainer}>
                      <Search size={18} color="#94a3b8" />
                      <TextInput
                        style={styles.employeeSearchInput}
                        placeholder={`Search ${selectedRole}s...`}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                      />
                    </View>
                    <ScrollView style={styles.employeeScrollList} nestedScrollEnabled>
                      {isLoadingEmployees ? (
                        <ActivityIndicator size="small" color="#3b82f6" style={{padding: 20}} />
                      ) : filteredEmployees.length === 0 ? (
                        <Text style={styles.employeeEmptyText}>No {selectedRole}s found in onboarding database</Text>
                      ) : (
                        filteredEmployees.map((emp) => (
                          <TouchableOpacity
                            key={emp.id}
                            style={styles.employeeListItem}
                            onPress={() => handleEmployeeSelect(emp)}
                          >
                            <View style={styles.employeeListItemContent}>
                              <Text style={styles.employeeListItemName}>{emp.name}</Text>
                              <Text style={styles.employeeListItemRole}>{emp.role}</Text>
                            </View>
                          </TouchableOpacity>
                        ))
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>
            )}

            {selectedEmployee && (
              <View style={styles.selectedEmployeeCard}>
                <Text style={styles.selectedEmployeeLabel}>Selected {selectedRole}</Text>
                <Text style={styles.selectedEmployeeName}>{selectedEmployee.name}</Text>
                <Text style={styles.selectedEmployeeRole}>{selectedEmployee.role}</Text>
                <Text style={styles.selectedEmployeeContact}>{selectedEmployee.contact}</Text>
              </View>
            )}

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
          <Text style={styles.toastText}>User added successfully!</Text>
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
  },
  roleItemText: {
    fontSize: 15,
    color: '#1e293b',
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
  employeeSection: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  employeePickerButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  employeePickerText: {
    flex: 1,
    fontSize: 15,
    color: '#1e293b',
  },
  employeePickerPlaceholder: {
    color: '#94a3b8',
  },
  employeeList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 4,
    overflow: 'hidden',
  },
  employeeSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  employeeSearchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1e293b',
  },
  employeeScrollList: {
    maxHeight: 200,
  },
  employeeListItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  employeeListItemContent: {
    gap: 4,
  },
  employeeListItemName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  employeeListItemRole: {
    fontSize: 13,
    color: '#64748b',
  },
  employeeEmptyText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center' as const,
    padding: 20,
  },
  selectedEmployeeCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    gap: 6,
  },
  selectedEmployeeLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#3b82f6',
    textTransform: 'uppercase' as const,
  },
  selectedEmployeeName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1e293b',
  },
  selectedEmployeeRole: {
    fontSize: 14,
    color: '#64748b',
  },
  selectedEmployeeContact: {
    fontSize: 13,
    color: '#64748b',
  },


});
