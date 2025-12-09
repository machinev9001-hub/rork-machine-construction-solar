# PV Areas & Blocks Database Documentation

## Overview

This document describes the database structure and implementation for managing PV Areas and Block Areas in the system. This feature allows MASTER and PLANNER roles to define and manage site areas for better organization and filtering of tasks and progress tracking.

## Database Collections

### 1. PV Areas Collection

**Collection Name:** `pvAreas`

**Purpose:** Store PV (Photovoltaic) area definitions for a site

**Fields:**
```typescript
{
  id: string;           // Auto-generated document ID
  name: string;         // PV area name (e.g., "PV01", "North", "Section A")
  siteId: string;       // Reference to the site
  createdAt: Timestamp; // Creation timestamp
}
```

**Required Indexes:**
1. **Composite Index:**
   - Collection: `pvAreas`
   - Fields indexed:
     - `siteId` (Ascending)
     - `name` (Ascending)
   - Query scope: Collection
   - Purpose: Efficiently retrieve all PV areas for a specific site, sorted by name

**Index Rationale:**
- The `siteId` index is essential as queries always filter by site
- Sorting by `name` provides consistent ordering in UI dropdowns
- This is a compound index for efficient filtering and sorting

---

### 2. Block Areas Collection

**Collection Name:** `blockAreas`

**Purpose:** Store block area definitions within PV areas

**Fields:**
```typescript
{
  id: string;           // Auto-generated document ID
  name: string;         // Block area name (e.g., "B01", "Block-A")
  pvAreaId: string;     // Reference to parent PV area
  pvAreaName: string;   // Denormalized PV area name for quick lookup
  siteId: string;       // Reference to the site
  rowValues: string[];  // Array of row identifiers (e.g., ["A", "B", "C"])
  columnValues: string[]; // Array of column identifiers (e.g., ["1", "2", "3"])
  createdAt: Timestamp; // Creation timestamp
}
```

**Required Indexes:**
1. **Composite Index (Site Query):**
   - Collection: `blockAreas`
   - Fields indexed:
     - `siteId` (Ascending)
     - `name` (Ascending)
   - Query scope: Collection
   - Purpose: Retrieve all blocks for a site, sorted by name

2. **Composite Index (PV Area Query):**
   - Collection: `blockAreas`
   - Fields indexed:
     - `pvAreaId` (Ascending)
     - `name` (Ascending)
   - Query scope: Collection
   - Purpose: Retrieve blocks within a specific PV area, sorted by name

**Index Rationale:**
- The `siteId` index supports dashboard filtering
- The `pvAreaId` index enables efficient cascading dropdowns
- The `name` sorting provides consistent UI ordering
- `pvAreaName` is denormalized to avoid JOIN operations

---

## Features

### 1. PV Areas Management
- **Add PV Areas:** Create new PV areas for a site
- **Edit PV Areas:** Update existing PV area names
- **Delete PV Areas:** Remove PV areas (cascades to delete associated blocks)
- **List PV Areas:** View all PV areas for a site

### 2. Block Areas Management
- **Add Block Areas:** Create new blocks within a PV area with row and column configuration
- **Edit Block Areas:** Update existing block names, rows, and columns
- **Delete Block Areas:** Remove specific blocks
- **Filter Blocks:** View blocks filtered by parent PV area
- **List All Blocks:** View all blocks across all PV areas
- **Configure Rows:** Define row values using letters (A, B, C, etc.)
- **Configure Columns:** Define column values using numbers (1, 2, 3, etc.)

### 3. Dashboard Filtering
- **PV Area Dropdown:** Select a specific PV area to filter progress
- **Block Dropdown:** Select a specific block (cascades based on PV area selection)
- **Clear Filters:** Reset to show all areas
- **Real-time Updates:** Dashboard automatically updates based on filter selections

---

## User Interface

### Settings Page (`/master-pv-blocks`)

**Access:**
- Available to MASTER and PLANNER roles
- Accessible from Settings > "PV Areas & Blocks"

**Features:**
- Horizontal layout with two sections side-by-side
- Real-time data synchronization with Firebase
- Optimistic UI updates
- Cascading filters (selecting PV area filters blocks)
- Inline editing and deletion

### Dashboard Filters (`/master-dashboard`)

**Features:**
- Horizontal dropdown selectors for PV Area and Block
- Cascading selection (Block dropdown updates when PV Area changes)
- "Clear Filters" button when filters are active
- Real-time progress recalculation based on filters

---

## Implementation Details

### Data Flow

1. **Creating PV Area:**
   ```typescript
   // Add document to pvAreas collection
   await addDoc(collection(db, 'pvAreas'), {
     name: 'PV01',
     siteId: user.siteId,
     createdAt: new Date(),
   });
   ```

2. **Creating Block Area:**
   ```typescript
   // Add document to blockAreas collection
   await addDoc(collection(db, 'blockAreas'), {
     name: 'B01',
     pvAreaId: selectedPvAreaId,
     pvAreaName: 'PV01',  // Denormalized for performance
     rowValues: ['A', 'B', 'C', 'D'],  // Row configuration
     columnValues: ['1', '2', '3', '4', '5'],  // Column configuration
     siteId: user.siteId,
     createdAt: new Date(),
   });
   ```

