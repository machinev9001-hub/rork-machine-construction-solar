import { Stack } from 'expo-router';
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
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { X, Calendar, User, MapPin } from 'lucide-react-native';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  addDoc,
  serverTimestamp,
  getDocs,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { HandoverRequest } from '../types';
import { sendRequestMessage } from '../utils/messaging';

type SurveyorOption = {
  userId: string;
  name: string;
};

export default function PlannerSurveyorRequestsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [requests, setRequests] = useState<HandoverRequest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(() => new Set<string>());
  const [scheduleModalVisible, setScheduleModalVisible] = useState<boolean>(false);
  const [selectedRequest, setSelectedRequest] = useState<HandoverRequest | null>(null);
  const [surveyors, setSurveyors] = useState<SurveyorOption[]>([]);
  const [selectedSurveyor, setSelectedSurveyor] = useState<string>('');
  const [plannerNote, setPlannerNote] = useState<string>('');
  const [linkedImages, setLinkedImages] = useState<Record<string, { imageId: string; imageUrl: string }[]>>({});
  const [activeTab, setActiveTab] = useState<'incoming' | 'scheduled' | 'archived'>('incoming');

  const loadLinkedImages = useCallback(async (reqs: HandoverRequest[]) => {
    const imagesMap: Record<string, { imageId: string; imageUrl: string }[]> = {};

    await Promise.all(
      reqs.map(async (req) => {
        if (!req.id || !req.linkedImageIds || req.linkedImageIds.length === 0) {
          return;
        }

        try {
          const imagesRef = collection(db, 'surveyorImages');
          const imagesQuery = query(
            imagesRef,
            where('imageId', 'in', req.linkedImageIds.slice(0, 10))
          );
          const imagesSnapshot = await getDocs(imagesQuery);
          const images: { imageId: string; imageUrl: string }[] = [];

          imagesSnapshot.forEach((imgDoc) => {
            const imgData = imgDoc.data();
            images.push({
              imageId: imgData.imageId,
              imageUrl: imgData.imageUrl,
            });
          });

          imagesMap[req.id] = images;
        } catch (error) {
          console.error('❌ Error loading images for request:', req.id, error);
        }
      })
    );

    setLinkedImages(imagesMap);
  }, []);

  useEffect(() => {
    if (!user?.siteId) {
      setIsLoading(false);
      setRequests([]);
      return;
    }

    setIsLoading(true);

    const handoverRequestsRef = collection(db, 'handoverRequests');
    const requestsQuery = query(
      handoverRequestsRef,
      where('siteId', '==', user.siteId),
      where('requestType', '==', 'SURVEYOR_REQUEST'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      requestsQuery,
      async (snapshot) => {
        const loadedRequests: HandoverRequest[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<HandoverRequest, 'id'>),
        }));

        setRequests(loadedRequests);
        setIsLoading(false);
        await loadLinkedImages(loadedRequests);
      },
      (error) => {
        console.error('❌ [PlannerSurveyorRequests] Error loading requests:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.siteId, loadLinkedImages]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 900);
  }, []);

  const loadSurveyors = useCallback(async () => {
    if (!user?.siteId) {
      return;
    }

    try {
      const usersRef = collection(db, 'users');
      const usersQuery = query(
        usersRef,
        where('siteId', '==', user.siteId),
        where('role', '==', 'Surveyor')
      );
      const snapshot = await getDocs(usersQuery);
      const surveyorUsers = snapshot.docs.reduce<SurveyorOption[]>((accumulator, docSnapshot) => {
        const data = docSnapshot.data() as Partial<{ userId: unknown; name: unknown }>;
        if (typeof data.userId !== 'string') {
          return accumulator;
        }

        accumulator.push({
          userId: data.userId,
          name:
            typeof data.name === 'string' && data.name.trim().length > 0
              ? data.name
              : 'Unknown',
        });
        return accumulator;
      }, []);
      setSurveyors(surveyorUsers);
      console.log('👥 [PlannerSurveyorRequests] Loaded', surveyorUsers.length, 'surveyors');
    } catch (error) {
      console.error('❌ [PlannerSurveyorRequests] Error loading surveyors:', error);
    }
  }, [user?.siteId]);

  const handleSchedule = useCallback(
    async (requestId: string) => {
      const request = requests.find((r) => r.id === requestId);
      if (!request) {
        return;
      }

      setSelectedSurveyor('');
      setPlannerNote('');
      setSelectedRequest(request);
      setScheduleModalVisible(true);
      await loadSurveyors();
    },
    [loadSurveyors, requests]
  );

  const handleHandOff = useCallback(
    async (requestId: string) => {
      const request = requests.find((r) => r.id === requestId);
      if (!request) {
        return;
      }

      Alert.alert(
        'Hand Off to Surveyor',
        'This will immediately approve the request and create a surveyor task. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm',
            onPress: async () => {
              setProcessingIds((prev) => {
                const next = new Set(prev);
                next.add(requestId);
                return next;
              });

              try {
                console.log('✅ [PlannerSurveyorRequests] Handing off request:', requestId);

                const surveyorTasksRef = collection(db, 'surveyorTasks');
                const newTaskRef = await addDoc(surveyorTasksRef, {
                  taskId: request.fromTaskId || '',
                  siteId: request.siteId,
                  createdByUserId: request.fromSupervisorId,
                  status: 'APPROVED',
                  pvArea: request.pvArea,
                  blockNumber: request.blockNumber,
                  rowNr: request.rowNr || '',
                  columnNr: request.columnNr || '',
                  notes: request.noteFromSender || '',
                  linkedImageIds: request.linkedImageIds || [],
                  archived: false,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });

                console.log('✅ [PlannerSurveyorRequests] Surveyor task created:', newTaskRef.id);

                const handoverRequestsRef = collection(db, 'handoverRequests');
                await updateDoc(doc(handoverRequestsRef, requestId), {
                  status: 'APPROVED',
                  appointedTaskId: newTaskRef.id,
                  noteFromPlanner: 'Approved and handed off to surveyors',
                  updatedAt: serverTimestamp(),
                });

                if (!user?.siteId || !user.userId) {
                  console.warn('⚠️ [PlannerSurveyorRequests] Missing planner identifiers, skipping notifications');
                } else {
                  const siteId = user.siteId;
                  const plannerUserId = user.userId;
                  const usersRef = collection(db, 'users');
                  const usersQuery = query(
                    usersRef,
                    where('siteId', '==', siteId),
                    where('role', '==', 'Surveyor')
                  );
                  const snapshot = await getDocs(usersQuery);
                  const notificationPromises: Promise<void>[] = [];
                  snapshot.docs.forEach((docSnapshot) => {
                    const data = docSnapshot.data() as Partial<{ userId: unknown }>;
                    const targetUserId = typeof data.userId === 'string' ? data.userId : '';
                    if (!targetUserId) {
                      return;
                    }
                    notificationPromises.push(
                      sendRequestMessage({
                        type: 'surveyor_task',
                        status: 'approved',
                        requestId: newTaskRef.id,
                        fromUserId: plannerUserId,
                        toUserId: targetUserId,
                        note: `✅ New Surveyor Task Approved: ${request.activityName} - ${request.pvArea} Block ${request.blockNumber}`,
                        siteId,
                      })
                    );
                  });
                  await Promise.all(notificationPromises);
                  console.log('📤 [PlannerSurveyorRequests] Notifications sent to surveyors');
                }

                Alert.alert('Success', 'Request approved and surveyor task created');
              } catch (error) {
                console.error('❌ [PlannerSurveyorRequests] Error handing off:', error);
                Alert.alert('Error', 'Failed to hand off request');
              } finally {
                setProcessingIds((prev) => {
                  const next = new Set(prev);
                  next.delete(requestId);
                  return next;
                });
              }
            },
          },
        ]
      );
    },
    [requests, user?.siteId, user?.userId]
  );

  const handleDecline = useCallback((requestId: string, reason: string) => {
    setProcessingIds((prev) => {
      const next = new Set(prev);
      next.add(requestId);
      return next;
    });

    const handoverRequestsRef = collection(db, 'handoverRequests');
    updateDoc(doc(handoverRequestsRef, requestId), {
      status: 'REJECTED',
      noteFromPlanner: reason,
      updatedAt: serverTimestamp(),
    })
      .then(() => {
        console.log('❌ [PlannerSurveyorRequests] Request declined:', requestId);
        Alert.alert('Success', 'Request declined');
      })
      .catch((error) => {
        console.error('❌ [PlannerSurveyorRequests] Error declining request:', error);
        Alert.alert('Error', 'Failed to decline request');
      })
      .finally(() => {
        setProcessingIds((prev) => {
          const next = new Set(prev);
          next.delete(requestId);
          return next;
        });
      });
  }, []);

  const handleScheduleSubmit = useCallback(async () => {
    if (!selectedRequest || !selectedSurveyor) {
      Alert.alert('Error', 'Please select a surveyor');
      return;
    }

    const requestId = selectedRequest.id;
    if (!requestId) {
      Alert.alert('Error', 'Missing request identifier');
      return;
    }

    setProcessingIds((prev) => {
      const next = new Set(prev);
      next.add(requestId);
      return next;
    });

    try {
      console.log('📅 [PlannerSurveyorRequests] Scheduling request for surveyor:', selectedSurveyor);

      const surveyorTasksRef = collection(db, 'surveyorTasks');
      const newTaskRef = await addDoc(surveyorTasksRef, {
        taskId: selectedRequest.fromTaskId || '',
        siteId: selectedRequest.siteId,
        createdByUserId: selectedRequest.fromSupervisorId,
        assignedSurveyorUserId: selectedSurveyor,
        status: 'APPROVED',
        pvArea: selectedRequest.pvArea,
        blockNumber: selectedRequest.blockNumber,
        rowNr: selectedRequest.rowNr || '',
        columnNr: selectedRequest.columnNr || '',
        notes: plannerNote || selectedRequest.noteFromSender || '',
        linkedImageIds: selectedRequest.linkedImageIds || [],
        archived: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      console.log('✅ [PlannerSurveyorRequests] Surveyor task created:', newTaskRef.id);

      const handoverRequestsRef = collection(db, 'handoverRequests');
      await updateDoc(doc(handoverRequestsRef, requestId), {
        status: 'APPROVED',
        appointedSupervisorId: selectedSurveyor,
        appointedTaskId: newTaskRef.id,
        noteFromPlanner: plannerNote || 'Scheduled for surveyor',
        updatedAt: serverTimestamp(),
      });

      await sendRequestMessage({
        type: 'surveyor_task',
        status: 'scheduled',
        requestId: newTaskRef.id,
        fromUserId: user?.userId || '',
        toUserId: selectedSurveyor,
        note: `📅 Surveyor Task Assigned: ${selectedRequest.activityName} - ${selectedRequest.pvArea} Block ${selectedRequest.blockNumber}`,
        siteId: selectedRequest.siteId,
      });

      Alert.alert('Success', 'Request scheduled and assigned to surveyor');
      setScheduleModalVisible(false);
      setSelectedRequest(null);
      setSelectedSurveyor('');
      setPlannerNote('');
    } catch (error) {
      console.error('❌ [PlannerSurveyorRequests] Error scheduling:', error);
      Alert.alert('Error', 'Failed to schedule request');
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  }, [plannerNote, selectedRequest, selectedSurveyor, user?.userId]);

  const pendingRequests = useMemo(
    () =>
      requests.filter((requestItem) => {
        const normalizedStatus = (requestItem.status ?? '').toString().toUpperCase();
        return normalizedStatus === 'PENDING';
      }),
    [requests]
  );

  const scheduledRequests = useMemo(
    () =>
      requests.filter((requestItem) => {
        const normalizedStatus = (requestItem.status ?? '').toString().toUpperCase();
        return normalizedStatus === 'APPROVED' || normalizedStatus === 'SCHEDULED';
      }),
    [requests]
  );

  const archivedRequests = useMemo(
    () =>
      requests.filter((requestItem) => {
        const normalizedStatus = (requestItem.status ?? '').toString().toUpperCase();
        return (
          normalizedStatus === 'REJECTED' ||
          normalizedStatus === 'CANCELLED' ||
          normalizedStatus === 'RESOLVED_BY_PLANNER'
        );
      }),
    [requests]
  );

  const pendingCount = pendingRequests.length;
  const scheduledCount = scheduledRequests.length;
  const archivedCount = archivedRequests.length;

  const selectedRequests = useMemo(() => {
    if (activeTab === 'incoming') {
      return pendingRequests;
    }

    if (activeTab === 'scheduled') {
      return scheduledRequests;
    }

    return archivedRequests;
  }, [activeTab, pendingRequests, scheduledRequests, archivedRequests]);

  const listHeaderComponent = useMemo(
    () => (
      <View style={styles.listHeader} testID="surveyor-requests-header">
        <View style={styles.summaryCard}>
          <View style={styles.summaryTopRow}>
            <View style={styles.summaryIcon}>
              <MapPin size={22} color="#0891b2" />
            </View>
            <View style={styles.summaryText}>
              <Text style={styles.summaryTitle}>Surveyor Requests</Text>
              <Text style={styles.summarySubtitle}>
                Reuse generic handover cards to orchestrate field measurements seamlessly.
              </Text>
            </View>
          </View>
          <View style={styles.summaryCounts}>
            <View style={[styles.countCard, styles.countCardFirst]}>
              <Text style={styles.countValue}>{pendingCount}</Text>
              <Text style={styles.countLabel}>Pending</Text>
            </View>
            <View style={[styles.countCard, styles.countCardMiddle]}>
              <Text style={styles.countValue}>{scheduledCount}</Text>
              <Text style={styles.countLabel}>Handed Off</Text>
            </View>
            <View style={styles.countCard}>
              <Text style={styles.countValue}>{archivedCount}</Text>
              <Text style={styles.countLabel}>Archived</Text>
            </View>
          </View>
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity
            testID="surveyor-tab-incoming"
            style={[styles.tabButton, activeTab === 'incoming' && styles.tabButtonActive]}
            activeOpacity={0.7}
            onPress={() => setActiveTab('incoming')}
          >
            <Text style={[styles.tabLabel, activeTab === 'incoming' && styles.tabLabelActive]}>Incoming</Text>
            <View
              style={[
                styles.tabBadge,
                activeTab === 'incoming' ? styles.tabBadgeActive : styles.tabBadgeInactive,
              ]}
            >
              <Text
                style={[
                  styles.tabBadgeText,
                  activeTab === 'incoming' ? styles.tabBadgeTextActive : styles.tabBadgeTextInactive,
                ]}
              >
                {pendingCount}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            testID="surveyor-tab-scheduled"
            style={[styles.tabButton, activeTab === 'scheduled' && styles.tabButtonActive]}
            activeOpacity={0.7}
            onPress={() => setActiveTab('scheduled')}
          >
            <Text style={[styles.tabLabel, activeTab === 'scheduled' && styles.tabLabelActive]}>Scheduled</Text>
            <View
              style={[
                styles.tabBadge,
                activeTab === 'scheduled' ? styles.tabBadgeActive : styles.tabBadgeInactive,
              ]}
            >
              <Text
                style={[
                  styles.tabBadgeText,
                  activeTab === 'scheduled'
                    ? styles.tabBadgeTextActive
                    : styles.tabBadgeTextInactive,
                ]}
              >
                {scheduledCount}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            testID="surveyor-tab-archived"
            style={[styles.tabButton, activeTab === 'archived' && styles.tabButtonActive]}
            activeOpacity={0.7}
            onPress={() => setActiveTab('archived')}
          >
            <Text style={[styles.tabLabel, activeTab === 'archived' && styles.tabLabelActive]}>Archived</Text>
            <View
              style={[
                styles.tabBadge,
                activeTab === 'archived' ? styles.tabBadgeActive : styles.tabBadgeInactive,
              ]}
            >
              <Text
                style={[
                  styles.tabBadgeText,
                  activeTab === 'archived' ? styles.tabBadgeTextActive : styles.tabBadgeTextInactive,
                ]}
              >
                {archivedCount}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    ),
    [activeTab, pendingCount, scheduledCount, archivedCount]
  );

  const emptyStateComponent = useMemo(() => {
    const title =
      activeTab === 'incoming'
        ? 'No incoming surveyor requests'
        : activeTab === 'scheduled'
        ? 'No scheduled surveyor tasks'
        : 'No archived surveyor requests';

    const description =
      activeTab === 'incoming'
        ? 'Supervisors will send handover requests once field work is ready for surveying.'
        : activeTab === 'scheduled'
        ? 'Approved requests will appear once surveyors have been assigned.'
        : 'Declined or resolved surveyor requests will surface here for reference.';

    return (
      <View style={styles.emptyState} testID="surveyor-empty-state">
        <MapPin size={56} color="#cbd5e1" />
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptyText}>{description}</Text>
      </View>
    );
  }, [activeTab]);

  const renderRequestItem = useCallback(
    ({ item }: { item: HandoverRequest }) => {
      const normalizedStatus = (item.status ?? '').toString().toUpperCase();
      const requestId = item.id || '';
      const isProcessing = processingIds.has(requestId);
      const images = linkedImages[requestId] || [];

      return (
        <View style={styles.requestCard}>
          <View style={styles.requestHeader}>
            <Text style={styles.requestTitle}>{item.activityName}</Text>
            <View style={[styles.statusBadge, { backgroundColor: normalizedStatus === 'PENDING' ? '#fef3c7' : normalizedStatus === 'APPROVED' || normalizedStatus === 'SCHEDULED' ? '#d1fae5' : '#fee2e2' }]}>
              <Text style={[styles.statusText, { color: normalizedStatus === 'PENDING' ? '#b45309' : normalizedStatus === 'APPROVED' || normalizedStatus === 'SCHEDULED' ? '#065f46' : '#991b1b' }]}>
                {normalizedStatus}
              </Text>
            </View>
          </View>

          <View style={styles.requestInfo}>
            <Text style={styles.infoLabel}>PV Area: <Text style={styles.infoValue}>{item.pvArea}</Text></Text>
            <Text style={styles.infoLabel}>Block: <Text style={styles.infoValue}>{item.blockNumber}</Text></Text>
            {item.rowNr && (
              <Text style={styles.infoLabel}>Row nr: <Text style={styles.infoValue}>{item.rowNr}</Text></Text>
            )}
            {item.columnNr && (
              <Text style={styles.infoLabel}>Column nr: <Text style={styles.infoValue}>{item.columnNr}</Text></Text>
            )}
          </View>

          {item.noteFromSender && (
            <View style={styles.noteSection}>
              <Text style={styles.noteLabel}>Note:</Text>
              <Text style={styles.noteText}>{item.noteFromSender}</Text>
            </View>
          )}

          {images.length > 0 && (
            <View style={styles.imageSection}>
              <Text style={styles.imageLabel}>{images.length} linked image(s)</Text>
            </View>
          )}

          {normalizedStatus === 'PENDING' && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.scheduleButton]}
                onPress={() => handleSchedule(requestId)}
                disabled={isProcessing}
                activeOpacity={0.7}
              >
                <Text style={styles.scheduleButtonText}>{isProcessing ? 'Processing...' : 'Schedule'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.handoffButton]}
                onPress={() => handleHandOff(requestId)}
                disabled={isProcessing}
                activeOpacity={0.7}
              >
                <Text style={styles.handoffButtonText}>{isProcessing ? 'Processing...' : 'Hand Off'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.declineButton]}
                onPress={() => handleDecline(requestId, 'Declined by planner')}
                disabled={isProcessing}
                activeOpacity={0.7}
              >
                <Text style={styles.declineButtonText}>{isProcessing ? 'Processing...' : 'Decline'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    },
    [handleDecline, handleHandOff, handleSchedule, linkedImages, processingIds]
  );

  const keyExtractor = useCallback((item: HandoverRequest) => item.id || '', []);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Surveyor Requests',
            headerStyle: { backgroundColor: '#0891b2' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: '600' as const },
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0891b2" />
          <Text style={styles.loadingText}>Loading surveyor requests...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Surveyor Requests',
          headerStyle: { backgroundColor: '#0891b2' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '600' as const },
        }}
      />

      <FlatList
        data={selectedRequests}
        keyExtractor={keyExtractor}
        renderItem={renderRequestItem}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        ListHeaderComponent={listHeaderComponent}
        ListEmptyComponent={emptyStateComponent}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: 32 + insets.bottom },
          selectedRequests.length === 0 ? styles.listContentEmpty : null,
        ]}
      />

      <Modal
        visible={scheduleModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setScheduleModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Schedule Surveyor Task</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedRequest?.activityName} • PV {selectedRequest?.pvArea} • Block {selectedRequest?.blockNumber}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setScheduleModalVisible(false)}
              >
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Select Surveyor *</Text>
              <View style={styles.surveyorList}>
                {surveyors.map((surveyor) => (
                  <TouchableOpacity
                    key={surveyor.userId}
                    style={[
                      styles.surveyorOption,
                      selectedSurveyor === surveyor.userId && styles.surveyorOptionSelected,
                    ]}
                    onPress={() => setSelectedSurveyor(surveyor.userId)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.surveyorIconContainer}>
                      <User size={20} color="#0891b2" />
                    </View>
                    <View style={styles.surveyorInfo}>
                      <Text style={styles.surveyorName}>{surveyor.name}</Text>
                      <Text style={styles.surveyorId}>ID: {surveyor.userId}</Text>
                    </View>
                    <View
                      style={[
                        styles.radioButton,
                        selectedSurveyor === surveyor.userId && styles.radioButtonSelected,
                      ]}
                    >
                      {selectedSurveyor === surveyor.userId && <View style={styles.radioButtonInner} />}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Note to Surveyor (optional)</Text>
              <TextInput
                style={styles.noteInput}
                value={plannerNote}
                onChangeText={setPlannerNote}
                placeholder="Add instructions or notes for the assigned surveyor..."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSpacing, styles.cancelButton]}
                onPress={() => {
                  setScheduleModalVisible(false);
                  setSelectedRequest(null);
                  setSelectedSurveyor('');
                  setPlannerNote('');
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.confirmButton,
                  !selectedSurveyor && styles.confirmButtonDisabled,
                ]}
                onPress={handleScheduleSubmit}
                disabled={!selectedSurveyor}
                activeOpacity={0.7}
              >
                <Calendar size={18} color="#fff" />
                <Text style={styles.confirmButtonText}>Schedule Task</Text>
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
    backgroundColor: '#f5f9ff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500' as const,
  },
  listHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 6,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e0f7fa',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  summaryText: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#0f172a',
    marginBottom: 4,
  },
  summarySubtitle: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  summaryCounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  countCard: {
    flex: 1,
    backgroundColor: '#f0f9ff',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  countCardFirst: {
    marginRight: 12,
  },
  countCardMiddle: {
    marginRight: 12,
  },
  countValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#0f172a',
  },
  countLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#0284c7',
    marginTop: 6,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 4,
    marginTop: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  tabButtonActive: {
    backgroundColor: '#0891b2',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#64748b',
  },
  tabLabelActive: {
    color: '#ffffff',
  },
  tabBadge: {
    marginLeft: 8,
    minWidth: 28,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 12,
    alignItems: 'center',
  },
  tabBadgeInactive: {
    backgroundColor: '#e2e8f0',
  },
  tabBadgeActive: {
    backgroundColor: '#ffffff',
  },
  tabBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  tabBadgeTextInactive: {
    color: '#475569',
  },
  tabBadgeTextActive: {
    color: '#0891b2',
  },
  listContent: {
    paddingTop: 8,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#0f172a',
    marginTop: 18,
  },
  emptyText: {
    marginTop: 8,
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
  surveyorList: {
    marginBottom: 12,
  },
  surveyorOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 14,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  surveyorOptionSelected: {
    backgroundColor: '#cffafe',
    borderColor: '#0891b2',
  },
  surveyorIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0f7fa',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  surveyorInfo: {
    flex: 1,
  },
  surveyorName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#0f172a',
    marginBottom: 2,
  },
  surveyorId: {
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderColor: '#0891b2',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#0891b2',
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
  },
  modalButtonSpacing: {
    marginRight: 12,
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
    backgroundColor: '#0891b2',
  },
  confirmButtonDisabled: {
    backgroundColor: '#cbd5e1',
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#ffffff',
  },
  requestCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#0f172a',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
  },
  requestInfo: {
    marginBottom: 12,
    gap: 6,
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500' as const,
  },
  infoValue: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '700' as const,
  },
  noteSection: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  noteLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#475569',
    marginBottom: 4,
  },
  noteText: {
    fontSize: 13,
    color: '#0f172a',
    lineHeight: 18,
  },
  imageSection: {
    marginBottom: 12,
  },
  imageLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600' as const,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  scheduleButton: {
    backgroundColor: '#0891b2',
  },
  scheduleButtonText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#ffffff',
  },
  handoffButton: {
    backgroundColor: '#059669',
  },
  handoffButtonText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#ffffff',
  },
  declineButton: {
    backgroundColor: '#dc2626',
  },
  declineButtonText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#ffffff',
  },
});
