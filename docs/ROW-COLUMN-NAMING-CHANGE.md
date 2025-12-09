# Row & Column Naming Convention Change

## Summary

Successfully swapped the naming convention for PV Grid Tracking to match standard spreadsheet format.

## Previous Convention
- **Rows:** Numbers (1, 2, 3, 4, 5)
- **Columns:** Letters (A, B, C, D, E)
- **Example:** PV1 / BLOCK1 / ROW 1 / COLUMN A

## New Convention (Current)
- **Rows:** Letters (A, B, C, D, E)
- **Columns:** Numbers (1, 2, 3, 4, 5)
- **Example:** PV1 / BLOCK1 / ROW A / COLUMN 20

## Impact Assessment

### ✅ No Database Changes Required
- Database field names (`row`, `column`) remain unchanged
- Existing Firebase indexes are **NOT affected**
- No data migration needed

### ✅ What Changed
1. **UI Labels & Descriptions**
   - Row configuration now shows: "Define rows using numbers (e.g., 1, 2, 3, 4)"
   - Column configuration now shows: "Define columns using letters (e.g., A, B, C, D)"

2. **Input Validation**
   - Row input now accepts: `autoCapitalize="characters"`
   - Column input now accepts: numeric input

3. **Data Format Stored**
   - `rowValues` array now stores: `["A", "B", "C", "D", "E"]`
   - `columnValues` array now stores: `["1", "2", "3", "4", "5"]`

4. **Documentation Updated**
   - `docs/PV-GRID-TRACKING-SYSTEM.md` - All examples updated
   - Data model examples reflect new format

## Files Modified

1. **app/master-pv-blocks.tsx**
   - Line 523: Row description changed to letters (A, B, C, D...)
   - Line 534: Row placeholder changed to "A"
   - Line 537: Row input auto-capitalizes to uppercase
   - Line 524: Column description changed to numbers (1, 2, 3, 4...)
   - Line 546: Column placeholder changed to "1, 2, 3, 4, 5"
   - Line 279: Row validation error message updated
   - Line 283: Column validation error message updated
   - Line 293: Columns no longer converted to uppercase

2. **docs/PV-GRID-TRACKING-SYSTEM.md**
   - Hierarchy example updated
   - All code examples updated
   - Query examples updated
   - Data model documentation updated

## Existing Data

### For Blocks Created with Old Convention
- Old blocks with rows as numbers and columns as letters will continue to work
- The system stores these as strings, so there's no type conflict
- However, new blocks should follow the new convention

### Recommendation
If you have existing blocks using the old format:
- Consider editing them through the UI to update to the new format
- Or, leave them as-is if they're already in use (system will handle both formats)

## Firebase Indexes

**No changes needed!** All 13 indexes remain valid because:
- Index field paths (`row`, `column`) haven't changed
- Indexes work with string values regardless of format
- Query structure remains identical

## Next Steps

1. ✅ Naming convention updated
2. ✅ Documentation updated
3. ⏳ Create new PV Blocks using the new format
4. ⏳ (Optional) Update existing blocks if desired

---

**Change Date:** 2025-11-25  
**Status:** ✅ Complete - No Breaking Changes
