# Request Workflows - Complete Guide

## Overview
This document consolidates all request workflow implementations including task requests, activity requests, QC, cabling, terminations, handovers, surveyor, concrete, and commissioning workflows.

---

## Core Request System

### Request Document Structure

```typescript
interface Request {
  id: string;
  type: 'TASK_REQUEST' | 'SCOPE_REQUEST' | 'QC_REQUEST' | 
        'CABLING_REQUEST' | 'TERMINATION_REQUEST' | 'SURVEYOR_REQUEST' |
        'HANDOVER_REQUEST' | 'CONCRETE_REQUEST' | 'COMMISSIONING_REQUEST';
  siteId: string;
  taskId?: string;
  activityId?: string;
  requestedBy: string;
  requestedByName: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: Timestamp;
  notes?: string;
  // Additional fields per request type
}
```

---

## 1. Task Request Workflow

### Purpose
Supervisor requests initial access to a task from Planner.

### Flow
```
Supervisor (Master Supervisor screen)
  ↓ Tap "Request Access to New Task"
  ↓ Fill task details
  ↓ Submit request (P0 priority)
  ↓
Planner (Task Requests screen)
  ↓ Reviews request
  ↓ Approves or Rejects
  ↓
Supervisor
  ↓ Receives notification
  ↓ Task appears in task list (if approved)
```

### Implementation Files
- `app/supervisor-task-request.tsx` - Submission screen
- `app/planner-task-requests.tsx` - Review screen
- `utils/messaging.ts` - Notifications

### Request Data
```typescript
{
  type: 'TASK_REQUEST',
  taskName: string,
  subActivity: string,
  location: string,
  description?: string,
  status: 'Pending'
}
```

---

## 2. Activity/Scope Request Workflow

### Purpose
Supervisor requests scope approval before starting an activity.

### Flow
```
Supervisor (Activity Detail)
  ↓ Tap "Request Scope Approval"
  ↓ Enter scope details
  ↓ Submit request (P0 priority)
  ↓
Planner (Activity Requests screen)
  ↓ Reviews scope
  ↓ Approves with scope value or Rejects
  ↓ Updates activity.scopeApproved = true/false
  ↓ Updates activity.scopeValue
  ↓
Supervisor
  ↓ Sees scope status updated
  ↓ Can now enter progress (if approved)
```

### Scope Lock Rules
1. If `scopeRequested = true` AND `scopeApproved = false` → LOCKED
2. Cannot enter completedToday until scope approved
3. Warning shows: "Scope approval pending"

### Implementation Files
- `app/supervisor-activity.tsx` - Submission screen
- `app/planner-activity-requests.tsx` - Review screen
- `utils/scope.ts` - Scope utilities

### Request Data
```typescript
{
  type: 'SCOPE_REQUEST',
  taskId: string,
  activityId: string,
  activityName: string,
  proposedScope: number,
  unit: string,
  status: 'Pending'
}
```

---

## 3. QC Request Workflow

### Purpose
Supervisor requests quality control inspection after completing work.

### Flow
```
Supervisor (Activity Detail)
  ↓ Tap "Request QC Inspection"
  ↓ Submit request (P0 priority)
  ↓ Activity.qcRequested = true
  ↓
Planner/QC Team (QC Requests screen)
  ↓ Reviews request
  ↓ Approves or Rejects
  ↓ If approved: Activity.qcApproved = true
  ↓
Supervisor
  ↓ Sees QC status updated
  ↓ Can mark activity complete (if approved)
```

### QC Value Toggle Lock
- QC value can only be toggled ONCE per day
- Lock resets at midnight local time
- Prevents accidental re-toggling during same day

### Implementation Files
- `app/supervisor-activity.tsx` - Request initiation
- `app/planner-qc-requests.tsx` - Review screen
- `app/qc-requests.tsx`, `app/qc-scheduled.tsx`, `app/qc-completed.tsx` - QC team views
- `utils/completedTodayLock.ts` - Lock management
- `components/QCRequestCard.tsx` - Request card UI

### Request Data
```typescript
{
  type: 'QC_REQUEST',
  taskId: string,
  activityId: string,
  activityName: string,
  completedQuantity: number,
  unit: string,
  status: 'Pending'
}
```

