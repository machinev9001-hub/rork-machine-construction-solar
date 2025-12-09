import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { queueFirestoreOperation } from '@/utils/offlineQueue';
import NetInfo from '@react-native-community/netinfo';

export type DeepLink = {
  type: 'task';
  taskId: string;
  activityId?: string;
};

type MessageType =
  | 'task_request'
  | 'qc_request'
  | 'cabling_request'
  | 'surveyor_task'
  | 'handover_request';

type MessageStatus = 'approved' | 'rejected' | 'pending' | 'responded' | 'scheduled';

export type MessageData = {
  type: MessageType;
  status: MessageStatus;
  requestId: string;
  fromUserId: string;
  toUserId: string;
  note?: string;
  deepLink?: DeepLink;
  siteId: string;
  taskId?: string;
  activityId?: string;
  pvArea?: string;
  blockNumber?: string;
  activityName?: string;
};

export async function sendRequestMessage(message: MessageData): Promise<void> {
  console.log('Sending request message:', message);
  
  try {
    const netInfo = await NetInfo.fetch();
    const messageData = {
      ...message,
      createdAt: Timestamp.now(),
      read: false,
    };
    
    if (!netInfo.isConnected) {
      console.log('📴 [sendRequestMessage] Offline - queueing message');
      await queueFirestoreOperation(
        { type: 'add', collection: 'messages', data: messageData },
        { priority: 'P1', entityType: 'message' }
      );
      console.log('✅ [sendRequestMessage] Queued for sync when online');
      return;
    }
    
    await addDoc(collection(db, 'messages'), messageData);
    console.log('Message sent successfully');
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}
