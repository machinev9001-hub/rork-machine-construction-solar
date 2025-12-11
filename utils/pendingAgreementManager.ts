import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  Timestamp, 
  updateDoc,
  deleteDoc 
} from 'firebase/firestore';
import { db } from '@/config/firebase';

export type AgreementStatus = 
  | 'pending_subcontractor_review' 
  | 'subcontractor_responded' 
  | 'admin_final_review' 
  | 'agreed' 
  | 'rejected';

export type PendingAgreement = {
  id: string;
  masterAccountId: string;
  siteId: string;
  subcontractorId: string;
  subcontractorName: string;
  assetId: string;
  assetType: string;
  plantNumber?: string;
  registrationNumber?: string;
  dateRange: {
    from: string;
    to: string;
  };
  
  originalTimesheetIds: string[];
  
  adminEditedVersion?: {
    hours: number;
    breakdown?: {
      normalHours: number;
      saturdayHours: number;
      sundayHours: number;
      publicHolidayHours: number;
      breakdownHours: number;
      rainDayHours: number;
      strikeDayHours: number;
    };
    notes?: string;
    editedBy: string;
    editedAt: Timestamp;
  };
  
  subcontractorSuggestedVersion?: {
    hours: number;
    breakdown?: {
      normalHours: number;
      saturdayHours: number;
      sundayHours: number;
      publicHolidayHours: number;
      breakdownHours: number;
      rainDayHours: number;
      strikeDayHours: number;
    };
    notes?: string;
    editedBy: string;
    editedAt: Timestamp;
  };
  
  status: AgreementStatus;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
  sentToSubcontractorAt?: Timestamp;
  subcontractorRespondedAt?: Timestamp;
  agreedAt?: Timestamp;
  agreedBy?: string;
  agreedTimesheetId?: string;
};

export async function createPendingAgreement(params: {
  masterAccountId: string;
  siteId: string;
  subcontractorId: string;
  subcontractorName: string;
  assetId: string;
  assetType: string;
  plantNumber?: string;
  registrationNumber?: string;
  dateRange: {
    from: string;
    to: string;
  };
  originalTimesheetIds: string[];
  adminEditedVersion?: {
    hours: number;
    breakdown?: {
      normalHours: number;
      saturdayHours: number;
      sundayHours: number;
      publicHolidayHours: number;
      breakdownHours: number;
      rainDayHours: number;
      strikeDayHours: number;
    };
    notes?: string;
    editedBy: string;
  };
}): Promise<string> {
  console.log('[pendingAgreementManager] Creating pending agreement:', params.assetId);

  const agreementRef = doc(collection(db, 'pendingAgreements'));
  const agreementId = agreementRef.id;

  const agreement: PendingAgreement = {
    id: agreementId,
    masterAccountId: params.masterAccountId,
    siteId: params.siteId,
    subcontractorId: params.subcontractorId,
    subcontractorName: params.subcontractorName,
    assetId: params.assetId,
    assetType: params.assetType,
    plantNumber: params.plantNumber,
    registrationNumber: params.registrationNumber,
    dateRange: params.dateRange,
    originalTimesheetIds: params.originalTimesheetIds,
    adminEditedVersion: params.adminEditedVersion ? {
      ...params.adminEditedVersion,
      editedAt: Timestamp.now(),
    } : undefined,
    status: 'pending_subcontractor_review',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    sentToSubcontractorAt: Timestamp.now(),
  };

  await setDoc(agreementRef, agreement);

  console.log('[pendingAgreementManager] Pending agreement created:', agreementId);
  return agreementId;
}