---

## 4. Cabling Request Workflow

### Purpose
Supervisor requests cabling handoff when ready for cable installation.

### Flow
```
Supervisor (Activity Detail)
  ↓ Tap "Request Cabling Handoff"
  ↓ Submit request (P0 priority)
  ↓ Activity.cablingRequested = true
  ↓
Planner (Cabling Requests screen)
  ↓ Reviews request
  ↓ Approves or Rejects
  ↓ If approved: Activity.cablingApproved = true
  ↓
Supervisor
  ↓ Sees cabling status updated
  ↓ Activity handed off to cabling team
```

### Implementation Files
- `app/supervisor-activity.tsx` - Request initiation
- `app/planner-cabling-requests.tsx` - Review screen

### Request Data
```typescript
{
  type: 'CABLING_REQUEST',
  taskId: string,
  activityId: string,
  activityName: string,
  status: 'Pending'
}
```

---

## 5. Termination Request Workflow

### Purpose
Supervisor requests LV termination work handoff.

### Flow
```
Supervisor (Activity Detail)
  ↓ Tap "Request Termination Handoff"
  ↓ Submit request (P0 priority)
  ↓ Activity.terminationRequested = true
  ↓
Planner (Termination Requests screen)
  ↓ Reviews request
  ↓ Approves or Rejects
  ↓ If approved: Activity.terminationApproved = true
  ↓
Supervisor
  ↓ Sees termination status updated
  ↓ Activity handed off to LV termination team
```

### Implementation Files
- `app/supervisor-activity.tsx` - Request initiation
- `app/planner-termination-requests.tsx` - Review screen

### Request Data
```typescript
{
  type: 'TERMINATION_REQUEST',
  taskId: string,
  activityId: string,
  activityName: string,
  status: 'Pending'
}
```

---

## 6. Handover Request Workflow

### Purpose
Generic handover system for surveyor, drilling, mechanical, electrical, and custom handovers.

### Flow
```
Supervisor (Activity Detail)
  ↓ Tap "Request Handover"
  ↓ Select handover type
  ↓ Submit request (P0 priority)
  ↓ Activity.handoverRequests[] updated
  ↓
Planner/Scheduler (Handover Requests screen)
  ↓ Reviews request
  ↓ Schedules handover with date/time
  ↓ Notifies relevant team
  ↓
Supervisor
  ↓ Sees handover scheduled
  ↓ Can proceed with work
```

### Handover Types
- Surveyor Handover
- Drilling Handover
- Mechanical Handover
- Electrical Handover
- Custom Handovers (user-defined)

### Implementation Files
- `app/supervisor-activity.tsx` - Request initiation
- `app/planner-handover-requests.tsx` - Review/scheduling screen
- `utils/handover.ts` - Handover utilities
- `components/HandoverCard.tsx` - Handover card UI

### Request Data
```typescript
{
  type: 'HANDOVER_REQUEST',
  taskId: string,
  activityId: string,
  activityName: string,
  handoverType: string,
  handoverDescription?: string,
  scheduledDate?: Timestamp,
  scheduledTime?: string,
  status: 'Pending' | 'Scheduled' | 'Completed'
}
```

---

## 7. Surveyor Request Workflow

### Purpose
Dedicated surveyor approval workflow with image library integration.

### Flow
```
Supervisor (Activity Detail)
  ↓ Request surveyor approval
  ↓ Submit request (P0 priority)
  ↓
Planner (Surveyor Requests screen)
  ↓ Reviews request
  ↓ Approves with surveyor images from library
  ↓ Images attached to activity
  ↓
Supervisor
  ↓ Sees surveyor approval
  ↓ Can view attached images
```

### Image Library
- Surveyors maintain image library
- Images stored offline for quick access
- Tagged and searchable
- Can be reused across multiple approvals

### Implementation Files
- `app/planner-surveyor-requests.tsx` - Review screen
- `utils/surveyorImageLibrary.ts` - Image management
- `utils/hooks/useSurveyorImages.ts` - Image hook
- `components/HandoverCard.tsx` - Surveyor card (reused)

---

## 8. Concrete Request Workflow

### Purpose
Request concrete pouring approvals and scheduling.

