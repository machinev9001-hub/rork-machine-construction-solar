# Database Structure & Indexes

## Overview

This document details the database collections, indexes, and data structures used in the Project Tracker system.

---

## Collections

### 1. Companies Collection

**Collection Name:** `companies`

**Purpose:** Store master company information

**Fields:**
```typescript
{
  id: string;                    // Auto-generated
  legalEntityName: string;       // Required
  alias: string;                 // Required
  address: string;               // Required
  contactNumber: string;         // Required
  adminContact: string;          // Required
  adminEmail: string;            // Required
  companyRegistrationNr: string; // Required
  vatNumber: string;             // Required
  createdAt: timestamp;
  updatedAt: timestamp;
  createdBy: string;            // User ID
}
```

**Indexes:**
- Primary: `id`
- Search: `legalEntityName`
- Search: `companyRegistrationNr`
- Search: `vatNumber`

**Index Rationale:**
- `id` - Primary key for direct lookups
- `legalEntityName` - Company search by legal name
- `companyRegistrationNr` - Verify company registration
- `vatNumber` - Tax compliance and verification

---

### 2. Users Collection

**Collection Name:** `users`

**Purpose:** Store all user accounts and credentials

**Fields:**
```typescript
{
  id: string;                    // Auto-generated
  userId: string;                // Required, unique (for login)
  email: string;                 // Required for auth
  role: UserRole;                // Required
  subContractorName?: string;
  legalEntityName?: string;
  personalContactNr?: string;
  adminContact?: string;
  adminEmail?: string;
  companyRegistrationNr?: string;
  vatNumber?: string;
  qrCode: string;               // Generated QR code data
  isActive: boolean;            // Account status
  createdAt: timestamp;
  updatedAt: timestamp;
  createdBy: string;            // Master User ID
  lastLogin?: timestamp;
}
```

**Indexes:**
- Primary: `id`
- Unique: `userId` (required for login)
- Unique: `email`
- Group by: `role`
- Group by: `isActive`
- Search: `subContractorName`
- Search: `legalEntityName`
- Composite: `role + isActive` (active users by role)
- Composite: `createdBy + role` (users created by specific master)

**Index Rationale:**
- `id` - Primary key
- `userId` - Login credential lookup (must be fast)
- `email` - Authentication and uniqueness
- `role` - Filter users by role (common operation)
- `isActive` - Filter active/inactive users
- `subContractorName` - Search by contractor
- `legalEntityName` - Search by company
- `role + isActive` - Get active users of specific role (very common)
- `createdBy + role` - Master user viewing their created users by role

**Total Indexes for Users: 9**

---

### 3. Projects Collection

**Collection Name:** `projects`

**Purpose:** Store project information

**Fields:**
```typescript
{
  id: string;
  projectName: string;
  description: string;
  startDate: timestamp;
  endDate: timestamp;
  status: 'Planning' | 'Active' | 'On Hold' | 'Completed';
  companyId: string;            // Reference to company
  createdBy: string;            // User ID
  assignedUsers: string[];      // Array of user IDs
  location: string;
  budget?: number;
  createdAt: timestamp;
  updatedAt: timestamp;
}
```