export async function updateSubcontractorResponse(
  agreementId: string,
  subcontractorVersion: {
    hours: number;
    breakdown?: {
      normalHours: number;
      saturdayHours: number;
      sundayHours: number;
      publicHolidayHours: number;
      breakdownHours: number;
      rainDayHours: number;
      strikeDayHours: number;
    };
    notes?: string;
    editedBy: string;
  }
): Promise<void> {
  console.log('[pendingAgreementManager] Updating subcontractor response:', agreementId);

  const agreementRef = doc(db, 'pendingAgreements', agreementId);
  
  await updateDoc(agreementRef, {
    subcontractorSuggestedVersion: {
      ...subcontractorVersion,
      editedAt: Timestamp.now(),
    },
    status: 'subcontractor_responded',
    subcontractorRespondedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  console.log('[pendingAgreementManager] Subcontractor response updated');
}

export async function acceptAgreement(
  agreementId: string,
  agreedBy: string,
  agreedTimesheetId: string
): Promise<void> {
  console.log('[pendingAgreementManager] Accepting agreement:', agreementId);

  const agreementRef = doc(db, 'pendingAgreements', agreementId);
  
  await updateDoc(agreementRef, {
    status: 'agreed',
    agreedAt: Timestamp.now(),
    agreedBy,
    agreedTimesheetId,
    updatedAt: Timestamp.now(),
  });

  console.log('[pendingAgreementManager] Agreement accepted');
}

export async function rejectAgreement(
  agreementId: string,
  reason?: string
): Promise<void> {
  console.log('[pendingAgreementManager] Rejecting agreement:', agreementId);

  const agreementRef = doc(db, 'pendingAgreements', agreementId);
  
  await updateDoc(agreementRef, {
    status: 'rejected',
    rejectionReason: reason,
    updatedAt: Timestamp.now(),
  });

  console.log('[pendingAgreementManager] Agreement rejected');
}

export async function getPendingAgreement(agreementId: string): Promise<PendingAgreement | null> {
  const agreementRef = doc(db, 'pendingAgreements', agreementId);
  const agreementSnap = await getDoc(agreementRef);

  if (!agreementSnap.exists()) {
    return null;
  }

  return { id: agreementSnap.id, ...agreementSnap.data() } as PendingAgreement;
}

export async function getPendingAgreementsBySubcontractor(
  subcontractorId: string,
  status?: AgreementStatus
): Promise<PendingAgreement[]> {
  console.log('[pendingAgreementManager] Fetching pending agreements for subcontractor:', subcontractorId);

  let agreementsQuery;
  
  if (status) {
    agreementsQuery = query(
      collection(db, 'pendingAgreements'),
      where('subcontractorId', '==', subcontractorId),
      where('status', '==', status),
      orderBy('createdAt', 'desc')
    );
  } else {
    agreementsQuery = query(
      collection(db, 'pendingAgreements'),
      where('subcontractorId', '==', subcontractorId),
      orderBy('createdAt', 'desc')
    );
  }

  const querySnapshot = await getDocs(agreementsQuery);
  const agreements: PendingAgreement[] = [];

  querySnapshot.forEach((doc) => {
    agreements.push({ id: doc.id, ...doc.data() } as PendingAgreement);
  });

  console.log('[pendingAgreementManager] Found agreements:', agreements.length);
  return agreements;
}

export async function getPendingAgreementsByMasterAccount(
  masterAccountId: string,
  status?: AgreementStatus
): Promise<PendingAgreement[]> {
  console.log('[pendingAgreementManager] Fetching pending agreements for master account:', masterAccountId);

  let agreementsQuery;
  
  if (status) {
    agreementsQuery = query(
      collection(db, 'pendingAgreements'),
      where('masterAccountId', '==', masterAccountId),
      where('status', '==', status),
      orderBy('createdAt', 'desc')
    );
  } else {
    agreementsQuery = query(
      collection(db, 'pendingAgreements'),
      where('masterAccountId', '==', masterAccountId),
      orderBy('createdAt', 'desc')
    );
  }

  const querySnapshot = await getDocs(agreementsQuery);
  const agreements: PendingAgreement[] = [];

  querySnapshot.forEach((doc) => {
    agreements.push({ id: doc.id, ...doc.data() } as PendingAgreement);
  });

  console.log('[pendingAgreementManager] Found agreements:', agreements.length);
  return agreements;
}

export async function getPendingAgreementByAsset(
  assetId: string,
  dateRange: { from: string; to: string }
): Promise<PendingAgreement | null> {
  console.log('[pendingAgreementManager] Checking for pending agreement:', assetId);

  const agreementsQuery = query(
    collection(db, 'pendingAgreements'),
    where('assetId', '==', assetId),
    where('dateRange.from', '==', dateRange.from),
    where('dateRange.to', '==', dateRange.to),
    where('status', 'in', ['pending_subcontractor_review', 'subcontractor_responded', 'admin_final_review'])
  );

  const querySnapshot = await getDocs(agreementsQuery);

  if (querySnapshot.empty) {
    return null;
  }

  const doc = querySnapshot.docs[0];
  return { id: doc.id, ...doc.data() } as PendingAgreement;
}

export async function deletePendingAgreement(agreementId: string): Promise<void> {
  console.log('[pendingAgreementManager] Deleting pending agreement:', agreementId);

  const agreementRef = doc(db, 'pendingAgreements', agreementId);
  await deleteDoc(agreementRef);

  console.log('[pendingAgreementManager] Pending agreement deleted');
}
