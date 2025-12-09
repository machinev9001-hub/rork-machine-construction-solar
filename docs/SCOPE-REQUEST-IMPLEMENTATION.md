# Scope Request Implementation

## Overview
This document describes the "Unlock on Request" scope behavior and cable laying handoff implementation for the Supervisor module.

## Key Features

### 1. Unlock on Request (Immediate Activity Unlock)

When a Supervisor toggles "Request Scope", the activity unlocks immediately so work can start without waiting for Planner approval.

**Workflow:**
1. Supervisor toggles "Request Scope" → Activity status changes from `LOCKED` to `OPEN`
2. Request is created with status `PENDING` for Planner to review
3. Supervisor can:
   - Start capturing notes/photos
   - Input progress data (Completed Today, Target Tomorrow)
   - Request QC
4. **Yellow banner displays**: "Scope pending — Planner to set value"
5. % Completed shows "—" until Planner sets scope value
6. Once Planner approves and sets scope:
   - `scopeApproved` flag is set to `true`
   - % Completed calculates: `(QC Value / Scope Value) × 100`

**Benefits:**
- Supervisors don't wait for approval to start work
- Planner still maintains control over scope values
- Full audit trail maintained

### 2. Cable Laying Handoff (Trenching → Cabling)

For MV/LV/DC Cable Trench activities named "... Cable Laying", the work is handed off to the Cables module.

**Affected Activities:**
- MV Cable Trench → MV CABLE LAYING
- DC Cable Trench → DC CABLE LAYING  
- LV Cable Trench → LV CABLE LAYING

**Workflow:**
1. These activities have `scopePolicy: 'NONE'` and `cablingHandoff` configuration
2. Instead of "Request Scope", Supervisor sees "Request Cabling" toggle
3. Toggling creates `CABLING_REQUEST` (new request type) with:
   - Type: `CABLING_REQUEST`
   - Target module link (e.g., `mv-cable`)
   - Deep link to appropriate Cables sub-menu
4. Activity status changes to `HANDOFF_SENT`
5. **Purple banner displays**: "Handoff sent to [Cable Type]"
6. Activity becomes read-only in trenching (scope/progress tracked in Cables)
7. Supervisor can expand to see handoff details and "View in Cabling" button

**Benefits:**
- Clear separation of work responsibilities
- Prevents duplicate scope/progress tracking
- Maintains request thread and deep links

## Types Added

```typescript
// types/index.ts
export type RequestType =
  | 'TASK_REQUEST'
  | 'ACTIVITY_SCOPE'
  | 'QC_REQUEST'
  | 'CABLING_REQUEST';

export type ActivityStatus = 
  | 'LOCKED' 
  | 'OPEN' 
  | 'DONE' 
  | 'HANDOFF_SENT';

export type ScopePolicy = 'NORMAL' | 'NONE';
```

## Data Structure Changes

### ActivityItem (constants/activities.ts)
```typescript
export type ActivityItem = {
  id: string;
  name: string;
  unit: string;
  scopePolicy?: 'NORMAL' | 'NONE';
  cablingHandoff?: {
    targetModule: 'mv-cable' | 'dc-cable' | 'lv-cable';
  };
};
```

### ActivityDetail (supervisor-task-detail.tsx)
```typescript
type ActivityDetail = {
  id: string;
  name: string;
  status: ActivityStatus;
  scopeValue: number;
  scopeApproved: boolean;  // NEW: tracks if Planner set scope
  qcValue: number;
  completedToday: number;
  targetTomorrow: number;
  unit: string;
  updatedAt: string;
  notes: string;
  scopeRequested: boolean;
  qcRequested: boolean;
  cablingRequested: boolean;  // NEW: for cable laying handoff
  scopePolicy: 'NORMAL' | 'NONE';
  cablingHandoff?: {
    targetModule: 'mv-cable' | 'dc-cable' | 'lv-cable';
  };
};
```

## Database Indexes

Added new composite index for cabling requests:
```json
{
  "collectionGroup": "requests",
  "fields": [
    { "fieldPath": "targetModule", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

This index supports queries for:
- Finding all CABLING_REQUEST by target module (mv-cable, dc-cable, lv-cable)
- Filtering by status (PENDING, APPROVED, REJECTED)
- Ordering by creation date

## UI Components

### Scope Pending Banner
Displayed when activity is OPEN but scope not yet approved:
```tsx
<View style={styles.scopePendingBanner}>
  <AlertCircle size={16} color="#f59e0b" />
  <Text style={styles.scopePendingText}>
    Scope pending — Planner to set value
  </Text>
</View>
```

### Handoff Banner
Displayed when activity has HANDOFF_SENT status:
```tsx
<View style={styles.handoffBanner}>
  <Link2 size={16} color="#8b5cf6" />
  <Text style={styles.handoffText}>
    Handoff sent to {targetModuleName}
  </Text>
</View>
```

### Request Toggles
- **Scope Request**: Green color matching activity theme
- **Cabling Request**: Purple color (#8b5cf6) for Cables handoff
- **QC Request**: Green color matching activity theme

## Status Badge Colors

| Status | Background | Text Color |
|--------|-----------|-----------|
| LOCKED | #f1f5f9 | #94a3b8 |
| OPEN | #fef3c7 | #f59e0b |
| DONE | #d1fae5 | #10b981 |
| HANDOFF_SENT | #ede9fe | #8b5cf6 |

## Percentage Calculation Logic

```typescript
const calculatePercentage = (
  qc: number, 
  scope: number, 
  scopeApproved: boolean
): string => {
  if (!scopeApproved || scope === 0) return '—';
  return ((qc / scope) * 100).toFixed(2);
};
```

Returns "—" when:
- Scope not yet approved by Planner
- Scope value is 0

## Future Enhancements

1. **Deep Links**: Implement actual navigation to Cables module when clicking "View in Cabling"
2. **Request Notifications**: Push notifications when requests are approved/rejected
3. **Planner UI**: Build Planner interface to review and approve requests
4. **Real-time Updates**: Use Firestore listeners to update UI when Planner sets scope
5. **Request History**: Show request thread with messages and status changes
6. **Validation**: Add validation for scope values and QC inputs
7. **Photo Attachments**: Allow supervisors to attach photos to notes

## Testing Checklist

- [ ] Toggle Request Scope changes status from LOCKED to OPEN
- [ ] Yellow banner shows when scope pending
- [ ] % Completed shows "—" until scope approved
- [ ] Toggle Request Cabling for cable laying activities
- [ ] Status changes to HANDOFF_SENT
- [ ] Purple banner shows with correct target module
- [ ] Expanded view shows handoff details
- [ ] Toggle switches use correct colors
- [ ] Can capture notes/photos when OPEN
- [ ] Can cancel requests by toggling off
- [ ] Task Information section expands/collapses
- [ ] Activity cards expand/collapses
- [ ] Save button in header works

## Console Logs

The implementation includes comprehensive console logs for debugging:
- Scope request sent/cancelled
- Cabling request sent/cancelled  
- QC request sent/cancelled
- Activity status changes
- Navigation intents

Check browser/device console for these logs during testing.
