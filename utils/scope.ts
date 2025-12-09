import { arrayUnion, collection, doc, getDoc, getDocs, query, Timestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { queueFirestoreOperation } from '@/utils/offlineQueue';
import NetInfo from '@react-native-community/netinfo';

export type ScopeRequestDoc = {
  type: 'SCOPE_REQUEST';
  status: 'pending' | 'APPROVED' | 'REJECTED';
  siteId: string;
  supervisorId: string;
  activityId: string;
  taskId?: string;
  subActivity?: string;
  taskName?: string;
  note?: string;
  createdAt: any;
  updatedAt: any;
  updatedBy?: string;
};

export async function approveScopeRequest(reqId: string, scopeValue: number, unit: string, approverUserId: string) {
  console.log('📊 [approveScopeRequest] Starting - reqId:', reqId, 'scope:', scopeValue, 'unit:', unit);
  
  const netInfo = await NetInfo.fetch();
  
  const reqSnap = await getDoc(doc(db, 'requests', reqId));
  if (!reqSnap.exists()) throw new Error('Request not found');
  const reqData = reqSnap.data() as any;
  const { activityId, siteId, supervisorId, taskId } = reqData;

  console.log('📊 [approveScopeRequest] Request data - activityId:', activityId, 'taskId:', taskId, 'siteId:', siteId);
  console.log('📊 [approveScopeRequest] Full request data:', JSON.stringify(reqData, null, 2));

  let activityDocId: string;
  let actData: any;
  
  const activityDocSnap = await getDoc(doc(db, 'activities', activityId));
  if (activityDocSnap.exists()) {
    console.log('📊 [approveScopeRequest] Found activity by direct ID lookup');
    activityDocId = activityDocSnap.id;
    actData = activityDocSnap.data();
  } else {
    console.log('📊 [approveScopeRequest] Direct lookup failed, trying query by activityId field');
    const activitiesQ = query(
      collection(db, 'activities'),
      where('activityId', '==', activityId),
      where('taskId', '==', taskId)
    );
    const actSnap = await getDocs(activitiesQ);
    if (actSnap.empty) {
      console.error('❌ [approveScopeRequest] Activity not found with activityId:', activityId, 'taskId:', taskId);
      throw new Error('Activity not found');
    }
    activityDocId = actSnap.docs[0].id;
    actData = actSnap.docs[0].data();
    console.log('📊 [approveScopeRequest] Found activity by query:', activityDocId);
  }
  
  console.log('📊 [approveScopeRequest] Current activity data - has canonical unit:', !!actData.unit?.canonical);

  const updatePayload: any = {
    scope: { value: scopeValue, unit, setBy: approverUserId, setAt: Timestamp.now() },
    scopeValue,
    scopeApproved: true,
    scopeEverSet: true,
    status: 'OPEN',
    unlockedFor: arrayUnion(supervisorId),
    updatedAt: Timestamp.now(),
  };

  if (!actData.unit || !actData.unit.canonical) {
    console.log('📊 [approveScopeRequest] Setting canonical unit to:', unit);
    updatePayload.unit = {
      canonical: unit,
      setBy: approverUserId,
      setAt: Timestamp.now(),
    };
  } else {
    console.log('📊 [approveScopeRequest] Canonical unit already set:', actData.unit.canonical);
  }

  console.log('🏴 [approveScopeRequest] Setting scopeEverSet = true - this Task Page will NEVER auto-request scope again');
  
  if (!netInfo.isConnected) {
    console.log('📴 [approveScopeRequest] Offline - queueing updates');
    
    await queueFirestoreOperation(
      { type: 'update', collection: 'activities', docId: activityDocId, data: updatePayload },
      { priority: 'P0', entityType: 'activityRequest' }
    );
    
    await queueFirestoreOperation(
      { type: 'update', collection: 'requests', docId: reqId, data: {
        status: 'APPROVED',
        updatedAt: Timestamp.now(),
        updatedBy: approverUserId,
        archived: true,
      }},
      { priority: 'P0', entityType: 'activityRequest' }
    );
    
    console.log('✅ [approveScopeRequest] Queued for sync when online');
  } else {
    const actRef = doc(db, 'activities', activityDocId);
    await updateDoc(actRef, updatePayload);
    console.log('✅ [approveScopeRequest] Activity updated successfully');

    await updateDoc(doc(db, 'requests', reqId), {
      status: 'APPROVED',
      updatedAt: Timestamp.now(),
      updatedBy: approverUserId,
      archived: true,
    } as any);
    
    console.log('✅ [approveScopeRequest] Complete (online) - canonical unit:', updatePayload.unit?.canonical || actData.unit?.canonical);
  }
}
