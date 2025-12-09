# Offline System - Complete Guide

## Overview
This document consolidates all offline functionality including storage strategy, sync prioritization, data freshness, and authentication.

---

## System Architecture

### Core Components

1. **Offline Queue** (`utils/offlineQueue.ts`)
   - Queues write operations when offline
   - Auto-syncs when connection restored
   - Priority-based sync (P0-P3)

2. **User Cache** (`utils/userCache.ts`)
   - Caches user profiles for offline authentication
   - 24-hour cache duration
   - Enables offline QR code scanning

3. **Data Freshness Manager** (`utils/dataFreshnessSync.ts`)
   - Real-time listeners for auto-updates
   - Timestamp-based freshness checks
   - P0 sync completion notifications

4. **Offline UI** (`components/OfflineBanner.tsx`, `components/FloatingSyncIndicator.tsx`)
   - Visual status indicators
   - Sync controls
   - Notification banners

---

## Storage Strategy

### Device Storage Capacity
- **Budget phones (4GB RAM)**: 64-128 GB
- **Mid-range phones (6-8GB RAM)**: 128-256 GB
- **High-end phones (12GB RAM)**: 256-512 GB+

### App Storage Allocation

#### Category 1: Essential Offline Data (Always Cached)
| Data Type | Size | Storage Method | Refresh |
|-----------|------|----------------|---------|
| User profiles | ~1 KB each | AsyncStorage | 24 hours |
| Current user session | ~2 KB | AsyncStorage | Session |
| User PIN codes | <1 KB | AsyncStorage (encrypted) | Never |
| Offline write queue | Variable | AsyncStorage | Clear on sync |
| Sync status | <1 KB | AsyncStorage | Real-time |

**Total for 200 users**: ~200 KB + queue

#### Category 2: Frequently Accessed Data
| Data Type | Size | Storage Method | Refresh |
|-----------|------|----------------|---------|
| Active tasks | ~5 KB each | Firestore Cache | Firebase manages |
| Request history | ~3 KB each | Firestore Cache | Firebase manages |
| Company settings | ~10 KB | Firestore Cache | On change |
| Activity definitions | ~50 KB | Firestore Cache | Rarely |
| Sites list | ~2 KB each | Firestore Cache | On change |

**Total**: ~1-5 MB

#### Category 3: Large Media Data
| Data Type | Size | Storage Method | Refresh |
|-----------|------|----------------|---------|
| Surveyor images | ~2-5 MB each | Expo Media Library | User-selected |
| Plant database images | ~1-3 MB each | URL-based (CDN) | On-demand |
| QR codes | ~5 KB each | Generated on-device | Real-time |

**Total**: Highly variable (10 MB - 1 GB+)

### Storage by Role

**Supervisor** (Highest Offline Need)
- User cache: All site users (~200 KB)
- Active tasks: Current shift (~250 KB)
- Activity history: Last 7 days (~500 KB)
- **Total**: ~1-2 MB

**Surveyor** (Image-Heavy)
- User cache: Self + supervisor (~2 KB)
- Assigned tasks: Current projects (~100 KB)
- Photos: User-selected (~10-50 MB)
- **Total**: ~10-50 MB

**Planner** (Data-Heavy, Less Offline)
- User cache: All supervisors (~50 KB)
- Pending requests: Current (~500 KB)
- Site data: Active sites (~100 KB)
- **Total**: ~1 MB

**Master/Admin** (Mostly Online)
- Basic user cache (~50 KB)
- **Total**: ~100 KB

---

## Priority System (P0-P3)

### P0 - Critical (Always First)
Syncs immediately when connection is available:
- Task Requests (Initial access & Add New Task)
- Activity Requests (Scope requests)
- QC Requests
- Cabling Requests
- Termination Requests
- Surveyor Requests
- Handover Requests
- Plant Allocation Requests
- Staff Requests
- Logistics Requests
- Concrete Requests
- Commissioning Requests

**Budget**: 250 KB burst limit

### P1 - Messages (High Priority)
- Message cards
- Comments and notes
- Notifications

### P2 - Production (Medium Priority)
- Completed Today updates
- Activity progress data
- Production capture

### P3 - Heavy Data (Low Priority)
- Survey images
- Timesheet data
- Plant hours
- Man hours
- Billing data

**Full Sync Budget**: 2 MB

---

## Data Freshness System

### 1. Real-time Listeners (Auto-Update)

**When online**, sets up Firestore `onSnapshot` listeners that:
- Detect Firebase changes automatically
- Update AsyncStorage with fresh data
- Invalidate React Query cache
- Trigger UI refresh

**Example:**
```typescript
import { dataFreshnessManager } from '@/utils/dataFreshnessSync';

const listenerKey = await dataFreshnessManager.subscribeToDocument(
  'activities',
  activityId,
  '@cached_activity_key',
  async (data, timestamp) => {
    console.log('Firebase updated! Auto-syncing');
  }
);
```

### 2. Timestamp-Based Freshness Check

