import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Truck, User, FileDown, ChevronRight } from 'lucide-react-native';
import FiltersBar, { FilterValues } from './FiltersBar';
import ExportRequestModal, { ExportRequest, ExportType } from './ExportRequestModal';

type ViewMode = 'assets' | 'workers';

type PlantAsset = {
  id: string;
  name: string;
  type: string;
  status: string;
  hoursMeter: number;
  assignedTo?: string;
  lastServiceDate?: Date;
};

type Worker = {
  id: string;
  name: string;
  role: string;
  totalHours: number;
  verifiedCount: number;
};

type Props = {
  assets: PlantAsset[];
  workers: Worker[];
  loading: boolean;
  filters: FilterValues;
  onFiltersChange: (filters: FilterValues) => void;
  onAssetPress: (assetId: string) => void;
  onWorkerPress: (workerId: string) => void;
  onExport: (request: ExportRequest) => Promise<void>;
};

export default function PlantAssetsTimesheetsTab({
  assets,
  workers,
  loading,
  filters,
  onFiltersChange,
  onAssetPress,
  onWorkerPress,
  onExport,
}: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('assets');
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportType, setExportType] = useState<ExportType>('plantHours');

  const handleExportAssets = () => {
    setExportType('plantHours');
    setExportModalVisible(true);
  };

  const handleExportWorkers = () => {
    setExportType('workerTimesheets');
    setExportModalVisible(true);
  };

  const renderAsset = ({ item }: { item: PlantAsset }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onAssetPress(item.id)}
      testID={`asset-${item.id}`}
    >
      <View style={styles.cardIcon}>
        <Truck size={24} color="#3b82f6" />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{item.name}</Text>
        <Text style={styles.cardSubtitle}>{item.type}</Text>
        <View style={styles.cardMeta}>
          <Text style={styles.metaText}>
            Hours: {item.hoursMeter.toLocaleString()}
          </Text>
          <Text style={[styles.statusBadge, getStatusStyle(item.status)]}>
            {item.status}
          </Text>
        </View>
      </View>
      <ChevronRight size={20} color="#cbd5e1" />
    </TouchableOpacity>
  );

  const renderWorker = ({ item }: { item: Worker }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onWorkerPress(item.id)}
      testID={`worker-${item.id}`}
    >
      <View style={styles.cardIcon}>
        <User size={24} color="#10b981" />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{item.name}</Text>
        <Text style={styles.cardSubtitle}>{item.role}</Text>
        <View style={styles.cardMeta}>
          <Text style={styles.metaText}>
            {item.totalHours}h logged
          </Text>
          <Text style={styles.metaText}>
            {item.verifiedCount} verified
          </Text>
        </View>
      </View>
      <ChevronRight size={20} color="#cbd5e1" />
    </TouchableOpacity>
  );

  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'in-use':
        return styles.statusActive;
      case 'available':
        return styles.statusAvailable;
      case 'maintenance':
        return styles.statusMaintenance;
      default:
        return styles.statusDefault;
    }
  };

  const filteredAssets = assets.filter((asset) => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        asset.name.toLowerCase().includes(searchLower) ||
        asset.type.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const filteredWorkers = workers.filter((worker) => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        worker.name.toLowerCase().includes(searchLower) ||
        worker.role.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

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
            style={[styles.toggleButton, viewMode === 'assets' && styles.toggleButtonActive]}
            onPress={() => setViewMode('assets')}
            testID="view-assets"
          >
            <Truck size={18} color={viewMode === 'assets' ? '#3b82f6' : '#64748b'} />
            <Text
              style={[
                styles.toggleButtonText,
                viewMode === 'assets' && styles.toggleButtonTextActive,
              ]}
            >
              Assets ({filteredAssets.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'workers' && styles.toggleButtonActive]}
            onPress={() => setViewMode('workers')}
            testID="view-workers"
          >
            <User size={18} color={viewMode === 'workers' ? '#10b981' : '#64748b'} />
            <Text
              style={[
                styles.toggleButtonText,
                viewMode === 'workers' && styles.toggleButtonTextActive,
              ]}
            >
              Workers ({filteredWorkers.length})
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.exportButton}
          onPress={viewMode === 'assets' ? handleExportAssets : handleExportWorkers}
          testID="export-button"
        >
          <FileDown size={18} color="#ffffff" />
          <Text style={styles.exportButtonText}>Export</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading data...</Text>
        </View>
      ) : viewMode === 'assets' ? (
        filteredAssets.length === 0 ? (
          <View style={styles.emptyState}>
            <Truck size={48} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No assets found</Text>
            <Text style={styles.emptyText}>
              {filters.search
                ? 'Try adjusting your search or filters'
                : 'No assets available'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredAssets}
            keyExtractor={(item) => item.id}
            renderItem={renderAsset}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )
      ) : (
        filteredWorkers.length === 0 ? (
          <View style={styles.emptyState}>
            <User size={48} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No workers found</Text>
            <Text style={styles.emptyText}>
              {filters.search
                ? 'Try adjusting your search or filters'
                : 'No workers available'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredWorkers}
            keyExtractor={(item) => item.id}
            renderItem={renderWorker}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )
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
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardContent: {
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
    marginBottom: 8,
  },
  cardMeta: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: '#64748b',
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: '600' as const,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusActive: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
  },
  statusAvailable: {
    backgroundColor: '#d1fae5',
    color: '#065f46',
  },
  statusMaintenance: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
  },
  statusDefault: {
    backgroundColor: '#f1f5f9',
    color: '#475569',
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
