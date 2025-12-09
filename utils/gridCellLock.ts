import { doc, getDocs, query, collection, where, writeBatch, Timestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';

export async function checkAndLockGridCells(params: {
  activityId: string;
  taskId: string;
  siteId: string;
}): Promise<void> {
  const { activityId, taskId, siteId } = params;
  
  console.log('🔒 [checkAndLockGridCells] Checking time lock for grid cells...');
  console.log('  Activity ID:', activityId);
  console.log('  Task ID:', taskId);
  console.log('  Site ID:', siteId);
  
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();
  const timeInMinutes = currentHour * 60 + currentMinutes;
  const lockTimeInMinutes = 12 * 60;
  
  if (timeInMinutes < lockTimeInMinutes) {
    console.log('ℹ️ [checkAndLockGridCells] Not yet 12:00 PM, no lock applied');
    return;
  }
  
  console.log('🔒 [checkAndLockGridCells] Time lock condition met (12:00 PM passed), checking cells...');
  
  const progressRef = collection(db, 'gridCellProgress');
  const q = query(
    progressRef,
    where('activityId', '==', activityId),
    where('taskId', '==', taskId),
    where('siteId', '==', siteId),
    where('status', '==', 'completed')
  );
  
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    console.log('ℹ️ [checkAndLockGridCells] No completed cells to lock');
    return;
  }
  
  const today = new Date().toISOString().split('T')[0];
  const batch = writeBatch(db);
  let cellsToLock = 0;
  
  snapshot.docs.forEach(docSnap => {
    const cellData = docSnap.data();
    
    if (cellData.lockedAt || cellData.isLocked) {
      console.log('  Cell', cellData.column, '-', cellData.row, 'already locked permanently');
      return;
    }
    

    
    console.log('  🔒 Locking cell:', cellData.column, '-', cellData.row);
    batch.update(doc(db, 'gridCellProgress', docSnap.id), {
      lockedAt: Timestamp.now(),
      lockDate: today,
      lockType: 'TIME_LOCK',
      isLocked: true,
    });
    cellsToLock++;
  });
  
  if (cellsToLock > 0) {
    await batch.commit();
    console.log('✅ [checkAndLockGridCells] Locked', cellsToLock, 'cells successfully');
  } else {
    console.log('ℹ️ [checkAndLockGridCells] No cells needed locking');
  }
}

export async function isGridCellLocked(params: {
  activityId: string;
  taskId: string;
  siteId: string;
  column: string;
  row: string;
}): Promise<boolean> {
  const { activityId, taskId, siteId, column, row } = params;
  
  const progressRef = collection(db, 'gridCellProgress');
  const q = query(
    progressRef,
    where('activityId', '==', activityId),
    where('taskId', '==', taskId),
    where('siteId', '==', siteId),
    where('column', '==', column),
    where('row', '==', row)
  );
  
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    return false;
  }
  
  const cellData = snapshot.docs[0].data();
  
  if (cellData.isLocked) {
    console.log('🔒 [isGridCellLocked] Cell is PERMANENTLY LOCKED');
    return true;
  }
  
  return false;
}

export async function checkAndUnlockGridCellsNewDay(params: {
  activityId: string;
  taskId: string;
  siteId: string;
}): Promise<void> {
  console.log('ℹ️ [checkAndUnlockGridCellsNewDay] Locked cells NEVER unlock - they remain permanently locked');
}
