import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Truck, User, FileDown, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react-native';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import FiltersBar, { FilterValues } from './FiltersBar';
import ExportRequestModal, { ExportRequest, ExportType } from './ExportRequestModal';

type ViewMode = 'plant' | 'man';

type VerifiedTimesheet = {
  id: string;
  date: string;
  operatorName: string;
  operatorId: string;
  verified: boolean;
  verifiedAt: string;
  verifiedBy: string;
  masterAccountId: string;
  siteId: string;
  type: 'plant_hours' | 'man_hours';
  
  openHours?: number;
  closeHours?: number;
  totalHours?: number;
  isBreakdown?: boolean;
  inclementWeather?: boolean;
  hasAttachment?: boolean;
  
  assetId?: string;
  assetType?: string;
  plantNumber?: string;
  registrationNumber?: string;
  ownerId?: string;
  ownerType?: string;
  ownerName?: string;
  
  startTime?: string;
  stopTime?: string;
  totalManHours?: number;
  normalHours?: number;
  overtimeHours?: number;
  sundayHours?: number;
  publicHolidayHours?: number;
  noLunchBreak?: boolean;
  
  hasOriginalEntry?: boolean;
  originalEntryData?: any;
  isAdjustment?: boolean;
  originalEntryId?: string;
  adjustedBy?: string;
  adjustedAt?: string;
};

type TimesheetGroup = {
  key: string;
  title: string;
  subtitle: string;
  entries: VerifiedTimesheet[];
  originalEntry?: VerifiedTimesheet;
  adjustmentEntry?: VerifiedTimesheet;
};

type Props = {
  filters: FilterValues;
  onFiltersChange: (filters: FilterValues) => void;
  onExport: (request: ExportRequest) => Promise<void>;
};

