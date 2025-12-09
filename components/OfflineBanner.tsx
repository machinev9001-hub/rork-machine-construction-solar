import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Wifi, WifiOff, RefreshCw, AlertCircle, Clock, X, Zap, Database } from 'lucide-react-native';
import { useOfflineStatus } from '@/utils/hooks/useOfflineStatus';
import { offlineQueue } from '@/utils/offlineQueue';
import { useAuth } from '@/contexts/AuthContext';

console.log('[OfflineBanner] Module loaded');

interface OfflineBannerProps {
  showDetails?: boolean;
}

export default function OfflineBanner({ showDetails = false }: OfflineBannerProps) {
  console.log('[OfflineBanner] Component mounting/rendering');
  const { isLoading: authLoading } = useAuth();
  const status = useOfflineStatus();
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const insets = useSafeAreaInsets();
  const syncStartTimeRef = useRef<number | null>(null);
  const autoHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isIOS = Platform.OS === 'ios';
  const AUTO_HIDE_MS = isIOS ? 2000 : 4000;

  useEffect(() => {
    console.log('[OfflineBanner] syncStatus changed:', {
      isSyncing: status.syncStatus.isSyncing,
      pendingCount: status.syncStatus.pendingCount,
      failedCount: status.syncStatus.failedCount,
      isDismissed,
    });
    
    if (status.syncStatus.isSyncing) {
      if (!syncStartTimeRef.current) {
        syncStartTimeRef.current = Date.now();
        console.log('[OfflineBanner] Sync started, will auto-hide in', AUTO_HIDE_MS / 1000, 's if still syncing');
        
        autoHideTimeoutRef.current = setTimeout(() => {
          console.log('[OfflineBanner] Auto-hiding syncing banner (timeout reached)');
          setIsDismissed(true);
        }, AUTO_HIDE_MS);
      }
    } else {
      if (syncStartTimeRef.current) {
        console.log('[OfflineBanner] Sync completed');
        syncStartTimeRef.current = null;
      }
      if (autoHideTimeoutRef.current) {
        clearTimeout(autoHideTimeoutRef.current);
        autoHideTimeoutRef.current = null;
      }
      setIsDismissed(false);
    }

    return () => {
      if (autoHideTimeoutRef.current) {
        clearTimeout(autoHideTimeoutRef.current);
      }
    };
  }, [status.syncStatus.isSyncing, status.syncStatus.pendingCount, status.syncStatus.failedCount, isDismissed, AUTO_HIDE_MS]);

  if (status.isConnected && !status.hasPendingChanges && !status.hasFailedChanges) {
    if (!showDetails) return null;
    
    return (
      <View style={[styles.banner, styles.onlineBanner, { paddingTop: insets.top + 12 }]}>
        <View style={styles.bannerContent}>
          <Wifi size={16} color="#065f46" />
          <Text style={[styles.onlineText, { marginLeft: 8 }]}>Online</Text>
          <View style={[styles.dot, { marginLeft: 8 }]} />
          <Clock size={12} color="#047857" style={{ marginLeft: 8 }} />
          <Text style={[styles.syncTime, { marginLeft: 8 }]}>{status.lastSyncFormatted}</Text>
        </View>
      </View>
    );
  }

  if (status.isOffline) {
    return (
      <View style={[styles.banner, styles.offlineBanner, { paddingTop: insets.top + 12 }]}>
        <View style={styles.bannerContent}>
          <WifiOff size={16} color="#991b1b" />
          <Text style={[styles.offlineText, { marginLeft: 8 }]}>Offline Mode</Text>
          {status.hasPendingChanges && (
            <>
              <View style={[styles.dot, { marginLeft: 8 }]} />
              <Text style={[styles.pendingText, { marginLeft: 8 }]}>
                {status.syncStatus.pendingCount} pending
              </Text>
            </>
          )}
        </View>
        {showDetails && (
          <Text style={styles.detailText}>
            Changes will sync when connection is restored
          </Text>
        )}
      </View>
    );
  }

  if (status.syncStatus.isSyncing && !isDismissed && !authLoading) {
    return (
      <View style={styles.overlayContainer} pointerEvents="box-none">
        <View style={styles.centeredBanner}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={[styles.centeredText, { marginLeft: 12 }]}>Making changes...</Text>
          <TouchableOpacity 
            onPress={() => {
              console.log('[OfflineBanner] User dismissed syncing banner');
              setIsDismissed(true);
            }}
            accessibilityLabel="Dismiss syncing banner"
            style={styles.dismissButtonCentered}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.dismissText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (status.hasPendingChanges) {
    return (
      <>
        <View style={[styles.banner, styles.pendingBanner, { paddingTop: insets.top + 12 }]}>
          <View style={styles.bannerContent}>
            <RefreshCw size={16} color="#92400e" />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.pendingText}>
                {status.syncStatus.pendingCount} changes pending sync
              </Text>
              <View style={styles.priorityRow}>
                {status.syncStatus.p0Count > 0 && (
                  <View style={[styles.priorityBadge, { marginRight: 6 }]}>
                    <Text style={styles.p0Badge}>P0: {status.syncStatus.p0Count}</Text>
                  </View>
                )}
                {status.syncStatus.p2Count > 0 && (
                  <View style={[styles.priorityBadge, { marginRight: 6 }]}>
                    <Text style={styles.p2Badge}>P2: {status.syncStatus.p2Count}</Text>
                  </View>
                )}
                {status.syncStatus.p3Count > 0 && (
                  <View style={styles.priorityBadge}>
                    <Text style={styles.p3Badge}>P3: {status.syncStatus.p3Count}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setShowSyncModal(true)}
            style={styles.syncButton}
          >
            <Text style={styles.syncButtonText}>Sync Options</Text>
          </TouchableOpacity>
        </View>

        <Modal
          visible={showSyncModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSyncModal(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1}
            onPress={() => setShowSyncModal(false)}
          >
            <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Sync Options</Text>
                <TouchableOpacity onPress={() => setShowSyncModal(false)}>
                  <X size={24} color="#64748b" />
                </TouchableOpacity>
              </View>

              <View style={styles.priorityBreakdown}>
                <Text style={styles.breakdownTitle}>Queue Breakdown</Text>
                <View style={styles.breakdownRow}>
                  <View style={styles.breakdownItem}>
                    <View style={[styles.breakdownBadge, styles.p0Background]}>
                      <Text style={styles.breakdownCount}>{status.syncStatus.p0Count}</Text>
                    </View>
                    <Text style={[styles.breakdownLabel, { marginTop: 4 }]}>🔴 Critical</Text>
                    <Text style={[styles.breakdownDesc, { marginTop: 4 }]}>Task requests, approvals, allocations</Text>
                  </View>
                </View>
                <View style={styles.breakdownRow}>
                  <View style={styles.breakdownItem}>
                    <View style={[styles.breakdownBadge, styles.p2Background]}>
                      <Text style={styles.breakdownCount}>{status.syncStatus.p2Count}</Text>
                    </View>
                    <Text style={[styles.breakdownLabel, { marginTop: 4 }]}>🟡 Production</Text>
                    <Text style={[styles.breakdownDesc, { marginTop: 4 }]}>Completed Today, progress data</Text>
                  </View>
                </View>
                <View style={styles.breakdownRow}>
                  <View style={styles.breakdownItem}>
                    <View style={[styles.breakdownBadge, styles.p3Background]}>
                      <Text style={styles.breakdownCount}>{status.syncStatus.p3Count}</Text>
                    </View>
                    <Text style={[styles.breakdownLabel, { marginTop: 4 }]}>🟢 Heavy Data</Text>
                    <Text style={[styles.breakdownDesc, { marginTop: 4 }]}>Images, timesheets, billing data</Text>
                  </View>
                </View>
              </View>

              <View style={styles.syncActions}>
                <TouchableOpacity
                  style={[styles.syncActionButton, styles.criticalButton, { marginBottom: 12 }]}
                  onPress={() => {
                    offlineQueue.syncQueue('critical');
                    setShowSyncModal(false);
                  }}
                >
                  <Zap size={20} color="#fff" />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.syncActionTitle}>Sync Critical Only</Text>
                    <Text style={styles.syncActionDesc}>P0 items (unlocks work)</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.syncActionButton, styles.fullButton]}
                  onPress={() => {
                    offlineQueue.syncQueue('full');
                    setShowSyncModal(false);
                  }}
                >
                  <Database size={20} color="#fff" />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.syncActionTitle}>Sync Everything</Text>
                    <Text style={styles.syncActionDesc}>All priorities (use on good signal)</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      </>
    );
  }

  if (status.hasFailedChanges) {
    return (
      <View style={[styles.banner, styles.errorBanner, { paddingTop: insets.top + 12 }]}>
        <View style={styles.bannerContent}>
          <AlertCircle size={16} color="#991b1b" />
          <Text style={[styles.errorText, { marginLeft: 8 }]}>
            {status.syncStatus.failedCount} changes failed to sync
          </Text>
        </View>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            onPress={() => offlineQueue.retryFailedItems()}
            style={[styles.retryButton, { marginRight: 8 }]}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => offlineQueue.clearFailedItems()}
            style={styles.clearButton}
          >
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  onlineBanner: {
    backgroundColor: '#d1fae5',
    borderBottomColor: '#a7f3d0',
  },
  offlineBanner: {
    backgroundColor: '#fee2e2',
    borderBottomColor: '#fecaca',
  },
  syncingBanner: {
    backgroundColor: '#dbeafe',
    borderBottomColor: '#bfdbfe',
  },
  pendingBanner: {
    backgroundColor: '#fef3c7',
    borderBottomColor: '#fde68a',
  },
  errorBanner: {
    backgroundColor: '#fee2e2',
    borderBottomColor: '#fecaca',
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#065f46',
  },
  offlineText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#991b1b',
  },
  syncingText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1e40af',
  },
  pendingText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#92400e',
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#991b1b',
  },
  detailText: {
    fontSize: 12,
    color: '#7c2d12',
    marginTop: 4,
    marginLeft: 24,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#64748b',
  },
  syncTime: {
    fontSize: 12,
    color: '#047857',
  },
  syncButton: {
    marginTop: 8,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginLeft: 24,
  },
  syncButtonText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#fff',
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 8,
    marginLeft: 24,
  },
  retryButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryButtonText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#fff',
  },
  clearButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  clearButtonText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#991b1b',
  },
  priorityRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  p0Badge: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#dc2626',
  },
  p2Badge: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#d97706',
  },
  p3Badge: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#059669',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1e293b',
  },
  priorityBreakdown: {
    marginBottom: 20,
  },
  breakdownTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#64748b',
    marginBottom: 12,
  },
  breakdownRow: {
    marginBottom: 12,
  },
  breakdownItem: {
    flexDirection: 'column',
  },
  breakdownBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  p0Background: {
    backgroundColor: '#fee2e2',
  },
  p2Background: {
    backgroundColor: '#fef3c7',
  },
  p3Background: {
    backgroundColor: '#d1fae5',
  },
  breakdownCount: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1e293b',
  },
  breakdownLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  breakdownDesc: {
    fontSize: 12,
    color: '#64748b',
  },
  syncActions: {},
  syncActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  criticalButton: {
    backgroundColor: '#dc2626',
  },
  fullButton: {
    backgroundColor: '#2563eb',
  },
  syncActionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
  syncActionDesc: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  dismissButton: {
    marginLeft: 'auto' as const,
    padding: 4,
  },
  overlayContainer: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },
  centeredBanner: {
    backgroundColor: '#0b3b5f',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  centeredText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  dismissButtonCentered: {
    marginLeft: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  dismissText: {
    color: '#fff',
    fontSize: 14,
    textDecorationLine: 'underline' as const,
  },
});
