import { Stack } from 'expo-router';
import { StyleSheet, View, ActivityIndicator, Text, Platform, useWindowDimensions, Modal, TouchableOpacity, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { calculateBOQProgress, calculatePerUserScopeProgress, BOQProgress, SupervisorScopeProgress } from '../utils/progressCalculations';
import BottomTabBar from '../components/BottomTabBar';
import BOQProgressDashboard from '../components/BOQProgressDashboard';
import ProgressViewDashboard from '../components/ProgressViewDashboard';
import DashboardFilterSidebar, { FilterLevel, ViewType, DashboardSection } from '../components/DashboardFilterSidebar';
import { Search, User, Menu, X, MapPin } from 'lucide-react-native';
import { useState } from 'react';

interface FilterState {
  level: FilterLevel;
  pvAreaId?: string;
  blockAreaId?: string;
  supervisorId?: string;
}

export default function MasterDashboardScreen() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  
  const userDisplayName = user?.name ?? user?.userId ?? 'User';
  const userInitial = userDisplayName.charAt(0).toUpperCase();
  
  const isWebDesktop = Platform.OS === 'web' && width >= 1024;

  const [currentSection, setCurrentSection] = useState<DashboardSection>('PROGRESS');
  const [currentView, setCurrentView] = useState<ViewType>('TASKS_PROGRESS');
  const [filter, setFilter] = useState<FilterState>({
    level: 'ALL',
  });
  const [sidebarVisible, setSidebarVisible] = useState(false);

  const {
    data: boqProgress,
    isLoading: boqLoading,
    error: boqError,
  } = useQuery<BOQProgress>({
    queryKey: ['boqProgress', user?.siteId],
    queryFn: async () => {
      if (!user?.siteId) {
        return {
          totalQCValue: 0,
          totalUnverifiedValue: 0,
          totalBOQScope: 0,
          percentage: 0,
          unverifiedPercentage: 0,
          activitiesWithBOQ: 0,
          activitiesWithoutBOQ: 0,
          byMainMenu: {},
        };
      }
      return await calculateBOQProgress(user.siteId);
    },
    enabled: !!user?.siteId,
    staleTime: 30000,
    gcTime: 300000,
  });

  const {
    data: supervisorProgress,
    isLoading: progressLoading,
    error: progressError,
  } = useQuery<SupervisorScopeProgress[]>({
    queryKey: ['supervisorScopeProgress', user?.siteId],
    queryFn: async () => {
      if (!user?.siteId) return [];
      return await calculatePerUserScopeProgress(user.siteId);
    },
    enabled: !!user?.siteId && currentSection === 'PROGRESS',
    staleTime: 30000,
    gcTime: 300000,
  });

  const { data: pvAreas = [] } = useQuery({
    queryKey: ['pvAreas', user?.siteId],
    queryFn: async () => {
      if (!user?.siteId) return [];
      const q = query(
        collection(db, 'sites', user.siteId, 'pvAreas')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || doc.id,
      }));
    },
    enabled: !!user?.siteId && currentSection === 'PROGRESS',
    staleTime: 5 * 60 * 1000,
  });

  const { data: blockAreas = [] } = useQuery({
    queryKey: ['blockAreas', user?.siteId],
    queryFn: async () => {
      if (!user?.siteId) return [];
      const q = query(
        collection(db, 'sites', user.siteId, 'pvBlocks')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().blockNumber || doc.id,
        pvAreaId: doc.data().pvAreaId || '',
      }));
    },
    enabled: !!user?.siteId && currentSection === 'PROGRESS',
    staleTime: 5 * 60 * 1000,
  });

  const { data: supervisors = [] } = useQuery({
    queryKey: ['supervisors', user?.companyName, user?.siteId],
    queryFn: async () => {
      if (!user?.companyName || !user?.siteId) return [];
      const companiesQuery = query(
        collection(db, 'companies'),
        where('name', '==', user.companyName)
      );
      const companySnapshot = await getDocs(companiesQuery);
      if (companySnapshot.empty) return [];
      
      const companyId = companySnapshot.docs[0].id;
      const usersQuery = query(
        collection(db, 'companies', companyId, 'users'),
        where('siteId', '==', user.siteId)
      );
      const snapshot = await getDocs(usersQuery);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || doc.data().userId || doc.id,
        role: doc.data().role || 'Unknown',
      }));
    },
    enabled: !!user?.companyName && !!user?.siteId && currentSection === 'PROGRESS',
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = currentSection === 'BOQ' ? boqLoading : progressLoading;
  const error = currentSection === 'BOQ' ? boqError : progressError;

  const getHeaderTitle = () => {
    if (currentSection === 'BOQ') return 'BOQ Progress Dashboard';
    if (currentSection === 'PROGRESS') return 'Supervisor Progress Dashboard';
    return 'Dashboard';
  };

  if (isWebDesktop) {
    return (
      <View style={[styles.webContainer, { paddingTop: Math.max(insets.top, 0) }]}> 
        <DashboardFilterSidebar
          onFilterChange={setFilter}
          onViewChange={setCurrentView}
          onSectionChange={setCurrentSection}
          currentSection={currentSection}
          currentView={currentView}
          currentFilter={filter}
          pvAreas={pvAreas}
          blockAreas={blockAreas}
          supervisors={supervisors}
        />
        
        <View style={styles.webMainContent}>
          <View style={styles.webHeader}>
            <Text style={styles.webHeaderTitle}>{getHeaderTitle()}</Text>
            <View style={styles.webHeaderRight}>
              <View style={styles.searchContainer}>
                <Search size={18} color="#5f6368" strokeWidth={2} />
                <Text style={styles.searchPlaceholder}>Search...</Text>
              </View>
              <View style={styles.userProfile}>
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>
                    {userInitial}
                  </Text>
                </View>
                <Text style={styles.userName}>{userDisplayName}</Text>
              </View>
            </View>
          </View>
          
          {user?.siteName && (
            <View style={styles.siteIndicator}>
              <MapPin size={12} color="#5f6368" strokeWidth={2} />
              <Text style={styles.siteIndicatorText}>{user.siteName}</Text>
            </View>
          )}
          
          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#34A853" />
              <Text style={styles.loadingText}>Loading dashboard...</Text>
            </View>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Failed to load dashboard</Text>
            </View>
          )}

          {!isLoading && !error && currentSection === 'BOQ' && boqProgress && (
            <BOQProgressDashboard data={boqProgress} siteId={user?.siteId || ''} />
          )}

          {!isLoading && !error && currentSection === 'PROGRESS' && supervisorProgress && (
            <ProgressViewDashboard
              siteId={user?.siteId || ''}
              data={supervisorProgress}
              viewType={currentView}
              filter={filter}
              pvAreas={pvAreas}
              blockAreas={blockAreas}
              supervisors={supervisors}
              boqProgress={boqProgress}
            />
          )}

          {!isLoading && !error && !['BOQ', 'PROGRESS'].includes(currentSection) && (
            <View style={styles.placeholderContainer}>
              <Text style={styles.placeholderText}>
                {currentSection} section coming soon
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 0) }]}> 
      <Stack.Screen
        options={{
          title: currentSection === 'BOQ' ? 'BOQ Dashboard' : 'Progress Dashboard',
          headerStyle: {
            backgroundColor: '#ffffff',
          },
          headerTintColor: '#202124',
          headerTitleStyle: {
            fontWeight: '600' as const,
          },
          headerLeft: () => (
            <TouchableOpacity 
              style={styles.mobileHeaderLeft}
              onPress={() => setSidebarVisible(true)}
              activeOpacity={0.7}
            >
              <Menu size={24} color="#202124" strokeWidth={2} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <View style={styles.mobileHeaderRight}>
              <View style={styles.mobileUserAvatar}>
                <User size={16} color="#ffffff" strokeWidth={2.5} />
              </View>
            </View>
          ),
        }}
      />
      
      {user?.siteName && (
        <View style={styles.siteIndicator}>
          <MapPin size={12} color="#5f6368" strokeWidth={2} />
          <Text style={styles.siteIndicatorText}>{user.siteName}</Text>
        </View>
      )}
      
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#34A853" />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load dashboard</Text>
        </View>
      )}

      {!isLoading && !error && currentSection === 'BOQ' && boqProgress && (
        <BOQProgressDashboard data={boqProgress} siteId={user?.siteId || ''} />
      )}

      {!isLoading && !error && currentSection === 'PROGRESS' && supervisorProgress && (
        <ProgressViewDashboard
          siteId={user?.siteId || ''}
          data={supervisorProgress}
          viewType={currentView}
          filter={filter}
          pvAreas={pvAreas}
          blockAreas={blockAreas}
          supervisors={supervisors}
          boqProgress={boqProgress}
        />
      )}

      {!isLoading && !error && !['BOQ', 'PROGRESS'].includes(currentSection) && (
        <View style={styles.placeholderContainer}>
          <Text style={styles.placeholderText}>
            {currentSection} section coming soon
          </Text>
        </View>
      )}
      
      <Modal
        visible={sidebarVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSidebarVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setSidebarVisible(false)}
        >
          <Pressable 
            style={[styles.mobileSidebarContainer, { paddingTop: insets.top }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.mobileSidebarHeader}>
              <Text style={styles.mobileSidebarTitle}>Dashboard Menu</Text>
              <TouchableOpacity
                onPress={() => setSidebarVisible(false)}
                activeOpacity={0.7}
              >
                <X size={24} color="#202124" strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <DashboardFilterSidebar
              onFilterChange={(f) => {
                setFilter(f);
                setSidebarVisible(false);
              }}
              onViewChange={(v) => {
                setCurrentView(v);
                setSidebarVisible(false);
              }}
              onSectionChange={(s) => {
                setCurrentSection(s);
                setSidebarVisible(false);
              }}
              currentSection={currentSection}
              currentView={currentView}
              currentFilter={filter}
              pvAreas={pvAreas}
              blockAreas={blockAreas}
              supervisors={supervisors}
            />
          </Pressable>
        </Pressable>
      </Modal>
      
      <BottomTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  webContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#000000',
  },
  webMainContent: {
    flex: 1,
    backgroundColor: '#000000',
  },
  webHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingVertical: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8eaed',
  },
  webHeaderTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#202124',
    letterSpacing: -0.5,
  },
  webHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 8,
    minWidth: 300,
  },
  searchPlaceholder: {
    fontSize: 14,
    color: '#A0A0A0',
  },
  userProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#ffffff',
  },
  userName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#202124',
  },
  mobileHeaderLeft: {
    marginLeft: 16,
  },
  mobileHeaderRight: {
    marginRight: 16,
  },
  mobileUserAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  mobileSidebarContainer: {
    width: '85%',
    maxWidth: 320,
    height: '100%',
    backgroundColor: '#ffffff',
  },
  mobileSidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e8eaed',
  },
  mobileSidebarTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#202124',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
  },
  loadingText: {
    fontSize: 14,
    color: '#A0A0A0',
    marginTop: 16,
  },
  errorContainer: {
    margin: 20,
    padding: 24,
    backgroundColor: '#fee',
    borderRadius: 12,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#c62828',
    textAlign: 'center',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
  },
  placeholderText: {
    fontSize: 16,
    color: '#A0A0A0',
    textAlign: 'center',
  },
  siteIndicator: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 4,
    backgroundColor: '#000000',
  },
  siteIndicatorText: {
    fontSize: 11,
    color: '#A0A0A0',
    fontWeight: '500' as const,
  },
});