export default function PlantAssetsTimesheetsTab({
  filters,
  onFiltersChange,
  onExport,
}: Props) {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('plant');
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportType, setExportType] = useState<ExportType>('plantHours');
  const [timesheets, setTimesheets] = useState<VerifiedTimesheet[]>([]);
  const [groups, setGroups] = useState<TimesheetGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadVerifiedTimesheets();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.siteId, user?.masterAccountId, viewMode, filters]);

  useEffect(() => {
    groupTimesheets();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timesheets]);

  const loadVerifiedTimesheets = async () => {
    if (!user?.siteId || !user?.masterAccountId) {
      console.log('[PlantAssetsTimesheetsTab] No siteId or masterAccountId');
      setLoading(false);
      return;
    }

    console.log('[PlantAssetsTimesheetsTab] ===== LOADING VERIFIED TIMESHEETS =====');
    console.log('[PlantAssetsTimesheetsTab] masterAccountId:', user.masterAccountId);
    console.log('[PlantAssetsTimesheetsTab] siteId:', user.siteId);
    console.log('[PlantAssetsTimesheetsTab] viewMode:', viewMode);
    console.log('[PlantAssetsTimesheetsTab] type filter:', viewMode === 'plant' ? 'plant_hours' : 'man_hours');
    setLoading(true);

    try {
      const timesheetsRef = collection(db, 'verifiedTimesheets');
      let q = query(
        timesheetsRef,
        where('masterAccountId', '==', user.masterAccountId),
        where('siteId', '==', user.siteId),
        where('type', '==', viewMode === 'plant' ? 'plant_hours' : 'man_hours'),
        orderBy('verifiedAt', 'desc')
      );

      console.log('[PlantAssetsTimesheetsTab] Executing query...');
      const snapshot = await getDocs(q);
      console.log('[PlantAssetsTimesheetsTab] Query returned', snapshot.docs.length, 'documents');
      
      const loadedTimesheets = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log('[PlantAssetsTimesheetsTab] Document:', doc.id, data);
        return {
          id: doc.id,
          ...data,
        } as VerifiedTimesheet;
      });

      console.log('[PlantAssetsTimesheetsTab] Loaded', loadedTimesheets.length, 'timesheets');
      console.log('[PlantAssetsTimesheetsTab] First timesheet sample:', loadedTimesheets[0]);
      setTimesheets(loadedTimesheets);
    } catch (error) {
      console.error('[PlantAssetsTimesheetsTab] ❌ Error loading timesheets:', error);
      console.error('[PlantAssetsTimesheetsTab] Error details:', JSON.stringify(error, null, 2));
      setTimesheets([]);
    } finally {
      setLoading(false);
    }
  };

  const groupTimesheets = () => {
    const groupMap = new Map<string, TimesheetGroup>();

    timesheets.forEach(timesheet => {
      let key: string;
      let title: string;
      let subtitle: string;

      if (viewMode === 'plant') {
        key = `${timesheet.assetId || timesheet.plantNumber}`;
        title = `${timesheet.assetType || 'Unknown Asset'}`;
        subtitle = timesheet.plantNumber || timesheet.registrationNumber || timesheet.assetId || 'N/A';
      } else {
        key = timesheet.operatorId || timesheet.operatorName;
        title = timesheet.operatorName;
        subtitle = `Operator ID: ${timesheet.operatorId || 'N/A'}`;
      }

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          key,
          title,
          subtitle,
          entries: [],
        });
      }

      const group = groupMap.get(key)!;
      group.entries.push(timesheet);

      if (timesheet.hasOriginalEntry && timesheet.originalEntryData) {
        group.originalEntry = timesheet.originalEntryData;
        group.adjustmentEntry = timesheet;
      }
    });

    setGroups(Array.from(groupMap.values()));
  };

  const toggleGroupExpansion = (key: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const handleExport = () => {
    setExportType(viewMode === 'plant' ? 'plantHours' : 'workerTimesheets');
    setExportModalVisible(true);
  };

  const renderTimesheetRow = (timesheet: VerifiedTimesheet, isAdjustment: boolean = false) => {
    if (viewMode === 'plant') {
      return (
        <View style={[styles.timesheetRow, isAdjustment && styles.adjustmentRow]}>
          <View style={styles.rowCell}>
            <Text style={styles.cellText}>{timesheet.date}</Text>
            {isAdjustment && <Text style={styles.adjBadge}>ADJ</Text>}
          </View>
          <Text style={[styles.rowCell, styles.cellText]}>{timesheet.operatorName}</Text>
          <Text style={[styles.rowCell, styles.cellText]}>{timesheet.openHours}</Text>
          <Text style={[styles.rowCell, styles.cellText]}>{timesheet.closeHours}</Text>
          <Text style={[styles.rowCell, styles.cellText, styles.boldText]}>
            {timesheet.totalHours?.toFixed(1)}h
          </Text>
          <Text style={[styles.rowCell, styles.cellText, styles.smallText]}>
            {new Date(timesheet.verifiedAt).toLocaleDateString()}
          </Text>
        </View>
      );
    } else {
      return (
        <View style={[styles.timesheetRow, isAdjustment && styles.adjustmentRow]}>
          <View style={styles.rowCell}>
            <Text style={styles.cellText}>{timesheet.date}</Text>
            {isAdjustment && <Text style={styles.adjBadge}>ADJ</Text>}
          </View>
          <Text style={[styles.rowCell, styles.cellText]}>{timesheet.startTime}</Text>
          <Text style={[styles.rowCell, styles.cellText]}>{timesheet.stopTime}</Text>
          <Text style={[styles.rowCell, styles.cellText, styles.boldText]}>
            {timesheet.totalManHours?.toFixed(1)}h
          </Text>
          <Text style={[styles.rowCell, styles.cellText]}>
            {timesheet.normalHours?.toFixed(1)}h
          </Text>
          <Text style={[styles.rowCell, styles.cellText]}>
            {timesheet.overtimeHours?.toFixed(1)}h
          </Text>
          <Text style={[styles.rowCell, styles.cellText, styles.smallText]}>
            {new Date(timesheet.verifiedAt).toLocaleDateString()}
          </Text>
        </View>
      );
    }
  };

  const renderGroup = ({ item }: { item: TimesheetGroup }) => {
    const isExpanded = expandedGroups.has(item.key);
    const hasAdjustments = item.entries.some(e => e.hasOriginalEntry);

    return (
      <View style={styles.groupCard}>
        <TouchableOpacity
          style={styles.groupHeader}
          onPress={() => toggleGroupExpansion(item.key)}
          activeOpacity={0.7}
        >
          <View style={styles.groupHeaderContent}>
            <Text style={styles.groupTitle}>{item.title}</Text>
            <Text style={styles.groupSubtitle}>{item.subtitle}</Text>
            <View style={styles.groupMeta}>
              <Text style={styles.groupMetaText}>
                {item.entries.length} entries
              </Text>
              {hasAdjustments && (
                <View style={styles.adjustmentIndicator}>
                  <AlertCircle size={14} color="#f59e0b" />
                  <Text style={styles.adjustmentText}>Has Adjustments</Text>
                </View>
              )}
            </View>
          </View>
          {isExpanded ? (
            <ChevronUp size={24} color="#64748b" />
          ) : (
            <ChevronDown size={24} color="#64748b" />
          )}
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.groupContent}>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                <View style={styles.tableHeader}>
                  <Text style={styles.headerCell}>Date</Text>
                  {viewMode === 'plant' ? (
                    <>
                      <Text style={styles.headerCell}>Operator</Text>
                      <Text style={styles.headerCell}>Open</Text>
                      <Text style={styles.headerCell}>Close</Text>
                      <Text style={styles.headerCell}>Total</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.headerCell}>Start</Text>
                      <Text style={styles.headerCell}>Stop</Text>
                      <Text style={styles.headerCell}>Total</Text>
                      <Text style={styles.headerCell}>Normal</Text>
                      <Text style={styles.headerCell}>Overtime</Text>
                    </>
                  )}
                  <Text style={styles.headerCell}>Verified</Text>
                </View>

                {item.entries.map((entry) => {
                  if (entry.hasOriginalEntry && entry.originalEntryData) {
                    return (
                      <View key={entry.id}>
                        {renderTimesheetRow(entry.originalEntryData as VerifiedTimesheet, false)}
                        {renderTimesheetRow(entry, true)}
                      </View>
                    );
                  }
                  return (
                    <View key={entry.id}>
                      {renderTimesheetRow(entry, false)}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FiltersBar
        filters={filters}
        onFiltersChange={onFiltersChange}
        showAssetFilters
      />

      <View style={styles.controls}>
        <View style={styles.viewModeToggle}>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'plant' && styles.toggleButtonActive]}
            onPress={() => setViewMode('plant')}
            testID="view-plant"
          >
            <Truck size={18} color={viewMode === 'plant' ? '#3b82f6' : '#64748b'} />
            <Text
              style={[
                styles.toggleButtonText,
                viewMode === 'plant' && styles.toggleButtonTextActive,
              ]}
            >
              Plant Hours ({groups.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'man' && styles.toggleButtonActive]}
            onPress={() => setViewMode('man')}
            testID="view-man"
          >
            <User size={18} color={viewMode === 'man' ? '#10b981' : '#64748b'} />
            <Text
              style={[
                styles.toggleButtonText,
                viewMode === 'man' && styles.toggleButtonTextActive,
              ]}
            >
              Man Hours ({groups.length})
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.exportButton}
          onPress={handleExport}
          testID="export-button"
        >
          <FileDown size={18} color="#ffffff" />
          <Text style={styles.exportButtonText}>Export</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading verified timesheets...</Text>
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.emptyState}>
          {viewMode === 'plant' ? (
            <Truck size={48} color="#cbd5e1" />
          ) : (
            <User size={48} color="#cbd5e1" />
          )}
          <Text style={styles.emptyTitle}>No verified timesheets found</Text>
          <Text style={styles.emptyText}>
            {viewMode === 'plant'
              ? 'No plant hours timesheets have been verified yet'
              : 'No man hours timesheets have been verified yet'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.key}
          renderItem={renderGroup}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <ExportRequestModal
        visible={exportModalVisible}
        onClose={() => setExportModalVisible(false)}
        onSubmit={onExport}
        exportType={exportType}
        prefilledFilters={filters}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  viewModeToggle: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  toggleButtonActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#64748b',
  },
  toggleButtonTextActive: {
    color: '#3b82f6',
    fontWeight: '600' as const,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#1e3a8a',
    borderRadius: 8,
    marginLeft: 12,
  },
  exportButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
  listContent: {
    padding: 16,
  },
  groupCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  groupHeaderContent: {
    flex: 1,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1e293b',
    marginBottom: 4,
  },
  groupSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  groupMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  groupMetaText: {
    fontSize: 12,
    color: '#64748b',
  },
  adjustmentIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  adjustmentText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#f59e0b',
  },
  groupContent: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    padding: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#e5e7eb',
  },
  headerCell: {
    width: 100,
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#475569',
    textTransform: 'uppercase' as const,
  },
  timesheetRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  adjustmentRow: {
    backgroundColor: '#fef3c7',
  },
  rowCell: {
    width: 100,
    justifyContent: 'center',
  },
  cellText: {
    fontSize: 13,
    color: '#475569',
  },
  boldText: {
    fontWeight: '700' as const,
    color: '#1e293b',
  },
  smallText: {
    fontSize: 11,
  },
  adjBadge: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: '#f59e0b',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#1e293b',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
});