**Indexes:**
- Primary: `id`
- Group by: `companyId`
- Group by: `status`
- Group by: `createdBy`
- Array: `assignedUsers`
- Composite: `companyId + status` (company's projects by status)
- Composite: `status + startDate` (active projects chronologically)
- Date range: `startDate`
- Date range: `endDate`

**Index Rationale:**
- `id` - Primary key
- `companyId` - Get all projects for a company
- `status` - Filter by project status
- `createdBy` - Projects created by specific user
- `assignedUsers` - Find projects for specific user
- `companyId + status` - Company's active/completed projects
- `status + startDate` - Active projects sorted by start date
- `startDate/endDate` - Date range queries for scheduling

**Total Indexes for Projects: 9**

---

### 4. Tasks Collection

**Collection Name:** `tasks`

**Purpose:** Store task information

**Fields:**
```typescript
{
  id: string;
  projectId: string;            // Reference to project
  title: string;
  description: string;
  assignedTo: string;           // User ID
  createdBy: string;            // User ID
  status: 'Pending' | 'In Progress' | 'Review' | 'Completed';
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  dueDate: timestamp;
  completedDate?: timestamp;
  progress: number;             // 0-100
  attachments: string[];        // URLs
  createdAt: timestamp;
  updatedAt: timestamp;
}
```

**Indexes:**
- Primary: `id`
- Group by: `projectId`
- Group by: `assignedTo`
- Group by: `createdBy`
- Group by: `status`
- Group by: `priority`
- Composite: `projectId + status` (project's tasks by status)
- Composite: `assignedTo + status` (user's tasks by status)
- Composite: `assignedTo + dueDate` (user's tasks by due date)
- Composite: `status + priority` (pending high priority tasks)
- Date range: `dueDate`
- Date range: `completedDate`

**Index Rationale:**
- `id` - Primary key
- `projectId` - All tasks for a project
- `assignedTo` - Tasks assigned to user
- `createdBy` - Tasks created by user
- `status` - Filter by status
- `priority` - Filter by priority
- `projectId + status` - Project's pending/completed tasks
- `assignedTo + status` - User's active tasks
- `assignedTo + dueDate` - User's upcoming tasks sorted
- `status + priority` - High priority pending tasks
- `dueDate` - Upcoming deadlines
- `completedDate` - Completion tracking

**Total Indexes for Tasks: 12**

---

### 5. Activity Log Collection

**Collection Name:** `activityLog`

**Purpose:** Track all system activities and changes

**Fields:**
```typescript
{
  id: string;
  userId: string;               // Who performed the action
  action: string;               // 'create', 'update', 'delete', 'login', etc.
  entityType: string;           // 'user', 'project', 'task', etc.
  entityId: string;             // ID of affected entity
  changes?: object;             // What changed
  timestamp: timestamp;
  ipAddress?: string;
}
```

**Indexes:**
- Primary: `id`
- Group by: `userId`
- Group by: `entityType`
- Group by: `entityId`
- Composite: `userId + timestamp` (user's activities chronologically)
- Composite: `entityType + entityId` (history of specific entity)
- Date range: `timestamp`

**Index Rationale:**
- `id` - Primary key
- `userId` - All actions by a user
- `entityType` - All actions on entity type
- `entityId` - History of specific entity
- `userId + timestamp` - User's recent activities
- `entityType + entityId` - Complete history of an entity
- `timestamp` - Recent activities across system

**Total Indexes for Activity Log: 7**

---

### 6. QR Codes Collection

**Collection Name:** `qrCodes`

**Purpose:** Store generated QR codes for users and entities

**Fields:**
```typescript
{
  id: string;
  userId: string;               // Associated user
  qrData: string;               // QR code data
  qrImageUrl: string;           // Generated QR image
  type: 'user_login' | 'site_checkin' | 'equipment' | 'document';
  entityId?: string;            // Related entity if applicable
  isActive: boolean;
  createdAt: timestamp;
  expiresAt?: timestamp;
}
```

**Indexes:**
- Primary: `id`
- Unique: `qrData`
- Group by: `userId`
- Group by: `type`
- Group by: `isActive`
- Composite: `userId + type`
- Composite: `isActive + expiresAt`

**Index Rationale:**
- `id` - Primary key
- `qrData` - Fast QR code scanning lookup
- `userId` - All QR codes for a user
- `type` - QR codes by purpose
- `isActive` - Active QR codes only
- `userId + type` - User's login QR codes
- `isActive + expiresAt` - Clean up expired codes

**Total Indexes for QR Codes: 7**

---

## Summary

### Total Collections: 6
1. Companies
2. Users
3. Projects
4. Tasks
5. Activity Log
6. QR Codes

### Total Indexes: 48

**Breakdown:**
- Companies: 4 indexes
- Users: 9 indexes
- Projects: 9 indexes
- Tasks: 12 indexes
- Activity Log: 7 indexes
- QR Codes: 7 indexes

### User Role Distribution

Approximately 70% of indexes involve user grouping, role filtering, or user-related queries:
- Direct user indexes: 9 (Users collection)
- User-related in other collections: ~25

This aligns with your previous system where 90% were user/group related indexes.

---

## Index Optimization Notes

1. **Composite Indexes**: Used where two fields are frequently queried together
2. **User-Centric**: Most queries filter by user, role, or ownership
3. **Status Filtering**: Status fields are heavily indexed as they're frequently filtered
4. **Date Ranges**: Date fields indexed for chronological queries and reporting
5. **Active Records**: isActive flags indexed to filter out inactive records efficiently

---

## Future Considerations

As the system grows, consider:
1. Partitioning large collections by date
2. Archiving old completed projects
3. Cleaning up expired QR codes
4. Activity log rotation (archive old logs)
5. Adding caching layer for frequently accessed data

---

Last Updated: January 2025
