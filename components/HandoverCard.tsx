import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { X, User, TrendingUp } from 'lucide-react-native';
import { MatchingSupervisor } from '@/utils/handover';
import { sendRequestMessage } from '@/utils/messaging';
import { useAuth } from '@/contexts/AuthContext';

type HandoverCardProps = {
  visible: boolean;
  onClose: () => void;
  onSelectSupervisor: (supervisorId: string, taskId: string) => Promise<void>;
  matchingSupervisors: MatchingSupervisor[];
  isLoading: boolean;
  activityName: string;
  pvArea: string;
  blockNumber: string;
};

export default function HandoverCard({
  visible,
  onClose,
  onSelectSupervisor,
  matchingSupervisors,
  isLoading,
  activityName,
  pvArea,
  blockNumber,
}: HandoverCardProps) {
  const { user } = useAuth();
  const [selectedSupervisor, setSelectedSupervisor] = React.useState<string | null>(null);
  const [isSending, setIsSending] = React.useState<boolean>(false);

  const handleSend = async () => {
    if (!selectedSupervisor || !user?.userId || !user?.siteId) return;

    const supervisor = matchingSupervisors.find(
      (s) => s.supervisorId === selectedSupervisor
    );
    if (!supervisor) return;

    setIsSending(true);
    try {
      await sendRequestMessage({
        type: 'handover_request',
        status: 'pending',
        requestId: supervisor.taskId,
        fromUserId: user.userId,
        toUserId: supervisor.supervisorId,
        note: `Handover request for ${activityName} on PV ${pvArea} Block ${blockNumber}`,
        siteId: user.siteId,
        taskId: supervisor.taskId,
        activityId: supervisor.activityId,
        pvArea,
        blockNumber,
        activityName,
      });
      
      console.log('✅ Handover request sent successfully to:', supervisor.supervisorName);
      
      await onSelectSupervisor(supervisor.supervisorId, supervisor.taskId);
      setSelectedSupervisor(null);
      onClose();
    } catch (error) {
      console.error('Error sending handover request:', error);
    } finally {
      setIsSending(false);
    }
  };

  const formatTimestamp = (timestamp: any): string => {
    if (!timestamp) return 'N/A';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch {
      return 'N/A';
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.title}>Select Supervisor for Handover</Text>
              <Text style={styles.subtitle}>
                {activityName} • PV {pvArea} • Block {blockNumber}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              disabled={isSending}
            >
              <X size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4285F4" />
              <Text style={styles.loadingText}>Finding supervisors...</Text>
            </View>
          ) : matchingSupervisors.length === 0 ? (
            <View style={styles.emptyContainer}>
              <User size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No Matching Supervisors</Text>
              <Text style={styles.emptyText}>
                No other supervisors currently have tasks on this slice.
              </Text>
              <TouchableOpacity
                style={styles.okButton}
                onPress={onClose}
              >
                <Text style={styles.okButtonText}>OK</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.description}>
                Other Supervisors already have tasks on this PV AREA + BLOCK. Choose who
                you want to hand over to:
              </Text>

              <ScrollView style={styles.supervisorList} showsVerticalScrollIndicator={false}>
                {matchingSupervisors.map((supervisor) => {
                  const isSelected = selectedSupervisor === supervisor.supervisorId;
                  return (
                    <TouchableOpacity
                      key={supervisor.supervisorId}
                      style={[
                        styles.supervisorCard,
                        isSelected && styles.supervisorCardSelected,
                      ]}
                      onPress={() => setSelectedSupervisor(supervisor.supervisorId)}
                      activeOpacity={0.7}
                      disabled={isSending}
                    >
                      <View style={styles.supervisorHeader}>
                        <View style={styles.supervisorIcon}>
                          <User size={20} color="#4285F4" />
                        </View>
                        <View style={styles.supervisorInfo}>
                          <Text style={styles.supervisorName}>
                            {supervisor.supervisorName}
                          </Text>
                          <Text style={styles.supervisorId}>
                            ID: {supervisor.supervisorId}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.radioButton,
                            isSelected && styles.radioButtonSelected,
                          ]}
                        >
                          {isSelected && <View style={styles.radioButtonInner} />}
                        </View>
                      </View>

                      <View style={styles.supervisorStats}>
                        <View style={styles.statRow}>
                          <View style={styles.statIconContainer}>
                            <TrendingUp size={14} color="#059669" />
                          </View>
                          <Text style={styles.statLabel}>Completion:</Text>
                          <Text style={styles.statValue}>
                            {supervisor.completionPercentage.toFixed(2)}%
                          </Text>
                        </View>
                        <View style={styles.statRow}>
                          <Text style={styles.timestamp}>
                            Last updated {formatTimestamp(supervisor.lastUpdatedAt)}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={onClose}
                  disabled={isSending}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.sendButton,
                    (!selectedSupervisor || isSending) && styles.sendButtonDisabled,
                  ]}
                  onPress={handleSend}
                  disabled={!selectedSupervisor || isSending}
                  activeOpacity={0.7}
                >
                  {isSending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.sendButtonText}>Send Handover Request</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerLeft: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#0f172a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500' as const,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  description: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  supervisorList: {
    maxHeight: 340,
    paddingHorizontal: 20,
  },
  supervisorCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  supervisorCardSelected: {
    backgroundColor: '#eff6ff',
    borderColor: '#4285F4',
  },
  supervisorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  supervisorIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  supervisorInfo: {
    flex: 1,
  },
  supervisorName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#0f172a',
    marginBottom: 2,
  },
  supervisorId: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500' as const,
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: '#4285F4',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4285F4',
  },
  supervisorStats: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statIconContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500' as const,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#059669',
    marginLeft: 'auto',
  },
  timestamp: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500' as const,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f1f5f9',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#475569',
  },
  sendButton: {
    backgroundColor: '#4285F4',
  },
  sendButtonDisabled: {
    backgroundColor: '#cbd5e1',
  },
  sendButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#fff',
  },
  loadingContainer: {
    paddingVertical: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 12,
    fontWeight: '500' as const,
  },
  emptyContainer: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#0f172a',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  okButton: {
    backgroundColor: '#4285F4',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 10,
  },
  okButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
