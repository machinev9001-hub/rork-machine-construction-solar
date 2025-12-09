import { useState, useCallback } from 'react';
import { collection, doc, addDoc, getDocs, query, where, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { db } from '../../config/firebase';
import { getRequestThrottleStatus, markRequestThrottle } from '../requestThrottle';
import {
  cacheTasksForSubActivity,
  getCachedTasksForSubActivity,
  updateCachedTask,
  CachedTask,
} from '../taskCache';

type Task = {
  id: string;
  name: string;
  status: string;
  pvArea?: string;
  blockArea?: string;
  specialArea?: string;
  location?: string;
  notes?: string;
  taskAccessRequested?: boolean;
  [key: string]: any;
};

export function useTaskManagement(
  userId: string | undefined,
  siteId: string | undefined,
  activity: string | undefined,
  subActivity: string | undefined
) {
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [currentTaskIndex, setCurrentTaskIndex] = useState<number>(0);
  const [taskId, setTaskId] = useState<string>('');
  const [taskName, setTaskName] = useState<string>('');
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [taskAccessRequested, setTaskAccessRequested] = useState<boolean>(false);
  const [pvArea, setPvArea] = useState<string>('');
  const [blockArea, setBlockArea] = useState<string>('');
  const [specialArea, setSpecialArea] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const loadAllTasksForSubActivity = useCallback(async () => {
    if (!subActivity || !activity || !userId || !siteId) return null;

    const setTaskStateFromList = (tasks: Task[]): string | null => {
      if (tasks.length === 0) {
        return null;
      }

      const ordered = [...tasks].sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });

      setAllTasks(ordered);

      const firstTask = ordered[0];
      setTaskId(firstTask.id);
      setTaskName(firstTask.name || '');
      setIsLocked(firstTask.status === 'LOCKED');
      setTaskAccessRequested(Boolean(firstTask.taskAccessRequested));
      setPvArea(firstTask.pvArea || '');
      setBlockArea(firstTask.blockArea || '');
      setSpecialArea(firstTask.specialArea || '');
      setLocation(firstTask.location || '');
      setNotes(firstTask.notes || '');

      return firstTask.id;
    };

    const toCachedTask = (task: Task): CachedTask => ({
      id: task.id,
      name: task.name || '',
      status: task.status || 'LOCKED',
      taskAccessRequested: Boolean(task.taskAccessRequested),
      pvArea: task.pvArea,
      blockArea: task.blockArea,
      specialArea: task.specialArea,
      location: task.location,
      notes: task.notes,
      metadata: {
        activity,
        subActivity,
        siteId,
        supervisorId: userId,
      },
      lastUpdatedAt: task.updatedAt?.toString?.() || new Date().toISOString(),
    });

    try {
      console.log('📋 Loading all tasks for:', { activity, subActivity, userId, siteId });

      const netInfo = await NetInfo.fetch();
      const isOffline = !netInfo.isConnected;
      console.log('📡 Network status (tasks):', isOffline ? 'OFFLINE' : 'ONLINE');

      if (isOffline) {
        const cachedTasks = await getCachedTasksForSubActivity({
          siteId,
          supervisorId: userId,
          subActivity,
        });

        if (cachedTasks.length > 0) {
          console.log('📦 Using cached tasks (offline) count:', cachedTasks.length);
          const mappedTasks: Task[] = cachedTasks.map((cached) => ({
            id: cached.id,
            name: cached.name,
            status: cached.status,
            taskAccessRequested: cached.taskAccessRequested,
            pvArea: cached.pvArea,
            blockArea: cached.blockArea,
            specialArea: cached.specialArea,
            location: cached.location,
            notes: cached.notes,
          }));
          return setTaskStateFromList(mappedTasks);
        }

        console.log('⚠️ No cached tasks found for offline mode');
        Alert.alert('Offline Access', 'No cached tasks available. Please connect to the internet to sync your tasks.');
        return null;
      }

      const tasksRef = collection(db, 'tasks');
      const taskQuery = query(
        tasksRef,
        where('subActivity', '==', subActivity),
        where('supervisorId', '==', userId),
        where('siteId', '==', siteId)
      );
      const snapshot = await getDocs(taskQuery);

      if (!snapshot.empty) {
        const tasks = snapshot.docs.map((taskDoc) => ({
          id: taskDoc.id,
          ...taskDoc.data(),
        })) as Task[];

        const selectedTaskId = setTaskStateFromList(tasks);

        await cacheTasksForSubActivity({
          siteId,
          supervisorId: userId,
          subActivity,
          tasks: tasks.map(toCachedTask),
        });

        return selectedTaskId;
      }

      console.log('📝 No tasks found remotely. Creating first task entry.');

      const newTaskRef = await addDoc(collection(db, 'tasks'), {
        activity,
        subActivity,
        supervisorId: userId,
        siteId,
        name: 'Task 1',
        status: 'LOCKED',
        taskAccessRequested: false,
        pvArea: '',
        blockArea: '',
        specialArea: '',
        location: '',
        notes: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: userId,
      });

      const newTask: Task = {
        id: newTaskRef.id,
        activity,
        subActivity,
        supervisorId: userId,
        siteId,
        name: 'Task 1',
        status: 'LOCKED',
        taskAccessRequested: false,
        pvArea: '',
        blockArea: '',
        specialArea: '',
        location: '',
        notes: '',
      };

      await cacheTasksForSubActivity({
        siteId,
        supervisorId: userId,
        subActivity,
        tasks: [toCachedTask(newTask)],
      });

      setTaskStateFromList([newTask]);
      console.log('✅ Created and cached new task:', newTaskRef.id);

      return newTaskRef.id;
    } catch (error) {
      console.error('❌ Error loading tasks:', error);

      const cachedTasks = await getCachedTasksForSubActivity({
        siteId,
        supervisorId: userId,
        subActivity,
      });

      if (cachedTasks.length > 0) {
        console.log('📦 Fallback to cached tasks after error. Count:', cachedTasks.length);
        const mappedTasks: Task[] = cachedTasks.map((cached) => ({
          id: cached.id,
          name: cached.name,
          status: cached.status,
          taskAccessRequested: cached.taskAccessRequested,
          pvArea: cached.pvArea,
          blockArea: cached.blockArea,
          specialArea: cached.specialArea,
          location: cached.location,
          notes: cached.notes,
        }));
        return setTaskStateFromList(mappedTasks);
      }

      Alert.alert('Error', 'Failed to load task data. Please try again later.');
      return null;
    }
  }, [subActivity, activity, userId, siteId]);

  const switchTask = useCallback(async (newIndex: number, onLoadActivities: (taskId: string) => Promise<void>) => {
    if (newIndex < 0 || newIndex >= allTasks.length) return;
    
    setCurrentTaskIndex(newIndex);
    const task = allTasks[newIndex];
    setTaskId(task.id);
    setTaskName(task.name || '');
    setIsLocked(task.status === 'LOCKED');
    setTaskAccessRequested(task.taskAccessRequested || false);
    setPvArea(task.pvArea || '');
    setBlockArea(task.blockArea || '');
    setSpecialArea(task.specialArea || '');
    setLocation(task.location || '');
    setNotes(task.notes || '');
    
    await onLoadActivities(task.id);
  }, [allTasks]);

  const handleToggleTaskAccess = useCallback(async (value: boolean) => {
    if (!taskId || !userId || !siteId) return;

    const throttleKey = `${taskId}-TASK_REQUEST`;

    if (value) {
      const { blocked, remainingMs } = getRequestThrottleStatus(throttleKey);
      if (blocked) {
        const remainingSeconds = Math.ceil(remainingMs / 1000);
        console.log('⏱️ Task access request throttled', { taskId, remainingSeconds });
        Alert.alert('Please Wait', `You can send another task request in ${remainingSeconds}s.`);
        return;
      }
    }

    try {
      if (value) {
        const requestsRef = collection(db, 'requests');
        const pendingQuery = query(
          requestsRef,
          where('type', '==', 'TASK_REQUEST'),
          where('taskId', '==', taskId),
          where('status', '==', 'PENDING')
        );
        const pendingSnapshot = await getDocs(pendingQuery);

        if (pendingSnapshot.empty) {
          console.log('Creating task access request...');
          await addDoc(collection(db, 'requests'), {
            type: 'TASK_REQUEST',
            taskId,
            requestedBy: userId,
            requestedTo: 'planner',
            siteId,
            status: 'PENDING',
            message: 'Requesting access to task',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          console.log('Task access request created successfully');
        } else {
          console.log('⚠️ Existing task access request detected, skipping duplicate creation', {
            taskId,
            pendingCount: pendingSnapshot.size,
          });
        }

        await updateDoc(doc(db, 'tasks', taskId), {
          taskAccessRequested: true,
          updatedAt: serverTimestamp(),
        });

        setTaskAccessRequested(true);
        markRequestThrottle(throttleKey);

        await updateCachedTask({
          siteId,
          supervisorId: userId || '',
          subActivity: subActivity || '',
          taskId,
          updater: (task) => ({
            ...task,
            taskAccessRequested: true,
            lastUpdatedAt: new Date().toISOString(),
          }),
        });
      } else {
        console.log('Cancelling task access request');

        const requestsRef = collection(db, 'requests');
        const pendingQuery = query(
          requestsRef,
          where('type', '==', 'TASK_REQUEST'),
          where('taskId', '==', taskId),
          where('status', '==', 'PENDING')
        );
        const pendingSnapshot = await getDocs(pendingQuery);

        for (const reqDoc of pendingSnapshot.docs) {
          await updateDoc(doc(db, 'requests', reqDoc.id), {
            status: 'CANCELLED',
            updatedAt: serverTimestamp(),
          });
        }

        await updateDoc(doc(db, 'tasks', taskId), {
          taskAccessRequested: false,
          updatedAt: serverTimestamp(),
        });

        setTaskAccessRequested(false);
        markRequestThrottle(throttleKey);

        await updateCachedTask({
          siteId,
          supervisorId: userId || '',
          subActivity: subActivity || '',
          taskId,
          updater: (task) => ({
            ...task,
            taskAccessRequested: false,
            lastUpdatedAt: new Date().toISOString(),
          }),
        });
      }
    } catch (error) {
      console.error('Error handling task access request:', error);
      Alert.alert('Error', 'Failed to update request');
    }
  }, [taskId, userId, siteId, subActivity]);

  return {
    allTasks,
    currentTaskIndex,
    taskId,
    taskName,
    isLocked,
    taskAccessRequested,
    pvArea,
    blockArea,
    specialArea,
    location,
    notes,
    setTaskId,
    setTaskName,
    setIsLocked,
    setTaskAccessRequested,
    setPvArea,
    setBlockArea,
    setSpecialArea,
    setLocation,
    setNotes,
    loadAllTasksForSubActivity,
    switchTask,
    handleToggleTaskAccess,
  };
}
