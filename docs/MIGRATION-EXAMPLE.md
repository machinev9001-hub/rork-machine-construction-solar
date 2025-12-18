# Migration Example: Before & After

This document shows practical examples of migrating existing code to use the new optimization utilities.

## Example 1: Replacing console.log with Logger

### Before
```typescript
import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';

export function TaskList() {
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    async function loadTasks() {
      console.log('Loading tasks...');
      try {
        const snapshot = await getDocs(collection(db, 'tasks'));
        const taskData = snapshot.docs.map(doc => doc.data());
        console.log('Tasks loaded:', taskData.length);
        setTasks(taskData);
      } catch (error) {
        console.error('Failed to load tasks:', error);
      }
    }
    loadTasks();
  }, []);

  return (
    // ... component JSX
  );
}
```

### After
```typescript
import { useEffect, useState } from 'react';
import { collection } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { logger } from '@/utils/logger';
import { safeGetDocs, DEFAULT_QUERY_LIMITS } from '@/utils/firebaseQueryHelpers';

// Create scoped logger for this component
const taskLogger = logger.scope('TaskList');

export function TaskList() {
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    async function loadTasks() {
      taskLogger.debug('Loading tasks...');
      try {
        // Use safeGetDocs with automatic limit
        const snapshot = await safeGetDocs(
          collection(db, 'tasks'),
          {
            maxLimit: DEFAULT_QUERY_LIMITS.LIST,
            context: 'TaskList',
            logQuery: __DEV__,
          }
        );
        const taskData = snapshot.docs.map(doc => doc.data());
        taskLogger.debug('Tasks loaded:', taskData.length);
        setTasks(taskData);
      } catch (error) {
        taskLogger.error('Failed to load tasks:', error);
      }
    }
    loadTasks();
  }, []);

  return (
    // ... component JSX
  );
}
```

### Benefits
- ✅ Debug logs automatically disabled in production
- ✅ Query automatically limited to 50 items
- ✅ Better error tracking with context
- ✅ Cleaner console output with timestamps

---

## Example 2: Adding Error Boundary

### Before
```typescript
// app/(tabs)/tasks.tsx
export default function TasksScreen() {
  return (
    <View style={styles.container}>
      <TaskList />
      <TaskForm />
    </View>
  );
}
```

### After
```typescript
// app/(tabs)/tasks.tsx
import ErrorBoundary from '@/components/ErrorBoundary';

export default function TasksScreen() {
  return (
    <ErrorBoundary>
      <View style={styles.container}>
        <TaskList />
        <TaskForm />
      </View>
    </ErrorBoundary>
  );
}
```

### Benefits
- ✅ Prevents entire app crash if TaskList or TaskForm throws
- ✅ Shows user-friendly error message
- ✅ Provides "Try Again" button
- ✅ Logs errors for debugging

---

## Example 3: Firestore Listener with Automatic Cleanup

### Before (Memory Leak Risk)
```typescript
import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';

export function UserTasks({ userId }: { userId: string }) {
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    const q = query(
      collection(db, 'tasks'),
      where('userId', '==', userId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskData = snapshot.docs.map(doc => doc.data());
      setTasks(taskData);
    });

    // Missing cleanup or improper cleanup can cause memory leaks
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [userId]);

  return (
    // ... component JSX
  );
}
```

### After (Memory Safe)
```typescript
import { useState } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useFirestoreListener } from '@/utils/hooks/useFirestoreListener';

export function UserTasks({ userId }: { userId: string }) {
  const [tasks, setTasks] = useState([]);

  // Automatic cleanup handled by the hook
  useFirestoreListener(
    userId ? query(
      collection(db, 'tasks'),
      where('userId', '==', userId)
    ) : null,
    (snapshot) => {
      const taskData = snapshot.docs.map(doc => doc.data());
      setTasks(taskData);
    },
    {
      context: 'UserTasks',
      enabled: !!userId,
      errorHandler: (error) => {
        logger.error('Failed to listen to tasks:', error);
      },
    }
  );

  return (
    // ... component JSX
  );
}
```

### Benefits
- ✅ Automatic listener cleanup on unmount
- ✅ Prevents memory leaks
- ✅ Conditional listener (only when userId exists)
- ✅ Built-in error handling
- ✅ Debug logging with context

---

## Example 4: Multiple Listeners

### Before (Complex Cleanup)
```typescript
import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';

export function Dashboard({ userId }: { userId: string }) {
  const [tasks, setTasks] = useState([]);
  const [activities, setActivities] = useState([]);
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    const unsubscribes: (() => void)[] = [];

    // Listen to tasks
    const tasksUnsub = onSnapshot(
      query(collection(db, 'tasks'), where('userId', '==', userId)),
      (snapshot) => setTasks(snapshot.docs.map(d => d.data()))
    );
    unsubscribes.push(tasksUnsub);

    // Listen to activities
    const activitiesUnsub = onSnapshot(
      query(collection(db, 'activities'), where('userId', '==', userId)),
      (snapshot) => setActivities(snapshot.docs.map(d => d.data()))
    );
    unsubscribes.push(activitiesUnsub);

    // Listen to requests
    const requestsUnsub = onSnapshot(
      query(collection(db, 'requests'), where('userId', '==', userId)),
      (snapshot) => setRequests(snapshot.docs.map(d => d.data()))
    );
    unsubscribes.push(requestsUnsub);

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [userId]);

  return (
    // ... component JSX
  );
}
```

