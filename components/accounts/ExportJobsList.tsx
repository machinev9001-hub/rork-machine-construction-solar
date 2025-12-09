import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { FileDown, RefreshCw, X, Clock, CheckCircle, XCircle } from 'lucide-react-native';

export type ExportJobStatus = 'queued' | 'running' | 'complete' | 'failed';

export type ExportJob = {
  id: string;
  type: string;
  requestedBy: string;
  requestedAt: Date;
  status: ExportJobStatus;
  params: {
    format?: string;
    groupBy?: string;
    dateRange?: string;
  };
  fileUrl?: string;
  recordCount?: number;
  fileSize?: number;
  error?: string;
};

type Props = {
  jobs: ExportJob[];
  loading: boolean;
  onDownload: (jobId: string) => void;
  onRetry: (jobId: string) => void;
  onCancel: (jobId: string) => void;
  onRefresh: () => void;
};

export default function ExportJobsList({
  jobs,
  loading,
  onDownload,
  onRetry,
  onCancel,
  onRefresh,
}: Props) {
  const getStatusIcon = (status: ExportJobStatus) => {
    switch (status) {
      case 'queued':
        return <Clock size={20} color="#64748b" />;
      case 'running':
        return <ActivityIndicator size="small" color="#3b82f6" />;
      case 'complete':
        return <CheckCircle size={20} color="#10b981" />;
      case 'failed':
        return <XCircle size={20} color="#ef4444" />;
    }
  };

  const getStatusColor = (status: ExportJobStatus) => {
    switch (status) {
      case 'queued':
        return '#64748b';
      case 'running':
        return '#3b82f6';
      case 'complete':
        return '#10b981';
      case 'failed':
        return '#ef4444';
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderJob = ({ item }: { item: ExportJob }) => (
    <View style={styles.jobCard} testID={`job-${item.id}`}>
      <View style={styles.jobHeader}>
        <View style={styles.jobHeaderLeft}>
          {getStatusIcon(item.status)}
          <View style={styles.jobInfo}>
            <Text style={styles.jobType}>{item.type}</Text>
            <Text style={styles.jobMeta}>
              {item.requestedAt.toLocaleString()}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: `${getStatusColor(item.status)}15` },
          ]}
        >
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.jobDetails}>
        {item.params.format && (
          <Text style={styles.detail}>Format: {item.params.format.toUpperCase()}</Text>
        )}
        {item.params.groupBy && item.params.groupBy !== 'none' && (
          <Text style={styles.detail}>Grouped by: {item.params.groupBy}</Text>
        )}
        {item.params.dateRange && (
          <Text style={styles.detail}>{item.params.dateRange}</Text>
        )}
        {item.recordCount !== undefined && (
          <Text style={styles.detail}>Records: {item.recordCount.toLocaleString()}</Text>
        )}
        {item.fileSize !== undefined && (
          <Text style={styles.detail}>Size: {formatFileSize(item.fileSize)}</Text>
        )}
      </View>

      {item.error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{item.error}</Text>
        </View>
      )}

      <View style={styles.actions}>
        {item.status === 'complete' && item.fileUrl && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onDownload(item.id)}
            testID={`download-${item.id}`}
          >
            <FileDown size={18} color="#3b82f6" />
            <Text style={styles.actionButtonText}>Download</Text>
          </TouchableOpacity>
        )}

        {item.status === 'failed' && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onRetry(item.id)}
            testID={`retry-${item.id}`}
          >
            <RefreshCw size={18} color="#f59e0b" />
            <Text style={styles.actionButtonText}>Retry</Text>
          </TouchableOpacity>
        )}

        {item.status === 'queued' && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onCancel(item.id)}
            testID={`cancel-${item.id}`}
          >
            <X size={18} color="#ef4444" />
            <Text style={styles.actionButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Export Jobs</Text>
        <TouchableOpacity
          onPress={onRefresh}
          style={styles.refreshButton}
          disabled={loading}
          testID="refresh-jobs"
        >
          {loading ? (
            <ActivityIndicator size="small" color="#3b82f6" />
          ) : (
            <RefreshCw size={20} color="#3b82f6" />
          )}
        </TouchableOpacity>
      </View>

      {jobs.length === 0 ? (
        <View style={styles.emptyState}>
          <FileDown size={48} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>No export jobs yet</Text>
          <Text style={styles.emptyText}>
            Create an export to see it tracked here
          </Text>
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          renderItem={renderJob}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1e293b',
  },
  refreshButton: {
    padding: 8,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  jobCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  jobHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  jobHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  jobInfo: {
    flex: 1,
  },
  jobType: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1e293b',
    marginBottom: 2,
  },
  jobMeta: {
    fontSize: 12,
    color: '#64748b',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  jobDetails: {
    gap: 4,
    marginBottom: 12,
  },
  detail: {
    fontSize: 13,
    color: '#64748b',
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 6,
    padding: 8,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
    color: '#dc2626',
    lineHeight: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#1e293b',
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
