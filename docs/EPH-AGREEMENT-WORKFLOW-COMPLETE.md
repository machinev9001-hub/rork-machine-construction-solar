# EPH Agreement Workflow - Complete Implementation Guide

## Overview
This document describes the complete workflow for the EPH (Equipment/Plant Hours) agreement process between Admin and Subcontractors, including all UI components and backend integrations needed.

## Workflow States

### State 1: Initial EPH Generation (Current Implementation)
**Location**: `app/billing-config.tsx` - EPH Tab

**Status**: ✅ Already Implemented

**Features**:
- Admin selects subcontractor and date range
- System generates EPH report from verified timesheets
- Shows asset cards with hours breakdown
- Can view individual timesheets
- Can generate PDF reports

### State 2: Admin Edits Hours (NEW)
**Status**: 🔨 Needs Integration

**Components Created**:
- ✅ `EditEPHHoursModal.tsx` - Modal for admin to edit timesheet hours

**Implementation Needed**:
1. Add "Edit Hours" button to each EPH asset card (next to "Agree Hours")
2. When clicked, opens EditEPHHoursModal with current timesheet data
3. Admin can edit:
   - Total hours
   - Open/close times
   - Day conditions (breakdown, rain, strike, holiday)
   - Admin notes
4. On save:
   - Create/update a pending admin edit record (not yet agreed)
   - Mark EPH as "Edited - Pending Subcontractor Review"
   - Show visual indicator that admin has edited this timesheet

**Database Structure**:
```typescript
// Collection: ephPendingEdits
{
  id: string;
  originalTimesheetId: string;
  assetId: string;
  date: string;
  editedBy: 'admin' | 'subcontractor';
  editedByUserId: string;
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
  
  // Status
  status: 'pending_review' | 'reviewed' | 'superseded';
  reviewedBy?: string;
  reviewedAt?: Timestamp;
  
  // Original values for comparison
  originalTotalHours: number;
  originalOpenHours: string;
  originalCloseHours: string;
  
  masterAccountId: string;
  siteId: string;
  subcontractorId: string;
}
```

### State 3: Send to Subcontractor (NEW)
**Status**: 🔨 Needs Integration

**Components Created**:
- ✅ `SendConfirmationModal.tsx` - Modal to send EPH to subcontractor

**Implementation Needed**:
1. Add "Send to Subcontractor" button in EPH tab
2. When clicked, opens SendConfirmationModal
3. Admin enters subcontractor email and optional message
4. On send:
   - Generate PDF with admin edits (if any)
   - Send email to subcontractor with:
     - PDF attachment
     - Link to subcontractor portal (future)
     - Instructions for review
   - Update EPH status to "Sent to Subcontractor - Awaiting Response"
   
**Email Template**:
```
Subject: EPH Report for Review - [Period] - [Subcontractor Name]

Dear [Subcontractor Name],

Please find attached the Equipment/Plant Hours (EPH) report for the period [From Date] to [To Date].

Assets Included: [Count]
Total Hours: [Sum]

[Admin Message if provided]

Please review the hours and respond with any corrections or approval.

To submit your response, please reply to this email or access your portal at: [Portal Link]

Thank you,
[Company Name]
```

### State 4: Subcontractor Reviews and Edits (FUTURE)
**Status**: 📋 Future Implementation

**Features Needed**:
- Subcontractor portal/app to view EPH
- Ability for subcontractor to:
  - View admin's version
  - Edit hours if they disagree
  - Add their own notes
  - Submit their version back

**Components to Create**:
- SubcontractorEPHView.tsx
- SubcontractorEditModal.tsx
- SubcontractorSubmitConfirmation.tsx

### State 5: Comparison View (NEW)
**Status**: 🔨 Needs Integration

**Components Created**:
- ✅ `TimesheetComparisonModal.tsx` - Side-by-side comparison of versions

**Implementation Needed**:
1. Add "Compare Versions" button when multiple versions exist
2. Shows three columns:
   - Plant Manager (original)
   - Admin Edited (if exists)
   - Subcontractor Edited (if exists)
3. Highlights differences between versions
4. Admin uses this to make final decision

### State 6: Final Agreement (ENHANCED)
**Status**: 🔨 Needs Enhancement

**Current**: AgreedHoursModal exists but needs status tracking

**Implementation Needed**:
1. After comparison, admin clicks "Agree Hours"
2. Opens enhanced AgreedHoursModal with:
   - Comparison summary
   - Final agreed values (can still be edited)
   - Status indicator (who agreed, when)
3. On agreement:
   - Creates agreed timesheet record
   - Marks all pending edits as "superseded"
   - Moves to "Process Payments" tab
   - Sends confirmation email to subcontractor

