# API Reference - Project Tracker System

## Overview

This document details the Firebase Firestore collections structure, data models, and security rules used in the Project Tracker system.

---

## Authentication

### Firebase Authentication

The system uses Firebase Authentication for user management.

**Supported Methods:**
- Email/Password
- QR Code (encoded JWT token)

**Auth Flow:**
```typescript
// Sign in with email
await signInWithEmailAndPassword(auth, email, password);

// Sign up new user
await createUserWithEmailAndPassword(auth, email, password);

// Sign out
await signOut(auth);

// Reset password
await sendPasswordResetEmail(auth, email);
```

---

## Collections

### 1. Companies Collection

**Path:** `/companies/{companyId}`

**Type Definition:**
```typescript
interface Company {
  id: string;
  legalEntityName: string;
  alias: string;
  address: string;
  contactNumber: string;
  adminContact: string;
  adminEmail: string;
  companyRegistrationNr: string;
  vatNumber: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}
```

**Operations:**

```typescript
// Create company
const createCompany = async (data: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>) => {
  const docRef = await addDoc(collection(db, 'companies'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

// Get company
const getCompany = async (companyId: string) => {
  const docSnap = await getDoc(doc(db, 'companies', companyId));
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
};

// Update company
const updateCompany = async (companyId: string, data: Partial<Company>) => {
  await updateDoc(doc(db, 'companies', companyId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};
```

**Security Rules:**
```javascript
// Read: Any authenticated user
// Write: Master User only
match /companies/{companyId} {
  allow read: if request.auth != null;
  allow write: if request.auth.token.role == 'Master';
}
```

---

### 2. Users Collection

**Path:** `/users/{userId}`

**Type Definition:**
```typescript
type UserRole = 
  | "Admin"
  | "Planner"
  | "Supervisor"
  | "QC"
  | "Operator"
  | "Plant Manager"
  | "Surveyor"
  | "Staff Manager"
  | "Logistics Manager";

interface User {
  id: string;
  userId: string;               // Login ID
  email: string;
  role: UserRole;
  subContractorName?: string;
  legalEntityName?: string;
  personalContactNr?: string;
  adminContact?: string;
  adminEmail?: string;
  companyRegistrationNr?: string;
  vatNumber?: string;
  qrCode: string;
  isActive: boolean;
  companyId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  lastLogin?: Timestamp;
}
```

**Operations:**

```typescript
// Create user
const createUser = async (data: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'qrCode'>) => {
  const qrCode = await generateQRCode(data.userId);
  const docRef = await addDoc(collection(db, 'users'), {
    ...data,
    qrCode,
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

// Get user by userId
const getUserByUserId = async (userId: string) => {
  const q = query(
    collection(db, 'users'),
    where('userId', '==', userId),
    limit(1)
  );
  const snapshot = await getDocs(q);
  return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
};

// Get users by role
const getUsersByRole = async (role: UserRole) => {
  const q = query(
    collection(db, 'users'),
    where('role', '==', role),
    where('isActive', '==', true)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Get users by company
const getUsersByCompany = async (companyId: string) => {
  const q = query(
    collection(db, 'users'),
    where('companyId', '==', companyId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Update user
const updateUser = async (userId: string, data: Partial<User>) => {
  await updateDoc(doc(db, 'users', userId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

// Deactivate user
const deactivateUser = async (userId: string) => {
  await updateDoc(doc(db, 'users', userId), {
    isActive: false,
    updatedAt: serverTimestamp(),
  });
};
```

**Security Rules:**
```javascript
match /users/{userId} {
  allow read: if request.auth != null;
  allow create: if request.auth.token.role in ['Master', 'Admin'];
  allow update: if request.auth.token.role in ['Master', 'Admin'] ||
                   request.auth.uid == userId;
  allow delete: if request.auth.token.role == 'Master';
}
```

---

### 3. Projects Collection

**Path:** `/projects/{projectId}`

