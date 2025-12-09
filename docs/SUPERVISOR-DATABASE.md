# Supervisor System Database Structure

## Overview
This document outlines the database structure and indexes required for the Supervisor tracking system.

---

## Collections

### 1. Tasks Collection
**Collection Name:** `tasks`

**Purpose:** Store task information for each submenu (e.g., MV Cable Trench, DC Cable Trench)

**Fields:**
```typescript
{
  id: string;                      // Auto-generated task ID
  activity: string;                // Main menu (trenching, cabling, etc.)
  subActivity: string;             // Submenu (mv-cable-trench, dc-cable-trench, etc.)
  taskId: string;                  // Unique task identifier
  supervisorId: string;            // User ID of supervisor
  plannerId?: string;              // User ID of planner who created/approved
  
  // Task Details (Header Block)
  pvArea: string;                  // Required - PV Area
  blockNumber: string;             // Required - Block Number
  specialSection?: string;         // Optional
  location?: string;               // Optional
  notes?: string;                  // Optional
  
  // Status
  status: 'LOCKED' | 'PENDING' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED';
  taskAccessRequested: boolean;    // Supervisor requested access
  
  // Metadata
  createdAt: timestamp;
  updatedAt: timestamp;
  createdBy: string;               // User ID
}
```

**Indexes:**
1. **Single Field Indexes:**
   - `activity` - Filter tasks by main activity
   - `subActivity` - Filter tasks by submenu
   - `supervisorId` - Get all tasks for a supervisor
   - `status` - Filter by status
   - `taskId` - Quick lookup by task ID

2. **Composite Indexes:**
   - `subActivity + taskId` - Get specific task for submenu
   - `activity + createdAt` - Recent tasks for activity (descending)
   - `supervisorId + status + createdAt` - Supervisor's tasks by status, sorted by date
   - `status + updatedAt` - Recently updated tasks by status

**Rationale:**
- Tasks are the core entity for tracking work
- Supervisors need to quickly find their assigned tasks
- Planners need to view pending requests by activity
- Status filtering is critical for workflow management

---

### 2. Activities Collection
**Collection Name:** `activities`

**Purpose:** Store individual activity progress for each task

**Fields:**
```typescript
{
  id: string;                      // Auto-generated
  taskId: string;                  // Reference to parent task
  activityId: string;              // Activity identifier (excavation, cable-laying, etc.)
  name: string;                    // Activity name (EXCAVATION, CLEANING, etc.)
  unit: string;                    // Unit of measurement (m, Nos, etc.)
  
  // Status
  status: 'LOCKED' | 'OPEN' | 'DONE';
  
  // Values
  scopeValue: number;              // Total scope set by Planner
  qcValue: number;                 // QC approved value
  completedToday: number;          // Daily progress input
  targetTomorrow: number;          // Next day target
  
  // Requests
  scopeRequested: boolean;         // Supervisor requested scope approval
  qcRequested: boolean;            // Supervisor requested QC inspection
  
  // Metadata
  notes: string;                   // Activity-specific notes
  updatedAt: timestamp;
  updatedBy: string;               // Last user who updated
  createdAt: timestamp;
}
```

**Indexes:**
1. **Single Field Indexes:**
   - `taskId` - Get all activities for a task
   - `activityId` - Filter by activity type
   - `status` - Filter by status

2. **Composite Indexes:**
   - `taskId + activityId` - Get specific activity for task
   - `taskId + status` - Get locked/open/done activities for task
   - `taskId + updatedAt` - Recently updated activities for task (descending)
   - `status + scopeRequested` - Find activities awaiting scope approval
   - `status + qcRequested` - Find activities awaiting QC inspection

**Rationale:**
- Each task has multiple activities (10+ activities per task)
- Supervisors update activity progress daily
- QC and Planner need to view pending requests
- Progress tracking requires frequent status filtering

---

### 3. Requests Collection
**Collection Name:** `requests`

**Purpose:** Track all requests (Task Access, Scope Approval, QC Inspection)

**Fields:**
```typescript
{
  id: string;                      // Auto-generated
  type: 'TASK_ACCESS' | 'ACTIVITY_SCOPE' | 'QC_REQUEST';
  
  // References
  taskId: string;                  // Reference to task
  activityId?: string;             // Reference to activity (for scope/QC requests)
  
  // Requestor & Approver
  requestedBy: string;             // Supervisor user ID
  requestedTo: string;             // Planner/QC user ID
  
  // Status
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  
  // Request Details
  message?: string;                // Optional message from supervisor
  response?: string;               // Optional response from planner/QC
  
  // QC Specific (for QC_REQUEST type)
  eta?: string;                    // This AM / This PM / Tomorrow / Date
  qcComment?: string;              // QC inspector comment
  
  // Metadata
  createdAt: timestamp;
  updatedAt: timestamp;
  resolvedAt?: timestamp;
}
```

**Indexes:**
1. **Single Field Indexes:**
   - `type` - Filter by request type
   - `status` - Filter by status
   - `requestedBy` - Get all requests from a supervisor
   - `requestedTo` - Get all requests assigned to planner/QC

2. **Composite Indexes:**
   - `type + status + createdAt` - Pending requests by type, sorted by date
   - `requestedBy + status + createdAt` - Supervisor's requests by status
   - `requestedTo + status + createdAt` - Planner/QC's pending requests
   - `taskId + activityId + type` - Find specific request for activity
   - `status + type + updatedAt` - Recent request activity

