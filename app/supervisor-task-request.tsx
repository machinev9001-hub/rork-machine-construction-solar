import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle2 } from 'lucide-react-native';
import { db } from '@/config/firebase';
import { collection, addDoc, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { sendRequestMessage } from '@/utils/messaging';
import { useButtonProtection } from '@/utils/hooks/useButtonProtection';
import NetInfo from '@react-native-community/netinfo';
import { queueFirestoreOperation } from '@/utils/offlineQueue';

export default function SupervisorTaskRequestScreen() {
  const { activity, subActivity, index, name, currentTaskId, isAddTaskRequest } = useLocalSearchParams<{
    activity: string;
    subActivity: string;
    index: string;
    name: string;
    currentTaskId?: string;
    isAddTaskRequest?: string;
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
        activity: activity || 'unknown',
        subActivity: subActivity || 'unknown',
        subMenuName: decodedName,
        taskName: decodedName,
        currentTaskId: currentTaskId || null,
        notes: notes.trim() || null,
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
                <Text style={styles.infoValue}>The Planner will fill in PV Area and Block Number details when approving this request.</Text>
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
});
