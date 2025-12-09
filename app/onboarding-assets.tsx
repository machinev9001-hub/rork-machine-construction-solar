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
import { ArrowLeft, Search, X, CheckCircle, Clock, Package, Plus, Bell } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { PlantAsset } from '@/types';

export default function OnboardingAssetsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [assets, setAssets] = useState<PlantAsset[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<PlantAsset[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [unreadCount, setUnreadCount] = useState(0);
  const [filterType, setFilterType] = useState<'all' | 'owned' | 'subcontractor'>('all');

  const loadAssets = useCallback(async () => {
    console.log('[OnboardingAssets] ===== LOAD ASSETS START =====');
    console.log('[OnboardingAssets] User:', {
      id: user?.id,
      userId: user?.userId,
      masterAccountId: user?.masterAccountId,
      siteId: user?.siteId,
      currentCompanyId: user?.currentCompanyId
    });

    if (!user?.masterAccountId || !user?.siteId) {
      console.log('[OnboardingAssets] ❌ No masterAccountId or siteId, cannot load assets');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const assetsRef = collection(db, 'plantAssets');
      
      console.log('[OnboardingAssets] 🔍 Querying by masterAccountId:', user.masterAccountId, 'siteId:', user.siteId);
      const q = query(
        assetsRef,
        where('masterAccountId', '==', user.masterAccountId),
        where('siteId', '==', user.siteId)
      );
      
      console.log('[OnboardingAssets] 🚀 Executing query...');
      const querySnapshot = await getDocs(q);
      console.log('[OnboardingAssets] ✅ Query complete. Docs returned:', querySnapshot.size);

      const loadedAssets: PlantAsset[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as PlantAsset;
        console.log('[OnboardingAssets] 📦 Asset doc:', doc.id);
        console.log('[OnboardingAssets]   - assetId:', data.assetId);
        console.log('[OnboardingAssets]   - type:', data.type);
        console.log('[OnboardingAssets]   - location:', data.location);
        console.log('[OnboardingAssets]   - archived:', data.archived);
        console.log('[OnboardingAssets]   - siteId:', data.siteId);
        console.log('[OnboardingAssets]   - masterAccountId:', data.masterAccountId);
        console.log('[OnboardingAssets]   - companyId:', data.companyId);
        console.log('[OnboardingAssets]   - inductionStatus:', data.inductionStatus);
        console.log('[OnboardingAssets]   - allocationStatus:', data.allocationStatus);
        loadedAssets.push({
          id: doc.id,
          ...data,
        });
      });

      console.log('[OnboardingAssets] 📊 Total assets loaded:', loadedAssets.length);
      const activeAssets = loadedAssets.filter((a) => !a.archived);
      console.log('[OnboardingAssets] ✅ Active assets (not archived):', activeAssets.length);
      const archivedAssets = loadedAssets.filter((a) => a.archived);
      console.log('[OnboardingAssets] 📁 Archived assets:', archivedAssets.length);
      
      setAssets(loadedAssets);
      setFilteredAssets(activeAssets);
      console.log('[OnboardingAssets] ===== LOAD ASSETS COMPLETE =====');
    } catch (error) {
      console.error('[OnboardingAssets] ❌ Error loading assets:', error);
      console.error('[OnboardingAssets] Error details:', JSON.stringify(error, null, 2));
      Alert.alert('Error', 'Failed to load plant assets. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.masterAccountId]);

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
      console.error('[OnboardingAssets] Error loading unread count:', error);
    }
  }, [user?.id, user?.siteId]);

  useFocusEffect(
    useCallback(() => {
      loadAssets();
      loadUnreadCount();
    }, [loadAssets, loadUnreadCount])
  );

  const applyFilters = useCallback(
    (search: string, type: 'all' | 'owned' | 'subcontractor', tab: 'active' | 'archived') => {
      let filtered = assets.filter((a) => 
        tab === 'active' ? !a.archived : a.archived
      );

      // Apply ownership filter
      if (type === 'owned') {
        filtered = filtered.filter((asset) => !asset.subcontractor || asset.subcontractor === '');
      } else if (type === 'subcontractor') {
        filtered = filtered.filter((asset) => asset.subcontractor && asset.subcontractor !== '');
      }

      // Apply search filter
      if (search.trim() !== '') {
        const query = search.toLowerCase();
        filtered = filtered.filter((asset) => {
          return (
            asset.assetId.toLowerCase().includes(query) ||
            asset.type.toLowerCase().includes(query) ||
            asset.location?.toLowerCase().includes(query) ||
            asset.assignedJob?.toLowerCase().includes(query) ||
            asset.subcontractor?.toLowerCase().includes(query)
          );
        });
      }

      setFilteredAssets(filtered);
    },
    [assets]
  );

  const handleTabChange = useCallback(
    (tab: 'active' | 'archived') => {
      setActiveTab(tab);
      setSearchQuery('');
      setFilterType('all');
      applyFilters('', 'all', tab);
    },
    [applyFilters]
  );

  const handleSearch = useCallback(
    (text: string) => {
      setSearchQuery(text);
      applyFilters(text, filterType, activeTab);
    },
    [filterType, activeTab, applyFilters]
  );

  const handleFilterChange = useCallback(
    (type: 'all' | 'owned' | 'subcontractor') => {
      setFilterType(type);
      applyFilters(searchQuery, type, activeTab);
    },
    [searchQuery, activeTab, applyFilters]
  );

  const handleAssetPress = (asset: PlantAsset) => {
    router.push(`/onboarding-asset-detail?assetId=${asset.id}` as any);
  };

  const activeAssets = assets.filter((a) => !a.archived);
  const archivedAssets = assets.filter((a) => a.archived);
  const inductedCount = activeAssets.filter((a) => a.inductionStatus).length;
  const pendingCount = activeAssets.filter((a) => !a.inductionStatus).length;

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
          onPress={() => router.push('/onboarding-dashboard' as any)}
        >
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Plant & Assets</Text>
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
            onPress={() => router.push('/add-asset' as any)}
          >
            <Plus size={24} color="#3b82f6" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'active' && styles.tabActive]}
          onPress={() => handleTabChange('active')}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
            Active ({activeAssets.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'archived' && styles.tabActive]}
          onPress={() => handleTabChange('archived')}
        >
          <Text style={[styles.tabText, activeTab === 'archived' && styles.tabTextActive]}>
            Archived ({archivedAssets.length})
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'active' && (
        <>
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Package size={20} color="#64748b" />
              <Text style={styles.statValue}>{activeAssets.length}</Text>
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
              style={[styles.filterButton, filterType === 'owned' && styles.filterButtonActive]}
              onPress={() => handleFilterChange('owned')}
            >
              <Text style={[styles.filterButtonText, filterType === 'owned' && styles.filterButtonTextActive]}>
                Owned
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filterType === 'subcontractor' && styles.filterButtonActive]}
              onPress={() => handleFilterChange('subcontractor')}
            >
              <Text style={[styles.filterButtonText, filterType === 'subcontractor' && styles.filterButtonTextActive]}>
                Subcontractor
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <View style={styles.searchContainer}>
        <Search size={20} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search assets..."
          value={searchQuery}
          onChangeText={handleSearch}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <X size={18} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
        {filteredAssets.length === 0 ? (
          <View style={styles.emptyState}>
            <Package size={48} color="#cbd5e1" />
            <Text style={styles.emptyStateTitle}>No Assets Found</Text>
            <Text style={styles.emptyStateText}>
              {searchQuery 
                ? 'Try adjusting your search' 
                : activeTab === 'active'
                ? 'No active plant assets'
                : 'No archived plant assets'}
            </Text>
          </View>
        ) : (
          filteredAssets.map((asset) => (
            <TouchableOpacity
              key={asset.id}
              style={styles.assetCard}
              onPress={() => handleAssetPress(asset)}
              activeOpacity={0.7}
            >
              <View style={styles.assetCardHeader}>
                <Text style={styles.assetId}>{asset.assetId}</Text>
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
              <View style={styles.assetCardBody}>
                <View style={styles.assetInfo}>
                  <Text style={styles.assetType}>{asset.type}</Text>
                  {asset.subcontractor && (
                    <View style={styles.subcontractorBadge}>
                      <Text style={styles.subcontractorText}>{asset.subcontractor}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.assetLocation}>Site ID: {asset.location}</Text>
                {asset.onboardingDate && asset.onboardingDate.toDate && (
                  <Text style={styles.assetDate}>
                    Onboarded: {asset.onboardingDate.toDate().toLocaleDateString()}
                  </Text>
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
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
  assetCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  assetCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  assetId: {
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
  assetCardBody: {
    gap: 6,
  },
  assetType: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#A0A0A0',
  },
  assetLocation: {
    fontSize: 14,
    color: '#A0A0A0',
  },
  assetDate: {
    fontSize: 13,
    color: '#A0A0A0',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  tabActive: {
    backgroundColor: '#3b82f6',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#A0A0A0',
  },
  tabTextActive: {
    color: '#fff',
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
  filterButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
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
  assetInfo: {
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
