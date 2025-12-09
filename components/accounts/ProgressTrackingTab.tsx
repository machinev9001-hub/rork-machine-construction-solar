import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Activity, FileDown, ChevronRight, Target } from 'lucide-react-native';
import FiltersBar, { FilterValues } from './FiltersBar';
import ExportRequestModal, { ExportRequest, ExportType } from './ExportRequestModal';

type TaskActivity = {
  id: string;
  taskId: string;
  title: string;
  assignedTo?: string;
  plannedQty: number;
  actualQty: number;
  unit: string;
  percentComplete: number;
  qcScore?: number;
  status: string;
};

type Props = {
  activities: TaskActivity[];
  loading: boolean;
  filters: FilterValues;
  onFiltersChange: (filters: FilterValues) => void;
  onActivityPress: (activityId: string) => void;
  onExport: (request: ExportRequest) => Promise<void>;
};

export default function ProgressTrackingTab({
  activities,
  loading,
  filters,
  onFiltersChange,
  onActivityPress,
  onExport,
}: Props) {
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportType, setExportType] = useState<ExportType>('activityActuals');

  const handleExportActuals = () => {
    setExportType('activityActuals');
    setExportModalVisible(true);
  };

  const handleExportBOQ = () => {
    setExportType('boqComparison');
    setExportModalVisible(true);
  };

  const handleExportQC = () => {
    setExportType('qcInspections');
    setExportModalVisible(true);
  };

  const renderActivity = ({ item }: { item: TaskActivity }) => {
    const variance = item.actualQty - item.plannedQty;
    const variancePercent = item.plannedQty > 0
      ? ((variance / item.plannedQty) * 100).toFixed(1)
      : '0';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => onActivityPress(item.id)}
        testID={`activity-${item.id}`}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.cardIcon}>
              <Activity size={24} color="#8b5cf6" />
            </View>
            <View style={styles.cardHeaderInfo}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              {item.assignedTo && (
                <Text style={styles.cardSubtitle}>{item.assignedTo}</Text>
              )}
            </View>
          </View>
          <ChevronRight size={20} color="#cbd5e1" />
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(100, item.percentComplete)}%`,
                  backgroundColor: item.percentComplete >= 100 ? '#10b981' : '#3b82f6',
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>{item.percentComplete.toFixed(0)}%</Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Planned</Text>
            <Text style={styles.statValue}>
              {item.plannedQty.toLocaleString()} {item.unit}
            </Text>
          </View>

          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Actual</Text>
            <Text style={styles.statValue}>
              {item.actualQty.toLocaleString()} {item.unit}
            </Text>
          </View>

          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Variance</Text>
            <Text
              style={[
                styles.statValue,
                variance > 0 ? styles.variancePositive : variance < 0 ? styles.varianceNegative : {},
              ]}
            >
              {variance > 0 ? '+' : ''}{variance.toLocaleString()} ({variancePercent}%)
            </Text>
          </View>

          {item.qcScore !== undefined && (
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>QC Score</Text>
              <Text
                style={[
                  styles.statValue,
                  item.qcScore >= 80 ? styles.qcGood : item.qcScore >= 60 ? styles.qcMedium : styles.qcPoor,
                ]}
              >
                {item.qcScore}%
              </Text>
            </View>
          )}
        </View>

        <View
          style={[
            styles.statusBadge,
            item.status === 'complete' ? styles.statusComplete : styles.statusInProgress,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              item.status === 'complete' ? styles.statusCompleteText : styles.statusInProgressText,
            ]}
          >
            {item.status.toUpperCase()}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const filteredActivities = activities.filter((activity) => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        activity.title.toLowerCase().includes(searchLower) ||
        activity.assignedTo?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const totalPlanned = filteredActivities.reduce((sum, a) => sum + a.plannedQty, 0);
  const totalActual = filteredActivities.reduce((sum, a) => sum + a.actualQty, 0);
  const overallComplete = totalPlanned > 0 ? ((totalActual / totalPlanned) * 100).toFixed(1) : '0';

  return (
    <View style={styles.container}>
      <FiltersBar
        filters={filters}
        onFiltersChange={onFiltersChange}
        showProgressFilters
      />

      <View style={styles.summarySection}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryIconContainer}>
            <Target size={28} color="#3b82f6" />
          </View>
          <View style={styles.summaryContent}>
            <Text style={styles.summaryLabel}>Overall Progress</Text>
            <Text style={styles.summaryValue}>{overallComplete}%</Text>
            <Text style={styles.summaryMeta}>
              {totalActual.toLocaleString()} of {totalPlanned.toLocaleString()} completed
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.controls}>
        <Text style={styles.controlsTitle}>
          {filteredActivities.length} {filteredActivities.length === 1 ? 'Activity' : 'Activities'}
        </Text>

        <View style={styles.exportButtons}>
          <TouchableOpacity
            style={styles.exportButtonSmall}
            onPress={handleExportActuals}
            testID="export-actuals"
          >
            <FileDown size={16} color="#1e3a8a" />
            <Text style={styles.exportButtonSmallText}>Actuals</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.exportButtonSmall}
            onPress={handleExportBOQ}
            testID="export-boq"
          >
            <FileDown size={16} color="#1e3a8a" />
            <Text style={styles.exportButtonSmallText}>BOQ</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.exportButtonSmall}
            onPress={handleExportQC}
            testID="export-qc"
          >
            <FileDown size={16} color="#1e3a8a" />
            <Text style={styles.exportButtonSmallText}>QC</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8b5cf6" />
          <Text style={styles.loadingText}>Loading activities...</Text>
        </View>
      ) : filteredActivities.length === 0 ? (
        <View style={styles.emptyState}>
          <Activity size={48} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>No activities found</Text>
          <Text style={styles.emptyText}>
            {filters.search
              ? 'Try adjusting your search or filters'
              : 'No activities available'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredActivities}
          keyExtractor={(item) => item.id}
          renderItem={renderActivity}
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
  summarySection: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  summaryIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  summaryContent: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#1e40af',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#1e3a8a',
    marginBottom: 2,
  },
  summaryMeta: {
    fontSize: 13,
    color: '#3b82f6',
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
  controlsTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  exportButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  exportButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 6,
  },
  exportButtonSmallText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#1e3a8a',
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
    gap: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f5f3ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardHeaderInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1e293b',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1e293b',
    minWidth: 45,
    textAlign: 'right',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  variancePositive: {
    color: '#10b981',
  },
  varianceNegative: {
    color: '#ef4444',
  },
  qcGood: {
    color: '#10b981',
  },
  qcMedium: {
    color: '#f59e0b',
  },
  qcPoor: {
    color: '#ef4444',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusComplete: {
    backgroundColor: '#d1fae5',
  },
  statusInProgress: {
    backgroundColor: '#dbeafe',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  statusCompleteText: {
    color: '#065f46',
  },
  statusInProgressText: {
    color: '#1e40af',
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
