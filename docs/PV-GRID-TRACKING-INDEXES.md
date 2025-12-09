# PV Grid Tracking - Firebase Indexes

## Summary

**YES, you need new indexes** to support precise grid-level tracking (PV Area → Block → Row → Column).

These indexes have been added to `firestore.indexes.json` and must be deployed.

---

## What Changed

### New Fields Added to Collections

#### Tasks Collection
```typescript
{
  // Existing fields...
  pvAreaId?: string;       // "pv1"
  pvAreaName?: string;     // "PV1" (denormalized for display)
  blockId?: string;        // "block1"
  blockName?: string;      // "BLOCK1" (denormalized for display)
  row?: string;            // "A", "B", "C", "D", "E"
  column?: string;         // "1", "2", "3", ..., "20"
}
```

#### Activities Collection
```typescript
{
  // Existing fields...
  pvAreaId?: string;       // "pv1"
  pvAreaName?: string;     // "PV1"
  blockId?: string;        // "block1"
  blockName?: string;      // "BLOCK1"
  row?: string;            // "A", "B", "C", "D", "E"
  column?: string;         // "1", "2", "3", ..., "20"
}
```

---

## New Indexes Added

### Tasks Collection Indexes (5 indexes)

1. **siteId + pvAreaId + blockId** — Filter tasks by area and block
2. **siteId + pvAreaId + blockId + row** — Filter by row within block
3. **siteId + pvAreaId + blockId + row + column** — **PRECISE CELL TRACKING**
4. **siteId + pvAreaId + createdAt** — All tasks in a PV area, sorted
5. **siteId + blockId + createdAt** — All tasks in a block, sorted

### Activities Collection Indexes (8 indexes)

1. **siteId + pvAreaId + blockId** — Filter activities by area and block
2. **siteId + pvAreaId + blockId + row** — Filter by row within block
3. **siteId + pvAreaId + blockId + row + column** — **PRECISE CELL TRACKING**
4. **taskId + pvAreaId + blockId + row + column** — All activities for a task at specific cell
5. **siteId + pvAreaId + status** — Progress by PV area
6. **siteId + blockId + status** — Progress by block
7. **siteId + blockId + row + status** — Progress by row
8. **siteId + blockId + row + column + status** — Progress at cell level

---

## How to Deploy Indexes

### Step 1: Deploy to Firebase
```bash
firebase deploy --only firestore:indexes
```

### Step 2: Wait for Indexes to Build
- Go to [Firebase Console](https://console.firebase.google.com)
- Navigate to: Firestore Database → Indexes
- **Wait** until all new indexes show status "Enabled" (green checkmark)
- This can take **minutes to hours** depending on existing data size

### Step 3: Verify
Check that these indexes are enabled:
- ✅ tasks: siteId + pvAreaId + blockId + row + column
- ✅ activities: siteId + pvAreaId + blockId + row + column
- ✅ activities: siteId + blockId + row + column + status

---

## Why You Need These Indexes

### Without Indexes
❌ Firestore cannot execute compound queries  
❌ You'll get errors: "The query requires an index"  
❌ Progress tracking will fail

### With Indexes
✅ Query activities by exact grid cell (PV1/BLOCK1/ROW A/COLUMN 20)  
✅ Calculate progress at any level (area, block, row, column, cell)  
✅ Create visual grid displays with real-time progress  
✅ Fast queries even with thousands of activities  

---

## Example Queries Enabled

### 1. Get all activities for a specific cell
```typescript
const q = query(
  collection(db, 'activities'),
  where('siteId', '==', 'site123'),
  where('pvAreaId', '==', 'pv1'),
  where('blockId', '==', 'block1'),
  where('row', '==', 'A'),
  where('column', '==', '20')
);
```
**Uses index:** `siteId + pvAreaId + blockId + row + column`

### 2. Get progress for an entire row
```typescript
const q = query(
  collection(db, 'activities'),
  where('siteId', '==', 'site123'),
  where('blockId', '==', 'block1'),
  where('row', '==', 'A'),
  where('status', '==', 'DONE')
);
```
**Uses index:** `siteId + blockId + row + status`

### 3. Get all tasks in a PV area
```typescript
const q = query(
  collection(db, 'tasks'),
  where('siteId', '==', 'site123'),
  where('pvAreaId', '==', 'pv1'),
  orderBy('createdAt', 'desc')
);
```
**Uses index:** `siteId + pvAreaId + createdAt`

### 4. Visual grid data for a block
```typescript
const q = query(
  collection(db, 'activities'),
  where('siteId', '==', 'site123'),
  where('blockId', '==', 'block1')
);
// Then group by row and column in code
```
**Uses index:** `siteId + blockId + status`

---

## Visual Progress Example

Once indexes are deployed, you can create a grid like this:

```
Block: BLOCK1 in PV1

     Col 1    Col 2    Col 3    Col 4    Col 5    ...   Col 20
Row A  [100%]  [75%]   [50%]   [0%]    [0%]    ...   [100%]
Row B  [100%]  [100%]  [100%]  [25%]   [0%]    ...   [50%]
Row C  [50%]   [50%]   [0%]    [0%]    [0%]    ...   [0%]
Row D  [0%]    [0%]    [0%]    [0%]    [0%]    ...   [0%]
Row E  [0%]    [0%]    [0%]    [0%]    [0%]    ...   [0%]
```

Each cell shows **completion percentage** for activities at that exact location.

---

## Next Steps

### Phase 1: Deploy Indexes ⚠️ **DO THIS FIRST**
```bash
firebase deploy --only firestore:indexes
```
Wait for all indexes to build (check Firebase Console).

### Phase 2: Update UI Components
- Add grid selector dropdowns to task/activity creation forms
- Add cascading filters: PV Area → Block → Row → Column
- Update dashboard to show grid-based progress

### Phase 3: Start Using Grid Fields
When creating tasks/activities, populate these fields:
```typescript
{
  pvAreaId: 'pv1',
  pvAreaName: 'PV1',
  blockId: 'block1',
  blockName: 'BLOCK1',
  row: 'A',
  column: '20'
}
```

### Phase 4: Build Visual Grid View
Create a component that renders the grid with color-coded cells based on progress.

---

## Important Notes

1. **Fields are optional** — Existing data continues to work
2. **Denormalized names** — `pvAreaName` and `blockName` avoid extra lookups
3. **Backward compatible** — Code works with or without grid fields
4. **Index deployment is required** — Queries will fail without indexes

---

## Related Documentation

- [PV Grid Tracking System](./PV-GRID-TRACKING-SYSTEM.md) — Complete technical documentation
- [PV Blocks Database](./PV-BLOCKS-DATABASE.md) — PV area and block management

---

Last Updated: January 2025
