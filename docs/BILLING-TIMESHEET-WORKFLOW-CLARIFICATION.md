# Billing Timesheet Workflow Clarification

## Complete Workflow

### Stage 1: Operator Entry
- Operators submit their timesheets via the mobile app
- Data stored in `verifiedTimesheets` collection or individual timesheet tables
- Fields: date, hours, operator name, asset info, notes

### Stage 2: Plant Manager Review & Adjustment
- Plant Managers review operator entries in their dashboard
- Can adjust hours/data if needed
- Adjustments create new entries with `isAdjustment: true` and `originalEntryData` field
- Both original and adjusted entries exist in the same collection

### Stage 3: Admin Review (EPH Tab)
**Location:** `app/billing-config.tsx` - EPH Tab

**Current Functionality:**
- Admin selects subcontractor and date range
- Clicks "Generate EPH Report" to load timesheets
- System deduplicates entries (if original + adjustment exist, show adjustment)
- Admin clicks "Agree Hours" button on each timesheet entry
- Opens `AgreedHoursModal` where admin can:
  - Accept Plant Manager's hours as-is
  - Modify hours for billing
  - Add billing notes
- On save, creates record in `agreedTimesheets` collection with:
  ```typescript
  {
    id: string,
    originalTimesheetId: string,
    timesheetType: 'operator' | 'plant_asset',
    date: string,
    operatorId, operatorName, assetId, assetType,
    originalHours: number,  // Plant Manager's final hours
    agreedHours: number,    // Admin's approved hours for billing
    hoursDifference: number,
    adminNotes: string,
    status: 'approved_for_billing',
    agreedAt: Timestamp,
    agreedBy: string,
    ...
  }
  ```

**Missing Functionality:**
- ❌ No way to EDIT existing agreedTimesheets after they've been created
- Need to add "Edit" button next to "Agree Hours" that opens same modal with existing data

### Stage 4: Billing Management (Timesheets Tab)
**Location:** `components/accounts/PlantAssetsTimesheetsTab.tsx`

**Current Functionality:**
- Loads data from `agreedTimesheets` collection (approved for billing)
- Displays in grouped format by asset/operator
- Shows Plant Manager data (stored in `originalHours` fields)
- Admin can select timesheets and generate PDF reports

**Missing Functionality:**
- ❌ No edit functionality here - this is a VIEW-ONLY tab
- All edits should happen in EPH tab (Stage 3)

### Stage 5: PDF Report Generation
**Location:** `utils/timesheetPdfGenerator.ts`

**Current Functionality:**
- Takes timesheet groups from Billing Management tab
- Generates HTML-based PDF with all timesheet details
- Shows original vs adjusted entries if applicable
- Provides download or email options

**✅ Fixed Issues (2025-12-22):**
- ✅ PDF was recalculating hours from meter readings instead of using pre-calculated agreed hours
- ✅ Added `billingResultsByDate` map to store pre-calculated billable hours from EPH generation
- ✅ Updated PDF data preparation to include `actualHours` and `billableHours` fields
- ✅ PDF now uses agreed hours directly without recalculation from open/close meter readings

## Data Flow

```
Operator Entry (verifiedTimesheets)
    ↓
Plant Manager Adjustment (verifiedTimesheets with isAdjustment flag)
    ↓
Admin Review in EPH Tab → Click "Agree Hours"
    ↓
AgreedHoursModal → Admin modifies if needed → Save
    ↓
agreedTimesheets collection (status: 'approved_for_billing')
    ↓
Billing Management Timesheets Tab loads agreedTimesheets
    ↓
Admin generates PDF report
    ↓
PDF shows final billing data
```

## Correct Implementation Plan

### 1. Fix: Show existing agreedTimesheets in EPH tab
- When loading timesheets in EPH, check if `agreedTimesheet` already exists
- Show indicator: "✓ Agreed" with edit button
- "Agree Hours" button changes to "Edit Agreed Hours"

### 2. Fix: Enable editing agreedTimesheets
- Add edit button in EPH tab next to agreed entries
- Open AgreedHoursModal with existing agreed data
- Update existing `agreedTimesheet` document instead of creating new one

### 3. Fix: PDF generation empty data
- Debug why `dateGroups` array is empty when passed to PDF generator
- Verify data transformation in `PlantAssetsTimesheetsTab.tsx`
- Ensure all required fields are populated

### 4. Fix: PDF should show "last edited" version
- PDF should show data from `agreedTimesheets` collection
- If admin edited (has `updatedAt` > `createdAt`), it's the edited version
- PDF already designed to show this - just need correct data

## Key Collections

### verifiedTimesheets
Original operator entries and plant manager adjustments

### agreedTimesheets
Admin-approved hours for billing. This is the source of truth for billing.

### Fields Mapping

| Source | Field | Description |
|--------|-------|-------------|
| Operator/PM | originalHours | Hours from plant manager (or operator if no PM adjustment) |
| Admin | agreedHours | Final hours approved for billing |
| Admin | adminNotes | Billing notes |
| Admin | agreedAt | When admin approved |
| Admin | agreedBy | Who approved |
| Admin | updatedAt | Last edit time (if edited after creation) |

## Testing Checklist

- [ ] EPH tab loads timesheets correctly
- [ ] "Agree Hours" creates agreedTimesheet
- [ ] Already-agreed entries show "✓ Agreed" indicator
- [ ] "Edit Agreed Hours" opens modal with existing data
- [ ] Editing updates existing agreedTimesheet (not create new)
- [ ] Billing Management tab loads agreedTimesheets
- [ ] PDF generation shows actual timesheet rows
- [ ] PDF shows correct hours (admin-agreed version)
- [ ] PDF shows both original and PM-adjusted if applicable
- [ ] Email functionality works
- [ ] Download functionality works
