# Onboarding & Inductions - Firebase Indexes

> **⚠️ NOTICE: This information has been consolidated into [FIREBASE-INDEXES.md](./FIREBASE-INDEXES.md)**  
> Please refer to the consolidated Firebase indexes documentation for the most up-to-date information.  
> This file is kept for reference but may not be maintained going forward.

## 🚨 ACTION REQUIRED - CREATE THESE INDEXES NOW

Your app is throwing errors because these indexes don't exist yet in Firebase.

### STEP 1: Create OnboardingMessages Index
**Click this link and press "Create Index":**
https://console.firebase.google.com/v1/r/project/project-tracker-app-33cff/firestore/indexes?create_composite=CmRwcm9qZWN0cy9wcm9qZWN0LXRyYWNrZXItYXBwLTMzY2ZmL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9vbmJvYXJkaW5nTWVzc2FnZXMvaW5kZXhlcy9fEAEaCgoGc2l0ZUlkEAEaDQoJdG9Vc2VySWQQARoNCgljcmVhdGVkQXQQAhoMCghfX25hbWVfXxAB

**Fields:**
- `siteId` (Ascending)
- `toUserId` (Ascending)
- `createdAt` (Descending)

### STEP 2: Create PlantAssets (Site + CreatedAt) Index ⚠️ CRITICAL
**Click this link and press "Create Index":**
https://console.firebase.google.com/v1/r/project/project-tracker-app-33cff/firestore/indexes?create_composite=Cl1wcm9qZWN0cy9wcm9qZWN0LXRyYWNrZXItYXBwLTMzY2ZmL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9wbGFudEFzc2V0cy9pbmRleGVzL18QARoKCgZzaXRlSWQQARoNCgljcmVhdGVkQXQQAhoMCghfX25hbWVfXxAC

**Fields:**
- `siteId` (Ascending)
- `createdAt` (Descending)
- `__name__` (Ascending)

**Purpose:** THIS IS THE INDEX YOU NEED! It loads plant assets by siteId ordered by creation date.

### STEP 3: Create PlantAssets (Master Account) Index
**Click this link and press "Create Index":**
https://console.firebase.google.com/v1/r/project/project-tracker-app-33cff/firestore/indexes?create_composite=CmJwcm9qZWN0cy9wcm9qZWN0LXRyYWNrZXItYXBwLTMzY2ZmL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9wbGFudEFzc2V0cy9pbmRleGVzL18QARoSCg5tYXN0ZXJBY2NvdW50SWQQARoKCgZhc3NldElkEAEaDAoIX19uYW1lX18QAQ

**Fields:**
- `masterAccountId` (Ascending)
- `assetId` (Ascending)

### STEP 4: Create HandoverRequests (Surveyor) Index
**Click this link and press "Create Index":**
https://console.firebase.google.com/v1/r/project/project-tracker-app-33cff/firestore/indexes?create_composite=CmZwcm9qZWN0cy9wcm9qZWN0LXRyYWNrZXItYXBwLTMzY2ZmL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9oYW5kb3ZlclJlcXVlc3RzL2luZGV4ZXMvXxABGgoKBnNpdGVJZBABGg8KC3JlcXVlc3RUeXBlEAEaDQoJY3JlYXRlZEF0EAIaDAoIX19uYW1lX18QAQ

**Fields:**
- `siteId` (Ascending)
- `requestType` (Ascending)
- `createdAt` (Descending)

### STEP 5: Wait for Build
- Each index takes 2-5 minutes to build
- You'll see a status indicator in Firebase Console
- Once all show "Enabled", refresh your app

### STEP 6: Verify
- Open the Onboarding Dashboard in your app
- All tabs (Employees, Assets, Messages) should load without errors
- Open the Planner → Surveyor Requests screen

## Required Indexes

### 1. Employees Collection - siteId + name + __name__
**Collection:** `employees`
**Fields:**
- `siteId` (Ascending)
- `name` (Ascending)
- `__name__` (Ascending)

**Purpose:** Load employees by site, ordered alphabetically by name

**Status:** ✅ Defined in firestore.indexes.json

### 2. Assets Collection - siteId + assetName + __name__
**Collection:** `assets`
**Fields:**
- `siteId` (Ascending)
- `assetName` (Ascending)
- `__name__` (Ascending)

**Purpose:** Load assets by site, ordered alphabetically by asset name

**Status:** ✅ Defined in firestore.indexes.json

### 3. OnboardingMessages Collection - siteId + toUserId + createdAt
**Collection:** `onboardingMessages`
**Fields:**
- `siteId` (Ascending)
- `toUserId` (Ascending)
- `createdAt` (Descending)

