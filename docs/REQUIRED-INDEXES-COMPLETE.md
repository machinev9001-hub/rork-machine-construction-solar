# 🔥 Complete Firebase Index Setup Guide

## Overview
This document contains ALL required Firebase indexes for the entire application including:
- Company management (with NEW industry sector field)
- Plant asset allocation system
- Multi-tenant operations

---

## ⚠️ NEW REQUIREMENT: Industry Sector Field

### What Changed
- Companies now **MUST** have an `industrySector` field
- This field is selected during company creation from a predefined list
- Helps categorize companies and enables industry-specific features (e.g., Plant Hire Pool)

### Industry Sectors Available
1. Construction & Civils
2. Mining
3. Manufacturing
4. Oil & Gas
5. Renewable Energy
6. Infrastructure
7. Transportation & Logistics
8. Agriculture
9. Marine & Maritime
10. Telecommunications
11. Water & Utilities
12. Forestry
13. Healthcare Facilities
14. Real Estate Development
15. Aviation

---

## 📋 SECTION 1: Company System Indexes

### 1.1 Collection: `companies`

#### Index 1: Status + Created At
```
Collection: companies
Fields:
  - status (Ascending)
  - createdAt (Descending)
```
**Purpose:** List companies by status and creation date

#### Index 2: Status + Industry Sector (NEW)
```
Collection: companies
Fields:
  - status (Ascending)
  - industrySector (Ascending)
  - createdAt (Descending)
```
**Purpose:** Filter companies by industry sector

#### Index 3: Industry Sector + Created At (NEW)
```
Collection: companies
Fields:
  - industrySector (Ascending)
  - createdAt (Descending)
```
**Purpose:** Query all companies in a specific industry

#### Index 4: Created By + Industry Sector (NEW)
```
Collection: companies
Fields:
  - createdBy (Ascending)
  - industrySector (Ascending)
  - createdAt (Descending)
```
**Purpose:** Master account viewing their companies filtered by sector

**Single Field Indexes:**
```
- status (Ascending & Descending)
- createdBy (Ascending & Descending)
- createdAt (Ascending & Descending)
- industrySector (Ascending & Descending) [NEW]
```

---

### 1.2 Collection: `users`

#### Index 1: Company IDs (Array) + Role
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

#### Index 3: Company IDs (Array) + Site ID
```
Collection: users
Fields:
  - companyIds (Array-contains)
  - siteId (Ascending)
```

**Single Field Indexes:**
```
- companyIds (Array-contains)
- currentCompanyId (Ascending & Descending)
- role (Ascending & Descending)
- siteId (Ascending & Descending)
```

---

### 1.3 Collection: `masterAccounts`

#### Index 1: Company IDs (Array) + Created At
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

**Single Field Indexes:**
```
- companyIds (Array-contains)
- currentCompanyId (Ascending & Descending)
- masterId (Ascending & Descending)
```

---

### 1.4 Collection: `sites`

#### Index 1: Company ID + Master Account ID
```
Collection: sites
Fields:
  - companyId (Ascending)
  - masterAccountId (Ascending)
```

#### Index 2: Company ID + Status
```
Collection: sites
Fields:
  - companyId (Ascending)
  - status (Ascending)
```

#### Index 3: Company ID + Created At
```
Collection: sites
Fields:
  - companyId (Ascending)
  - createdAt (Descending)
```

**Single Field Indexes:**
```
- companyId (Ascending & Descending)
- masterAccountId (Ascending & Descending)
- status (Ascending & Descending)
```

---

## 📋 SECTION 2: Plant Asset Allocation Indexes

### 2.1 Collection: `plantAssets`

#### Index 1: Company + Allocation Status
**Click this link to create:**
```
https://console.firebase.google.com/v1/r/project/project-tracker-app-33cff/firestore/indexes?create_composite=Cl5wcm9qZWN0cy9wcm9qZWN0LXRyYWNrZXItYXBwLTMzY2ZmL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9wbGFudEFzc2V0cy9pbmRleGVzL18QARoNCgljb21wYW55SWQQARoSCg5hbGxvY2F0aW9uU3RhdHVzEAEaDQoJY3JlYXRlZEF0EAIaDAoIX19uYW1lX18QAQ
```

**Fields:**
```
- companyId (Ascending)
- allocationStatus (Ascending)
- createdAt (Descending)
```
**Purpose:** Query unallocated assets for Plant Hire Pool

---

#### Index 2: Site + Allocation Status
**Click this link to create:**
```
https://console.firebase.google.com/v1/r/project/project-tracker-app-33cff/firestore/indexes?create_composite=Cl1wcm9qZWN0cy9wcm9qZWN0LXRyYWNrZXItYXBwLTMzY2ZmL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9wbGFudEFzc2V0cy9pbmRleGVzL18QARoKCgZzaXRlSWQQARoSCg5hbGxvY2F0aW9uU3RhdHVzEAEaDQoJY3JlYXRlZEF0EAIaDAoIX19uYW1lX18QAQ
```

**Fields:**
```
- siteId (Ascending)
- allocationStatus (Ascending)
- createdAt (Descending)
```
**Purpose:** Query allocated assets for a specific site

---

