# Plant Asset Allocation System - Implementation Summary

## What We've Prepared

### ✅ 1. Database Structure Designed
**File:** `docs/PLANT-ASSET-ALLOCATION-SYSTEM.md`

- Plant assets can now be **UNALLOCATED** (not linked to a site)
- `siteId` is now **optional** (`string | null`)
- Added `allocationStatus`: `'UNALLOCATED' | 'ALLOCATED' | 'IN_TRANSIT'`
- Track current allocation with `currentAllocation` object
- Full history tracking with `allocationHistory` array

### ✅ 2. TypeScript Types Updated
**File:** `types/index.ts`

Added new types:
- `AllocationStatus`
- `CurrentAllocation`
- `AllocationHistoryEntry`
- Updated `PlantAsset` type with allocation fields

### ✅ 3. Firebase Indexes Documented
**File:** `docs/PLANT-ASSET-ALLOCATION-INDEXES.md`

4 required indexes for:
- Unallocated assets by company (for Plant Hire pool)
- Allocated assets by site (for site view)
- All assets by master account and status
- All assets by company (any status)

## Current State vs Future State

### Before (Current)
```typescript
{
  assetId: 'EXCAVATOR-001',
  type: 'Excavator',
  siteId: 'SITE-123',        // ❌ REQUIRED - can't be null
  location: 'Site 123',       // ❌ Tied to site
  masterAccountId: 'xxx',
  companyId: 'yyy'
}
```

### After (With Allocation System)
```typescript
// UNALLOCATED ASSET (in pool)
{
  assetId: 'EXCAVATOR-001',
  type: 'Excavator',
  allocationStatus: 'UNALLOCATED',  // ✅ NEW
  siteId: null,                      // ✅ Can be null
  location: null,
  masterAccountId: 'xxx',
  companyId: 'yyy',
  currentAllocation: null
}

// ALLOCATED ASSET (on a site)
{
  assetId: 'EXCAVATOR-002',
  type: 'Excavator',
  allocationStatus: 'ALLOCATED',     // ✅ NEW
  siteId: 'SITE-123',
  location: 'Site 123',
  masterAccountId: 'xxx',
  companyId: 'yyy',
  currentAllocation: {                // ✅ Tracks who/when
    siteId: 'SITE-123',
    siteName: 'Main Site',
    allocatedAt: Timestamp,
    allocatedBy: 'user-123',
    notes: 'For foundation work'
  },
  allocationHistory: [...]            // ✅ Full history
}
```

## Next Steps - Building the UI

### Step 1: Update Existing Code (Backward Compatible)
1. Fix `add-asset.tsx` - Add `allocationStatus` field (default 'ALLOCATED' for site-linked)
2. Fix `onboarding-assets.tsx` - Handle nullable `siteId`
3. Create indexes in Firebase (use links in PLANT-ASSET-ALLOCATION-INDEXES.md)

### Step 2: Build Plant Hire Pool UI (New Feature)
1. Create `app/master-plant-pool.tsx` - Shows unallocated assets
2. Create `app/allocate-asset.tsx` - Modal to allocate to site
3. Add "Allocate to Site" button
4. Add "Return to Pool" button (deallocate)

### Step 3: Build Allocation Functions
1. Create `utils/plantAllocation.ts`
   - `allocateAssetToSite(assetId, siteId, userId, notes)`
   - `deallocateAsset(assetId, userId)`
   - `getAllocationHistory(assetId)`

## Workflow Examples

### Creating Unallocated Asset
```typescript
// In Plant Hire UI
const assetData = {
  assetId: 'EXCAVATOR-001',
  type: 'Excavator',
  plantNumber: 'PL-123',
  allocationStatus: 'UNALLOCATED',  // Not linked to site
  siteId: null,
  location: null,
  masterAccountId: user.masterAccountId,
  companyId: user.currentCompanyId,
  // ... other fields
};
await addDoc(collection(db, 'plantAssets'), assetData);
```

### Allocating to Site
```typescript
// From Plant Hire Pool UI
const assetRef = doc(db, 'plantAssets', assetId);
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
});
```

### Deallocating (Return to Pool)
```typescript
// From Site Assets View
const currentAllocation = asset.currentAllocation;
await updateDoc(assetRef, {
  allocationStatus: 'UNALLOCATED',
  siteId: null,
  location: null,
  currentAllocation: null,
  allocationHistory: arrayUnion({
    ...currentAllocation,
    deallocatedAt: serverTimestamp(),
    deallocatedBy: user.userId,
  }),
});
```

## Benefits

1. ✅ **Centralized Pool** - All unallocated assets in one place
2. ✅ **Multi-company Support** - Query by `companyId` for company-specific pools
3. ✅ **History Tracking** - See where assets have been
4. ✅ **Flexible Queries** - Filter by allocation status
5. ✅ **Future-proof** - Easy to add billing, utilization tracking, transfer between companies

## Your Question: "Should we prepare the database or wait for UI?"

**Answer: We've prepared the database structure NOW** ✅

### Why This Was the Right Call:
1. **Prevents Rework** - Building UI first would mean rebuilding it when structure changes
2. **Avoids Index Errors** - You won't hit Firebase index errors mid-development
3. **Clear Blueprint** - You know exactly what fields and queries you need
4. **Type Safety** - TypeScript types are ready, so UI code will be type-safe
5. **Testing Ready** - You can test queries in Firebase Console before building UI

### Next Actions:
1. **Create the 4 Firebase indexes** (links in PLANT-ASSET-ALLOCATION-INDEXES.md)
2. **Test a manual query** in Firebase Console to verify indexes work
3. **Start building the UI** with confidence that database is ready

---

## Ready to Build?

The database is prepared. When you're ready to build the UI, we can:
1. Create the Plant Hire Pool screen
2. Add allocation/deallocation buttons
3. Build the allocation modal with site dropdown
4. Add allocation history view

Let me know if you want to proceed with building the UI or if you have questions about the structure! 🚀
