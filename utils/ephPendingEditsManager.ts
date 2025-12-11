import { collection, doc, setDoc, getDocs, query, where, updateDoc, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/config/firebase';

export type EPHPendingEdit = {
  id: string;
  originalTimesheetId: string;
  assetId: string;
  assetType: string;
  plantNumber?: string;
  date: string;
  editedBy: 'admin' | 'subcontractor';
  editedByUserId: string;
  editedByName: string;
  
  totalHours: number;
  openHours: string;
  closeHours: string;
  isBreakdown: boolean;
  isRainDay: boolean;
  isStrikeDay: boolean;
  isPublicHoliday: boolean;
  notes: string;
  
  originalTotalHours: number;
  originalOpenHours: string;
  originalCloseHours: string;
  
  status: 'pending_review' | 'reviewed' | 'superseded';
  reviewedBy?: string;
  reviewedAt?: Timestamp;
  
  masterAccountId: string;
  siteId: string;
  subcontractorId: string;
  subcontractorName: string;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export async function createPendingEdit(params: {
  originalTimesheetId: string;
  assetId: string;
  assetType: string;
  plantNumber?: string;
  date: string;
  editedBy: 'admin' | 'subcontractor';
  editedByUserId: string;
  editedByName: string;
  totalHours: number;
  openHours: string;
  closeHours: string;
  isBreakdown: boolean;
  isRainDay: boolean;
  isStrikeDay: boolean;
  isPublicHoliday: boolean;
  notes: string;
  originalTotalHours: number;
  originalOpenHours: string;
  originalCloseHours: string;
  masterAccountId: string;
  siteId: string;
  subcontractorId: string;
  subcontractorName: string;
}): Promise<string> {
  console.log('[ephPendingEditsManager] Creating pending edit for asset:', params.assetId);
  
  const existingEdits = await getPendingEditsByAsset(params.assetId, params.date, params.masterAccountId);
  for (const edit of existingEdits) {
    await supersedePendingEdit(edit.id);
  }
  
  const editRef = doc(collection(db, 'ephPendingEdits'));
  const editId = editRef.id;
  
  const editData: EPHPendingEdit = {
    ...params,
    id: editId,
    status: 'pending_review',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  await setDoc(editRef, editData);
  
  console.log('[ephPendingEditsManager] Pending edit created:', editId);
  return editId;
}

export async function getPendingEditsByAsset(
  assetId: string,
  date: string,
  masterAccountId: string
): Promise<EPHPendingEdit[]> {
  console.log('[ephPendingEditsManager] Fetching pending edits for asset:', assetId, 'date:', date);
  
  const q = query(
    collection(db, 'ephPendingEdits'),
    where('assetId', '==', assetId),
    where('date', '==', date),
    where('masterAccountId', '==', masterAccountId),
    where('status', '==', 'pending_review'),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  const edits = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as EPHPendingEdit);
  
  console.log('[ephPendingEditsManager] Found pending edits:', edits.length);
  return edits;
}

export async function getAllPendingEditsByAssetId(
  assetId: string,
  masterAccountId: string
): Promise<EPHPendingEdit[]> {
  console.log('[ephPendingEditsManager] Fetching all pending edits for asset:', assetId);
  
  const q = query(
    collection(db, 'ephPendingEdits'),
    where('assetId', '==', assetId),
    where('masterAccountId', '==', masterAccountId),
    where('status', '==', 'pending_review'),
    orderBy('date', 'desc')
  );
  
  const snapshot = await getDocs(q);
  const edits = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as EPHPendingEdit);
  
  console.log('[ephPendingEditsManager] Found pending edits:', edits.length);
  return edits;
}

export async function supersedePendingEdit(editId: string): Promise<void> {
  console.log('[ephPendingEditsManager] Superseding pending edit:', editId);
  
  await updateDoc(doc(db, 'ephPendingEdits', editId), {
    status: 'superseded',
    updatedAt: Timestamp.now(),
  });
  
  console.log('[ephPendingEditsManager] Pending edit superseded');
}

export async function reviewPendingEdit(editId: string, reviewedBy: string): Promise<void> {
  console.log('[ephPendingEditsManager] Reviewing pending edit:', editId);
  
  await updateDoc(doc(db, 'ephPendingEdits', editId), {
    status: 'reviewed',
    reviewedBy,
    reviewedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  
  console.log('[ephPendingEditsManager] Pending edit reviewed');
}
