# Site Isolation Fix Implementation

## Overview
This document describes the site isolation issues found and the fix implemented to resolve them.

## Problem
When running the site isolation diagnostic, 224 records were found without proper `siteId` field:

### Issues Found:
1. **Subcontractors (3 records)** - Missing `siteId`
   - ID: ipsmBYJcmwHNPms4VUOJ (Nkgobza)
   - ID: q3W4sY1Kt17FB3kqiaZU (CHTP)
   - ID: xTjEMVVbSTYorg3iDi4b (CHTP)

2. **Activities/Menu Items (221 records)** - Missing `siteId`
   - All menu items seeded through `seedMenuData` were missing siteId

## Root Cause
The issue occurred because:
1. **Subcontractors**: Some old subcontractors were created before site isolation was fully implemented
2. **Menu Items**: The seed script creates menu items but they didn't have siteId from the start

## Solution

### 1. Diagnostic Script (`scripts/diagnose-site-isolation.ts`)
- Checks all site-specific collections for records missing `siteId`
- Reports distribution of records across sites
- Identifies which records need fixing
- **Updated**: Changed from checking `activities` to `menuItems` collection (where activities are actually stored)

### 2. Fix Script (`scripts/fix-site-isolation.ts`)
Created a comprehensive fix script that:
- Fixes subcontractors without siteId
- Fixes menu items (activities) without siteId
- Uses Firebase batch operations for efficiency
- Provides detailed logging and error handling
- Supports up to 500 operations per batch

#### Functions:
- `fixSubcontractorsIsolation()` - Adds siteId to subcontractors
- `fixActivitiesIsolation()` - Adds siteId to menu items
- `fixAllSiteIsolationIssues()` - Runs all fixes and provides summary
- `deleteRecordsNotBelongingToSite()` - Optional cleanup function (use with caution)

### 3. UI Integration (`app/diagnose-site-data.tsx`)
Enhanced the diagnostic screen with:
- "Run Diagnostic" button - Checks for issues
- "Fix All Issues" button - Appears when issues are found
- Detailed results display showing:
  - Total issues found
  - Per-collection breakdown
  - Distribution across sites
  - Specific records with issues
- Confirmation dialog before applying fixes
- Success/error feedback

## How to Use

### Step 1: Run Diagnostic
1. Go to Admin Panel (via admin-pin-verify flow)
2. Navigate to "Site Data Diagnostic" 
3. Click "Run Diagnostic"
4. Review the results on screen

### Step 2: Fix Issues
1. If issues are found, click "Fix All Issues"
2. Confirm the action (this adds the current siteId to all records)
3. Wait for completion
4. Run diagnostic again to verify

### Step 3: Verify
- The diagnostic should show 0 issues after the fix
- All records should have proper siteId
- Data should be isolated per site

## Important Notes

### What the Fix Does:
- Adds the **current site's siteId** to records missing it
- Does NOT delete or modify existing data
- Uses batch operations for safety and efficiency
- Provides detailed logs in console

### What to Check:
1. **Subcontractors**: Verify they belong to the correct site
2. **Menu Items**: Ensure menu structure is preserved
3. **Other Collections**: Check employees, plant assets, etc.

### If Records Belong to Wrong Site:
If some records were assigned to the wrong site:
1. Use Firebase Console to manually update the `siteId` field
2. Or use the `deleteRecordsNotBelongingToSite()` function (with caution)
3. Re-run the diagnostic to verify

## Technical Details

### Collections Checked:
- subcontractors
- employees
- plantAssets
- pvAreas
- blockAreas
- menuItems (activities)
- tasks
- clockLogs
- faceEnrollments
- qcRequests
- cablingRequests
- terminationRequests
- surveyorRequests
- plannerRequests
- activityRequests
- scopeRequests
- staffAllocationRequests
- plantAllocationRequests
- handovers
- materialsRequests

### Firebase Indexes Required:
All the existing compound indexes should support querying by `masterAccountId` and `siteId`.

## Prevention

### For Future Development:
1. **Always include siteId** when creating new records
2. **Validate siteId** in creation functions
3. **Use the diagnostic tool** regularly to catch issues early
4. **Update seed scripts** to include siteId from the start

### Updated Code Patterns:
```typescript
// When adding a subcontractor
await addDoc(subcontractorsRef, {
  ...data,
  siteId: user.siteId,  // ✅ Always include
  masterAccountId: user.masterAccountId,
});

// When seeding menu items
const menuItem = {
  ...data,
  siteId,  // ✅ Pass from function parameter
  masterAccountId,
};
```

## Related Files
- `scripts/diagnose-site-isolation.ts` - Diagnostic tool
- `scripts/fix-site-isolation.ts` - Fix script
- `app/diagnose-site-data.tsx` - UI for diagnostic/fix
- `utils/subcontractorManager.ts` - Subcontractor CRUD (updated)
- `utils/seedMenuData.ts` - Menu seeding (already has siteId support)

## Testing Checklist
- [ ] Run diagnostic and verify issues count
- [ ] Fix all issues using the UI button
- [ ] Run diagnostic again - should show 0 issues
- [ ] Verify subcontractors list shows only current site data
- [ ] Verify menu items are accessible
- [ ] Test creating new employees (should validate ID uniqueness per site, not globally)
- [ ] Switch to another site and verify data isolation

## Notes
- The "Owner/Salary payer" field was renamed to "Sub Contractor" as requested
- Employee ID uniqueness is now per-site (same ID can exist in different sites)
- The diagnostic tool can be accessed from Admin Panel → Site Data Diagnostic