**Type Definition:**
```typescript
type ProjectStatus = 'Planning' | 'Active' | 'On Hold' | 'Completed';

interface Project {
  id: string;
  projectName: string;
  description: string;
  startDate: Timestamp;
  endDate: Timestamp;
  status: ProjectStatus;
  companyId: string;
  createdBy: string;
  assignedUsers: string[];
  location: string;
  budget?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Operations:**

```typescript
// Create project
const createProject = async (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
  const docRef = await addDoc(collection(db, 'projects'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

// Get projects by company
const getProjectsByCompany = async (companyId: string, status?: ProjectStatus) => {
  let q = query(
    collection(db, 'projects'),
    where('companyId', '==', companyId)
  );
  
  if (status) {
    q = query(q, where('status', '==', status));
  }
  
  q = query(q, orderBy('startDate', 'desc'));
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Get projects for user
const getProjectsForUser = async (userId: string) => {
  const q = query(
    collection(db, 'projects'),
    where('assignedUsers', 'array-contains', userId),
    orderBy('startDate', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Update project
const updateProject = async (projectId: string, data: Partial<Project>) => {
  await updateDoc(doc(db, 'projects', projectId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};
```

**Security Rules:**
```javascript
match /projects/{projectId} {
  allow read: if request.auth != null && 
                 (request.auth.token.role in ['Master', 'Admin', 'Planner'] ||
                  resource.data.assignedUsers.hasAny([request.auth.uid]));
  allow create: if request.auth.token.role in ['Master', 'Admin', 'Planner'];
  allow update: if request.auth.token.role in ['Master', 'Admin', 'Planner', 'Supervisor'];
  allow delete: if request.auth.token.role in ['Master', 'Admin'];
}
```

---

### 4. Tasks Collection

**Path:** `/tasks/{taskId}`

**Type Definition:**
```typescript
type TaskStatus = 'Pending' | 'In Progress' | 'Review' | 'Completed';
type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  assignedTo: string;
  createdBy: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Timestamp;
  completedDate?: Timestamp;
  progress: number;
  attachments: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Operations:**

```typescript
// Create task
const createTask = async (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
  const docRef = await addDoc(collection(db, 'tasks'), {
    ...data,
    progress: 0,
    attachments: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

// Get tasks by project
const getTasksByProject = async (projectId: string, status?: TaskStatus) => {
  let q = query(
    collection(db, 'tasks'),
    where('projectId', '==', projectId)
  );
  
  if (status) {
    q = query(q, where('status', '==', status));
  }
  
  q = query(q, orderBy('dueDate', 'asc'));
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Get tasks assigned to user
const getTasksForUser = async (userId: string, status?: TaskStatus) => {
  let q = query(
    collection(db, 'tasks'),
    where('assignedTo', '==', userId)
  );
  
  if (status) {
    q = query(q, where('status', '==', status));
  }
  
  q = query(q, orderBy('dueDate', 'asc'));
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Update task progress
const updateTaskProgress = async (taskId: string, progress: number, status?: TaskStatus) => {
  const updates: any = {
    progress,
    updatedAt: serverTimestamp(),
  };
  
  if (status) {
    updates.status = status;
  }
  
  if (progress === 100 && status === 'Completed') {
    updates.completedDate = serverTimestamp();
  }
  
  await updateDoc(doc(db, 'tasks', taskId), updates);
};
```

**Security Rules:**
```javascript
match /tasks/{taskId} {
  allow read: if request.auth != null &&
                 (request.auth.token.role in ['Master', 'Admin', 'Planner', 'Supervisor'] ||
                  request.auth.uid == resource.data.assignedTo ||
                  request.auth.uid == resource.data.createdBy);
  allow create: if request.auth.token.role in ['Master', 'Admin', 'Planner'];
  allow update: if request.auth.token.role in ['Master', 'Admin', 'Planner', 'Supervisor'] ||
                   request.auth.uid == resource.data.assignedTo;
  allow delete: if request.auth.token.role in ['Master', 'Admin'];
}
```

---

### 5. Activity Log Collection

**Path:** `/activityLog/{logId}`

**Type Definition:**
```typescript
interface ActivityLog {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, any>;
  timestamp: Timestamp;
  ipAddress?: string;
}
```

**Operations:**

```typescript
// Log activity
const logActivity = async (
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  changes?: Record<string, any>
) => {
  await addDoc(collection(db, 'activityLog'), {
    userId,
    action,
    entityType,
    entityId,
    changes,
    timestamp: serverTimestamp(),
  });
};

// Get activity by user
const getActivityByUser = async (userId: string, limitCount: number = 50) => {
  const q = query(
    collection(db, 'activityLog'),
    where('userId', '==', userId),
    orderBy('timestamp', 'desc'),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Get activity for entity
const getActivityForEntity = async (entityType: string, entityId: string) => {
  const q = query(
    collection(db, 'activityLog'),
    where('entityType', '==', entityType),
    where('entityId', '==', entityId),
    orderBy('timestamp', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};
```

---

## Real-time Listeners

### Listen to User Changes
```typescript
const listenToUsers = (companyId: string, callback: (users: User[]) => void) => {
  const q = query(
    collection(db, 'users'),
    where('companyId', '==', companyId)
  );
  
  return onSnapshot(q, (snapshot) => {
    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as User }));
    callback(users);
  });
};
```

### Listen to Tasks
```typescript
const listenToUserTasks = (userId: string, callback: (tasks: Task[]) => void) => {
  const q = query(
    collection(db, 'tasks'),
    where('assignedTo', '==', userId),
    orderBy('dueDate', 'asc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as Task }));
    callback(tasks);
  });
};
```

---

## Helper Functions

### Generate QR Code
```typescript
const generateQRCode = async (userId: string): Promise<string> => {
  const token = await generateUserToken(userId);
  const qrData = JSON.stringify({ userId, token, timestamp: Date.now() });
  return qrData;
};
```

### Validate Permissions
```typescript
const canUserPerformAction = (
  userRole: UserRole,
  action: string,
  resourceOwnerId?: string,
  currentUserId?: string
): boolean => {
  if (userRole === 'Master') return true;
  
  const permissions = {
    Admin: ['create_project', 'edit_project', 'create_user', 'view_all'],
    Planner: ['create_project', 'create_task', 'assign_task'],
    Supervisor: ['edit_task', 'approve_task', 'view_team'],
    // ... etc
  };
  
  if (resourceOwnerId && currentUserId && resourceOwnerId === currentUserId) {
    return true;
  }
  
  return permissions[userRole]?.includes(action) || false;
};
```

---

Last Updated: January 2025
