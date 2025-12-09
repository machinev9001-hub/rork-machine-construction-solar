# Firebase Indexes - Complete Guide

## Overview
This document consolidates ALL required Firebase indexes for the entire application.

---

## Core Workflow Indexes

### Collection: `requests`

#### Index 1: Task Request Query
```
Collection: requests
Fields:
  - type (Ascending)
  - siteId (Ascending)
  - createdAt (Descending)
```
**Used in:** Task Requests, Scope Requests, Cabling Requests, Termination Requests, Surveyor Requests, Handover Requests, Concrete Requests, Commissioning Requests

#### Index 2: QC Request Query
```
Collection: requests
Fields:
  - type (Ascending)
  - siteId (Ascending)
  - updatedAt (Descending)
```
**Used in:** QC Requests screen

#### Index 3: Request Status Filter
```
Collection: requests
Fields:
  - type (Ascending)
  - siteId (Ascending)
  - taskId (Ascending)
  - activityId (Ascending)
  - status (Ascending)
```
**Used in:** Multi-field request filtering

---

### Collection: `activities`

#### Index 1: Activity Lookup
```
Collection: activities
Fields:
  - taskId (Ascending)
  - activityId (Ascending)
```
**Used in:** All activity lookups by task context

#### Index 2: Scope Requested
```
Collection: activities
Fields:
  - scopeRequested (Ascending)
  - status (Ascending)
```

#### Index 3: QC Requested
```
Collection: activities
Fields:
  - qcRequested (Ascending)
  - status (Ascending)
```

#### Index 4: Cabling Requested
```
Collection: activities
Fields:
  - cablingRequested (Ascending)
  - status (Ascending)
```

#### Index 5: Termination Requested
```
Collection: activities
Fields:
  - terminationRequested (Ascending)
  - status (Ascending)
```

---

### Collection: `tasks`

#### Index 1: Tasks by Site and Supervisor
```
Collection: tasks
Fields:
  - siteId (Ascending)
  - supervisorId (Ascending)
  - subActivity (Ascending)
```

#### Index 2: Tasks by Site and Status
```
Collection: tasks
Fields:
  - siteId (Ascending)
  - status (Ascending)
  - createdAt (Descending)
```

---

### Collection: `messages`

#### Index: User Messages
```
Collection: messages
Fields:
  - type (Ascending)
  - siteId (Ascending)
  - toUserId (Ascending)
  - createdAt (Descending)
```

---

### Collection: `progressEntries` (Collection Group)

⚠️ **IMPORTANT:** These use **Collection Group** scope

#### Index 1: Progress by Supervisor
```
Collection Group: progressEntries
Fields:
  - supervisorId (Ascending)
  - enteredAt (Descending)
```

#### Index 2: Progress by Site
```
Collection Group: progressEntries
Fields:
  - siteId (Ascending)
  - enteredAt (Descending)
```

#### Index 3: Progress by Task
```
Collection Group: progressEntries
Fields:
  - taskId (Ascending)
  - enteredAt (Descending)
```

#### Index 4: Progress by Activity
```
Collection Group: progressEntries
Fields:
  - activityId (Ascending)
  - enteredAt (Descending)
```

---

## Company & Multi-Tenant Indexes

### Collection: `companies`

#### Index 1: Status + Created At
```
Collection: companies
Fields:
  - status (Ascending)
  - createdAt (Descending)
```

#### Index 2: Status + Industry Sector
```
Collection: companies
Fields:
  - status (Ascending)
  - industrySector (Ascending)
  - createdAt (Descending)
```

#### Index 3: Industry Sector + Created At
```
Collection: companies
Fields:
  - industrySector (Ascending)
  - createdAt (Descending)
```

#### Index 4: Created By + Industry Sector
```
Collection: companies
Fields:
  - createdBy (Ascending)
  - industrySector (Ascending)
  - createdAt (Descending)
```

---

### Collection: `users`

#### Index 1: Company IDs + Role
```
Collection: users
Fields:
  - companyIds (Array-contains)
  - role (Ascending)
```

#### Index 2: Current Company + Role
```
Collection: users
Fields:
  - currentCompanyId (Ascending)
  - role (Ascending)
```

#### Index 3: Company IDs + Site ID
```
Collection: users
Fields:
  - companyIds (Array-contains)
  - siteId (Ascending)
```

#### Index 4: Site and Role (Legacy)
```
Collection: users
Fields:
  - siteId (Ascending)
  - role (Ascending)
  - isActive (Ascending)
```

---

### Collection: `sites`

#### Index 1: Company + Master Account
```
Collection: sites
Fields:
  - companyId (Ascending)
  - masterAccountId (Ascending)
```

#### Index 2: Company + Status
```
Collection: sites
Fields:
  - companyId (Ascending)
  - status (Ascending)
```

#### Index 3: Company + Created At
```
Collection: sites
Fields:
  - companyId (Ascending)
  - createdAt (Descending)
```

---

### Collection: `masterAccounts`

#### Index 1: Company IDs + Created At
```
Collection: masterAccounts
Fields:
  - companyIds (Array-contains)
  - createdAt (Descending)
```

