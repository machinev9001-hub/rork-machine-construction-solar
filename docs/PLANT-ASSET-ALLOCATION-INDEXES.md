# Plant Asset Allocation - Required Firebase Indexes

## Overview
These indexes support querying plant assets by allocation status for the new allocation system.

## 🚨 ACTION REQUIRED - CREATE THESE INDEXES

### Index 1: Unallocated Assets by Company
**Click this link and press "Create Index":**
```
https://console.firebase.google.com/v1/r/project/project-tracker-app-33cff/firestore/indexes?create_composite=Cl5wcm9qZWN0cy9wcm9qZWN0LXRyYWNrZXItYXBwLTMzY2ZmL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9wbGFudEFzc2V0cy9pbmRleGVzL18QARoNCgljb21wYW55SWQQARoSCg5hbGxvY2F0aW9uU3RhdHVzEAEaDQoJY3JlYXRlZEF0EAIaDAoIX19uYW1lX18QAQ
```

**Collection:** `plantAssets`
**Fields:**
- `companyId` (Ascending)
- `allocationStatus` (Ascending)
- `createdAt` (Descending)
- `__name__` (Ascending)

**Purpose:** Query unallocated assets for a company to show in Plant Hire pool

**Query Example:**
```typescript
const q = query(
  collection(db, 'plantAssets'),
  where('companyId', '==', companyId),
  where('allocationStatus', '==', 'UNALLOCATED'),
  orderBy('createdAt', 'desc')
);
```

---

### Index 2: Allocated Assets by Site
**Click this link and press "Create Index":**
```
https://console.firebase.google.com/v1/r/project/project-tracker-app-33cff/firestore/indexes?create_composite=Cl1wcm9qZWN0cy9wcm9qZWN0LXRyYWNrZXItYXBwLTMzY2ZmL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9wbGFudEFzc2V0cy9pbmRleGVzL18QARoKCgZzaXRlSWQQARoSCg5hbGxvY2F0aW9uU3RhdHVzEAEaDQoJY3JlYXRlZEF0EAIaDAoIX19uYW1lX18QAQ
```

**Collection:** `plantAssets`
**Fields:**
- `siteId` (Ascending)
- `allocationStatus` (Ascending)
- `createdAt` (Descending)
- `__name__` (Ascending)

**Purpose:** Query allocated assets for a specific site

**Query Example:**
```typescript
const q = query(
  collection(db, 'plantAssets'),
  where('siteId', '==', siteId),
  where('allocationStatus', '==', 'ALLOCATED'),
  orderBy('createdAt', 'desc')
);
```

---

### Index 3: All Assets by Master Account and Status
**Click this link and press "Create Index":**
```
https://console.firebase.google.com/v1/r/project/project-tracker-app-33cff/firestore/indexes?create_composite=CmNwcm9qZWN0cy9wcm9qZWN0LXRyYWNrZXItYXBwLTMzY2ZmL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9wbGFudEFzc2V0cy9pbmRleGVzL18QARoSCg5tYXN0ZXJBY2NvdW50SWQQARoSCg5hbGxvY2F0aW9uU3RhdHVzEAEaDQoJY3JlYXRlZEF0EAIaDAoIX19uYW1lX18QAQ
```

**Collection:** `plantAssets`
**Fields:**
- `masterAccountId` (Ascending)
- `allocationStatus` (Ascending)
- `createdAt` (Descending)
- `__name__` (Ascending)

**Purpose:** Query all assets across all companies for master account

**Query Example:**
```typescript
const q = query(
  collection(db, 'plantAssets'),
  where('masterAccountId', '==', masterAccountId),
  where('allocationStatus', '==', 'ALLOCATED'),
  orderBy('createdAt', 'desc')
);
```

---

### Index 4: All Assets by Company (Any Status)
**Click this link and press "Create Index":**
```
https://console.firebase.google.com/v1/r/project/project-tracker-app-33cff/firestore/indexes?create_composite=Cl5wcm9qZWN0cy9wcm9qZWN0LXRyYWNrZXItYXBwLTMzY2ZmL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9wbGFudEFzc2V0cy9pbmRleGVzL18QARoNCgljb21wYW55SWQQARoNCgljcmVhdGVkQXQQAhoMCghfX25hbWVfXxAB
```

**Collection:** `plantAssets`
**Fields:**
- `companyId` (Ascending)
- `createdAt` (Descending)
- `__name__` (Ascending)

**Purpose:** Query all assets for a company (allocated + unallocated)

**Query Example:**
```typescript
const q = query(
  collection(db, 'plantAssets'),
  where('companyId', '==', companyId),
  orderBy('createdAt', 'desc')
);
```

---

## Setup Instructions

1. Click each link above to open Firebase Console with pre-filled index configuration
2. Press "Create Index" button
3. Wait 2-5 minutes for each index to build
4. Verify all indexes show "Enabled" status
5. Test queries in your app

## Migration Notes

### Existing Assets (Allocated)
When you start using the new system, existing plant assets will need:
```typescript
{
  allocationStatus: 'ALLOCATED',
  siteId: '<existing-site-id>',
  currentAllocation: {
    siteId: '<existing-site-id>',
    siteName: '<site-name>',
    allocatedAt: createdAt,
    allocatedBy: '<creator-user-id>',
    notes: 'Migrated from existing system'
  }
}
```

### New Unallocated Assets
New assets in the pool will have:
```typescript
{
  allocationStatus: 'UNALLOCATED',
  siteId: null,
  location: null,
  currentAllocation: null
}
```

## Benefits of This Structure

1. **Query Flexibility**: Can query by company, site, or master account
2. **Performance**: Indexed queries are fast even with thousands of assets
3. **Multi-tenancy**: Proper isolation by company and site
4. **History Tracking**: Built-in allocation history
5. **Scalability**: Supports future features like billing and utilization

## Next Steps

1. ✅ Create indexes (this step)
2. Update add-asset.tsx to support unallocated assets
3. Update onboarding-assets.tsx to filter by allocation status
4. Build Plant Hire/Pool UI
5. Build allocation/deallocation functions