### After (Simplified)
```typescript
import { useState } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useMultipleFirestoreListeners } from '@/utils/hooks/useFirestoreListener';

export function Dashboard({ userId }: { userId: string }) {
  const [tasks, setTasks] = useState([]);
  const [activities, setActivities] = useState([]);
  const [requests, setRequests] = useState([]);

  useMultipleFirestoreListeners([
    {
      query: userId ? query(collection(db, 'tasks'), where('userId', '==', userId)) : null,
      callback: (snapshot) => setTasks(snapshot.docs.map(d => d.data())),
      context: 'DashboardTasks',
      enabled: !!userId,
    },
    {
      query: userId ? query(collection(db, 'activities'), where('userId', '==', userId)) : null,
      callback: (snapshot) => setActivities(snapshot.docs.map(d => d.data())),
      context: 'DashboardActivities',
      enabled: !!userId,
    },
    {
      query: userId ? query(collection(db, 'requests'), where('userId', '==', userId)) : null,
      callback: (snapshot) => setRequests(snapshot.docs.map(d => d.data())),
      context: 'DashboardRequests',
      enabled: !!userId,
    },
  ]);

  return (
    // ... component JSX
  );
}
```

### Benefits
- ✅ Cleaner code (50% less lines)
- ✅ Automatic cleanup for all listeners
- ✅ Individual context labels for debugging
- ✅ Consistent error handling
- ✅ Easy to add/remove listeners

---

## Example 5: Pagination

### Before (Unlimited Query)
```typescript
import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';

export function AllTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTasks() {
      try {
        // PROBLEM: Could load thousands of documents
        const snapshot = await getDocs(collection(db, 'tasks'));
        setTasks(snapshot.docs.map(doc => doc.data()));
      } catch (error) {
        console.error('Failed to load tasks:', error);
      } finally {
        setLoading(false);
      }
    }
    loadTasks();
  }, []);

  return (
    // ... component JSX
  );
}
```

### After (Paginated)
```typescript
import { useState } from 'react';
import { collection, query, orderBy, startAfter } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { getPaginatedDocs, DEFAULT_QUERY_LIMITS } from '@/utils/firebaseQueryHelpers';
import { logger } from '@/utils/logger';

const taskLogger = logger.scope('AllTasks');

export function AllTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState(null);

  async function loadTasks() {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const baseQuery = lastDoc
        ? query(
            collection(db, 'tasks'),
            orderBy('createdAt', 'desc'),
            startAfter(lastDoc)
          )
        : query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));

      const result = await getPaginatedDocs(baseQuery, {
        pageSize: DEFAULT_QUERY_LIMITS.LIST,
        context: 'AllTasks',
      });

      setTasks(prev => [...prev, ...result.docs]);
      setHasMore(result.hasMore);
      setLastDoc(result.lastDoc);
    } catch (error) {
      taskLogger.error('Failed to load tasks:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    // ... component JSX with "Load More" button
    // <Button onPress={loadTasks} disabled={!hasMore || loading}>
    //   {loading ? 'Loading...' : hasMore ? 'Load More' : 'No More Tasks'}
    // </Button>
  );
}
```

### Benefits
- ✅ Loads only 50 tasks at a time
- ✅ Reduces Firebase read costs
- ✅ Better performance with large datasets
- ✅ Smooth user experience
- ✅ Automatic "has more" detection

---

## Migration Checklist

### Phase 1: Quick Wins (Day 1)
- [ ] Import logger in new files
- [ ] Add ErrorBoundary to critical screens
- [ ] Use safeGetDocs for new queries

### Phase 2: Systematic Migration (Week 1)
- [ ] Replace console.log in top 10 largest files
- [ ] Add query limits to unlimited queries
- [ ] Wrap main screens with ErrorBoundary

### Phase 3: Deep Clean (Week 2-3)
- [ ] Replace all console.log with logger
- [ ] Migrate all onSnapshot to useFirestoreListener
- [ ] Add pagination to list screens

### Phase 4: Verification (Week 4)
- [ ] Check Firebase usage metrics
- [ ] Profile app performance
- [ ] Test error boundaries
- [ ] Monitor crash reports

---

## Testing Your Changes

### Test Logger
```typescript
// In a component
import { logger } from '@/utils/logger';

logger.debug('This will only show in dev');
logger.error('This will always show');

// Build for production and verify:
// - Debug logs don't appear
// - Error logs still appear
```

### Test Error Boundary
```typescript
// Create a test button that throws
<Button
  title="Test Error Boundary"
  onPress={() => {
    throw new Error('Test error');
  }}
/>

// Verify:
// - Error screen appears
// - "Try Again" button works
// - Error is logged
```

### Test Query Limits
```typescript
// In Firebase console:
// 1. Check current read count
// 2. Run app with new queries
// 3. Check read count again
// 4. Verify it's limited (should be ~50 per query)
```

---

**Last Updated:** December 18, 2025
