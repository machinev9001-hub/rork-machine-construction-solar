# Plant Allocation Scheduling System Update

## Overview
Recent updates to the plant allocation system to improve scheduling flexibility and archival organization.

## Date: December 2025

## Changes Made

### 1. Scheduling Logic Update

#### Previous Behavior
- "Schedule Plant" button was only enabled once the scheduled date/time was reached
- Plant manager could not schedule ahead of time

#### New Behavior
- "Schedule Plant" button is now available at all times after a plant asset is selected
- Plant manager can schedule the asset anytime, regardless of the scheduled delivery date
- Green highlighting on scheduled button still appears when the scheduled date/time is reached
- Provides flexibility for early scheduling or urgent changes

#### Implementation Details
Location: `app/plant-allocation-requests.tsx`

```typescript
// Schedule button is always enabled once an asset is selected
disabled={!selectedAsset[request.id]}

// Visual highlighting only when date has arrived
const isScheduledTimeReached = request.scheduledDeliveryDate 
  ? new Date() >= request.scheduledDeliveryDate.toDate() 
  : false;

// Apply green styling when scheduled time is reached
backgroundColor: isScheduledTimeReached ? '#059669' : '#3B82F6'
```

### 2. Incoming Tab Button Logic

#### Clarification
- In the Incoming tab (`!isScheduled`): The "Allocate Plant" button remains
- This button schedules the request and moves it to the Scheduled tab
- No "Approve" button in the incoming tab
- Workflow: Incoming → Select Asset → Allocate Plant (schedules) → Scheduled tab

### 3. Archive Organization by Year/Month

#### Previous Behavior
- All archived plant allocation requests stored flat in archived tab
- Difficult to navigate large numbers of archived requests

#### New Behavior
- Archived requests grouped by Year and Month folders
- Collapsible folder structure for clean navigation
- Folders expand to show cards within that month
- Uses `groupRequestsByMonth` and `archiveRequestsByMonth` utilities

#### Structure Example
```
📁 2025
  📁 December
    📄 Request Card 1
    📄 Request Card 2
  📁 November
    📄 Request Card 3

📁 2024
  📁 December
    📄 Request Card 4
```

#### Implementation Details
Location: `app/plant-allocation-requests.tsx`

Uses utility functions from `utils/requestArchive.ts`:
- `groupRequestsByMonth(requests)` - Groups requests by year/month
- `getMonthLabel(monthKey)` - Formats display labels (e.g., "December 2025")

```typescript
const archivedByMonth = useMemo(() => 
  groupRequestsByMonth(
    requests.filter((r) => r.archived)
  ), 
  [requests]
);

// Render collapsible folders
{Object.entries(archivedByMonth).map(([monthKey, monthRequests]) => (
  <View key={monthKey}>
    <TouchableOpacity onPress={() => toggleMonth(monthKey)}>
      <Text>{getMonthLabel(monthKey)}</Text>
      {expandedMonths[monthKey] ? <ChevronUp /> : <ChevronDown />}
    </TouchableOpacity>
    
    {expandedMonths[monthKey] && monthRequests.map((request) => (
      <RequestCard key={request.id} request={request} />
    ))}
  </View>
))}
```

#### Archive Function Update
Location: `utils/requestArchive.ts`

```typescript
export async function archiveRequestsByMonth(
  collectionName: string,
  requestIds: string[]
): Promise<void> {
  // Archives requests and organizes by month
  // Maintains archivedAt timestamp for sorting
}
```

## Benefits

### Scheduling Flexibility
- ✅ Plant managers can schedule ahead of urgent needs
- ✅ Reduces waiting time when scheduled date arrives
- ✅ Visual indicator (green) shows when originally planned time is reached
- ✅ Better workflow for proactive planning

### Archive Organization
- ✅ Clean, organized view of historical requests
- ✅ Easy navigation through months/years
- ✅ Scalable for large volumes of archived data
- ✅ Maintains chronological order within folders
- ✅ Reduces visual clutter

## Related Files
- `app/plant-allocation-requests.tsx` - Main screen implementation
- `utils/requestArchive.ts` - Archive utility functions
- `docs/PLANT-ASSET-ALLOCATION-SYSTEM.md` - Overall system documentation

## Testing Checklist
- [ ] Verify "Schedule Plant" button is enabled after selecting asset
- [ ] Confirm green highlight appears when scheduled date/time is reached
- [ ] Test scheduling before and after the scheduled delivery date
- [ ] Verify archived requests are grouped by year/month
- [ ] Test expanding/collapsing month folders
- [ ] Confirm requests within months are sorted correctly
- [ ] Test archive restoration from monthly folders
- [ ] Verify no performance issues with large archived datasets

## Future Enhancements
- Consider auto-expanding current month by default
- Add year-level collapse/expand all functionality
- Add search/filter across archived months
- Export archived data by month
