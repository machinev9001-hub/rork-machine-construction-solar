import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Filter, X } from 'lucide-react-native';

export type FilterValues = {
  companyId?: string;
  siteId?: string;
  fromDate?: Date;
  toDate?: Date;
  subcontractorId?: string;
  assetId?: string;
  workerId?: string;
  supervisorId?: string;
  search?: string;
};

type Props = {
  filters: FilterValues;
  onFiltersChange: (filters: FilterValues) => void;
  companies?: { id: string; name: string }[];
  sites?: { id: string; name: string }[];
  subcontractors?: { id: string; name: string }[];
  showAssetFilters?: boolean;
  showProgressFilters?: boolean;
};

export default function FiltersBar({
  filters,
  onFiltersChange,
  companies = [],
  sites = [],
  subcontractors = [],
  showAssetFilters = false,
  showProgressFilters = false,
}: Props) {
  const hasActiveFilters = Object.keys(filters).some(
    (key) => filters[key as keyof FilterValues] !== undefined
  );

  const clearFilters = () => {
    onFiltersChange({});
  };

  const handleSearchChange = (text: string) => {
    onFiltersChange({ ...filters, search: text });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Filter size={20} color="#1e293b" />
          <Text style={styles.title}>Filters</Text>
        </View>
        {hasActiveFilters && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={clearFilters}
            testID="clear-filters"
          >
            <X size={16} color="#ef4444" />
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersContent}
        style={styles.scrollView}
      >
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search..."
            value={filters.search || ''}
            onChangeText={handleSearchChange}
            placeholderTextColor="#94a3b8"
            testID="search-input"
          />
        </View>

        {companies.length > 0 && (
          <View style={styles.filterItem}>
            <Text style={styles.filterLabel}>Company</Text>
            <Text style={styles.filterValue}>
              {filters.companyId
                ? companies.find((c) => c.id === filters.companyId)?.name ||
                  'Select'
                : 'All'}
            </Text>
          </View>
        )}

        {sites.length > 0 && (
          <View style={styles.filterItem}>
            <Text style={styles.filterLabel}>Site</Text>
            <Text style={styles.filterValue}>
              {filters.siteId
                ? sites.find((s) => s.id === filters.siteId)?.name || 'Select'
                : 'All'}
            </Text>
          </View>
        )}

        <View style={styles.filterItem}>
          <Text style={styles.filterLabel}>Date Range</Text>
          <Text style={styles.filterValue}>
            {filters.fromDate && filters.toDate
              ? `${filters.fromDate.toLocaleDateString()} - ${filters.toDate.toLocaleDateString()}`
              : 'All Time'}
          </Text>
        </View>

        {showAssetFilters && (
          <>
            <View style={styles.filterItem}>
              <Text style={styles.filterLabel}>Asset</Text>
              <Text style={styles.filterValue}>
                {filters.assetId ? 'Selected' : 'All'}
              </Text>
            </View>

            {subcontractors.length > 0 && (
              <View style={styles.filterItem}>
                <Text style={styles.filterLabel}>Subcontractor</Text>
                <Text style={styles.filterValue}>
                  {filters.subcontractorId 
                    ? subcontractors.find(s => s.id === filters.subcontractorId)?.name || 'Selected'
                    : 'All'}
                </Text>
              </View>
            )}
          </>
        )}

        {showProgressFilters && (
          <View style={styles.filterItem}>
            <Text style={styles.filterLabel}>Supervisor</Text>
            <Text style={styles.filterValue}>
              {filters.supervisorId ? 'Selected' : 'All'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#fef2f2',
  },
  clearText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#ef4444',
  },
  scrollView: {
    flexGrow: 0,
  },
  filtersContent: {
    paddingHorizontal: 16,
    gap: 12,
    flexDirection: 'row',
  },
  searchContainer: {
    minWidth: 200,
    marginRight: 8,
  },
  searchInput: {
    height: 40,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#1e293b',
  },
  filterItem: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 120,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  filterValue: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#1e293b',
  },
});
