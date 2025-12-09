# Plant Manager to Billing Workflow

## Complete Workflow Documentation

### Overview
This document describes the complete workflow from operator timesheet entry through plant manager verification to billing management.

## The 3-Stage Workflow

### Stage 1: Operator Entry
**Location:** Operator screens (plant hours/man hours entry)

1. Operator fills out timesheet (plant hours or man hours)
2. Timesheet is saved to:
   - Plant Hours: `plantAssets/{assetId}/timesheets/{timesheetId}`
   - Man Hours: `operatorTimesheets/{timesheetId}`
3. Entry is marked as `verified: false` (unverified)

### Stage 2: Plant Manager Verification/Adjustment
**Location:** `app/plant-manager-timesheets.tsx`

#### 2.1 View Unverified Timesheets
- Plant manager loads unverified timesheets (where `verified: false`)
- Timesheets are displayed grouped by asset/operator and week
- UI shows both Plant Hours and Man Hours tabs

#### 2.2 Edit Functionality (Creates Adjustment)
When plant manager clicks "Edit":

1. **First Edit (No existing adjustment):**
   - Creates NEW document with `isAdjustment: true`
   - Marks original entry with `hasAdjustment: true` and `adjustmentId: <newAdjustmentId>`
   - Both entries remain `verified: false`
   - UI displays BOTH lines (operator original + plant manager adjustment)

2. **Subsequent Edits (Adjustment already exists):**
   - Updates the SAME adjustment document (using `adjustmentId` from original)
   - Does NOT create 3rd, 4th, 5th documents
   - Only TWO lines ever exist: operator original + plant manager adjustment

#### 2.3 Verify & Submit to Billing
When plant manager clicks "Verify" (green checkmark button):

1. **Original entry is marked verified:**
   ```typescript
   {
     verified: true,
     verifiedAt: timestamp,
     verifiedBy: plantManagerName
   }
   ```

2. **If adjustment exists, it's also marked verified:**
   ```typescript
   {
     verified: true,
     verifiedAt: timestamp,
     verifiedBy: plantManagerName,
     isAdjustment: true,
     originalEntryId: <originalId>
   }
   ```

3. **BOTH entries (or just original if no adjustment) are filed to billing:**
   - **Plant Hours:** Creates document(s) in `verifiedTimesheets` collection with `type: 'plant_hours'`
   - **Man Hours:** Creates document(s) in `verifiedTimesheets` collection with `type: 'man_hours'`

4. **Entries disappear from plant manager's unverified view** (because `verified: true`)

### Stage 3: Billing Management / Accounts
**Location:** `app/accounts/index.tsx` → Plant Assets tab

#### Current Issue
The accounts screen is NOT loading data from `verifiedTimesheets` collection.

#### Required Behavior

1. **Load Verified Timesheets:**
   ```typescript
   // Query verifiedTimesheets collection
   const query = query(
     collection(db, 'verifiedTimesheets'),
     where('masterAccountId', '==', masterAccountId),
     where('siteId', '==', siteId),
     orderBy('verifiedAt', 'desc')
   );
   ```

2. **Display Both Lines:**
   - If `hasOriginalEntry: true` → Display BOTH:
     - Original operator entry (from `originalEntryData`)
     - Plant manager adjustment entry (main document data)
   - If `hasOriginalEntry: false` → Display single entry (no adjustment made)

3. **Filter Options:**
   - Date range
   - Subcontractor/Owner
   - Operator
   - Plant asset type
   - Entry type (plant_hours vs man_hours)

4. **Export to CSV/Excel:**
   - Include both lines per entry if adjustment exists
   - Mark clearly which is original vs adjustment
   - Include adjustment metadata (adjustedBy, adjustedAt)

## Database Structure

### verifiedTimesheets Collection
```typescript
{
  // Original timesheet data
  date: string;
  openHours: number;
  closeHours: number;
  totalHours: number;
  operatorName: string;
  operatorId: string;
  
  // Asset information (for plant hours)
  assetId?: string;
  assetType?: string;
  plantNumber?: string;
  registrationNumber?: string;
  ownerId?: string;
  ownerType?: 'subcontractor' | 'company';
  ownerName?: string;
  
  // Adjustment tracking
  hasOriginalEntry?: boolean;        // TRUE if this is an adjustment
  originalEntryData?: {              // Contains full original entry data
    date: string;
    openHours: number;
    closeHours: number;
    totalHours: number;
    operatorName: string;
    // ... all original fields
  };
  isAdjustment?: boolean;            // TRUE for adjustment entry
  originalEntryId?: string;          // Reference to original entry ID
  adjustedBy?: string;               // Plant manager name
  adjustedAt?: string;               // Adjustment timestamp
  
  // Verification
  verified: true;
  verifiedBy: string;
  verifiedAt: string;
  
  // Multi-tenant
  masterAccountId: string;
  siteId: string;
  type: 'plant_hours' | 'man_hours';
}
```

## Key Points

### Why Two Lines Are Correct
1. **Audit Trail:** Original operator entry preserved
2. **Dispute Resolution:** Can compare what operator submitted vs what plant manager verified
3. **Billing Transparency:** Shows adjustments made and who made them
4. **Operator Trust:** Operators see their original submission unchanged

### Why Only One Adjustment Line
1. **Simplicity:** Only two versions matter - what operator said, what plant manager approved
2. **Data Efficiency:** No need for version history of edits
3. **UI Clarity:** Easy to understand - original vs final
4. **Edit Flow:** Subsequent edits update the same adjustment document

## Implementation Checklist

- [x] Operator entry creates unverified timesheet
- [x] Plant manager can view unverified timesheets
- [x] Plant manager can create adjustment (first edit)
- [x] Plant manager can update existing adjustment (subsequent edits)
- [x] UI displays both lines (operator + adjustment)
- [x] Plant manager can verify timesheet(s)
- [x] Verification creates document(s) in `verifiedTimesheets`
- [ ] **Accounts screen loads from `verifiedTimesheets` collection**
- [ ] **Accounts screen displays both lines when adjustment exists**
- [ ] **Accounts screen supports filters and export**

## Current Problem

The accounts/billing management screen is NOT querying the `verifiedTimesheets` collection. It needs to:

1. Load verified timesheets from Firebase
2. Parse entries with `hasOriginalEntry: true` to show both lines
3. Display in a clear table/list format
4. Support export functionality

## Next Steps

1. Update `components/accounts/PlantAssetsTimesheetsTab.tsx` to:
   - Query `verifiedTimesheets` collection
   - Parse and display both lines for adjusted entries
   - Add proper filters
   - Support CSV/Excel export

2. Ensure indexes exist in Firebase:
   - See `docs/PLANT-MANAGER-TIMESHEET-INDEXES.md`

3. Test complete workflow:
   - Operator submits → Plant manager verifies → Appears in accounts
