# EPH Agreement System - Required Firebase Indexes

## Overview
This document lists all Firebase indexes required for the EPH (Equipment/Plant Hours) agreement workflow between Admin and Subcontractors.

## Collection: `ephPendingEdits`
This collection stores pending edits made by admin or subcontractor before final agreement.

### Index 1: Query by Asset and Status
**Purpose**: Find pending edits for a specific asset
```json
{
  "collectionGroup": "ephPendingEdits",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "masterAccountId", "order": "ASCENDING" },
    { "fieldPath": "assetId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" }
  ]
}
```

### Index 2: Query by Asset, Date and Master Account
**Purpose**: Find pending edits for a specific asset and date
```json
{
  "collectionGroup": "ephPendingEdits",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "masterAccountId", "order": "ASCENDING" },
    { "fieldPath": "assetId", "order": "ASCENDING" },
    { "fieldPath": "date", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" }
  ]
}
```

### Index 3: Query by Asset with Ordering
**Purpose**: Get all pending edits for an asset ordered by date
```json
{
  "collectionGroup": "ephPendingEdits",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "masterAccountId", "order": "ASCENDING" },
    { "fieldPath": "assetId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "date", "order": "DESCENDING" }
  ]
}
```

### Index 4: Query by Asset with Creation Order
**Purpose**: Get all pending edits for an asset ordered by creation time
```json
{
  "collectionGroup": "ephPendingEdits",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "masterAccountId", "order": "ASCENDING" },
    { "fieldPath": "assetId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

### Index 5: Query by Subcontractor
**Purpose**: Find all pending edits for a subcontractor
```json
{
  "collectionGroup": "ephPendingEdits",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "masterAccountId", "order": "ASCENDING" },
    { "fieldPath": "subcontractorId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "date", "order": "ASCENDING" }
  ]
}
```

## Collection: `pendingAgreements`
This collection stores the overall agreement status for asset timesheets.

### Index 1: Query by Subcontractor with Status
**Purpose**: Find agreements for a specific subcontractor
```json
{
  "collectionGroup": "pendingAgreements",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "subcontractorId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

### Index 2: Query by Subcontractor without Status Filter
**Purpose**: Get all agreements for a subcontractor
```json
{
  "collectionGroup": "pendingAgreements",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "subcontractorId", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

### Index 3: Query by Master Account with Status
**Purpose**: Find agreements for a master account
```json
{
  "collectionGroup": "pendingAgreements",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "masterAccountId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

### Index 4: Query by Master Account without Status Filter
**Purpose**: Get all agreements for a master account
```json
{
  "collectionGroup": "pendingAgreements",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "masterAccountId", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

### Index 5: Query by Asset and Date Range
**Purpose**: Find existing pending agreement for an asset
```json
{
  "collectionGroup": "pendingAgreements",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "assetId", "order": "ASCENDING" },
    { "fieldPath": "dateRange.from", "order": "ASCENDING" },
    { "fieldPath": "dateRange.to", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" }
  ]
}
```

## Collection: `agreedTimesheets`
This collection stores finalized agreed timesheets ready for billing.

### Index 1: Query by Master Account and Date Range
**Purpose**: Get agreed timesheets for billing period
```json
{
  "collectionGroup": "agreedTimesheets",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "masterAccountId", "order": "ASCENDING" },
    { "fieldPath": "date", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" }
  ]
}
```

### Index 2: Query by Original Timesheet ID
**Purpose**: Check if a timesheet has already been agreed
```json
{
  "collectionGroup": "agreedTimesheets",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "originalTimesheetId", "order": "ASCENDING" }
  ]
}
```

### Index 3: Query by Subcontractor
**Purpose**: Get all agreed timesheets for a subcontractor
```json
{
  "collectionGroup": "agreedTimesheets",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "masterAccountId", "order": "ASCENDING" },
    { "fieldPath": "subcontractorId", "order": "ASCENDING" },
    { "fieldPath": "date", "order": "ASCENDING" }
  ]
}
```

### Index 4: Query by Asset
**Purpose**: Get agreed timesheets for a specific asset
```json
{
  "collectionGroup": "agreedTimesheets",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "masterAccountId", "order": "ASCENDING" },
    { "fieldPath": "assetId", "order": "ASCENDING" },
    { "fieldPath": "date", "order": "DESCENDING" }
  ]
}
```

## Complete `firestore.indexes.json` File

Add these to your existing `firestore.indexes.json`:

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
        { "fieldPath": "assetId", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "ephPendingEdits",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "masterAccountId", "order": "ASCENDING" },
        { "fieldPath": "assetId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "ephPendingEdits",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "masterAccountId", "order": "ASCENDING" },
        { "fieldPath": "assetId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "ephPendingEdits",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "masterAccountId", "order": "ASCENDING" },
        { "fieldPath": "subcontractorId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "pendingAgreements",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "subcontractorId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "pendingAgreements",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "subcontractorId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "pendingAgreements",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "masterAccountId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "pendingAgreements",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "masterAccountId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "pendingAgreements",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "assetId", "order": "ASCENDING" },
        { "fieldPath": "dateRange.from", "order": "ASCENDING" },
        { "fieldPath": "dateRange.to", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "agreedTimesheets",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "masterAccountId", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "agreedTimesheets",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "originalTimesheetId", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "agreedTimesheets",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "masterAccountId", "order": "ASCENDING" },
        { "fieldPath": "subcontractorId", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "agreedTimesheets",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "masterAccountId", "order": "ASCENDING" },
        { "fieldPath": "assetId", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "DESCENDING" }
      ]
    }
  ]
}
```

