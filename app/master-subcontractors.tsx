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
import { ArrowLeft, Search, X, Building, CheckCircle, Clock, Plus, Archive, RefreshCw, Wrench } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { Subcontractor } from '@/types';
import { getSubcontractorsByMasterAccount, archiveSubcontractor, activateSubcontractor, migrateSubcontractorsSiteId } from '@/utils/subcontractorManager';
import HeaderSyncStatus from '@/components/HeaderSyncStatus';
import { Colors } from '@/constants/colors';

export default function MasterSubcontractorsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [filteredSubcontractors, setFilteredSubcontractors] = useState<Subcontractor[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'Active' | 'Inactive' | 'Archived'>('all');
  const [filterCrossHire, setFilterCrossHire] = useState<'all' | 'yes' | 'no'>('all');

  const loadSubcontractors = useCallback(async () => {
    if (!user?.masterAccountId || !user?.siteId) {
      console.log('[MasterSubcontractors] No masterAccountId or siteId, cannot load subcontractors');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      console.log('[MasterSubcontractors] Loading subcontractors for masterAccountId:', user.masterAccountId, 'siteId:', user.siteId);
      console.log('[MasterSubcontractors] Current user siteName:', user.siteName);
      
      const loadedSubcontractors = await getSubcontractorsByMasterAccount(user.masterAccountId, undefined, user.siteId);
      
      console.log('[MasterSubcontractors] Loaded', loadedSubcontractors.length, 'subcontractors for site', user.siteId);
      
      loadedSubcontractors.forEach((sc, index) => {
        console.log(`[MasterSubcontractors] Subcontractor ${index + 1}: ${sc.name}, siteId: ${sc.siteId}, masterAccountId: ${sc.masterAccountId}`);
      });
      
      setSubcontractors(loadedSubcontractors);
      setFilteredSubcontractors(loadedSubcontractors);
    } catch (error) {
      console.error('[MasterSubcontractors] Error loading subcontractors:', error);
      Alert.alert('Error', 'Failed to load subcontractors');
    } finally {
      setIsLoading(false);
    }
  }, [user?.masterAccountId, user?.siteId]);

  const applyFilters = useCallback(
    (search: string, status: typeof filterStatus, crossHire: typeof filterCrossHire) => {
      let filtered = subcontractors;

      if (status !== 'all') {
        filtered = filtered.filter((sc) => sc.status === status);
      }

      if (crossHire === 'yes') {
        filtered = filtered.filter((sc) => sc.isCrossHire);
      } else if (crossHire === 'no') {
        filtered = filtered.filter((sc) => !sc.isCrossHire);
      }

      if (search.trim() !== '') {
        const query = search.toLowerCase();
        filtered = filtered.filter((sc) => {
          return (
            sc.name.toLowerCase().includes(query) ||
            sc.legalEntityName?.toLowerCase().includes(query) ||
            sc.contactPerson?.toLowerCase().includes(query) ||
            sc.contactNumber?.toLowerCase().includes(query) ||
            sc.adminEmail?.toLowerCase().includes(query)
          );
        });
      }

      setFilteredSubcontractors(filtered);
    },
    [subcontractors]
  );

  const handleSearch = useCallback(
    (text: string) => {
      setSearchQuery(text);
      applyFilters(text, filterStatus, filterCrossHire);
    },
    [filterStatus, filterCrossHire, applyFilters]
  );

  const handleStatusFilter = useCallback(
    (status: typeof filterStatus) => {
      setFilterStatus(status);
      applyFilters(searchQuery, status, filterCrossHire);
    },
    [searchQuery, filterCrossHire, applyFilters]
  );

  const handleCrossHireFilter = useCallback(
    (crossHire: typeof filterCrossHire) => {
      setFilterCrossHire(crossHire);
      applyFilters(searchQuery, filterStatus, crossHire);
    },
    [searchQuery, filterStatus, applyFilters]
  );

  useFocusEffect(
    useCallback(() => {
      loadSubcontractors();
    }, [loadSubcontractors])
  );

  const handleMigrateSiteIds = async () => {
    if (!user?.masterAccountId || !user?.siteId) {
      Alert.alert('Error', 'Missing account or site information');
      return;
    }

    Alert.alert(
      'Migrate Subcontractors',
      `This will add siteId (${user.siteId}) to all subcontractors that are missing it. This is needed for proper site isolation.\n\nDo you want to continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Migrate',
          onPress: async () => {
            try {
              setIsLoading(true);
              const result = await migrateSubcontractorsSiteId(user.masterAccountId!, user.siteId!);
              Alert.alert(
                'Migration Complete',
                `Total: ${result.total}\nUpdated: ${result.updated}\nErrors: ${result.errors}`,
                [{ text: 'OK', onPress: () => loadSubcontractors() }]
              );
            } catch (error) {
              console.error('[MasterSubcontractors] Migration error:', error);
              Alert.alert('Error', 'Failed to migrate subcontractors');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleSubcontractorPress = (subcontractor: Subcontractor) => {
    Alert.alert(
      subcontractor.name,
      'Choose an action',
      [
        {
          text: 'Edit',
          onPress: () => {
            router.push(`/edit-subcontractor?id=${subcontractor.id}` as any);
          },
        },
        subcontractor.status === 'Active' ? {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            Alert.alert(
              'Archive Subcontractor',
              `Are you sure you want to archive ${subcontractor.name}?`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Archive',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await archiveSubcontractor(subcontractor.id!);
                      Alert.alert('Success', 'Subcontractor archived successfully');
                      loadSubcontractors();
                    } catch (err) {
                      console.error('[MasterSubcontractors] Error archiving subcontractor:', err);
                      Alert.alert('Error', 'Failed to archive subcontractor');
                    }
                  },
                },
              ]
            );
          },
        } : {
          text: 'Activate',
          onPress: async () => {
            try {
              await activateSubcontractor(subcontractor.id!);
              Alert.alert('Success', 'Subcontractor activated successfully');
              loadSubcontractors();
            } catch (err) {
              console.error('[MasterSubcontractors] Error activating subcontractor:', err);
              Alert.alert('Error', 'Failed to activate subcontractor');
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const activeCount = subcontractors.filter((sc) => sc.status === 'Active').length;
  const inactiveCount = subcontractors.filter((sc) => sc.status === 'Inactive').length;
  const archivedCount = subcontractors.filter((sc) => sc.status === 'Archived').length;
  const crossHireCount = subcontractors.filter((sc) => sc.isCrossHire).length;

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
          <ArrowLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Subcontractors</Text>
          <HeaderSyncStatus />
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => loadSubcontractors()}
          >
            <RefreshCw size={22} color={Colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleMigrateSiteIds}
          >
            <Wrench size={22} color="#f59e0b" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/add-subcontractor' as any)}
          >
            <Plus size={24} color="#3b82f6" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Building size={20} color="#64748b" />
          <Text style={styles.statValue}>{subcontractors.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={[styles.statCard, styles.statCardSuccess]}>
          <CheckCircle size={20} color="#10b981" />
          <Text style={[styles.statValue, styles.statValueSuccess]}>{activeCount}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={[styles.statCard, styles.statCardWarning]}>
          <Clock size={20} color="#f59e0b" />
          <Text style={[styles.statValue, styles.statValueWarning]}>{inactiveCount}</Text>
          <Text style={styles.statLabel}>Inactive</Text>
        </View>
        <View style={[styles.statCard, styles.statCardInfo]}>
          <Archive size={20} color="#3b82f6" />
          <Text style={[styles.statValue, styles.statValueInfo]}>{crossHireCount}</Text>
          <Text style={styles.statLabel}>Cross-Hire</Text>
        </View>
      </View>

      <View style={styles.filtersSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterButtonsRow}>
          <View style={styles.filterButtonsContainer}>
            <Text style={styles.filterLabel}>Status:</Text>
            <TouchableOpacity
              style={[styles.filterButton, filterStatus === 'all' && styles.filterButtonActive]}
              onPress={() => handleStatusFilter('all')}
            >
              <Text style={[styles.filterButtonText, filterStatus === 'all' && styles.filterButtonTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filterStatus === 'Active' && styles.filterButtonActive]}
              onPress={() => handleStatusFilter('Active')}
            >
              <Text style={[styles.filterButtonText, filterStatus === 'Active' && styles.filterButtonTextActive]}>
                Active
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filterStatus === 'Inactive' && styles.filterButtonActive]}
              onPress={() => handleStatusFilter('Inactive')}
            >
              <Text style={[styles.filterButtonText, filterStatus === 'Inactive' && styles.filterButtonTextActive]}>
                Inactive
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filterStatus === 'Archived' && styles.filterButtonActive]}
              onPress={() => handleStatusFilter('Archived')}
            >
              <Text style={[styles.filterButtonText, filterStatus === 'Archived' && styles.filterButtonTextActive]}>
                Archived
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterButtonsRow}>
          <View style={styles.filterButtonsContainer}>
            <Text style={styles.filterLabel}>Cross-Hire:</Text>
            <TouchableOpacity
              style={[styles.filterButton, filterCrossHire === 'all' && styles.filterButtonActive]}
              onPress={() => handleCrossHireFilter('all')}
            >
              <Text style={[styles.filterButtonText, filterCrossHire === 'all' && styles.filterButtonTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filterCrossHire === 'yes' && styles.filterButtonActive]}
              onPress={() => handleCrossHireFilter('yes')}
            >
              <Text style={[styles.filterButtonText, filterCrossHire === 'yes' && styles.filterButtonTextActive]}>
                Yes
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filterCrossHire === 'no' && styles.filterButtonActive]}
              onPress={() => handleCrossHireFilter('no')}
            >
              <Text style={[styles.filterButtonText, filterCrossHire === 'no' && styles.filterButtonTextActive]}>
                No
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <View style={styles.searchContainer}>
          <Search size={20} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search subcontractors..."
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
        {filteredSubcontractors.length === 0 ? (
          <View style={styles.emptyState}>
            <Building size={48} color="#cbd5e1" />
            <Text style={styles.emptyStateTitle}>No Subcontractors Found</Text>
            <Text style={styles.emptyStateText}>
              {searchQuery || filterStatus !== 'all' || filterCrossHire !== 'all'
                ? 'Try adjusting your search or filters'
                : 'No subcontractors have been added yet'}
            </Text>
          </View>
        ) : (
          filteredSubcontractors.map((subcontractor) => (
            <TouchableOpacity
              key={subcontractor.id}
              style={styles.subcontractorCard}
              onPress={() => handleSubcontractorPress(subcontractor)}
              activeOpacity={0.7}
            >
              <View style={styles.subcontractorCardHeader}>
                <View style={styles.subcontractorNameContainer}>
                  <Text style={styles.subcontractorName}>{subcontractor.name}</Text>
                  {subcontractor.isCrossHire && (
                    <View style={styles.crossHireBadge}>
                      <Text style={styles.crossHireText}>Cross-Hire</Text>
                    </View>
                  )}
                </View>
                {subcontractor.status === 'Active' ? (
                  <View style={styles.statusBadgeSuccess}>
                    <CheckCircle size={14} color="#10b981" />
                    <Text style={styles.statusTextSuccess}>Active</Text>
                  </View>
                ) : subcontractor.status === 'Inactive' ? (
                  <View style={styles.statusBadgeWarning}>
                    <Clock size={14} color="#f59e0b" />
                    <Text style={styles.statusTextWarning}>Inactive</Text>
                  </View>
                ) : (
                  <View style={styles.statusBadgeDanger}>
                    <Archive size={14} color="#ef4444" />
                    <Text style={styles.statusTextDanger}>Archived</Text>
                  </View>
                )}
              </View>
              <View style={styles.subcontractorCardBody}>
                {subcontractor.legalEntityName && (
                  <Text style={styles.subcontractorLegal}>{subcontractor.legalEntityName}</Text>
                )}
                {subcontractor.contactPerson && (
                  <Text style={styles.subcontractorInfo}>Contact: {subcontractor.contactPerson}</Text>
                )}
                <Text style={styles.subcontractorContact}>{subcontractor.contactNumber}</Text>
                {subcontractor.adminEmail && (
                  <Text style={styles.subcontractorEmail}>{subcontractor.adminEmail}</Text>
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
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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
  },
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
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
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statCardSuccess: {
    backgroundColor: '#f0fdf4',
    borderColor: '#d1fae5',
  },
  statCardWarning: {
    backgroundColor: '#fffbeb',
    borderColor: '#fef3c7',
  },
  statCardInfo: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.background,
  },
  statValueSuccess: {
    color: '#10b981',
  },
  statValueWarning: {
    color: '#f59e0b',
  },
  statValueInfo: {
    color: '#3b82f6',
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  filtersSection: {
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  filterButtonsRow: {
    flexDirection: 'row',
  },
  filterButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.background,
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.background,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  subcontractorCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  subcontractorCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  subcontractorNameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  subcontractorName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.background,
  },
  crossHireBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#93c5fd',
  },
  crossHireText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#1e40af',
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
  statusBadgeDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusTextDanger: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#ef4444',
  },
  subcontractorCardBody: {
    gap: 6,
  },
  subcontractorLegal: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  subcontractorInfo: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  subcontractorContact: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  subcontractorEmail: {
    fontSize: 13,
    color: Colors.textSecondary,
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
    color: Colors.text,
    marginTop: 8,
  },
  emptyStateText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
