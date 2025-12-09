import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { ChevronDown, ChevronUp, Trash2, RotateCcw } from 'lucide-react-native';
import { ReactNode, memo, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import * as Haptics from 'expo-haptics';

type RequestCardProps = {
  id: string;
  isExpanded: boolean;
  onToggle: () => void;
  statusBadge: ReactNode;
  timestamp: Timestamp | undefined;
  title: string;
  subtitle: string;
  children?: ReactNode;
  status?: string;
  onDelete?: () => void;
  onRestore?: () => void;
  archived?: boolean;
};

function RequestCardComponent({
  id,
  isExpanded,
  onToggle,
  statusBadge,
  timestamp,
  title,
  subtitle,
  children,
  status,
  onDelete,
  onRestore,
  archived,
}: RequestCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
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

  const handleRestore = () => {
    if (archived && onRestore) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert(
        'Restore Request',
        'Are you sure you want to restore this request? It will move back to the incoming tab.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Restore',
            style: 'default',
            onPress: () => {
              setIsRestoring(true);
              onRestore();
            },
          },
        ]
      );
    }
  };

  const handleLongPress = () => {
    if (status?.toUpperCase() === 'CANCELLED' && onDelete) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      Alert.alert(
        'Delete Request',
        'Are you sure you want to permanently delete this cancelled request?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              setIsDeleting(true);
              onDelete();
            },
          },
        ]
      );
    }
  };

  const isCancelled = status?.toUpperCase() === 'CANCELLED';
  const showDeleteOption = isCancelled && onDelete;
  const showRestoreOption = archived && onRestore;

  if (isDeleting) {
    return (
      <View style={[styles.requestCard, styles.deletingCard]}>
        <Text style={styles.deletingText}>Deleting...</Text>
      </View>
    );
  }

  if (isRestoring) {
    return (
      <View style={[styles.requestCard, styles.restoringCard]}>
        <Text style={styles.restoringText}>Restoring...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.requestCard, isCancelled && styles.cancelledCard, archived && styles.archivedCard]}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onToggle}
        onLongPress={handleLongPress}
        delayLongPress={600}
      >
        <View style={styles.requestHeader}>
          <View style={styles.headerLeft}>
            <View>{statusBadge}</View>
            {showDeleteOption && (
              <View style={styles.deleteHint}>
                <Trash2 size={12} color="#94a3b8" />
                <Text style={styles.deleteHintText}>Hold to delete</Text>
              </View>
            )}
            {showRestoreOption && (
              <TouchableOpacity
                style={styles.restoreButton}
                onPress={handleRestore}
                activeOpacity={0.7}
              >
                <RotateCcw size={14} color="#10b981" />
                <Text style={styles.restoreButtonText}>Restore</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.timeContainer}>
            <Text style={styles.requestTime}>{formatTimestamp(timestamp)}</Text>
            {isExpanded ? (
              <ChevronUp size={20} color="#64748b" />
            ) : (
              <ChevronDown size={20} color="#64748b" />
            )}
          </View>
        </View>

        <Text style={styles.requestTitle}>{title}</Text>
        <Text style={styles.compactInfo}>{subtitle}</Text>
      </TouchableOpacity>

      {isExpanded && <View style={styles.expandedContent}>{children}</View>}
    </View>
  );
}

export const RequestCard = memo(RequestCardComponent);

const styles = StyleSheet.create({
  requestCard: {
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
  cancelledCard: {
    opacity: 0.7,
    borderLeftWidth: 4,
    borderLeftColor: '#6b7280',
  },
  archivedCard: {
    opacity: 0.9,
    backgroundColor: '#f8fafc',
  },
  restoringCard: {
    backgroundColor: '#f0fdf4',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  restoringText: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600' as const,
  },
  deletingCard: {
    backgroundColor: '#fef2f2',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  deletingText: {
    fontSize: 14,
    color: '#991b1b',
    fontWeight: '600' as const,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
  },
  deleteHintText: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500' as const,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requestTime: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500' as const,
  },
  requestTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#1e293b',
    marginBottom: 4,
  },
  compactInfo: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  expandedContent: {
    marginTop: 12,
  },
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#d1fae5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  restoreButtonText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600' as const,
  },
});
