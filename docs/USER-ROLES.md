# User Roles & Permissions

> **⚠️ NOTICE: This file has been consolidated into [USER-GUIDE.md](./USER-GUIDE.md)**  
> Please refer to the new consolidated documentation for the most up-to-date information.  
> This file is kept for reference but may not be maintained going forward.

## Overview

The Project Tracker system implements role-based access control (RBAC) with nine distinct user roles. Each role has specific permissions and capabilities within the system.

---

## Role Hierarchy

```
Master User (System Owner)
    ├── Admin
    │   ├── Plant Manager
    │   ├── Staff Manager
    │   └── Logistics Manager
    ├── Planner
    │   └── Supervisor
    │       ├── QC
    │       └── Surveyor
    └── Operator
```

---

## Role Definitions

### Master User
**Level:** System Owner

**Primary Functions:**
- Complete system administration
- Company profile management
- User creation and management
- System configuration
- Full access to all features

**Permissions:**
- ✅ Manage company settings
- ✅ Add/edit/delete users
- ✅ Generate QR codes
- ✅ View all projects and tasks
- ✅ Access all reports
- ✅ Configure system settings
- ✅ Manage subscriptions/billing

**Key Screens:**
- Login
- Settings
- Company Settings
- Manage Users
- Add User
- All role-specific screens

---

### 1. Admin
**Level:** Senior Management

**Primary Functions:**
- Full operational control
- User management (limited)
- Project oversight
- System reports

**Permissions:**
- ✅ View all projects
- ✅ Edit all tasks
- ✅ Manage team members
- ✅ Generate reports
- ✅ Approve critical actions
- ✅ Access analytics
- ❌ Modify company settings
- ❌ Add/remove Master Users

**Restrictions:**
- Cannot modify master company settings
- Cannot delete Master User accounts

---

### 2. Planner
**Level:** Management

**Primary Functions:**
- Project planning
- Task creation and assignment
- Resource scheduling
- Timeline management

**Permissions:**
- ✅ Create projects
- ✅ Create and assign tasks
- ✅ Set deadlines
- ✅ Allocate resources
- ✅ View project timelines
- ✅ Generate planning reports
- ❌ Delete projects
- ❌ Manage users

**Restrictions:**
- Cannot delete projects (only Admin+)
- Cannot modify user permissions
- Cannot access financial data

---

### 3. Supervisor
**Level:** Management

**Primary Functions:**
- Team supervision
- Progress monitoring
- Task approval
- Performance tracking

**Permissions:**
- ✅ View assigned projects
- ✅ Monitor team tasks
- ✅ Approve task completions
- ✅ Update task status
- ✅ Submit progress reports
- ✅ Communicate with team
- ❌ Create new projects
- ❌ Modify project scope

**Restrictions:**
- Limited to assigned projects
- Cannot create new projects
- Cannot modify company-level settings

---

### 4. QC (Quality Control)
**Level:** Specialist

**Primary Functions:**
- Quality inspections
- Compliance checking
- Issue identification
- Approval workflows

**Permissions:**
- ✅ Perform inspections
- ✅ Create QC reports
- ✅ Flag issues
- ✅ Approve/reject work
- ✅ Upload inspection photos
- ✅ View project specifications
- ❌ Modify tasks
- ❌ Assign work

**Restrictions:**
- Cannot modify task assignments
- Cannot delete QC records
- View-only access to non-QC tasks

---

### 5. Operator
**Level:** Field Worker

**Primary Functions:**
- Task execution
- Progress updates
- Time tracking
- Equipment operation

**Permissions:**
- ✅ View assigned tasks
- ✅ Update task progress
- ✅ Upload photos/documents
- ✅ Log time
- ✅ Report issues
- ✅ Check in/out via QR
- ❌ Create tasks
- ❌ View other users' tasks

**Restrictions:**
- Can only see assigned tasks
- Cannot modify assignments
- Cannot access project planning
- Limited to own time logs

---

### 6. Plant Manager
**Level:** Management

**Primary Functions:**
- Equipment management
- Resource optimization
- Maintenance scheduling
- Performance monitoring

**Permissions:**
- ✅ Manage equipment
- ✅ Schedule maintenance
- ✅ Allocate machinery
- ✅ View equipment reports
- ✅ Track utilization
- ✅ Approve equipment requests
- ❌ Modify project timelines
- ❌ Manage staff

**Restrictions:**
- Limited to equipment/resource management
- Cannot modify HR data
- Cannot access financial planning

---

### 7. Surveyor
**Level:** Specialist

**Primary Functions:**
- Site surveys
- Measurements
- Technical documentation
- Drawing management

**Permissions:**
- ✅ Create survey reports
- ✅ Upload measurements
- ✅ Attach technical drawings
- ✅ Update site data
- ✅ Flag discrepancies
- ✅ View project specifications
- ❌ Modify project scope
- ❌ Assign tasks

**Restrictions:**
- Cannot modify project timelines
- Cannot assign work to others
- View-only access to non-survey data

---

### 8. Staff Manager
**Level:** Management

