# Plant Asset Allocation System

## Overview
This system allows plant assets to be created WITHOUT being allocated to a site initially, then allocated later from a central pool.

## Ownership Relationship
- Each plant asset document already records `masterAccountId` and an optional `companyId`, but ownership is inferred rather than explicitly enforced.
- Two free-text fields, `subcontractor` and `crossHire`, are used to indicate external owners or hire partners; because they are strings, they cannot be joined back to canonical records.
- To make ownership auditable, add optional identifiers such as `ownerCompanyId`, `ownerType` (`'internal' | 'subcontractor' | 'crossHire'`), and `ownerReferenceId` that point to either the `companies` collection or a future `subcontractors`/`hirePartners` collection.
- Until those identifiers exist, reports that ask "who owns this asset?" have to rely on the string fields plus the company currently allocating the asset.

## Database Structure Changes

### PlantAsset Document Updates

```typescript
{
  // Existing fields
  id: string;
  assetId: string;
  type: string;
  plantNumber?: string;
  registrationNumber?: string;
  subcontractor?: string;
  crossHire?: string;
  masterAccountId: string;
  companyId?: string;
  inductionStatus: boolean;
  inductionDate?: Timestamp;
  onboardingDate?: Timestamp;
  inductionNotes?: string;
  attachments?: Attachment[];
  checklist?: ChecklistItem[];
  archived?: boolean;
  archivedAt?: Timestamp;
  archivedBy?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  
  // NEW ALLOCATION FIELDS
  siteId?: string | null;              // NOW OPTIONAL - null = unallocated
  location?: string;                   // Description of location
  assignedJob?: string;                // Job assigned to
  allocationStatus: 'UNALLOCATED' | 'ALLOCATED' | 'IN_TRANSIT';
  
  // Allocation history embedded
  currentAllocation?: {
    siteId: string;
    siteName?: string;
    allocatedAt: Timestamp;
    allocatedBy: string;
    notes?: string;
  };
  
  // Track previous allocations
  allocationHistory?: Array<{
    siteId: string;
    siteName?: string;
    allocatedAt: Timestamp;
    allocatedBy: string;
    deallocatedAt?: Timestamp;
    deallocatedBy?: string;
    notes?: string;
  }>;
}
```

## Required Firebase Indexes

### Index 1: Unallocated Assets (Company Pool)
**Collection:** `plantAssets`
**Fields:**
- `companyId` (Ascending)
- `allocationStatus` (Ascending)
- `createdAt` (Descending)

**Purpose:** Query all unallocated assets for a company

**Query Example:**
```typescript
where('companyId', '==', companyId)
where('allocationStatus', '==', 'UNALLOCATED')
orderBy('createdAt', 'desc')
```

### Index 2: Site Allocated Assets (Existing, needs update)
**Collection:** `plantAssets`
**Fields:**
- `siteId` (Ascending)
- `allocationStatus` (Ascending)
- `createdAt` (Descending)

**Purpose:** Query all allocated assets for a site

**Query Example:**
```typescript
where('siteId', '==', siteId)
where('allocationStatus', '==', 'ALLOCATED')
orderBy('createdAt', 'desc')
```

### Index 3: Master Account All Assets
**Collection:** `plantAssets`
**Fields:**
- `masterAccountId` (Ascending)
- `allocationStatus` (Ascending)
- `createdAt` (Descending)

**Purpose:** Query all assets across all companies for master account

**Query Example:**
```typescript
where('masterAccountId', '==', masterAccountId)
where('allocationStatus', '==', 'ALLOCATED')
orderBy('createdAt', 'desc')
```

### Index 4: Company All Assets
**Collection:** `plantAssets`
**Fields:**
- `companyId` (Ascending)
- `createdAt` (Descending)

**Purpose:** All assets for a company (allocated + unallocated)

## Migration Strategy

### Option A: Soft Migration (Recommended)
- Add new fields with default values
- Existing assets get `allocationStatus: 'ALLOCATED'`
- Existing assets keep their `siteId`
- New unallocated assets have `siteId: null` and `allocationStatus: 'UNALLOCATED'`

### Option B: Hard Migration
- Update all existing documents
- Set `allocationStatus` based on `siteId` presence

## Workflow

### Creating Unallocated Asset
```typescript
const assetData = {
  assetId: 'ASSET-001',
  type: 'Excavator',
  plantNumber: 'PL-123',
  masterAccountId: user.masterAccountId,
  companyId: user.currentCompanyId,
  allocationStatus: 'UNALLOCATED',
  siteId: null,
  location: null,
  inductionStatus: false,
  createdAt: serverTimestamp(),
};
```

### Allocating to Site
```typescript
await updateDoc(assetRef, {
  allocationStatus: 'ALLOCATED',
  siteId: selectedSiteId,
  location: selectedSiteName,
  currentAllocation: {
    siteId: selectedSiteId,
    siteName: selectedSiteName,
    allocatedAt: serverTimestamp(),
    allocatedBy: user.userId,
    notes: 'Allocated for foundation work',
  },
  allocationHistory: arrayUnion({
    siteId: selectedSiteId,
    siteName: selectedSiteName,
    allocatedAt: serverTimestamp(),
    allocatedBy: user.userId,
  }),
  updatedAt: serverTimestamp(),
});
```

### Deallocating from Site
```typescript
// Get current allocation
const currentAllocation = asset.currentAllocation;

// Update history
const historyEntry = {
  ...currentAllocation,
  deallocatedAt: serverTimestamp(),
  deallocatedBy: user.userId,
};

await updateDoc(assetRef, {
  allocationStatus: 'UNALLOCATED',
  siteId: null,
  location: null,
  currentAllocation: null,
  allocationHistory: arrayUnion(historyEntry),
  updatedAt: serverTimestamp(),
});
```

## UI Flows

### 1. Plant Hire/Pool Dashboard
- Show all unallocated assets
- Filter by type, subcontractor, etc.
- Button: "Allocate to Site"

### 2. Site Plant Assets View
- Show allocated assets for this site
- Button: "Return to Pool" (deallocate)
- Button: "Add from Pool" (allocate existing)

### 3. Allocation Modal
- Dropdown: Select site
- Text input: Notes
- Button: "Allocate"

## Benefits

1. **Centralized Pool**: All unallocated assets in one place
2. **History Tracking**: See where assets have been
3. **Cross-company Support**: Multi-tenant ready
4. **Flexible Queries**: Can query by allocation status
5. **Future Features**: Easy to add billing, utilization tracking

## Next Steps

1. ✅ Define structure (this document)
2. Create Firebase indexes
3. Update TypeScript types
4. Build Plant Hire/Pool UI
5. Update existing add-asset flow to support unallocated
6. Build allocation/deallocation functions
