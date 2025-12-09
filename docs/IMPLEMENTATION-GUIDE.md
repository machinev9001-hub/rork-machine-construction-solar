# Implementation Guide

## Overview
This document consolidates implementation notes and guides for specific features.

---

## Dashboard & Reporting

### BOQ (Bill of Quantities) System

**Purpose:** Track quantities, calculate progress, export data

**Key Features:**
- BOQ entries per activity
- Unit conversion system
- Progress calculation
- Export to Excel/CSV

**Database Structure:**
```typescript
interface BOQEntry {
  id: string;
  siteId: string;
  activityName: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  createdAt: Timestamp;
}
```

**Unit Conversion:**
```typescript
import { convertUnit } from '@/utils/unitConversion';

const result = convertUnit(100, 'meters', 'kilometers');
// result: 0.1
```

**Export Implementation:**
```typescript
import { exportDashboardData } from '@/utils/exportData';

await exportDashboardData(siteId, {
  format: 'excel',
  includeProgress: true,
  includeBOQ: true
});
```

**Related Files:**
- `app/master-boq.tsx` - BOQ management screen
- `app/master-dashboard.tsx` - Main dashboard
- `utils/exportData.ts` - Export utilities
- `utils/unitConversion.ts` - Unit conversion
- `constants/units.ts` - Unit definitions

---

## Progress Tracking

### Per-User Progress System

**Purpose:** Track progress per supervisor/employee

**How It Works:**
```
Activity has total scope (e.g., 1000 meters)
  ↓
Multiple supervisors work on it
  ↓
Each supervisor enters completedToday
  ↓
System aggregates per-user totals
  ↓
Dashboard shows:
  - Total progress (all users)
  - Per-user breakdown
  - Remaining work
```

**Implementation:**
```typescript
import { calculatePerUserProgress } from '@/utils/progressCalculations';

const progress = await calculatePerUserProgress(activityId);
// Returns:
// {
//   totalCompleted: 850,
//   users: [
//     { userId: 'user1', name: 'John', completed: 500 },
//     { userId: 'user2', name: 'Jane', completed: 350 }
//   ],
//   remaining: 150
// }
```

**Related Files:**
- `app/per-user-progress.tsx` - Per-user progress view
- `app/user-progress-detail.tsx` - User detail view
- `utils/progressCalculations.ts` - Progress utilities

---

## Plant Asset Management

### Plant Asset Allocation System

**Purpose:** Allocate plant/equipment to sites, track usage, manage operators

**Key Features:**
- Asset creation and management
- Site allocation
- Operator assignment
- Hours tracking (asset + operator)
- Timesheet generation

**Database Structure:**
```typescript
interface PlantAsset {
  id: string;
  companyId: string;
  masterAccountId: string;
  siteId?: string;
  name: string;
  type: string;
  registrationNumber: string;
  allocationStatus: 'UNALLOCATED' | 'ALLOCATED';
  currentOperatorId?: string;
  createdAt: Timestamp;
}

interface PlantAssetHours {
  id: string;
  assetId: string;
  operatorId: string;
  siteId: string;
  date: string; // YYYY-MM-DD
  hoursWorked: number;
  createdAt: Timestamp;
}
```

**Allocation Flow:**
```
Master/Plant Manager
  ↓ Creates asset
  ↓ Asset status: UNALLOCATED
  ↓ Allocates to site
  ↓ Asset status: ALLOCATED
  ↓ Assigns operator
  ↓ Operator can log hours
```

**Hours Tracking:**
```typescript
// Asset hours (total hours the asset worked)
interface PlantAssetHoursEntry {
  assetId: string;
  date: string;
  totalHours: number;
}

// Operator man-hours (hours the operator worked on the asset)
interface OperatorManHours {
  operatorId: string;
  assetId: string;
  date: string;
  hoursWorked: number;
}
```

**Related Files:**
- `app/master-plant-manager.tsx` - Plant management
- `app/plant-allocation-requests.tsx` - Allocation requests
- `app/plant-asset-operator-change.tsx` - Operator assignment
- `app/operator-hours-dashboard.tsx` - Hours dashboard
- `components/PlantAssetHoursTimesheet.tsx` - Asset hours timesheet
- `components/OperatorManHoursTimesheet.tsx` - Operator hours timesheet
- `utils/timesheetExport.ts` - Timesheet export

---

## Onboarding System

### Employee & Asset Onboarding

**Purpose:** Onboard employees and assets with checklists and inductions

**Flow:**
```
Master/Admin
  ↓ Adds employee
  ↓ Assigns to site
  ↓ Generates QR code for employee
  ↓ Employee scans QR to activate
  ↓ Sets up PIN
  ↓
  ↓ Adds asset (vehicle, equipment, etc.)
  ↓ Creates checklist for asset
  ↓ Assigns responsible person
  ↓ Checklist completed daily/weekly
```