**Rationale:**
- Central request tracking system
- Supervisors send multiple request types
- Planners/QC need organized inboxes
- Request history and audit trail

---

### 4. Progress Log Collection
**Collection Name:** `progressLog`

**Purpose:** Daily progress history and audit trail

**Fields:**
```typescript
{
  id: string;
  taskId: string;
  activityId: string;
  
  // Daily Values
  date: timestamp;                 // Date of progress
  completedToday: number;
  targetTomorrow: number;
  qcValue: number;                 // Running total
  scopeValue: number;              // Scope at time of entry
  
  // Metadata
  recordedBy: string;              // User ID (Supervisor)
  createdAt: timestamp;
}
```

**Indexes:**
1. **Single Field Indexes:**
   - `taskId` - Get progress for task
   - `activityId` - Get progress for activity

2. **Composite Indexes:**
   - `taskId + activityId + date` - Get progress for specific activity on date
   - `taskId + date` - Get all progress for task on date (descending)
   - `activityId + date` - Historical progress for activity type

**Rationale:**
- Historical tracking of daily progress
- Reporting and analytics
- Audit trail for progress entries

---

## Index Summary

### Total Collections: 4
1. Tasks
2. Activities  
3. Requests
4. Progress Log

### Total Indexes Required: ~25-30

**Breakdown by Collection:**
- **Tasks:** 8-9 indexes (single + composite)
- **Activities:** 7-8 indexes (single + composite)
- **Requests:** 8-9 indexes (single + composite)
- **Progress Log:** 5-6 indexes (single + composite)

---

## Index Types Explained

### Single Field Indexes
Index on one field only. Example:
- Index on `status` allows quick queries like: "Find all LOCKED activities"

### Composite Indexes
Index on multiple fields together. Example:
- Index on `taskId + activityId` allows: "Find specific activity for a task"
- Index on `supervisorId + status + createdAt` allows: "Find pending tasks for supervisor, sorted by date"

**Why Composite?**
Firestore requires composite indexes when:
1. Filtering on multiple fields
2. Filtering + sorting on different fields
3. Array membership + other filters

---

## Query Patterns

### Common Supervisor Queries
```typescript
// 1. Get all tasks for supervisor
tasks.where('supervisorId', '==', userId)
     .where('status', '==', 'APPROVED')
     .orderBy('createdAt', 'desc')

// 2. Get activities for specific task
activities.where('taskId', '==', taskId)
          .orderBy('updatedAt', 'desc')

// 3. Get pending requests sent by supervisor
requests.where('requestedBy', '==', userId)
        .where('status', '==', 'PENDING')
        .orderBy('createdAt', 'desc')
```

### Common Planner Queries
```typescript
// 1. Get pending task access requests
requests.where('type', '==', 'TASK_ACCESS')
        .where('status', '==', 'PENDING')
        .orderBy('createdAt', 'desc')

// 2. Get activities awaiting scope approval
activities.where('status', '==', 'LOCKED')
          .where('scopeRequested', '==', true)

// 3. Get all tasks for activity type
tasks.where('activity', '==', 'trenching')
     .orderBy('createdAt', 'desc')
```

### Common QC Queries
```typescript
// 1. Get pending QC requests
requests.where('type', '==', 'QC_REQUEST')
        .where('status', '==', 'PENDING')
        .where('requestedTo', '==', qcUserId)
        .orderBy('createdAt', 'desc')

// 2. Get activities ready for QC
activities.where('status', '==', 'OPEN')
          .where('qcRequested', '==', true)
```

---

## Creating Indexes

### Method 1: Automatic (Recommended)
When you run a query that needs an index, Firebase will:
1. Show an error with a direct link
2. Click the link to create the index automatically
3. Wait 2-5 minutes for index to build

### Method 2: Firebase Console
1. Go to Firebase Console → Firestore → Indexes
2. Click "Create Index"
3. Select collection and fields
4. Set ascending/descending order
5. Click "Create"

### Method 3: Configuration File
Use the included `firestore.indexes.json` file:
```bash
firebase deploy --only firestore:indexes
```

---

## Performance Considerations

### Index Size
- Each composite index adds storage overhead
- ~25-30 indexes is normal for this system size
- Monitor index size in Firebase Console

### Write Performance
- More indexes = slightly slower writes
- Impact is minimal for this use case
- Reads are much more frequent than writes

### Query Optimization
- Always filter on indexed fields
- Use composite indexes for complex queries
- Limit result sets with `.limit()`

---

## Security Rules

Indexes work with Security Rules:
```javascript
// Example: Supervisor can only read their tasks
match /tasks/{taskId} {
  allow read: if request.auth.uid == resource.data.supervisorId
              || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'Planner'
              || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'master';
}
```

---

## Maintenance

### Regular Tasks
1. **Monitor Index Usage**
   - Firebase Console → Firestore → Indexes
   - Check for unused indexes

2. **Clean Up Old Data**
   - Archive completed tasks after 6-12 months
   - Keep progress log for reporting

3. **Index Optimization**
   - Review slow queries in Firebase Console
   - Add indexes as needed

---

Last Updated: January 2025
