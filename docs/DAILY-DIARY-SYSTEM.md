# Daily Diary System

## Overview
Daily diary system for supervisors and plant managers to log daily activities, notes, and observations.

## Date: December 2025

## Collections

### 1. Supervisor Daily Diary
**Collection:** `activities`

#### Structure
```typescript
{
  id: string;
  supervisorId: string;
  supervisorName: string;
  siteId: string;
  date: Timestamp;
  entries: Array<{
    timestamp: Timestamp;
    type: 'NOTE' | 'ISSUE' | 'OBSERVATION' | 'EQUIPMENT' | 'SAFETY';
    title: string;
    description: string;
    photos?: string[];
    location?: {
      latitude: number;
      longitude: number;
    };
  }>;
  weather?: {
    condition: string;
    temperature?: number;
  };
  staffPresent?: number;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
```

#### Usage
- Supervisors log daily site activities
- Linked to activities collection (already established in codebase)
- Filtered by `supervisorId` to show only that supervisor's entries
- Can attach photos, location, and categorize entry types

### 2. Plant Manager Daily Diary
**Collection:** `plantManagerDiary`

#### Structure
```typescript
{
  id: string;
  plantManagerId: string;
  plantManagerName: string;
  siteId: string;
  date: Timestamp;
  entries: Array<{
    timestamp: Timestamp;
    type: 'ALLOCATION' | 'MAINTENANCE' | 'ISSUE' | 'NOTE' | 'INSPECTION';
    title: string;
    description: string;
    relatedAssetId?: string;
    relatedAssetNumber?: string;
    photos?: string[];
  }>;
  assetsSummary?: {
    totalActive: number;
    scheduledToday: number;
    maintenanceRequired: number;
  };
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
```

#### Usage
- Plant managers log asset-related daily activities
- Separate collection from supervisor activities
- Can reference specific plant assets
- Includes asset summary for the day

## Key Differences

### Why Separate Collections?

1. **Supervisor Activities Collection**
   - Already established in codebase
   - Linked to tasks, activities, and site work
   - Multiple entry types for site operations
   - Query: `activities` filtered by `supervisorId`

2. **Plant Manager Diary Collection** 
   - New dedicated collection: `plantManagerDiary`
   - Focused on plant/equipment management
   - Different data structure optimized for asset tracking
   - Query: `plantManagerDiary` filtered by `plantManagerId`

### Data Isolation Benefits
- ✅ Clean separation of concerns
- ✅ Optimized queries (no mixing of data types)
- ✅ Different access patterns
- ✅ Easier to apply role-based permissions
- ✅ Scalability (plant diary won't bloat activities collection)

## Firebase Indexes Required

### Supervisor Activities
```
Collection: activities
Fields:
  - supervisorId (Ascending)
  - date (Descending)
```

### Plant Manager Diary
```
Collection: plantManagerDiary
Fields:
  - plantManagerId (Ascending)
  - date (Descending)

Collection: plantManagerDiary
Fields:
  - siteId (Ascending)
  - date (Descending)
```

## Implementation Files

### Screens
- `app/daily-diary.tsx` - Supervisor daily diary screen
- `app/plant-manager-diary.tsx` - Plant manager daily diary screen

### Expected Features
1. **Create Entry**
   - Add timestamped entries throughout the day
   - Categorize by type
   - Attach photos
   - Add location (for supervisors)

2. **View History**
   - Browse past diary entries
   - Filter by date range
   - Search entries
   - Export reports

3. **Entry Types**
   - Supervisors: Notes, Issues, Observations, Equipment, Safety
   - Plant Managers: Allocation, Maintenance, Issue, Note, Inspection

4. **Photo Attachments**
   - Capture/upload photos
   - Link to specific entries
   - Store in Firebase Storage

## Workflow Examples

### Supervisor Daily Log
```typescript
// Morning entry
{
  timestamp: '2025-12-08T07:00:00Z',
  type: 'NOTE',
  title: 'Morning Site Check',
  description: 'All equipment operational, weather clear',
  staffPresent: 15
}

// Issue during day
{
  timestamp: '2025-12-08T11:30:00Z',
  type: 'ISSUE',
  title: 'Excavator Breakdown',
  description: 'Hydraulic leak on excavator PL-123',
  photos: ['photo1.jpg']
}
```

### Plant Manager Daily Log
```typescript
// Asset allocation
{
  timestamp: '2025-12-08T08:00:00Z',
  type: 'ALLOCATION',
  title: 'Excavator Allocated to Site B',
  relatedAssetId: 'asset-123',
  relatedAssetNumber: 'PL-123'
}

// Maintenance note
{
  timestamp: '2025-12-08T14:00:00Z',
  type: 'MAINTENANCE',
  title: 'Scheduled Service Completed',
  description: 'Annual service on dump truck DT-456',
  relatedAssetId: 'asset-456'
}
```

## Security Rules

```javascript
// Supervisor can only write to their own diary
match /activities/{activityId} {
  allow read: if request.auth != null && 
    (request.auth.uid == resource.data.supervisorId ||
     hasRole('ADMIN'));
  allow write: if request.auth != null && 
    request.auth.uid == request.resource.data.supervisorId;
}

// Plant Manager can only write to their own diary
match /plantManagerDiary/{diaryId} {
  allow read: if request.auth != null && 
    (request.auth.uid == resource.data.plantManagerId ||
     hasRole('ADMIN') ||
     hasRole('MASTER'));
  allow write: if request.auth != null && 
    request.auth.uid == request.resource.data.plantManagerId;
}
```

## Benefits

### For Supervisors
- Track daily site progress
- Document issues as they occur
- Record safety observations
- Historical record for reports

### For Plant Managers
- Log asset movements and allocations
- Track maintenance activities
- Document equipment issues
- Generate utilization reports

### For Management
- Comprehensive site activity logs
- Audit trail for equipment usage
- Issue tracking and resolution
- Performance metrics and reporting

## Future Enhancements
- Voice-to-text entry
- Automatic weather integration
- Integration with task completion
- PDF export of daily logs
- Team/site-wide diary view for admins
- Analytics dashboard from diary data
- Reminder system for daily logging

## Related Documentation
- `docs/SUPERVISOR-BUILD-SUMMARY.md` - Supervisor role documentation
- `docs/PLANT-ASSET-ALLOCATION-SYSTEM.md` - Plant asset system
- `docs/USER-ROLES.md` - User roles and permissions