### Flow
```
Supervisor (Activity Detail)
  ↓ Request concrete pour approval
  ↓ Specify pour details (volume, date, etc.)
  ↓ Submit request (P0 priority)
  ↓
Planner (Concrete Requests screen)
  ↓ Reviews request
  ↓ Approves and schedules concrete delivery
  ↓
Supervisor
  ↓ Sees pour scheduled
  ↓ Receives delivery details
```

### Implementation Files
- `app/planner-concrete-requests.tsx` - Review screen

---

## 9. Commissioning Request Workflow

### Purpose
Request commissioning tests and inspections for LV terminations and other systems.

### Flow
```
Supervisor (Activity Detail)
  ↓ Request commissioning
  ↓ Specify test requirements
  ↓ Submit request (P0 priority)
  ↓
Planner (Commissioning Requests screen)
  ↓ Reviews request
  ↓ Schedules commissioning team
  ↓ Assigns test procedures
  ↓
Supervisor
  ↓ Sees commissioning scheduled
  ↓ Receives test results when complete
```

### Implementation Files
- `app/planner-commissioning-requests.tsx` - Review screen

---

## Request Recipient Targeting

### How Recipients Are Determined

Each request type has specific recipients:

```typescript
// Task Request → All Planners
recipientIds = getAllPlanners(siteId);

// Activity/Scope Request → Task's assigned Planner
recipientIds = [task.plannerId];

// QC Request → All QC staff + Planners
recipientIds = [...getAllQC(siteId), ...getAllPlanners(siteId)];

// Cabling Request → Task's assigned Planner
recipientIds = [task.plannerId];

// Termination Request → Task's assigned Planner
recipientIds = [task.plannerId];

// Handover Request → Scheduler or Planner
recipientIds = [scheduler || planner];

// Surveyor Request → Task's assigned Planner
recipientIds = [task.plannerId];

// Concrete Request → Task's assigned Planner
recipientIds = [task.plannerId];

// Commissioning Request → Task's assigned Planner
recipientIds = [task.plannerId];
```

---

## Completed Today Lock System

### Purpose
Prevent duplicate progress entries on the same day.

### Rules
1. Supervisor enters `completedToday` value
2. Value is locked for the current day (local timezone)
3. Lock resets at midnight (00:00 local time)
4. Next day, supervisor can enter new value

### Implementation
```typescript
import { canSubmitCompletedToday, getLastSubmissionDate } from '@/utils/completedTodayLock';

const canSubmit = await canSubmitCompletedToday(activityId);
if (!canSubmit) {
  const lastDate = await getLastSubmissionDate(activityId);
  Alert.alert('Already submitted today', `Last submission: ${lastDate}`);
  return;
}

// Submit progress
await submitProgress(activityId, completedToday);
```

### Files
- `utils/completedTodayLock.ts` - Lock management
- `components/CompletedTodayInput.tsx` - UI component with lock

---

## Task Locking System

### Purpose
Prevent concurrent edits to tasks by multiple users.

### Flow
```
User A opens task
  ↓ Task locked to User A
  ↓ User A makes changes
  ↓ User A saves or navigates away
  ↓ Task unlocked
  
User B tries to open same task
  ↓ Sees "Task locked by User A"
  ↓ Can view read-only
  ↓ Cannot edit until User A releases lock
```

### Implementation Files
- `utils/taskLockCache.ts` - Lock cache management
- `components/TaskLockingOverlay.tsx` - Lock overlay UI
- `utils/offlineQueue.ts` - Offline lock checks

---

## Optimistic Updates

### Purpose
Immediate UI feedback while syncing to Firebase.

### How It Works
```
1. User action (e.g., approve request)
   ↓
2. Update local state immediately
   ↓
3. UI shows updated state
   ↓
4. Queue Firebase write (P0 priority)
   ↓
5. When synced, confirm success
   ↓
6. On error, rollback local state
```

### Implementation
```typescript
// Update UI immediately
setLocalStatus('Approved');

// Queue Firebase write
await queueFirestoreOperation({
  type: 'update',
  collection: 'requests',
  docId: requestId,
  data: { status: 'Approved' }
}, {
  priority: 'P0',
  onSuccess: () => {
    console.log('Synced!');
  },
  onError: () => {
    // Rollback
    setLocalStatus('Pending');
  }
});
```