**Primary Functions:**
- Personnel management
- Attendance tracking
- Team coordination
- Leave management

**Permissions:**
- ✅ View team members
- ✅ Track attendance
- ✅ Approve leave requests
- ✅ Manage schedules
- ✅ View team performance
- ✅ Generate HR reports
- ❌ Modify salaries
- ❌ Access company financials

**Restrictions:**
- Cannot access financial data
- Cannot modify user roles
- Limited to HR-related functions

---

### 9. Logistics Manager
**Level:** Management

**Primary Functions:**
- Material management
- Supply chain coordination
- Delivery scheduling
- Inventory tracking

**Permissions:**
- ✅ Manage materials
- ✅ Schedule deliveries
- ✅ Track inventory
- ✅ Create purchase requests
- ✅ Coordinate suppliers
- ✅ Generate logistics reports
- ❌ Approve purchases over limit
- ❌ Modify project budgets

**Restrictions:**
- Cannot approve high-value purchases (Admin needed)
- Cannot modify project budgets
- Limited to logistics domain

---

## Permission Matrix

| Feature | Master | Admin | Planner | Supervisor | QC | Operator | Plant Mgr | Surveyor | Staff Mgr | Logistics Mgr |
|---------|--------|-------|---------|------------|----|----|-----------|----------|-----------|---------------|
| Company Settings | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage Users | ✅ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ | ❌ |
| Create Projects | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Assign Tasks | ✅ | ✅ | ✅ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Complete Tasks | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ |
| QC Inspections | ✅ | ✅ | ⚠️ | ⚠️ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View All Projects | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ❌ | ⚠️ | ⚠️ | ⚠️ | ⚠️ |
| Generate Reports | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ❌ | ✅ | ⚠️ | ✅ | ✅ |
| Manage Equipment | ✅ | ✅ | ⚠️ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Manage Materials | ✅ | ✅ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| HR Functions | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

**Legend:**
- ✅ Full Access
- ⚠️ Limited Access (based on assignments/domain)
- ❌ No Access

---

## Access Control Implementation

### Database Level
```typescript
// Example Firestore rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Companies - Master User only
    match /companies/{companyId} {
      allow read: if request.auth != null;
      allow write: if request.auth.token.role == 'Master';
    }
    
    // Users - Master User and limited Admin
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.token.role in ['Master', 'Admin'];
      allow update: if request.auth.uid == userId; // Users can update own profile
    }
    
    // Projects - Role-based
    match /projects/{projectId} {
      allow read: if request.auth != null && 
                     (request.auth.token.role in ['Master', 'Admin', 'Planner'] ||
                      resource.data.assignedUsers.hasAny([request.auth.uid]));
      allow create: if request.auth.token.role in ['Master', 'Admin', 'Planner'];
      allow update: if request.auth.token.role in ['Master', 'Admin', 'Planner', 'Supervisor'];
      allow delete: if request.auth.token.role in ['Master', 'Admin'];
    }
    
    // Tasks - Based on assignment
    match /tasks/{taskId} {
      allow read: if request.auth != null &&
                     (request.auth.token.role in ['Master', 'Admin', 'Planner', 'Supervisor'] ||
                      request.auth.uid == resource.data.assignedTo ||
                      request.auth.uid == resource.data.createdBy);
      allow create: if request.auth.token.role in ['Master', 'Admin', 'Planner'];
      allow update: if request.auth.token.role in ['Master', 'Admin', 'Planner', 'Supervisor'] ||
                       request.auth.uid == resource.data.assignedTo;
      allow delete: if request.auth.token.role in ['Master', 'Admin'];
    }
  }
}
```

### Application Level
```typescript
// Role checking utility
export function hasPermission(userRole: Role, action: string, resource: string): boolean {
  const permissions = {
    Master: ['all'],
    Admin: ['read:all', 'write:projects', 'write:tasks', 'read:users'],
    Planner: ['read:projects', 'write:projects', 'write:tasks'],
    Supervisor: ['read:projects', 'update:tasks'],
    QC: ['read:projects', 'write:qc'],
    Operator: ['read:own_tasks', 'update:own_tasks'],
    // ... etc
  };
  
  return permissions[userRole]?.includes(action) || 
         permissions[userRole]?.includes('all');
}
```

---

## Role Assignment Guidelines

### When to Assign Each Role

**Master User:**
- Company owner
- System administrator
- One per company (primary)

**Admin:**
- Senior project managers
- Operations directors
- 2-3 per company

**Planner:**
- Project planners
- Project coordinators
- As needed per project

**Supervisor:**
- Site supervisors
- Team leaders
- One per site/team

**QC:**
- Quality control inspectors
- Safety officers
- As needed for compliance

**Operator:**
- Field workers
- Equipment operators
- Most numerous role

**Plant Manager:**
- Equipment manager
- 1-2 per company

**Surveyor:**
- Land surveyors
- Technical surveyors
- As needed

**Staff Manager:**
- HR manager
- 1 per company

**Logistics Manager:**
- Supply chain manager
- 1-2 per company

---

Last Updated: January 2025
