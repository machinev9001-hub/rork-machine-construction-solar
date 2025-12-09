# PV Grid Tracking System

## Overview

The PV Grid Tracking System provides **precise, hierarchical location tracking** for activities down to specific grid cells. This enables visual progress mapping and detailed reporting.

## Hierarchy Levels

```
Site
  └─ PV Area (e.g., PV1, PV2, North Section)
      └─ Block (e.g., BLOCK1, BLOCK2, B-01)
          └─ Row (e.g., A, B, C, D, E)
              └─ Column (e.g., 1, 2, 3, 4, 5, ..., 20)
```

### Example Reference
**Full Location:** `PV1 / BLOCK1 / ROW A / COLUMN 20`

This means:
- **PV Area:** PV1
- **Block:** BLOCK1  
- **Row:** A
- **Column:** 20

## Data Model

### 1. PV Areas Collection
**Collection:** `pvAreas`

```typescript
{
  id: string;              // Auto-generated
  name: string;            // "PV1", "North Section"
  siteId: string;          // Reference to site
  createdAt: Timestamp;
}
```

### 2. Block Areas Collection
**Collection:** `blockAreas`

```typescript
{
  id: string;              // Auto-generated
  name: string;            // "BLOCK1", "B-01"
  pvAreaId: string;        // Reference to parent PV area
  pvAreaName: string;      // Denormalized for performance
  siteId: string;          // Reference to site
  rowValues: string[];     // ["A", "B", "C", "D", "E"]
  columnValues: string[];  // ["1", "2", "3", "4", "5", ..., "20"]
  createdAt: Timestamp;
}
```

### 3. Tasks Collection (Extended)
**Collection:** `tasks`

New fields added:
```typescript
{
  // ... existing fields ...
  pvAreaId?: string;       // Reference to PV area
  pvAreaName?: string;     // Denormalized
  blockId?: string;        // Reference to block
  blockName?: string;      // Denormalized
  row?: string;            // "A", "B", "C", etc.
  column?: string;         // "1", "2", "3", ..., "20", etc.
}
```

### 4. Activities Collection (Extended)
**Collection:** `activities`

New fields added:
```typescript
{
  // ... existing fields ...
  pvAreaId?: string;       // Reference to PV area
  pvAreaName?: string;     // Denormalized
  blockId?: string;        // Reference to block
  blockName?: string;      // Denormalized
  row?: string;            // "A", "B", "C", etc.
  column?: string;         // "1", "2", "3", ..., "20", etc.
}
```

---

## Required Firebase Indexes

### Tasks Collection

1. **Filter by Site + PV Area + Block**
```json
{
  "collectionGroup": "tasks",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "siteId", "order": "ASCENDING" },
    { "fieldPath": "pvAreaId", "order": "ASCENDING" },
    { "fieldPath": "blockId", "order": "ASCENDING" }
  ]
}
```

2. **Filter by Site + PV Area + Block + Row**
```json
{
  "collectionGroup": "tasks",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "siteId", "order": "ASCENDING" },
    { "fieldPath": "pvAreaId", "order": "ASCENDING" },
    { "fieldPath": "blockId", "order": "ASCENDING" },
    { "fieldPath": "row", "order": "ASCENDING" }
  ]
}
```

3. **Filter by Site + PV Area + Block + Row + Column**
```json
{
  "collectionGroup": "tasks",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "siteId", "order": "ASCENDING" },
    { "fieldPath": "pvAreaId", "order": "ASCENDING" },
    { "fieldPath": "blockId", "order": "ASCENDING" },
    { "fieldPath": "row", "order": "ASCENDING" },
    { "fieldPath": "column", "order": "ASCENDING" }
  ]
}
```

