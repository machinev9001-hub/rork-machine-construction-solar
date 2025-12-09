import { doc, updateDoc, Timestamp, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';

export type MonthlyArchive = {
  year: number;
  month: number;
  count: number;
  requestIds: string[];
};

export async function restoreRequest(requestId: string, userId: string): Promise<void> {
  console.log('🔄 Restoring request:', requestId);
  
  const requestRef = doc(db, 'requests', requestId);
  await updateDoc(requestRef, {
    archived: false,
    archivedAt: null,
    status: 'PENDING',
    restoredAt: Timestamp.now(),
    restoredBy: userId,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
    monthlyArchive: null,
  });
  
  console.log('✅ Request restored successfully with status reset to PENDING');
}

export async function archiveRequestsByMonth(
  siteId: string,
  requestType: string,
  userId: string
): Promise<{ archived: number; byMonth: MonthlyArchive[] }> {
  console.log('📦 Starting monthly archive cleanup for:', requestType, 'at site:', siteId);
  
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  
  const requestsRef = collection(db, 'requests');
  const q = query(
    requestsRef,
    where('type', '==', requestType),
    where('siteId', '==', siteId),
    where('archived', '==', true)
  );
  
  const snapshot = await getDocs(q);
  console.log('📦 Found', snapshot.docs.length, 'archived requests to organize');
  
  const archivesByMonth: Record<string, MonthlyArchive> = {};
  const batch = writeBatch(db);
  let updateCount = 0;
  
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    
    const archivedAt = data.archivedAt || data.updatedAt || data.createdAt;
    if (!archivedAt) {
      console.log('⚠️ Skipping request without timestamp:', docSnap.id);
      continue;
    }
    
    const archiveDate = archivedAt.toDate();
    const archiveMonth = archiveDate.getMonth();
    const archiveYear = archiveDate.getFullYear();
    
    if (archiveYear === currentYear && archiveMonth === currentMonth) {
      console.log('⏭️ Skipping current month request:', docSnap.id);
      continue;
    }
    
    if (data.monthlyArchive) {
      console.log('✓ Request already organized:', docSnap.id);
      continue;
    }
    
    const monthKey = `${archiveYear}-${archiveMonth}`;
    
    if (!archivesByMonth[monthKey]) {
      archivesByMonth[monthKey] = {
        year: archiveYear,
        month: archiveMonth,
        count: 0,
        requestIds: [],
      };
    }
    
    archivesByMonth[monthKey].count++;
    archivesByMonth[monthKey].requestIds.push(docSnap.id);
    
    batch.update(docSnap.ref, {
      monthlyArchive: {
        year: archiveYear,
        month: archiveMonth,
        organizedAt: Timestamp.now(),
        organizedBy: userId,
      },
      updatedAt: Timestamp.now(),
    });
    
    updateCount++;
    
    if (updateCount % 400 === 0) {
      console.log('📦 Committing batch at', updateCount, 'requests...');
      await batch.commit();
    }
  }
  
  if (updateCount % 400 !== 0) {
    await batch.commit();
  }
  
  const monthlyArchives = Object.values(archivesByMonth);
  console.log('✅ Monthly archive complete:', updateCount, 'requests organized into', monthlyArchives.length, 'months');
  
  return {
    archived: updateCount,
    byMonth: monthlyArchives,
  };
}

export function getMonthLabel(month: number, year: number): string {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${monthNames[month]} ${year}`;
}

export function groupRequestsByMonth<T extends { 
  archived?: boolean; 
  archivedAt?: Timestamp; 
  updatedAt?: Timestamp; 
  createdAt?: Timestamp;
  monthlyArchive?: { year: number; month: number };
}>(requests: T[]): Record<string, { year: number; month: number; requests: T[] }> {
  const grouped: Record<string, { year: number; month: number; requests: T[] }> = {};
  
  for (const request of requests) {
    if (!request.archived) continue;
    
    let year: number;
    let month: number;
    
    if (request.monthlyArchive) {
      year = request.monthlyArchive.year;
      month = request.monthlyArchive.month;
    } else {
      const timestamp = request.archivedAt || request.updatedAt || request.createdAt;
      if (!timestamp) continue;
      
      const date = timestamp.toDate();
      year = date.getFullYear();
      month = date.getMonth();
    }
    
    const key = `${year}-${month}`;
    
    if (!grouped[key]) {
      grouped[key] = { year, month, requests: [] };
    }
    
    grouped[key].requests.push(request);
  }
  
  return grouped;
}
