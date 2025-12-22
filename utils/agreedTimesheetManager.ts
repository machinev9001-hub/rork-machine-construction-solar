import { collection, doc, setDoc, getDoc, getDocs, query, where, Timestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { AgreedTimesheet, OperatorTimesheet, PlantAssetTimesheet } from '@/types';

type CreateAgreedTimesheetParams = {
  originalTimesheetId: string;
  timesheetType: 'operator' | 'plant_asset';
  date: string;
  operatorId?: string;
  operatorName?: string;
  assetId?: string;
  assetType?: string;
  originalHours: number;
  agreedHours: number;
  originalNotes?: string;
  adminNotes?: string;
  siteId?: string;
  siteName?: string;
  masterAccountId: string;
  companyId?: string;
  subcontractorId?: string;
  subcontractorName?: string;
  agreedBy: string;
  agreedByRole?: 'Operator' | 'Plant Manager' | 'Admin';
  agreedNormalHours?: number;
  agreedOvertimeHours?: number;
  agreedSundayHours?: number;
  agreedPublicHolidayHours?: number;
  originalNormalHours?: number;
  originalOvertimeHours?: number;
  originalSundayHours?: number;
  originalPublicHolidayHours?: number;
  originalOpenHours?: number;
  originalCloseHours?: number;
};

export async function createAgreedTimesheet(params: CreateAgreedTimesheetParams): Promise<string> {
  console.log('[agreedTimesheetManager] Creating agreed timesheet:', params);

  const agreedTimesheetRef = doc(collection(db, 'agreedTimesheets'));
  const agreedTimesheetId = agreedTimesheetRef.id;

  const hoursDifference = params.agreedHours - params.originalHours;

  const agreedTimesheet: AgreedTimesheet = {
    id: agreedTimesheetId,
    originalTimesheetId: params.originalTimesheetId,
    timesheetType: params.timesheetType,
    date: params.date,
    operatorId: params.operatorId,
    operatorName: params.operatorName,
    assetId: params.assetId,
    assetType: params.assetType,
    originalHours: params.originalHours,
    agreedHours: params.agreedHours,
    hoursDifference,
    originalNotes: params.originalNotes,
    adminNotes: params.adminNotes,
    siteId: params.siteId,
    siteName: params.siteName,
    masterAccountId: params.masterAccountId,
    companyId: params.companyId,
    subcontractorId: params.subcontractorId,
    subcontractorName: params.subcontractorName,
    originalOpenHours: params.originalOpenHours,
    originalCloseHours: params.originalCloseHours,
    status: 'approved_for_billing',
    agreedAt: Timestamp.now(),
    agreedBy: params.agreedBy,
    agreedByRole: params.agreedByRole,
    approvedForBillingAt: Timestamp.now(),
    approvedForBillingBy: params.agreedBy,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  await setDoc(agreedTimesheetRef, agreedTimesheet);

  console.log('[agreedTimesheetManager] Agreed timesheet created:', agreedTimesheetId);
  return agreedTimesheetId;
}

export async function updateAgreedTimesheet(
  agreedTimesheetId: string,
  updates: Partial<AgreedTimesheet>
): Promise<void> {
  console.log('[agreedTimesheetManager] Updating agreed timesheet:', agreedTimesheetId);

  const agreedTimesheetRef = doc(db, 'agreedTimesheets', agreedTimesheetId);
  
  await updateDoc(agreedTimesheetRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });

  console.log('[agreedTimesheetManager] Agreed timesheet updated');
}

export async function getAgreedTimesheet(agreedTimesheetId: string): Promise<AgreedTimesheet | null> {
  const agreedTimesheetRef = doc(db, 'agreedTimesheets', agreedTimesheetId);
  const agreedTimesheetSnap = await getDoc(agreedTimesheetRef);

  if (!agreedTimesheetSnap.exists()) {
    return null;
  }

  return { id: agreedTimesheetSnap.id, ...agreedTimesheetSnap.data() } as AgreedTimesheet;
}

export async function getAgreedTimesheetsByDateRange(
  masterAccountId: string,
  startDate: string,
  endDate: string
): Promise<AgreedTimesheet[]> {
  console.log('[agreedTimesheetManager] Fetching agreed timesheets:', { masterAccountId, startDate, endDate });

  const agreedTimesheetsQuery = query(
    collection(db, 'agreedTimesheets'),
    where('masterAccountId', '==', masterAccountId),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    where('status', '==', 'approved_for_billing')
  );

  const querySnapshot = await getDocs(agreedTimesheetsQuery);
  const agreedTimesheets: AgreedTimesheet[] = [];

  querySnapshot.forEach((doc) => {
    agreedTimesheets.push({ id: doc.id, ...doc.data() } as AgreedTimesheet);
  });

  console.log('[agreedTimesheetManager] Found agreed timesheets:', agreedTimesheets.length);
  return agreedTimesheets;
}

export async function getAgreedTimesheetByOriginalId(originalTimesheetId: string): Promise<AgreedTimesheet | null> {
  console.log('[agreedTimesheetManager] Checking if agreed timesheet exists for:', originalTimesheetId);

  const agreedTimesheetsQuery = query(
    collection(db, 'agreedTimesheets'),
    where('originalTimesheetId', '==', originalTimesheetId)
  );

  const querySnapshot = await getDocs(agreedTimesheetsQuery);

  if (querySnapshot.empty) {
    return null;
  }

  const doc = querySnapshot.docs[0];
  return { id: doc.id, ...doc.data() } as AgreedTimesheet;
}

export async function deleteAgreedTimesheet(agreedTimesheetId: string): Promise<void> {
  console.log('[agreedTimesheetManager] Deleting agreed timesheet:', agreedTimesheetId);

  const agreedTimesheetRef = doc(db, 'agreedTimesheets', agreedTimesheetId);
  await deleteDoc(agreedTimesheetRef);

  console.log('[agreedTimesheetManager] Agreed timesheet deleted');
}

export async function agreeOperatorTimesheet(
  originalTimesheet: OperatorTimesheet,
  agreedData: {
    agreedNormalHours?: number;
    agreedOvertimeHours?: number;
    agreedSundayHours?: number;
    agreedPublicHolidayHours?: number;
    agreedNotes?: string;
  },
  agreedBy: string
): Promise<string> {
  console.log('[agreedTimesheetManager] Creating agreed operator timesheet:', originalTimesheet.id);

  const totalAgreedHours = 
    (agreedData.agreedNormalHours || 0) +
    (agreedData.agreedOvertimeHours || 0) +
    (agreedData.agreedSundayHours || 0) +
    (agreedData.agreedPublicHolidayHours || 0);

  const params: CreateAgreedTimesheetParams = {
    originalTimesheetId: originalTimesheet.id!,
    timesheetType: 'operator',
    date: originalTimesheet.date,
    operatorId: originalTimesheet.operatorId,
    operatorName: originalTimesheet.operatorName,
    originalHours: originalTimesheet.totalManHours || 0,
    agreedHours: totalAgreedHours,
    originalNotes: originalTimesheet.notes,
    adminNotes: agreedData.agreedNotes,
    siteId: originalTimesheet.siteId,
    siteName: originalTimesheet.siteName,
    masterAccountId: originalTimesheet.masterAccountId,
    companyId: originalTimesheet.companyId,
    agreedBy,
    agreedNormalHours: agreedData.agreedNormalHours,
    agreedOvertimeHours: agreedData.agreedOvertimeHours,
    agreedSundayHours: agreedData.agreedSundayHours,
    agreedPublicHolidayHours: agreedData.agreedPublicHolidayHours,
    originalNormalHours: originalTimesheet.normalHours,
    originalOvertimeHours: originalTimesheet.overtimeHours,
    originalSundayHours: originalTimesheet.sundayHours,
    originalPublicHolidayHours: originalTimesheet.publicHolidayHours,
  };

  const agreedTimesheetId = await createAgreedTimesheet(params);

  await updateDoc(doc(db, 'operatorTimesheets', originalTimesheet.id!), {
    agreedNormalHours: agreedData.agreedNormalHours,
    agreedOvertimeHours: agreedData.agreedOvertimeHours,
    agreedSundayHours: agreedData.agreedSundayHours,
    agreedPublicHolidayHours: agreedData.agreedPublicHolidayHours,
    agreedNotes: agreedData.agreedNotes,
    hasAgreedHours: true,
    agreedTimesheetId,
    updatedAt: Timestamp.now(),
  });

  console.log('[agreedTimesheetManager] Operator timesheet agreed:', agreedTimesheetId);
  return agreedTimesheetId;
}

export async function agreePlantAssetTimesheet(
  originalTimesheet: PlantAssetTimesheet,
  agreedData: {
    agreedHours?: number;
    agreedNotes?: string;
  },
  agreedBy: string,
  approvalType?: 'digital' | 'admin_direct',
  agreedByRole?: 'Operator' | 'Plant Manager' | 'Admin'
): Promise<string> {
  console.log('[agreedTimesheetManager] Creating agreed plant asset timesheet:', originalTimesheet.id, 'type:', approvalType || 'digital', 'role:', agreedByRole || 'Admin');
  console.log('[agreedTimesheetManager] Original meter readings - open:', originalTimesheet.openHours, 'close:', originalTimesheet.closeHours);

  const params: CreateAgreedTimesheetParams = {
    originalTimesheetId: originalTimesheet.id!,
    timesheetType: 'plant_asset',
    date: originalTimesheet.date,
    assetId: originalTimesheet.assetId,
    assetType: 'Plant Asset',
    operatorId: originalTimesheet.operatorId,
    operatorName: originalTimesheet.operatorName,
    originalHours: originalTimesheet.totalHours || 0,
    agreedHours: agreedData.agreedHours!,
    originalNotes: originalTimesheet.notes,
    adminNotes: agreedData.agreedNotes,
    siteId: originalTimesheet.siteId,
    siteName: originalTimesheet.siteName,
    masterAccountId: originalTimesheet.masterAccountId,
    companyId: originalTimesheet.companyId,
    agreedBy,
    agreedByRole: agreedByRole || 'Admin',
    originalOpenHours: originalTimesheet.openHours,
    originalCloseHours: originalTimesheet.closeHours,
  };

  const agreedTimesheetId = await createAgreedTimesheet(params);

  await updateDoc(doc(db, 'plantAssetTimesheets', originalTimesheet.id!), {
    agreedHours: agreedData.agreedHours,
    agreedNotes: agreedData.agreedNotes,
    hasAgreedHours: true,
    agreedTimesheetId,
    approvalType: approvalType || 'digital',
    updatedAt: Timestamp.now(),
  });

  console.log('[agreedTimesheetManager] Plant asset timesheet agreed:', agreedTimesheetId);
  return agreedTimesheetId;
}

export async function directApproveEPHTimesheets(
  timesheets: PlantAssetTimesheet[],
  agreedBy: string,
  adminNotes?: string,
  agreedByRole?: 'Operator' | 'Plant Manager' | 'Admin'
): Promise<string[]> {
  console.log('[agreedTimesheetManager] Direct approving', timesheets.length, 'timesheets', 'role:', agreedByRole || 'Admin');
  
  const agreedIds: string[] = [];
  
  for (const timesheet of timesheets) {
    const agreedId = await agreePlantAssetTimesheet(
      timesheet,
      {
        agreedHours: timesheet.totalHours,
        agreedNotes: adminNotes,
      },
      agreedBy,
      'admin_direct',
      agreedByRole || 'Admin'
    );
    agreedIds.push(agreedId);
  }
  
  console.log('[agreedTimesheetManager] Direct approved', agreedIds.length, 'timesheets');
  return agreedIds;
}
