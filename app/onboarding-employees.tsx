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
} from 'react-native';
import { ArrowLeft, Search, X, CheckCircle, Clock, Users, Plus, Bell } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Employee } from '@/types';

export default function OnboardingEmployeesScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [filterType, setFilterType] = useState<'all' | 'employee' | 'subcontractor'>('all');

  const loadEmployees = useCallback(async () => {
    if (!user?.masterAccountId) {
      console.log('[OnboardingEmployees] No masterAccountId, cannot load employees');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const employeesRef = collection(db, 'employees');
      
      let q;
      if (user.siteId) {
        console.log('[OnboardingEmployees] Loading employees for siteId:', user.siteId);
        q = query(
          employeesRef,
          where('siteId', '==', user.siteId),
          orderBy('name', 'asc')
        );
      } else {
        console.log('[OnboardingEmployees] Loading employees for masterAccountId:', user.masterAccountId);
        q = query(
          employeesRef,
          where('masterAccountId', '==', user.masterAccountId),
          orderBy('name', 'asc')
        );
      }
      
      const querySnapshot = await getDocs(q);

      const loadedEmployees: Employee[] = [];
      querySnapshot.forEach((doc) => {
        loadedEmployees.push({
          id: doc.id,
          ...doc.data(),
        } as Employee);
      });

      console.log('[OnboardingEmployees] Loaded', loadedEmployees.length, 'employees');
      setEmployees(loadedEmployees);
      setFilteredEmployees(loadedEmployees);
    } catch (error) {
      console.error('[OnboardingEmployees] Error loading employees:', error);
      Alert.alert('Error', 'Failed to load employees');
    } finally {
      setIsLoading(false);
    }
  }, [user?.siteId, user?.masterAccountId]);

  const loadUnreadCount = useCallback(async () => {
    if (!user?.id || !user?.siteId) return;

    try {
      const messagesRef = collection(db, 'onboardingMessages');
      const q = query(
        messagesRef,
        where('siteId', '==', user.siteId),
        where('toUserId', '==', user.id),
        where('read', '==', false)
      );
      const querySnapshot = await getDocs(q);
      setUnreadCount(querySnapshot.size);
    } catch (error) {
      console.error('[OnboardingEmployees] Error loading unread count:', error);
    }
  }, [user?.id, user?.siteId]);

  const applyFilters = useCallback(
    (search: string, type: 'all' | 'employee' | 'subcontractor') => {
      let filtered = employees;

      // Apply type filter
      if (type === 'employee') {
        filtered = filtered.filter((emp) => !emp.type || emp.type === 'employee');
      } else if (type === 'subcontractor') {
        filtered = filtered.filter((emp) => emp.type === 'subcontractor');
      }

      // Apply search filter
      if (search.trim() !== '') {
        const query = search.toLowerCase();
        filtered = filtered.filter((emp) => {
          return (
            emp.name.toLowerCase().includes(query) ||
            emp.role.toLowerCase().includes(query) ||
            emp.contact.toLowerCase().includes(query) ||
            emp.email?.toLowerCase().includes(query) ||
            emp.subcontractorCompany?.toLowerCase().includes(query)
          );
        });
      }

      setFilteredEmployees(filtered);
    },
    [employees]
  );

  const handleSearch = useCallback(
    (text: string) => {
      setSearchQuery(text);
      applyFilters(text, filterType);
    },
    [filterType, applyFilters]
  );

  const handleFilterChange = useCallback(
    (type: 'all' | 'employee' | 'subcontractor') => {
      setFilterType(type);
      applyFilters(searchQuery, type);
    },
    [searchQuery, applyFilters]
  );

  useFocusEffect(
    useCallback(() => {
      loadEmployees();
      loadUnreadCount();
    }, [loadEmployees, loadUnreadCount])
  );

  const handleEmployeePress = (employee: Employee) => {
    router.push(`/onboarding-employee-detail?employeeId=${employee.id}` as any);
  };

  const inductedCount = employees.filter((e) => e.inductionStatus).length;
  const pendingCount = employees.filter((e) => !e.inductionStatus).length;

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
        >
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Employees</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/onboarding-messages' as any)}
          >
            <Bell size={22} color="#FFFFFF" />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/add-employee' as any)}
          >
            <Plus size={24} color="#3b82f6" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Users size={20} color="#64748b" />
          <Text style={styles.statValue}>{employees.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={[styles.statCard, styles.statCardSuccess]}>
          <CheckCircle size={20} color="#10b981" />
          <Text style={[styles.statValue, styles.statValueSuccess]}>{inductedCount}</Text>
          <Text style={styles.statLabel}>Inducted</Text>
        </View>
        <View style={[styles.statCard, styles.statCardWarning]}>
          <Clock size={20} color="#f59e0b" />
          <Text style={[styles.statValue, styles.statValueWarning]}>{pendingCount}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
      </View>

      <View style={styles.filtersSection}>
        <View style={styles.filterButtons}>
          <TouchableOpacity
            style={[styles.filterButton, filterType === 'all' && styles.filterButtonActive]}
            onPress={() => handleFilterChange('all')}
          >
            <Text style={[styles.filterButtonText, filterType === 'all' && styles.filterButtonTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filterType === 'employee' && styles.filterButtonActive]}
            onPress={() => handleFilterChange('employee')}
          >
            <Text style={[styles.filterButtonText, filterType === 'employee' && styles.filterButtonTextActive]}>
              Employees
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filterType === 'subcontractor' && styles.filterButtonActive]}
            onPress={() => handleFilterChange('subcontractor')}
          >
            <Text style={[styles.filterButtonText, filterType === 'subcontractor' && styles.filterButtonTextActive]}>
              Subcontractors
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Search size={20} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search..."
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <X size={18} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

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
                <View style={styles.employeeInfo}>
                  <Text style={styles.employeeRole}>{employee.role}</Text>
                  {employee.type === 'subcontractor' && employee.subcontractorCompany && (
                    <View style={styles.subcontractorBadge}>
                      <Text style={styles.subcontractorText}>{employee.subcontractorCompany}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.employeeContact}>{employee.contact}</Text>
                {employee.email && (
                  <Text style={styles.employeeEmail}>{employee.email}</Text>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative' as const,
  },
  badge: {
    position: 'absolute' as const,
    top: 2,
    right: 2,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: '#fff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    color: '#A0A0A0',
  },
  employeeContact: {
    fontSize: 14,
    color: '#A0A0A0',
  },
  employeeEmail: {
    fontSize: 13,
    color: '#A0A0A0',
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
    color: '#FFFFFF',
    marginTop: 8,
  },
  emptyStateText: {
    fontSize: 15,
    color: '#A0A0A0',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  filtersSection: {
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  filterButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#A0A0A0',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  employeeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  subcontractorBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#7dd3fc',
  },
  subcontractorText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#0369a1',
  },
});
