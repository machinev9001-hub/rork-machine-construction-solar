# PDF Billing Calculation Fix - 2025-12-22

## Problem Description

The PDF generation for billing and EPH reports was recalculating hours from meter readings (open/close hours) instead of using the pre-calculated agreed hours from the actual timesheet. This caused discrepancies between what was agreed in the timesheet system and what appeared in the PDF reports.

## Root Cause

### The Issue
In `app/billing-config.tsx`, when preparing data for PDF generation:
1. EPH generation correctly calculated billable hours using `billableHoursCalculator.ts`
2. These calculations were stored in `billingResults` array
3. BUT when creating the PDF data structure, only `totalHours`, `openHours`, and `closeHours` were passed
4. The PDF generator's `getDisplayHours()` function tried to use `actualHours` or `agreedHours` but they were undefined
5. It fell back to `totalHours`, which could be recalculated from meter readings

### The Code Path
```
EPH Generation (billing-config.tsx lines 726-777)
  → Calculates billableHours using calculateBillableHours()
  → Stores in billingResults array
  → billingResults NOT passed to PDF data structure

PDF Generation (billing-config.tsx lines 1042-1154)
  → Creates groups for PDF
  → Only includes: totalHours, openHours, closeHours
  → Missing: actualHours, billableHours, assetRate, totalCost

PDF Renderer (timesheetPdfGenerator.ts lines 122-127)
  → getDisplayHours() tries: actualHours ?? agreedHours ?? totalHours
  → actualHours is undefined
  → Falls back to totalHours (could be wrong!)
```

## Solution Implemented

### Changes Made

#### 1. Store Billing Results by Date (lines 726-752)
```typescript
const billingResultsByDate = new Map<string, BillableHoursResult>();

effectiveEntries.forEach((entry) => {
  const billingResult = calculateBillableHours(...);
  billingResults.push(billingResult);
  billingResultsByDate.set(entry.date, billingResult); // NEW: Map by date
});
```

#### 2. Include Map in EPH Record (line 819)
```typescript
return {
  // ... existing fields
  billingResults,
  billingResultsByDate, // NEW: Add to record
};
```

#### 3. Use Billing Results in PDF Data (lines 1042-1154)
```typescript
const groups = selectedAssets.map(record => {
  const billingResultsByDate = record.billingResultsByDate || new Map();
  
  return {
    entries: timesheets.map((ts: TimesheetEntry) => {
      const billingResult = billingResultsByDate.get(ts.date); // NEW: Get result for this date
      
      return {
        // ... existing fields
        // NEW: Use pre-calculated values
        actualHours: billingResult?.actualHours ?? ts.totalHours ?? 0,
        billableHours: billingResult?.billableHours ?? ts.totalHours ?? 0,
        assetRate: record.rate,
        totalCost: (billingResult?.billableHours ?? ts.totalHours ?? 0) * record.rate,
        billingRule: billingResult?.appliedRule,
      };
    }),
    // Same for dateGroups...
  };
});
```

#### 4. Applied Same Fix to "Send to Subcontractor" PDF (lines 2483-2630)
Same pattern applied to ensure consistency across all PDF generation paths.

## What This Fixes

### Before Fix
- ❌ PDF showed hours recalculated from meter readings
- ❌ Breakdown days might show wrong hours
- ❌ Rain day minimums might not apply correctly
- ❌ Weekend minimums could be ignored
- ❌ Discrepancy between agreed timesheets and PDF

### After Fix
- ✅ PDF shows pre-calculated agreed hours from timesheet
- ✅ Breakdown logic correctly applied (actual hours only, no minimums)
- ✅ Rain day minimums correctly enforced
- ✅ Weekend minimums correctly applied
- ✅ PDF matches what was agreed in the timesheet system

## How to Verify the Fix

### Test Case 1: Normal Weekday
1. Create timesheet: 9.5 hours (Monday)
2. Billing config: Weekday minimum = 0 (per hour billing)
3. **Expected PDF**: Shows 9.5h actual, 9.5h billable
4. **Verify**: PDF matches the timesheet

### Test Case 2: Weekend with Minimum
1. Create timesheet: 6 hours (Saturday)
2. Billing config: Weekend minimum = 8h
3. **Expected PDF**: Shows 6h actual, 8h billable
4. **Verify**: PDF shows minimum applied

### Test Case 3: Rain Day
1. Create timesheet: 3 hours, marked as Rain Day
2. Billing config: Rain day minimum = 4.5h
3. **Expected PDF**: Shows 3h actual, 4.5h billable
4. **Verify**: PDF shows rain day minimum