Compares `updatedAt` timestamps from Firebase vs AsyncStorage:

```typescript
const result = await dataFreshnessManager.getFreshestData({
  firebaseData: firebaseActivity,
  firebaseTimestamp: firebaseActivity.updatedAt,
  asyncStorageKey: '@cached_activity_123',
  preferSource: 'firebase',
});

console.log('Using data from:', result.source); // 'firebase' or 'asyncstorage'
console.log('Is fresh:', result.isFresh);
```

**Logic:**
```
IF only Firebase has data → Use Firebase
ELSE IF only AsyncStorage has data → Use AsyncStorage
ELSE IF both have data:
  IF Firebase timestamp > AsyncStorage timestamp → Use Firebase
  ELSE IF AsyncStorage timestamp > Firebase timestamp → Use AsyncStorage (pending sync)
  ELSE → Use Firebase (default)
```

### 3. P0 Sync Completion Notifications

When P0 sync completes:
1. Notification created automatically
2. Banner slides in from top
3. Shows: "Task request synced to server - Pull to refresh"
4. User can dismiss or tap refresh

**Implementation:**
```typescript
// Automatic (in offlineQueue.ts)
if (item.priority === 'P0') {
  await dataFreshnessManager.notifyP0SyncComplete({
    entityType: 'taskRequest',
    entityId: taskId,
    message: 'Task request synced to server',
  });
}
```

---

## Offline Authentication

### User Cache System

**Purpose**: Enable offline QR code scanning and PIN validation

**Implementation:**
```typescript
import { precacheUsers } from '@/utils/userCache';

// Cache all site users (called on login)
await precacheUsers(user.siteId);
```

**Features:**
- 24-hour cache duration
- Automatic refresh when stale
- Encrypted PIN storage
- Supports offline QR authentication

---

## User Controls

### Offline Banner Features

When pending changes exist, users see:

1. **Auto Sync** (Default)
   - Triggers automatically when online
   - Uses 250KB burst budget
   - Syncs P0 first

2. **"Sync Options" Button**
   - Opens modal with queue breakdown
   - Shows P0/P1/P2/P3 counts
   - Provides manual sync controls

3. **"Sync Critical Only"**
   - For weak signal areas
   - Syncs only P0 items
   - Ensures work-unlocking data gets through

4. **"Sync Everything"**
   - For good WiFi connections
   - Uses 2MB burst budget
   - Syncs all priorities

5. **Failed Items Management**
   - "Retry" button: Retries failed syncs
   - "Clear" button: Removes failed items

---

## Usage Examples

### Queuing Offline Operations

```typescript
import { queueFirestoreOperation } from '@/utils/offlineQueue';

// Example 1: Task request
await queueFirestoreOperation({
  type: 'add',
  collection: 'requests',
  data: requestData
}, {
  priority: 'P0',
  entityType: 'taskRequest'
});

// Example 2: Progress update
await queueFirestoreOperation({
  type: 'update',
  collection: 'activities',
  docId: activityId,
  data: { completedToday: 50 }
}, {
  priority: 'P2',
  entityType: 'progressUpdate'
});

// Example 3: Image upload
await queueFirestoreOperation({
  type: 'add',
  collection: 'images',
  data: imageData
}, {
  priority: 'P3',
  entityType: 'image'
});
```

### Using Fresh Data Hook

```typescript
import { useFreshActivityData } from '@/utils/hooks/useFreshActivityData';

export default function ActivityDetailScreen() {
  const { activityId } = useLocalSearchParams();
  
  const { activity, source, isFresh, isLoading, forceRefresh } = 
    useFreshActivityData(activityId);
  
  console.log('Data source:', source);
  console.log('Is fresh:', isFresh);
  
  return (
    <ScrollView
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={forceRefresh} />
      }
    >
      {/* Content */}
    </ScrollView>
  );
}
```

---

## Scenarios

### Scenario 1: Supervisor in Field (Weak Signal)
```
1. Supervisor submits QC request
2. Request queued locally (P0 priority)
3. Banner shows: "Offline Mode • 1 pending"
4. Signal returns → Request syncs immediately
5. Planner receives notification
6. Supervisor sees confirmation
```

### Scenario 2: Entering Progress Data
```
1. Supervisor updates "Completed Today" values
2. Data queued locally (P2 priority)
3. Supervisor continues working
4. Signal improves → Progress data syncs
5. Dashboard updates automatically
```

### Scenario 3: Mixed Connection (In and Out)
```
1. Supervisor submits 5 requests throughout day
2. Connection drops → All queued locally
3. Connection returns briefly → P0 items sync first
4. Connection drops again → Remaining items queued
5. At camp (good WiFi) → User taps "Sync Everything"
6. All remaining items sync successfully
```

### Scenario 4: Data Modified on Server While Offline
```
1. User offline, viewing activity from AsyncStorage
2. Planner changes scope on server
3. User goes online
4. Real-time listener detects change
5. Updates AsyncStorage automatically
6. UI refreshes with new data
```

---

