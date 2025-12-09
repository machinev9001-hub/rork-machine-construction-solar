import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  ScrollView, 
  Alert,
  ActivityIndicator,
  RefreshControl 
} from 'react-native';
import { 
  RefreshCw, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Wifi,
  Database,
  HardDrive,
  Clock
} from 'lucide-react-native';
import { 
  collectDebugInfo, 
  clearAsyncStorageCache,
  forceOfflineSync,
  retryFailedQueueItems,
  clearFailedQueueItems,
  formatBytes,
  formatTimestamp,
  type DebugInfo
} from '@/utils/debugHelpers';

export default function DebugInfoScreen() {
  const router = useRouter();
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadDebugInfo = async () => {
    setIsLoading(true);
    try {
      const info = await collectDebugInfo();
      setDebugInfo(info);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to collect debug info: ' + error.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadDebugInfo();
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will clear all cached site packs, user data, and surveyor images. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              const count = await clearAsyncStorageCache();
              Alert.alert('Success', `Cleared ${count} cache entries`);
              await loadDebugInfo();
            } catch (error: any) {
              Alert.alert('Error', 'Failed to clear cache: ' + error.message);
            }
          },
        },
      ]
    );
  };

  const handleForceSync = async () => {
    try {
      await forceOfflineSync();
      Alert.alert('Success', 'Force sync completed');
      await loadDebugInfo();
    } catch (error: any) {
      Alert.alert('Error', 'Force sync failed: ' + error.message);
    }
  };

  const handleRetryFailed = async () => {
    try {
      await retryFailedQueueItems();
      Alert.alert('Success', 'Retrying failed items');
      await loadDebugInfo();
    } catch (error: any) {
      Alert.alert('Error', 'Retry failed: ' + error.message);
    }
  };

  const handleClearFailed = () => {
    Alert.alert(
      'Clear Failed Items',
      'This will permanently remove all failed queue items. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearFailedQueueItems();
              Alert.alert('Success', 'Cleared failed items');
              await loadDebugInfo();
            } catch (error: any) {
              Alert.alert('Error', 'Failed to clear: ' + error.message);
            }
          },
        },
      ]
    );
  };

  if (!debugInfo && !isLoading) {
    loadDebugInfo();
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: 'Debug Info',
        }}
      />
      
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {isLoading && !debugInfo ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Collecting debug info...</Text>
          </View>
        ) : debugInfo ? (
          <>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Wifi size={20} color="#3b82f6" />
                <Text style={styles.sectionTitle}>Network</Text>
              </View>
              <View style={styles.card}>
                <InfoRow 
                  label="Connected" 
                  value={debugInfo.network.isConnected ? 'Yes' : 'No'}
                  status={debugInfo.network.isConnected ? 'success' : 'error'}
                />
                <Divider />
                <InfoRow label="Type" value={debugInfo.network.type || 'Unknown'} />
                <Divider />
                <InfoRow 
                  label="Internet Reachable" 
                  value={
                    debugInfo.network.isInternetReachable === null 
                      ? 'Unknown' 
                      : debugInfo.network.isInternetReachable ? 'Yes' : 'No'
                  }
                />
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Database size={20} color="#3b82f6" />
                <Text style={styles.sectionTitle}>Firebase</Text>
              </View>
              <View style={styles.card}>
                <InfoRow 
                  label="Configured" 
                  value={debugInfo.firebase.isConfigured ? 'Yes' : 'No'}
                  status={debugInfo.firebase.isConfigured ? 'success' : 'error'}
                />
                <Divider />
                <InfoRow 
                  label="Authenticated" 
                  value={debugInfo.firebase.isAuthenticated ? 'Yes' : 'No'}
                  status={debugInfo.firebase.isAuthenticated ? 'success' : 'warning'}
                />
                <Divider />
                <InfoRow 
                  label="Can Connect" 
                  value={debugInfo.firebase.canConnect ? 'Yes' : 'No'}
                  status={debugInfo.firebase.canConnect ? 'success' : 'error'}
                />
                {debugInfo.firebase.currentUser && (
                  <>
                    <Divider />
                    <InfoRow 
                      label="User ID" 
                      value={debugInfo.firebase.currentUser.substring(0, 8) + '...'}
                    />
                  </>
                )}
                {debugInfo.firebase.connectionError && (
                  <>
                    <Divider />
                    <InfoRow 
                      label="Error" 
                      value={debugInfo.firebase.connectionError}
                      status="error"
                    />
                  </>
                )}
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <HardDrive size={20} color="#3b82f6" />
                <Text style={styles.sectionTitle}>AsyncStorage</Text>
              </View>
              <View style={styles.card}>
                <InfoRow 
                  label="Accessible" 
                  value={debugInfo.asyncStorage.isAccessible ? 'Yes' : 'No'}
                  status={debugInfo.asyncStorage.isAccessible ? 'success' : 'error'}
                />
                <Divider />
                <InfoRow 
                  label="Keys" 
                  value={debugInfo.asyncStorage.keys.length.toString()}
                />
                <Divider />
                <InfoRow 
                  label="Total Size" 
                  value={formatBytes(debugInfo.asyncStorage.totalSize)}
                />
                {debugInfo.asyncStorage.error && (
                  <>
                    <Divider />
                    <InfoRow 
                      label="Error" 
                      value={debugInfo.asyncStorage.error}
                      status="error"
                    />
                  </>
                )}
              </View>
              
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={handleClearCache}
              >
                <Trash2 size={20} color="#ef4444" />
                <Text style={styles.actionButtonText}>Clear Cache</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Clock size={20} color="#3b82f6" />
                <Text style={styles.sectionTitle}>Offline Queue</Text>
              </View>
              <View style={styles.card}>
                <InfoRow 
                  label="Enabled" 
                  value={debugInfo.offlineQueue.isEnabled ? 'Yes' : 'No'}
                  status={debugInfo.offlineQueue.isEnabled ? 'success' : 'warning'}
                />
                <Divider />
                <InfoRow 
                  label="Syncing" 
                  value={debugInfo.offlineQueue.isSyncing ? 'Yes' : 'No'}
                />
                <Divider />
                <InfoRow 
                  label="Last Sync" 
                  value={formatTimestamp(debugInfo.offlineQueue.lastSyncTime)}
                />
                <Divider />
                <InfoRow 
                  label="Pending (P0)" 
                  value={debugInfo.offlineQueue.p0Count.toString()}
                  status={debugInfo.offlineQueue.p0Count > 0 ? 'warning' : 'success'}
                />
                <Divider />
                <InfoRow 
                  label="Pending (P1)" 
                  value={debugInfo.offlineQueue.p1Count.toString()}
                />
                <Divider />
                <InfoRow 
                  label="Pending (P2)" 
                  value={debugInfo.offlineQueue.p2Count.toString()}
                />
                <Divider />
                <InfoRow 
                  label="Pending (P3)" 
                  value={debugInfo.offlineQueue.p3Count.toString()}
                />
                <Divider />
                <InfoRow 
                  label="Failed" 
                  value={debugInfo.offlineQueue.failedCount.toString()}
                  status={debugInfo.offlineQueue.failedCount > 0 ? 'error' : 'success'}
                />
              </View>

              {debugInfo.offlineQueue.queueItems.length > 0 && (
                <View style={styles.queueItems}>
                  <Text style={styles.queueItemsTitle}>Queue Items:</Text>
                  {debugInfo.offlineQueue.queueItems.slice(0, 10).map((item, index) => (
                    <View key={item.id} style={styles.queueItem}>
                      <View style={styles.queueItemHeader}>
                        <Text style={styles.queueItemPriority}>{item.priority}</Text>
                        <Text style={styles.queueItemType}>{item.entityType}</Text>
                        <Text style={styles.queueItemRetry}>
                          Retry: {item.retryCount}
                        </Text>
                      </View>
                      <Text style={styles.queueItemDetails}>
                        {item.type} • {formatTimestamp(item.timestamp)}
                      </Text>
                      {item.lastError && (
                        <Text style={styles.queueItemError}>{item.lastError}</Text>
                      )}
                    </View>
                  ))}
                  {debugInfo.offlineQueue.queueItems.length > 10 && (
                    <Text style={styles.queueItemsMore}>
                      And {debugInfo.offlineQueue.queueItems.length - 10} more...
                    </Text>
                  )}
                </View>
              )}

              <View style={styles.actionButtons}>
                <TouchableOpacity 
                  style={[styles.actionButton, styles.actionButtonSecondary]}
                  onPress={handleForceSync}
                  disabled={debugInfo.offlineQueue.isSyncing}
                >
                  <RefreshCw size={20} color="#3b82f6" />
                  <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
                    Force Sync
                  </Text>
                </TouchableOpacity>

                {debugInfo.offlineQueue.failedCount > 0 && (
                  <>
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.actionButtonSecondary]}
                      onPress={handleRetryFailed}
                    >
                      <RefreshCw size={20} color="#f59e0b" />
                      <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
                        Retry Failed
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={handleClearFailed}
                    >
                      <Trash2 size={20} color="#ef4444" />
                      <Text style={styles.actionButtonText}>Clear Failed</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Collected at {new Date(debugInfo.timestamp).toLocaleTimeString()}
              </Text>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function InfoRow({ 
  label, 
  value, 
  status 
}: { 
  label: string; 
  value: string; 
  status?: 'success' | 'warning' | 'error' 
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueContainer}>
        {status && (
          <>
            {status === 'success' && <CheckCircle size={16} color="#10b981" />}
            {status === 'warning' && <AlertCircle size={16} color="#f59e0b" />}
            {status === 'error' && <XCircle size={16} color="#ef4444" />}
          </>
        )}
        <Text style={[styles.value, status && styles[`value_${status}`]]}>{value}</Text>
      </View>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginLeft: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#475569',
    marginLeft: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  label: {
    fontSize: 14,
    color: '#64748b',
    flex: 1,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  value: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#1e293b',
  },
  value_success: {
    color: '#10b981',
  },
  value_warning: {
    color: '#f59e0b',
  },
  value_error: {
    color: '#ef4444',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },
  queueItems: {
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  queueItemsTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#475569',
    marginBottom: 12,
  },
  queueItem: {
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    marginBottom: 8,
  },
  queueItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  queueItemPriority: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#3b82f6',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  queueItemType: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: '#64748b',
  },
  queueItemRetry: {
    fontSize: 12,
    color: '#94a3b8',
    marginLeft: 'auto',
  },
  queueItemDetails: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  queueItemError: {
    fontSize: 11,
    color: '#ef4444',
    marginTop: 4,
  },
  queueItemsMore: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
  },
  actionButtons: {
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fee2e2',
    padding: 14,
    borderRadius: 10,
    gap: 8,
    marginTop: 12,
  },
  actionButtonSecondary: {
    backgroundColor: '#eff6ff',
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#ef4444',
  },
  actionButtonTextSecondary: {
    color: '#3b82f6',
  },
  footer: {
    padding: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#94a3b8',
  },
});
