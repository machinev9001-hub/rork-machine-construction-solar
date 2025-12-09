# BOQ (Bill of Quantities) Firebase Indexes

## Overview

This document describes the required Firebase Firestore indexes for the hierarchical BOQ system. The BOQ supports three levels:
1. **Main Category** (Main Menu Items like Trenching, Drilling, Cabling, etc.)
2. **Sub Menu** (Sub categories within main menu items)
3. **Activity** (Specific activities within sub menu items)

## Collection: `boq`

### Document Structure

```typescript
{
  id: string;
  siteId: string;
  masterAccountId: string;
  level: 'main' | 'sub' | 'activity';
  mainMenuId: string;
  mainMenuName: string;
  subMenuId?: string;          // Only for level='sub' or level='activity'
  subMenuName?: string;         // Only for level='sub' or level='activity'
  activityId?: string;          // Only for level='activity'
  activityName?: string;        // Only for level='activity'
  quantity: number;
  unit: string;
  description?: string;
  createdAt: timestamp;
  updatedAt?: timestamp;
}
```

## Required Indexes

### 1. Site-Based Query Index
**Purpose:** Query all BOQ items for a specific site  
**Collection:** `boq`  
**Fields:**
- `siteId` (Ascending)
- `mainMenuId` (Ascending)
- `subMenuId` (Ascending)
- `activityId` (Ascending)

**Query Example:**
```typescript
const boqRef = collection(db, 'boq');
const boqQuery = query(boqRef, where('siteId', '==', siteId));
```

### 2. Site + Level Query Index
**Purpose:** Query BOQ items by site and level  
**Collection:** `boq`  
**Fields:**
- `siteId` (Ascending)
- `level` (Ascending)
- `createdAt` (Descending)

**Query Example:**
```typescript
// Get all main category BOQ items
const mainItems = query(
  collection(db, 'boq'),
  where('siteId', '==', siteId),
  where('level', '==', 'main')
);
```

### 3. Site + Main Menu Query Index
**Purpose:** Query BOQ items for a specific main menu category  
**Collection:** `boq`  
**Fields:**
- `siteId` (Ascending)
- `mainMenuId` (Ascending)
- `level` (Ascending)

**Query Example:**
```typescript
// Get all BOQ items for "Trenching"
const trenchingItems = query(
  collection(db, 'boq'),
  where('siteId', '==', siteId),
  where('mainMenuId', '==', 'trenching')
);
```

### 4. Site + Main Menu + Sub Menu Query Index
**Purpose:** Query BOQ items for a specific sub menu  
**Collection:** `boq`  
**Fields:**
- `siteId` (Ascending)
- `mainMenuId` (Ascending)
- `subMenuId` (Ascending)
- `level` (Ascending)

**Query Example:**
```typescript
// Get all BOQ items for "MV Cable Trench"
const mvCableTrenchItems = query(
  collection(db, 'boq'),
  where('siteId', '==', siteId),
  where('mainMenuId', '==', 'trenching'),
  where('subMenuId', '==', 'mv-cable-trench')
);
```

### 5. Master Account Query Index
**Purpose:** Query all BOQ items across sites for a master account  
**Collection:** `boq`  
**Fields:**
- `masterAccountId` (Ascending)
- `siteId` (Ascending)
- `createdAt` (Descending)

**Query Example:**
```typescript
// Get all BOQ items for master account
const masterBOQItems = query(
  collection(db, 'boq'),
  where('masterAccountId', '==', masterAccountId),
  orderBy('createdAt', 'desc')
);
```

### 6. Master Account + Main Menu Query Index
**Purpose:** Query BOQ items by main category across all sites  
**Collection:** `boq`  
**Fields:**
- `masterAccountId` (Ascending)
- `mainMenuId` (Ascending)
- `siteId` (Ascending)

**Query Example:**
```typescript
// Get all drilling BOQ items across all sites
const drillingItems = query(
  collection(db, 'boq'),
  where('masterAccountId', '==', masterAccountId),
  where('mainMenuId', '==', 'drilling')
);
```

## Firebase Console Index Creation

To create these indexes in the Firebase Console:

