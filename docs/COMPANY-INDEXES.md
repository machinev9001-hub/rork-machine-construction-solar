# Company System Firebase Indexes

This document lists all required Firebase indexes for the multi-tenant company system.

## Required Indexes

### Collection: `companies`

**Index 1: Status + Created At**
```
Collection ID: companies
Fields indexed:
  - status (Ascending)
  - createdAt (Descending)
Query scope: Collection
```

**Single Field Indexes:**
```
- status (Ascending & Descending)
- createdBy (Ascending & Descending)
- createdAt (Ascending & Descending)
```

---

### Collection: `users`

**Index 1: Company IDs (Array) + Role**
```
Collection ID: users
Fields indexed:
  - companyIds (Array-contains)
  - role (Ascending)
Query scope: Collection
```

**Index 2: Current Company + Role**
```
Collection ID: users
Fields indexed:
  - currentCompanyId (Ascending)
  - role (Ascending)
Query scope: Collection
```

**Index 3: Company IDs (Array) + Site ID**
```
Collection ID: users
Fields indexed:
  - companyIds (Array-contains)
  - siteId (Ascending)
Query scope: Collection
```

**Single Field Indexes:**
```
- companyIds (Array-contains)
- currentCompanyId (Ascending & Descending)
- role (Ascending & Descending)
- siteId (Ascending & Descending)
```

---

### Collection: `masterAccounts`

**Index 1: Company IDs (Array) + Created At**
```
Collection ID: masterAccounts
Fields indexed:
  - companyIds (Array-contains)
  - createdAt (Descending)
Query scope: Collection
```

**Index 2: Current Company + Created At**
```
Collection ID: masterAccounts
Fields indexed:
  - currentCompanyId (Ascending)
  - createdAt (Descending)
Query scope: Collection
```

**Single Field Indexes:**
```
- companyIds (Array-contains)
- currentCompanyId (Ascending & Descending)
- masterId (Ascending & Descending)
```

---

### Collection: `sites`

**Index 1: Company ID + Master Account ID**
```
Collection ID: sites
Fields indexed:
  - companyId (Ascending)
  - masterAccountId (Ascending)
Query scope: Collection
```

**Index 2: Company ID + Status**
```
Collection ID: sites
Fields indexed:
  - companyId (Ascending)
  - status (Ascending)
Query scope: Collection
```

**Index 3: Company ID + Created At**
```
Collection ID: sites
Fields indexed:
  - companyId (Ascending)
  - createdAt (Descending)
Query scope: Collection
```

**Single Field Indexes:**
```
- companyId (Ascending & Descending)
- masterAccountId (Ascending & Descending)
- status (Ascending & Descending)
```

---

### Collection: `companyUsers`

**Index 1: Company ID + User ID**
```
Collection ID: companyUsers
Fields indexed:
  - companyId (Ascending)
  - userId (Ascending)
Query scope: Collection
```

**Index 2: User ID + Company ID**
```
Collection ID: companyUsers
Fields indexed:
  - userId (Ascending)
  - companyId (Ascending)
Query scope: Collection
```

**Index 3: Company ID + Role**
```
Collection ID: companyUsers
Fields indexed:
  - companyId (Ascending)
  - role (Ascending)
Query scope: Collection
```

**Single Field Indexes:**
```
- companyId (Ascending & Descending)
- userId (Ascending & Descending)
- role (Ascending & Descending)
- addedAt (Ascending & Descending)
```

---

## How to Add These Indexes

### Method 1: Firebase Console (Manual)

1. Open [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Firestore Database** → **Indexes** tab
4. Click **Create Index**
5. Add each index from the list above

### Method 2: Using Firebase CLI

Create a file `firestore.indexes.json` in your project root with the following content:

```json
{
  "indexes": [
    {
      "collectionGroup": "companies",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "companyIds", "arrayConfig": "CONTAINS" },
        { "fieldPath": "role", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "currentCompanyId", "order": "ASCENDING" },
        { "fieldPath": "role", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "companyIds", "arrayConfig": "CONTAINS" },
        { "fieldPath": "siteId", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "masterAccounts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "companyIds", "arrayConfig": "CONTAINS" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "masterAccounts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "currentCompanyId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "sites",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "companyId", "order": "ASCENDING" },
        { "fieldPath": "masterAccountId", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "sites",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "companyId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "sites",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "companyId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "companyUsers",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "companyId", "order": "ASCENDING" },
        { "fieldPath": "userId", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "companyUsers",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "companyId", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "companyUsers",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "companyId", "order": "ASCENDING" },
        { "fieldPath": "role", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

Then run:
```bash
firebase deploy --only firestore:indexes
```

---

## Query Examples

### Get all companies for a master account:
```typescript
const companiesQuery = query(
  collection(firestore, 'companies'),
  where('createdBy', '==', masterAccountId),
  where('status', '==', 'Active'),
  orderBy('createdAt', 'desc')
);
```

### Get all users in a company:
```typescript
const usersQuery = query(
  collection(firestore, 'users'),
  where('companyIds', 'array-contains', companyId),
  orderBy('role', 'asc')
);
```

### Get all sites for a company:
```typescript
const sitesQuery = query(
  collection(firestore, 'sites'),
  where('companyId', '==', companyId),
  where('masterAccountId', '==', masterAccountId),
  orderBy('createdAt', 'desc')
);
```

---

## Migration Notes

When migrating existing data to the new company structure:

1. **Create default companies** for existing sites
2. **Populate `companyIds`** array in existing user documents
3. **Add `companyId`** field to existing site documents
4. **Populate `companyIds`** array in existing masterAccount documents

Example migration script:
```typescript
// Pseudo-code for migration
async function migrateToCompanyStructure() {
  // 1. Create default company for each master account
  const masterAccounts = await getDocs(collection(firestore, 'masterAccounts'));
  
  for (const masterDoc of masterAccounts.docs) {
    const defaultCompany = {
      legalEntityName: 'Default Company',
      alias: 'Default',
      // ... other required fields
      createdBy: masterDoc.id,
      createdAt: serverTimestamp(),
      status: 'Active'
    };
    
    const companyRef = await addDoc(collection(firestore, 'companies'), defaultCompany);
    
    // 2. Update master account with companyId
    await updateDoc(masterDoc.ref, {
      companyIds: [companyRef.id],
      currentCompanyId: companyRef.id
    });
    
    // 3. Update all sites under this master to reference the company
    const sitesQuery = query(
      collection(firestore, 'sites'),
      where('masterAccountId', '==', masterDoc.id)
    );
    const sites = await getDocs(sitesQuery);
    
    for (const siteDoc of sites.docs) {
      await updateDoc(siteDoc.ref, {
        companyId: companyRef.id
      });
    }
    
    // 4. Update all users under this master to reference the company
    const usersQuery = query(
      collection(firestore, 'users'),
      where('masterAccountId', '==', masterDoc.id)
    );
    const users = await getDocs(usersQuery);
    
    for (const userDoc of users.docs) {
      await updateDoc(userDoc.ref, {
        companyIds: [companyRef.id],
        currentCompanyId: companyRef.id
      });
    }
  }
}
```

---

## Status

- [ ] Indexes created in Firebase Console
- [ ] Migration script executed
- [ ] Existing data migrated to new structure
- [ ] Application tested with company-scoped queries

---

**Last Updated:** 2025-01-20
**Related Documentation:** `docs/MULTI-TENANT-COMPANY-IMPLEMENTATION-STATUS.md`
