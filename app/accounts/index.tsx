import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FileText, BarChart3, List } from 'lucide-react-native';
import { collection, query, where, getDocs } from 'firebase/firestore';

import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/config/firebase';
import PlantAssetsTimesheetsTab from '@/components/accounts/PlantAssetsTimesheetsTab';
import ProgressViewDashboard from '@/components/ProgressViewDashboard';
import DashboardFilterSidebar from '@/components/DashboardFilterSidebar';
import ExportJobsList from '@/components/accounts/ExportJobsList';
import type { FilterValues } from '@/components/accounts/FiltersBar';
import type { ExportRequest } from '@/components/accounts/ExportRequestModal';
import type { ExportJob } from '@/components/accounts/ExportJobsList';
import { handleExportRequest, downloadFile } from '@/utils/accounts/exportHandler';
import { calculatePerUserScopeProgress, SupervisorScopeProgress } from '@/utils/progressCalculations';
import type { ViewType, FilterLevel, DashboardSection } from '@/components/DashboardFilterSidebar';

type TabKey = 'assets' | 'progress' | 'jobs';

interface FilterState {
  level: FilterLevel;
  pvAreaId?: string;
  blockAreaId?: string;
  supervisorId?: string;
}

export default function AccountsIndexScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>('progress');
  const [filters, setFilters] = useState<FilterValues>({});
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  
  const [dashboardSection, setDashboardSection] = useState<DashboardSection>('PROGRESS');
  const [viewType, setViewType] = useState<ViewType>('TASKS_PROGRESS');
  const [filterState, setFilterState] = useState<FilterState>({ level: 'ALL' });
  const [progressData, setProgressData] = useState<SupervisorScopeProgress[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(true);
  const [pvAreas, setPvAreas] = useState<{ id: string; name: string }[]>([]);
  const [blockAreas, setBlockAreas] = useState<{ id: string; name: string; pvAreaId: string }[]>([]);
  const [supervisors, setSupervisors] = useState<{ id: string; name: string; role: string }[]>([]);

  const { user } = useAuth();

  useEffect(() => {
    if (user?.siteId) {
      loadProgressData();
    } else {
      setLoadingProgress(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.siteId]);

  const loadProgressData = async () => {
    if (!user?.siteId) {
      console.log('[Dashboard] No siteId available');
      setLoadingProgress(false);
      return;
    }

    console.log('[Dashboard] Loading progress data for site:', user.siteId);
    setLoadingProgress(true);

    try {
      const [supervisorProgress, pvAreasData, blockAreasData, supervisorsData] = await Promise.all([
        calculatePerUserScopeProgress(user.siteId),
        loadPvAreas(user.siteId),
        loadBlockAreas(user.siteId),
        loadSupervisors(user.siteId),
      ]);

      console.log('[Dashboard] Progress data loaded:', supervisorProgress.length, 'supervisors');
      setProgressData(supervisorProgress);
      setPvAreas(pvAreasData);
      setBlockAreas(blockAreasData);
      setSupervisors(supervisorsData);
    } catch (error) {
      console.error('[Dashboard] Error loading progress:', error);
      Alert.alert('Error', 'Failed to load progress data');
    } finally {
      setLoadingProgress(false);
    }
  };

  const loadPvAreas = async (siteId: string): Promise<{ id: string; name: string }[]> => {
    try {
      const pvAreasRef = collection(db, 'pvAreas');
      const pvAreasQuery = query(pvAreasRef, where('siteId', '==', siteId));
      const snapshot = await getDocs(pvAreasQuery);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || doc.data().pvAreaName || `PV Area ${doc.id.slice(0, 8)}`,
      }));
    } catch (error) {
      console.error('[Dashboard] Error loading PV areas:', error);
      return [];
    }
  };

  const loadBlockAreas = async (siteId: string): Promise<{ id: string; name: string; pvAreaId: string }[]> => {
    try {
      const blocksRef = collection(db, 'pvBlocks');
      const blocksQuery = query(blocksRef, where('siteId', '==', siteId));
      const snapshot = await getDocs(blocksQuery);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().blockName || doc.data().name || `Block ${doc.id.slice(0, 8)}`,
        pvAreaId: doc.data().pvAreaId || '',
      }));
    } catch (error) {
      console.error('[Dashboard] Error loading block areas:', error);
      return [];
    }
  };

  const loadSupervisors = async (siteId: string): Promise<{ id: string; name: string; role: string }[]> => {
    try {
      const usersRef = collection(db, 'users');
      const usersQuery = query(usersRef, where('siteId', '==', siteId));
      const snapshot = await getDocs(usersQuery);
      const uniqueSupervisors = new Map<string, { id: string; name: string; role: string }>();
      
      snapshot.docs.forEach(doc => {
        const userData = doc.data();
        const userId = userData.userId || doc.id;
        const name = userData.name || userId;
        const role = userData.role || 'Unknown';
        uniqueSupervisors.set(userId, { id: userId, name, role });
      });
      
      return Array.from(uniqueSupervisors.values()).sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('[Dashboard] Error loading supervisors:', error);
      return [];
    }
  };

  const handleExport = async (request: ExportRequest) => {
    if (!user) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    console.log('[Accounts] Handling export request:', request);

    try {
      const result = await handleExportRequest(request, user as never);

      if (!result.success) {
        Alert.alert('Export Failed', result.error || 'Unknown error occurred');
        return;
      }

      if (result.isLarge && result.jobId) {
        const newJob: ExportJob = {
          id: result.jobId,
          type: request.type,
          requestedBy: user.name || 'Unknown',
          requestedAt: new Date(),
          status: 'queued',
          params: {
            format: request.format,
            groupBy: request.groupBy,
          },
          recordCount: result.recordCount,
        };
        setJobs((prev) => [newJob, ...prev]);
        setActiveTab('jobs');
        Alert.alert(
          'Export Job Created',
          'Your export is being processed. You can track it in the Jobs tab.'
        );
      } else if (result.fileUrl) {
        downloadFile(
          result.fileUrl,
          `export_${request.type}_${Date.now()}.${request.format}`
        );
        Alert.alert('Success', 'Export downloaded successfully');
      }
    } catch (error) {
      console.error('[Accounts] Export error:', error);
      Alert.alert('Error', 'Failed to process export request');
    }
  };

  const handleAssetPress = (assetId: string) => {
    console.log('[Accounts] Asset pressed:', assetId);
  };

  const handleWorkerPress = (workerId: string) => {
    console.log('[Accounts] Worker pressed:', workerId);
  };

  const handleDownloadJob = (jobId: string) => {
    console.log('[Accounts] Download job:', jobId);
    const job = jobs.find((j) => j.id === jobId);
    if (job?.fileUrl) {
      downloadFile(job.fileUrl, `export_${job.type}_${jobId}.csv`);
    }
  };

  const handleRetryJob = (jobId: string) => {
    console.log('[Accounts] Retry job:', jobId);
    setJobs((prev) =>
      prev.map((job) =>
        job.id === jobId ? { ...job, status: 'queued' as const } : job
      )
    );
  };

  const handleCancelJob = (jobId: string) => {
    console.log('[Accounts] Cancel job:', jobId);
    setJobs((prev) => prev.filter((job) => job.id !== jobId));
  };

  const handleRefreshJobs = () => {
    console.log('[Accounts] Refreshing jobs...');
    setLoadingJobs(true);
    setTimeout(() => setLoadingJobs(false), 500);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'assets' && styles.activeTab]}
          onPress={() => setActiveTab('assets')}
          testID="tab-assets-timesheets"
        >
          <FileText
            size={20}
            color={activeTab === 'assets' ? '#3b82f6' : '#64748b'}
            style={styles.tabIcon}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'assets' && styles.activeTabText,
            ]}
          >
            Plant Assets
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'progress' && styles.activeTab]}
          onPress={() => setActiveTab('progress')}
          testID="tab-progress-tracking"
        >
          <BarChart3
            size={20}
            color={activeTab === 'progress' ? '#3b82f6' : '#64748b'}
            style={styles.tabIcon}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'progress' && styles.activeTabText,
            ]}
          >
            Progress
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'jobs' && styles.activeTab]}
          onPress={() => setActiveTab('jobs')}
          testID="tab-export-jobs"
        >
          <List
            size={20}
            color={activeTab === 'jobs' ? '#3b82f6' : '#64748b'}
            style={styles.tabIcon}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'jobs' && styles.activeTabText,
            ]}
          >
            Jobs
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'assets' && (
        <PlantAssetsTimesheetsTab
          assets={[]}
          workers={[]}
          loading={false}
          filters={filters}
          onFiltersChange={setFilters}
          onAssetPress={handleAssetPress}
          onWorkerPress={handleWorkerPress}
          onExport={handleExport}
        />
      )}

      {activeTab === 'progress' && (
        <View style={styles.progressContainer}>
          {Platform.OS === 'web' && (
            <DashboardFilterSidebar
              onFilterChange={setFilterState}
              onViewChange={setViewType}
              onSectionChange={setDashboardSection}
              currentSection={dashboardSection}
              currentView={viewType}
              currentFilter={filterState}
              pvAreas={pvAreas}
              blockAreas={blockAreas}
              supervisors={supervisors}
            />
          )}
          <View style={styles.progressContent}>
            {loadingProgress ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4285F4" />
                <Text style={styles.loadingText}>Loading progress data...</Text>
              </View>
            ) : (
              <ProgressViewDashboard
                siteId={user?.siteId || ''}
                data={progressData}
                viewType={viewType}
                filter={filterState}
                pvAreas={pvAreas}
                blockAreas={blockAreas}
                supervisors={supervisors}
              />
            )}
          </View>
        </View>
      )}

      {activeTab === 'jobs' && (
        <ExportJobsList
          jobs={jobs}
          loading={loadingJobs}
          onDownload={handleDownloadJob}
          onRetry={handleRetryJob}
          onCancel={handleCancelJob}
          onRefresh={handleRefreshJobs}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  tabContainer: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 16,
    ...Platform.select({
      web: {
        flexDirection: 'row' as const,
      },
      default: {
        flexDirection: 'row' as const,
      },
    }),
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#3b82f6',
  },
  tabIcon: {
    marginRight: 6,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#64748b',
  },
  activeTabText: {
    color: '#3b82f6',
  },
  progressContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  progressContent: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#5f6368',
    fontWeight: '500' as const,
  },
});
