import { doc, getDocs, query, collection, where, updateDoc, Timestamp, setDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';

export type LockType = 'QC_INTERACTION' | 'TIME_LOCK';

export async function lockCompletedToday(params: {
  taskId: string;
  activityId: string;
  lockType: LockType;
  lockedValue: number;
  lockedUnit: string;
  qcApprovedValue?: number;
  qcApprovedUnit?: string;
}) {
  const { taskId, activityId, lockType, lockedValue, lockedUnit, qcApprovedValue, qcApprovedUnit } = params;
  
  console.log('🔒 [lockCompletedToday] Locking completedToday - taskId:', taskId, 'activityId:', activityId, 'type:', lockType);
  
  const activitiesRef = collection(db, 'activities');
  const activityQuery = query(
    activitiesRef,
    where('taskId', '==', taskId),
    where('activityId', '==', activityId)
  );
  const activitySnapshot = await getDocs(activityQuery);
  
  if (activitySnapshot.empty) {
    console.error('❌ [lockCompletedToday] Activity not found');
    throw new Error('Activity not found');
  }
  
  const activityDocId = activitySnapshot.docs[0].id;
  const now = Timestamp.now();
  const lockDate = new Date().toISOString().split('T')[0];
  
  const updatePayload: any = {
    'completedTodayLock.isLocked': true,
    'completedTodayLock.lockType': lockType,
    'completedTodayLock.lockedAt': now,
    'completedTodayLock.lockedValue': lockedValue,
    'completedTodayLock.lockedUnit': lockedUnit,
    'completedTodayLock.lockDate': lockDate,
    updatedAt: now,
  };
  
  if (qcApprovedValue !== undefined) {
    updatePayload['completedTodayLock.qcApprovedValue'] = qcApprovedValue;
  }
  if (qcApprovedUnit !== undefined) {
    updatePayload['completedTodayLock.qcApprovedUnit'] = qcApprovedUnit;
  }
  
  await updateDoc(doc(db, 'activities', activityDocId), updatePayload);
  
  console.log('✅ [lockCompletedToday] Locked successfully - value:', lockedValue, 'unit:', lockedUnit);
}

export async function checkAndApplyTimeLock(params: {
  taskId: string;
  activityId: string;
  currentValue: number;
  currentUnit: string;
}) {
  const { taskId, activityId, currentValue, currentUnit } = params;
  
  console.log('⏰ [checkAndApplyTimeLock] Checking time lock for activity:', activityId);
  
  const activitiesRef = collection(db, 'activities');
  const activityQuery = query(
    activitiesRef,
    where('taskId', '==', taskId),
    where('activityId', '==', activityId)
  );
  const activitySnapshot = await getDocs(activityQuery);
  
  if (activitySnapshot.empty) {
    console.error('❌ [checkAndApplyTimeLock] Activity not found');
    return;
  }
  
  const activityData = activitySnapshot.docs[0].data();
  
  if (activityData.completedTodayLock?.isLocked) {
    console.log('ℹ️ [checkAndApplyTimeLock] Already locked, skipping');
    return;
  }
  
  const qcHasInteracted = activityData.qc?.status === 'completed';
  
  if (qcHasInteracted) {
    console.log('⚠️ [checkAndApplyTimeLock] QC has completed - QC lock should have been applied already!');
    return;
  }
  
  const now = new Date();
  const currentHour = now.getHours();
  
  const currentMinutes = now.getMinutes();
  const timeInMinutes = currentHour * 60 + currentMinutes;
  const lockTimeInMinutes = 23 * 60 + 55;
  
  if (timeInMinutes >= lockTimeInMinutes) {
    console.log('🔒 [checkAndApplyTimeLock] Time lock condition met (23:55 passed), applying lock');
    await lockCompletedToday({
      taskId,
      activityId,
      lockType: 'TIME_LOCK',
      lockedValue: currentValue,
      lockedUnit: currentUnit,
    });
  } else {
    console.log('ℹ️ [checkAndApplyTimeLock] Not yet 23:55, no lock applied');
  }
}

export async function isCompletedTodayLocked(params: {
  taskId: string;
  activityId: string;
}): Promise<boolean> {
  const { taskId, activityId } = params;
  
  const activitiesRef = collection(db, 'activities');
  const activityQuery = query(
    activitiesRef,
    where('taskId', '==', taskId),
    where('activityId', '==', activityId)
  );
  const activitySnapshot = await getDocs(activityQuery);
  
  if (activitySnapshot.empty) {
    return false;
  }
  
  const activityData = activitySnapshot.docs[0].data();
  
  const qcCompleted = activityData.qc?.status === 'completed';
  if (qcCompleted && !activityData.completedTodayLock?.isLocked) {
    console.log('⚠️ [isCompletedTodayLocked] QC completed but lock not applied - treating as locked');
    return true;
  }
  
  return activityData.completedTodayLock?.isLocked === true;
}

export async function isQCToggleLocked(params: {
  taskId: string;
  activityId: string;
}): Promise<boolean> {
  const { taskId, activityId } = params;
  
  console.log('🔍 [isQCToggleLocked] Checking if QC toggle is locked for activity:', activityId);
  
  const activitiesRef = collection(db, 'activities');
  const activityQuery = query(
    activitiesRef,
    where('taskId', '==', taskId),
    where('activityId', '==', activityId)
  );
  const activitySnapshot = await getDocs(activityQuery);
  
  if (activitySnapshot.empty) {
    console.log('⚠️ [isQCToggleLocked] Activity not found - toggle not locked');
    return false;
  }
  
  const activityData = activitySnapshot.docs[0].data();
  const today = new Date().toISOString().split('T')[0];
  const lockDate = activityData.completedTodayLock?.lockDate;
  const lockType = activityData.completedTodayLock?.lockType;
  const isLocked = activityData.completedTodayLock?.isLocked;
  
  if (isLocked && lockType === 'QC_INTERACTION' && lockDate === today) {
    console.log('🔒 [isQCToggleLocked] QC toggle is LOCKED - QC completed today');
    return true;
  }
  
  console.log('✅ [isQCToggleLocked] QC toggle is UNLOCKED');
  return false;
}

export async function checkAndUnlockNewDay(params: {
  taskId: string;
  activityId: string;
}) {
  const { taskId, activityId } = params;
  
  console.log('🔓 [checkAndUnlockNewDay] Checking if unlock is needed for activity:', activityId);
  
  const activitiesRef = collection(db, 'activities');
  const activityQuery = query(
    activitiesRef,
    where('taskId', '==', taskId),
    where('activityId', '==', activityId)
  );
  const activitySnapshot = await getDocs(activityQuery);
  
  if (activitySnapshot.empty) {
    console.error('❌ [checkAndUnlockNewDay] Activity not found');
    return;
  }
  
  const activityData = activitySnapshot.docs[0].data();
  const activityDocId = activitySnapshot.docs[0].id;
  
  if (!activityData.completedTodayLock?.isLocked) {
    console.log('ℹ️ [checkAndUnlockNewDay] Not locked, no unlock needed');
    return;
  }
  
  const lockDate = activityData.completedTodayLock?.lockDate;
  if (!lockDate) {
    console.log('⚠️ [checkAndUnlockNewDay] No lock date found, skipping unlock');
    return;
  }
  
  const today = new Date().toISOString().split('T')[0];
  
  console.log('🔍 [checkAndUnlockNewDay] Comparing dates - lockDate:', lockDate, 'today:', today, 'are different:', lockDate !== today);
  
  if (lockDate !== today) {
    console.log('🔓 [checkAndUnlockNewDay] New day detected! Unlocking...');
    console.log('   Lock date:', lockDate);
    console.log('   Today:', today);
    
    const completedValue = activityData.completedTodayLock?.lockedValue || activityData.completedToday || 0;
    const unit = activityData.completedTodayLock?.lockedUnit || activityData.completedTodayUnit || activityData.unit?.canonical || 'm';
    const scopeValue = activityData.scopeValue || 0;
    const scopeApproved = activityData.scopeApproved || false;
    
    let percentage = '—';
    if (scopeApproved && scopeValue > 0) {
      percentage = ((completedValue / scopeValue) * 100).toFixed(2);
    }

    const historySoFar = await getDocs(
      collection(db, 'activities', activityDocId, 'history')
    );
    const historicalCompletedSum = historySoFar.docs.reduce((sum, doc) => {
      const histData = doc.data();
      return sum + (histData.completedValue || 0);
    }, 0);

    const newTotalCompleted = historicalCompletedSum + completedValue;
    let unverifiedPercentage = '—';
    if (scopeApproved && scopeValue > 0) {
      unverifiedPercentage = ((newTotalCompleted / scopeValue) * 100).toFixed(2);
    }

    console.log('📊 [checkAndUnlockNewDay] Calculating unverified %...');
    console.log('   Historical sum:', historicalCompletedSum, unit);
    console.log('   Today locked value:', completedValue, unit);
    console.log('   New total completed:', newTotalCompleted, unit);
    console.log('   Scope:', scopeValue, unit);
    console.log('   Unverified %:', unverifiedPercentage);
    
    console.log('📸 [checkAndUnlockNewDay] Creating history snapshot for date:', lockDate);
    console.log('   Completed value:', completedValue, unit);
    console.log('   Percentage:', percentage);
    
    const historyData = {
      date: lockDate,
      completedValue: completedValue,
      unit: unit,
      percentage: percentage,
      unverifiedPercentage: unverifiedPercentage,
      cumulativeCompleted: newTotalCompleted,
      scopeValue: scopeValue,
      scopeApproved: scopeApproved,
      qcStatus: activityData.qc?.status || 'not_requested',
      materialToggle: activityData.materialToggle || false,
      plantToggle: activityData.plantToggle || false,
      workersToggle: activityData.workersToggle || false,
      lockType: activityData.completedTodayLock?.lockType || 'TIME_LOCK',
      lockedAt: activityData.completedTodayLock?.lockedAt || Timestamp.now(),
      createdAt: Timestamp.now(),
    };
    
    try {
      await setDoc(
        doc(db, 'activities', activityDocId, 'history', lockDate),
        historyData
      );
      console.log('✅ [checkAndUnlockNewDay] History snapshot created successfully');
    } catch (error) {
      console.error('❌ [checkAndUnlockNewDay] Failed to create history snapshot:', error);
    }
    
    console.log('🔓 [checkAndUnlockNewDay] Unlocking activity and resetting for new day');
    console.log('   ⚠️ QC Status will be reset (qc.status = not_requested)');
    console.log('   ✅ QC Value (qcValue) will be PRESERVED in the activity');
    console.log('   ✅ QC accumulated value remains:', activityData.qcValue || 0);
    
    const wasQcCompleted = activityData.completedTodayLock?.lockType === 'QC_INTERACTION';
    if (wasQcCompleted) {
      console.log('   🔓 QC completed yesterday - QC toggle (qcRequested) will be UNLOCKED for new day');
    } else {
      console.log('   ⚠️ QC toggle was not used yesterday - already unlocked');
    }
    
    try {
      await updateDoc(doc(db, 'activities', activityDocId), {
        'completedTodayLock.isLocked': false,
        'completedTodayLock.lockType': null,
        'completedTodayLock.lockedAt': null,
        'completedTodayLock.lockedValue': null,
        'completedTodayLock.lockedUnit': null,
        'completedTodayLock.lockDate': null,
        'qc.status': 'not_requested',
        qcRequested: false,
        completedToday: 0,
        cumulativeCompleted: newTotalCompleted,
        unverifiedPercentage: unverifiedPercentage,
        updatedAt: Timestamp.now(),
      });
      
      console.log('✅ [checkAndUnlockNewDay] Unlocked successfully for new day');
      console.log('   ✅ completedTodayLock.isLocked set to FALSE');
      console.log('   ✅ qc.status set to "not_requested"');
      console.log('   ✅ qcRequested set to false');
      console.log('   ✅ completedToday reset to 0');
    } catch (unlockError) {
      console.error('❌ [checkAndUnlockNewDay] FAILED to unlock activity:', unlockError);
      throw unlockError;
    }
  } else {
    console.log('ℹ️ [checkAndUnlockNewDay] Same day, no unlock needed');
  }
}