**Purpose:** Load messages by site and recipient, ordered by creation date

**Status:** ✅ Defined in firestore.indexes.json
**Action Required:** Create in Firebase Console using link above

### 4. PlantAssets Collection - siteId + createdAt ⚠️ CRITICAL
**Collection:** `plantAssets`
**Fields:**
- `siteId` (Ascending)
- `createdAt` (Descending)
- `__name__` (Ascending)

**Purpose:** Load plant assets by site ordered by creation date (THIS IS WHY YOUR ASSETS AREN'T SHOWING!)

**Status:** ✅ Defined in firestore.indexes.json
**Action Required:** CREATE THIS INDEX NOW using link in STEP 2 above

### 5. PlantAssets Collection - masterAccountId + assetId
**Collection:** `plantAssets`
**Fields:**
- `masterAccountId` (Ascending)
- `assetId` (Ascending)

**Purpose:** Load plant assets by master account when no site is selected

**Status:** ✅ Defined in firestore.indexes.json
**Action Required:** Create in Firebase Console using link above

### 6. HandoverRequests Collection - siteId + requestType + createdAt
**Collection:** `handoverRequests`
**Fields:**
- `siteId` (Ascending)
- `requestType` (Ascending)
- `createdAt` (Descending)

**Purpose:** Load surveyor handover requests by site and type, ordered by creation date

**Status:** ✅ Defined in firestore.indexes.json
**Action Required:** Create in Firebase Console using link above

## Data Model

### Employees Collection
```typescript
{
  id: string;                    // Auto-generated
  name: string;                  // Employee name
  role: string;                  // Job role
  contact: string;               // Contact number
  email?: string;                // Optional email
  siteId: string;                // Reference to site
  masterAccountId: string;       // Reference to master account
  inductionStatus: boolean;      // false = pending, true = completed
  inductionDate?: Timestamp;     // Set when inducted
  inductionNotes?: string;       // Notes about induction
  attachments?: Attachment[];    // Array of images and documents
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  type?: 'employee' | 'subcontractor';
  subcontractorCompany?: string;
}
```

### Employer / Subcontractor Relationship

- Employees do not currently persist a foreign key back to the `companies` or `subContractors` collections. The only linkage is the `masterAccountId`, `siteId`, and the optional `subcontractorCompany` string stored directly on the employee document.
- Because the `subcontractorCompany` field is just text, the system cannot enforce referential integrity, deduplicate subcontractors, or answer questions such as "who is the legal employer for this person?" without additional lookups or manual reconciliation.
- To introduce a proper relationship, the next increment should add fields such as `employerCompanyId` and `employerType` (e.g. `'internal' | 'subcontractor'`) that point at canonical documents in `companies` or a new `subcontractors` collection. That change would allow filters, reporting, and ownership validation without duplicating strings.

### Plant Assets Collection
```typescript
{
  id: string;                    // Auto-generated
  assetId: string;               // Asset identifier
  type: string;                  // Asset type
  location: string;              // Current location
  assignedJob?: string;          // Optional job assignment
  assignedSite?: string;         // Optional site assignment
  siteId: string;                // Reference to site
  masterAccountId: string;       // Reference to master account
  inductionStatus: boolean;      // false = pending, true = completed
  inductionDate?: Timestamp;     // Set when inducted
  inductionNotes?: string;       // Notes about induction
  attachments?: Attachment[];    // Array of images and documents
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
```

### Attachment Type
```typescript
{
  id: string;                    // Unique identifier
  fileName: string;              // Original file name
  fileType: 'image' | 'document'; // Type of attachment
  mimeType: string;              // MIME type
  downloadUrl: string;           // Base64 data URL or file URI
  storagePath: string;           // Storage path (empty for base64)
  uploadedAt: string;            // ISO timestamp
  uploadedBy: string;            // User ID who uploaded
  size?: number;                 // File size in bytes
}
```

## Setup Instructions

1. Navigate to Firebase Console > Firestore Database > Indexes
2. Create composite indexes for:
   - `employees` collection with fields: `siteId` (Ascending), `name` (Ascending)
   - `plantAssets` collection with fields: `siteId` (Ascending), `assetId` (Ascending)

## Notes

- Fields can be added to existing employee and asset documents as needed
- The `attachments` array is optional and defaults to empty array
- Attachments are stored as base64 in the document for simplicity (no Firebase Storage needed)
- Image attachments are limited by base64 encoding (recommended < 1MB)
- Document attachments have a 5MB size check
- Both collections are scoped to `siteId` for multi-tenancy