**Asset Checklist System:**
```typescript
interface AssetChecklist {
  assetId: string;
  checklistItems: ChecklistItem[];
  completedBy?: string;
  completedAt?: Timestamp;
  status: 'pending' | 'completed';
}

interface ChecklistItem {
  id: string;
  title: string;
  checked: boolean;
  notes?: string;
}
```

**Templates:**
```typescript
// constants/assetChecklistTemplate.ts
export const VEHICLE_CHECKLIST = [
  { title: 'Check tire pressure', category: 'Safety' },
  { title: 'Check oil level', category: 'Maintenance' },
  { title: 'Inspect brakes', category: 'Safety' },
  { title: 'Check lights', category: 'Safety' },
  { title: 'Clean vehicle', category: 'General' }
];
```

**Related Files:**
- `app/onboarding-dashboard.tsx` - Onboarding dashboard
- `app/onboarding-employees.tsx` - Employee list
- `app/onboarding-employee-detail.tsx` - Employee detail
- `app/add-employee.tsx` - Add employee
- `app/add-asset.tsx` - Add asset
- `app/onboarding-assets.tsx` - Asset list
- `app/onboarding-asset-detail.tsx` - Asset detail with checklist
- `app/onboarding-messages.tsx` - Induction messages
- `components/AssetChecklistCard.tsx` - Checklist UI
- `constants/assetChecklistTemplate.ts` - Checklist templates

---

## PV Blocks System

### Purpose
Track solar PV block installations and progress

**Database Structure:**
```typescript
interface PVBlock {
  id: string;
  siteId: string;
  blockName: string;
  totalPanels: number;
  installedPanels: number;
  status: 'pending' | 'in_progress' | 'completed';
  assignedTo?: string;
  createdAt: Timestamp;
}
```

**Export:**
```typescript
import { exportPVBlockData } from '@/utils/exportData';

await exportPVBlockData(siteId);
```

**Related Files:**
- `app/master-pv-blocks.tsx` - PV blocks management

---

## Multi-Tenant & Company Management

### Industry Sector System

**Purpose:** Categorize companies by industry for better filtering and features

**Supported Sectors:**
1. Construction & Civils
2. Mining
3. Manufacturing
4. Oil & Gas
5. Renewable Energy
6. Infrastructure
7. Transportation & Logistics
8. Agriculture
9. Marine & Maritime
10. Telecommunications
11. Water & Utilities
12. Forestry
13. Healthcare Facilities
14. Real Estate Development
15. Aviation

**Implementation:**
```typescript
// constants/industrySectors.ts
export const INDUSTRY_SECTORS = [
  'Construction & Civils',
  'Mining',
  // ... etc
];

// Company creation
const company = {
  legalEntityName: 'ABC Construction',
  industrySector: 'Construction & Civils', // Required!
  // ... other fields
};
```

**Benefits:**
- Enables industry-specific features (e.g., Plant Hire Pool for construction)
- Better reporting and analytics
- Targeted feature rollouts

**Related Files:**
- `constants/industrySectors.ts` - Sector definitions
- `app/company-setup.tsx` - Company creation with sector selection
- `app/company-selector.tsx` - Company selector

---

## Theme & UI

### Background System

**Issue:** Generic white backgrounds

**Solution:** Dynamic themed backgrounds

**Implementation:**
```typescript
import { LinearGradient } from 'expo-linear-gradient';

<LinearGradient
  colors={['#1a1a2e', '#16213e', '#0f3460']}
  style={styles.container}
>
  {/* Content */}
</LinearGradient>
```

**Theme Colors:**
```typescript
// constants/colors.ts
export const Colors = {
  primary: '#3b82f6',
  secondary: '#8b5cf6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  
  background: {
    light: '#ffffff',
    dark: '#1a1a2e',
    gradient: ['#1a1a2e', '#16213e', '#0f3460']
  }
};
```

---

## Refactoring & Architecture

### Modular Architecture

**Principles:**
1. **Separation of Concerns** - Split large files into smaller, focused modules
2. **Reusable Components** - Extract common UI into components
3. **Custom Hooks** - Encapsulate logic in hooks
4. **Utility Functions** - Centralize business logic

**Example Refactor:**

**Before:**
```typescript
// 500-line activity-detail.tsx with everything
```

**After:**
```typescript
// activity-detail.tsx (150 lines)
import { useTaskProgress } from '@/utils/hooks/useTaskProgress';
import { useActivityManagement } from '@/utils/hooks/useActivityManagement';
import ActivityCard from '@/components/ActivityCard';
import CompletedTodayInput from '@/components/CompletedTodayInput';

export default function ActivityDetail() {
  const { progress, updateProgress } = useTaskProgress(activityId);
  const { activity, requestScope } = useActivityManagement(activityId);
  
  return (
    <ScrollView>
      <ActivityCard activity={activity} />
      <CompletedTodayInput
        activityId={activityId}
        onSubmit={updateProgress}
      />
    </ScrollView>
  );
}
```