3. **Filtering Dashboard:**
   ```typescript
   // Filter tasks by matching PV area and block names
   const filteredTasks = tasks.filter(task => {
     const [taskPvArea, taskBlock] = task.taskName.split(' - ');
     return (
       (selectedPvArea === 'all' || taskPvArea === selectedPvAreaName) &&
       (selectedBlock === 'all' || taskBlock === selectedBlockName)
     );
   });
   ```

### Cascading Deletion

When a PV Area is deleted:
1. Query all blocks with matching `pvAreaId`
2. Delete each block document
3. Delete the PV area document
4. Invalidate React Query caches

```typescript
// Cascade delete blocks when PV area is deleted
const blocksInArea = blockAreas.filter(b => b.pvAreaId === pvAreaId);
for (const block of blocksInArea) {
  await deleteDoc(doc(db, 'blockAreas', block.id));
}
await deleteDoc(doc(db, 'pvAreas', pvAreaId));
```

---

## React Query Integration

### Cache Keys

- **PV Areas:** `['pvAreas', siteId]`
- **Block Areas:** `['blockAreas', siteId]`

### Automatic Invalidation

Mutations automatically invalidate the relevant caches:
- Adding/editing/deleting PV areas invalidates both `pvAreas` and `blockAreas`
- Adding/editing/deleting blocks invalidates `blockAreas`

This ensures the UI stays synchronized with the database without manual refreshes.

---

## Migration Notes

### Existing Data

The current system extracts PV areas and blocks from task names:
```typescript
// Task name format: "PV01 - B01 - Description"
const [pvArea, block, ...rest] = taskName.split(' - ');
```

### Recommended Migration Steps

1. **Create indexes** in Firebase Console (see above)
2. **Populate database** with existing PV areas and blocks:
   - Extract unique PV areas from existing tasks
   - Extract unique blocks from existing tasks
   - Create documents in `pvAreas` and `blockAreas` collections
3. **Deploy new UI** - the app will automatically use the new dropdowns
4. **Verify filtering** works correctly on dashboard

---

## Security Rules

Add these Firebase Security Rules:

```javascript
// PV Areas
match /pvAreas/{pvAreaId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null 
    && request.resource.data.siteId == get(/databases/$(database)/documents/users/$(request.auth.uid)).data.siteId
    && (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'master'
        || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'Planner');
  allow update, delete: if request.auth != null
    && resource.data.siteId == get(/databases/$(database)/documents/users/$(request.auth.uid)).data.siteId
    && (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'master'
        || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'Planner');
}

// Block Areas
match /blockAreas/{blockId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null 
    && request.resource.data.siteId == get(/databases/$(database)/documents/users/$(request.auth.uid)).data.siteId
    && (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'master'
        || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'Planner');
  allow update, delete: if request.auth != null
    && resource.data.siteId == get(/databases/$(database)/documents/users/$(request.auth.uid)).data.siteId
    && (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'master'
        || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'Planner');
}
```

---

## Testing Checklist

- [ ] MASTER can access PV Areas & Blocks settings page
- [ ] PLANNER can access PV Areas & Blocks settings page
- [ ] Other roles cannot access the settings page
- [ ] PV areas can be added successfully
- [ ] PV areas can be edited successfully
- [ ] PV areas can be deleted successfully
- [ ] Deleting a PV area also deletes its blocks
- [ ] Blocks can be added to a PV area
- [ ] Blocks can be edited successfully
- [ ] Blocks can be deleted successfully
- [ ] Dashboard dropdowns populate from database
- [ ] Selecting PV area filters the block dropdown
- [ ] Dashboard filters work correctly
- [ ] Clear filters button works
- [ ] Data persists across app restarts
- [ ] Multiple users see the same data

---

## Row and Column Configuration

### Purpose

Each block can have associated row and column values that help identify specific positions within the block. This is useful for:
- Tracking panel locations in a grid layout
- Organizing maintenance activities by specific positions
- Creating detailed progress reports by row/column

### Usage Pattern

**Rows:** Typically use letters (A, B, C, D, E, etc.)
**Columns:** Typically use numbers (1, 2, 3, 4, 5, etc.)

### Example

For a block "B01" in PV Area "PV01":
- Rows: A, B, C, D, E (5 rows)
- Columns: 1, 2, 3, 4, 5, 6, 7, 8 (8 columns)

This creates a grid of positions like A1, A2, B1, B2, etc., allowing precise tracking of work within each block.

### Data Validation

- Row values are automatically converted to uppercase
- Duplicate values are prevented
- Values can be added/removed dynamically
- Both rows and columns are optional (blocks can exist without them)

---

## Future Enhancements

1. **Bulk Import:** Import PV areas and blocks from CSV
2. **Templates:** Save common PV/block configurations as templates
3. **Analytics:** Track usage statistics for areas and blocks
4. **Reordering:** Allow custom ordering of PV areas and blocks
5. **Archiving:** Archive unused areas instead of deleting
6. **Grid Visualization:** Visual representation of row/column layout
7. **Auto-generate combinations:** Automatically create row-column combinations for task assignment

---

Last Updated: January 2025
