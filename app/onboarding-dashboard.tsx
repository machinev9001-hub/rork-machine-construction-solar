import { Stack, router, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { ArrowLeft, Users, Package, Plus, Search, X, CheckCircle, Clock, Briefcase, MessageCircle, BookOpen } from 'lucide-react-native';
import BottomTabBar from '@/components/BottomTabBar';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Employee, PlantAsset } from '@/types';
import { useTheme } from '@/utils/hooks/useTheme';
import { HeaderTitleWithSync, StandardHeaderRight, StandardSiteIndicator } from '@/components/HeaderSyncStatus';

type TabType = 'employees' | 'assets' | 'subcontractors';

export default function OnboardingDashboardScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { theme, commonStyles } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('employees');
  const [isLoading, setIsLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [assets, setAssets] = useState<PlantAsset[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<PlantAsset[]>([]);
  const [assetSearchQuery, setAssetSearchQuery] = useState('');
  const [subcontractors, setSubcontractors] = useState<any[]>([]);
  const [filteredSubcontractors, setFilteredSubcontractors] = useState<any[]>([]);
  const [subcontractorSearchQuery, setSubcontractorSearchQuery] = useState('');
  
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState<'all' | 'inducted' | 'pending'>('all');
  const [assetStatusFilter, setAssetStatusFilter] = useState<'all' | 'inducted' | 'pending'>('all');
  const [subcontractorStatusFilter, setSubcontractorStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const isAllowed = user ? (user.role === 'master' || user.role === 'HR' || user.role === 'HSE' || user.role === 'Onboarding & Inductions') : false;

  const loadEmployees = useCallback(async () => {
    if (!user?.siteId) return;

    try {
      setIsLoading(true);
      const employeesRef = collection(db, 'employees');
      const q = query(
        employeesRef,
        where('siteId', '==', user.siteId)
      );
      const querySnapshot = await getDocs(q);

      const loadedEmployees: Employee[] = [];
      querySnapshot.forEach((doc) => {
        loadedEmployees.push({
          id: doc.id,
          ...doc.data(),
        } as Employee);
      });

      loadedEmployees.sort((a, b) => a.name.localeCompare(b.name));

      setEmployees(loadedEmployees);
      setFilteredEmployees(loadedEmployees);
    } catch (error: any) {
      console.error('[OnboardingDashboard] Error loading employees:', error);
      
      if (error?.code === 'failed-precondition' && error?.message?.includes('index')) {
        Alert.alert(
          'Firebase Index Required',
          'Please create the required Firebase index. Check the console for the index creation link.',
          [
            { text: 'OK', onPress: () => {} }
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to load employees');
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.siteId]);

  const loadAssets = useCallback(async () => {
    if (!user?.masterAccountId || !user?.siteId) return;

    try {
      setIsLoading(true);
      const assetsRef = collection(db, 'plantAssets');
      const q = query(
        assetsRef,
        where('masterAccountId', '==', user.masterAccountId),
        where('siteId', '==', user.siteId)
      );
      const querySnapshot = await getDocs(q);

      const loadedAssets: PlantAsset[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as PlantAsset;
        loadedAssets.push({
          id: doc.id,
          ...data,
        });
      });

      loadedAssets.sort((a, b) => a.assetId.localeCompare(b.assetId));

      const activeAssets = loadedAssets.filter((a) => !a.archived);
      setAssets(activeAssets);
      setFilteredAssets(activeAssets);
    } catch (error: any) {
      console.error('[OnboardingDashboard] Error loading plant assets:', error);
      
      if (error?.code === 'failed-precondition' && error?.message?.includes('index')) {
        Alert.alert(
          'Firebase Index Required',
          'Please create the required Firebase index. Check the console for the index creation link.',
          [
            { text: 'OK', onPress: () => {} }
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to load plant assets');
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.masterAccountId, user?.siteId]);

  const loadSubcontractors = useCallback(async () => {
    if (!user?.masterAccountId || !user?.siteId) return;

    try {
      setIsLoading(true);
      const subcontractorsRef = collection(db, 'subcontractors');
      const q = query(
        subcontractorsRef,
        where('masterAccountId', '==', user.masterAccountId),
        where('siteId', '==', user.siteId)
      );
      const querySnapshot = await getDocs(q);

      const loadedSubcontractors: any[] = [];
      querySnapshot.forEach((doc) => {
        loadedSubcontractors.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      loadedSubcontractors.sort((a, b) => a.name.localeCompare(b.name));

      setSubcontractors(loadedSubcontractors);
      setFilteredSubcontractors(loadedSubcontractors);
    } catch (error: any) {
      console.error('[OnboardingDashboard] Error loading subcontractors:', error);
      
      if (error?.code === 'failed-precondition' && error?.message?.includes('index')) {
        Alert.alert(
          'Firebase Index Required',
          'Please create the required Firebase index. Check the console for the index creation link.',
          [
            { text: 'OK', onPress: () => {} }
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to load subcontractors');
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.masterAccountId, user?.siteId]);

  const applyEmployeeFilters = useCallback(() => {
    let filtered = employees;

    if (employeeStatusFilter !== 'all') {
      filtered = filtered.filter((emp) => {
        if (employeeStatusFilter === 'inducted') return emp.inductionStatus;
        if (employeeStatusFilter === 'pending') return !emp.inductionStatus;
        return true;
      });
    }

    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((emp) => {
        return (
          emp.name.toLowerCase().includes(query) ||
          emp.role.toLowerCase().includes(query) ||
          emp.contact.toLowerCase().includes(query) ||
          emp.email?.toLowerCase().includes(query)
        );
      });
    }

    setFilteredEmployees(filtered);
  }, [employees, employeeStatusFilter, searchQuery]);

  const handleEmployeeSearch = useCallback(
    (text: string) => {
      setSearchQuery(text);
    },
    []
  );

  const applyAssetFilters = useCallback(() => {
    let filtered = assets;

    if (assetStatusFilter !== 'all') {
      filtered = filtered.filter((asset) => {
        if (assetStatusFilter === 'inducted') return asset.inductionStatus;
        if (assetStatusFilter === 'pending') return !asset.inductionStatus;
        return true;
      });
    }

    if (assetSearchQuery.trim() !== '') {
      const query = assetSearchQuery.toLowerCase();
      filtered = filtered.filter((asset) => {
        return (
          asset.assetId.toLowerCase().includes(query) ||
          asset.type.toLowerCase().includes(query) ||
          asset.plantNumber?.toLowerCase().includes(query) ||
          asset.location?.toLowerCase().includes(query)
        );
      });
    }

    setFilteredAssets(filtered);
  }, [assets, assetStatusFilter, assetSearchQuery]);

  const handleAssetSearch = useCallback(
    (text: string) => {
      setAssetSearchQuery(text);
    },
    []
  );

  const applySubcontractorFilters = useCallback(() => {
    let filtered = subcontractors;

    if (subcontractorStatusFilter !== 'all') {
      filtered = filtered.filter((sub) => {
        if (subcontractorStatusFilter === 'active') return sub.status === 'Active';
        if (subcontractorStatusFilter === 'inactive') return sub.status !== 'Active';
        return true;
      });
    }

    if (subcontractorSearchQuery.trim() !== '') {
      const query = subcontractorSearchQuery.toLowerCase();
      filtered = filtered.filter((sub) => {
        return (
          sub.name.toLowerCase().includes(query) ||
          sub.contactPerson?.toLowerCase().includes(query) ||
          sub.contactNumber?.toLowerCase().includes(query)
        );
      });
    }

    setFilteredSubcontractors(filtered);
  }, [subcontractors, subcontractorStatusFilter, subcontractorSearchQuery]);

  const handleSubcontractorSearch = useCallback(
    (text: string) => {
      setSubcontractorSearchQuery(text);
    },
    []
  );

  const handleEmployeePress = (employee: Employee) => {
    router.push(`/onboarding-employee-detail?employeeId=${employee.id}` as any);
  };

  const handleAssetPress = (asset: PlantAsset) => {
    router.push(`/onboarding-asset-detail?assetId=${asset.id}` as any);
  };

  useFocusEffect(
    useCallback(() => {
      loadEmployees();
      loadAssets();
      loadSubcontractors();
    }, [loadEmployees, loadAssets, loadSubcontractors])
  );

  useFocusEffect(
    useCallback(() => {
      applyEmployeeFilters();
    }, [applyEmployeeFilters])
  );

  useFocusEffect(
    useCallback(() => {
      applyAssetFilters();
    }, [applyAssetFilters])
  );

  useFocusEffect(
    useCallback(() => {
      applySubcontractorFilters();
    }, [applySubcontractorFilters])
  );

  if (!user || !isAllowed) {
    return (
      <View style={[commonStyles.container, { paddingTop: insets.top, backgroundColor: '#000000' }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Access Denied</Text>
          <Text style={styles.errorSubText}>
            This dashboard is only accessible to Master, HSE, and HR onboarding roles.
          </Text>
          <TouchableOpacity
            style={styles.backToHomeButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backToHomeText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[commonStyles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push('/(tabs)')}
        >
          <ArrowLeft size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <HeaderTitleWithSync title="Workforce & Assets" />
        </View>
        <StandardHeaderRight />
      </View>
      <StandardSiteIndicator />
      <View style={commonStyles.headerBorder} />

      <View style={styles.quickActionsBar}>
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => router.push('/onboarding-messages' as any)}
          activeOpacity={0.7}
        >
          <MessageCircle size={20} color="#3b82f6" />
          <Text style={styles.quickActionText}>Messages</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => router.push('/daily-diary' as any)}
          activeOpacity={0.7}
        >
          <BookOpen size={20} color="#10b981" />
          <Text style={styles.quickActionText}>Daily Diary</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'employees' && styles.tabActive]}
          onPress={() => setActiveTab('employees')}
        >
          <Users size={20} color={activeTab === 'employees' ? '#3b82f6' : '#64748b'} />
          <Text style={[styles.tabText, activeTab === 'employees' && styles.tabTextActive]}>
            Employees
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'assets' && styles.tabActive]}
          onPress={() => setActiveTab('assets')}
        >
          <Package size={20} color={activeTab === 'assets' ? '#3b82f6' : '#64748b'} />
          <Text style={[styles.tabText, activeTab === 'assets' && styles.tabTextActive]}>
            Plant/Assets
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'subcontractors' && styles.tabActive]}
          onPress={() => setActiveTab('subcontractors')}
        >
          <Briefcase size={20} color={activeTab === 'subcontractors' ? '#3b82f6' : '#64748b'} />
          <Text style={[styles.tabText, activeTab === 'subcontractors' && styles.tabTextActive]}>
            Subcontractors
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'employees' && (
        <View style={styles.contentWrapper}>
          <View style={styles.statsContainer}>
            <TouchableOpacity
              style={[
                styles.statCard,
                employeeStatusFilter === 'all' && styles.statCardActive
              ]}
              onPress={() => setEmployeeStatusFilter('all')}
              activeOpacity={0.7}
            >
              <Users size={20} color="#64748b" />
              <Text style={styles.statValue}>{employees.length}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.statCard,
                styles.statCardSuccess,
                employeeStatusFilter === 'inducted' && styles.statCardActive
              ]}
              onPress={() => setEmployeeStatusFilter('inducted')}
              activeOpacity={0.7}
            >
              <CheckCircle size={20} color="#10b981" />
              <Text style={[styles.statValue, styles.statValueSuccess]}>
                {employees.filter((e) => e.inductionStatus).length}
              </Text>
              <Text style={styles.statLabel}>Inducted</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.statCard,
                styles.statCardWarning,
                employeeStatusFilter === 'pending' && styles.statCardActive
              ]}
              onPress={() => setEmployeeStatusFilter('pending')}
              activeOpacity={0.7}
            >
              <Clock size={20} color="#f59e0b" />
              <Text style={[styles.statValue, styles.statValueWarning]}>
                {employees.filter((e) => !e.inductionStatus).length}
              </Text>
              <Text style={styles.statLabel}>Pending</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Search size={20} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search employees..."
              value={searchQuery}
              onChangeText={handleEmployeeSearch}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => handleEmployeeSearch('')}>
                <X size={18} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.addButtonContainer}>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => router.push('/add-employee' as any)}
            >
              <Plus size={20} color="#fff" />
              <Text style={styles.addButtonText}>Add Employee</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3b82f6" />
            </View>
          ) : (
            <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
              {filteredEmployees.length === 0 ? (
                <View style={styles.emptyState}>
                  <Users size={48} color="#cbd5e1" />
                  <Text style={styles.emptyStateTitle}>No Employees Found</Text>
                  <Text style={styles.emptyStateText}>
                    {searchQuery ? 'Try adjusting your search' : 'No employees have been added yet'}
                  </Text>
                </View>
              ) : (
                filteredEmployees.map((employee) => (
                  <TouchableOpacity
                    key={employee.id}
                    style={styles.employeeCard}
                    onPress={() => handleEmployeePress(employee)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.employeeCardHeader}>
                      <Text style={styles.employeeName}>{employee.name}</Text>
                      {employee.inductionStatus ? (
                        <View style={styles.statusBadgeSuccess}>
                          <CheckCircle size={14} color="#10b981" />
                          <Text style={styles.statusTextSuccess}>Inducted</Text>
                        </View>
                      ) : (
                        <View style={styles.statusBadgeWarning}>
                          <Clock size={14} color="#f59e0b" />
                          <Text style={styles.statusTextWarning}>Pending</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.employeeCardBody}>
                      <Text style={styles.employeeRole}>{employee.role}</Text>
                      <Text style={styles.employeeContact}>{employee.contact}</Text>
                      {employee.email && (
                        <Text style={styles.employeeEmail}>{employee.email}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          )}
        </View>
      )}

      {activeTab === 'assets' && (
        <View style={styles.contentWrapper}>
          <View style={styles.statsContainer}>
            <TouchableOpacity
              style={[
                styles.statCard,
                assetStatusFilter === 'all' && styles.statCardActive
              ]}
              onPress={() => setAssetStatusFilter('all')}
              activeOpacity={0.7}
            >
              <Package size={20} color="#64748b" />
              <Text style={styles.statValue}>{assets.length}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.statCard,
                styles.statCardSuccess,
                assetStatusFilter === 'inducted' && styles.statCardActive
              ]}
              onPress={() => setAssetStatusFilter('inducted')}
              activeOpacity={0.7}
            >
              <CheckCircle size={20} color="#10b981" />
              <Text style={[styles.statValue, styles.statValueSuccess]}>
                {assets.filter((a) => a.inductionStatus).length}
              </Text>
              <Text style={styles.statLabel}>Inducted</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.statCard,
                styles.statCardWarning,
                assetStatusFilter === 'pending' && styles.statCardActive
              ]}
              onPress={() => setAssetStatusFilter('pending')}
              activeOpacity={0.7}
            >
              <Clock size={20} color="#f59e0b" />
              <Text style={[styles.statValue, styles.statValueWarning]}>
                {assets.filter((a) => !a.inductionStatus).length}
              </Text>
              <Text style={styles.statLabel}>Pending</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Search size={20} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search assets..."
              value={assetSearchQuery}
              onChangeText={handleAssetSearch}
            />
            {assetSearchQuery.length > 0 && (
              <TouchableOpacity onPress={() => handleAssetSearch('')}>
                <X size={18} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.addButtonContainer}>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => router.push('/add-asset' as any)}
            >
              <Plus size={20} color="#fff" />
              <Text style={styles.addButtonText}>Add Asset</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3b82f6" />
            </View>
          ) : (
            <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
              {filteredAssets.length === 0 ? (
                <View style={styles.emptyState}>
                  <Package size={48} color="#cbd5e1" />
                  <Text style={styles.emptyStateTitle}>No Assets Found</Text>
                  <Text style={styles.emptyStateText}>
                    {assetSearchQuery ? 'Try adjusting your search' : 'No assets have been added yet'}
                  </Text>
                </View>
              ) : (
                filteredAssets.map((asset) => (
                  <TouchableOpacity
                    key={asset.id}
                    style={styles.employeeCard}
                    onPress={() => handleAssetPress(asset)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.employeeCardHeader}>
                      <Text style={styles.employeeName}>{asset.assetId}</Text>
                      {asset.inductionStatus ? (
                        <View style={styles.statusBadgeSuccess}>
                          <CheckCircle size={14} color="#10b981" />
                          <Text style={styles.statusTextSuccess}>Inducted</Text>
                        </View>
                      ) : (
                        <View style={styles.statusBadgeWarning}>
                          <Clock size={14} color="#f59e0b" />
                          <Text style={styles.statusTextWarning}>Pending</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.employeeCardBody}>
                      <Text style={styles.employeeRole}>{asset.type}</Text>
                      {asset.plantNumber && (
                        <Text style={styles.employeeContact}>Plant #: {asset.plantNumber}</Text>
                      )}
                      {asset.location && (
                        <Text style={styles.employeeContact}>Location: {asset.location}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          )}
        </View>
      )}

      {activeTab === 'subcontractors' && (
        <View style={styles.contentWrapper}>
          <View style={styles.statsContainer}>
            <TouchableOpacity
              style={[
                styles.statCard,
                subcontractorStatusFilter === 'all' && styles.statCardActive
              ]}
              onPress={() => setSubcontractorStatusFilter('all')}
              activeOpacity={0.7}
            >
              <Briefcase size={20} color="#64748b" />
              <Text style={styles.statValue}>{subcontractors.length}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.statCard,
                styles.statCardSuccess,
                subcontractorStatusFilter === 'active' && styles.statCardActive
              ]}
              onPress={() => setSubcontractorStatusFilter('active')}
              activeOpacity={0.7}
            >
              <CheckCircle size={20} color="#10b981" />
              <Text style={[styles.statValue, styles.statValueSuccess]}>
                {subcontractors.filter((s) => s.status === 'Active').length}
              </Text>
              <Text style={styles.statLabel}>Active</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.statCard,
                styles.statCardWarning,
                subcontractorStatusFilter === 'inactive' && styles.statCardActive
              ]}
              onPress={() => setSubcontractorStatusFilter('inactive')}
              activeOpacity={0.7}
            >
              <Clock size={20} color="#f59e0b" />
              <Text style={[styles.statValue, styles.statValueWarning]}>
                {subcontractors.filter((s) => s.status !== 'Active').length}
              </Text>
              <Text style={styles.statLabel}>Inactive</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Search size={20} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search subcontractors..."
              value={subcontractorSearchQuery}
              onChangeText={handleSubcontractorSearch}
            />
            {subcontractorSearchQuery.length > 0 && (
              <TouchableOpacity onPress={() => handleSubcontractorSearch('')}>
                <X size={18} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.addButtonContainer}>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => router.push('/add-subcontractor' as any)}
            >
              <Plus size={20} color="#fff" />
              <Text style={styles.addButtonText}>Add Subcontractor</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3b82f6" />
            </View>
          ) : (
            <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
              {filteredSubcontractors.length === 0 ? (
                <View style={styles.emptyState}>
                  <Briefcase size={48} color="#cbd5e1" />
                  <Text style={styles.emptyStateTitle}>No Subcontractors Found</Text>
                  <Text style={styles.emptyStateText}>
                    {subcontractorSearchQuery ? 'Try adjusting your search' : 'No subcontractors have been added yet'}
                  </Text>
                </View>
              ) : (
                filteredSubcontractors.map((sub) => (
                  <TouchableOpacity
                    key={sub.id}
                    style={styles.employeeCard}
                    onPress={() => router.push(`/master-subcontractors?subcontractorId=${sub.id}` as any)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.employeeCardHeader}>
                      <Text style={styles.employeeName}>{sub.name}</Text>
                      {sub.status === 'Active' ? (
                        <View style={styles.statusBadgeSuccess}>
                          <CheckCircle size={14} color="#10b981" />
                          <Text style={styles.statusTextSuccess}>Active</Text>
                        </View>
                      ) : (
                        <View style={styles.statusBadgeWarning}>
                          <Clock size={14} color="#f59e0b" />
                          <Text style={styles.statusTextWarning}>Inactive</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.employeeCardBody}>
                      {sub.contactPerson && (
                        <Text style={styles.employeeRole}>Contact: {sub.contactPerson}</Text>
                      )}
                      {sub.contactNumber && (
                        <Text style={styles.employeeContact}>{sub.contactNumber}</Text>
                      )}
                      {sub.email && (
                        <Text style={styles.employeeEmail}>{sub.email}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          )}
        </View>
      )}

      <BottomTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#000000',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'flex-start',
    marginLeft: 8,
  },
  headerRight: {
    flexShrink: 0,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  tab: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#3b82f6',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: '#64748b',
    textAlign: 'center' as const,
  },
  tabTextActive: {
    color: '#3b82f6',
    fontWeight: '600' as const,
  },
  contentWrapper: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  statCardActive: {
    borderWidth: 2,
    borderColor: '#3b82f6',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  statCardSuccess: {
    backgroundColor: '#f0fdf4',
    borderColor: '#d1fae5',
  },
  statCardWarning: {
    backgroundColor: '#fffbeb',
    borderColor: '#fef3c7',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  statValueSuccess: {
    color: '#10b981',
  },
  statValueWarning: {
    color: '#f59e0b',
  },
  statLabel: {
    fontSize: 12,
    color: '#A0A0A0',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
  },
  addButtonContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
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
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  employeeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    flex: 1,
  },
  statusBadgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#d1fae5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusTextSuccess: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#10b981',
  },
  statusBadgeWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusTextWarning: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#f59e0b',
  },
  employeeCardBody: {
    gap: 6,
  },
  employeeRole: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#475569',
  },
  employeeContact: {
    fontSize: 14,
    color: '#64748b',
  },
  employeeEmail: {
    fontSize: 13,
    color: '#94a3b8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginTop: 8,
  },
  emptyStateText: {
    fontSize: 15,
    color: '#A0A0A0',
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  errorText: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#1e293b',
  },
  errorSubText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  backToHomeButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  backToHomeText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
  },
  quickActionsBar: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#262626',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#404040',
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },

});
