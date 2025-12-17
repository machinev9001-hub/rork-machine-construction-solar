import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator, Modal } from 'react-native';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle2, ChevronDown } from 'lucide-react-native';
import { db } from '@/config/firebase';
import { collection, addDoc, Timestamp, doc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { sendRequestMessage } from '@/utils/messaging';
import { useButtonProtection } from '@/utils/hooks/useButtonProtection';
import NetInfo from '@react-native-community/netinfo';
import { queueFirestoreOperation } from '@/utils/offlineQueue';
import { useQuery } from '@tanstack/react-query';

export default function SupervisorTaskRequestScreen() {
  const { activity, subActivity, index, name, currentTaskId, isAddTaskRequest, subMenuId } = useLocalSearchParams<{
    activity: string;
    subActivity: string;
    index: string;
    name: string;
    currentTaskId?: string;
    isAddTaskRequest?: string;
    subMenuId?: string;
  }>();
  const { user } = useAuth();
  const router = useRouter();
  const { protectAction } = useButtonProtection();

  const isAddingNewTask = isAddTaskRequest === 'true';
  
  const [pvArea, setPvArea] = useState<string>('');
  const [blockNumber, setBlockNumber] = useState<string>('');
  const [specialArea, setSpecialArea] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [taskDescription, setTaskDescription] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showPvAreaPicker, setShowPvAreaPicker] = useState<boolean>(false);
  const [showBlockPicker, setShowBlockPicker] = useState<boolean>(false);

  const activityColors: Record<string, string> = {
    drilling: '#4285F4',
    trenching: '#4285F4',
    cabling: '#4285F4',
    terminations: '#4285F4',
    inverters: '#4285F4',
    mechanical: '#4285F4',
    casting: '#4285F4',
    structures: '#4285F4',
  };

  const color = activity ? activityColors[activity] || '#3b82f6' : '#3b82f6';
  const decodedName = name ? decodeURIComponent(name) : 'Task Request';

  const { data: pvAreas = [] } = useQuery({
    queryKey: ['pvAreas', user?.siteId],
    queryFn: async () => {
      if (!user?.siteId) return [];
      const q = query(
        collection(db, 'pvAreas'),
        where('siteId', '==', user.siteId)
      );
      const snapshot = await getDocs(q);
      const areas = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
      }));
      return areas.sort((a, b) => {
        const numA = parseInt(a.name);
        const numB = parseInt(b.name);
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }
        return a.name.localeCompare(b.name);
      });
    },
    enabled: !!user?.siteId && isAddingNewTask,
  });

  const { data: blockAreas = [] } = useQuery({
    queryKey: ['blockAreas', user?.siteId],
    queryFn: async () => {
      if (!user?.siteId) return [];
      const q = query(
        collection(db, 'blockAreas'),
        where('siteId', '==', user.siteId)
      );
      const snapshot = await getDocs(q);
      const blocks = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || 'Unnamed Block',
          pvAreaId: data.pvAreaId || '',
          pvAreaName: data.pvAreaName || '',
        };
      });
      return blocks.sort((a, b) => {
        const numA = parseInt(a.name);
        const numB = parseInt(b.name);
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }
        return a.name.localeCompare(b.name);
      });
    },
    enabled: !!user?.siteId && isAddingNewTask,
  });

  const filteredBlocks = pvArea ? blockAreas.filter(b => {
    const selectedPvAreaData = pvAreas.find(p => p.name === pvArea);
    return selectedPvAreaData ? b.pvAreaId === selectedPvAreaData.id : true;
  }) : blockAreas;

  const handleSaveTaskInternal = async () => {
    console.log('=== SAVE TASK REQUEST STARTED ===');
    console.log('🔍 User Object:', JSON.stringify(user, null, 2));
    console.log('🔍 user.siteId:', user?.siteId);
    console.log('🔍 user.siteName:', user?.siteName);
    console.log('Activity:', activity, 'SubActivity:', subActivity);
    console.log('isAddingNewTask:', isAddingNewTask);
    
    if (!isAddingNewTask) {
      if (!taskDescription.trim()) {
        Alert.alert('Required Field', 'Please enter a task description');
        return;
      }
    }

    if (!user?.userId) {
      Alert.alert('Error', 'User information is missing');
      return;
    }

    if (!user?.siteId) {
      Alert.alert(
        'Missing Site Information',
        `Your user account is missing a siteId. Please contact your administrator.\n\nUser ID: ${user?.userId}\nSite Name: ${user?.siteName || 'N/A'}`,
        [{ text: 'OK' }]
      );
      return;
    }

    setIsSaving(true);

    try {
      const netInfo = await NetInfo.fetch();
      const isOffline = !netInfo.isConnected;
      console.log('🌐 Network status:', isOffline ? 'OFFLINE' : 'ONLINE');

      const requestData = isAddingNewTask ? {
        type: 'TASK_REQUEST',
        requestType: 'ADD_NEW_TASK_PAGE',
        targetModule: 'planner',
        status: 'PENDING',
        requestedBy: user.userId,
        siteId: user.siteId,
        masterAccountId: user.masterAccountId,
        activity: activity || 'unknown',
        subActivity: subActivity || 'unknown',
        subMenuId: subMenuId || subActivity || 'unknown',
        subMenuName: decodedName,
        taskName: decodedName,
        currentTaskId: currentTaskId || null,
        notes: notes.trim() || null,
        suggestedPvArea: pvArea.trim() || null,
        suggestedBlockNumber: blockNumber.trim() || null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      } : {
        type: 'TASK_REQUEST',
        requestType: 'INITIAL_TASK_ACCESS',
        targetModule: 'planner',
        status: 'PENDING',
        requestedBy: user.userId,
        siteId: user.siteId,
        activity: activity || 'unknown',
        subActivity: subActivity || 'unknown',
        taskName: decodedName,
        taskDescription: taskDescription.trim(),
        quantity: quantity.trim() || null,
        location: location.trim() || null,
        notes: notes.trim() || null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      console.log('📝 Saving task request to Firestore:', JSON.stringify(requestData, null, 2));

      let requestId: string;

      if (isOffline) {
        console.log('📡 OFFLINE - Queueing task request');
        const tempRequestId = `temp_request_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        await queueFirestoreOperation(
          {
            type: 'add',
            collection: 'requests',
            data: requestData,
          },
          {
            priority: 'P0',
            entityType: 'taskRequest',
          }
        );
        
        if (currentTaskId) {
          console.log('📡 OFFLINE - Queueing task update (taskAccessRequested = true)');
          await queueFirestoreOperation(
            {
              type: 'update',
              collection: 'tasks',
              docId: currentTaskId,
              data: { taskAccessRequested: true },
            },
            {
              priority: 'P0',
              entityType: 'taskRequest',
            }
          );
        }
        
        requestId = tempRequestId;
        console.log('✅ Task request queued for sync when online');
      } else {
        const docRef = await addDoc(collection(db, 'requests'), requestData);
        requestId = docRef.id;
        console.log('✅ Task request saved with ID:', docRef.id);

        console.log('📨 Sending request message...');
        await sendRequestMessage({
          type: 'task_request',
          status: 'pending',
          requestId: docRef.id,
          fromUserId: user.userId,
          toUserId: 'planner',
          siteId: user.siteId,
        });
        console.log('✅ Message sent successfully');
        
        if (currentTaskId) {
          console.log('🔄 Updating task with taskAccessRequested = true');
          await updateDoc(doc(db, 'tasks', currentTaskId), {
            taskAccessRequested: true,
          });
        }
      }

      console.log('🎉 SUCCESS - Navigating back');
      
      if (router.canGoBack()) {
        router.back();
      } else {
        console.log('⚠️ Cannot go back, navigating to supervisor home');
        router.replace('/(tabs)');
      }
      
      setTimeout(() => {
        Alert.alert(
          '✅ Task Request Submitted',
          isAddingNewTask 
            ? `Your request to add a new Task Page for "${decodedName}" has been ${isOffline ? 'queued and will be sent' : 'submitted successfully and is awaiting'} planner approval.${isOffline ? ' It will sync when you go online.' : ''}\n\nRequest ID: ${requestId}`
            : `Your task request for "${decodedName}" has been ${isOffline ? 'queued and will be sent' : 'submitted successfully and is awaiting'} planner approval.${isOffline ? ' It will sync when you go online.' : ''}\n\nRequest ID: ${requestId}`
        );
      }, 300);
    } catch (error: any) {
      console.error('❌ ERROR saving task request:', error);
      console.error('Error message:', error?.message);
      console.error('Error code:', error?.code);
      console.error('Full error:', JSON.stringify(error, null, 2));
      Alert.alert(
        'Error',
        `Failed to submit task request: ${error?.message || 'Unknown error'}. Please check console logs.`,
        [{ text: 'OK' }]
      );
    } finally {
      console.log('=== SAVE TASK REQUEST FINISHED ===');
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: isAddingNewTask ? 'Add New Task Page' : 'Add Task Request',
          headerStyle: {
            backgroundColor: color,
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: '600' as const,
          },
        }}
      />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={[styles.headerCard, { backgroundColor: color }]}>
          <Text style={styles.siteName}>{user?.siteName?.toUpperCase() || 'ABC SOLAR'}</Text>
          <View style={styles.taskBadge}>
            <View style={styles.indexBadge}>
              <Text style={styles.indexText}>{index}</Text>
            </View>
            <Text style={styles.taskName}>{decodedName}</Text>
          </View>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.sectionTitle}>
            {isAddingNewTask ? 'New Task Page Details' : 'Task Request Details'}
          </Text>

          {isAddingNewTask ? (
            <>
              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>Note:</Text>
                <Text style={styles.infoValue}>You can suggest PV Area and Block Number below. The Planner will review and can adjust these details when approving.</Text>
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>PV Area (Optional - Suggestion)</Text>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setShowPvAreaPicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pickerButtonText, !pvArea && styles.pickerPlaceholder]}>
                    {pvArea || 'Select PV Area (Optional)'}
                  </Text>
                  <ChevronDown size={20} color="#64748b" />
                </TouchableOpacity>
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Block Number (Optional - Suggestion)</Text>
                <TouchableOpacity
                  style={[styles.pickerButton, !pvArea && styles.pickerButtonDisabled]}
                  onPress={() => {
                    if (pvArea) {
                      setShowBlockPicker(true);
                    } else {
                      Alert.alert('Info', 'Please select a PV Area first');
                    }
                  }}
                  activeOpacity={0.7}
                  disabled={!pvArea}
                >
                  <Text style={[styles.pickerButtonText, !blockNumber && styles.pickerPlaceholder]}>
                    {blockNumber || 'Select Block Number (Optional)'}
                  </Text>
                  <ChevronDown size={20} color="#64748b" />
                </TouchableOpacity>
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Additional Notes</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Any additional information for the planner..."
                  placeholderTextColor="#94a3b8"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </>
          ) : (
            <>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>
                  Task Description <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={taskDescription}
                  onChangeText={setTaskDescription}
                  placeholder="Describe the task to be completed..."
                  placeholderTextColor="#94a3b8"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Quantity / Units</Text>
                <TextInput
                  style={styles.textInput}
                  value={quantity}
                  onChangeText={setQuantity}
                  placeholder="e.g., 50 meters, 10 units"
                  placeholderTextColor="#94a3b8"
                  keyboardType="default"
                />
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Location / Area</Text>
                <TextInput
                  style={styles.textInput}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="e.g., Section A, Zone 3"
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Additional Notes</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Any additional information..."
                  placeholderTextColor="#94a3b8"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </>
          )}

          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Requested By:</Text>
            <Text style={styles.infoValue}>{user?.name || user?.userId || 'Unknown'}</Text>
          </View>

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: color }, isSaving && styles.saveButtonDisabled]}
            activeOpacity={0.8}
            onPress={protectAction('save-task', handleSaveTaskInternal)}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <CheckCircle2 size={20} color="#fff" />
            )}
            <Text style={styles.saveButtonText}>
              {isSaving ? 'SUBMITTING...' : (isAddingNewTask ? 'REQUEST NEW TASK PAGE' : 'SAVE TASK REQUEST')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={showPvAreaPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPvAreaPicker(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContent}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select PV Area</Text>
              <TouchableOpacity
                onPress={() => setShowPvAreaPicker(false)}
                style={styles.pickerCloseButton}
              >
                <Text style={styles.pickerCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerScroll}>
              {pvAreas.length === 0 ? (
                <View style={styles.pickerEmpty}>
                  <Text style={styles.pickerEmptyText}>No PV Areas found</Text>
                  <Text style={styles.pickerEmptySubtext}>Contact your administrator</Text>
                </View>
              ) : (
                pvAreas.map((area) => (
                  <TouchableOpacity
                    key={area.id}
                    style={[
                      styles.pickerItem,
                      pvArea === area.name && styles.pickerItemSelected,
                    ]}
                    onPress={() => {
                      setPvArea(area.name);
                      setBlockNumber('');
                      setShowPvAreaPicker(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        pvArea === area.name && styles.pickerItemTextSelected,
                      ]}
                    >
                      {area.name}
                    </Text>
                    {pvArea === area.name && (
                      <CheckCircle2 size={20} color="#4285F4" />
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showBlockPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowBlockPicker(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContent}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Block Number</Text>
              <TouchableOpacity
                onPress={() => setShowBlockPicker(false)}
                style={styles.pickerCloseButton}
              >
                <Text style={styles.pickerCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerScroll}>
              {filteredBlocks.length === 0 ? (
                <View style={styles.pickerEmpty}>
                  <Text style={styles.pickerEmptyText}>No Block Numbers found</Text>
                  <Text style={styles.pickerEmptySubtext}>
                    {pvArea ? `No blocks in ${pvArea}` : 'Select a PV Area first'}
                  </Text>
                </View>
              ) : (
                filteredBlocks.map((block) => (
                  <TouchableOpacity
                    key={block.id}
                    style={[
                      styles.pickerItem,
                      blockNumber === block.name && styles.pickerItemSelected,
                    ]}
                    onPress={() => {
                      setBlockNumber(block.name);
                      setShowBlockPicker(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        blockNumber === block.name && styles.pickerItemTextSelected,
                      ]}
                    >
                      {block.name}
                    </Text>
                    {blockNumber === block.name && (
                      <CheckCircle2 size={20} color="#4285F4" />
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  headerCard: {
    padding: 20,
    marginBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  siteName: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#fff',
    opacity: 0.95,
    marginBottom: 10,
  },
  taskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  indexBadge: {
    width: 34,
    height: 34,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  indexText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
  },
  taskName: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#fff',
    flex: 1,
  },
  formContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: '#5f6368',
    marginBottom: 16,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  fieldContainer: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#202124',
    marginBottom: 8,
  },
  required: {
    color: '#d93025',
  },
  textInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dadce0',
    borderRadius: 8,
    padding: 14,
    fontSize: 14,
    color: '#202124',
  },
  textArea: {
    minHeight: 96,
    paddingTop: 14,
  },
  infoCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#dadce0',
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: '#5f6368',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: '#202124',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
    letterSpacing: 0.3,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  pickerButton: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerButtonDisabled: {
    opacity: 0.5,
  },
  pickerButtonText: {
    fontSize: 14,
    color: '#202124',
  },
  pickerPlaceholder: {
    color: '#94a3b8',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  pickerContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
    paddingBottom: 20,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  pickerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1e293b',
    letterSpacing: -0.3,
  },
  pickerCloseButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
  },
  pickerCloseText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#4285F4',
  },
  pickerScroll: {
    maxHeight: 400,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    minHeight: 64,
  },
  pickerItemSelected: {
    backgroundColor: '#e3f2fd',
    borderLeftWidth: 4,
    borderLeftColor: '#4285F4',
    paddingLeft: 28,
  },
  pickerItemText: {
    fontSize: 17,
    color: '#334155',
    fontWeight: '500' as const,
    letterSpacing: -0.2,
  },
  pickerItemTextSelected: {
    color: '#4285F4',
    fontWeight: '700' as const,
  },
  pickerEmpty: {
    padding: 40,
    alignItems: 'center',
  },
  pickerEmptyText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#64748b',
  },
  pickerEmptySubtext: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
    textAlign: 'center' as const,
  },
});
