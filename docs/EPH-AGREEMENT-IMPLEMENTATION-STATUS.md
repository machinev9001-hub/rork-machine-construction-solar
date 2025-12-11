# EPH/Timesheet Agreement System - Implementation Summary

## ✅ Completed

### 1. Documentation
- **EPH-SUBCONTRACTOR-AGREEMENT-WORKFLOW.md**: Comprehensive workflow documentation outlining the entire process from EPH generation to final payment processing
- Defines database structure for `pendingAgreements` and `agreedTimesheets` collections
- Specifies workflow states and transitions
- Security considerations and audit requirements

### 2. Core Utilities
- **utils/pendingAgreementManager.ts**: Complete manager for handling agreement negotiations between admin and subcontractors
  - Create pending agreements
  - Update subcontractor responses
  - Accept/reject agreements
  - Query functions for both parties
  - Full TypeScript types and interfaces

### 3. Existing System
- **utils/agreedTimesheetManager.ts**: Already exists and handles final agreed timesheets
- **utils/timesheetPdfGenerator.ts**: PDF generation for reports (needs updates for new workflow)
- **components/accounts/AgreedHoursModal.tsx**: Modal for agreeing hours (needs enhancements)
- **app/billing-config.tsx**: Main admin interface with three tabs (Config, EPH, Process Payments)

## 🔧 Required Changes

### Phase 1: Admin Interface Updates (billing-config.tsx)

#### 1.1 Tab Rename ✅
- Tab is already renamed to "Process Payments"
- Shows properly in the UI

#### 1.2 Add "Edit Hours" Button to EPH
Currently, EPH shows:
- "View Timesheets" button
- "Agree Hours" button (goes directly to final agreement)

**Need to add:**
```typescript
- "Edit Hours" button → Opens modal to edit individual timesheet hours
  - Input fields for each hour type (normal, saturday, sunday, etc.)
  - Notes field for admin comments
  - Save as admin version (not yet sent to subcontractor)
  - Visual indicator if hours have been edited by admin
```

#### 1.3 Add "Send to Subcontractor" Button
After admin edits (or decides not to edit), they should:
```typescript
- Click "Send to Subcontractor"
- Creates pendingAgreement record
- Sets status: 'pending_subcontractor_review'
- Sends notification (email/in-app)
- Button changes to "Awaiting Response" (disabled, shows status)
```

#### 1.4 Display Subcontractor Response
When subcontractor responds:
```typescript
- Badge appears: "Subcontractor Responded"
- "View Response" button → Opens comparison modal
- Shows three columns:
  - Original (operator + plant manager)
  - Admin's version (if edited)
  - Subcontractor's suggested changes
- Highlights differences in red/green
```

#### 1.5 Update "Agree Hours" Button Logic
Current: Directly creates agreed timesheet
**New:** 
```typescript
- Only enabled after reviewing subcontractor response (if any)
- Or if sent directly without admin edits
- Final confirmation modal:
  "You are about to finalize this timesheet. 
   Admin version will be used as source of truth.
   This action cannot be undone."
- On confirm:
  1. Create agreedTimesheet (existing function)
  2. Update pendingAgreement.status = 'agreed'
  3. Move to Process Payments tab
```

### Phase 2: New Components Needed

#### 2.1 Edit Hours Modal (`components/accounts/EditEPHHoursModal.tsx`)
```typescript
- Similar to AgreedHoursModal but for admin editing
- Shows current hours from EPH
- Allows editing all hour types:
  - normalHours
  - saturdayHours
  - sundayHours
  - publicHolidayHours
  - breakdownHours
  - rainDayHours
  - strikeDayHours
- Admin notes field
- Save button → Saves to local state (not yet sent)
- Visual feedback: "Edited by you"
```

#### 2.2 Comparison Modal (`components/accounts/TimesheetComparisonModal.tsx`)
```typescript
- Three-column layout (responsive)
- Column 1: Original
- Column 2: Admin's version
- Column 3: Subcontractor's version
- Diff highlighting
- Notes from both parties
- "Accept Subcontractor Changes" button
- "Keep My Version" button
- "Edit Again" button
```

#### 2.3 Send to Subcontractor Confirmation Modal
```typescript
- Confirms action
- Shows what will be sent
- Option to add a message
- "Send" button → creates pendingAgreement
```

### Phase 3: Process Payments Tab Enhancement

Current state: Shows individual timesheets
**Needs:**
```typescript
- Group by agreement
- Show summary:
  - Subcontractor name
  - Date range
  - Total hours
  - Agreement date
  - Status badge
- Expandable to show individual days
- "Generate Invoice PDF" button
- "Mark as Paid" button
- Filter by status: All | Pending Payment | Paid
```

### Phase 4: Subcontractor Portal (Separate App/Module)

**New standalone app or module** for subcontractors to access:

#### 4.1 Authentication
- Separate login (email + password or magic link)
- Tied to subcontractor record
- Can only see their own data

#### 4.2 Dashboard
```typescript
- Shows pending reviews count
- Recent agreements
- Quick stats (total hours this month, etc.)
```

#### 4.3 Pending Reviews Page
```typescript
- List all EPH reports awaiting review
- Each card shows:
  - Asset type & number
  - Date range
  - Proposed hours by admin
  - "Review" button
```

#### 4.4 Review & Edit Page
```typescript
- Shows admin's proposed version
- Editable fields to suggest changes
- Notes field to explain changes
- Two buttons:
  - "Accept" → No changes, admin version is good
  - "Suggest Changes" → Submit edited version
```