#### Index 3: Master Account + Allocation Status
**Click this link to create:**
```
https://console.firebase.google.com/v1/r/project/project-tracker-app-33cff/firestore/indexes?create_composite=CmNwcm9qZWN0cy9wcm9qZWN0LXRyYWNrZXItYXBwLTMzY2ZmL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9wbGFudEFzc2V0cy9pbmRleGVzL18QARoSCg5tYXN0ZXJBY2NvdW50SWQQARoSCg5hbGxvY2F0aW9uU3RhdHVzEAEaDQoJY3JlYXRlZEF0EAIaDAoIX19uYW1lX18QAQ
```

**Fields:**
```
- masterAccountId (Ascending)
- allocationStatus (Ascending)
- createdAt (Descending)
```
**Purpose:** Query all assets across all companies for master account

---

#### Index 4: Company + Created At (All Assets)
**Click this link to create:**
```
https://console.firebase.google.com/v1/r/project/project-tracker-app-33cff/firestore/indexes?create_composite=Cl5wcm9qZWN0cy9wcm9qZWN0LXRyYWNrZXItYXBwLTMzY2ZmL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9wbGFudEFzc2V0cy9pbmRleGVzL18QARoNCgljb21wYW55SWQQARoNCgljcmVhdGVkQXQQAhoMCghfX25hbWVfXxAB
```

**Fields:**
```
- companyId (Ascending)
- createdAt (Descending)
```
**Purpose:** Query all assets for a company (any allocation status)

---

#### Index 5: Company + Industry Sector Query (NEW)
**Purpose:** Query assets available for companies in specific industry sectors
```
Collection: plantAssets
Fields:
  - companyId (Ascending)
  - allocationStatus (Ascending)
  - type (Ascending)
  - createdAt (Descending)
```
**Use Case:** "Show me all unallocated excavators from construction companies"

---

**Single Field Indexes:**
```
- companyId (Ascending & Descending)
- masterAccountId (Ascending & Descending)
- siteId (Ascending & Descending)
- allocationStatus (Ascending & Descending)
- type (Ascending & Descending)
- createdAt (Ascending & Descending)
```

---

## 📋 SECTION 3: Additional Required Indexes

### 3.1 Collection: `companyUsers`

#### Index 1: Company ID + User ID
```
Collection: companyUsers
Fields:
  - companyId (Ascending)
  - userId (Ascending)
```

#### Index 2: User ID + Company ID
```
Collection: companyUsers
Fields:
  - userId (Ascending)
  - companyId (Ascending)
```

#### Index 3: Company ID + Role
```
Collection: companyUsers
Fields:
  - companyId (Ascending)
  - role (Ascending)
```

---

## 🚀 Quick Setup Instructions

### Method 1: Click the Links (Fastest)
1. Open each link above for plantAssets indexes
2. Click "Create Index" button
3. Wait 2-5 minutes for each to build

### Method 2: Manual Creation
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `project-tracker-app-33cff`
3. Navigate to **Firestore Database** → **Indexes**
4. Click **Create Index**
5. Copy the collection and field information from above

### Method 3: Firebase CLI (Advanced)
Update `firestore.indexes.json` and run:
```bash
firebase deploy --only firestore:indexes
```

---

## 🎯 Query Examples

### Example 1: Get Unallocated Plant Assets for Company
```typescript
const q = query(
  collection(db, 'plantAssets'),
  where('companyId', '==', companyId),
  where('allocationStatus', '==', 'UNALLOCATED'),
  orderBy('createdAt', 'desc')
);
```

### Example 2: Get Companies by Industry Sector
```typescript
const q = query(
  collection(db, 'companies'),
  where('industrySector', '==', 'Construction & Civils'),
  where('status', '==', 'Active'),
  orderBy('createdAt', 'desc')
);
```

### Example 3: Get Plant Assets from Construction Companies
```typescript
// First get construction companies
const companiesQ = query(
  collection(db, 'companies'),
  where('industrySector', '==', 'Construction & Civils'),
  where('status', '==', 'Active')
);

// Then query their unallocated assets
const assetsQ = query(
  collection(db, 'plantAssets'),
  where('companyId', 'in', constructionCompanyIds),
  where('allocationStatus', '==', 'UNALLOCATED'),
  orderBy('createdAt', 'desc')
);
```

---

## ✅ Verification Checklist

After creating all indexes, verify:

- [ ] All 4 plant asset allocation indexes created
- [ ] New industry sector indexes for companies created
- [ ] Company system indexes (Section 1) created
- [ ] All indexes show "Enabled" status
- [ ] Test queries work without errors
- [ ] Company creation requires industry sector selection
- [ ] Plant asset queries work correctly

---

## 📝 Migration Notes

### Existing Companies (REQUIRED MIGRATION)
All existing companies in the database MUST be updated with an `industrySector` field:

```typescript
// Migration script example
const companiesSnapshot = await getDocs(collection(db, 'companies'));

for (const companyDoc of companiesSnapshot.docs) {
  await updateDoc(companyDoc.ref, {
    industrySector: 'Construction & Civils' // Default or prompt user
  });
}
```

### Existing Plant Assets
Already have `companyId`, so they're ready once indexes are created.

---

## 🔗 Related Documentation

- `docs/COMPANY-INDEXES.md` - Company-specific indexes
- `docs/PLANT-ASSET-ALLOCATION-INDEXES.md` - Plant asset indexes
- `constants/industrySectors.ts` - Industry sector definitions
- `types/index.ts` - TypeScript types including Company type

---

**Last Updated:** 2025-01-21  
**Version:** 2.0 (Added Industry Sector Support)  
**Status:** Ready for Implementation
