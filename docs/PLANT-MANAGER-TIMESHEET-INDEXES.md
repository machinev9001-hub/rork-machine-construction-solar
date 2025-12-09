# Plant Manager Timesheet Indexes

## Overview
This document describes the required Firebase indexes for the plant manager timesheet management system, which includes both plant hours and man hours verification with filtering capabilities.

## Required Indexes

### 1. Plant Assets by Subcontractor Owner
**Purpose**: Filter plant assets by subcontractor for plant hours timesheets
```
Collection: plantAssets
Fields (in order):
  - masterAccountId (Ascending)
  - siteId (Ascending)
  - ownerId (Ascending)
  - ownerType (Ascending)
```

### 2. Subcollection: Plant Asset Timesheets by Date Range
**Purpose**: Retrieve timesheets for a specific plant asset within a date range
```
Collection Group: timesheets (subcollection of plantAssets)
Fields (in order):
  - date (Ascending)
```

### 3. Operator Timesheets by Site and Date Range
**Purpose**: Retrieve unverified man hours timesheets for a site within a date range
```
Collection: operatorTimesheets
Fields (in order):
  - masterAccountId (Ascending)
  - siteId (Ascending)
  - date (Ascending)
```

### 4. Verified Timesheets - Plant Hours
**Purpose**: Store and query verified plant hours timesheets for billing
```
Collection: verifiedTimesheets
Fields (in order):
  - masterAccountId (Ascending)
  - siteId (Ascending)
  - type (Ascending)
  - verifiedAt (Descending)
```

### 5. Verified Timesheets - By Asset Owner
**Purpose**: Query verified plant timesheets by subcontractor for billing
```
Collection: verifiedTimesheets
Fields (in order):
  - masterAccountId (Ascending)
  - ownerId (Ascending)
  - ownerType (Ascending)
  - verifiedAt (Descending)
```

### 6. Verified Timesheets - By Operator
**Purpose**: Query verified man hours by operator for billing
```
Collection: verifiedTimesheets
Fields (in order):
  - masterAccountId (Ascending)
  - operatorId (Ascending)
  - type (Ascending)
  - verifiedAt (Descending)
```

## Database Structure

### Collection: `verifiedTimesheets`
This new collection stores all verified timesheets (both plant hours and man hours) that have been approved by the plant manager and are ready for billing.

#### Plant Hours Document Structure
```typescript
{
  // Original timesheet data
  date: string;
  openHours: number;
  closeHours: number;
  totalHours: number;
  operatorName: string;
  operatorId: string;
  isBreakdown: boolean;
  inclementWeather: boolean;
  hasAttachment: boolean;
  
  // Asset information
  assetId: string;
  assetType: string;
  plantNumber: string;
  registrationNumber: string;
  ownerId: string;
  ownerType: 'subcontractor' | 'company';
  ownerName: string;
  
  // Adjustment tracking
  hasOriginalEntry?: boolean;
  originalEntryData?: object;
  isAdjustment?: boolean;
  originalEntryId?: string;
  adjustedBy?: string;
  adjustedAt?: string;
  
  // Verification
  verified: true;
  verifiedBy: string;
  verifiedAt: string;
  
  // Multi-tenant
  masterAccountId: string;
  siteId: string;
  type: 'plant_hours';
}
```

#### Man Hours Document Structure
```typescript
{
  // Original timesheet data
  date: string;
  startTime: string;
  stopTime: string;
  totalManHours: number;
  normalHours: number;
  overtimeHours: number;
  sundayHours: number;
  publicHolidayHours: number;
  noLunchBreak: boolean;
  operatorId: string;
  operatorName: string;
  
  // Adjustment tracking
  hasOriginalEntry?: boolean;
  originalEntryData?: object;
  isAdjustment?: boolean;
  originalEntryId?: string;
  adjustedBy?: string;
  adjustedAt?: string;
  
  // Verification
  verified: true;
  verifiedBy: string;
  verifiedAt: string;
  
  // Multi-tenant
  masterAccountId: string;
  siteId: string;
  type: 'man_hours';
}
```

## Adjustment System

The dual-entry system works as follows:

1. **Operator submits timesheet** → Creates entry in `plantAssets/{id}/timesheets` or `operatorTimesheets`
2. **Plant Manager edits timesheet** → Creates new adjustment entry with `isAdjustment: true`, original entry marked with `hasAdjustment: true`
3. **Plant Manager verifies** → Both original and adjustment (if exists) are marked as verified
4. **Filed to billing** → Adjustment values (if exist) are used for billing, with original preserved for audit trail