## Monitoring & Debugging

### Check Sync Status
```typescript
import { offlineQueue } from '@/utils/offlineQueue';

const status = offlineQueue.getSyncStatus();
console.log('Pending:', status.pendingCount);
console.log('Failed:', status.failedCount);
console.log('Last sync:', status.lastSyncTime);
```

### Check Queued Items
```typescript
const items = offlineQueue.getQueuedItems();
console.log('Queue:', items);
```

### Force Sync
```typescript
// Sync all priorities
await offlineQueue.syncQueue('full');

// Sync critical only
await offlineQueue.syncQueue('critical');
```

### Clear Failed Items
```typescript
await offlineQueue.clearFailedItems();
```

---

## Storage Management

### Monitor Storage Usage
```typescript
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Get AsyncStorage size
const keys = await AsyncStorage.getAllKeys();
let totalSize = 0;
for (const key of keys) {
  const item = await AsyncStorage.getItem(key);
  totalSize += item?.length || 0;
}
console.log('AsyncStorage:', totalSize / 1024 / 1024, 'MB');

// Get cache directory size
const cacheInfo = await FileSystem.getInfoAsync(
  FileSystem.cacheDirectory || ''
);
console.log('Cache:', (cacheInfo.size || 0) / 1024 / 1024, 'MB');
```

### Clear Old Cache
```typescript
// utils/storageManager.ts
export async function clearOldCache(maxAgeDays: number = 30) {
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) return;
  
  const files = await FileSystem.readDirectoryAsync(cacheDir);
  const now = Date.now();
  
  for (const file of files) {
    const fileInfo = await FileSystem.getInfoAsync(cacheDir + file);
    if (fileInfo.exists && fileInfo.modificationTime) {
      const ageMs = now - fileInfo.modificationTime * 1000;
      if (ageMs > maxAgeDays * 24 * 60 * 60 * 1000) {
        await FileSystem.deleteAsync(cacheDir + file);
      }
    }
  }
}
```

---

## Configuration

### Enable/Disable Features

```typescript
// Current configuration (in offlineQueue.ts)
OFFLINE_CONFIG = {
  ENABLE_OFFLINE_SYNC: true,      // ✅ ON
  ENABLE_USER_CACHE: true,        // ✅ ON
  ENABLE_OFFLINE_QUEUE: true,     // ✅ ON
  ENABLE_FULL_DATA_CACHE: false,  // ⚠️ OFF (performance)
}
```

---

## Testing

### Test Checklist

- [ ] **P0 Sync Notification**: Go offline → Request task → Go online → Banner appears
- [ ] **Real-time Update**: Open activity (online) → Change on server → Auto-updates
- [ ] **Timestamp Comparison**: Go offline → Make change → Go online → Uses newer data
- [ ] **Offline QR Scan**: Go offline → Scan QR code → Authentication works
- [ ] **Queue Persistence**: Queue items offline → Close app → Reopen → Items still queued
- [ ] **Priority Sync**: Queue P0 and P3 items → Go online → P0 syncs first
- [ ] **Failed Retry**: Force sync failure → Retry button works
- [ ] **Storage Management**: Monitor storage usage → Clear cache → Space freed

---

## Key Benefits

✅ **Always Fresh Data** - Users see newest information automatically  
✅ **Auto-Sync** - Real-time listeners update data without user action  
✅ **Smart Comparison** - Timestamp logic ensures correct data source  
✅ **User Awareness** - Banner informs users of background sync  
✅ **Offline-First** - Works seamlessly offline with graceful online sync  
✅ **Priority System** - Critical operations sync first  
✅ **Performance** - Minimal overhead, runs in background  
✅ **Reliable** - Retry logic with exponential backoff  

---

## Related Files

**Core System:**
- `utils/offlineQueue.ts` - Queue implementation
- `utils/userCache.ts` - User caching
- `utils/dataFreshnessSync.ts` - Freshness manager
- `utils/hooks/useOfflineStatus.ts` - Status hook
- `utils/hooks/useFreshActivityData.ts` - Fresh data hook

**UI Components:**
- `components/OfflineBanner.tsx` - Banner UI
- `components/FloatingSyncIndicator.tsx` - Floating indicator
- `components/FreshnessNotificationBanner.tsx` - Notification banner

**Archived Docs:**
- `OFFLINE_STORAGE_STRATEGY.md` (archived)
- `OFFLINE_SYSTEM_RESTORED.md` (archived)
- `DATA_FRESHNESS_SYSTEM.md` (archived)
- `DATA_FRESHNESS_COMPLETE_SUMMARY.md` (archived)
- `OFFLINE_AUTHENTICATION_SYSTEM.md` (archived)
- `OFFLINE_EMPLOYEE_CACHING.md` (archived)
- `OFFLINE_TIMESHEET_IMPLEMENTATION.md` (archived)
- `OFFLINE_LOCK_CHECK_IMPLEMENTATION.md` (archived)

---

**Last Updated:** 2025-01-23  
**Status:** Complete and production-ready
