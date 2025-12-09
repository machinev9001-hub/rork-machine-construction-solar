import { Alert } from 'react-native';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/config/firebase';

export async function deleteRequest(requestId: string): Promise<void> {
  try {
    console.log('🗑️ Deleting request:', requestId);
    const requestRef = doc(db, 'requests', requestId);
    await deleteDoc(requestRef);
    console.log('✅ Request deleted successfully:', requestId);
  } catch (error) {
    console.error('❌ Error deleting request:', error);
    throw error;
  }
}

export function confirmDeleteRequest(requestId: string, onConfirm: () => void): void {
  Alert.alert(
    'Delete Request',
    'Are you sure you want to permanently delete this cancelled request? This action cannot be undone.',
    [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: onConfirm,
      },
    ]
  );
}
