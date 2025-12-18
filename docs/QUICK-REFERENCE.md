# Quick Reference Guide - Project Tracker

## For Developers

### Firebase Project Info

```
Project ID:     project-tracker-app-33cff
Project Number: 235534188025
App ID:         1:235534188025:web:b7c49ea0c361988cf41128
Console:        https://console.firebase.google.com/u/0/project/project-tracker-app-33cff
```

---

## Common Code Patterns

### 1. Using the Logger

```typescript
import { logger } from '@/utils/logger';

// Debug (development only)
logger.debug('User data loaded', userData);

// Info (development only)
logger.info('Request sent');

// Warning (development only)
logger.warn('Slow query detected');

// Error (always logs)
logger.error('Failed to save', error);

// Create scoped logger
const authLogger = logger.scope('Auth');
authLogger.info('Login successful');
```

### 2. Using Error Boundaries

```typescript
import ErrorBoundary from '@/components/ErrorBoundary';

// Wrap your component
export default function MyScreen() {
  return (
    <ErrorBoundary>
      <YourComponent />
    </ErrorBoundary>
  );
}
```

### 3. Firebase Queries with Limits

```typescript
import { safeGetDocs, DEFAULT_QUERY_LIMITS } from '@/utils/firebaseQueryHelpers';
import { collection, query, where } from 'firebase/firestore';

// Safe query with automatic limit
const snapshot = await safeGetDocs(
  query(
    collection(db, 'tasks'),
    where('siteId', '==', siteId)
  ),
  {
    maxLimit: DEFAULT_QUERY_LIMITS.LIST, // 50
    context: 'TasksList',
    logQuery: __DEV__,
  }
);

const tasks = snapshot.docs.map(doc => ({
  id: doc.id,
  ...doc.data(),
}));
```

### 4. Pagination

```typescript
import { getPaginatedDocs } from '@/utils/firebaseQueryHelpers';

const [hasMore, setHasMore] = useState(true);
const [lastDoc, setLastDoc] = useState(null);

async function loadMore() {
  const baseQuery = lastDoc
    ? query(collection(db, 'tasks'), startAfter(lastDoc))
    : query(collection(db, 'tasks'));

  const result = await getPaginatedDocs(baseQuery, {
    pageSize: 25,
    context: 'Tasks',
  });

  setTasks(prev => [...prev, ...result.docs]);
  setHasMore(result.hasMore);
  setLastDoc(result.lastDoc);
}
```

### 5. Firestore Listeners with Auto Cleanup

```typescript
import { useFirestoreListener } from '@/utils/hooks/useFirestoreListener';
import { useCallback } from 'react';

// Callback must be memoized!
const handleUpdate = useCallback((snapshot) => {
  const data = snapshot.docs.map(d => d.data());
  setData(data);
}, []);

useFirestoreListener(
  query(collection(db, 'tasks'), where('userId', '==', userId)),
  handleUpdate,
  {
    context: 'UserTasks',
    enabled: !!userId,
  }
);
```

### 6. Multiple Listeners

```typescript
import { useMultipleFirestoreListeners } from '@/utils/hooks/useFirestoreListener';
import { useMemo } from 'react';

// Must use useMemo for stable reference!
const listeners = useMemo(() => [
  {
    query: tasksQuery,
    callback: handleTasksUpdate,
    context: 'Tasks',
  },
  {
    query: activitiesQuery,
    callback: handleActivitiesUpdate,
    context: 'Activities',
  },
], [tasksQuery, activitiesQuery, handleTasksUpdate, handleActivitiesUpdate]);

useMultipleFirestoreListeners(listeners);
```

---

## User Roles Quick Reference

| Role | Code | Access Level |
|------|------|--------------|
| Master User | `Master` | Full system access |
| Admin | `Admin` | All operations except company settings |
| Planner | `Planner` | Project planning, request approval |
| Supervisor | `Supervisor` | Team management, progress submission |
| QC | `QC` | Quality inspections |
| Operator | `Operator` | Task execution |
| Plant Manager | `Plant Manager` | Equipment management |
| Surveyor | `Surveyor` | Site surveys |
| Staff Manager | `Staff Manager` | Personnel management |
| Logistics Manager | `Logistics Manager` | Materials management |

---

## Request Types

