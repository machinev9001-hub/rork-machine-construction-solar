import { Stack, router, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { ArrowLeft, Search, X, Users, MapPin, Filter, CheckSquare } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';

type Employee = {
  id: string;
  name: string;
  role: string;
  idNumber: string;
  status: string;
  siteId?: string;
  masterAccountId: string;
  allocationStatus?: 'AVAILABLE' | 'ALLOCATED';
  allocatedPvArea?: string;
  allocatedBlockNumber?: string;
  allocationDate?: any;
  archived?: boolean;
  selected?: boolean;
};

type PvArea = {
  id: string;
  name: string;
  siteId: string;
  createdAt: any;
};

type BlockArea = {
  id: string;
  name: string;
  pvAreaId: string;
  pvAreaName: string;
  siteId: string;
  createdAt: any;
};

export default function StaffManagerEmployeesScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [pvAreas, setPvAreas] = useState<PvArea[]>([]);
  const [blockAreas, setBlockAreas] = useState<BlockArea[]>([]);
  const [selectedPvArea, setSelectedPvArea] = useState('');
  const [selectedBlock, setSelectedBlock] = useState('');
  const [isAllocating, setIsAllocating] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [showRoleFilterModal, setShowRoleFilterModal] = useState(false);
  const [showBulkAllocateModal, setShowBulkAllocateModal] = useState(false);

  const loadEmployees = useCallback(async () => {
    console.log('[StaffManagerEmployees] Loading employees...');
    console.log('[StaffManagerEmployees] User masterAccountId:', user?.masterAccountId);
    console.log('[StaffManagerEmployees] User currentCompanyId:', user?.currentCompanyId);
    console.log('[StaffManagerEmployees] User siteId:', user?.siteId);
    
    if (!user?.masterAccountId && !user?.currentCompanyId) {
      console.log('[StaffManagerEmployees] No masterAccountId or companyId');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const employeesRef = collection(db, 'employees');
      
      let loadedEmployees: Employee[] = [];
      
      // Try to load by masterAccountId first
      if (user.masterAccountId) {
        const masterQuery = query(
          employeesRef,
          where('masterAccountId', '==', user.masterAccountId)
        );
        const masterSnapshot = await getDocs(masterQuery);
        console.log('[StaffManagerEmployees] Found by masterAccountId:', masterSnapshot.size);
        
        masterSnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          loadedEmployees.push({
            ...data,
            id: docSnap.id,
          } as Employee);
        });
      }
      
      // Also try to load by companyId if we have it
      if (user.currentCompanyId) {
        const companyQuery = query(
          employeesRef,
          where('companyId', '==', user.currentCompanyId)
        );
        const companySnapshot = await getDocs(companyQuery);
        console.log('[StaffManagerEmployees] Found by companyId:', companySnapshot.size);
        
        companySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          // Only add if not already in the list (avoid duplicates)
          if (!loadedEmployees.find(e => e.id === docSnap.id)) {
            loadedEmployees.push({
              ...data,
              id: docSnap.id,
            } as Employee);
          }
        });
      }
      
      // Also try by siteId
      if (user.siteId) {
        const siteQuery = query(
          employeesRef,
          where('siteId', '==', user.siteId)
        );
        const siteSnapshot = await getDocs(siteQuery);
        console.log('[StaffManagerEmployees] Found by siteId:', siteSnapshot.size);
        
        siteSnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          // Only add if not already in the list (avoid duplicates)
          if (!loadedEmployees.find(e => e.id === docSnap.id)) {
            loadedEmployees.push({
              ...data,
              id: docSnap.id,
            } as Employee);
          }
        });
      }

      // Filter for active employees or employees without status field (legacy)
      const activeEmployees = loadedEmployees.filter((e) => 
        (!e.status || e.status === 'ACTIVE') && !e.archived
      );
      
      console.log('[StaffManagerEmployees] Total unique employees loaded:', loadedEmployees.length);
      console.log('[StaffManagerEmployees] Active employees:', activeEmployees.length);
      
      setEmployees(activeEmployees);
      setFilteredEmployees(activeEmployees);
    } catch (error) {
      console.error('[StaffManagerEmployees] Error loading employees:', error);
      Alert.alert('Error', 'Failed to load employees.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.masterAccountId, user?.currentCompanyId, user?.siteId]);

  const loadPvBlocks = useCallback(async () => {
    if (!user?.masterAccountId || !user?.siteId) return;

    try {
      const pvAreasRef = collection(db, 'pvAreas');
      const pvAreasQuery = query(
        pvAreasRef,
        where('siteId', '==', user.siteId)
      );
      
      const pvAreasSnapshot = await getDocs(pvAreasQuery);
      const loadedPvAreas: PvArea[] = [];
      
      pvAreasSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        loadedPvAreas.push({
          id: docSnap.id,
          name: data.name || '',
          siteId: data.siteId || '',
          createdAt: data.createdAt,
        });
      });

      const blockAreasRef = collection(db, 'blockAreas');
      const blockAreasQuery = query(
        blockAreasRef,
        where('siteId', '==', user.siteId)
      );
      
      const blockAreasSnapshot = await getDocs(blockAreasQuery);
      const loadedBlockAreas: BlockArea[] = [];
      
      blockAreasSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        loadedBlockAreas.push({
          id: docSnap.id,
          name: data.name || '',
          pvAreaId: data.pvAreaId || '',
          pvAreaName: data.pvAreaName || '',
          siteId: data.siteId || '',
          createdAt: data.createdAt,
        });
      });

      console.log('[StaffManagerEmployees] Loaded PV Areas:', loadedPvAreas.length, 'Block Areas:', loadedBlockAreas.length);
      setPvAreas(loadedPvAreas);
      setBlockAreas(loadedBlockAreas);
    } catch (error) {
      console.error('[StaffManagerEmployees] Error loading PV blocks:', error);
    }
  }, [user?.masterAccountId, user?.siteId]);

  useFocusEffect(
    useCallback(() => {
      loadEmployees();
      loadPvBlocks();
    }, [loadEmployees, loadPvBlocks])
  );

  const applyFilters = useCallback(() => {
    let filtered = employees;

    if (roleFilter !== 'ALL') {
      filtered = filtered.filter((e) => e.role === roleFilter);
    }

    if (searchQuery.trim() !== '') {
      const searchTerm = searchQuery.toLowerCase();
      filtered = filtered.filter((employee) => {
        return (
          employee.name.toLowerCase().includes(searchTerm) ||
          employee.role.toLowerCase().includes(searchTerm) ||
          employee.idNumber?.toLowerCase().includes(searchTerm)
        );
      });
    }

    setFilteredEmployees(filtered);
  }, [employees, roleFilter, searchQuery]);

  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  useFocusEffect(
    useCallback(() => {
      applyFilters();
    }, [applyFilters])
  );

  const handleEmployeePress = (employee: Employee) => {
    if (selectedEmployees.length > 0) {
      toggleEmployeeSelection(employee.id);
    } else {
      setSelectedEmployee(employee);
      setShowOptionsModal(true);
    }
  };

  const toggleEmployeeSelection = (employeeId: string) => {
    setSelectedEmployees((prev) => {
      if (prev.includes(employeeId)) {
        return prev.filter((id) => id !== employeeId);
      } else {
        return [...prev, employeeId];
      }
    });
  };

  const handleBulkAllocate = () => {
    if (selectedEmployees.length === 0) {
      Alert.alert('No Selection', 'Please select at least one employee.');
      return;
    }
    setShowBulkAllocateModal(true);
  };

  const handleBulkAllocateSubmit = async () => {
    if (!selectedPvArea || !selectedBlock) {
      Alert.alert('Missing Information', 'Please select both PV Area and Block Number.');
      return;
    }

    setIsAllocating(true);
    try {
      const updatePromises = selectedEmployees.map((employeeId) => {
        const employeeRef = doc(db, 'employees', employeeId);
        return updateDoc(employeeRef, {
          allocationStatus: 'ALLOCATED',
          allocatedPvArea: selectedPvArea,
          allocatedBlockNumber: selectedBlock,
          allocationDate: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      await Promise.all(updatePromises);
      
      Alert.alert('Success', `${selectedEmployees.length} employee(s) allocated to ${selectedPvArea} - Block ${selectedBlock}`);
      setShowBulkAllocateModal(false);
      setSelectedPvArea('');
      setSelectedBlock('');
      setSelectedEmployees([]);
      loadEmployees();
    } catch (error) {
      console.error('[StaffManagerEmployees] Error bulk allocating employees:', error);
      Alert.alert('Error', 'Failed to allocate employees.');
    } finally {
      setIsAllocating(false);
    }
  };

  const uniqueRoles = ['ALL', ...Array.from(new Set(employees.map((e) => e.role)))].sort();

  const handleAllocateOption = () => {
    setShowOptionsModal(false);
    setShowAllocateModal(true);
  };

  const handleAllocateSubmit = async () => {
    if (!selectedEmployee || !selectedEmployee.id || !selectedPvArea || !selectedBlock) {
      Alert.alert('Missing Information', 'Please select both PV Area and Block Number.');
      return;
    }

    setIsAllocating(true);
    try {
      const employeeRef = doc(db, 'employees', selectedEmployee.id);
      await updateDoc(employeeRef, {
        allocationStatus: 'ALLOCATED',
        allocatedPvArea: selectedPvArea,
        allocatedBlockNumber: selectedBlock,
        allocationDate: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      Alert.alert('Success', `${selectedEmployee.name} allocated to ${selectedPvArea} - Block ${selectedBlock}`);
      setShowAllocateModal(false);
      setSelectedPvArea('');
      setSelectedBlock('');
      setSelectedEmployee(null);
      loadEmployees();
    } catch (error) {
      console.error('[StaffManagerEmployees] Error allocating employee:', error);
      Alert.alert('Error', 'Failed to allocate employee.');
    } finally {
      setIsAllocating(false);
    }
  };

  const sortedPvAreas = [...pvAreas].sort((a, b) => {
    const numA = parseInt(a.name.replace(/\D/g, ''), 10);
    const numB = parseInt(b.name.replace(/\D/g, ''), 10);
    return numA - numB;
  });

  const selectedPvAreaData = pvAreas.find((pv) => pv.name === selectedPvArea);
  const blocksForSelectedPv = blockAreas
    .filter((b) => b.pvAreaId === selectedPvAreaData?.id)
    .sort((a, b) => {
      const numA = parseInt(a.name.replace(/\D/g, ''), 10);
      const numB = parseInt(b.name.replace(/\D/g, ''), 10);
      return numA - numB;
    });

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8b5cf6" />
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
        >
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Staff Employees</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.statsCard}>
        <Users size={32} color="#8b5cf6" />
        <Text style={styles.statsValue}>{employees.length}</Text>
        <Text style={styles.statsLabel}>Total Employees</Text>
      </View>

      <View style={styles.filtersRow}>
        <View style={styles.searchContainer}>
          <Search size={20} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search employees..."
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <X size={18} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => setShowRoleFilterModal(true)}
        >
          <Filter size={20} color={roleFilter !== 'ALL' ? '#8b5cf6' : '#64748b'} />
        </TouchableOpacity>
      </View>

      {roleFilter !== 'ALL' && (
        <View style={styles.activeFilterBadge}>
          <Text style={styles.activeFilterText}>Role: {roleFilter}</Text>
          <TouchableOpacity onPress={() => setRoleFilter('ALL')}>
            <X size={16} color="#8b5cf6" />
          </TouchableOpacity>
        </View>
      )}

      {selectedEmployees.length > 0 && (
        <View style={styles.selectionBar}>
          <View style={styles.selectionInfo}>
            <CheckSquare size={20} color="#8b5cf6" />
            <Text style={styles.selectionText}>{selectedEmployees.length} selected</Text>
          </View>
          <View style={styles.selectionActions}>
            <TouchableOpacity 
              style={styles.allocateButton}
              onPress={handleBulkAllocate}
            >
              <MapPin size={18} color="#fff" />
              <Text style={styles.allocateButtonText}>Allocate</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.clearButton}
              onPress={() => setSelectedEmployees([])}
            >
              <X size={18} color="#64748b" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
        {filteredEmployees.length === 0 ? (
          <View style={styles.emptyState}>
            <Users size={48} color="#cbd5e1" />
            <Text style={styles.emptyStateTitle}>No Employees Found</Text>
            <Text style={styles.emptyStateText}>
              {searchQuery ? 'Try adjusting your search' : 'No employees available'}
            </Text>
          </View>
        ) : (
          filteredEmployees.map((employee) => {
            const isSelected = selectedEmployees.includes(employee.id);
            return (
              <TouchableOpacity
                key={employee.id}
                style={[
                  styles.employeeCard,
                  isSelected && styles.employeeCardSelected,
                ]}
                onPress={() => handleEmployeePress(employee)}
                onLongPress={() => toggleEmployeeSelection(employee.id)}
                activeOpacity={0.7}
              >
                {isSelected && (
                  <View style={styles.selectedIndicator}>
                    <CheckSquare size={20} color="#8b5cf6" />
                  </View>
                )}
                <View style={styles.employeeCardHeader}>
                  <Text style={styles.employeeName}>{employee.name}</Text>
                  {employee.allocationStatus === 'ALLOCATED' && (
                    <View style={styles.allocatedBadge}>
                      <MapPin size={12} color="#10b981" />
                      <Text style={styles.allocatedText}>Allocated</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.employeeRole}>{employee.role}</Text>
                <Text style={styles.employeeId}>ID: {employee.idNumber}</Text>
                {employee.allocationStatus === 'ALLOCATED' && employee.allocatedPvArea && (
                  <Text style={styles.allocationInfo}>
                    📍 {employee.allocatedPvArea} - Block {employee.allocatedBlockNumber}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={showOptionsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOptionsModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1}
          onPress={() => setShowOptionsModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{selectedEmployee?.name}</Text>
            <Text style={styles.modalSubtitle}>{selectedEmployee?.role}</Text>

            <TouchableOpacity
              style={styles.optionButton}
              onPress={handleAllocateOption}
              activeOpacity={0.7}
            >
              <MapPin size={22} color="#8b5cf6" />
              <Text style={styles.optionText}>Allocate to PV + Block</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowOptionsModal(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showAllocateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAllocateModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1}
          onPress={() => setShowAllocateModal(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Allocate Employee</Text>
            <Text style={styles.modalSubtitle}>{selectedEmployee?.name}</Text>

            <Text style={styles.label}>Select PV Area</Text>
            {sortedPvAreas.length === 0 ? (
              <View style={styles.emptyPickerState}>
                <Text style={styles.emptyPickerText}>No PV Areas available. Please add PV Areas first.</Text>
              </View>
            ) : (
              <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
                {sortedPvAreas.map((pvArea) => (
                  <TouchableOpacity
                    key={pvArea.id}
                    style={[
                      styles.pickerOption,
                      selectedPvArea === pvArea.name && styles.pickerOptionSelected,
                    ]}
                    onPress={() => {
                      setSelectedPvArea(pvArea.name);
                      setSelectedBlock('');
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        selectedPvArea === pvArea.name && styles.pickerOptionTextSelected,
                      ]}
                    >
                      {pvArea.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {selectedPvArea && (
              <>
                <Text style={styles.label}>Select Block Number</Text>
                {blocksForSelectedPv.length === 0 ? (
                  <View style={styles.emptyPickerState}>
                    <Text style={styles.emptyPickerText}>No blocks available for {selectedPvArea}. Please add blocks first.</Text>
                  </View>
                ) : (
                  <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
                    {blocksForSelectedPv.map((block) => (
                      <TouchableOpacity
                        key={block.id}
                        style={[
                          styles.pickerOption,
                          selectedBlock === block.name && styles.pickerOptionSelected,
                        ]}
                        onPress={() => setSelectedBlock(block.name)}
                      >
                        <Text
                          style={[
                            styles.pickerOptionText,
                            selectedBlock === block.name && styles.pickerOptionTextSelected,
                          ]}
                        >
                          {block.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </>
            )}

            <TouchableOpacity
              style={[
                styles.submitButton,
                (!selectedPvArea || !selectedBlock || isAllocating) && styles.submitButtonDisabled,
              ]}
              onPress={handleAllocateSubmit}
              disabled={!selectedPvArea || !selectedBlock || isAllocating}
              activeOpacity={0.7}
            >
              {isAllocating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Allocate</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setShowAllocateModal(false);
                setSelectedPvArea('');
                setSelectedBlock('');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showRoleFilterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRoleFilterModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1}
          onPress={() => setShowRoleFilterModal(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Filter by Role</Text>
            <Text style={styles.modalSubtitle}>Select a role to filter employees</Text>

            <ScrollView style={styles.roleFilterScroll} nestedScrollEnabled>
              {uniqueRoles.map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.roleFilterOption,
                    roleFilter === role && styles.roleFilterOptionSelected,
                  ]}
                  onPress={() => {
                    setRoleFilter(role);
                    setShowRoleFilterModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.roleFilterOptionText,
                      roleFilter === role && styles.roleFilterOptionTextSelected,
                    ]}
                  >
                    {role}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowRoleFilterModal(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showBulkAllocateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBulkAllocateModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1}
          onPress={() => setShowBulkAllocateModal(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Allocate Employees</Text>
            <Text style={styles.modalSubtitle}>{selectedEmployees.length} employee(s) selected</Text>

            <Text style={styles.label}>Select PV Area</Text>
            {sortedPvAreas.length === 0 ? (
              <View style={styles.emptyPickerState}>
                <Text style={styles.emptyPickerText}>No PV Areas available. Please add PV Areas first.</Text>
              </View>
            ) : (
              <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
                {sortedPvAreas.map((pvArea) => (
                  <TouchableOpacity
                    key={pvArea.id}
                    style={[
                      styles.pickerOption,
                      selectedPvArea === pvArea.name && styles.pickerOptionSelected,
                    ]}
                    onPress={() => {
                      setSelectedPvArea(pvArea.name);
                      setSelectedBlock('');
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        selectedPvArea === pvArea.name && styles.pickerOptionTextSelected,
                      ]}
                    >
                      {pvArea.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {selectedPvArea && (
              <>
                <Text style={styles.label}>Select Block Number</Text>
                {blocksForSelectedPv.length === 0 ? (
                  <View style={styles.emptyPickerState}>
                    <Text style={styles.emptyPickerText}>No blocks available for {selectedPvArea}. Please add blocks first.</Text>
                  </View>
                ) : (
                  <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
                    {blocksForSelectedPv.map((block) => (
                      <TouchableOpacity
                        key={block.id}
                        style={[
                          styles.pickerOption,
                          selectedBlock === block.name && styles.pickerOptionSelected,
                        ]}
                        onPress={() => setSelectedBlock(block.name)}
                      >
                        <Text
                          style={[
                            styles.pickerOptionText,
                            selectedBlock === block.name && styles.pickerOptionTextSelected,
                          ]}
                        >
                          {block.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </>
            )}

            <TouchableOpacity
              style={[
                styles.submitButton,
                (!selectedPvArea || !selectedBlock || isAllocating) && styles.submitButtonDisabled,
              ]}
              onPress={handleBulkAllocateSubmit}
              disabled={!selectedPvArea || !selectedBlock || isAllocating}
              activeOpacity={0.7}
            >
              {isAllocating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Allocate {selectedEmployees.length} Employee(s)</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setShowBulkAllocateModal(false);
                setSelectedPvArea('');
                setSelectedBlock('');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
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
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsCard: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  statsValue: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#fff',
    marginTop: 12,
  },
  statsLabel: {
    fontSize: 14,
    color: '#a0a0a0',
    marginTop: 4,
  },
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  filterButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeFilterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3e8ff',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: '#8b5cf6',
  },
  activeFilterText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#8b5cf6',
    flex: 1,
  },
  selectionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f3e8ff',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#8b5cf6',
  },
  selectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectionText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#8b5cf6',
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  allocateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  allocateButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  clearButton: {
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#fff',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  employeeCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    position: 'relative' as const,
  },
  employeeCardSelected: {
    borderColor: '#8b5cf6',
    borderWidth: 2,
    backgroundColor: '#faf5ff',
  },
  selectedIndicator: {
    position: 'absolute' as const,
    top: 12,
    right: 12,
    zIndex: 10,
  },
  employeeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
    flex: 1,
  },
  allocatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  allocatedText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#10b981',
  },
  employeeRole: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#8b5cf6',
    marginBottom: 4,
  },
  employeeId: {
    fontSize: 13,
    color: '#a0a0a0',
    marginBottom: 4,
  },
  allocationInfo: {
    fontSize: 13,
    color: '#16a34a',
    marginTop: 8,
    fontWeight: '500' as const,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#fff',
    marginTop: 8,
  },
  emptyStateText: {
    fontSize: 15,
    color: '#a0a0a0',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1e293b',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 24,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  cancelButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    marginTop: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#64748b',
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1e293b',
    marginBottom: 8,
    marginTop: 12,
  },
  pickerScroll: {
    maxHeight: 150,
    marginBottom: 12,
  },
  pickerOption: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pickerOptionSelected: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  pickerOptionText: {
    fontSize: 15,
    color: '#475569',
  },
  pickerOptionTextSelected: {
    color: '#fff',
    fontWeight: '600' as const,
  },
  submitButton: {
    backgroundColor: '#8b5cf6',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  submitButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
  emptyPickerState: {
    backgroundColor: '#fff8e1',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ffd54f',
    marginBottom: 12,
  },
  emptyPickerText: {
    fontSize: 13,
    color: '#f57c00',
    textAlign: 'center',
  },
  roleFilterScroll: {
    maxHeight: 300,
    marginBottom: 16,
  },
  roleFilterOption: {
    padding: 14,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  roleFilterOptionSelected: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  roleFilterOptionText: {
    fontSize: 15,
    color: '#475569',
    fontWeight: '500' as const,
  },
  roleFilterOptionTextSelected: {
    color: '#fff',
    fontWeight: '700' as const,
  },
});