## How to Add These Indexes

### Method 1: Firebase Console (Recommended)
1. Go to Firebase Console → Firestore Database
2. Click on "Indexes" tab
3. Click "Add Index"  
4. For each index above:
   - Select the collection (e.g., "ephPendingEdits")
   - Add the fields with their sort orders (ASCENDING/DESCENDING)
   - Click "Create"

### Method 2: Firebase CLI
1. Copy the indexes above to your `firestore.indexes.json` file
2. Run: `firebase deploy --only firestore:indexes`

### Method 3: Automatic Creation
When you run queries that need these indexes, Firestore will show error messages with links to create them automatically.

## Testing the Indexes

After creating the indexes:

1. **Wait for index creation** (can take a few minutes for large collections)
2. **Test each query**:
   - Load EPH reports
   - Edit hours
   - Compare versions
   - Send to subcontractor
   - View agreed timesheets

3. **Monitor Console** for any missing index errors

## Index Status

You can check index build status in:
- Firebase Console → Firestore → Indexes tab
- Look for "Building" or "Enabled" status

## Troubleshooting

If queries still fail:
1. Check Firebase Console → Firestore → Indexes
2. Look for "Error" status on any indexes
3. Delete and recreate failed indexes
4. Ensure field names match exactly (case-sensitive)
5. Check query constraints match index field order

## Performance Notes

- These indexes enable efficient queries even with large datasets
- Each index adds storage overhead (~1% of collection size)
- Composite indexes are required for queries with multiple filters
- Single-field indexes are automatically created by Firestore

## Security Considerations

Update your Firestore security rules to protect these collections:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // EPH Pending Edits
    match /ephPendingEdits/{editId} {
      allow read: if request.auth != null && 
        (resource.data.masterAccountId == request.auth.token.masterAccountId ||
         resource.data.subcontractorId == request.auth.uid);
      allow create: if request.auth != null &&
        request.resource.data.masterAccountId == request.auth.token.masterAccountId;
      allow update: if request.auth != null &&
        resource.data.masterAccountId == request.auth.token.masterAccountId;
      allow delete: if request.auth != null &&
        resource.data.masterAccountId == request.auth.token.masterAccountId;
    }
    
    // Pending Agreements
    match /pendingAgreements/{agreementId} {
      allow read: if request.auth != null && 
        (resource.data.masterAccountId == request.auth.token.masterAccountId ||
         resource.data.subcontractorId == request.auth.uid);
      allow create: if request.auth != null &&
        request.resource.data.masterAccountId == request.auth.token.masterAccountId;
      allow update: if request.auth != null &&
        (resource.data.masterAccountId == request.auth.token.masterAccountId ||
         resource.data.subcontractorId == request.auth.uid);
      allow delete: if request.auth != null &&
        resource.data.masterAccountId == request.auth.token.masterAccountId;
    }
    
    // Agreed Timesheets
    match /agreedTimesheets/{timesheetId} {
      allow read: if request.auth != null &&
        resource.data.masterAccountId == request.auth.token.masterAccountId;
      allow create: if request.auth != null &&
        request.resource.data.masterAccountId == request.auth.token.masterAccountId;
      allow update: if request.auth != null &&
        resource.data.masterAccountId == request.auth.token.masterAccountId;
      allow delete: if false; // Never allow deletion of agreed timesheets
    }
  }
}
```

## Summary

✅ Created utility files:
- `utils/ephPendingEditsManager.ts` - Manages admin/subcontractor edits
- `utils/ephEmailService.ts` - Sends EPH reports via email

✅ Created modal components:
- `EditEPHHoursModal.tsx` - Admin edits hours
- `TimesheetComparisonModal.tsx` - Compare versions
- `SendConfirmationModal.tsx` - Send to subcontractor

✅ Added integration handlers in `billing-config.tsx`:
- `handleEditHours` - Opens edit modal
- `handleSaveEdit` - Saves pending edits
- `handleCompareVersions` - Opens comparison modal
- `handleSendToSubcontractor` - Generates and sends PDF

⚠️ **Next Steps** (Not done yet - you mentioned these are needed):
1. Add UI buttons to EPH cards for "Edit Hours" and "Compare Versions"
2. Add "Send to Subcontractor" button at top level
3. Render the modals in the return statement
4. Add visual indicators for assets with pending edits
5. Enhance Process Payments tab with status badges and metadata

**The indexes above must be added to Firebase before using these features!**
