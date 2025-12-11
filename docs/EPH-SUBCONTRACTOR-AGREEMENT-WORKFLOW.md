# EPH/Timesheet Subcontractor Agreement Workflow

## Overview
This document outlines the comprehensive workflow for Equipment/Plant Hours (EPH) reporting and timesheet agreement between administrators and subcontractors.

## System Architecture

### Key Components
1. **Admin Interface** - Billing Management (billing-config.tsx)
2. **Subcontractor Interface** - To be implemented (separate portal/app)
3. **Agreement System** - Manages negotiation and finalization
4. **Process Payments Tab** - Final approved timesheets ready for billing

## Workflow States

### 1. Initial State: EPH Generation
- Admin selects subcontractor and date range
- System generates EPH report from verified timesheets
- Shows all assets with hours breakdown
- **State:** `draft`

### 2. Admin Review & Edit
- Admin reviews the EPH report
- Can edit hours using "Edit Hours" button
- Edits are saved as `adminEditedVersion`
- **State:** `admin_edited`

### 3. Send to Subcontractor
- Admin clicks "Send to Subcontractor" after editing (or directly if no edits)
- Creates a `pendingAgreement` record in Firestore
- Subcontractor receives notification
- **State:** `pending_subcontractor_review`

### 4. Subcontractor Review & Edit
- Subcontractor views the admin's version in their portal
- Can suggest changes by editing their version
- Edits are saved as `subcontractorSuggestedVersion`
- Can either:
  - Accept admin's version (no edits)
  - Propose changes and submit
- **State:** `subcontractor_responded`

### 5. Admin Final Review
- Admin sees subcontractor's suggested changes (if any)
- Can view side-by-side comparison:
  - Original verified timesheet
  - Admin's edited version
  - Subcontractor's suggested version
- Admin makes final decision (admin version is source of truth)
- Can accept subcontractor's suggestions or keep their own version
- **State:** `admin_final_review`

### 6. Agreement Finalization
- Admin clicks "Agree Hours" button
- This finalizes the timesheet:
  - Creates record in `agreedTimesheets` collection
  - Marks as `approved_for_billing`
  - Moves to "Process Payments" tab
- **State:** `agreed`

### 7. Process Payments
- All agreed timesheets appear in this tab
- Can generate final PDF reports for invoicing
- Can send to accounting/billing systems
- **State:** `ready_for_payment`

## Database Structure

### Collection: `pendingAgreements`
```typescript
{
  id: string;
  masterAccountId: string;
  siteId: string;
  subcontractorId: string;
  subcontractorName: string;
  assetId: string;
  assetType: string;
  plantNumber?: string;
  dateRange: {
    from: string;
    to: string;
  };
  
  // Versions
  originalTimesheetIds: string[];
  adminEditedVersion?: {
    hours: number;
    notes?: string;
    editedBy: string;
    editedAt: Timestamp;
  };
  subcontractorSuggestedVersion?: {
    hours: number;
    notes?: string;
    editedBy: string;
    editedAt: Timestamp;
  };
  
  // State
  status: 'pending_subcontractor_review' | 'subcontractor_responded' | 'admin_final_review' | 'agreed' | 'rejected';
  
  // Audit trail
  createdAt: Timestamp;
  updatedAt: Timestamp;
  sentToSubcontractorAt?: Timestamp;
  subcontractorRespondedAt?: Timestamp;
  agreedAt?: Timestamp;
  agreedBy?: string;
}
```

### Collection: `agreedTimesheets`
```typescript
{
  id: string;
  originalTimesheetId: string;
  pendingAgreementId?: string;
  timesheetType: 'operator' | 'plant_asset';
  
  // Final agreed data
  date: string;
  assetId?: string;
  assetType?: string;
  operatorId?: string;
  operatorName?: string;
  
  originalHours: number;
  agreedHours: number;
  hoursDifference: number;
  
  originalNotes?: string;
  adminNotes?: string;
  
  // Metadata
  siteId: string;
  masterAccountId: string;
  subcontractorId?: string;
  subcontractorName?: string;
  
  status: 'approved_for_billing' | 'processed' | 'paid';
  
  agreedAt: Timestamp;
  agreedBy: string;
  approvedForBillingAt: Timestamp;
  approvedForBillingBy: string;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

## UI Changes Required

### Admin Interface (billing-config.tsx)

#### EPH Tab
1. **Edit Hours Button**
   - Opens modal to edit individual timesheet hours
   - Saves as draft/admin version
   - Shows visual indicator if edited

2. **Send to Subcontractor Button**
   - Appears after editing (or directly)
   - Creates pending agreement
   - Sends notification to subcontractor

3. **View Subcontractor Response**
   - Shows when subcontractor has responded
   - Side-by-side comparison view
   - Highlights differences

4. **Agree Hours Button** (renamed from current "Agree Hours")
   - Final step after both parties reviewed
   - Only enabled when ready to finalize
   - Creates agreed timesheet

#### Process Payments Tab (renamed from "Timesheets")
- Lists all agreed timesheets
- Grouped by subcontractor
- Shows:
  - Date range
  - Total hours
  - Agreement date
  - Status (pending payment, paid, etc.)
- Generate invoice PDFs
- Mark as paid

### Subcontractor Interface (New - Separate App/Portal)
1. **Pending Reviews Dashboard**
   - Lists all EPH reports awaiting their review
   - Shows admin's proposed hours
   - Date ranges
   - Assets

2. **Review & Edit Screen**
   - View admin's version
   - Edit fields to suggest changes
   - Add notes explaining changes
   - Submit or Accept buttons

3. **Agreement History**
   - Past agreed timesheets
   - Audit trail
   - Download PDFs

## Implementation Steps

### Phase 1: Admin Interface Enhancement
1. ✅ Rename "Timesheets" tab to "Process Payments"
2. Add "Edit Hours" functionality to EPH
3. Create `pendingAgreements` manager utility
4. Add "Send to Subcontractor" button
5. Implement comparison view for admin

### Phase 2: Subcontractor Portal
1. Create new app/portal for subcontractors
2. Authentication (separate from main app)
3. Pending reviews dashboard
4. Edit and response functionality
5. Agreement history

### Phase 3: Integration & Testing
1. Notification system (email/push)
2. Real-time updates
3. Audit logging
4. End-to-end testing
5. Security & permissions

## Security Considerations
- Subcontractors can only see their own timesheets
- Admin edits are clearly marked
- Subcontractor suggestions don't automatically override admin
- Admin has final authority (source of truth)
- All changes are logged with timestamps and user IDs
- Agreed timesheets are immutable

## Email Notifications
- Admin → Subcontractor: "New EPH report for review"
- Subcontractor → Admin: "EPH response submitted"
- Admin → Subcontractor: "EPH agreed and finalized"

## PDF Report Features
- Shows all three versions (original, admin, subcontractor)
- Highlights differences
- Agreement signatures/timestamps
- Suitable for accounting/auditing

## Firestore Indexes Required
```
Collection: pendingAgreements
- masterAccountId, status
- subcontractorId, status
- masterAccountId, subcontractorId, status

Collection: agreedTimesheets
- masterAccountId, status, agreedAt (desc)
- subcontractorId, status, agreedAt (desc)
- masterAccountId, date (asc/desc)
```

## Next Steps
1. Review and approve this workflow document
2. Implement Phase 1 admin interface changes
3. Design subcontractor portal UI/UX
4. Set up Firebase rules for new collections
5. Create pending agreement manager utility
6. Implement edit hours modal for admin
7. Add comparison view
8. Update PDF generator to support agreed timesheets