### Test Case 4: Breakdown
1. Create timesheet: 2 hours, marked as Breakdown
2. Billing config: Breakdown enabled
3. **Expected PDF**: Shows 2h actual, 2h billable (no minimum)
4. **Verify**: PDF shows actual hours only

### Test Case 5: Plant Manager Adjustment
1. Operator enters: 10h
2. Plant Manager adjusts to: 9h
3. **Expected PDF**: 
   - Original row: 10h
   - Adjusted row: 9h (used for billing)
4. **Verify**: Both rows shown, adjusted used for totals

## Files Changed

1. **app/billing-config.tsx**
   - Added `billingResultsByDate` Map during EPH generation
   - Updated `handleGeneratePDFReport` to use billing results
   - Updated "Send to Subcontractor" PDF generation
   - Added debug logging

2. **docs/BILLING-TIMESHEET-WORKFLOW-CLARIFICATION.md**
   - Marked PDF issue as fixed
   - Added fix details and timestamp

3. **docs/EPH-AGREEMENT-IMPLEMENTATION-STATUS.md**
   - Added "Recently Completed" section
   - Documented the fix

## Technical Details

### Data Flow (After Fix)
```
1. EPH Generation
   ↓
   calculateBillableHours() for each entry
   ↓
   Store in billingResultsByDate Map (key = date)
   ↓
   Include map in ephData record

2. PDF Generation
   ↓
   Get billingResultsByDate from record
   ↓
   For each timesheet entry:
     - Look up billing result by date
     - Use actualHours from result
     - Use billableHours from result
   ↓
   Pass complete data to PDF generator

3. PDF Rendering
   ↓
   getDisplayHours() uses actualHours (now populated)
   ↓
   Correct hours displayed in PDF
```

### Key Functions

- `calculateBillableHours()` in `utils/billableHoursCalculator.ts`
  - Applies billing logic hierarchy (breakdown > rain > standard)
  - Returns: actualHours, billableHours, appliedRule, minimumApplied

- `getDisplayHours()` in `utils/timesheetPdfGenerator.ts` (line 124)
  - Tries: actualHours ?? agreedHours ?? totalHours
  - Now gets actualHours from billing results

- `generateEPHReport()` in `app/billing-config.tsx` (lines 684-826)
  - Calculates billing for all timesheets
  - Creates billingResultsByDate Map
  - Stores in ephData

## Billing Logic Hierarchy

The fix ensures this hierarchy is preserved in PDFs:

1. **Priority 1: Breakdown** (overrides everything)
   - If enabled: Bill actual hours (no minimums)
   - If disabled: Bill 0 hours

2. **Priority 2: Inclement Weather**
   - Bill MAX(actual hours, rain day minimum)

3. **Priority 3: Standard Billing**
   - Bill MAX(actual hours, day type minimum)
   - Day types: weekday, Saturday, Sunday, public holiday

## Notes for Developers

- The `billingResultsByDate` Map is the single source of truth for billing calculations
- DO NOT recalculate billing hours in PDF generation
- Always use pre-calculated values from `billingResults` or `agreedHours`
- The Map key is the date string (format: "YYYY-MM-DD")
- For original entries (before adjustment), billing result may not exist - use totalHours as fallback

## Related Documentation

- `docs/PLANT-HOURS-BILLING-SYSTEM-COMPLETE.md` - Complete billing system guide
- `docs/BILLING-TIMESHEET-WORKFLOW-CLARIFICATION.md` - Workflow clarification
- `docs/EPH-SUBCONTRACTOR-AGREEMENT-WORKFLOW.md` - Agreement workflow
- `utils/billableHoursCalculator.ts` - Billing calculation logic
- `utils/timesheetPdfGenerator.ts` - PDF generation

## Testing Checklist

- [ ] Generate EPH PDF with various day types
- [ ] Generate "Send to Subcontractor" PDF
- [ ] Verify breakdown days show correct hours
- [ ] Verify rain days show correct minimums
- [ ] Verify weekend minimums apply correctly
- [ ] Verify plant manager adjustments show correctly
- [ ] Compare PDF hours to agreed timesheet hours
- [ ] Check totals and subtotals are correct
- [ ] Verify cost calculations (billable hours × rate)

## Known Limitations

- PlantAssetsTimesheetsTab.tsx still recalculates billing when loading agreed timesheets (may be intentional to show current billing config)
- Only plant hours use this billing logic (man hours have different calculation)

## Future Enhancements

- Consider storing billableHours directly in agreedTimesheets collection
- Add unit tests for PDF data preparation
- Add integration tests for end-to-end billing workflow
