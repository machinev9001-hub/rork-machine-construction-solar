import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';

export type MatchingSupervisor = {
  supervisorId: string;
  supervisorName: string;
  taskId: string;
  activityId: string;
  completionPercentage: number;
  lastUpdatedAt: any;
};

export type FindMatchingSupervisorsParams = {
  currentSupervisorId: string;
  subMenuKey: string;
  activityId: string;
  pvArea: string;
  blockNumber: string;
  siteId: string;
};

export async function findMatchingSupervisors(
  params: FindMatchingSupervisorsParams
): Promise<MatchingSupervisor[]> {
  const {
    currentSupervisorId,
    subMenuKey,
    activityId,
    pvArea,
    blockNumber,
    siteId,
  } = params;

  console.log('🔍 [findMatchingSupervisors] Searching for matching supervisors:', {
    subMenuKey,
    activityId,
    pvArea,
    blockNumber,
    siteId,
    excludingSupervisor: currentSupervisorId,
  });

  try {
    const tasksRef = collection(db, 'tasks');
    const tasksQuery = query(
      tasksRef,
      where('subActivity', '==', subMenuKey),
      where('pvArea', '==', pvArea),
      where('blockArea', '==', blockNumber),
      where('siteId', '==', siteId),
      where('status', 'in', ['OPEN', 'LOCKED'])
    );

    const tasksSnapshot = await getDocs(tasksQuery);
    console.log('📊 Found', tasksSnapshot.docs.length, 'matching tasks');

    const matchingSupervisors: MatchingSupervisor[] = [];

    for (const taskDoc of tasksSnapshot.docs) {
      const taskData = taskDoc.data();
      const supervisorId = taskData.supervisorId;

      if (supervisorId === currentSupervisorId) {
        console.log('⏭️ Skipping current supervisor:', supervisorId);
        continue;
      }

      const activitiesRef = collection(db, 'activities');
      const activitiesQuery = query(
        activitiesRef,
        where('taskId', '==', taskDoc.id),
        where('activityId', '==', activityId),
        where('status', 'in', ['OPEN', 'LOCKED'])
      );

      const activitiesSnapshot = await getDocs(activitiesQuery);

      if (!activitiesSnapshot.empty) {
        const activityData = activitiesSnapshot.docs[0].data();
        const scopeValue = activityData.scopeValue || 0;
        const qcValue = activityData.qcValue || 0;
        const completionPercentage =
          scopeValue > 0 ? (qcValue / scopeValue) * 100 : 0;

        const userDoc = await getUserName(supervisorId, siteId);

        matchingSupervisors.push({
          supervisorId,
          supervisorName: userDoc || supervisorId,
          taskId: taskDoc.id,
          activityId,
          completionPercentage: Math.round(completionPercentage * 100) / 100,
          lastUpdatedAt: activityData.updatedAt || taskData.updatedAt,
        });

        console.log('✅ Found matching supervisor:', {
          supervisorId,
          taskId: taskDoc.id,
          completion: completionPercentage.toFixed(2) + '%',
        });
      }
    }

    console.log('📋 Total matching supervisors found:', matchingSupervisors.length);
    return matchingSupervisors;
  } catch (error) {
    console.error('❌ Error finding matching supervisors:', error);
    throw error;
  }
}

async function getUserName(
  userId: string,
  siteId: string
): Promise<string | null> {
  try {
    const usersRef = collection(db, 'users');
    const userQuery = query(
      usersRef,
      where('userId', '==', userId),
      where('siteId', '==', siteId)
    );
    const userSnapshot = await getDocs(userQuery);

    if (!userSnapshot.empty) {
      const userData = userSnapshot.docs[0].data();
      return userData.name || userData.userId || null;
    }

    return null;
  } catch (error) {
    console.error('Error fetching user name:', error);
    return null;
  }
}
