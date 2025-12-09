import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Clock } from 'lucide-react-native';
import { Timestamp } from 'firebase/firestore';

type TimestampValue = Timestamp | Date | string | number | null | undefined;

type TimestampFooterProps = {
  createdAt?: TimestampValue;
  createdBy?: string | null;
  updatedAt?: TimestampValue;
  updatedBy?: string | null;
  actionLabel?: string;
};

const formatTimestamp = (timestamp?: TimestampValue): string => {
  if (timestamp === null || timestamp === undefined) {
    return 'N/A';
  }

  try {
    let date: Date;

    if (timestamp instanceof Timestamp) {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'number' || typeof timestamp === 'string') {
      const parsed = new Date(timestamp);
      if (Number.isNaN(parsed.getTime())) {
        return 'N/A';
      }
      date = parsed;
    } else {
      return 'N/A';
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return 'N/A';
  }
};

export default function TimestampFooter({
  createdAt,
  createdBy,
  updatedAt,
  updatedBy,
  actionLabel = 'Processed',
}: TimestampFooterProps) {
  const hasUpdated = (updatedAt !== null && updatedAt !== undefined) && Boolean(updatedBy);

  return (
    <View style={styles.container}>
      <View style={styles.divider} />
      
      <View style={styles.timestampRow}>
        <View style={styles.timestampItem}>
          <Clock size={10} color="#94a3b8" />
          <Text style={styles.timestampLabel}>Created:</Text>
          <Text style={styles.timestampValue}>{formatTimestamp(createdAt)}</Text>
          {createdBy && <Text style={styles.timestampUser}>by {createdBy}</Text>}
        </View>
        
        {hasUpdated && (
          <View style={styles.timestampItem}>
            <Clock size={10} color="#94a3b8" />
            <Text style={styles.timestampLabel}>{actionLabel}:</Text>
            <Text style={styles.timestampValue}>{formatTimestamp(updatedAt)}</Text>
            {updatedBy && <Text style={styles.timestampUser}>by {updatedBy}</Text>}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginBottom: 8,
  },
  timestampRow: {
    flexDirection: 'column',
    gap: 6,
  },
  timestampItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  timestampLabel: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
  },
  timestampValue: {
    fontSize: 10,
    color: '#1e293b',
    fontWeight: '500' as const,
  },
  timestampUser: {
    fontSize: 9,
    color: '#94a3b8',
    fontStyle: 'italic' as const,
  },
});
