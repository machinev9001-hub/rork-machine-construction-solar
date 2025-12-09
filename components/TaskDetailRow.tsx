import { View, Text, StyleSheet } from 'react-native';
import { memo } from 'react';

type TaskDetailRowProps = {
  items: {
    label: string;
    value: string;
  }[];
};

function TaskDetailRowComponent({ items }: TaskDetailRowProps) {
  return (
    <View style={styles.taskDetailsRow}>
      {items.map((item, index) => (
        <View key={index} style={styles.taskDetailItem}>
          <Text style={styles.taskDetailLabel}>{item.label}:</Text>
          <Text style={styles.taskDetailValue}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

export const TaskDetailRow = memo(TaskDetailRowComponent);

const styles = StyleSheet.create({
  taskDetailsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  taskDetailItem: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  taskDetailLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#64748b',
    textTransform: 'uppercase' as const,
    marginBottom: 2,
  },
  taskDetailValue: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#1e293b',
  },
});
