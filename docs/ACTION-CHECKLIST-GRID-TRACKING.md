# Action Checklist: Enable Precise Grid Tracking

## What You Asked
> "For all the referencing like when we want to track progress, the user was allocated say PV1/BLOCK1 ROW A COLUMN 20. The activity must be able to be referenced exactly. If I want to create a visual progress then it should be able to define it up to this very precise tracking. Do we need more indexes now?"

## Answer
**YES, you need 13 new indexes.** They've been added to `firestore.indexes.json`.

---

## What You Need to Do

### ✅ Step 1: Deploy Firebase Indexes (CRITICAL)

Run this command in your terminal:
```bash
firebase deploy --only firestore:indexes
```

This will deploy **13 new indexes** for grid tracking.

**Wait Time:** 5 minutes to 2 hours (depending on your data size)

**How to Check:**
1. Open [Firebase Console](https://console.firebase.google.com/project/project-tracker-app-33cff/firestore/indexes)
2. Go to: Firestore Database → Indexes
3. Look for indexes with `pvAreaId`, `blockId`, `row`, `column` fields
4. Wait until status shows **"Enabled"** (green) for all of them

**⚠️ IMPORTANT:** Don't proceed to next steps until all indexes are enabled.

---

### ✅ Step 2: Understand the Data Model

Your activities will now have these additional fields:

```typescript
{
  // Existing fields...
  pvAreaId: "pv1",          // Reference to PV area
  pvAreaName: "PV1",        // Display name
  blockId: "block1",        // Reference to block
  blockName: "BLOCK1",      // Display name
  row: "A",                 // Row letter
  column: "20"              // Column number
}
```

**Full Reference Example:**
```
PV1 / BLOCK1 / ROW A / COLUMN 20
```

---

### ✅ Step 3: Update Your Code to Populate Grid Fields

When creating tasks or activities, add the grid location:

```typescript
await addDoc(collection(db, 'activities'), {
  // ... your existing fields ...
  
  // NEW: Add grid location
  pvAreaId: selectedPvArea.id,
  pvAreaName: selectedPvArea.name,
  blockId: selectedBlock.id,
  blockName: selectedBlock.name,
  row: selectedRow,           // "A", "B", "C"
  column: selectedColumn,     // "1", "2", "3", ..., "20"
});
```

---

### ✅ Step 4: Query by Grid Location

Now you can query activities at **any level**:

#### Query a specific cell:
```typescript
const q = query(
  collection(db, 'activities'),
  where('siteId', '==', siteId),
  where('pvAreaId', '==', 'pv1'),
  where('blockId', '==', 'block1'),
  where('row', '==', 'A'),
  where('column', '==', '20')
);
```

#### Query an entire row:
```typescript
const q = query(
  collection(db, 'activities'),
  where('siteId', '==', siteId),
  where('blockId', '==', 'block1'),
  where('row', '==', 'A')
);
```

#### Query an entire block:
```typescript
const q = query(
  collection(db, 'activities'),
  where('siteId', '==', siteId),
  where('blockId', '==', 'block1')
);
```

---

### ✅ Step 5: Build Visual Grid

Create a table/grid showing progress:

```typescript
// Get all activities in block
const activities = await fetchActivitiesForBlock('block1');

// Group by row and column
const grid: Record<string, Record<string, Activity[]>> = {};
activities.forEach(activity => {
  if (!grid[activity.row]) grid[activity.row] = {};
  if (!grid[activity.row][activity.column]) {
    grid[activity.row][activity.column] = [];
  }
  grid[activity.row][activity.column].push(activity);
});

// Calculate progress for each cell
const cellProgress = (row: string, col: string) => {
  const cellActivities = grid[row]?.[col] || [];
  const completed = cellActivities.filter(a => a.status === 'DONE').length;
  return completed / cellActivities.length * 100;
};

// Render grid
{rows.map(row => (
  <Row key={row}>
    {columns.map(col => {
      const progress = cellProgress(row, col);
      return (
        <Cell
          key={col}
          progress={progress}
          backgroundColor={getColorFromProgress(progress)}
        />
      );
    })}
  </Row>
))}
```

---

## What This Enables

✅ **Precise Tracking:** Know exactly which cell (e.g., A20) is complete  
✅ **Visual Grids:** Color-coded progress maps  
✅ **Flexible Reporting:** Query by area, block, row, column, or exact cell  
✅ **Scalability:** Indexes ensure fast queries with thousands of activities  
✅ **Rollup Progress:** Aggregate from cell → row → block → area → site  

---

## Summary

**Yes, you understand correctly!**

You want to track activities at the **grid cell level**:
- **PV Area:** PV1
- **Block:** BLOCK1
- **Row:** A
- **Column:** 20

This enables:
1. Querying activities by exact coordinates
2. Creating visual progress grids (like a spreadsheet)
3. Rollup progress reporting at any level

**New indexes are required** and have been added. Deploy them with:
```bash
firebase deploy --only firestore:indexes
```

---

## Documentation

📄 [PV Grid Tracking System](./PV-GRID-TRACKING-SYSTEM.md) — Full technical docs  
📄 [PV Grid Indexes](./PV-GRID-TRACKING-INDEXES.md) — Index deployment guide  
📄 [PV Blocks Database](./PV-BLOCKS-DATABASE.md) — Area/block management  

---

Last Updated: January 2025
