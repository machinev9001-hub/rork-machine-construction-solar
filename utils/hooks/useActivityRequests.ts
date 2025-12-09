import { useCallback } from 'react';
import { collection, doc, addDoc, getDocs, query, where, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Alert } from 'react-native';
import { db } from '@/config/firebase';

import { getRequestThrottleStatus, markRequestThrottle } from '@/utils/requestThrottle';

export function useActivityRequests(
  taskId: string,
  userId: string | undefined,
  siteId: string | undefined,
  subActivity: string | undefined,
  taskName: string
) {
  const handleCreateScopeRequest = useCallback(async (activityId: string, note?: string) => {
    console.log('⚠️ [SCOPE REQUEST] Workflow has been removed');
    return false;
  }, []);

  const handleToggleCablingRequest = useCallback(async (activityId: string, value: boolean, activity: any) => {
    try {
      if (!activity?.cablingHandoff) return false;

      const throttleKey = `${taskId}-${activityId}-CABLING_REQUEST`;
      if (value) {
        const { blocked, remainingMs } = getRequestThrottleStatus(throttleKey);
        if (blocked) {
          const remainingSeconds = Math.ceil(remainingMs / 1000);
          console.log('⏱️ Cabling request throttled', { activityId, remainingSeconds });
          Alert.alert('Please Wait', `You can send another cabling request in ${remainingSeconds}s.`);
          return false;
        }
      }

      const newStatus = value ? 'HANDOFF_SENT' : 'LOCKED';
      console.log(`Cabling request ${value ? 'sent' : 'cancelled'} for activity: ${activityId}`);

      const activitiesRef = collection(db, 'activities');
      const q = query(
        activitiesRef,
        where('taskId', '==', taskId),
        where('activityId', '==', activityId)
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const activityDocId = snapshot.docs[0].id;
        
        await updateDoc(doc(db, 'activities', activityDocId), {
          cablingRequested: value,
          status: newStatus,
          updatedAt: serverTimestamp(),
        });

        if (value) {
          const requestsRef = collection(db, 'requests');
          const pendingQuery = query(
            requestsRef,
            where('type', '==', 'CABLING_REQUEST'),
            where('siteId', '==', siteId),
            where('taskId', '==', taskId),
            where('activityId', '==', activityId),
            where('status', '==', 'PENDING')
          );
          const pendingSnapshot = await getDocs(pendingQuery);

          if (pendingSnapshot.empty) {
            await addDoc(collection(db, 'requests'), {
              type: 'CABLING_REQUEST',
              taskId,
              activityId,
              targetModule: activity.cablingHandoff.targetModule,
              requestedBy: userId,
              siteId,
              activityName: activity.name,
              subActivityName: taskName,
              status: 'PENDING',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            console.log('CABLING_REQUEST created');
          } else {
            console.log('⚠️ Existing cabling request detected, skipping duplicate creation', {
              activityId,
              pendingCount: pendingSnapshot.size,
            });
          }
        } else {
          const requestsRef = collection(db, 'requests');
          const reqQuery = query(
            requestsRef,
            where('type', '==', 'CABLING_REQUEST'),
            where('siteId', '==', siteId),
            where('taskId', '==', taskId),
            where('activityId', '==', activityId),
            where('status', '==', 'PENDING')
          );
          const reqSnapshot = await getDocs(reqQuery);
          
          for (const reqDoc of reqSnapshot.docs) {
            await updateDoc(doc(db, 'requests', reqDoc.id), {
              status: 'CANCELLED',
              updatedAt: serverTimestamp(),
            });
          }
          console.log('CABLING_REQUEST cancelled');
        }

        markRequestThrottle(throttleKey);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error handling cabling request:', error);
      Alert.alert('Error', 'Failed to update cabling request');
      return false;
    }
  }, [taskId, userId, siteId, taskName]);

  const handleToggleTerminationRequest = useCallback(async (activityId: string, value: boolean, activity: any) => {
    try {
      if (!activity?.terminationHandoff) return false;

      const throttleKey = `${taskId}-${activityId}-TERMINATION_REQUEST`;
      if (value) {
        const { blocked, remainingMs } = getRequestThrottleStatus(throttleKey);
        if (blocked) {
          const remainingSeconds = Math.ceil(remainingMs / 1000);
          console.log('⏱️ Termination request throttled', { activityId, remainingSeconds });
          Alert.alert('Please Wait', `You can send another termination request in ${remainingSeconds}s.`);
          return false;
        }
      }

      const newStatus = value ? 'HANDOFF_SENT' : 'LOCKED';
      console.log(`Termination request ${value ? 'sent' : 'cancelled'} for activity: ${activityId}`);

      const activitiesRef = collection(db, 'activities');
      const q = query(
        activitiesRef,
        where('taskId', '==', taskId),
        where('activityId', '==', activityId)
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const activityDocId = snapshot.docs[0].id;
        
        await updateDoc(doc(db, 'activities', activityDocId), {
          terminationRequested: value,
          status: newStatus,
          updatedAt: serverTimestamp(),
        });

        if (value) {
          const requestsRef = collection(db, 'requests');
          const pendingQuery = query(
            requestsRef,
            where('type', '==', 'TERMINATION_REQUEST'),
            where('siteId', '==', siteId),
            where('taskId', '==', taskId),
            where('activityId', '==', activityId),
            where('status', '==', 'PENDING')
          );
          const pendingSnapshot = await getDocs(pendingQuery);

          if (pendingSnapshot.empty) {
            await addDoc(collection(db, 'requests'), {
              type: 'TERMINATION_REQUEST',
              taskId,
              activityId,
              targetModule: activity.terminationHandoff.targetModule,
              requestedBy: userId,
              siteId,
              activityName: activity.name,
              subActivityName: taskName,
              status: 'PENDING',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            console.log('TERMINATION_REQUEST created');
          } else {
            console.log('⚠️ Existing termination request detected, skipping duplicate creation', {
              activityId,
              pendingCount: pendingSnapshot.size,
            });
          }
        } else {
          const requestsRef = collection(db, 'requests');
          const reqQuery = query(
            requestsRef,
            where('type', '==', 'TERMINATION_REQUEST'),
            where('siteId', '==', siteId),
            where('taskId', '==', taskId),
            where('activityId', '==', activityId),
            where('status', '==', 'PENDING')
          );
          const reqSnapshot = await getDocs(reqQuery);
          
          for (const reqDoc of reqSnapshot.docs) {
            await updateDoc(doc(db, 'requests', reqDoc.id), {
              status: 'CANCELLED',
              updatedAt: serverTimestamp(),
            });
          }
          console.log('TERMINATION_REQUEST cancelled');
        }

        markRequestThrottle(throttleKey);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error handling termination request:', error);
      Alert.alert('Error', 'Failed to update termination request');
      return false;
    }
  }, [taskId, userId, siteId, taskName]);

  const handleToggleQCRequest = useCallback(async (activityId: string, value: boolean, activity: any, tempCompletedValues: Record<string, string>) => {
    try {
      const compositeKey = `${taskId}-${activityId}`;
      const hasTempValue = tempCompletedValues[compositeKey] && parseFloat(tempCompletedValues[compositeKey]) > 0;
      
      if (value && hasTempValue) {
        console.log('⚠️ Cannot create QC request - supervisor has unsaved input');
        Alert.alert(
          'Cannot Request QC', 
          'You have an unsaved value in the input field. Please submit your "Completed Today" value first before requesting QC inspection.'
        );
        return false;
      }
      
      if (value && (!activity?.completedToday || activity.completedToday <= 0)) {
        console.log('⚠️ Cannot create QC request - no completed today value');
        Alert.alert(
          'Cannot Request QC', 
          'You must submit a "Completed Today" value before requesting a QC inspection.'
        );
        return false;
      }
      
      if (value && activity?.qcStatus && ['pending', 'scheduled', 'in_progress'].includes(activity.qcStatus)) {
        console.log('⚠️ Cannot create QC request - active request exists with status:', activity.qcStatus);
        Alert.alert('QC Request Pending', 'A QC inspection is already scheduled or in progress for this activity.');
        return false;
      }

      const throttleKey = `${taskId}-${activityId}-QC_REQUEST`;
      if (value) {
        const { blocked, remainingMs } = getRequestThrottleStatus(throttleKey);
        if (blocked) {
          const remainingSeconds = Math.ceil(remainingMs / 1000);
          console.log('⏱️ QC request throttled', { activityId, remainingSeconds });
          Alert.alert('Please Wait', `You can send another QC request in ${remainingSeconds}s.`);
          return false;
        }
      }

      console.log(`QC request ${value ? 'sent' : 'cancelled'} for activity: ${activityId}`);

      const activitiesRef = collection(db, 'activities');
      const q = query(
        activitiesRef,
        where('taskId', '==', taskId),
        where('activityId', '==', activityId)
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const activityDocId = snapshot.docs[0].id;
        
        if (value) {
          const requestsRef = collection(db, 'requests');
          const pendingQuery = query(
            requestsRef,
            where('type', '==', 'QC_REQUEST'),
            where('siteId', '==', siteId),
            where('taskId', '==', taskId),
            where('activityId', '==', activityId),
            where('status', 'in', ['pending', 'scheduled'])
          );
          const pendingSnapshot = await getDocs(pendingQuery);

          let requestId: string | null = null;

          if (pendingSnapshot.empty) {
            const requestRef = await addDoc(collection(db, 'requests'), {
              type: 'QC_REQUEST',
              taskId,
              activityId,
              requestedBy: userId,
              siteId,
              activityName: activity?.name || 'Unknown Activity',
              subActivityName: taskName,
              status: 'pending',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            requestId = requestRef.id;
            console.log('✅ QC_REQUEST created with siteId:', siteId, 'requestId:', requestRef.id, 'activityId:', activityId);
          } else {
            requestId = pendingSnapshot.docs[0]?.id ?? null;
            const existingStatus = pendingSnapshot.docs[0]?.data()?.status;
            console.log('⚠️ Existing QC request detected, reusing it', {
              activityId,
              requestId,
              existingStatus,
              pendingCount: pendingSnapshot.size,
            });
          }
          
          await updateDoc(doc(db, 'activities', activityDocId), {
            qcRequested: true,
            'qc.status': 'pending',
            'qc.lastRequestId': requestId,
            'qc.lastUpdatedAt': serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          const requestsRef = collection(db, 'requests');
          const reqQuery = query(
            requestsRef,
            where('type', '==', 'QC_REQUEST'),
            where('siteId', '==', siteId),
            where('taskId', '==', taskId),
            where('activityId', '==', activityId),
            where('status', 'in', ['pending', 'scheduled'])
          );
          const reqSnapshot = await getDocs(reqQuery);
          
          for (const reqDoc of reqSnapshot.docs) {
            await updateDoc(doc(db, 'requests', reqDoc.id), {
              status: 'CANCELLED',
              updatedAt: serverTimestamp(),
            });
          }
          console.log('QC_REQUEST cancelled');
          
          await updateDoc(doc(db, 'activities', activityDocId), {
            qcRequested: false,
            'qc.status': 'not_requested',
            'qc.lastRequestId': null,
            'qc.lastUpdatedAt': serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        markRequestThrottle(throttleKey);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error handling QC request:', error);
      Alert.alert('Error', 'Failed to update QC request');
      return false;
    }
  }, [taskId, userId, siteId, taskName]);

  return {
    handleCreateScopeRequest,
    handleToggleCablingRequest,
    handleToggleTerminationRequest,
    handleToggleQCRequest,
  };
}