---

## Best Practices

### 1. Always Use P0 for Critical Requests
```typescript
await queueFirestoreOperation({
  type: 'add',
  collection: 'requests',
  data: requestData
}, {
  priority: 'P0',  // ← Critical!
  entityType: 'taskRequest'
});
```

### 2. Include Recipient Targeting
```typescript
const recipientIds = await getRecipientsForRequest(requestType, task);
requestData.recipientIds = recipientIds;
```

### 3. Send Notifications
```typescript
import { sendMessageToUsers } from '@/utils/messaging';

await sendMessageToUsers({
  userIds: recipientIds,
  siteId: task.siteId,
  type: 'REQUEST_NOTIFICATION',
  title: 'New Task Request',
  body: `${user.name} requested access to ${taskName}`,
  data: { requestId, taskId }
});
```

### 4. Update Activity Flags
```typescript
// When request approved
await updateDoc(activityRef, {
  scopeApproved: true,
  scopeValue: approvedScope,
  updatedAt: Timestamp.now()
});
```

### 5. Handle Offline Gracefully
```typescript
const isOnline = await checkOnlineStatus();
if (!isOnline) {
  Alert.alert('Offline', 'Request will sync when connection restored');
}
```

---

## Common Issues & Solutions

### Issue 1: Request Not Appearing in Planner View
**Cause:** Missing Firebase index or incorrect `siteId`  
**Solution:** Check Firebase indexes and verify `siteId` matches

### Issue 2: Duplicate Requests Created
**Cause:** Multiple taps or missing button protection  
**Solution:** Use `useButtonProtection` hook

### Issue 3: Lock Not Releasing
**Cause:** App crash or improper cleanup  
**Solution:** Implement timeout-based lock expiry (5 minutes)

### Issue 4: Offline Request Not Syncing
**Cause:** P0 priority not set or queue not initialized  
**Solution:** Verify priority is P0 and offline queue is active

---

## Testing Checklist

- [ ] Create each request type offline
- [ ] Verify request appears in planner view when online
- [ ] Approve request and verify supervisor sees update
- [ ] Reject request and verify supervisor gets notification
- [ ] Test lock system (concurrent edits)
- [ ] Test completed today lock (submit twice same day)
- [ ] Test QC toggle lock (toggle twice same day)
- [ ] Test recipient targeting (correct users notified)
- [ ] Test optimistic updates (immediate UI feedback)
- [ ] Test rollback on error

---

## Related Files

**Core Utilities:**
- `utils/messaging.ts` - Notification system
- `utils/scope.ts` - Scope management
- `utils/handover.ts` - Handover utilities
- `utils/completedTodayLock.ts` - Lock management
- `utils/taskLockCache.ts` - Task locking
- `utils/offlineQueue.ts` - Offline sync

**UI Components:**
- `components/RequestCard.tsx` - Generic request card
- `components/QCRequestCard.tsx` - QC-specific card
- `components/HandoverCard.tsx` - Handover card
- `components/CompletedTodayInput.tsx` - Progress input with lock
- `components/TaskLockingOverlay.tsx` - Lock overlay

**Archived Docs:**
- `TASK_REQUEST_WORKFLOW_LOGIC.md` (archived)
- `FIX_TASK_REQUEST_WORKFLOW.md` (archived)
- `REQUEST_WORKFLOW_TEMPLATE.md` (archived)
- `SCOPE_REQUEST_FIX_SUMMARY.md` (archived)
- `QC_WORKFLOW_IMPLEMENTATION_SUMMARY.md` (archived)
- `HANDOVER_SCHEDULER_DEEP_LINK_IMPLEMENTATION.md` (archived)
- `SURVEYOR_APPROVAL_WORKFLOW_IMPLEMENTATION.md` (archived)
- `COMMISSIONING_WORKFLOW_IMPLEMENTATION.md` (archived)
- `LV_TERMINATIONS_COMMISSIONING_IMPLEMENTATION.md` (archived)

---

**Last Updated:** 2025-01-23  
**Status:** Complete and production-ready