1. **Task Request** - Request access to locked task
2. **Scope Request** - Request scope value for activity
3. **QC Request** - Request quality inspection
4. **Cabling Request** - Cable laying handover
5. **Termination Request** - Cable termination handover
6. **Surveyor Request** - Survey task request

---

## Firebase Collections

### Core Collections
- `companies` - Company profiles
- `masterAccounts` - Master user accounts
- `users` - All users
- `sites` - Project sites

### Work Management
- `tasks` - Main tasks
- `activities` - Work activities
- `activityHistory` - Progress history
- `requests` - All request types
- `handoverRequests` - Handover requests

### Resources
- `employees` - Site employees
- `plantAssets` - Equipment
- `assets` - General assets
- `subcontractors` - Subcontractors

### Communication
- `onboardingMessages` - Onboarding messages
- `surveyorImages` - Survey photos

---

## Default Query Limits

```typescript
DEFAULT_QUERY_LIMITS.LIST = 50      // General lists
DEFAULT_QUERY_LIMITS.SEARCH = 25    // Search results
DEFAULT_QUERY_LIMITS.RECENT = 10    // Recent items
DEFAULT_QUERY_LIMITS.MAX = 100      // Hard maximum
```

---

## Environment Variables

Required in `.env`:
```env
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=project-tracker-app-33cff
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=1:235534188025:web:b7c49ea0c361988cf41128
```

---

## Common Commands

```bash
# Start development server
npm start

# Type check
npm run type-check

# Lint
npm run lint

# Test
npm test

# Deploy Firebase rules
firebase deploy --only firestore:rules

# Deploy Firebase indexes
firebase deploy --only firestore:indexes

# Check Firebase usage
firebase projects:list
```

---

## Debugging Tips

### Check User Claims
```typescript
import { getAuth } from 'firebase/auth';

const auth = getAuth();
const user = auth.currentUser;
if (user) {
  const idTokenResult = await user.getIdTokenResult();
  console.log('Claims:', idTokenResult.claims);
}
```

### Check Query Performance
```typescript
// Enable query logging
const snapshot = await safeGetDocs(query, {
  logQuery: true,
  context: 'DebugQuery',
});
```

### Test Error Boundary
```typescript
// Create a test component that throws
const TestError = () => {
  throw new Error('Test error');
  return null;
};

<ErrorBoundary>
  <TestError />
</ErrorBoundary>
```

---

## Performance Checklist

- [ ] Use `safeGetDocs` for all queries
- [ ] Add query limits to all list queries
- [ ] Implement pagination for large lists
- [ ] Use `useFirestoreListener` for real-time data
- [ ] Memoize callbacks with `useCallback`
- [ ] Use `useMemo` for computed values
- [ ] Replace console.log with logger
- [ ] Add ErrorBoundary to all screens

---

## Security Checklist

- [ ] Never expose API keys in code
- [ ] Use EXPO_PUBLIC_ prefix for client-side vars
- [ ] Set custom claims on user creation
- [ ] Test security rules before deploy
- [ ] Validate user input
- [ ] Sanitize data before display
- [ ] Use parameterized queries
- [ ] Implement rate limiting

---

## Links

**Documentation:**
- [USER-GUIDE.md](./USER-GUIDE.md) - User workflows
- [TECHNICAL-GUIDE.md](./TECHNICAL-GUIDE.md) - Architecture
- [FIREBASE-INDEXES.md](./FIREBASE-INDEXES.md) - All indexes
- [FIREBASE-SECURITY-RULES.md](./FIREBASE-SECURITY-RULES.md) - Security rules
- [OPTIMIZATION-IMPROVEMENTS.md](./OPTIMIZATION-IMPROVEMENTS.md) - Performance utilities
- [MIGRATION-EXAMPLE.md](./MIGRATION-EXAMPLE.md) - Code examples

**Firebase Console:**
- [Dashboard](https://console.firebase.google.com/u/0/project/project-tracker-app-33cff)
- [Firestore](https://console.firebase.google.com/u/0/project/project-tracker-app-33cff/firestore)
- [Authentication](https://console.firebase.google.com/u/0/project/project-tracker-app-33cff/authentication)
- [Rules](https://console.firebase.google.com/u/0/project/project-tracker-app-33cff/firestore/rules)
- [Indexes](https://console.firebase.google.com/u/0/project/project-tracker-app-33cff/firestore/databases/-default-/indexes)

---

**Last Updated:** December 18, 2025  
**Version:** 1.0
