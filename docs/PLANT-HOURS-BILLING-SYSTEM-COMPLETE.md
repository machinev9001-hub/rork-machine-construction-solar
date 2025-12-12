# Plant Hours & Billing System - Complete A-Z Guide

## Table of Contents
1. [System Overview](#system-overview)
2. [The Complete Workflow](#the-complete-workflow)
3. [Billing Logic & Configuration](#billing-logic--configuration)
4. [EPH (Equipment Per Hour) System](#eph-equipment-per-hour-system)
5. [Agreement & Approval Workflow](#agreement--approval-workflow)
6. [Database Structure](#database-structure)
7. [User Interfaces](#user-interfaces)
8. [Integration Points](#integration-points)

---

## System Overview

### What is Plant Hours & Billing?

The Plant Hours & Billing System manages the complete lifecycle of equipment/plant asset time tracking from operator entry through to final billing and payment processing.

### Key Participants
1. **Operator**: Records plant asset usage hours
2. **Plant Manager**: Verifies and adjusts operator entries
3. **Admin/Billing**: Reviews, edits, and agrees final hours with subcontractors
4. **Subcontractor**: Reviews and approves hours for billing (future feature)

### Core Concepts

#### Billing Methods
1. **Per Hour**: Bill for actual hours worked
2. **Minimum Billing**: Bill for minimum hours or actual hours (whichever is greater)

#### Day Types
- **Weekdays (Mon-Fri)**: Standard billing days
- **Weekends (Sat-Sun)**: Different minimum hours apply
- **Public Holidays**: Premium rates and minimums
- **Rain Days**: Special minimum billing when weather affects work
- **Breakdown Days**: Actual hours only, no minimums

---

## The Complete Workflow

### Stage 1: Operator Entry
**Location**: Operator plant hours entry screens

**Process**:
1. Operator selects plant asset
2. Records:
   - Date
   - Open hours (start time)
   - Close hours (end time)
   - Total hours (calculated)
   - Special conditions (rain, breakdown, strike, holiday)
   - Notes
3. Timesheet saved to Firebase:
   - Collection: `plantAssets/{assetId}/timesheets/{timesheetId}`
   - Status: `verified: false` (unverified)

**Example Entry**:
```typescript
{
  id: "timesheet123",
  date: "2025-12-15",
  openHours: "07:00",
  closeHours: "17:00",
  totalHours: 10,
  operatorName: "John Smith",
  operatorId: "operator456",
  isRainDay: false,
  isBreakdown: false,
  isStrikeDay: false,
  isPublicHoliday: false,
  notes: "Normal working day",
  verified: false,
  assetId: "asset789",
  masterAccountId: "master123",
  siteId: "site456"
}
```

---

### Stage 2: Plant Manager Verification
**Location**: `app/plant-manager-timesheets.tsx`

**Process**:

#### 2.1 View Unverified Timesheets
- Plant manager loads all unverified timesheets (`verified: false`)
- Grouped by asset and week
- Can view both plant hours and man hours

#### 2.2 Edit/Adjust Hours
Plant manager can modify operator entries:

**First Edit**:
1. Creates NEW adjustment document with `isAdjustment: true`
2. Original entry marked with `hasAdjustment: true` and `adjustmentId`
3. Both remain `verified: false`
4. UI shows BOTH lines:
   - **ORIG** badge = Operator's original entry
   - **PM** badge = Plant manager's adjustment

**Subsequent Edits**:
1. Updates SAME adjustment document (no 3rd/4th documents created)
2. Always maintains only TWO entries: original + adjustment

**Example After Edit**:
```typescript
// Original Entry (unchanged)
{
  id: "timesheet123",
  totalHours: 10,
  hasAdjustment: true,
  adjustmentId: "adjustment789",
  verified: false
}

// Adjustment Entry (created by PM)
{
  id: "adjustment789",
  totalHours: 9.5,  // PM adjusted down
  isAdjustment: true,
  originalEntryId: "timesheet123",
  adjustedBy: "Plant Manager Name",
  adjustedAt: "2025-12-15T16:30:00Z",
  verified: false
}
```

#### 2.3 Verify & Submit to Billing
When plant manager clicks "Verify":

1. **Original entry updated**:
   ```typescript
   {
     verified: true,
     verifiedAt: Timestamp.now(),
     verifiedBy: "Plant Manager Name"
   }
   ```

2. **Adjustment entry updated** (if exists):
   ```typescript
   {
     verified: true,
     verifiedAt: Timestamp.now(),
     verifiedBy: "Plant Manager Name"
   }
   ```

3. **Filed to billing**:
   - Creates documents in `verifiedTimesheets` collection
   - Type: `plant_hours` or `man_hours`
   - BOTH entries copied (if adjustment exists)
   - Original data preserved in `originalEntryData` field

4. **Result**: Entries disappear from plant manager's view (now verified)

---

### Stage 3: EPH Report Generation
**Location**: `app/billing-config.tsx` - EPH Tab

**Process**:

#### 3.1 Admin Selects Scope
1. Select subcontractor
2. Select date range (start and end dates)
3. System queries `verifiedTimesheets` collection:
   ```typescript
   where('masterAccountId', '==', masterAccountId)
   where('siteId', '==', siteId)
   where('ownerId', '==', subcontractorId)
   where('type', '==', 'plant_hours')
   where('date', '>=', startDate)
   where('date', '<=', endDate)
   ```

#### 3.2 EPH Report Generated
System calculates hours breakdown per asset:

```typescript
{
  assetId: "asset789",
  assetType: "Excavator 20T",
  plantNumber: "EXC-001",
  
  // Hours by day type
  normalHours: 80,        // Mon-Fri
  saturdayHours: 16,      // Saturdays
  sundayHours: 8,         // Sundays
  publicHolidayHours: 0,  // Public holidays
  breakdownHours: 2,      // Breakdown days
  rainDayHours: 12,       // Rain affected days
  strikeDayHours: 0,      // Strike days
  
  // Billing
  rate: 450,              // R450/hour
  rateType: "dry",        // "dry" or "wet"
  totalBillableHours: 118,
  estimatedCost: 53100,   // 118h × R450
  
  // Raw data
  rawTimesheets: [...],   // All timesheet entries
}
```

#### 3.3 Admin Review Actions
- **View Timesheets**: See all individual timesheet entries
- **Edit Hours**: Modify hours before agreement (creates pending edit)
- **Compare Versions**: View PM vs Admin vs Subcontractor versions
- **Agree Hours**: Finalize for billing
- **Generate PDF**: Create report document

---

## Billing Logic & Configuration

### Billing Configuration Screen
**Location**: `app/billing-config.tsx` - Billing Config Tab

Two separate configurations:

### 1. Machine Hours Configuration

**Purpose**: Configure billing rules for plant/machinery assets

**Settings Per Day Type**:

#### Weekdays (Monday - Friday)
```typescript
{
  minHours: 0,  // No minimum (bill actual hours)
}
```

#### Weekends (Saturday & Sunday)
```typescript
{
  minHours: 8,  // Minimum 8 hours billing
  // If actual > 8h, bill actual
  // If actual < 8h, bill 8h
}
```

#### Rain Days
```typescript
{
  enabled: true,
  minHours: 4.5,        // Minimum 4.5 hours
  thresholdHours: 1,    // Must work at least 1h to qualify
}
```
**Logic**: If operator worked 3 hours on a rain day, bill 4.5h minimum. If worked 6 hours, bill 6h.

#### Breakdown Days
```typescript
{
  enabled: true,
  minHours: 0,  // Bill ONLY actual hours
}
```
**Logic**: Machine broken = no minimum billing. Charge only for time actually used.

**Important**: The billing method (Per Hour vs Minimum Billing) is set **per asset** during plant onboarding, NOT in billing config.

---

### 2. Man Hours Configuration

**Purpose**: Configure billing rules for operator labor

**Global Billing Method Toggle**:
- **Per Hour**: Bill for actual hours worked
- **Minimum Billing**: Apply minimum hours for different day types

**Settings Per Day Type**:

#### Weekdays
```typescript
{
  enabled: true,
  billingMethod: "PER_HOUR" | "MINIMUM_BILLING",
  minHours: 8,           // If minimum billing
  rateMultiplier: 1.0,   // Standard rate (no premium)
}
```

#### Saturday
```typescript
{
  enabled: true,
  billingMethod: "MINIMUM_BILLING",
  minHours: 8,
  rateMultiplier: 1.5,   // 50% premium
}
```

#### Sunday
```typescript
{
  enabled: true,
  billingMethod: "MINIMUM_BILLING",
  minHours: 8,
  rateMultiplier: 1.5,   // 50% premium
}
```

#### Public Holidays
```typescript
{
  enabled: true,
  billingMethod: "MINIMUM_BILLING",
  minHours: 8,
  rateMultiplier: 2.0,   // 100% premium (double time)
}
```

#### Rain Days
```typescript
{
  enabled: true,
  minHours: 4.5,
  thresholdHours: 1,
}
```

---

### Billable Hours Calculation

**File**: `utils/billableHoursCalculator.ts`

#### The Hierarchy (Priority Order)

**Priority 1: Breakdown** (Overrides Everything)
```typescript
if (timesheet.isBreakdown && config.breakdown.enabled) {
  billableHours = actualHours;  // No minimums apply
}
```
**Why**: Breakdown = machine not working properly. Only charge for actual time used.

**Priority 2: Inclement Weather**
```typescript
if (timesheet.isRainDay && config.rainDays.enabled) {
  billableHours = Math.max(actualHours, config.rainDays.minHours);
}
```
**Why**: Rain day = guaranteed minimum, but if worked more, bill actual.

**Priority 3: Standard Billing** (Weekday/Weekend/Holiday)
```typescript
const dayMinimum = getMinimumForDayType(dayOfWeek, isPublicHoliday, config);
billableHours = Math.max(actualHours, dayMinimum);
```
**Why**: Standard day billing based on day type.

#### Example Calculations

**Example 1: Normal Weekday**
```
Raw Hours: 9.5h
Day: Wednesday
Weekday minimum: 0h (per hour billing)
Result: 9.5h billable
```

**Example 2: Saturday with Minimum**
```
Raw Hours: 6h
Day: Saturday
Weekend minimum: 8h
Result: 8h billable (minimum kicks in)
```

**Example 3: Rain Day**
```
Raw Hours: 3h
Day: Thursday
Rain day minimum: 4.5h
Result: 4.5h billable (rain minimum applies)
```

**Example 4: Breakdown Day**
```
Raw Hours: 2.5h
Day: Monday
Breakdown flag: true
Result: 2.5h billable (actual hours only, no minimums)
```

**Example 5: Rain Day with High Hours**
```
Raw Hours: 7h
Day: Friday
Rain day minimum: 4.5h
Result: 7h billable (actual exceeds minimum)
```

---

## EPH (Equipment Per Hour) System

### What is EPH?

EPH = Equipment Per Hour report showing all hours worked by each plant asset for a specific period, ready for billing.

### EPH Workflow

#### Step 1: Generate EPH
1. Admin selects subcontractor
2. Selects date range
3. System generates report with:
   - All assets for that subcontractor
   - Hours breakdown by day type
   - Estimated costs
   - Individual timesheet entries

#### Step 2: Admin Review & Edit (Optional)
**Modal**: `EditEPHHoursModal`

Admin can modify:
- Total hours
- Open/close times
- Day conditions (rain, breakdown, etc.)
- Admin notes

**What happens**:
1. Creates record in `ephPendingEdits` collection
2. Status: `pending_review`
3. Asset card shows "Edits Pending" badge

**Database Structure**:
```typescript
{
  id: "edit123",
  originalTimesheetId: "timesheet789",
  assetId: "asset456",
  date: "2025-12-15",
  
  editedBy: "admin",
  editedByUserId: "admin789",
  editedByName: "Admin Name",
  editedAt: Timestamp,
  
  // Edited values
  totalHours: 9,          // Changed from 10
  openHours: "07:00",
  closeHours: "16:00",    // Changed from 17:00
  isBreakdown: false,
  isRainDay: false,
  notes: "Admin adjusted: left early",
  
  // Original values (for comparison)
  originalTotalHours: 10,
  originalOpenHours: "07:00",
  originalCloseHours: "17:00",
  
  status: "pending_review",
  masterAccountId: "master123",
  siteId: "site456",
  subcontractorId: "sub789",
  subcontractorName: "ABC Contractors"
}
```

#### Step 3: Compare Versions (If Edits Exist)
**Modal**: `TimesheetComparisonModal`

Shows side-by-side comparison:
| Plant Manager | Admin Edited | Subcontractor Edited |
|--------------|--------------|---------------------|
| 10.0h        | 9.0h ←       | -                  |
| No rain      | No rain      | -                  |
| Normal day   | Left early ← | -                  |

Highlights differences with colored backgrounds.

#### Step 4: Send to Subcontractor (Future Enhancement)
**Modal**: `SendConfirmationModal`

Admin sends EPH to subcontractor:
1. Enter subcontractor email
2. Add optional message
3. System generates PDF with all hours
4. Sends email with PDF attachment
5. Subcontractor reviews and can submit edits

**Email sent via**: `utils/ephEmailService.ts`

#### Step 5: Agree Hours & Finalize
**Modal**: `AgreedHoursModal`

Admin agrees final hours:
1. Reviews all versions (PM, Admin, Subcontractor)
2. Enters final agreed hours
3. Adds agreement notes
4. Clicks "Agree"

**What happens**:
```typescript
// Creates record in agreedTimesheets collection
{
  id: "agreed123",
  originalTimesheetId: "timesheet789",
  date: "2025-12-15",
  operatorName: "John Smith",
  operatorId: "operator456",
  
  // Asset info
  assetId: "asset456",
  assetType: "Excavator 20T",
  
  // Hours
  originalHours: 10,      // What operator entered
  agreedHours: 9,         // What was finally agreed
  
  // Agreement
  agreedBy: "admin789",
  agreedAt: Timestamp,
  agreedNotes: "Hours adjusted - early finish agreed",
  
  // Rates (for billing)
  timesheetType: "plant_asset",
  hourlyRate: 450,
  rateType: "dry",
  
  masterAccountId: "master123",
  siteId: "site456",
  subcontractorId: "sub789",
  subcontractorName: "ABC Contractors"
}
```

All pending edits marked as `status: "superseded"`.

---

### Stage 4: Process Payments
**Location**: `app/accounts/index.tsx` - Process Payments Tab

#### What Shows Here?
Only **agreed timesheets** (approved for billing)

#### Data Source
Queries `agreedTimesheets` collection:
```typescript
where('masterAccountId', '==', masterAccountId)
where('date', '>=', fromDate)
where('date', '<=', toDate)
orderBy('agreedAt', 'desc')
```

#### Display Format
Grouped by asset or operator, showing:

**For Each Asset/Operator**:
- Asset/operator name
- Number of days
- Total agreed hours
- "Has Adjustments" indicator if hours were changed

**Expandable Details** (when clicked):
- Date-by-date breakdown
- Shows BOTH lines if PM adjusted:
  - **ORIG** badge = Original operator entry
  - **PM** badge = Plant manager adjustment
- Toggle to show/hide original entries
- All timesheet details (open, close, conditions, notes)

**Selection & Export**:
- Checkbox to select assets/operators
- "Generate Report" - Creates PDF with agreed hours
- "Export" - Export to CSV/Excel for accounting

#### Agreement Status Types
1. **Fully Agreed**: Both admin and subcontractor agreed
2. **Admin Override**: Admin finalized despite subcontractor edits
3. **Auto-Agreed**: No edits, auto-approved (future feature)

---

## Database Structure

### Collections

#### 1. plantAssets/{assetId}/timesheets
**Purpose**: Unverified operator entries

```typescript
{
  id: string;
  date: string;              // "2025-12-15"
  openHours: string;         // "07:00"
  closeHours: string;        // "17:00"
  totalHours: number;        // 10
  operatorName: string;
  operatorId: string;
  isRainDay: boolean;
  isBreakdown: boolean;
  isStrikeDay: boolean;
  isPublicHoliday: boolean;
  notes?: string;
  verified: boolean;         // false until PM verifies
  
  // If PM adjusted
  hasAdjustment?: boolean;
  adjustmentId?: string;
  
  // Asset info
  assetId: string;
  masterAccountId: string;
  siteId: string;
}
```

#### 2. verifiedTimesheets
**Purpose**: PM-verified entries ready for EPH

```typescript
{
  id: string;
  date: string;
  operatorName: string;
  operatorId: string;
  
  verified: true;
  verifiedBy: string;        // PM name
  verifiedAt: string;
  
  type: "plant_hours" | "man_hours";
  
  // Plant hours specific
  openHours?: number;
  closeHours?: number;
  totalHours?: number;
  isBreakdown?: boolean;
  isRainDay?: boolean;
  
  // Asset info
  assetId?: string;
  assetType?: string;
  plantNumber?: string;
  registrationNumber?: string;
  ownerId?: string;          // Subcontractor ID
  ownerType?: string;
  ownerName?: string;        // Subcontractor name
  
  // Adjustment tracking
  hasOriginalEntry?: boolean;     // TRUE if PM adjusted
  originalEntryData?: {           // Full original entry
    date: string;
    openHours: number;
    closeHours: number;
    totalHours: number;
    // ... all original fields
  };
  isAdjustment?: boolean;
  originalEntryId?: string;
  adjustedBy?: string;
  adjustedAt?: string;
  
  masterAccountId: string;
  siteId: string;
}
```

#### 3. ephPendingEdits
**Purpose**: Admin edits awaiting subcontractor review

```typescript
{
  id: string;
  originalTimesheetId: string;
  assetId: string;
  date: string;
  
  editedBy: "admin" | "subcontractor";
  editedByUserId: string;
  editedByName: string;
  editedAt: Timestamp;
  
  // Edited values
  totalHours: number;
  openHours: string;
  closeHours: string;
  isBreakdown: boolean;
  isRainDay: boolean;
  isStrikeDay: boolean;
  isPublicHoliday: boolean;
  notes: string;
  
  // Original values (for comparison)
  originalTotalHours: number;
  originalOpenHours: string;
  originalCloseHours: string;
  
  status: "pending_review" | "reviewed" | "superseded";
  reviewedBy?: string;
  reviewedAt?: Timestamp;
  
  masterAccountId: string;
  siteId: string;
  subcontractorId: string;
  subcontractorName: string;
}
```

#### 4. agreedTimesheets
**Purpose**: Final agreed hours for billing

```typescript
{
  id: string;
  originalTimesheetId: string;
  date: string;
  operatorName: string;
  operatorId: string;
  
  // Asset info
  assetId: string;
  assetType: string;
  
  // Hours
  originalHours: number;          // What operator entered
  agreedHours: number;            // What was agreed
  
  // For man hours
  originalNormalHours?: number;
  agreedNormalHours?: number;
  originalOvertimeHours?: number;
  agreedOvertimeHours?: number;
  originalSundayHours?: number;
  agreedSundayHours?: number;
  originalPublicHolidayHours?: number;
  agreedPublicHolidayHours?: number;
  
  // Agreement metadata
  agreedBy: string;              // Admin user ID
  agreedAt: Timestamp;
  agreedNotes?: string;
  adminNotes?: string;
  
  // Billing info
  timesheetType: "plant_asset" | "operator";
  hourlyRate?: number;
  rateType?: "dry" | "wet";
  
  masterAccountId: string;
  siteId: string;
  subcontractorId: string;
  subcontractorName: string;
}
```

#### 5. masterAccounts/{id}/billingConfig/default
**Purpose**: Billing configuration

```typescript
{
  weekdays: {
    enabled: boolean;
    billingMethod: "PER_HOUR" | "MINIMUM_BILLING";
    minHours: number;
    rateMultiplier: number;
  };
  saturday: {
    enabled: boolean;
    billingMethod: "PER_HOUR" | "MINIMUM_BILLING";
    minHours: number;
    rateMultiplier: number;
  };
  sunday: { /* same structure */ };
  publicHolidays: { /* same structure */ };
  rainDays: {
    enabled: boolean;
    minHours: number;
    thresholdHours: number;
  };
  breakdown: {
    enabled: boolean;
    minHours: number;
  };
}
```

---

## User Interfaces

### 1. Operator Screens
**Purpose**: Enter plant hours

**Features**:
- Select plant asset
- Enter date, open/close hours
- Mark special conditions (rain, breakdown, etc.)
- Add notes
- Submit timesheet

### 2. Plant Manager Timesheet Screen
**File**: `app/plant-manager-timesheets.tsx`

**Purpose**: Verify and adjust operator entries

**Features**:
- View unverified timesheets (grouped by asset/week)
- Edit timesheet hours (creates adjustment)
- View both operator original and PM adjustment
- Verify timesheets (sends to billing)
- Weekly summary with total hours

**Key UI Elements**:
- **ORIG Badge**: Operator's original entry
- **PM Badge**: Plant manager's adjustment
- Green checkmark: Verify button
- Edit icon: Adjust hours button

### 3. Billing Config Screen
**File**: `app/billing-config.tsx`

**Tabs**:
1. **Billing Config**: Configure billing rules
   - Machine Hours sub-tab
   - Man Hours sub-tab
2. **EPH Report**: Generate and manage EPH reports
3. **Process Payments**: View agreed timesheets (links to accounts screen)

**Billing Config Tab UI**:
- Day type cards (expand/collapse)
- Toggle switches for enabled/disabled
- Input fields for minimum hours
- Rate multiplier fields (for man hours)
- Save button (header)

**EPH Report Tab UI**:
- Subcontractor selector
- Date range picker (start/end dates)
- Asset cards showing:
  - Asset type and number
  - Rate (dry/wet)
  - Total billable hours
  - Estimated cost
  - Expandable hours breakdown
  - Action buttons (View, Edit, Compare, Agree)
- Selection checkboxes for bulk actions
- Generate All / Generate Selected buttons
- Send to Subcontractor button

### 4. Accounts / Billing Management Screen
**File**: `app/accounts/index.tsx`
**Component**: `PlantAssetsTimesheetsTab.tsx`

**Purpose**: Process agreed timesheets for payment

**Features**:
- Asset selector (subcontractor + asset + date range)
- View mode toggle (Plant Hours / Man Hours)
- List of agreed timesheets grouped by asset/operator
- Expand to see date-by-date details
- Show original + adjusted entries (if PM edited)
- Toggle to show/hide original entries
- Selection checkboxes
- Generate Report button (creates PDF)
- Export button (CSV/Excel)

**Key UI Elements**:
- **ORIG Badge**: Original operator entry
- **PM Badge**: Plant manager adjustment
- Green selection banner when assets selected
- Horizontal scrollable table for timesheet details
- Metrics cards (total entries, date range)
- Summary bar showing total hours

---

## Integration Points

### PDF Generation
**File**: `utils/timesheetPdfGenerator.ts`

**Purpose**: Generate PDF reports for EPH and agreed timesheets

**Functions**:
- `generateTimesheetPDF()`: Creates PDF from timesheet groups
- `emailTimesheetPDF()`: Opens email composer with PDF attachment
- `downloadTimesheetPDF()`: Downloads/shares PDF file

**PDF Includes**:
- Company logo and details
- Report title and date range
- Asset/operator information
- Date-by-date breakdown with:
  - Original operator entries
  - Plant manager adjustments
  - Agreed final hours (if applicable)
- Total hours summary
- Rate information
- Estimated costs

### Email Service
**File**: `utils/ephEmailService.ts`

**Purpose**: Send EPH reports to subcontractors

**Function**: `sendEPHToSubcontractor()`

**Email Contains**:
- Subject: EPH Report for Review
- Body with summary (asset count, total hours, date range)
- PDF attachment
- Instructions for review
- Portal link (future)

### Billable Hours Calculator
**File**: `utils/billableHoursCalculator.ts`

**Purpose**: Calculate billable hours based on billing config

**Main Function**: `calculateBillableHours()`

**Input**:
- Timesheet entry (date, hours, conditions)
- Billing configuration

**Output**:
```typescript
{
  actualHours: number;          // Raw hours worked
  billableHours: number;        // Hours to bill
  appliedRule: string;          // Which rule applied
  minimumApplied: number;       // Minimum that was used
  notes: string;                // Explanation
}
```

**Usage**:
```typescript
const result = calculateBillableHours(
  {
    startTime: "07:00",
    endTime: "17:00",
    date: "2025-12-15",
    isBreakdown: false,
    isRainDay: false,
  },
  billingConfig
);
// Result: actualHours: 10, billableHours: 10, appliedRule: "weekday"
```

---

## Key Features & Business Rules

### 1. Audit Trail
Every entry preserved:
- Operator original entry
- Plant manager adjustment (if any)
- Admin edit (if any)
- Subcontractor edit (if any)
- Final agreed hours

### 2. Transparency
All parties can see:
- What operator submitted
- What plant manager verified
- What admin edited
- What was finally agreed
- Who made each change and when

### 3. Dispute Resolution
If disagreement on hours:
1. Admin reviews all versions in comparison modal
2. Can see exactly what each party entered
3. Makes final decision in agreement modal
4. Records reasoning in notes
5. All versions remain in database for reference

### 4. Billing Accuracy
Calculation hierarchy ensures:
1. Breakdown days = actual hours only (no inflated billing)
2. Rain days = guaranteed minimum (fair to operator/owner)
3. Standard days = contractual minimums apply
4. Public holidays = premium rates honored

### 5. Data Integrity
- Only verified timesheets progress to EPH
- Only agreed timesheets progress to payment processing
- Each stage has approval gate
- No data loss - all versions preserved

---

## Common Scenarios

### Scenario 1: Normal Day, No Adjustments
```
1. Operator enters: 10h (07:00 - 17:00)
2. Plant Manager verifies: 10h ✓
3. Admin generates EPH: 10h shown
4. Admin agrees hours: 10h
5. Process payment: 10h billed
```

### Scenario 2: PM Adjustment
```
1. Operator enters: 10h (07:00 - 17:00)
2. Plant Manager adjusts: 9h (07:00 - 16:00) "Left early"
3. Admin generates EPH: Sees both 10h (ORIG) and 9h (PM)
4. Admin agrees hours: 9h (accepts PM adjustment)
5. Process payment: 9h billed
   - Shows ORIG: 10h
   - Shows PM: 9h ← (used for billing)
```

### Scenario 3: Admin Edit After EPH
```
1. Operator enters: 10h
2. Plant Manager verifies: 10h ✓
3. Admin generates EPH, finds error, edits: 8h "Truck broke down"
4. Creates pending edit: status = pending_review
5. Admin compares: PM 10h vs Admin 8h
6. Admin agrees hours: 8h
7. Process payment: 8h billed with admin notes
```

### Scenario 4: Rain Day with Minimum
```
1. Operator enters: 3h, marks "Rain Day"
2. Plant Manager verifies: 3h ✓ (with rain flag)
3. Billing config: Rain day minimum = 4.5h
4. Billable hours calculator applies: 4.5h (minimum)
5. Admin generates EPH: Shows 3h actual, 4.5h billable
6. Admin agrees: 4.5h
7. Process payment: 4.5h billed
```

### Scenario 5: Breakdown Day
```
1. Operator enters: 2h, marks "Breakdown"
2. Plant Manager verifies: 2h ✓ (with breakdown flag)
3. Billing config: Breakdown = actual hours only
4. Billable hours calculator applies: 2h (no minimum)
5. Admin generates EPH: Shows 2h actual, 2h billable
6. Admin agrees: 2h
7. Process payment: 2h billed
```

### Scenario 6: Weekend with Minimum
```
1. Operator enters: 6h on Saturday
2. Plant Manager verifies: 6h ✓
3. Billing config: Weekend minimum = 8h
4. Billable hours calculator applies: 8h (minimum)
5. Admin generates EPH: Shows 6h actual, 8h billable
6. Admin agrees: 8h
7. Process payment: 8h billed
```

---

## Future Enhancements

### 1. Subcontractor Portal
- Web/mobile app for subcontractors
- View EPH reports
- Submit edits and approvals
- Track payment status
- Download invoices

### 2. Automated Notifications
- Email/SMS when EPH ready for review
- Reminders for pending approvals
- Payment confirmations

### 3. Accounting Integration
- QuickBooks integration
- Xero integration
- Sage integration
- Automated invoice generation

### 4. Advanced Reporting
- Cost analysis by asset
- Utilization reports
- Profitability analysis
- Trend analysis

### 5. Mobile Optimization
- Native mobile app for operators
- Offline timesheet entry
- Photo attachments for breakdowns/rain
- GPS verification

---

## Troubleshooting

### "No timesheets showing in EPH"
**Check**:
1. Are timesheets verified by Plant Manager?
2. Correct date range selected?
3. Correct subcontractor selected?
4. Check `verifiedTimesheets` collection in Firebase

### "Hours don't match what operator entered"
**Check**:
1. Did Plant Manager adjust hours? (Look for ORIG vs PM badges)
2. Did Admin edit in EPH? (Look for "Edits Pending" badge)
3. Check billing config minimums (rain day, weekend, etc.)
4. View comparison modal to see all versions

### "Can't agree hours"
**Check**:
1. Are there unresolved pending edits?
2. Is comparison showing correctly?
3. Check permissions (must be admin)
4. Check Firebase connection

### "PDF not generating"
**Check**:
1. Are timesheets selected?
2. Check console for errors
3. Ensure date range has data
4. Check PDF generator logs

---

## Technical Notes

### Firebase Indexes Required
See `docs/EPH-FIREBASE-INDEXES-REQUIRED.md` for complete list.

Key indexes:
- `verifiedTimesheets`: masterAccountId + siteId + type + date
- `agreedTimesheets`: masterAccountId + date
- `ephPendingEdits`: masterAccountId + assetId + status

### Performance Considerations
- EPH generation can be slow for large date ranges
- Consider pagination for large timesheet lists
- Cache billing config to reduce Firebase reads
- Use React Query for efficient data fetching

### Security Rules
All collections should enforce:
- Master account isolation
- Site isolation
- Role-based access control
- Read/write permissions by user role

---

## Summary

The Plant Hours & Billing System provides a complete, transparent workflow from operator entry through to payment processing:

1. **Operators** record hours
2. **Plant Managers** verify and adjust
3. **Admin** generates EPH, reviews, and edits
4. **System** calculates billable hours based on config
5. **Admin** agrees final hours with subcontractors
6. **Accounts** processes agreed hours for payment

Key strengths:
- Complete audit trail
- Transparent adjustments
- Flexible billing rules
- Accurate calculations
- Easy dispute resolution
- Ready for accounting integration

All data preserved, all changes tracked, all parties informed.
