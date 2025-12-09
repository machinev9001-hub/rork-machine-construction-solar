import { collection, query, where, getDocs, addDoc, Timestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/config/firebase';

export type PlantAllocationNotificationConfig = {
  siteId: string;
  checkIntervalMinutes?: number;
};

export async function checkScheduledPlantAllocations(config: PlantAllocationNotificationConfig): Promise<number> {
  const { siteId } = config;
  
  try {
    console.log('🔔 ==================== PLANT ALLOCATION NOTIFICATION CHECK ====================');
    console.log('🔔 Checking for due plant allocation requests...');
    console.log('🔔 SiteId:', siteId);
    console.log('🔔 Current time:', new Date().toISOString());

    const requestsRef = collection(db, 'requests');
    const q = query(
      requestsRef,
      where('type', '==', 'PLANT_ALLOCATION_REQUEST'),
      where('siteId', '==', siteId),
      where('status', '==', 'scheduled'),
      where('archived', '==', false)
    );

    const snapshot = await getDocs(q);
    console.log('🔔 Found', snapshot.size, 'scheduled requests');

    const now = new Date();
    let notificationsSent = 0;

    for (const docSnap of snapshot.docs) {
      const requestData = docSnap.data();
      const scheduledDate = requestData.scheduledDeliveryDate?.toDate();

      if (!scheduledDate) {
        console.log('⚠️ Request', docSnap.id, 'has no scheduled date');
        continue;
      }

      const twoHoursBefore = new Date(scheduledDate.getTime() - (2 * 60 * 60 * 1000));

      console.log('🔔 Checking request:', docSnap.id);
      console.log('   Scheduled for:', scheduledDate.toISOString());
      console.log('   Notification time (2hrs before):', twoHoursBefore.toISOString());
      console.log('   Current time:', now.toISOString());
      console.log('   Should notify?:', now >= twoHoursBefore && now < scheduledDate);

      if (now >= twoHoursBefore && now < scheduledDate) {
        const alreadyNotified = requestData.notificationSent || false;
        
        if (alreadyNotified) {
          console.log('   ⏭️ Already notified, skipping');
          continue;
        }

        console.log('   ✅ Request is due in 2 hours! Sending notification...');

        const plantManagerId = await getPlantManagerForSite(siteId);
        
        if (!plantManagerId) {
          console.log('   ⚠️ No plant manager found for this site');
          continue;
        }

        await createPlantManagerDiaryEntry({
          requestId: docSnap.id,
          plantManagerId,
          siteId,
          plantType: requestData.plantType,
          quantity: requestData.quantity,
          pvArea: requestData.pvArea,
          blockArea: requestData.blockArea,
          purpose: requestData.purpose,
          requestedBy: requestData.requestedBy,
          requestedByName: requestData.requestedByName || requestData.requestedBy,
          scheduledDate: requestData.scheduledDeliveryDate,
          isPriority: true,
        });

        await updateDoc(doc(db, 'requests', docSnap.id), {
          notificationSent: true,
          notificationSentAt: Timestamp.now(),
        });

        notificationsSent++;
        console.log('   ✅ Notification sent successfully');
      }
    }

    console.log('🔔 ============================================================================');
    console.log('🔔 Total notifications sent:', notificationsSent);
    return notificationsSent;
  } catch (error) {
    console.error('❌ Error checking scheduled plant allocations:', error);
    throw error;
  }
}

async function getPlantManagerForSite(siteId: string): Promise<string | null> {
  try {
    console.log('👤 Finding plant manager for site:', siteId);
    
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('siteId', '==', siteId),
      where('role', '==', 'plantManager')
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log('❌ No plant manager found for site:', siteId);
      return null;
    }

    const plantManagerId = snapshot.docs[0].data().userId;
    console.log('✅ Found plant manager:', plantManagerId);
    return plantManagerId;
  } catch (error) {
    console.error('❌ Error finding plant manager:', error);
    return null;
  }
}

async function createPlantManagerDiaryEntry(data: {
  requestId: string;
  plantManagerId: string;
  siteId: string;
  plantType: string;
  quantity: number;
  pvArea?: string;
  blockArea?: string;
  purpose?: string;
  requestedBy: string;
  requestedByName: string;
  scheduledDate: any;
  isPriority: boolean;
}): Promise<void> {
  try {
    console.log('📝 Creating plant manager diary entry for request:', data.requestId);
    
    const diaryEntry = {
      requestId: data.requestId,
      plantManagerId: data.plantManagerId,
      siteId: data.siteId,
      plantType: data.plantType,
      quantity: data.quantity,
      pvArea: data.pvArea || '',
      blockArea: data.blockArea || '',
      purpose: data.purpose || '',
      requestedBy: data.requestedBy,
      requestedByName: data.requestedByName,
      scheduledDate: data.scheduledDate,
      note: `Plant allocation scheduled for ${data.scheduledDate.toDate().toLocaleString()} is due in 2 hours. Please prepare to allocate ${data.quantity} ${data.plantType} to PV Area ${data.pvArea}, Block ${data.blockArea}.`,
      notificationType: 'plant_allocation_due',
      isPriority: data.isPriority,
      archived: false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await addDoc(collection(db, 'plantManagerDiary'), diaryEntry);
    console.log('✅ Diary entry created successfully');
  } catch (error) {
    console.error('❌ Error creating diary entry:', error);
    throw error;
  }
}

export async function startPlantAllocationNotificationService(config: PlantAllocationNotificationConfig): Promise<() => void> {
  const intervalMinutes = config.checkIntervalMinutes || 5;
  const intervalMs = intervalMinutes * 60 * 1000;

  console.log('🚀 Starting plant allocation notification service');
  console.log('   Check interval:', intervalMinutes, 'minutes');
  console.log('   Site ID:', config.siteId);

  await checkScheduledPlantAllocations(config);

  const intervalId = setInterval(async () => {
    try {
      await checkScheduledPlantAllocations(config);
    } catch (error) {
      console.error('❌ Error in notification service:', error);
    }
  }, intervalMs);

  return () => {
    console.log('🛑 Stopping plant allocation notification service');
    clearInterval(intervalId);
  };
}
