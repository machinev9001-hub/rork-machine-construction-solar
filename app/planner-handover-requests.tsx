import { Stack, useRouter } from 'expo-router';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  ScrollView,
} from 'react-native';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  X,
  Calendar,
  User,
  MapPin,
  Package,
  ChevronRight,
  CheckCircle,
  XCircle,
} from 'lucide-react-native';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  updateDoc,
  doc,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { HandoverRequest } from '@/types';

type SupervisorOption = {
  id: string;
  userId: string;
  name: string;
};

export default function PlannerHandoverRequestsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [handoverRequests, setHandoverRequests] = useState<HandoverRequest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const [assignModalVisible, setAssignModalVisible] = useState<boolean>(false);
  const [selectedRequest, setSelectedRequest] = useState<HandoverRequest | null>(null);
  const [supervisors, setSupervisors] = useState<SupervisorOption[]>([]);
  const [selectedSupervisor, setSelectedSupervisor] = useState<string | null>(null);
  const [plannerNote, setPlannerNote] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState<boolean>(false);

  useEffect(() => {
    loadHandoverRequests();
  }, []);

  const loadHandoverRequests = async () => {
    if (!user?.siteId) return;

    try {
      setIsLoading(true);
      const requestsRef = collection(db, 'requests');
      const q = query(
        requestsRef,
        where('type', '==', 'HANDOVER_REQUEST'),
        where('siteId', '==', user.siteId),
        where('handoverMode', '==', 'PLANNER_APPOINTMENT'),
        where('status', '==', 'PENDING'),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const requests: HandoverRequest[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        requests.push({
          id: docSnap.id,
          ...data,
        } as HandoverRequest);
      });

      console.log('📋 [PlannerHandoverRequests] Loaded', requests.length, 'handover requests');
      setHandoverRequests(requests);
    } catch (error) {
      console.error('❌ Error loading handover requests:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadHandoverRequests();
    setIsRefreshing(false);
  };

  const loadSupervisors = async () => {
    if (!user?.siteId) return;

    try {
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        where('siteId', '==', user.siteId),
        where('role', '==', 'Supervisor')
      );

      const snapshot = await getDocs(q);
      const loadedSupervisors: SupervisorOption[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        loadedSupervisors.push({
          id: docSnap.id,
          userId: data.userId,
          name: data.name || data.userId,
        });
      });

      console.log('👥 Loaded', loadedSupervisors.length, 'supervisors for site');
      setSupervisors(loadedSupervisors);
    } catch (error) {
      console.error('❌ Error loading supervisors:', error);
    }
  };

  const handleOpenAssignModal = async (request: HandoverRequest) => {
    setSelectedRequest(request);
    setAssignModalVisible(true);
    await loadSupervisors();
  };

  const handleCloseAssignModal = () => {
    setAssignModalVisible(false);
    setSelectedRequest(null);
    setSelectedSupervisor(null);
    setPlannerNote('');
  };

  const handleAssignSupervisor = async () => {
    if (!selectedRequest || !selectedSupervisor || !user?.userId) {
      Alert.alert('Error', 'Please select a supervisor');
      return;
    }

    setIsAssigning(true);
    try {
      console.log('👤 [Planner] Assigning supervisor:', selectedSupervisor, 'to handover:', selectedRequest.id);

      const selectedSupervisorData = supervisors.find((s) => s.userId === selectedSupervisor);
      if (!selectedSupervisorData) {
        throw new Error('Selected supervisor not found');
      }

      const tasksRef = collection(db, 'tasks');
      const newTaskRef = await addDoc(tasksRef, {
        activity: selectedRequest.subMenuKey.split('-')[0],
        subActivity: selectedRequest.subMenuKey,
        supervisorId: selectedSupervisor,
        siteId: user.siteId,
        masterAccountId: selectedRequest.masterAccountId || user.masterAccountId,
        status: 'OPEN',
        taskAccessRequested: false,
        pvArea: selectedRequest.pvArea,
        blockArea: selectedRequest.blockNumber,
        rowNr: selectedRequest.rowNr || '',
        columnNr: selectedRequest.columnNr || '',
        location: '',
        notes: plannerNote || `Task created via handover request from ${selectedRequest.fromSupervisorId}`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user.userId,
        createdVia: 'PLANNER_HANDOVER',
      });

      console.log('✅ New task created:', newTaskRef.id);

      const requestsRef = collection(db, 'requests');
      await updateDoc(doc(requestsRef, selectedRequest.id!), {
        status: 'RESOLVED_BY_PLANNER',
        appointedSupervisorId: selectedSupervisor,
        noteFromPlanner: plannerNote,
        resolvedAt: serverTimestamp(),
        resolvedBy: user.userId,
        updatedAt: serverTimestamp(),
      });

      console.log('✅ Handover request resolved');

      Alert.alert(
        'Success',
        `Task assigned to ${selectedSupervisorData.name} successfully`,
        [{ text: 'OK', onPress: handleCloseAssignModal }]
      );

      await loadHandoverRequests();
    } catch (error) {
      console.error('❌ Error assigning supervisor:', error);
      Alert.alert('Error', 'Failed to assign supervisor');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRejectHandover = async (request: HandoverRequest) => {
    Alert.alert(
      'Reject Handover Request',
      'Are you sure you want to reject this handover request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              const requestsRef = collection(db, 'requests');
              await updateDoc(doc(requestsRef, request.id!), {
                status: 'REJECTED',
                rejectedAt: serverTimestamp(),
                rejectedBy: user?.userId,
                updatedAt: serverTimestamp(),
              });

              console.log('❌ Handover request rejected');
              await loadHandoverRequests();
            } catch (error) {
              console.error('❌ Error rejecting handover:', error);
              Alert.alert('Error', 'Failed to reject handover request');
            }
          },
        },
      ]
    );
  };

  const formatTimestamp = (timestamp: any): string => {
    if (!timestamp) return 'N/A';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'N/A';
    }
  };

  const renderHandoverCard = ({ item }: { item: HandoverRequest }) => {
    return (
      <View style={styles.requestCard}>
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <Text style={styles.activityName}>{item.activityName}</Text>
            <Text style={styles.subActivityName}>{item.subMenuName}</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>PENDING</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <User size={16} color="#64748b" />
            <Text style={styles.infoLabel}>From Supervisor:</Text>
            <Text style={styles.infoValue}>{item.fromSupervisorId}</Text>
          </View>

          <View style={styles.infoRow}>
            <MapPin size={16} color="#64748b" />
            <Text style={styles.infoLabel}>Location:</Text>
            <Text style={styles.infoValue}>
              PV {item.pvArea} • Block {item.blockNumber}
              {item.rowNr ? ` • Row ${item.rowNr}` : ''}
              {item.columnNr ? ` • Column ${item.columnNr}` : ''}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Calendar size={16} color="#64748b" />
            <Text style={styles.infoLabel}>Requested:</Text>
            <Text style={styles.infoValue}>{formatTimestamp(item.createdAt)}</Text>
          </View>

          {item.noteFromSender && (
            <View style={styles.noteSection}>
              <Text style={styles.noteLabel}>Note from Supervisor:</Text>
              <Text style={styles.noteText}>{item.noteFromSender}</Text>
            </View>
          )}
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => handleRejectHandover(item)}
            activeOpacity={0.7}
          >
            <XCircle size={18} color="#ef4444" />
            <Text style={styles.rejectButtonText}>Reject</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.assignButton]}
            onPress={() => handleOpenAssignModal(item)}
            activeOpacity={0.7}
          >
            <CheckCircle size={18} color="#fff" />
            <Text style={styles.assignButtonText}>Assign Team</Text>
            <ChevronRight size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Handover Requests',
            headerStyle: { backgroundColor: '#4285F4' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: '600' as const },
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={styles.loadingText}>Loading handover requests...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Handover Requests',
          headerStyle: { backgroundColor: '#4285F4' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '600' as const },
        }}
      />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Handover Requests</Text>
        <Text style={styles.headerSubtitle}>
          Assign supervisors to pending handover requests
        </Text>
      </View>

      {handoverRequests.length === 0 ? (
        <View style={styles.emptyState}>
          <Package size={64} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>No Handover Requests</Text>
          <Text style={styles.emptyText}>
            Pending handover requests from supervisors will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={handoverRequests}
          renderItem={renderHandoverCard}
          keyExtractor={(item) => item.id || ''}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
        />
      )}

      <Modal
        visible={assignModalVisible}
        transparent
        animationType="slide"
        onRequestClose={handleCloseAssignModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Assign Supervisor & Create Task</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedRequest?.activityName} • PV {selectedRequest?.pvArea} • Block{' '}
                  {selectedRequest?.blockNumber}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleCloseAssignModal}
                disabled={isAssigning}
              >
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Select Supervisor *</Text>
              <View style={styles.supervisorList}>
                {supervisors.map((supervisor) => (
                  <TouchableOpacity
                    key={supervisor.userId}
                    style={[
                      styles.supervisorOption,
                      selectedSupervisor === supervisor.userId && styles.supervisorOptionSelected,
                    ]}
                    onPress={() => setSelectedSupervisor(supervisor.userId)}
                    activeOpacity={0.7}
                    disabled={isAssigning}
                  >
                    <View style={styles.supervisorIconContainer}>
                      <User size={20} color="#4285F4" />
                    </View>
                    <View style={styles.supervisorInfo}>
                      <Text style={styles.supervisorName}>{supervisor.name}</Text>
                      <Text style={styles.supervisorId}>ID: {supervisor.userId}</Text>
                    </View>
                    <View
                      style={[
                        styles.radioButton,
                        selectedSupervisor === supervisor.userId && styles.radioButtonSelected,
                      ]}
                    >
                      {selectedSupervisor === supervisor.userId && (
                        <View style={styles.radioButtonInner} />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 20 }]}>
                Note to Supervisor (optional)
              </Text>
              <TextInput
                style={styles.noteInput}
                value={plannerNote}
                onChangeText={setPlannerNote}
                placeholder="Add instructions or notes for the assigned supervisor..."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                editable={!isAssigning}
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={handleCloseAssignModal}
                disabled={isAssigning}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.confirmButton,
                  (!selectedSupervisor || isAssigning) && styles.confirmButtonDisabled,
                ]}
                onPress={handleAssignSupervisor}
                disabled={!selectedSupervisor || isAssigning}
                activeOpacity={0.7}
              >
                {isAssigning ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <CheckCircle size={18} color="#fff" />
                    <Text style={styles.confirmButtonText}>Assign & Create Task</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500' as const,
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#0f172a',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '400' as const,
  },
  listContent: {
    padding: 16,
  },
  requestCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerLeft: {
    flex: 1,
  },
  activityName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#0f172a',
    marginBottom: 2,
  },
  subActivityName: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500' as const,
  },
  statusBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#f59e0b',
    letterSpacing: 0.5,
  },
  cardBody: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500' as const,
  },
  infoValue: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '600' as const,
    flex: 1,
  },
  noteSection: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  noteLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#475569',
    marginBottom: 4,
  },
  noteText: {
    fontSize: 13,
    color: '#0f172a',
    lineHeight: 18,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  rejectButton: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#ef4444',
  },
  assignButton: {
    backgroundColor: '#4285F4',
    flex: 2,
  },
  assignButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#fff',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
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
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#0f172a',
    marginBottom: 4,
  },
  modalSubtitle: {
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
  modalBody: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    maxHeight: 450,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#0f172a',
    marginBottom: 12,
  },
  supervisorList: {
    gap: 10,
  },
  supervisorOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 14,
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  supervisorOptionSelected: {
    backgroundColor: '#eff6ff',
    borderColor: '#4285F4',
  },
  supervisorIconContainer: {
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
  noteInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0f172a',
    minHeight: 100,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 6,
  },
  cancelButton: {
    backgroundColor: '#f1f5f9',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#475569',
  },
  confirmButton: {
    backgroundColor: '#4285F4',
    flex: 2,
  },
  confirmButtonDisabled: {
    backgroundColor: '#cbd5e1',
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
