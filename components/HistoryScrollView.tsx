import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';

type DayHistory = {
  date: string;
  completedValue: number;
  unit: string;
  percentage: string;
  scopeValue: number;
  scopeApproved: boolean;
  qcStatus?: string;
  materialToggle?: boolean;
  plantToggle?: boolean;
  workersToggle?: boolean;
};

type HistoryScrollViewProps = {
  history: DayHistory[];
};

export const HistoryScrollView = React.memo<HistoryScrollViewProps>(({ history }) => {
  if (!history || history.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Last 7 Days</Text>
      <FlatList
        horizontal
        data={history}
        keyExtractor={(item) => item.date}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.date}>
              {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Text>
            <View style={styles.valueRow}>
              <Text style={styles.label}>Completed:</Text>
              <Text style={styles.value}>{item.completedValue} {item.unit}</Text>
            </View>
            <View style={styles.valueRow}>
              <Text style={styles.label}>% Done:</Text>
              <Text style={styles.percentage}>{item.percentage}%</Text>
            </View>
            {(item.qcStatus || item.materialToggle !== undefined || item.plantToggle !== undefined || item.workersToggle !== undefined) && (
              <View style={styles.togglesSection}>
                <Text style={styles.togglesTitle}>Status:</Text>
                {item.qcStatus && (
                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>QC: {item.qcStatus === 'completed' ? '✅' : '⏳'}</Text>
                  </View>
                )}
                {item.materialToggle !== undefined && (
                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>Material: {item.materialToggle ? '✅' : '❌'}</Text>
                  </View>
                )}
                {item.plantToggle !== undefined && (
                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>Plant: {item.plantToggle ? '✅' : '❌'}</Text>
                  </View>
                )}
                {item.workersToggle !== undefined && (
                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>Workers: {item.workersToggle ? '✅' : '❌'}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
        contentContainerStyle={styles.scrollContent}
      />
    </View>
  );
});

HistoryScrollView.displayName = 'HistoryScrollView';

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#202124',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  scrollContent: {
    paddingRight: 16,
  },
  card: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginRight: 12,
    minWidth: 160,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  date: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4285F4',
    marginBottom: 8,
    textAlign: 'center',
  },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
  },
  value: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
  },
  percentage: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  togglesSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  togglesTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
  },
  toggleRow: {
    marginBottom: 2,
  },
  toggleLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#475569',
  },
});