**Custom Hooks Created:**
- `utils/hooks/useTaskManagement.ts` - Task CRUD operations
- `utils/hooks/useActivityManagement.ts` - Activity CRUD operations
- `utils/hooks/useActivityRequests.ts` - Request workflows
- `utils/hooks/useTaskProgress.ts` - Progress calculations
- `utils/hooks/useToggleState.ts` - Toggle state management
- `utils/hooks/useButtonProtection.ts` - Prevent double-taps
- `utils/hooks/useSyncOnFocus.ts` - Sync data on screen focus

**Reusable Components:**
- `components/RequestCard.tsx` - Generic request card
- `components/StatusBadge.tsx` - Status indicators
- `components/TaskDetailRow.tsx` - Task info row
- `components/ActionButtons.tsx` - Common action buttons
- `components/TaskHeader.tsx` - Task header
- `components/TaskInfoCard.tsx` - Task info display
- `components/ActivityCard.tsx` - Activity display
- `components/CompletedTodayInput.tsx` - Progress input
- `components/HistoryScrollView.tsx` - Progress history

---

## Performance Optimization

### Optimization Strategies

**1. Memoization**
```typescript
import { useMemo } from 'react';

const sortedData = useMemo(() => {
  return data.sort((a, b) => b.createdAt - a.createdAt);
}, [data]);
```

**2. React Query Caching**
```typescript
import { useQuery } from '@tanstack/react-query';

const { data } = useQuery({
  queryKey: ['tasks', siteId],
  queryFn: () => fetchTasks(siteId),
  staleTime: 5 * 60 * 1000, // 5 minutes
  cacheTime: 10 * 60 * 1000, // 10 minutes
});
```

**3. Virtualized Lists**
```typescript
import { FlashList } from '@shopify/flash-list';

<FlashList
  data={items}
  renderItem={({ item }) => <ItemCard item={item} />}
  estimatedItemSize={100}
/>
```

**4. Image Optimization**
```typescript
import { Image } from 'expo-image';

<Image
  source={{ uri: imageUrl }}
  placeholder={blurhash}
  contentFit="cover"
  transition={200}
/>
```

**5. Debouncing**
```typescript
import { useDebouncedCallback } from 'use-debounce';

const debouncedSearch = useDebouncedCallback((text) => {
  performSearch(text);
}, 300);
```

---

## Debugging & Analytics

### Debug System

**Purpose:** Track errors, performance, and user actions

**Implementation:**
```typescript
import { logEvent, logError, logPerformance } from '@/utils/analytics';
import { debugLog, debugWarn, debugError } from '@/utils/debugHelpers';

// Analytics
logEvent('task_created', { taskId, supervisorId });
logError(error, { context: 'task_creation' });
logPerformance('task_load_time', startTime, endTime);

// Debug logs (removed in production)
debugLog('Task loaded:', task);
debugWarn('Slow query detected');
debugError('Failed to load data', error);
```

**Debug Screen:**
```
/debug-info
Shows:
- App version
- Device info
- Network status
- Cache sizes
- Error logs
- Performance metrics
```

**Related Files:**
- `utils/analytics.ts` - Analytics utilities
- `utils/debugHelpers.ts` - Debug logging
- `app/debug-info.tsx` - Debug info screen

---

## Environment & Configuration

### Environment Setup

**Required Environment Variables:**
```bash
# Firebase Configuration
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id

# AI Toolkit (if using AI features)
EXPO_PUBLIC_TOOLKIT_URL=https://toolkit.rork.com
```

**Setup:**
1. Copy `env.example` to `.env`
2. Fill in your values
3. Run `./verify-env.sh` to validate

**Related Files:**
- `env.example` - Example environment file
- `verify-env.sh` - Validation script
- `ENV_SETUP_GUIDE.md` - Detailed setup guide (archived)

---

## Related Files & Documentation

**Archived Implementation Docs:**
- `MODULAR_ARCHITECTURE_GUIDE.md` - Architecture patterns
- `REFACTORING_SUMMARY.md` - Refactoring notes
- `REFACTORING_2025.md` - 2025 refactor
- `PERFORMANCE_OPTIMIZATION_2025.md` - Optimization guide
- `OPTIMIZATION_COMPLETE_SUMMARY.md` - Optimization results
- `BOQ_UNIT_CONVERSION_SYSTEM.md` - Unit conversion details
- `DASHBOARD_EXPORT_IMPLEMENTATION.md` - Export features
- `PV_BLOCK_EXPORT_IMPLEMENTATION.md` - PV export
- `INDUSTRY-SECTOR-IMPLEMENTATION.md` - Industry sectors
- `PLANT_ASSET_FIX_SUMMARY.md` - Plant asset fixes
- `OPERATOR_ASSET_HOURS_IMPLEMENTATION.md` - Hours tracking
- `THEME_BACKGROUND_FIX.md` - UI improvements

---

**Last Updated:** 2025-01-23  
**Status:** Complete and production-ready