1. Go to **Firebase Console** → **Firestore Database** → **Indexes**
2. Click **Create Index**
3. Set Collection ID: `boq`
4. Add the fields listed above for each index
5. Set Query Scope: **Collection**

## Firestore Indexes JSON

Add these to your `firestore.indexes.json` file:

```json
{
  "indexes": [
    {
      "collectionGroup": "boq",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "siteId", "order": "ASCENDING" },
        { "fieldPath": "mainMenuId", "order": "ASCENDING" },
        { "fieldPath": "subMenuId", "order": "ASCENDING" },
        { "fieldPath": "activityId", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "boq",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "siteId", "order": "ASCENDING" },
        { "fieldPath": "level", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "boq",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "siteId", "order": "ASCENDING" },
        { "fieldPath": "mainMenuId", "order": "ASCENDING" },
        { "fieldPath": "level", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "boq",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "siteId", "order": "ASCENDING" },
        { "fieldPath": "mainMenuId", "order": "ASCENDING" },
        { "fieldPath": "subMenuId", "order": "ASCENDING" },
        { "fieldPath": "level", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "boq",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "masterAccountId", "order": "ASCENDING" },
        { "fieldPath": "siteId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "boq",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "masterAccountId", "order": "ASCENDING" },
        { "fieldPath": "mainMenuId", "order": "ASCENDING" },
        { "fieldPath": "siteId", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

## Index Performance Notes

1. **siteId** is the most common filter - always included in queries
2. **Hierarchical queries** use mainMenuId → subMenuId → activityId progression
3. **masterAccountId** enables cross-site reporting and analysis
4. **level** field enables filtering by BOQ entry type
5. **createdAt** enables chronological sorting

## Usage Examples

### Get All BOQ for Site (Hierarchically Sorted)
```typescript
const boqRef = collection(db, 'boq');
const boqQuery = query(boqRef, where('siteId', '==', user.siteId));
const boqSnapshot = await getDocs(boqQuery);

const items: BOQItem[] = [];
boqSnapshot.forEach((doc) => {
  items.push({ id: doc.id, ...doc.data() } as BOQItem);
});

// Sort hierarchically in code
return items.sort((a, b) => {
  if (a.mainMenuName !== b.mainMenuName) {
    return a.mainMenuName.localeCompare(b.mainMenuName);
  }
  if (a.subMenuName && b.subMenuName && a.subMenuName !== b.subMenuName) {
    return a.subMenuName.localeCompare(b.subMenuName);
  }
  return (a.activityName || '').localeCompare(b.activityName || '');
});
```

### Get BOQ Summary by Main Category
```typescript
const mainCategoryTotals = {};
boqItems.forEach(item => {
  if (!mainCategoryTotals[item.mainMenuId]) {
    mainCategoryTotals[item.mainMenuId] = { quantity: 0, items: 0 };
  }
  mainCategoryTotals[item.mainMenuId].quantity += item.quantity;
  mainCategoryTotals[item.mainMenuId].items += 1;
});
```

### Get Activity-Level BOQ for Progress Tracking
```typescript
const activityBOQ = boqItems.filter(item => 
  item.level === 'activity' && 
  item.mainMenuId === mainMenuId &&
  item.subMenuId === subMenuId
);
```

## Security Rules

Add these Firestore security rules for BOQ collection:

```javascript
match /boq/{boqId} {
  // Allow read if user belongs to the site
  allow read: if request.auth != null && 
                 get(/databases/$(database)/documents/users/$(request.auth.uid)).data.siteId == resource.data.siteId;
  
  // Allow create/update/delete only for master users
  allow create, update, delete: if request.auth != null && 
                                   get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'master';
}
```

## Migration Notes

If you have existing BOQ data without the hierarchical structure:

1. Add `level` field to existing documents (default to 'main')
2. Ensure `masterAccountId` is populated for all documents
3. Add `mainMenuId` based on existing `mainMenu` field
4. Rebuild indexes after migration

---

**Last Updated:** January 2025  
**Related Documentation:**
- [Database Structure](./DATABASE-STRUCTURE.md)
- [System Overview](./SYSTEM-OVERVIEW.md)
- [Firebase Indexes](./FIREBASE-INDEXES.md)
