# User Guide - Project Tracker System

## Table of Contents
1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [User Roles & Permissions](#user-roles--permissions)
4. [Master User Functions](#master-user-functions)
5. [Planner Functions](#planner-functions)
6. [Supervisor Functions](#supervisor-functions)
7. [QC Inspector Functions](#qc-inspector-functions)
8. [Surveyor Functions](#surveyor-functions)
9. [Other Role Functions](#other-role-functions)
10. [Activities & Tasks](#activities--tasks)
11. [Request Workflows](#request-workflows)
12. [Messaging & Notifications](#messaging--notifications)
13. [Common Tasks](#common-tasks)
14. [Troubleshooting](#troubleshooting)

---

## Introduction

The Project Tracker system is a comprehensive project management solution designed for managing construction projects, teams, and workflows. The system supports multiple user roles with specific permissions and capabilities.

---

## Getting Started

### Master Account Setup (First Time Only)

If you are setting up the system for the first time, you need to create a Master Account:

1. Open the Project Tracker application
2. Tap "Create Master Account" button on the login screen
3. Fill in the following information:
   - **Master Name**: Your full name
   - **Master User ID**: Your login ID (e.g., 3002)
   - **PIN**: A 4-6 digit secure PIN
   - **Confirm PIN**: Re-enter the same PIN to verify
   - **Site Name**: Your project/site name (must be unique)
   - **Special Code**: Contact administrator for the special code (default: 3002)
4. Tap "Create Master Account"
5. **IMPORTANT**: Save your credentials shown on the success screen
6. Tap "OK" to proceed to login

**Important Notes:**
- Site names must be unique
- User IDs must be unique
- The PIN and Confirm PIN fields must match exactly
- You will be signed out after account creation and need to sign in using your new credentials

### Login Process

**Master User Sign-In:**
1. On the login screen, enter your **User ID**
2. The system will detect that a PIN is required
3. Enter your **PIN**
4. Tap "Sign In"
5. You will be redirected to the dashboard

**Regular User Login:**
1. Open the Project Tracker application
2. You will receive a QR code or login credentials from your Master User
3. Scan the QR code or enter your User ID
4. Enter your PIN if required
5. Complete your profile information

---

## User Roles & Permissions

The system implements role-based access control (RBAC) with nine distinct user roles.

### Role Hierarchy

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

### 1. Master User
**Level:** System Owner

**Primary Functions:**
- Complete system administration
- Company profile management
- User creation and management
- System configuration
- Theme settings control
- Full access to all features

**Permissions:**
- ✅ Manage company settings
- ✅ Add/edit/delete users
- ✅ Generate QR codes
- ✅ View all projects and tasks
- ✅ Access all reports
- ✅ Configure system settings
- ✅ Manage theme preferences

### 2. Admin
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
- ❌ Modify company settings
- ❌ Add/remove Master Users

### 3. Planner
**Level:** Management

**Primary Functions:**
- Project planning
- Task creation and assignment
- Resource scheduling
- Request approval and scheduling
- QC inspection scheduling

**Permissions:**
- ✅ Create projects
- ✅ Create and assign tasks
- ✅ Set scope values and units
- ✅ Allocate resources
- ✅ Approve/reject requests
- ✅ Schedule QC inspections
- ❌ Delete projects
- ❌ Modify user permissions

### 4. Supervisor
**Level:** Management

**Primary Functions:**
- Team supervision
- Progress monitoring
- Request creation (task, scope, QC, handover)
- Daily "Completed Today" submission
- Task progress tracking

**Permissions:**
- ✅ View assigned projects
- ✅ Submit progress reports
- ✅ Request task access
- ✅ Request activity scope
- ✅ Request QC inspections
- ✅ Request handovers
- ✅ Communicate with team
- ❌ Create new projects
- ❌ Modify project scope

### 5. QC (Quality Control)
**Level:** Specialist

**Primary Functions:**
- Quality inspections
- Compliance checking
- QC value entry
- Inspection completion

**Permissions:**
- ✅ Perform inspections
- ✅ Create QC reports
- ✅ Enter QC values
- ✅ Approve/reject work
- ✅ Upload inspection photos
- ❌ Modify tasks
- ❌ Assign work

### 6. Surveyor
**Level:** Specialist

**Primary Functions:**
- Site surveys and task execution
- Image library management
- Survey documentation
- Image sharing with team

**Permissions:**
- ✅ View assigned tasks
- ✅ Execute surveyor tasks
- ✅ Upload images to library
- ✅ Share images with team
- ✅ Mark tasks complete
- ❌ Modify project scope
- ❌ Assign tasks

### 7. Operator
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
- ❌ Create tasks
- ❌ View other users' tasks

### 8. Plant Manager
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
- ✅ Track utilization
- ❌ Modify project timelines
- ❌ Manage staff

### 9. Staff Manager
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
- ❌ Modify salaries
- ❌ Access company financials

### 10. Logistics Manager
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
- ❌ Approve high-value purchases
- ❌ Modify project budgets

### Permission Matrix

| Feature | Master | Admin | Planner | Supervisor | QC | Operator | Plant Mgr | Surveyor | Staff Mgr | Logistics Mgr |
|---------|--------|-------|---------|------------|----|----|-----------|----------|-----------|---------------|
| Company Settings | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage Users | ✅ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ | ❌ |
| Create Projects | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Assign Tasks | ✅ | ✅ | ✅ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Complete Tasks | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ |
| QC Inspections | ✅ | ✅ | ⚠️ | ⚠️ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View All Projects | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ❌ | ⚠️ | ⚠️ | ⚠️ | ⚠️ |

**Legend:** ✅ Full Access | ⚠️ Limited Access | ❌ No Access

---

## Master User Functions

Master Users have full system access and are responsible for system setup and user management.

### Company Settings

Access: **Settings → Company Settings**

#### Company Profile Setup

Configure your company's main information:

**Required Fields:**
- Legal Entity Name
- Company Alias
- Physical Address
- Contact Number
- Admin Contact Name
- Admin Email
- Company Registration Number
- VAT Number

**Steps to Setup:**
1. Navigate to Settings
2. Tap "Company Settings"
3. Expand "Company Details" section
4. Fill in all required fields
5. Tap "SAVE" button
6. Confirm the information is correct

### Theme Settings (MASTER Only)

Access: **Settings → Theme Settings**

#### Overview

The Theme Settings feature allows MASTER users to customize the visual appearance of the app across all UI modules. This powerful feature supports both global theming and per-UI theming.

**Who Can Access:** MASTER role only

#### Theme Modes

**Global Theme Mode:**
- Apply one theme across all screens
- Simplest approach for consistent branding
- Changes affect the entire application

**Per-UI Theme Mode:**
- Assign unique themes to different modules
- Customize appearance per role
- Helps users quickly identify which module they're in

#### Available Themes

**1. Default (Machine)**
- White/Black/Grey base colors
- Yellow highlight accents
- Clean, professional appearance
- Best for: General office and field use

**2. Dark Mode**
- Dark Grey/Black base colors
- Soft grey text
- Yellow or Blue accent elements
- Best for: Night shifts, low-light conditions

**3. High Contrast**
- Pure Black background
- White text
- Strong Yellow highlights
- Maximum readability
- Best for: Bright outdoor sunlight, visual accessibility

**4. Field Mode**
- Light Grey background
- Yellow highlights
- Larger text (1.2x scale)
- Best for: Outdoor field work, bright conditions

**5. Blueprint Mode**
- Machine Blue background
- White text
- Yellow buttons and accents
- Best for: Planning offices, design teams

#### How to Change Theme Settings

**Steps:**
1. Open Settings screen
2. Scroll to Master Controls section
3. Tap "Theme Settings"
4. Choose Theme Mode (Global vs Per-UI)
5. Select theme from previews
6. Theme applies instantly
7. Changes sync across all devices

### Manage Users

Access: **Settings → Manage Users**

#### Adding New Users

**Required Fields:**
- User ID (Automatically generated)
- User Role (Select from dropdown menu)

**Optional Fields:**
- Sub Contractor Name
- Legal Entity Name
- User Name
- Contact Number
- Admin Contact
- Email

**Steps to Add User:**
1. Navigate to Settings → Manage Users
2. Tap "+ ADD USER" button
3. Fill in user information (User ID is auto-generated)
4. Select User Role from dropdown
5. Fill in additional information as needed
6. Tap "SAVE" button in the header
7. Share User ID with the user securely

#### Viewing User Information

1. Scroll through the user list
2. Tap on a user block to expand it
3. View complete user information
4. Tap QR code image to view full-size

---

## Planner Functions

### Overview

Planners are responsible for project planning, task assignment, and request management. They act as the gatekeepers for work transfers and resource allocation.

### Request Management

Planners have access to multiple request types:
- Task Requests
- Activity Scope Requests
- QC Requests
- Cabling Requests
- Termination Requests
- Surveyor Requests

Each request type follows a similar pattern:
1. Review incoming requests
2. Optionally schedule the work
3. Approve or reject
4. Track in archived tab

### Approving Task Access Requests

**When to check:** When you receive task access notifications

**Steps:**
1. Open Task Requests tab
2. Review request details
3. Tap "Approve" button
4. Enter required area details:
   - PV Area (e.g., PV-A1)
   - Block Area (e.g., Block 1)
   - Special Area (optional)
5. Tap "Approve" to confirm

**What Happens:**
- Task status changes to "OPEN"
- All related activities unlock
- Supervisor receives notification

### Setting Activity Scope

**When to check:** When you receive scope request notifications

**Steps:**
1. Open Activity Scope Requests tab
2. Review activity details
3. Enter Scope Value (numeric)
4. Select Unit from pill selector (m, km, m², m³, kg, ton, qty, hours)
5. Optional: Toggle "Set Default Value for All Activities"
6. Tap "Approve"

**What Happens:**
- Scope is saved to activity
- Progress bar appears immediately
- Supervisor can track progress

### Scheduling QC Inspections

**When to check:** When you receive QC request notifications

**Steps:**
1. Open QC Requests tab → Incoming
2. Review request details
3. Tap "Schedule" button
4. Select Date using calendar picker
5. Select Time using time picker
6. Tap "Schedule" to confirm

**What Happens:**
- Request moves to Scheduled tab
- Activity shows scheduled date/time
- QC inspector receives notification

### Managing Handover Requests

**Cabling Handover Flow:**
1. Review incoming cabling requests
2. Optionally schedule with start date
3. Set cable scope (if applicable)
4. Tap "Hand Off" to approve
5. Use "Go to Task" deep link to navigate

**Termination Handover Flow:**
1. Review incoming termination requests
2. Optionally schedule with start date
3. Tap "Approve" to hand off work
4. Use "Go to Task" deep link to navigate

---

## Supervisor Functions

### Overview

Supervisors manage activities, submit progress, and coordinate with other teams through requests.

### Requesting Task Access

**When to use:** When a task is locked

**Steps:**
1. Navigate to locked task
2. Tap "Request Access" button
3. Request is sent to Planner
4. Wait for approval
5. Task unlocks when approved

### Submitting Daily Progress

**Daily Submission Workflow:**

1. Open activity card
2. First-time warning appears: "You can only submit your TOTALS once a day"
3. Enter "Completed Today" value
4. Select unit
5. Tap "Submit" button
6. Value locks and cannot be changed

**Three Ways Progress Locks:**

**Lock Type 1: Submit Button Lock**
- You tap "Submit" button
- Value locks immediately

**Lock Type 2: QC Interaction Lock**
- QC inspector submits their value
- Your value locks instantly

**Lock Type 3: Time Lock (18:00)**
- At 6:00 PM local time
- Value locks automatically

**Special Case: Late Entry (After 18:00)**
- Warning popup appears
- You can enter value ONE TIME ONLY
- Value locks immediately upon submission

### Requesting QC Inspection

**When to use:** When work is ready for quality control

**Steps:**
1. Open activity
2. Toggle "Request QC" ON
3. Request sent to Planner
4. Wait for scheduling
5. QC inspector performs inspection

### Creating Surveyor Task Requests

**When to use:** When you need surveyor documentation

**Steps:**
1. Navigate to Surveyors section
2. Fill out task request:
   - PV Area (required)
   - Block Number (required)
   - Special Area (optional)
   - Notes (optional)
3. Tap "CREATE TASK"
4. Wait for Planner approval

### Requesting Handovers

**Cabling Handover:**
- Available on cable laying activities in trenching menu
- Tap "Request for Cabling" button
- Wait for Planner to schedule and approve

**Termination Handover:**
- Available in cabling menu activities
- Tap "Request for Terminations" button
- Wait for Planner to schedule and approve

---

## QC Inspector Functions

### Performing Inspections

**When:** At scheduled date and time

**Steps:**
1. View Scheduled Inspections (Scheduled tab)
2. Navigate to site
3. Tap "Complete" button on scheduled request
4. Review work on-site
5. Enter QC value
6. Tap "Complete" to submit

**What Happens:**
- QC value is locked
- Activity status changes to "QC Completed"
- Supervisor's "Completed Today" locks immediately
- Progress bar updates

---

## Surveyor Functions

### Viewing Assigned Tasks

**Steps:**
1. Open Surveyor Tasks screen
2. Select "Approved" tab
3. Tap task card to view details
4. Navigate to task location

### Executing Tasks

**Steps:**
1. Arrive at site location
2. Perform measurements/documentation
3. Upload survey images
4. Add descriptions
5. Mark task as complete

### Using Image Library

**Features:**
- Central repository for all survey images
- Searchable and filterable
- Organized by PV Area and Block Number
- Permanent storage

**Adding Images:**
1. Tap "Add to Library"
2. Capture or select photo
3. Enter metadata (PV Area, Block, Description)
4. Tap "Save"

**Sharing Images:**
1. Select images from gallery
2. Tap "Share" button
3. Choose recipients
4. Confirm share

---

## Other Role Functions

### Operator
- View assigned tasks
- Update task progress
- Log time
- Report issues

### Plant Manager
- Manage equipment
- Schedule maintenance
- Allocate machinery
- Track utilization

### Staff Manager
- View team members
- Track attendance
- Approve leave requests
- Manage schedules

### Logistics Manager
- Manage materials
- Schedule deliveries
- Track inventory
- Create purchase requests

---

## Activities & Tasks

### Understanding Activities

Activities are work units within tasks that track specific construction operations. Each activity:
- Belongs to a specific task
- Has a defined scope (target quantity)
- Tracks daily progress
- Can request QC inspections
- May support handovers

### Task Workflow (Complete Start-to-End)

**Complete Flow:**
```
1. SUPERVISOR: Task Locked → Request Access
2. PLANNER: Review Request → Approve with Areas
3. SUPERVISOR: Task Unlocked → View Activities
4. SUPERVISOR: Submit Progress → Auto Scope Request
5. PLANNER: Set Scope + Unit
6. SUPERVISOR: Progress Visible → Submit Daily Values → Request QC
7. PLANNER: Schedule QC → Set Date/Time
8. QC INSPECTOR: Perform Inspection → Enter QC Value
9. SUPERVISOR: View Progress Bar → Historical Data
10. SYSTEM: Midnight Unlock → New Day Entry
11. SUPERVISOR: Continue Until Complete
12. ACTIVITY: Marked Complete → 100% Progress
```

### Activity Components

**Scope Block:**
- Scope value (numeric)
- Unit of measurement
- Who set the scope
- When it was set

**PV Block (Progress Value):**
- Current progress percentage
- Visual progress bar
- Completed vs scope amounts
- Color-coded indicators

**QC Block:**
- QC status badge
- Scheduled date/time
- QC value
- Unit of measurement

### Task Details Overview

The Task Details screen provides:
- **PV Area**: Displayed compactly
- **Block Number**: Next to label
- **Total Work Progress**: Overall completion percentage
- Progress calculated as average of all activities

---

## Request Workflows

### Overview

The system supports multiple request types:
- Task Requests
- Activity Scope Requests
- QC Requests
- Cabling Requests
- Termination Requests
- Surveyor Requests

### Request Status Indicators

- **PENDING** (Orange) - Waiting for review
- **PENDING_APPROVAL** (Orange) - Surveyor task awaiting approval
- **SCHEDULED** (Blue) - QC visit scheduled
- **APPROVED** (Green) - Request approved
- **REJECTED** (Red) - Request declined
- **COMPLETED** (Green) - Work finished
- **CLOSED** (Gray) - Archived

### Badge Counters

**For Planners:**
- Red badge numbers on menu tabs
- Show count of pending requests
- Update in real-time
- Clear when processed

### Automatic Request Archiving

**Archiving Rules:**
- Supervisor cancels request → Auto-archives
- Planner rejects request → Auto-archives
- Archived requests remain viewable for audit
- Badge counters only show active requests

---

## Messaging & Notifications

### Notification Types
- Request notifications
- Schedule notifications
- Completion notifications
- Status updates

### Message Status
- Pending
- Info
- Scheduled
- Completed

### Badge Indicators
- Red badges show counts
- Clear when items processed
- Real-time updates

---

## Common Tasks

### Adding a Task
1. Navigate to dashboard
2. Tap "+ ADD TASK" button
3. Fill in task details
4. Attach documents/images
5. Tap "SAVE"

### Viewing Tasks
- Your assigned tasks
- Team tasks (if supervisor/manager)
- All tasks (if admin)

### Using QR Codes
- Quick user login
- Site check-in
- Equipment tracking
- Document access

---

## Troubleshooting

### Cannot Save Information
- Ensure all required fields are filled
- Check internet connection
- Try refreshing the page

### Cannot See User Details
- Tap the user block to expand it
- Check your permissions level
- Ensure you're logged in correctly

### QR Code Not Scanning
- Ensure good lighting
- Hold device steady
- Check camera permissions
- Clean camera lens

### Theme Not Changing
- Check you're logged in as MASTER
- Ensure internet connection
- Try closing and reopening screen
- Verify Firebase connection

---

## Need Help?

Contact your system administrator or Master User for assistance with:
- Account issues
- Permission problems
- Technical difficulties
- Feature requests

---

## Tips & Best Practices

1. **Save Regularly**: Always use the SAVE button after making changes
2. **Expand for Details**: Tap blocks to expand and see full information
3. **Use Filters**: Filter large lists to find information quickly
4. **QR Codes**: Keep QR codes accessible for quick login
5. **Regular Updates**: Update task progress daily for accurate tracking
6. **Acknowledge Warnings**: Read toast warnings before submitting daily totals

---

Last Updated: January 2025