#### Index 2: Current Company + Created At
```
Collection: masterAccounts
Fields:
  - currentCompanyId (Ascending)
  - createdAt (Descending)
```

---

## Plant Asset Allocation Indexes

### Collection: `plantAssets`

#### Index 1: Company + Allocation Status
```
Collection: plantAssets
Fields:
  - companyId (Ascending)
  - allocationStatus (Ascending)
  - createdAt (Descending)
```

#### Index 2: Site + Allocation Status
```
Collection: plantAssets
Fields:
  - siteId (Ascending)
  - allocationStatus (Ascending)
  - createdAt (Descending)
```

#### Index 3: Master Account + Allocation Status
```
Collection: plantAssets
Fields:
  - masterAccountId (Ascending)
  - allocationStatus (Ascending)
  - createdAt (Descending)
```

#### Index 4: Company + Created At
```
Collection: plantAssets
Fields:
  - companyId (Ascending)
  - createdAt (Descending)
```

---

### Collection: `plantAssetHours`

#### Index 1: Operator ID + Date
```
Collection: plantAssetHours
Fields:
  - operatorId (Ascending)
  - date (Descending)
```

#### Index 2: Asset ID + Date
```
Collection: plantAssetHours
Fields:
  - assetId (Ascending)
  - date (Descending)
```

#### Index 3: Master Account + Date
```
Collection: plantAssetHours
Fields:
  - masterAccountId (Ascending)
  - date (Descending)
```

#### Index 4: Site ID + Date
```
Collection: plantAssetHours
Fields:
  - siteId (Ascending)
  - date (Descending)
```

---

## Onboarding System Indexes

### Collection: `employees`

#### Index 1: Company + Status
```
Collection: employees
Fields:
  - companyId (Ascending)
  - status (Ascending)
  - createdAt (Descending)
```

#### Index 2: Site + Status
```
Collection: employees
Fields:
  - siteId (Ascending)
  - status (Ascending)
```

---

### Collection: `onboardingAssets`

#### Index: Company + Status
```
Collection: onboardingAssets
Fields:
  - companyId (Ascending)
  - status (Ascending)
  - createdAt (Descending)
```

---

### Collection: `onboardingMessages`

#### Index: Recipient + Created At
```
Collection: onboardingMessages
Fields:
  - recipientId (Ascending)
  - createdAt (Descending)
```

---

## Miscellaneous Indexes

### Collection: `boq`
```
Collection: boq
Fields:
  - siteId (Ascending)
  - activityName (Ascending)
```

### Collection: `surveyorTasks`
```
Collection: surveyorTasks
Fields:
  - siteId (Ascending)
  - status (Ascending)
```

### Collection: `companyUsers`

#### Index 1: Company + User
```
Collection: companyUsers
Fields:
  - companyId (Ascending)
  - userId (Ascending)
```

#### Index 2: User + Company
```
Collection: companyUsers
Fields:
  - userId (Ascending)
  - companyId (Ascending)
```

#### Index 3: Company + Role
```
Collection: companyUsers
Fields:
  - companyId (Ascending)
  - role (Ascending)
```

---

## How to Create Indexes

### Method 1: Automatic (Recommended)
1. Run your app and trigger queries
2. Check console for Firebase errors
3. Click the provided link in error message
4. Firebase auto-creates the exact index

### Method 2: Manual Creation
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Navigate to **Firestore Database** → **Indexes**
3. Click **Create Index**
4. Copy collection and field information from above

### Method 3: Firebase CLI
Update `firestore.indexes.json` and run:
```bash
firebase deploy --only firestore:indexes
```

---

## Cleanup Guide

### Removing Old Indexes

If you have duplicate or capitalized collection indexes (e.g., `PlantAssetHours` instead of `plantAssetHours`):

1. Go to Firebase Console → Firestore → Indexes
2. Delete any indexes with capitalized collection names
3. Delete any old `operatorAssetHours` indexes
4. Run `firebase deploy --only firestore:indexes` to sync

### Common Issues

**Issue 1: CLI wants to delete indexes**
- This means indexes exist in Firebase but not in your local `firestore.indexes.json`
- Review the indexes and answer "Yes" to delete old/duplicate ones

**Issue 2: Query still fails after creating index**
- Wait 2-5 minutes for index to build
- Check Firebase Console - status should be "Enabled" (green)
- Clear app cache and restart

---

## Verification Checklist

After creating indexes, test these screens:

- [ ] Planner - Task Requests
- [ ] Planner - Activity Requests
- [ ] Planner - QC Requests
- [ ] Planner - Cabling Requests
- [ ] Planner - Termination Requests
- [ ] Supervisor - Activity Detail
- [ ] Master - Dashboard
- [ ] Plant Manager - Asset Allocation
- [ ] Operator - Hours Dashboard
- [ ] Company Selector
- [ ] Employee Management

---

## Related Files
- `firestore.indexes.json` - Local index definitions
- `docs/COMPANY-INDEXES.md` - Detailed company index docs (archived)
- `docs/PLANT-ASSET-ALLOCATION-INDEXES.md` - Plant asset docs (archived)
- `docs/ONBOARDING-INDEXES.md` - Onboarding docs (archived)

---

**Last Updated:** 2025-01-23  
**Status:** Complete and production-ready