4. **Filter by PV Area only**
```json
{
  "collectionGroup": "tasks",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "siteId", "order": "ASCENDING" },
    { "fieldPath": "pvAreaId", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

5. **Filter by Block only**
```json
{
  "collectionGroup": "tasks",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "siteId", "order": "ASCENDING" },
    { "fieldPath": "blockId", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

### Activities Collection

1. **Filter by Site + PV Area + Block**
```json
{
  "collectionGroup": "activities",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "siteId", "order": "ASCENDING" },
    { "fieldPath": "pvAreaId", "order": "ASCENDING" },
    { "fieldPath": "blockId", "order": "ASCENDING" }
  ]
}
```

2. **Filter by Site + PV Area + Block + Row**
```json
{
  "collectionGroup": "activities",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "siteId", "order": "ASCENDING" },
    { "fieldPath": "pvAreaId", "order": "ASCENDING" },
    { "fieldPath": "blockId", "order": "ASCENDING" },
    { "fieldPath": "row", "order": "ASCENDING" }
  ]
}
```

3. **Filter by Site + PV Area + Block + Row + Column (PRECISE CELL TRACKING)**
```json
{
  "collectionGroup": "activities",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "siteId", "order": "ASCENDING" },
    { "fieldPath": "pvAreaId", "order": "ASCENDING" },
    { "fieldPath": "blockId", "order": "ASCENDING" },
    { "fieldPath": "row", "order": "ASCENDING" },
    { "fieldPath": "column", "order": "ASCENDING" }
  ]
}
```

4. **Filter activities by task + grid location**
```json
{
  "collectionGroup": "activities",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "taskId", "order": "ASCENDING" },
    { "fieldPath": "pvAreaId", "order": "ASCENDING" },
    { "fieldPath": "blockId", "order": "ASCENDING" },
    { "fieldPath": "row", "order": "ASCENDING" },
    { "fieldPath": "column", "order": "ASCENDING" }
  ]
}
```

5. **Progress tracking by PV Area**
```json
{
  "collectionGroup": "activities",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "siteId", "order": "ASCENDING" },
    { "fieldPath": "pvAreaId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" }
  ]
}
```

6. **Progress tracking by Block**
```json
{
  "collectionGroup": "activities",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "siteId", "order": "ASCENDING" },
    { "fieldPath": "blockId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" }
  ]
}
```

---

## Use Cases

### 1. Creating a Task for Specific Grid Cell

When supervisor creates a task, they select:
1. PV Area (e.g., PV1)
2. Block (cascades from PV Area, e.g., BLOCK1)
3. Row (from predefined list, e.g., A)
4. Column (from predefined list, e.g., 20)

```typescript
await addDoc(collection(db, 'tasks'), {
  name: 'Install DC Cable',
  siteId: 'site123',
  supervisorId: 'sup456',
  pvAreaId: 'pv1',
  pvAreaName: 'PV1',
  blockId: 'block1',
  blockName: 'BLOCK1',
  row: 'A',
  column: '20',
  // ... other fields
});
```

### 2. Querying Activities by Exact Grid Cell

```typescript
// Get all activities for PV1 / BLOCK1 / ROW A / COLUMN 20
const q = query(
  collection(db, 'activities'),
  where('siteId', '==', siteId),
  where('pvAreaId', '==', 'pv1'),
  where('blockId', '==', 'block1'),
  where('row', '==', 'A'),
  where('column', '==', '20')
);
const snapshot = await getDocs(q);
```

### 3. Visual Progress Grid

Query all activities in a block and render a grid:

```typescript
// Get all activities for BLOCK1
const q = query(
  collection(db, 'activities'),
  where('siteId', '==', siteId),
  where('blockId', '==', 'block1')
);
const snapshot = await getDocs(q);

// Group by row and column
const grid: Record<string, Record<string, Activity[]>> = {};
snapshot.docs.forEach(doc => {
  const activity = doc.data();
  if (!grid[activity.row]) grid[activity.row] = {};
  if (!grid[activity.row][activity.column]) grid[activity.row][activity.column] = [];
  grid[activity.row][activity.column].push(activity);
});

// Now render as a table/grid with color-coded cells based on progress
```

### 4. Rollup Progress Reports

**By Column (vertical progress):**
```typescript
const q = query(
  collection(db, 'activities'),
  where('siteId', '==', siteId),
  where('blockId', '==', 'block1'),
  where('column', '==', '20')
);
// Calculate % complete for column 20
```

**By Row (horizontal progress):**
```typescript
const q = query(
  collection(db, 'activities'),
  where('siteId', '==', siteId),
  where('blockId', '==', 'block1'),
  where('row', '==', 'A')
);
// Calculate % complete for row A
```

**By Block:**
```typescript
const q = query(
  collection(db, 'activities'),
  where('siteId', '==', siteId),
  where('blockId', '==', 'block1')
);
// Calculate % complete for entire block
```

**By PV Area:**
```typescript
const q = query(
  collection(db, 'activities'),
  where('siteId', '==', siteId),
  where('pvAreaId', '==', 'pv1')
);
// Calculate % complete for entire PV area
```

---

## UI Components Needed

### 1. Grid Selector (for Task/Activity Creation)

```tsx
// Cascading dropdowns
<PVAreaSelector value={pvArea} onChange={setPVArea} />
<BlockSelector pvAreaId={pvArea} value={block} onChange={setBlock} />
<RowSelector blockId={block} value={row} onChange={setRow} />
<ColumnSelector blockId={block} value={column} onChange={setColumn} />

// Final reference: "PV1 / BLOCK1 / A / 20"
```

### 2. Visual Grid Display

```tsx
// Render a table/grid of cells
<GridView blockId={selectedBlock}>
  {rows.map(row => (
    <Row key={row}>
      {columns.map(col => {
        const progress = getProgressForCell(row, col);
        return (
          <Cell 
            key={col}
            row={row}
            column={col}
            progress={progress}
            color={getColorFromProgress(progress)}
            onPress={() => navigateToCell(row, col)}
          />
        );
      })}
    </Row>
  ))}
</GridView>
```

### 3. Progress Dashboard Filters

```tsx
<DashboardFilters>
  <PVAreaFilter onChange={handlePVAreaChange} />
  <BlockFilter pvArea={selectedPVArea} onChange={handleBlockChange} />
  <RowFilter block={selectedBlock} onChange={handleRowChange} />
  <ColumnFilter block={selectedBlock} onChange={handleColumnChange} />
</DashboardFilters>

// Queries update based on selected filters
```

---

## Migration Plan

### Phase 1: Add Fields to Collections (Non-Breaking)
- Add optional `pvAreaId`, `pvAreaName`, `blockId`, `blockName`, `row`, `column` to tasks
- Add optional fields to activities
- Existing data continues to work (fields are optional)

### Phase 2: Create Indexes
- Deploy all required indexes via `firebase deploy --only firestore:indexes`
- Wait for indexes to build (can take minutes to hours depending on data size)

### Phase 3: Update UI
- Add grid selectors to task/activity creation forms
- Update dashboard to show grid-based progress
- Add visual grid view

### Phase 4: Backfill (Optional)
- If you have existing tasks with location data in names (e.g., "PV1 - BLOCK1 - Task")
- Write a migration script to parse and populate new fields
- This is optional; new tasks will have the fields automatically

---

## Benefits

✅ **Precise Tracking:** Know exactly which cell is complete
✅ **Visual Progress:** Color-coded grids showing real-time status
✅ **Flexible Reporting:** Query by any level (area, block, row, column)
✅ **Scalable:** Indexes ensure fast queries even with thousands of activities
✅ **Future-Proof:** Easy to add more levels if needed

---

## Index Deployment

All indexes are defined in `firestore.indexes.json`. To deploy:

```bash
firebase deploy --only firestore:indexes
```

Monitor index creation in Firebase Console:
- Firestore → Indexes → Check status
- Wait for all indexes to show "Enabled" (green)

---

Last Updated: January 2025