### State 7: Process Payments Tab (ENHANCED)
**Status**: 🔨 Needs Enhancement

**Current**: PlantAssetsTimesheetsTab shows agreed timesheets

**Enhancements Needed**:
1. Group by agreement status:
   - "Fully Agreed" - Both parties agreed
   - "Admin Override" - Admin finalized despite subcontractor edit
   - "Auto-Agreed" - No edits, auto-approved
2. Add filters:
   - By subcontractor
   - By agreement date
   - By status
3. Show agreement metadata:
   - Who agreed (admin name)
   - When agreed
   - If there were edits
   - Final vs original hours difference

## UI Component Details

### 1. EditEPHHoursModal
**Purpose**: Admin edits timesheet hours before sending to subcontractor

**Props**:
```typescript
{
  visible: boolean;
  onClose: () => void;
  onSave: (editedValues: EditedValues) => Promise<void>;
  timesheet: TimesheetEntry | null;
}
```

**Features**:
- Shows current timesheet data
- Warning banner about requiring re-approval
- Edit all hour fields
- Edit day conditions (checkboxes)
- Admin notes field
- Validation before save

### 2. TimesheetComparisonModal
**Purpose**: Side-by-side comparison of Plant Manager, Admin, and Subcontractor versions

**Props**:
```typescript
{
  visible: boolean;
  onClose: () => void;
  comparison: {
    plantManager: TimesheetEntry;
    adminEdited?: TimesheetEntry;
    subcontractorEdited?: TimesheetEntry;
  } | null;
}
```

**Features**:
- Three-column layout with arrows showing changes
- Highlights differences with colored backgrounds
- Shows all fields: hours, times, conditions, notes
- Legend explaining color coding
- Read-only comparison view

### 3. SendConfirmationModal
**Purpose**: Send EPH report to subcontractor for review

**Props**:
```typescript
{
  visible: boolean;
  onClose: () => void;
  onSend: (recipientEmail: string, message: string) => Promise<void>;
  subcontractorName: string;
  assetCount: number;
  dateRange: { from: Date; to: Date };
}
```

**Features**:
- Shows EPH summary
- Recipient email field (required)
- Optional message field
- Informational notes about the process
- Validation before sending

## Integration Steps

### Step 1: Update billing-config.tsx

Add state for pending edits:
```typescript
const [pendingEdits, setPendingEdits] = useState<Map<string, any>>(new Map());
const [editModalVisible, setEditModalVisible] = useState(false);
const [comparisonModalVisible, setComparisonModalVisible] = useState(false);
const [sendModalVisible, setSendModalVisible] = useState(false);
const [selectedTimesheetForEdit, setSelectedTimesheetForEdit] = useState<any>(null);
const [selectedComparison, setSelectedComparison] = useState<any>(null);
```

Add buttons to EPH card actions:
```typescript
<View style={styles.ephActions}>
  <TouchableOpacity
    style={styles.editHoursButton}
    onPress={() => handleEditHours(item.assetId)}
  >
    <Edit3 size={18} color="#1e3a8a" />
    <Text style={styles.editHoursButtonText}>Edit Hours</Text>
  </TouchableOpacity>
  
  {hasPendingEdits && (
    <TouchableOpacity
      style={styles.compareButton}
      onPress={() => handleCompareVersions(item.assetId)}
    >
      <GitCompare size={18} color="#3b82f6" />
      <Text style={styles.compareButtonText}>Compare Versions</Text>
    </TouchableOpacity>
  )}
  
  <TouchableOpacity
    style={styles.viewTimesheetsButton}
    onPress={() => handleViewTimesheets(item.assetId)}
  >
    <ClipboardList size={18} color="#1e3a8a" />
    <Text style={styles.viewTimesheetsButtonText}>View Timesheets</Text>
  </TouchableOpacity>
  
  <TouchableOpacity
    style={styles.agreeHoursButton}
    onPress={() => handleOpenAgreedHoursModal(item.assetId)}
  >
    <Check size={18} color="#ffffff" />
    <Text style={styles.agreeHoursButtonText}>Agree Hours</Text>
  </TouchableOpacity>
</View>
```

Add "Send to Subcontractor" button at top level:
```typescript
<TouchableOpacity
  style={styles.sendToSubButton}
  onPress={() => setSendModalVisible(true)}
  disabled={selectedAssetIds.size === 0}
>
  <Send size={18} color="#ffffff" />
  <Text style={styles.sendToSubButtonText}>Send to Subcontractor</Text>
</TouchableOpacity>
```