### Advantages:
- **Audit trail**: Original operator entry is preserved
- **Dispute resolution**: Can compare original vs adjusted values
- **Operator clarity**: Operators see their original submission unchanged
- **Billing accuracy**: Adjustments are clearly tracked for billing purposes

## Query Examples

### Load Plant Timesheets for Subcontractor
```typescript
// Get assets owned by subcontractor
const assetsQuery = query(
  collection(db, 'plantAssets'),
  where('masterAccountId', '==', masterAccountId),
  where('siteId', '==', siteId),
  where('ownerId', '==', subcontractorId),
  where('ownerType', '==', 'subcontractor')
);

// For each asset, get timesheets in date range
const timesheetsQuery = query(
  collection(db, 'plantAssets', assetId, 'timesheets'),
  where('date', '>=', startDate),
  where('date', '<=', endDate),
  orderBy('date', 'asc')
);
```

### Load Man Hours Timesheets
```typescript
const timesheetsQuery = query(
  collection(db, 'operatorTimesheets'),
  where('masterAccountId', '==', masterAccountId),
  where('siteId', '==', siteId),
  where('date', '>=', startDate),
  where('date', '<=', endDate),
  orderBy('date', 'asc')
);
```

### Query Verified Timesheets for Billing
```typescript
// All verified plant hours for a subcontractor
const verifiedQuery = query(
  collection(db, 'verifiedTimesheets'),
  where('masterAccountId', '==', masterAccountId),
  where('ownerId', '==', subcontractorId),
  where('ownerType', '==', 'subcontractor'),
  orderBy('verifiedAt', 'desc')
);

// All verified man hours for a period
const manHoursQuery = query(
  collection(db, 'verifiedTimesheets'),
  where('masterAccountId', '==', masterAccountId),
  where('siteId', '==', siteId),
  where('type', '==', 'man_hours'),
  where('verifiedAt', '>=', periodStart),
  where('verifiedAt', '<=', periodEnd),
  orderBy('verifiedAt', 'desc')
);
```

## Integration with Billing System

Verified timesheets flow to the billing management system in `app/accounts/index.tsx` where they appear in the "Timesheets" tab for generating invoices and reports.

### Billing Queries Needed
These indexes are also needed for the billing/accounts module:

```
Collection: verifiedTimesheets
Fields (in order):
  - masterAccountId (Ascending)
  - siteId (Ascending)
  - date (Ascending)
  - type (Ascending)
```

```
Collection: verifiedTimesheets
Fields (in order):
  - masterAccountId (Ascending)
  - ownerId (Ascending)
  - date (Ascending)
```

## Implementation Notes

1. **Timesheets become visible immediately**: As soon as an operator creates the first entry, it appears in the plant manager's timesheet screen as "unverified"

2. **Weekly grouping**: Timesheets are grouped by week based on the date range of entries, not by calendar week

3. **Expandable blocks**: Each plant asset or operator gets an expandable block showing all unverified entries for the selected date range

4. **Filter persistence**: Plant type filter is dynamic based on loaded assets (changes based on subcontractor selection)

5. **Verification flow**: 
   - Original entry marked `verified: true`
   - Adjustment entry (if exists) marked `verified: true`
   - Combined data added to `verifiedTimesheets` collection
   - Entries disappear from plant manager's unverified view

## Security Rules Considerations

```javascript
// Plant manager can read unverified timesheets for their site
match /plantAssets/{assetId}/timesheets/{timesheetId} {
  allow read: if request.auth != null 
    && get(/databases/$(database)/documents/employees/$(request.auth.uid)).data.role == 'plant_manager'
    && get(/databases/$(database)/documents/employees/$(request.auth.uid)).data.siteId == resource.data.siteId;
  
  allow update: if request.auth != null 
    && get(/databases/$(database)/documents/employees/$(request.auth.uid)).data.role == 'plant_manager'
    && (request.resource.data.verified == true || request.resource.data.hasAdjustment == true);
  
  allow create: if request.auth != null
    && request.resource.data.isAdjustment == true
    && get(/databases/$(database)/documents/employees/$(request.auth.uid)).data.role == 'plant_manager';
}

// Verified timesheets are read-only for billing team
match /verifiedTimesheets/{timesheetId} {
  allow read: if request.auth != null 
    && (get(/databases/$(database)/documents/employees/$(request.auth.uid)).data.role in ['plant_manager', 'master', 'accounts']);
  
  allow create: if request.auth != null 
    && get(/databases/$(database)/documents/employees/$(request.auth.uid)).data.role == 'plant_manager'
    && request.resource.data.verified == true;
}
```
