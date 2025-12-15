import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import type { ActivityStatus } from '@/types';

type ActivityCardProps = {
  name: string;
  status: ActivityStatus;
  isExpanded: boolean;
  onToggle: () => void;
  scopeApproved: boolean;
  qcValue: number;
  scopeValue: number;
  scopeUnit: string;
  unit: string;
  hasHandoff: boolean;
  supervisorInputValue?: number;
  children?: React.ReactNode;
};

const getStatusColor = (status: ActivityStatus): string => {
  switch (status) {
    case 'LOCKED':
      return '#94a3b8';
    case 'OPEN':
      return '#f59e0b';
    case 'DONE':
      return '#10b981';
    case 'HANDOFF_SENT':
      return '#8b5cf6';
    default:
      return '#94a3b8';
  }
};

const getStatusBackground = (status: ActivityStatus): string => {
  switch (status) {
    case 'LOCKED':
      return '#f1f5f9';
    case 'OPEN':
      return '#fef3c7';
    case 'DONE':
      return '#d1fae5';
    case 'HANDOFF_SENT':
      return '#ede9fe';
    default:
      return '#f1f5f9';
  }
};

export const ActivityCard = React.memo<ActivityCardProps>(({
  name,
  status,
  isExpanded,
  onToggle,
  scopeApproved,
  qcValue,
  scopeValue,
  scopeUnit,
  unit,
  hasHandoff,
  supervisorInputValue,
  children,
}) => {
  const percentage = useMemo(() => {
    if (!scopeApproved || scopeValue === 0) return '—';
    return ((qcValue / scopeValue) * 100).toFixed(2);
  }, [qcValue, scopeValue, scopeApproved]);

  const unverifiedAmount = useMemo(() => {
    if (!scopeApproved) return 0;
    return Math.max(0, scopeValue - qcValue);
  }, [qcValue, scopeValue, scopeApproved]);

  const unverifiedPercentage = useMemo(() => {
    if (!scopeApproved || scopeValue === 0) return '—';
    return ((unverifiedAmount / scopeValue) * 100).toFixed(2);
  }, [unverifiedAmount, scopeValue, scopeApproved]);

  const showValues = !hasHandoff && (scopeApproved || qcValue > 0);

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.header}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <View style={styles.headerTopRow}>
            <Text style={styles.name}>{name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusBackground(status) }]}>
              <Text style={[styles.statusText, { color: getStatusColor(status) }]}>
                {status}
              </Text>
            </View>
          </View>
          {showValues && (
            <View style={styles.progressRow}>
              <View style={styles.progressItem}>
                <Text style={styles.progressLabel}>QC</Text>
                <Text style={styles.progressValue}>{percentage}%</Text>
              </View>
              <View style={styles.progressDivider} />
              <View style={styles.progressItem}>
                <Text style={styles.progressLabel}>Unverified</Text>
                <Text style={styles.progressValue}>{unverifiedAmount}{scopeUnit || unit}</Text>
              </View>
              <View style={styles.progressDivider} />
              <View style={styles.progressItem}>
                <Text style={styles.progressLabel}>Scope</Text>
                <Text style={styles.progressValue}>{scopeValue} {scopeUnit || unit}</Text>
              </View>
            </View>
          )}
        </View>
        {isExpanded ? (
          <ChevronUp size={20} color="#64748b" />
        ) : (
          <ChevronDown size={20} color="#64748b" />
        )}
      </TouchableOpacity>

      {children}
    </View>
  );
});

ActivityCard.displayName = 'ActivityCard';

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#e8eaed',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'column',
    gap: 10,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#202124',
    flexWrap: 'wrap',
    flexShrink: 1,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    padding: 8,
    gap: 8,
  },
  progressItem: {
    flex: 1,
    alignItems: 'center',
  },
  progressDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#e8eaed',
  },
  progressLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#5f6368',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  progressValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#202124',
  },
});