Add modals:
```typescript
<EditEPHHoursModal
  visible={editModalVisible}
  onClose={() => {
    setEditModalVisible(false);
    setSelectedTimesheetForEdit(null);
  }}
  onSave={handleSaveEdit}
  timesheet={selectedTimesheetForEdit}
/>

<TimesheetComparisonModal
  visible={comparisonModalVisible}
  onClose={() => {
    setComparisonModalVisible(false);
    setSelectedComparison(null);
  }}
  comparison={selectedComparison}
/>

<SendConfirmationModal
  visible={sendModalVisible}
  onClose={() => setSendModalVisible(false)}
  onSend={handleSendToSubcontractor}
  subcontractorName={subcontractors.find(s => s.id === selectedSubcontractor)?.name || ''}
  assetCount={selectedAssetIds.size}
  dateRange={{ from: startDate, to: endDate }}
/>
```

### Step 2: Create Pending Edits Manager

Create `utils/ephPendingEditsManager.ts`:
```typescript
import { collection, doc, setDoc, getDocs, query, where, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';

export async function createPendingEdit(params: {
  originalTimesheetId: string;
  assetId: string;
  date: string;
  editedBy: 'admin' | 'subcontractor';
  editedByUserId: string;
  totalHours: number;
  openHours: string;
  closeHours: string;
  isBreakdown: boolean;
  isRainDay: boolean;
  isStrikeDay: boolean;
  isPublicHoliday: boolean;
  notes: string;
  originalTotalHours: number;
  originalOpenHours: string;
  originalCloseHours: string;
  masterAccountId: string;
  siteId: string;
  subcontractorId: string;
}): Promise<string> {
  const editRef = doc(collection(db, 'ephPendingEdits'));
  const editId = editRef.id;
  
  await setDoc(editRef, {
    ...params,
    id: editId,
    status: 'pending_review',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  
  return editId;
}

export async function getPendingEditsByAsset(
  assetId: string,
  masterAccountId: string
): Promise<any[]> {
  const q = query(
    collection(db, 'ephPendingEdits'),
    where('assetId', '==', assetId),
    where('masterAccountId', '==', masterAccountId),
    where('status', '==', 'pending_review')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function supersedePendingEdit(editId: string): Promise<void> {
  await updateDoc(doc(db, 'ephPendingEdits', editId), {
    status: 'superseded',
    updatedAt: Timestamp.now(),
  });
}
```

### Step 3: Create Email Service

Create `utils/ephEmailService.ts`:
```typescript
import * as MailComposer from 'expo-mail-composer';
import { Platform, Alert } from 'react-native';

export async function sendEPHToSubcontractor(params: {
  recipientEmail: string;
  message: string;
  pdfUri: string;
  pdfFileName: string;
  subcontractorName: string;
  dateRange: { from: Date; to: Date };
  assetCount: number;
  totalHours: number;
  companyName: string;
}): Promise<void> {
  const { recipientEmail, message, pdfUri, pdfFileName, subcontractorName, dateRange, assetCount, totalHours, companyName } = params;
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };
  
  const subject = `EPH Report for Review - ${formatDate(dateRange.from)} to ${formatDate(dateRange.to)} - ${subcontractorName}`;
  
  const body = `Dear ${subcontractorName},

Please find attached the Equipment/Plant Hours (EPH) report for the period ${formatDate(dateRange.from)} to ${formatDate(dateRange.to)}.

Assets Included: ${assetCount}
Total Hours: ${totalHours.toFixed(1)}h

${message ? `\n${message}\n` : ''}
Please review the hours and respond with any corrections or approval.

Thank you,
${companyName}`;
  
  if (Platform.OS === 'web') {
    console.log('[EPH Email] Web platform - opening email composer simulation');
    Alert.alert(
      'Email Composer',
      `Would open email to:\n${recipientEmail}\n\nSubject: ${subject}\n\nWith PDF attachment: ${pdfFileName}`,
      [{ text: 'OK' }]
    );
    return;
  }
  
  const isAvailable = await MailComposer.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Email composer not available on this device');
  }
  
  await MailComposer.composeAsync({
    recipients: [recipientEmail],
    subject,
    body,
    attachments: [pdfUri],
  });
}
```

### Step 4: Update Process Payments Tab

Enhance `PlantAssetsTimesheetsTab.tsx`:

Add status badges to groups:
```typescript
const getAgreementStatus = (group: TimesheetGroup): 'fully_agreed' | 'admin_override' | 'auto_agreed' => {
  // Logic to determine agreement status based on metadata
  return 'fully_agreed';
};

// In renderGroup, add status badge:
<View style={styles.statusBadge}>
  <Text style={styles.statusBadgeText}>
    {status === 'fully_agreed' && '✅ Fully Agreed'}
    {status === 'admin_override' && '⚠️ Admin Override'}
    {status === 'auto_agreed' && '✓ Auto-Agreed'}
  </Text>
</View>
```

Add agreement metadata section:
```typescript
<View style={styles.agreementMeta}>
  <Text style={styles.metaLabel}>Agreed By:</Text>
  <Text style={styles.metaValue}>{group.agreedBy || 'N/A'}</Text>
  <Text style={styles.metaLabel}>Agreed At:</Text>
  <Text style={styles.metaValue}>
    {group.agreedAt ? new Date(group.agreedAt).toLocaleDateString('en-GB') : 'N/A'}
  </Text>
  {group.hoursDifference && (
    <>
      <Text style={styles.metaLabel}>Hours Difference:</Text>
      <Text style={[styles.metaValue, group.hoursDifference > 0 ? styles.metaPositive : styles.metaNegative]}>
        {group.hoursDifference > 0 ? '+' : ''}{group.hoursDifference.toFixed(1)}h
      </Text>
    </>
  )}
</View>
```

## Required Firebase Indexes

Add to `firestore.indexes.json`:
```json
{
  "indexes": [
    {
      "collectionGroup": "ephPendingEdits",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "masterAccountId", "order": "ASCENDING" },
        { "fieldPath": "assetId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "ephPendingEdits",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "masterAccountId", "order": "ASCENDING" },
        { "fieldPath": "subcontractorId", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "ASCENDING" }
      ]
    }
  ]
}
```

## Testing Checklist

### EPH Generation
- [ ] Select subcontractor and date range
- [ ] Generate EPH report
- [ ] View individual timesheets
- [ ] Generate PDF report

### Admin Edits
- [ ] Click "Edit Hours" on asset card
- [ ] Modal opens with current data
- [ ] Edit total hours
- [ ] Edit open/close times
- [ ] Toggle day conditions
- [ ] Add admin notes
- [ ] Save successfully
- [ ] Pending edit badge appears on card

### Comparison
- [ ] Click "Compare Versions" when edits exist
- [ ] See Plant Manager original
- [ ] See Admin edited version
- [ ] Differences highlighted correctly
- [ ] All fields compared (hours, conditions, notes)

### Send to Subcontractor
- [ ] Click "Send to Subcontractor"
- [ ] Enter valid email
- [ ] Add optional message
- [ ] Send successfully
- [ ] Email received with PDF attachment

### Agreement
- [ ] Click "Agree Hours" after edits
- [ ] Review comparison
- [ ] Enter final agreed values
- [ ] Save agreement
- [ ] Timesheet moves to Process Payments tab
- [ ] Pending edits marked as superseded

### Process Payments
- [ ] See agreed timesheets
- [ ] Status badges correct
- [ ] Agreement metadata visible
- [ ] Can filter by status
- [ ] Can generate final reports

## Production Deployment Notes

### Email Service Setup
1. Configure email service (SendGrid, AWS SES, etc.)
2. Set up email templates in Firebase Functions
3. Add environment variables for email credentials
4. Test email delivery in staging

### Subcontractor Portal
1. Create subcontractor authentication system
2. Build subcontractor dashboard
3. Implement edit and submission workflow
4. Add notifications for new EPH reports

### Security Rules
Update Firestore security rules:
```javascript
match /ephPendingEdits/{editId} {
  allow read: if isAdmin() || isSubcontractor(resource.data.subcontractorId);
  allow create: if isAdmin() || isSubcontractor(request.resource.data.subcontractorId);
  allow update: if isAdmin() && request.resource.data.status == 'reviewed';
  allow delete: if isAdmin();
}
```

## Future Enhancements

1. **Automated Reminders**: Send reminder emails if subcontractor hasn't responded
2. **Approval Deadlines**: Set deadlines for subcontractor response
3. **Bulk Operations**: Edit/send multiple assets at once
4. **Audit Trail**: Complete history of all edits and agreements
5. **Dispute Resolution**: Workflow for disagreements
6. **Integration**: Connect with accounting software for payments
7. **Mobile App**: Subcontractor mobile app for easier access
8. **Push Notifications**: Real-time notifications for status changes

## Support

For questions or issues, contact the development team or refer to:
- `docs/BILLING-TIMESHEET-WORKFLOW-CLARIFICATION.md`
- `docs/TIMESHEET-PDF-EMAIL-SYSTEM.md`
- `docs/EPH-AGREEMENT-IMPLEMENTATION-STATUS.md`
