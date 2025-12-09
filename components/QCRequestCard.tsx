import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CheckCircle, XCircle, Clock, Calendar, ChevronDown, ChevronUp } from 'lucide-react-native';
import type { Timestamp } from 'firebase/firestore';

type QCRequestCardProps = {
  status: 'pending' | 'scheduled' | 'completed' | 'rejected';
  mainMenuName?: string;
  activityName?: string;
  subMenuName?: string;
  createdAt: Timestamp;
  scheduledAt?: Timestamp;
  isExpanded: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'scheduled': return '#3b82f6';
    case 'completed': return '#10b981';
    case 'rejected': return '#ef4444';
    default: return '#f59e0b';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'scheduled': return Calendar;
    case 'completed': return CheckCircle;
    case 'rejected': return XCircle;
    default: return Clock;
  }
};

const formatTimestamp = (timestamp?: Timestamp) => {
  if (!timestamp) return 'N/A';
  const date = timestamp.toDate();
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

export const QCRequestCard = React.memo<QCRequestCardProps>(({
  status,
  mainMenuName,
  activityName,
  subMenuName,
  createdAt,
  scheduledAt,
  isExpanded,
  onToggle,
  children,
}) => {
  const StatusIcon = useMemo(() => getStatusIcon(status), [status]);
  const statusColor = useMemo(() => getStatusColor(status), [status]);
  const formattedTime = useMemo(() => formatTimestamp(scheduledAt || createdAt), [scheduledAt, createdAt]);

  return (
    <View style={styles.card}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onToggle}
      >
        <View style={styles.header}>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
            <StatusIcon size={16} color={statusColor} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {status.toUpperCase()}
            </Text>
          </View>
          <View style={styles.timeContainer}>
            <Text style={styles.time}>{formattedTime}</Text>
            {isExpanded ? <ChevronUp size={20} color="#64748b" /> : <ChevronDown size={20} color="#64748b" />}
          </View>
        </View>

        <Text style={styles.title}>{mainMenuName || 'QC Inspection Request'}</Text>
        <Text style={styles.subtitle}>
          {activityName} • {subMenuName}
        </Text>
      </TouchableOpacity>

      {isExpanded && children}
    </View>
  );
});

QCRequestCard.displayName = 'QCRequestCard';

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  time: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
});