#### 4.5 Agreement History
```typescript
- Past agreed timesheets
- Download PDFs
- View details
```

## 📋 Implementation Checklist

### Immediate Next Steps (Start Here)

- [ ] **Create EditEPHHoursModal component**
  - Copy AgreedHoursModal as template
  - Modify for admin editing (not final agreement)
  - Add validation
  - Connect to billing-config state

- [ ] **Update EPH card in billing-config.tsx**
  - Add "Edit Hours" button
  - Track edited state per asset
  - Show visual indicator if edited
  - Update ephData state to include editedVersion

- [ ] **Create Send to Subcontractor flow**
  - Button in EPH card
  - Confirmation modal
  - Call createPendingAgreement utility
  - Update UI to show "Awaiting Response" state

- [ ] **Add pending agreement status checks**
  - On EPH load, check for existing pendingAgreement
  - Show current status
  - Update button states based on status

- [ ] **Create TimesheetComparisonModal**
  - Side-by-side comparison
  - Diff highlighting
  - Action buttons

- [ ] **Update Process Payments tab**
  - Query agreedTimesheets collection
  - Group by agreement
  - Add filters and actions

### Database Setup

- [ ] **Create Firestore indexes**
```
Collection: pendingAgreements
- masterAccountId, status (ascending)
- subcontractorId, status (ascending)
- masterAccountId, subcontractorId, status (ascending)
- masterAccountId, createdAt (descending)
- subcontractorId, createdAt (descending)

Collection: agreedTimesheets
- masterAccountId, status, agreedAt (descending)
- subcontractorId, status, agreedAt (descending)
- masterAccountId, date (ascending)
- masterAccountId, date (descending)
```

- [ ] **Set up Firebase security rules**
```javascript
match /pendingAgreements/{agreementId} {
  // Admin can read/write their master account's agreements
  allow read, write: if request.auth != null && 
    request.auth.token.masterAccountId == resource.data.masterAccountId;
  
  // Subcontractor can read their own agreements
  allow read: if request.auth != null && 
    request.auth.token.subcontractorId == resource.data.subcontractorId;
  
  // Subcontractor can update their response
  allow update: if request.auth != null && 
    request.auth.token.subcontractorId == resource.data.subcontractorId &&
    resource.data.status == 'pending_subcontractor_review';
}

match /agreedTimesheets/{timesheetId} {
  // Admin can read/write
  allow read, write: if request.auth != null && 
    request.auth.token.masterAccountId == resource.data.masterAccountId;
  
  // Subcontractor can read their agreed timesheets
  allow read: if request.auth != null && 
    request.auth.token.subcontractorId == resource.data.subcontractorId;
}
```

### Future Enhancements

- [ ] Email notifications
  - Admin → Subcontractor: "New EPH for review"
  - Subcontractor → Admin: "Response submitted"
  - Admin → Subcontractor: "Agreement finalized"

- [ ] Push notifications (if mobile app)

- [ ] Real-time updates using Firestore listeners

- [ ] Audit log for all changes

- [ ] PDF enhancements to show all versions

- [ ] Bulk operations (agree multiple assets at once)

- [ ] Dispute resolution workflow

## 🎯 Current State vs Target State

### Current (As-Is)
```
1. EPH generated
2. Admin clicks "Agree Hours" immediately
3. Goes directly to agreedTimesheets
4. No subcontractor involvement
5. Admin is source of truth by default
```

### Target (To-Be)
```
1. EPH generated
2. Admin reviews and optionally edits
3. Admin sends to subcontractor
4. Subcontractor reviews and can suggest changes
5. Admin makes final decision (with or without subcontractor input)
6. Final agreement → agreedTimesheets → Process Payments
7. Both parties have visibility and input
8. Clear audit trail
```

## 📞 Questions for User

1. **Subcontractor Portal**: Do you want this as:
   - A. Separate mobile/web app?
   - B. Part of the same app with different role/login?
   - C. Web-only portal?

2. **Notifications**: Priority for:
   - A. Email notifications?
   - B. Push notifications?
   - C. In-app only?

3. **Edit Scope**: When admin edits, should they edit:
   - A. Individual timesheet entries (per day)?
   - B. Totals only (aggregate hours)?
   - C. Both options available?

4. **Subcontractor Response Time**: Should there be:
   - A. Deadline for subcontractor to respond?
   - B. Auto-approve if no response after X days?
   - C. Manual follow-up only?

5. **Process Payments Tab**: Should it also show:
   - A. Invoicing functionality?
   - B. Payment tracking?
   - C. Integration with accounting software?

## 🚀 Quick Start for Next Development Session

**To continue implementing this workflow:**

1. Read `docs/EPH-SUBCONTRACTOR-AGREEMENT-WORKFLOW.md` for full context
2. Start with creating `components/accounts/EditEPHHoursModal.tsx`
3. Update `app/billing-config.tsx` to add "Edit Hours" button
4. Use `utils/pendingAgreementManager.ts` for all agreement operations
5. Test the flow: EPH → Edit → Send → (Manual subcontractor response simulation) → Review → Agree → Process Payments

## 📝 Notes

- Admin version is ALWAYS the source of truth (as per requirements)
- Subcontractor can only suggest changes, not override
- All changes are audited with timestamps and user IDs
- Agreed timesheets are immutable once created
- System supports the workflow even if subcontractor doesn't respond (admin can proceed)

---

**Last Updated:** 2025-12-11
**Status:** Documentation and core utilities complete, UI implementation pending
