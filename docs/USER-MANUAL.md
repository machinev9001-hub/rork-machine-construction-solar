# User Manual - Project Tracker System

## Table of Contents
1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Master User Functions](#master-user-functions)
4. [User Roles](#user-roles)
5. [Supervisor Functions](#supervisor-functions)
6. [Planner Functions](#planner-functions)
7. [Activities & Tasks](#activities--tasks)
8. [Scope Management](#scope-management)
9. [QC Workflow](#qc-workflow)
10. [Request Workflows](#request-workflows)
11. [Messaging & Notifications](#messaging--notifications)
12. [Surveyor Workflow](#surveyor-workflow)
13. [Offline Mode & Network Management](#offline-mode--network-management)
14. [Common Tasks](#common-tasks)

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
5. **IMPORTANT**: Save your credentials shown on the success screen:
   - User ID: (your chosen ID)
   - PIN: (your chosen PIN)
6. Tap "OK" to proceed to login

**Important Notes:**
- Site names must be unique - you cannot use a site name that already exists
- User IDs must be unique - you cannot use a user ID that already exists
- The PIN and Confirm PIN fields must match exactly

**Note**: You will be signed out after account creation and need to sign in using your new credentials.

### Master User Sign-In Process

After creating your master account:

1. On the login screen, enter your **User ID** (e.g., 3002)
2. The system will detect that a PIN is required
3. Enter your **PIN** (e.g., 3002)
4. Tap "Sign In"
5. You will be redirected to the dashboard

**Default Master Credentials (if hard-coded)**:
- User ID: 3002
- PIN: 3002

### Regular User Login

1. Open the Project Tracker application
2. You will receive a QR code or login credentials from your Master User
3. Scan the QR code or enter your User ID
4. Enter your PIN if required
5. Complete your profile information

### Login Screen

The login screen provides:
- User ID input field
- PIN input field (appears after entering User ID)
- "Sign In" button
- "Create Master Account" button (for first-time setup)

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

The Theme Settings feature allows MASTER users to customize the visual appearance of the app across all UI modules. This powerful feature supports both global theming (one theme for all screens) and per-UI theming (unique themes for each module).

**Who Can Access:** MASTER role only

#### Theme Modes

**Global Theme Mode:**
- Apply one theme across all screens
- Simplest approach for consistent branding
- Changes affect the entire application
- All users see the same color scheme

**Per-UI Theme Mode:**
- Assign unique themes to different modules
- Customize appearance per role:
  - Supervisor screens
  - Planner screens
  - QC screens
  - Surveyor screens
  - Plant Manager screens
  - Staff Manager screens
  - Logistics Manager screens
  - Operator screens
  - Admin screens
  - Master screens
- Helps users quickly identify which module they're in
- Useful for visual role separation

#### Available Themes

**1. Default (Machine)**
- White/Black/Grey base colors
- Yellow highlight accents
- Current Machine brand identity
- Clean, professional appearance
- Best for: General office and field use

**2. Dark Mode**
- Dark Grey/Black base colors
- Soft grey text
- Yellow or Blue accent elements
- Reduced eye strain in low light
- Best for: Night shifts, indoor work, low-light conditions

**3. High Contrast**
- Pure Black background
- White text
- Strong Yellow highlights
- Maximum readability
- Larger font scale (1.1x)
- Best for: Bright outdoor sunlight, visual accessibility, users with vision impairments

**4. Field Mode**
- Light Grey background
- Yellow highlights
- Larger text (1.2x scale)
- Enhanced outdoor readability
- Best for: Outdoor field work, bright conditions, dusty/dirty screens

**5. Blueprint Mode**
- Machine Blue background
- White text
- Yellow buttons and accents
- Technical, professional look
- Best for: Planning offices, design teams, technical reviews

#### How to Change Theme Settings

**Steps:**

1. **Navigate to Theme Settings**
   - Open Settings screen
   - Scroll to Master Controls section
   - Tap "Theme Settings"

2. **Choose Theme Mode**
   - Toggle switch at top: "Global Theme" vs "Per-UI Themes"
   - OFF = Global Theme (one theme for all)
   - ON = Per-UI Themes (different themes per module)

3. **Select Theme**
   
   **For Global Mode:**
   - Scroll through theme previews
   - Each preview shows:
     - Theme name and description
     - Color sample blocks
     - Current selection indicator (✓ checkmark)
   - Tap any theme to apply immediately
   - Changes apply to all screens instantly

   **For Per-UI Mode:**
   - Each UI module has its own theme selector
   - Scroll to find module (Supervisor, Planner, etc.)
   - Tap theme preview to apply to that module
   - Changes apply only to that specific UI

4. **Preview Changes**
   - Theme applies instantly (hot-swap)
   - Navigate to different screens to see changes
   - Colors, text, buttons update immediately
   - No app restart required

5. **Changes Are Saved Automatically**
   - Selections persist in Firebase database
   - All users on site see updated themes
   - Changes sync across all devices
   - Users see new theme on next screen load

#### Theme Preview Cards

Each theme shows a preview card with:
- **Color Samples**: Three color blocks showing accent, surface, and border colors
- **Theme Name**: Bold text at top
- **Selected Indicator**: Yellow checkmark (✓) if active
- **Border Highlight**: Thick yellow border on selected theme

#### When to Use Each Mode

**Use Global Theme Mode When:**
- You want consistent branding across all screens
- Users don't need visual role separation
- Simpler to manage
- Company has specific brand guidelines

**Use Per-UI Theme Mode When:**
- You want users to quickly identify which module they're in
- Different roles work in different environments (e.g., field vs office)
- You want to optimize themes per role:
  - Field workers: Field Mode or High Contrast
  - Office planners: Default or Blueprint Mode
  - Night shift: Dark Mode

#### Important Notes

**Permissions:**
- Only MASTER users can change themes
- Other roles can only view themes, not change them
- Theme selector does not appear for non-MASTER users

**Synchronization:**
- Theme changes sync via Firebase Firestore
- All devices update automatically
- Changes apply per site (site-scoped)
- If offline, theme settings wait until online to sync

**Performance:**
- Theme switching is instant (no reload required)
- Styles are applied using React context
- No performance impact on app speed

**Storage:**
- Theme settings stored in Firestore at:
  - Path: `sites/{siteId}/config/themeSettings`
- Contains:
  - `themeMode`: 'global' or 'per-ui'
  - `selectedTheme`: active global theme ID
  - `uiThemes`: object mapping UI keys to theme IDs

#### Troubleshooting

**Problem: Theme Not Changing**
- Check you're logged in as MASTER
- Ensure internet connection is active
- Try closing and reopening the screen
- Verify Firebase connection

**Problem: Theme Reverts on Reload**
- May indicate Firebase sync issue
- Check offline banner status
- Wait for connection and try again
- Theme should persist once synced

**Problem: Users Seeing Different Themes**
- Check if Per-UI mode is enabled
- Verify correct theme assigned to their role
- Ensure all devices are online and synced

**Problem: Can't See Theme Settings**
- Verify user role is MASTER
- Theme Settings only visible to MASTER
- Other roles will not see this menu item

#### Technical Details

**For System Administrators:**

**Theme Registry:**
- Location: `/themes/themeRegistry.json`
- Contains all theme definitions
- Modular design: new themes can be added by appending to JSON
- No code changes required to add themes

**Theme Context:**
- Location: `/contexts/ThemeContext.tsx`
- Provides `useThemeConfig()` hook
- Provides `useThemedStyles(uiKey?)` hook
- Listens to Firestore for real-time theme updates

**Firebase Document:**
- Path: `sites/{siteId}/config/themeSettings`
- Structure:
  ```json
  {
    "themeMode": "global" | "per-ui",
    "selectedTheme": "theme-id",
    "uiThemes": {
      "supervisor": "theme-id",
      "planner": "theme-id",
      ...
    }
  }
  ```

**No Additional Indexes Required:**
- Theme settings use simple document read/write
- No queries or complex filtering
- All existing Firebase indexes support theme system

---

### Manage Users

Access: **Settings → Manage Users**

#### Adding New Users

**Required Fields:**
- User ID (Automatically generated - unique identifier for login)
- User Role (Select from dropdown menu)

**Optional Fields:**
- Sub Contractor Name
- Legal Entity Name
- User Name
- Direct Personal Contact Number
- Admin Contact
- Admin Email
- Company Registration Number
- VAT Number

**Steps to Add User:**
1. Navigate to Settings → Manage Users
2. Tap "+ ADD USER" button
3. Fill in user information (User ID is auto-generated)
4. Enter User Name (recommended)
5. Select User Role from dropdown (tap the dropdown indicator to see all roles)
6. Fill in additional company information as needed
7. Tap the "SAVE" button in the header (top right)
8. User will receive their unique User ID for login
9. Share this User ID with the user securely

**Important Notes:**
- User IDs are automatically generated and guaranteed to be unique
- The system checks for duplicate User IDs before saving
- If a duplicate is found (rare), the system will alert you to try again
- Each user's ID follows the format: USER-[timestamp][random]

#### Viewing User Information

The Manage Users screen displays all users in expandable blocks:

1. Scroll through the user list
2. Tap on a user block to expand it
3. View complete user information
4. Tap the QR code image to:
   - View full-size QR code
   - Print for physical distribution
   - Use for user login

#### Filtering Users

Use the filter options to find specific users:
- Filter by Role
- Filter by Company
- Filter by Status
- Search by Name or ID

---

## User Roles

The system supports nine distinct user roles:

### 1. Admin
- Full system access
- Can manage all users and settings
- Access to all projects and tasks

### 2. Planner
- Project planning and scheduling
- Task assignment
- Resource allocation

### 3. Supervisor
- Monitor project progress
- Manage team members
- Approve task completions

### 4. QC (Quality Control)
- Quality inspections
- Approval workflows
- Issue reporting

### 5. Operator
- Task execution
- Progress updates
- Equipment operation logs

### 6. Plant Manager
- Equipment management
- Resource optimization
- Performance monitoring

### 7. Surveyor
- Site surveys and task requests
- Image library management
- Task execution and documentation
- Share images with team members
- View assigned surveyor tasks

### 8. Staff Manager
- Personnel management
- Attendance tracking
- Team coordination

### 9. Logistics Manager
- Material management
- Supply chain coordination
- Delivery scheduling

---

## Supervisor Functions

### Overview
[To be documented: Supervisor dashboard, activity management, task oversight]

### Managing Activities
[To be documented: Creating activities, setting scope, managing progress]

### Task Creation & Assignment
[To be documented: Creating tasks under activities, assigning to operators]

### Progress Tracking
[To be documented: Viewing PV (Progress Value), monitoring task completion]

### Requesting Support

#### Requesting Activity Scope
[To be documented: How to request scope from planner when value/unit needs to be set]

#### Requesting Cabling
[To be documented: When and how to request cabling support]

#### Requesting QC Inspection
[To be documented: Requesting QC for activities, viewing scheduled inspections]

#### Requesting Task Resources
[To be documented: Requesting additional resources or support for tasks]

### Viewing Request Status
[To be documented: Tracking all requests made, viewing responses and scheduled times]

---

## Planner Functions

### Overview
[To be documented: Planner dashboard, request management tabs]

### Request Management Tabs

#### Task Requests
[To be documented: Viewing and responding to task resource requests]

#### Activity Scope Requests
[To be documented: Setting scope values and units for activities]

#### QC Requests
[To be documented: Scheduling QC inspections with date/time picker]

#### Cabling Requests
[To be documented: Managing cabling requests and scheduling]

### Scheduling QC Inspections

#### Calendar & Time Selection
[To be documented: Using date picker and time picker for precise appointment scheduling]

#### Scheduled Tab Management
[To be documented: Viewing upcoming scheduled QC inspections]

#### On-Site QC Completion
[To be documented: Opening scheduled items, entering QC values, completing inspections]

### Archive Management
[To be documented: Viewing completed and rejected requests]

---

## Activities & Tasks

### Understanding Activities

Activities are work units within tasks that track specific construction operations. Each activity:
- Belongs to a specific task (e.g., MV Cable Trench, DC Cable Laying)
- Has a defined scope (target quantity to complete)
- Tracks daily progress ("Completed Today" values)
- Can request QC inspections
- May support handovers to specialized teams
- Maintains historical data of all work performed

**Activity Hierarchy:**
```
TASK (e.g., MV Cable Trench)
  └── ACTIVITIES (multiple)
       ├── Activity 1: Cable Laying
       ├── Activity 2: Backfilling
       └── Activity 3: Compaction
```

### Task Workflow (Complete Start-to-End)

This section documents the complete workflow for task activities from initial creation through completion.

---

#### STEP 1: Supervisor Accesses Locked Task

**Initial State:** All new tasks are created in a LOCKED state.

**Process:**

1. **Navigate to Task**
   - Open Supervisor dashboard
   - Select main menu (e.g., TRENCHING, CABLING)
   - Select sub-menu (e.g., MV Cable Trench, DC Cable)
   - Tap on task name to open Task Detail screen

2. **Locked Task Screen**
   - You will see a lock icon
   - Message: "Task Locked - Request Access from Planner"
   - Toggle switch: "Request Access"

3. **Request Task Access**
   - Toggle the "Request Access" switch ON
   - Request is automatically sent to Planner
   - Toggle shows: "Request Sent"
   - Wait for Planner approval

**What Happens:**
- A TASK_REQUEST is created in Firestore
- Request includes: task details, supervisor ID, site ID
- Planner receives notification
- Task remains locked until approved

---

#### STEP 2: Planner Approves Task Access

**When to check:** When you receive task access request notifications.

**Process:**

1. **Open Task Requests Screen**
   - Navigate to Planner dashboard
   - Tap "Task Requests" menu item
   - Select "Incoming" tab
   - Badge shows count of pending requests

2. **Review Request Details**
   - Tap request card to expand
   - View:
     - Main Menu (e.g., TRENCHING)
     - Sub Menu (e.g., MV Cable Trench)
     - Supervisor name and ID
     - Request date/time

3. **Approve Task Access**
   - Tap "Approve" button
   - Modal opens requesting area details
   - Enter **required** area information:
     - **PV Area** (e.g., PV-A1, PV-B2) - at least one field required
     - **Block Area** (e.g., Block 1, Block 2) - at least one field required
     - **Special Area** (optional, e.g., Restricted Zone)
   - Tap "Approve" to confirm

4. **Alternative: Reject Request**
   - Tap "Reject" button
   - Modal opens requesting rejection reason
   - Enter mandatory rejection notes
   - Tap "Reject" to confirm

**What Happens When Approved:**
- Task status changes from LOCKED → OPEN
- ALL activities within the task unlock automatically
- PV Area, Block Area, and Special Area are saved to the task
- Supervisor receives approval notification
- Request moves to "Archived" tab
- Supervisor can now access the task and all its activities

---

#### STEP 3: Supervisor Views Unlocked Task

**After Planner Approval:**

1. **Task Detail Screen Opens**
   - Header shows task name and site information
   - Task Details block displays:
     - **PV Area:** (set by Planner)
     - **Block Number:** (set by Planner)
     - **Special Area:** (if provided)
     - **Total Task Progress:** Overall completion percentage

2. **Activities Section**
   - All activities are now visible
   - Each activity shows:
     - Activity name
     - Status badge (OPEN)
     - Expand/collapse chevron

3. **Activity States**
   - **OPEN:** Ready for work, scope may be pending
   - **HANDOFF_SENT:** Transferred to another team
   - **DONE:** Completed and verified

---

#### STEP 4: Supervisor Requests Activity Scope

**When:** An activity is OPEN but doesn't have a scope value set.

**Process:**

1. **Identify Activities Needing Scope**
   - Activities without scope show: "⚠️ Scope pending - Planner to set value"
   - These activities cannot track progress until scope is set

2. **Automatic Scope Request**
   - When you enter a "Completed Today" value for the first time
   - System automatically sends scope request to Planner
   - Only sends once per day per activity
   - Request includes: activity name, completed value, unit

**Alternative: Manual Scope Request (if needed)**
- Some activities may have a "Request Scope" button
- Tap to manually send request to Planner

**What Happens:**
- SCOPE_REQUEST is created in Firestore
- Activity status remains OPEN
- `scopeRequested: true` flag is set
- Planner receives notification to set scope

---

#### STEP 5: Planner Sets Activity Scope

**When to check:** When you receive scope request notifications.

**Process:**

1. **Open Activity Scope Requests**
   - Navigate to Planner dashboard
   - Tap "Activity Scope Requests" menu item
   - View all pending scope requests

2. **Review Activity Details**
   - Tap request card to expand
   - View:
     - Main Menu and Sub Menu
     - Activity name
     - Supervisor name
     - PV Area and Block Number
     - Supervisor's completed value (if submitted)

3. **Set Scope Value and Unit**
   - Enter **Scope Value** (numeric, e.g., 500)
   - Select **Unit** from pill selector:
     - **m** (meters) - for linear work
     - **km** (kilometers) - for long distances
     - **m²** (square meters) - for area coverage
     - **m³** (cubic meters) - for volume
     - **kg** (kilograms) - for weight
     - **ton** (tons) - for heavy materials
     - **qty** (quantity) - for countable items
     - **hours** (hours) - for time-based work

4. **Optional: Set Default for All Activities**
   - Toggle "Set Default Value for All Activities" ON
   - This applies the same scope and unit to ALL activities in the task
   - Useful when multiple activities have identical scope
   - Saves time for repetitive task structures

5. **Approve Scope**
   - Tap "Approve" button
   - Scope is saved to activity
   - If default toggle was ON, all activities receive the scope

**What Happens When Approved:**
- Activity: `scopeApproved: true`
- Activity: `scopeValue: [entered value]`
- Activity: `scopeUnit: [selected unit]`
- **Progress bar immediately appears** on supervisor's activity card
- Supervisor can now track progress: (Completed Today / Scope) × 100%
- "Scope Pending" banner is removed
- Request moves to "Archived" tab

---

#### STEP 6: Supervisor Submits Daily Progress

**When:** Throughout each workday as work progresses.

**Daily Submission Workflow:**

1. **Open Activity**
   - Tap activity card to expand
   - View activity details and input fields

2. **First-Time Input Warning**
   - A toast warning appears:
     - "You can only submit your TOTALS once a day for this Activity"
   - Tap "OK" to acknowledge
   - This is a one-time reminder per activity per day

3. **Enter Completed Today Value**
   - Find "Completed Today:" input field
   - Enter numeric value (e.g., 50)
   - Tap unit selector button (shows current unit, e.g., "m")
   - Modal opens with available units
   - Select appropriate unit (should match scope unit)

4. **Submit Progress**
   - Tap "Submit" button
   - System validates the input
   - Success message appears
   - Value is saved and visible in "Today's Submission" section

5. **Edit Before Locking (if needed)**
   - You can edit the value multiple times
   - Simply change the number and tap "Submit" again
   - **IMPORTANT:** Once locked, cannot be changed

**What Happens:**
- Value is saved to Firestore
- `completedToday: [value]` updated
- `completedTodayUpdatedAt: [timestamp]` recorded
- If scope wasn't approved, automatic scope request is triggered
- Historical record is created for the day
- You can see current submission in the activity card

**Three Ways Progress Locks:**

**Lock Type 1: Submit Button Lock**
- You tap "Submit" button
- Value locks immediately
- Cannot be changed for the day
- If QC scheduled, this becomes the value QC will verify

**Lock Type 2: QC Interaction Lock**
- QC inspector submits their QC value
- Your "Completed Today" locks instantly
- Ensures data integrity for QC inspection
- Lock indicator shows: "🔒 Locked by QC interaction"

**Lock Type 3: Time Lock (18:00)**
- At 6:00 PM local time
- Whatever value exists becomes final
- Automatic lock applied
- Lock indicator shows: "🔒 Locked by time lock"

**Special Case: Late Entry (After 18:00)**
- If field is empty after 18:00
- Warning popup appears:
  - "THIS VALUE WILL BE SAVED ON INPUT AND IS NOT REVERSIBLE"
- Options: [CANCEL] [OK]
- If OK: You can enter value ONE TIME ONLY
- Value locks immediately upon submission

**Visual Indicators:**
- **Unlocked:** Normal input field, cursor appears
- **Locked:** Gray background, lock icon 🔒, cannot edit
- Lock type and timestamp displayed

---

#### STEP 7: Supervisor Requests QC Inspection

**When:** Work is completed and ready for quality control verification.

**Requirements:**
- Must have submitted a "Completed Today" value
- Value must be greater than 0
- Cannot request if QC is already pending/scheduled/in progress

**Process:**

1. **Open Activity**
   - Tap activity card to expand
   - Scroll to QC toggle section

2. **Request QC**
   - Find toggle labeled "Request QC"
   - Toggle ON
   - Request is sent automatically
   - Toggle shows: "✓ QC Requested"
   - Cannot toggle off once QC is scheduled

**What Happens:**
- QC_REQUEST created in Firestore
- Activity: `qcRequested: true`
- Activity: `qc.status: 'pending'`
- Planner/QC team receives notification
- Toggle becomes locked during inspection process

**QC Status Indicators:**
- **⏳ QC Pending:** Request received, awaiting schedule
- **📅 QC Scheduled:** Date and time set for inspection
- **🔄 QC In Progress:** Inspector is on-site
- **✅ QC Completed:** Inspection finished, value recorded

---

#### STEP 8: Planner Schedules QC Inspection

**When to check:** When you receive QC request notifications.

**Process:**

1. **Open QC Requests**
   - Navigate to Planner dashboard
   - Tap "QC Requests" menu item
   - Select "Incoming" tab
   - View all pending QC requests

2. **Review Request Details**
   - Tap request card to expand
   - View:
     - Activity name and location
     - Supervisor information
     - Completed today value
     - Request date

3. **Schedule Inspection**
   - Tap "Schedule" button
   - **Date Picker** opens
     - Select inspection date from calendar
   - **Time Picker** opens
     - Select inspection time (24-hour format)
   - Tap "Schedule" to confirm

4. **Alternative: Reject Request**
   - Tap "Reject" button (if work not ready)
   - QC status resets to "not_requested"
   - Supervisor can re-request when ready

**What Happens:**
- Request moves from "Incoming" to "Scheduled" tab
- Activity: `qc.status: 'scheduled'`
- Activity: `qc.scheduledAt: [date+time]`
- Supervisor sees: "📅 QC Scheduled" with date/time
- QC inspector receives notification
- Badge counter updates on "Scheduled" tab

---

#### STEP 9: QC Inspector Performs Inspection

**When:** At the scheduled date and time.

**Process:**

1. **View Scheduled Inspections**
   - Open QC Requests screen
   - Select "Scheduled" tab
   - See all upcoming inspections with date/time

2. **Navigate to Site**
   - Arrive at scheduled time
   - Locate activity using PV Area and Block Number

3. **Open Inspection**
   - Tap "Complete" button on scheduled request
   - Modal opens showing:
     - Activity name
     - Unit (from activity scope)
     - Supervisor's completed value (for reference)

4. **Perform Inspection**
   - Review completed work on-site
   - Verify quality and compliance
   - Measure/assess actual completed quantity

5. **Enter QC Value**
   - Enter numeric QC value in modal
   - Unit is pre-filled (matches scope unit)
   - Value represents verified quantity
   - This is the official completion amount

6. **Submit QC Report**
   - Tap "Complete" button
   - QC value is locked and saved
   - Cannot be edited after submission

**What Happens:**
- Activity: `qc.status: 'completed'`
- Activity: `qcValue: [entered value]`
- Activity: `qc.completedAt: [timestamp]`
- **Supervisor's "Completed Today" locks immediately**
- Progress bar appears/updates on activity card
- Progress = (QC Value / Scope Value) × 100%
- Supervisor receives completion notification
- Request moves to "Archived" tab

---

#### STEP 10: Supervisor Views Progress

**After QC Completion:**

1. **Activity Card Updates**
   - Progress bar now visible (if wasn't before)
   - Shows completion percentage
   - Three key values displayed:
     - **QC Value Input:** Verified amount by inspector
     - **Scope Value Input:** Target amount
     - **% Completed:** (QC / Scope) × 100%

2. **Locked Value Display**
   - "Completed Today" field shows:
     - 🔒 **Locked Value:** [amount] [unit]
     - "This value was locked by QC interaction and cannot be edited."

3. **Historical Data**
   - Tap "Last 7 Days" section
   - Horizontal scroll shows daily history cards:
     - Date
     - Completed value
     - Percentage
     - QC status (if applicable)
     - Material/Plant/Workers toggles (if used)

**Task Progress Updates:**
- Task Details header shows "Total Task Progress"
- Calculated as average of all activities' completion percentages
- Only includes activities with scope or QC values
- Excludes handoff activities

---

#### STEP 11: Next Day Unlock (Automatic)

**At Midnight (12:00 AM):**

**What Happens:**
- System automatically checks all locked activities
- "Completed Today" input unlocks for new day
- Previous day's value is saved in history
- Lock is cleared: `completedTodayLock.isLocked: false`
- Supervisor can enter new progress for the new day

**Multi-Day Work Example:**

```
DAY 1:
  Supervisor enters: 100m
  At 18:00 → locks
  History: Day 1 = 100m (locked)

DAY 2 (Midnight unlock):
  Field unlocks automatically
  Supervisor enters: 150m
  At 18:00 → locks
  History: Day 2 = 150m (locked)

DAY 3 (Midnight unlock):
  Field unlocks automatically
  Supervisor enters: 200m
  QC arrives and inspects
  QC submits: 450m (total of all 3 days)
  Supervisor's 200m → locks immediately (QC Lock)
  History: Day 3 = 200m (locked by QC)
```

**Key Points:**
- Each day's lock is independent
- Previous days remain in history
- QC value reflects total work inspected
- Daily records create complete audit trail

---

#### STEP 12: Activity Completion

**When is an Activity Considered Complete:**

1. **Scope is Set:** Activity has approved scope value and unit
2. **Work is Done:** QC value meets or exceeds scope value
3. **QC is Complete:** Quality inspection passed and recorded
4. **Progress is 100%+:** (QC Value / Scope Value) × 100% ≥ 100%

**Completion Indicators:**
- Progress bar shows 100%
- Status badge may show "DONE"
- Green checkmark or completion icon
- All historical data preserved

**Post-Completion:**
- Activity data is archived but remains viewable
- Historical "Last 7 Days" still accessible
- Timestamps show who completed what and when
- Can be used for reporting and compliance

---

### Task Workflow Summary

**Complete Flow:**
```
1. SUPERVISOR: Task Locked → Request Access
2. PLANNER: Review Request → Approve with Areas
3. SUPERVISOR: Task Unlocked → View Activities
4. SUPERVISOR: Activity Open → Submit Progress → Auto Scope Request
5. PLANNER: Receive Scope Request → Set Scope + Unit
6. SUPERVISOR: Progress Visible → Submit Daily Values → Request QC
7. PLANNER: Schedule QC Inspection → Set Date/Time
8. QC INSPECTOR: Arrive On-Site → Perform Inspection → Enter QC Value
9. SUPERVISOR: View Progress Bar → Locked Values → Historical Data
10. SYSTEM: Midnight Unlock → New Day Progress Entry
11. SUPERVISOR: Continue Daily Progress → Until Complete
12. ACTIVITY: Marked Complete → 100% Progress → Archived
```

**Time Estimates:**
- Task unlock: Minutes (after planner approval)
- Scope approval: Minutes to hours (depending on planner availability)
- QC scheduling: Hours to days (based on inspector schedule)
- QC inspection: 30 min to 2 hours (depending on work scope)
- Daily progress entry: 2-5 minutes per activity
- Complete workflow: 1 day to several weeks (depending on work scope)

---

### Activity Components

#### Scope Block

**What it shows:**
- Scope value (numeric)
- Unit of measurement
- Who set the scope (Planner name)
- When it was set (timestamp)

**Important:**
- Once scope is approved, the value appears on all supervisor activity cards
- Progress is calculated based on this scope value
- Visible to all team members working on the activity

#### PV Block (Progress Value)

**What it shows:**
- Current progress percentage
- Visual progress bar
- Completed amount vs. scope amount
- Color-coded indicators:
  - Green: On track or completed
  - Yellow: In progress
  - Red: Behind schedule

**When progress appears:**
- After scope is approved by Planner
- After QC value is submitted
- Updates automatically as work progresses
- Visible on all activity cards for supervisors

**Important:**
- Progress bar shows immediately when scope OR QC is approved
- Updates in real-time as supervisors enter "Completed Today" values
- Each activity tracks its own progress independently

#### QC Block

**QC Status Indicators:**
- Not Requested (gray)
- Requested (orange) - Waiting for schedule
- Scheduled (blue) - Shows date and time
- Completed (green) - Shows QC value

**What it displays:**
- QC status badge
- Scheduled date/time (if scheduled)
- QC value entered by inspector (if completed)
- Unit of measurement

#### NR Block (Non-Routine)
[To be documented: Non-routine work tracking and management]

### Task Management
[To be documented: Creating tasks, assigning operators, tracking completion]

---

## Scope Management

### What is Scope?
[To be documented: Definition, importance, value and unit system]

### Setting Scope (Planner)
[To be documented: How planners set scope values and select units]

### Requesting Scope (Supervisor)
[To be documented: How supervisors request scope to be set]

### Scope Units
[To be documented: Available units - m, km, m², m³, kg, ton, qty, hours]

### Viewing Scope
[To be documented: How scope displays across different user roles]

---

## QC Workflow

### QC Process Overview
[To be documented: End-to-end QC inspection workflow]

### Requesting QC (Supervisor)
[To be documented: When to request, how to request, what information is needed]

### Scheduling QC (Planner/QC)
[To be documented: Incoming requests, calendar selection, time selection, moving to scheduled]

### QC Status Indicators
- Not Requested
- Requested (Pending Schedule)
- Scheduled (with date/time)
- Completed (with QC value)

### On-Site QC Inspection
[To be documented: Opening scheduled items, deep-linking to activity, entering values]

### QC Value Entry
[To be documented: Entering numeric values, unit display, validation]

### Post-QC Actions
[To be documented: What happens after QC completion, notifications sent]

---

## Request Workflows

This section covers the complete request workflow from submission to completion.

### Overview

The system supports multiple types of requests that flow from Supervisors to Planners:
- **Task Requests**: Request additional resources or support
- **Activity Scope Requests**: Request scope values/units to be set
- **QC Requests**: Request quality control inspections
- **Cabling Requests**: Request cabling work

Each request follows a similar pattern: Submit → Review → Respond → Complete

---

## Task Request Workflow

### Supervisor: Submitting a Task Request

**When to use:** When you need additional resources, support, or clarification for a task.

**Steps:**

1. **Navigate to Task**
   - From your Supervisor dashboard, find the task that needs support
   - Tap on the task to open details

2. **Open Request Form**
   - Look for "Request Task Support" or similar button
   - Tap to open the request form

3. **Fill Out Request Form**
   - **Task Description** (Required): Clearly describe what you need
   - **Quantity** (Optional): Specify amounts if relevant
   - **Location** (Optional): Specify where on site
   - **Notes** (Optional): Add any additional context

4. **Submit Request**
   - Tap "SAVE TASK REQUEST" button
   - Wait for confirmation message
   - You'll see: "✅ Task Request Submitted"
   - The request ID will be shown

5. **What Happens Next**
   - Request is saved to the system
   - Planner receives a notification
   - Request appears in Planner's "Task Requests" tab
   - You can track status in your requests list

**Important Notes:**
- Task Description is mandatory
- Your request is linked to your site automatically
- The request includes your activity and task information

---

### Planner: Reviewing Task Requests

**When to check:** Regularly throughout the day, or when you receive notifications.

**Steps:**

1. **Open Task Requests Tab**
   - Navigate to Planner dashboard
   - Tap "Task Requests" tab
   - You'll see all pending requests for your site

2. **Review Request Details**
   - Each request shows:
     - Task name and activity
     - Requested by (Supervisor name/ID)
     - Task description
     - Quantity, location, notes
     - Date/time submitted

3. **Make a Decision**
   
   **Option A: Approve**
   - Review the request details
   - Tap "Approve" button
   - Request status changes to "APPROVED"
   - Supervisor receives notification
   
   **Option B: Reject**
   - Tap "Reject" button
   - Request status changes to "REJECTED"
   - Supervisor receives notification

4. **View Processed Requests**
   - Approved and rejected requests move to "Processed" section
   - You can view the history and status

**Important Notes:**
- Only requests for your site will appear
- Requests are organized by pending/processed status
- Badge counters show how many pending requests you have

---

## Activity Scope Request Workflow

### Supervisor: Requesting Scope

**When to use:** When an activity doesn't have a scope value/unit set yet.

**Steps:**

1. **Identify Activity Without Scope**
   - On Supervisor Activity screen, look for activities without scope values
   - You'll see a "Request Scope" option

2. **Submit Scope Request**
   - Tap "Request Scope" button
   - Request is automatically sent to Planner
   - Activity is marked as "Scope Requested"

3. **Wait for Planner Response**
   - Planner will set the scope value and unit
   - You'll receive notification when scope is set
   - Activity will update with the new scope

---

### Planner: Setting Activity Scope

**When to check:** When you receive scope request notifications.

**Steps:**

1. **Open Activity Scope Requests Tab**
   - Navigate to Planner dashboard
   - Tap "Activity Scope Requests" tab
   - View all pending scope requests

2. **Review Activity Details**
   - See activity name, sub-activity
   - View requesting supervisor
   - Check site information

3. **Set Scope**
   - Enter **Scope Value** (numeric, e.g., 100)
   - Select **Unit** from dropdown:
     - m (meters)
     - km (kilometers)
     - m² (square meters)
     - m³ (cubic meters)
     - kg (kilograms)
     - ton (tons)
     - qty (quantity)
     - hours (hours)

4. **Submit Scope**
   - Tap "Set Scope" or "Submit" button
   - Scope is saved to the activity
   - Supervisor receives notification
   - Activity now shows scope value and unit

**Important Notes:**
- Once scope is set, it becomes the baseline for progress tracking
- The scope value and unit are visible to all users on that activity
- Scope is displayed prominently on the activity card

---

## QC Request & Inspection Workflow

### Supervisor: Requesting QC Inspection

**When to use:** When work is ready for quality control inspection.

**Steps:**

1. **Navigate to Activity**
   - Open the activity that needs QC inspection
   - Ensure work is ready for inspection

2. **Submit QC Request**
   - Tap "Request QC" button
   - Request is sent to Planner/QC team
   - Activity QC status changes to "Requested"

3. **Wait for Scheduling**
   - Planner will schedule the inspection
   - You'll receive notification with date/time
   - Activity shows "QC Scheduled" status

4. **QC Visit**
   - QC inspector arrives at scheduled time
   - Inspector reviews work and enters QC value
   - Activity status updates to "QC Completed"
   - **IMPORTANT: Your "Completed Today" value locks immediately when QC submits**

---

### Planner: Scheduling QC Inspections

**When to check:** When you receive QC request notifications.

**Steps:**

1. **Open QC Requests Tab**
   - Navigate to Planner dashboard
   - Tap "QC Requests" tab
   - View all pending QC requests ("Incoming" section)

2. **Review Request Details**
   - Activity name and details
   - Requesting supervisor
   - Site location
   - Date requested

3. **Schedule Inspection**
   - Tap on the request
   - Select **Date** using calendar picker
   - Select **Time** using time picker
   - Tap "Schedule" button

4. **Confirm Scheduling**
   - Request moves to "Scheduled" tab
   - Shows scheduled date/time
   - Supervisor receives notification
   - QC inspector receives notification

---

### QC Inspector: Performing Inspection

**When to perform:** At the scheduled date/time.

**Steps:**

1. **View Scheduled Inspections**
   - Check "Scheduled" tab in QC section
   - See all upcoming inspections with date/time

2. **Navigate to Site**
   - Arrive at scheduled time
   - Locate the activity on site

3. **Open Activity**
   - Tap on scheduled inspection
   - System opens the activity details

4. **Perform Inspection**
   - Review the completed work
   - Assess quality and compliance

5. **Enter QC Value**
   - Enter numeric QC value
   - Unit is displayed from activity scope
   - Value represents quality assessment or verified quantity

6. **Submit QC Report**
   - Tap "Submit QC" button
   - QC value is locked and saved
   - Activity status changes to "QC Completed"
   - Supervisor receives notification

**Important Notes:**
- Once QC value is submitted, it cannot be edited
- QC value triggers the "Completed Today" lock (see below)
- The QC percentage is calculated automatically

---

## Supervisor "Completed Today" Workflow

### Understanding "Completed Today"

**What it is:** The amount of work completed on an activity for the current day.

**How it works:**
- Supervisor enters the value during the day
- **Toast Warning**: When you first input a value, you'll see a warning toast:
  - "You can only submit your TOTALS once a day for this Activity"
  - Tap "OK" to acknowledge
  - This reminds you that once you submit, the value will lock
- Value can be edited freely UNTIL you submit or it locks
- Once locked, the value becomes final and cannot be changed

### Lock Rules

There are THREE ways the "Completed Today" value locks:

#### Lock Type 1: Submit Button Lock

**When:** You tap the "Submit" button after entering your completed value

**What happens:**
- Toast warning appears before first input: "You can only submit your TOTALS once a day for this Activity"
- Supervisor enters completed value during the day
- Supervisor taps "Submit" button when ready
- Value immediately locks and cannot be changed
- If QC is scheduled, this becomes the value QC will verify
- Scope request (if needed) is triggered automatically

**Example:**
1. Supervisor enters 50m completed today
2. Toast warning reminds about daily limit
3. Supervisor taps "Submit" button
4. ✅ 50m is now locked
5. Supervisor cannot change it anymore

---

#### Lock Type 2: QC Interaction Lock

**When:** QC inspector submits their QC value

**What happens:**
- The moment QC submits, Supervisor's "Completed Today" locks immediately
- This ensures QC is reviewing the actual completed amount
- Supervisor can no longer edit the value for that day

**Example:**
1. Supervisor enters 50m completed today
2. QC arrives and inspects the work
3. QC submits QC value
4. ✅ Supervisor's 50m is now locked
5. Supervisor cannot change it anymore

---

#### Lock Type 3: Time Lock (18:00)

**When:** At 6:00 PM (18:00) local time, if no QC interaction occurred

**What happens:**
- At 18:00, whatever value is in "Completed Today" becomes final
- The value locks automatically
- Supervisor can no longer edit it

**Example:**
1. Supervisor enters 75m completed today
2. No QC inspection requested or performed
3. Clock hits 18:00 (6:00 PM)
4. ✅ 75m is now locked
5. Supervisor cannot change it anymore

---

### Special Case: Late Entry (After 18:00)

**Situation:** It's after 18:00 and you forgot to enter a value (field is empty).

**What happens:**

1. **You attempt to enter a value**
   - You tap on the "Completed Today" field

2. **Warning popup appears:**
   
   ⚠️ **WARNING**
   
   "THIS VALUE WILL BE SAVED ON INPUT AND IS NOT REVERSIBLE"
   
   [CANCEL] [OK]

3. **If you tap OK:**
   - You can enter the value ONE TIME
   - The moment you enter it, it's immediately saved and locked
   - You cannot edit or change it after submission

4. **If you tap CANCEL:**
   - No value is entered
   - Field remains empty

**Important:**
- This only works if the field was EMPTY before 18:00
- If you had a value before 18:00, it's locked and cannot be changed
- Use this feature carefully - you only get one chance

---

### Visual Indicators

**Unlocked (Editable):**
- Field has normal background
- Cursor appears when tapped
- Value can be changed

**Locked (Not Editable):**
- Field has gray/dimmed background
- Lock icon appears (🔒)
- Cannot be tapped or edited
- Shows lock type: "QC Lock" or "Time Lock"
- Shows lock date/time

---

### Summary: One True Value Per Day

**Key Principle:** Each activity has ONE committed "Completed Today" value per day.

**The workflow ensures:**
✅ Toast warning reminds supervisors about daily limit before input
✅ Supervisors can update freely before submitting
✅ Once submitted, the value is locked (via submit button)
✅ Once QC inspects, the value is locked (integrity)
✅ If no submission or QC, value locks at 18:00 (accountability)
✅ Late entries require explicit confirmation (safety)
✅ No editing after lock (data integrity)

**Why this matters:**
- Progress tracking is accurate
- QC inspections are based on real values
- No retroactive changes to daily progress
- Clear audit trail of daily work

---

### New Day Unlock Behavior

**What happens at midnight (12:00 AM)?**

The system automatically unlocks the "Completed Today" input for the new day.

**Unlock Triggers:**

The unlock happens at:
1. **Midnight (12:00 AM)** - Automatic unlock based on device timezone
2. **First login after midnight** - Whichever comes first

**Example Scenario: Multi-Day QC Visit**

Imagine this situation:
- Day 1: Supervisor completes 100m of work
- Day 2: Supervisor completes 150m of work
- Day 3: Supervisor completes 200m of work
- Day 3: QC arrives and inspects all the work done over 3 days
- QC submits total value: 450m (100 + 150 + 200)

**What happens:**

**Day 1:**
1. Supervisor enters 100m
2. At 18:00, value locks (Time Lock)
3. Day 1 record: 100m (locked)

**Day 2:**
1. At midnight, Day 1 lock is cleared for Day 2
2. Supervisor can now enter Day 2 progress
3. Supervisor enters 150m
4. At 18:00, value locks (Time Lock)
5. Day 2 record: 150m (locked)

**Day 3:**
1. At midnight, Day 2 lock is cleared for Day 3
2. Supervisor can now enter Day 3 progress
3. Supervisor enters 200m
4. QC arrives and inspects
5. QC submits 450m (total of all 3 days)
6. Supervisor's 200m locks immediately (QC Lock)
7. Day 3 record: 200m (locked by QC)

**Key Points:**

✅ Each day's lock is independent
✅ Previous days remain locked in history
✅ New day automatically allows fresh input
✅ QC value on Day 3 reflects the total work completed
✅ Supervisor's daily values create an audit trail
✅ QC's final value is the source of truth for the inspection day

**Why This Works:**
- Work progresses continuously across multiple days
- Daily supervisor entries track daily progress
- QC can arrive any day and submit cumulative totals
- Historical daily records are preserved
- No confusion about which day's work was inspected

**Important Notes:**
- The unlock happens automatically - no manual action needed
- Previous locked values remain in the activity history
- QC values override supervisor values on the day QC completes inspection
- Each day is treated as a fresh start for data entry

---

### Request States

All requests follow these states:

- **Pending** (PENDING): Request submitted, waiting for planner review
- **Scheduled** (scheduled): Handover requests with start date set (lowercase 's')
- **Scheduled** (SCHEDULED): QC requests with date and time set (uppercase)
- **Approved** (APPROVED): Request has been approved, work unlocked/transferred
- **Rejected** (REJECTED): Request has been denied
- **Completed** (COMPLETED): Work has been finished and documented

**Note on Status Naming:**
- Handover requests (Cabling, Termination) use 'scheduled' (lowercase) for start date
- QC requests use 'SCHEDULED' (uppercase) for date + time appointments
- This distinction helps differentiate between simple date scheduling and precise appointment scheduling

---

### Viewing Request History

**For Supervisors:**
- View all your submitted requests
- See current status of each request
- Check scheduled dates/times
- View responses from planner

**For Planners:**
- View all incoming requests by type
- See processed requests in archive
- Filter by status, date, supervisor
- Track completion rates

---

### Request Badges & Counters

**Red Badge Numbers:**
- Appear on tab icons
- Show count of pending items
- Example: "Task Requests (5)" means 5 pending
- Clear automatically when requests are processed

**Where badges appear:**
- Planner tabs (Task Requests, Activity Requests, QC Requests, Cabling Requests)
- Main navigation icons
- Notification center

**How to clear badges:**
- Process the pending requests (approve/reject/schedule)
- Open and view the notifications
- Badges update in real-time

---

## Surveyor Workflow

### Overview

The Surveyor module enables supervisors to request surveyor tasks, planners to approve and assign surveyors, and surveyors to execute their assigned work.

---

### Supervisor: Creating Surveyor Task Requests

**When to use:** When you need a surveyor to document, measure, or inspect a specific area.

**Steps:**

1. **Navigate to Surveyors**
   - Open Supervisor dashboard
   - Select activity/task requiring surveyor support
   - Tap "Surveyors" or "Request Surveyor" option

2. **Fill Out Task Request**
   - **PV Area** (Required): Specify the PV area (e.g., PV-A1, PV-B2)
   - **Block Number** (Required): Specify block (e.g., Block 1, Block 2)
   - **Special Area** (Optional): Additional location details
   - **Notes** (Optional): Detailed instructions for surveyor
   - **Link Images** (Optional): Select existing images from gallery

3. **Submit Request**
   - Tap "CREATE TASK" button
   - Request status: PENDING_APPROVAL
   - Planner receives notification

4. **Track Request Status**
   - View in "Submitted" tab
   - Receive notification when approved/rejected
   - If approved, assigned surveyor receives the task

---

### Planner: Reviewing Surveyor Requests

**When to check:** When you receive surveyor task notifications.

**Surveyor Request Flow: Incoming → Archived**

#### Step 1: Review Incoming Requests

1. **Open Surveyor Requests**
   - Navigate to Planner dashboard
   - Tap "Surveyor Requests" menu item
   - Select "Incoming" tab
   - Badge shows count of pending requests

2. **Review Request Details**
   - Tap to expand request card
   - Review:
     - PV Area and Block Number
     - Special Area (if any)
     - Notes from supervisor
     - Linked images (thumbnails)
     - Created date

3. **View Linked Images**
   - Tap image thumbnail to view full-screen
   - Pinch to zoom
   - Swipe to view multiple images

#### Step 2: Assign Surveyor (Optional)

1. **Tap "Assign" Button**
   - Modal opens with list of surveyors
   - Shows surveyors for your site

2. **Select Surveyor**
   - Tap surveyor name from list
   - Assignment is saved
   - Can change assignment before approval

#### Step 3: Approve or Reject

**Option A: Approve Request**

1. **Tap "Approve" Button**
   - Confirm approval
   - Task status → APPROVED

2. **What Happens:**
   - Task moves to "Archived" tab
   - Supervisor receives approval notification
   - Assigned surveyor receives task notification
   - Task appears in surveyor's "Approved" tab

**Option B: Reject Request**

1. **Tap "Reject" Button**
   - Modal opens requiring rejection reason

2. **Enter Rejection Reason**
   - Type explanation (mandatory)
   - Tap "Reject" to confirm

3. **What Happens:**
   - Task status → REJECTED
   - Task moves to "Archived" tab
   - Supervisor receives rejection notification with reason

#### Step 4: View Archived Requests

1. **Open Archived Tab**
   - Shows all approved and rejected tasks
   - Each card shows:
     - Final status (APPROVED or REJECTED)
     - Assigned surveyor (if approved)
     - Rejection reason (if rejected)
     - Completion date

**Important Notes:**
- Badge counters show pending request count
- Linked images help assess scope of work
- Surveyor assignment is optional but recommended
- Rejection reason helps supervisor understand decision

---

### Surveyor: Executing Assigned Tasks

**When to check:** When you receive task assignment notifications.

#### Step 1: View Assigned Tasks

1. **Open Surveyor Tasks Screen**
   - Navigate to your dashboard
   - Tap "Surveyor Tasks" or "My Tasks"
   - Select "Approved" tab

2. **View Task Details**
   - Tap task card to expand
   - Review:
     - PV Area and Block Number
     - Special Area location
     - Supervisor's notes
     - Linked reference images

3. **Navigate to Task Location**
   - Use PV Area and Block Number to find site
   - Review Special Area notes if provided

#### Step 2: Execute Survey Work

1. **On-Site Actions**
   - Perform required measurements
   - Take documentation photos
   - Note any discrepancies

2. **Upload Survey Images**
   - Tap "Add Image" or camera icon
   - Capture new photos or select from gallery
   - Add image descriptions
   - Images saved to surveyor image library

3. **Update Task Progress**
   - Mark task as "In Progress"
   - Add notes or findings
   - Update completion status

#### Step 3: Share Survey Results

1. **Share Images**
   - Open surveyor gallery
   - Select images to share
   - Tap "Share" button
   - Choose recipients (supervisor, planner, team)

2. **Complete Task**
   - Mark task as "Completed"
   - All images and notes are saved
   - Supervisor receives completion notification

**Important Notes:**
- Tasks remain in "Approved" tab until completed
- Completed tasks move to "Archived" tab
- Shared images appear in recipient's inbox
- All images saved to permanent library

---

### Surveyor Image Library

**Features:**
- Central repository for all survey images
- Searchable and filterable
- Organized by PV Area and Block Number
- Images can be linked to multiple tasks
- Permanent storage with metadata

**Viewing Gallery:**
1. Navigate to "Surveyor Gallery" or "Image Library"
2. Browse images by date or location
3. Tap image to view full-screen with details
4. Filter by PV Area, Block, or date range

**Adding to Library:**
1. Tap "Add to Library" or "+" button
2. Capture photo or select from device
3. Enter metadata:
   - PV Area
   - Block Number
   - Description
   - Tags (optional)
4. Tap "Save" to add to library

**Sharing from Library:**
1. Select image(s) from gallery
2. Tap "Share" button
3. Choose recipient(s)
4. Add message (optional)
5. Confirm share
6. Recipients receive in their shared inbox

---

## Messaging & Notifications

### Notification Types
[To be documented: Request notifications, schedule notifications, completion notifications]

### Message Status
- Pending
- Info
- Scheduled
- Completed

### Badge Indicators
[To be documented: Where badges appear, what they mean, how to clear them]

### Deep Links
[To be documented: Tapping notifications to jump to relevant screens]

---

## TASKS / TASK REQUESTS

This section covers all types of task-related requests and handovers between teams, including work requests, scope requests, quality control, and team-to-team handovers.

---

### Overview: Task Request Types

The system supports multiple types of task-related requests:

1. **Task Access Requests** - Request to unlock or access work areas
2. **Scope Requests** - Request scope values and units to be set for activities
3. **QC Requests** - Request quality control inspections
4. **Handover Requests** - Transfer work between specialized teams:
   - Cabling Handover (Trenching → Cabling Teams)
   - Termination Handover (Cabling → Termination Teams)

---

### 1. TASK ACCESS REQUESTS

#### Supervisor: Requesting Task Access

**When to use:** When a task or work area is locked and you need permission to begin work.

**Steps:**

1. **Navigate to Activity**
   - Open your Supervisor dashboard
   - Select the main menu (e.g., TRENCHING, CABLING)
   - Select the sub-menu (e.g., MV Cable Trench, DC Cable)
   - Find the locked task or activity

2. **Submit Access Request**
   - Tap "Request Task Access" button
   - Fill in required details:
     - Task Description (What work needs to be done)
     - Quantity (if applicable)
     - Location (specific site location)
     - Notes (additional context)
   - Tap "SUBMIT REQUEST"

3. **Wait for Planner Approval**
   - Request goes to Planner for review
   - You'll receive a notification when approved/rejected
   - Once approved, the task unlocks automatically

**Important Notes:**
- Task Description is mandatory
- Be specific about location and work details
- Check your request status in the messages section

---

#### Planner: Approving Task Access Requests

**When to check:** Regularly throughout the day, or when you receive notifications.

**Steps:**

1. **Open Task Requests Tab**
   - Navigate to Planner dashboard
   - Tap "Task Requests" menu item
   - View all incoming requests for your site

2. **Review Request Details**
   - Tap on a request card to expand
   - Review:
     - Main Menu and Sub Menu
     - Task/Activity name
     - Supervisor name
     - Description and notes
     - Requested date

3. **Approve Request**
   - Tap "Approve" button
   - Enter required area details:
     - **PV Area** (e.g., PV-A1, PV-B2)
     - **Block Area** (e.g., Block 1, Block 2)
     - **Special Area** (e.g., Restricted Zone)
   - At least one area must be specified
   - Tap "Approve" to confirm

4. **What Happens:**
   - Task status changes to "OPEN"
   - All related activities unlock automatically
   - Supervisor receives notification
   - Request moves to "Archived" tab

5. **Reject Request (Alternative)**
   - Tap "Reject" button
   - Enter rejection reason (mandatory)
   - Tap "Reject" to confirm
   - Supervisor receives notification with reason

**Important Notes:**
- Badge counters show number of pending requests
- Approving unlocks the entire task and all its activities
- Area details help supervisors locate their work zones
- Archived requests are kept for audit purposes

---

### 2. SCOPE REQUESTS

#### Supervisor: Requesting Activity Scope

**When to use:** When an activity doesn't have a scope value/unit set yet and you need it to track progress.

**Steps:**

1. **Identify Activity Without Scope**
   - Navigate to your activity screen
   - Look for activities without scope values
   - You'll see a "Request Scope" button

2. **Submit Scope Request**
   - Tap "Request Scope" button
   - Request is automatically sent to Planner
   - Activity shows "Scope Requested" status

3. **Wait for Planner Response**
   - Planner will set the scope value and unit
   - You'll receive notification when scope is set
   - Activity updates with the new scope

---

#### Planner: Setting Activity Scope

**When to check:** When you receive scope request notifications.

**Steps:**

1. **Open Activity Scope Requests Tab**
   - Navigate to Planner dashboard
   - Tap "Activity Scope Requests" menu item
   - View all pending scope requests

2. **Review Activity Details**
   - Tap to expand request card
   - See:
     - Main Menu and Sub Menu
     - Activity name
     - Supervisor name
     - PV Area and Block Area

3. **Set Scope Value and Unit**
   - Tap to expand the request
   - Enter **Scope Value** (numeric, e.g., 100)
   - Select **Unit** from the pill selector:
     - **m** (meters) - for linear measurements
     - **km** (kilometers) - for long distances
     - **m²** (square meters) - for area coverage
     - **m³** (cubic meters) - for volume
     - **kg** (kilograms) - for weight
     - **ton** (tons) - for heavy materials
     - **qty** (quantity) - for countable items
     - **hours** (hours) - for time-based work
   - **OPTIONAL**: Toggle "Set Default Value for All Activities" if you want to apply this scope to all activities in the task
   - Tap "Approve" to confirm

4. **What Happens:**
   - Scope is saved to the activity
   - Activity status changes to "OPEN"
   - **Progress bar immediately appears on the supervisor's activity card**
   - Supervisor receives notification
   - Supervisor can now track progress against this scope
   - Request moves to "Archived" tab
   - If default value toggle was ON:
     - All activities within the task receive the same scope value and unit
     - "Scope Pending" messages are removed from all activities
     - Progress bars appear on all activities

5. **Reject Request (Alternative)**
   - Tap "Reject" button
   - Activity remains locked
   - Supervisor receives notification

**Important Notes:**
- Scope value becomes the baseline for progress tracking
- The unit you select determines how progress is measured
- Scope is visible to all users working on that activity
- Choose the unit that matches the work type

---

### 3. QC (QUALITY CONTROL) REQUESTS

#### Supervisor: Requesting QC Inspection

**When to use:** When work is completed and ready for quality control inspection.

**Complete QC Workflow:**

1. **Supervisor Submits QC Request**
   - Navigate to the completed activity
   - Tap "Request QC" button
   - Request is sent to Planner/QC team
   - Activity QC status changes to "Requested"

2. **Planner Schedules QC Inspection**
   - Planner receives QC request notification
   - Opens "QC Requests" tab in Planner dashboard
   - Reviews the request details
   - Selects date and time for inspection
   - Taps "Schedule" button
   - Supervisor receives notification with scheduled date/time
   - Activity shows "QC Scheduled" status

3. **QC Inspector Performs Inspection**
   - QC inspector arrives at scheduled time
   - Opens "Scheduled" tab in QC section
   - Reviews the work on-site
   - Taps "Complete" button
   - Enters QC value (verified quantity)
   - Unit is automatically shown from activity scope
   - Taps "Submit" to complete inspection

4. **What Happens When QC is Submitted:**
   - QC value is locked and saved to activity
   - Activity status changes to "QC Completed"
   - **Supervisor's "Completed Today" value locks immediately**
   - **Progress bar appears on activity card showing completion percentage**
   - Supervisor receives notification
   - Activity card now shows:
     - Scope value and unit
     - QC completed value
     - Progress bar with percentage
     - QC completion timestamp

**Important:**
- Once QC is completed, the Supervisor can immediately see progress on the activity card
- Progress bar is calculated: (QC Value / Scope Value) × 100%
- Supervisor's "Completed Today" cannot be changed after QC submission

---

#### Planner: Managing QC Requests

**When to check:** When you receive QC request notifications.

**QC Request Flow: Incoming → Scheduled → Completed/Archived**

##### Step 1: Review Incoming QC Requests

1. **Open QC Requests Tab**
   - Navigate to Planner dashboard
   - Tap "QC Requests" menu item
   - Select "Incoming" tab

2. **Review Request Details**
   - Tap to expand request card
   - See:
     - Main Menu and Activity name
     - Sub Menu
     - Supervisor name
     - Date requested
     - Any notes from supervisor

3. **Schedule or Reject**
   - **To Schedule:** Tap "Schedule" button
   - **To Reject:** Tap "Reject" button (resets QC status)

##### Step 2: Schedule QC Inspection

1. **Select Date**
   - Calendar picker opens
   - Choose inspection date
   - Tap date to confirm

2. **Select Time**
   - Time picker opens
   - Choose inspection time (24-hour format)
   - Tap time to confirm

3. **Confirm Schedule**
   - Tap "Schedule" button
   - Request moves to "Scheduled" tab
   - Supervisor receives notification with date/time
   - QC inspector receives notification

##### Step 3: View Scheduled Inspections

1. **Open Scheduled Tab**
   - Shows all upcoming QC inspections
   - Sorted by scheduled date/time
   - Each card shows:
     - Scheduled date and time
     - Activity and location details
     - Supervisor information

2. **On-Site Actions**
   - **Open Activity:** Navigate to the activity screen
   - **Complete Inspection:** Enter QC value

##### Step 4: Complete QC Inspection

1. **At Scheduled Time**
   - Navigate to site at scheduled time
   - Open "QC Requests" → "Scheduled" tab
   - Find the scheduled inspection

2. **Tap "Complete" Button**
   - Modal opens showing:
     - Activity name
     - Unit (automatically loaded from activity)

3. **Enter QC Value**
   - Enter numeric QC value
   - Unit is displayed (e.g., meters, m², qty)
   - Value represents verified completed work

4. **Submit QC Report**
   - Tap "Complete" button
   - QC value is locked and saved
   - Activity status changes to "QC Completed"
   - Supervisor's "Completed Today" locks immediately
   - Request moves to "Archived" tab

##### Step 5: View Archived QC Requests

1. **Open Archived Tab**
   - Shows all completed and rejected QC requests
   - Each card shows:
     - Final status (COMPLETED or REJECTED)
     - QC value (if completed)
     - Scheduled date
     - Completion date

**Important Notes:**
- Badge counters show pending inspection count
- Schedule in advance for better planning
- QC value must match the activity unit
- Once submitted, QC value cannot be changed
- QC completion triggers supervisor's "Completed Today" lock

---

### 4. HANDOVER REQUESTS

Handover requests enable work to be transferred between specialized teams when one phase is complete and another must begin.

---

#### 4.1 CABLING HANDOVER (Trenching → Cabling)

##### Important: Which Activities Have Handover Toggles?

**Handover toggles ONLY appear on Cable Laying activities within the Trenching menu.**

These activities include:
- **MV Cable Trench** → MV Cable Laying
- **DC Cable Trench** → DC Cable Laying  
- **LV Cable Trench** → LV Cable Laying
- Any other cable laying sub-activities within trenching

**Why only cable laying?**
- These activities require handover to specialized cable installation teams
- The "same slice" logic applies: handover finds supervisors working on the same PV Area + Block Number
- Not all trenching activities need handover - only those involving cable installation

**Other trenching activities** (excavation, backfilling, etc.) do NOT have handover toggles.

---

##### Supervisor: Requesting Cabling Handover

**When to use:** When cable laying work within trenching is complete and specialized cabling team needs to take over.

**Context:**
- You're working in **TRENCHING** menu on a **Cable Laying** activity
- Your cable laying activity within the trench is complete
- Specialized cable installation team needs to be notified to begin their work

**Steps:**

1. **Navigate to Trenching Activity**
   - Open Supervisor dashboard
   - Select **TRENCHING** main menu
   - Select sub-menu (MV Cable Trench, DC Cable Trench, etc.)
   - Find the completed trench activity

2. **Request Cabling Handover**
   - Tap "Request for Cabling" button
   - Modal opens showing:
     - Activity details
     - Target: Cables team (MV, DC, or LV)
   - Tap "SUBMIT" to send request

3. **What Happens:**
   - Request is sent to Planner
   - Activity shows "Cabling Requested" status
   - You receive confirmation
   - Planner reviews and approves handover

4. **After Approval:**
   - Cable laying team receives work assignment
   - Work appears in their CABLING menu
   - They can begin cable installation

---

##### Planner: Approving Cabling Handover

**When to check:** When you receive cabling request notifications.

**Cabling Handover Flow: Incoming → Schedules → Archived**

##### Step 1: Review Incoming Cabling Requests

1. **Open Cabling Requests Tab**
   - Navigate to Planner dashboard
   - Tap "Cabling Requests" menu item
   - Select "Incoming" tab
   - Badge shows count of pending requests

2. **Review Request Details**
   - Tap to expand request card
   - Review:
     - Main Menu (TRENCHING)
     - Sub Menu (e.g., MV Cable Trench)
     - Activity name
     - Supervisor name
     - Target Module (→ MV Cable Module)
     - Date requested

##### Step 2: Schedule or Approve Handover

**Option A: Schedule the Handover (Recommended)**

1. **Click Schedule Button**
   - Tap 🗓️ "Schedule" button (blue)
   - Calendar modal opens

2. **Select Start Date**
   - Use calendar to choose when cabling team should start
   - Tap date to select
   - No time selection required

3. **Save Schedule**
   - Tap "Save Schedule" button
   - Request moves to "Schedules" tab
   - Cabling team receives notification with start date
   - Badge counter updates on "Schedules" tab

**Option B: Directly Hand Off (Skip Scheduling)**

1. **Set Cable Scope**
   - Enter cable length in meters
   - Example: "500" for 500 meters of cable
   - This sets the work scope for cabling team

2. **Hand Off to Cabling Team**
   - Tap "Hand Off" button (green)
   - Request is approved immediately
   - Cable scope is saved

3. **What Happens:**
   - Work is transferred to CABLING menu
   - Cabling team receives notification
   - Trenching activity flag resets
   - Request moves to "Archived" tab
   - Cable laying can begin

**Option C: Decline Request**
   - Tap "Decline" button (red)
   - Handover is cancelled
   - Trenching team receives notification
   - Activity remains with trenching team

##### Step 3: Managing Scheduled Handovers

1. **Open Schedules Tab**
   - Shows all scheduled handovers with start dates
   - Badge shows count of scheduled items
   - Each card displays:
     - Scheduled start date (📅)
     - Activity and location details
     - Supervisor information

2. **Deep Link to Task**
   - Tap 🔗 "Go to Task" button
   - Automatically navigates to the cabling team's task detail
   - Opens the correct activity in their CABLING menu
   - If task is locked: Normal access request workflow triggers
   - If task is unlocked: Opens immediately to active workflow

3. **Complete Handover from Schedules**
   - When ready to hand off work:
   - Set cable scope (if not already set)
   - Tap "Hand Off" button
   - Request moves to "Archived" tab

##### Step 4: View Archived Handovers

1. **Open Archived Tab**
   - Shows all completed and declined handovers
   - Each card shows:
     - Final status (APPROVED or REJECTED)
     - Cable scope (if completed)
     - Scheduled date (if scheduled)
     - Completion date

**Important Notes:**
- Scheduling helps cabling team plan their work in advance
- "Go to Task" deep link takes you directly to the cabling activity
- Cable scope must be entered before final handoff
- Handover creates new work item in CABLING menu
- Original activity reference is maintained
- Badge counters show pending and scheduled counts
- Both teams can see handover history

---

#### 4.2 TERMINATION HANDOVER (Cabling → Termination)

##### Supervisor: Requesting Termination Handover

**When to use:** When cable laying is complete and termination work needs to begin.

**Context:**
- You're working in **CABLING** menu (e.g., MV Cable, DC Cable, LV Cable)
- Your cable installation activity is complete
- Termination team needs to connect and terminate cables

**Steps:**

1. **Navigate to Cabling Activity**
   - Open Supervisor dashboard
   - Select **CABLING** main menu
   - Select sub-menu (MV Cable, DC Cable, LV Cable, Earthing)
   - Find the completed cable activity

2. **Request Termination Handover**
   - Tap "Request for Terminations" button
   - Modal opens showing:
     - Activity details
     - Target: Termination team
     - Termination type (MC4s, LV connections, etc.)
   - Tap "SUBMIT" to send request

3. **What Happens:**
   - Request is sent to Planner
   - Activity shows "Termination Requested" status
   - You receive confirmation
   - Planner reviews and approves handover

4. **After Approval:**
   - Termination team receives work assignment
   - Work appears in their TERMINATIONS menu
   - They can begin termination work

---

##### Planner: Approving Termination Handover

**When to check:** When you receive termination request notifications.

**Termination Handover Flow: Incoming → Schedules → Archived**

##### Step 1: Review Incoming Termination Requests

1. **Open Termination Requests Tab**
   - Navigate to Planner dashboard
   - Tap "Termination Requests" menu item
   - Select "Incoming" tab
   - Badge shows count of pending requests

2. **Review Request Details**
   - Tap to expand request card
   - Review:
     - Termination Type (DC Terminations, LV Terminations)
     - Activity name
     - Sub-Activity details
     - Supervisor name
     - Date requested

##### Step 2: Schedule or Approve Handover

**Option A: Schedule the Handover (Recommended)**

1. **Click Schedule Button**
   - Tap 🗓️ "Schedule" button (blue)
   - Calendar modal opens

2. **Select Start Date**
   - Use calendar to choose when termination team should start
   - Tap date to select
   - No time selection required

3. **Save Schedule**
   - Tap "Save Schedule" button
   - Request moves to "Schedules" tab
   - Termination team receives notification with start date
   - Badge counter updates on "Schedules" tab

**Option B: Directly Approve (Skip Scheduling)**

1. **Approve Handover**
   - Tap "Approve" button (green)
   - Optional: Add approval notes
   - Tap "Approve" to confirm

2. **What Happens:**
   - Work is transferred to TERMINATIONS menu
   - Termination team receives notification
   - Cabling activity flag resets
   - Request moves to "Archived" tab
   - Termination work can begin

**Option C: Reject Request**
   - Tap "Reject" button (red)
   - Enter rejection reason (mandatory)
   - Handover is cancelled
   - Cabling team receives notification

##### Step 3: Managing Scheduled Handovers

1. **Open Schedules Tab**
   - Shows all scheduled termination handovers with start dates
   - Badge shows count of scheduled items
   - Each card displays:
     - Scheduled start date (📅)
     - Termination type and details
     - Activity information
     - Supervisor information

2. **Deep Link to Task**
   - Tap 🔗 "Go to Task" button
   - Automatically navigates to the termination team's task detail
   - Opens the correct activity in their TERMINATIONS menu
   - If task is locked: Normal access request workflow triggers
   - If task is unlocked: Opens immediately to active workflow

3. **Complete Handover from Schedules**
   - When ready to hand off work:
   - Tap "Approve" button
   - Optional: Add approval notes
   - Request moves to "Archived" tab

##### Step 4: View Archived Handovers

1. **Open Archived Tab**
   - Shows all completed and rejected handovers
   - Each card shows:
     - Final status (APPROVED or REJECTED)
     - Scheduled date (if scheduled)
     - Approval notes (if provided)
     - Rejection reason (if rejected)
     - Completion date

**Important Notes:**
- Scheduling helps termination team plan their work in advance
- "Go to Task" deep link takes you directly to the termination activity
- Approval notes are optional but recommended
- Rejection reason is mandatory
- Handover creates new work item in TERMINATIONS menu
- Original cable work reference is maintained
- Badge counters show pending and scheduled counts
- Both teams can see handover history

---

### Handover Request Flow Summary

**General Pattern:**

```
TEAM A (Completes Work)
   ↓
   REQUEST HANDOVER
   ↓
   PLANNER (Reviews & Optionally Schedules)
   ↓
   SCHEDULED TAB (Optional - with start date)
   ↓
   PLANNER APPROVES
   ↓
TEAM B (Receives Work)
```

**Example 1: Trenching to Cabling (With Scheduling)**
```
Trenching Team (Cable Laying Activity) → Request for Cabling → Planner Schedules (sets start date) 
→ Schedules Tab → Planner Approves → Cabling Team
```

**Example 2: Cabling to Termination (Direct Approval)**
```
Cabling Team → Request for Terminations → Planner Approves → Termination Team
```

**Example 3: Using Deep Links**
```
Planner schedules handover → Opens Schedules tab → Clicks "Go to Task" 
→ Navigates directly to receiving team's task detail screen
```

**Key Principles:**
1. Only request handover when your work is complete
2. **Handover toggles only appear on cable laying activities within trenching submenu**
3. "Same slice" logic: Handovers target supervisors working on same PV Area + Block Number
4. Planner acts as gatekeeper for work transfers
5. **NEW**: Scheduling is optional but helps teams plan ahead
6. **NEW**: "Go to Task" deep link takes you directly to the receiving team's work area
7. Receiving team gets notification when scheduled or approved
8. All handovers are tracked with three tabs: Incoming, Schedules, Archived
9. Badge counters show pending and scheduled counts separately
10. Work scope is set during handover approval (for cabling)

**Scheduling Benefits:**
- Receiving team knows when to start work
- Better resource planning and coordination
- Clear visibility of upcoming handovers
- Direct navigation to tasks via deep links
- Handovers can be scheduled days in advance

---

### Request Status Indicators

All requests use consistent status badges:

- **PENDING** (Orange) - Waiting for planner review
- **PENDING_APPROVAL** (Orange) - Surveyor task awaiting planner approval
- **SCHEDULED** (Blue) - QC visit scheduled with date/time
- **APPROVED** (Green) - Request approved, work unlocked/transferred
- **REJECTED** (Red) - Request declined with reason
- **COMPLETED** (Green) - Work finished and documented
- **CLOSED** (Gray) - Surveyor task completed and archived

---

### Badge Counters

**For Planners:**
- Red badge numbers appear on menu tabs
- Show count of pending/scheduled requests
- Example: "Task Requests (5)" means 5 pending
- Badges clear when requests are processed or archived

**Where badges appear:**
- Task Requests tab (pending count)
- Activity Scope Requests tab (pending count)
- QC Requests tab:
  - Incoming (pending count)
  - Schedules (scheduled count)
- Cabling Requests tab:
  - Incoming (pending count)
  - Schedules (scheduled count)
- Termination Requests tab:
  - Incoming (pending count)
  - Schedules (scheduled count)
- Surveyor Requests tab:
  - Incoming (pending count)

**Badge Colors:**
- Incoming tabs: Show pending items needing review
- Schedules tabs: Show scheduled items with start dates
- Counters update in real-time as requests are processed

---

### Common Request Actions

**For Supervisors:**
1. Submit requests when work requires it
2. Track request status in messages section
3. Wait for planner approval/scheduling
4. Proceed with work once approved

**For Planners:**
1. Check request tabs regularly
2. Review details before approving
3. Set required values (scope, areas, schedules)
4. Approve or reject with clear reasoning
5. Monitor badge counters for pending work

---

## Offline Mode & Network Management

### Understanding Offline Mode

The Project Tracker system includes intelligent offline capabilities designed for construction sites with weak or intermittent network connectivity. The system automatically manages data synchronization in the background, ensuring critical work-blocking information reaches the server first when connection is available.

---

### How Offline Mode Works

**The Basics:**

When you work in areas with poor network:
1. You can continue entering data normally (progress, requests, notes)
2. All changes are saved locally on your device
3. When connection returns, data automatically syncs to the server
4. Most important data syncs first (see Priority System below)

**What You Can Do Offline:**
- ✅ Enter "Completed Today" progress values
- ✅ Request QC inspections
- ✅ Request activity scope
- ✅ Submit task access requests
- ✅ Add notes and comments
- ✅ View existing data and history
- ❌ Cannot view live updates from other users until online
- ❌ Cannot receive new assignments until online

---

### Offline Banner & Sync Status

**When You See the Offline Banner:**

A banner appears at the top of your screen showing:
- 🔴 "Offline" - No connection, data queued locally
- 🟡 "Syncing..." - Connection available, data uploading
- 🟢 "Online" - Connected, all data synced

**Sync Status Details:**

Tap "Sync Options" button to see:
- How many items are waiting to sync
- Breakdown by priority (P0, P1, P2, P3)
- Manual sync controls

---

### Priority System Explained

**Why Priority Matters:**

In construction, some data needs to reach the office immediately (like QC requests that block work), while other data can wait (like photos). The system automatically prioritizes your data so critical information gets through first, even in weak signal areas.

**Priority Levels:**

#### 🔴 P0 - Critical (Syncs First)

**What it is:** Information that unlocks work or moves resources

**Examples:**
- Task access requests (to unlock work areas)
- Activity scope requests (to enable progress tracking)
- QC inspection requests (required to complete work)
- Surveyor task requests
- Plant/equipment allocation changes
- Staff assignments
- Material delivery requests
- Handover requests (team-to-team work transfers)

**Why it's priority:** If this data doesn't reach the planner/office, work stops. Other team members can't proceed.

**Real Example:** You finish trenching and request cabling handover. This P0 request ensures the cabling team gets notified immediately so they can start work without delay.

---

#### 🟡 P1 - Messages (Medium-High Priority)

**What it is:** General communication and notes

**Examples:**
- Comments on activities
- General messages to team
- Non-urgent notifications
- Status updates

**Why it's this priority:** Important for communication but doesn't block work.

---

#### 🟡 P2 - Production Data (Medium Priority)

**What it is:** Daily work progress and completion numbers

**Examples:**
- "Completed Today" values you enter on activities
- Daily progress updates
- Activity status changes
- Work completion toggles

**Why it's this priority:** Critical for tracking but won't stop work. Can sync when signal improves slightly.

**Real Example:** You enter "50m trenching completed today". This P2 data will sync after any P0 requests (like QC requests) are sent.

---

#### 🟢 P3 - Heavy Data (Low Priority)

**What it is:** Large files and detailed reports

**Examples:**
- Survey photos and images
- Timesheet details (hours worked, tally sheets)
- Detailed quantity breakdowns
- Plant hour logs
- Man hour reports
- Billing documentation

**Why it's this priority:** These files are large and take time to upload. They're critical for billing and records but don't block daily work. Best synced when you have good WiFi (at camp, in office).

**Real Example:** Survey photos from today's work will wait until you're back at camp WiFi or office, ensuring they don't use up limited field bandwidth.

---

### Sync Modes

**Auto Sync (Default):**
- Happens automatically when connection available
- Syncs P0 first (up to 100KB)
- Then fills remaining capacity with P1, P2, P3
- Uses small burst budget (250KB per cycle)
- Retries every 5 seconds if more data remains
- Best for: Normal field work with patchy signal

**Critical Only Sync:**
- Manual option via "Sync Options" button
- Syncs ONLY P0 items
- Uses minimal data (100KB max)
- Best for: Very weak signal, short connection windows
- Use when: You need to send urgent requests but signal is terrible

**Full Sync:**
- Manual option via "Sync Options" button
- Syncs ALL priorities (P0, P1, P2, P3)
- Uses large burst budget (2MB)
- Includes images and heavy files
- Best for: Good WiFi at camp or office
- Use when: End of day, at lunch, or in office

---

### Using Sync Controls

**How to Manually Sync:**

1. **Tap Offline Banner** (if visible)
   - Or tap "Sync Options" if available

2. **Review Queue**
   - See breakdown of pending items:
     - P0: 5 items (Critical requests)
     - P1: 12 items (Messages)
     - P2: 8 items (Progress data)
     - P3: 24 items (Images)

3. **Choose Sync Mode**
   - **"Sync Critical Only"** - Fast, only P0
   - **"Sync Everything"** - Full sync, all priorities

4. **Wait for Completion**
   - Progress indicator shows sync status
   - Success message when complete

---

### Best Practices for Field Work

**For Supervisors Working On-Site:**

1. **During the Day (Weak Signal):**
   - Enter data normally, system queues it
   - If you get brief signal, let Auto Sync handle it
   - Critical requests (QC, access) sync first automatically
   - Don't worry about photos - they'll wait

2. **At Lunch or Break (Better Signal):**
   - Move to a spot with better reception
   - Let Auto Sync run for a few minutes
   - Manually tap "Sync Everything" if signal is good

3. **End of Day (Camp/Office WiFi):**
   - Connect to WiFi
   - Tap "Sync Everything"
   - Wait for all images and heavy data to upload
   - Ensures planners have complete data for next day

4. **Emergency Priority:**
   - If critical request needs to go out NOW
   - Find the best signal spot you can
   - Tap "Sync Critical Only"
   - Takes only 10-20 seconds even on weak signal

**For Planners/Masters (Office):**

1. **Check Sync Status Regularly**
   - Monitor which supervisors haven't synced recently
   - Follow up if critical data is missing

2. **Understand Timing**
   - P0 requests arrive quickly (within minutes of signal)
   - P2 progress data arrives within hours
   - P3 images may arrive end-of-day or next morning

3. **Don't Wait for Images**
   - Make decisions based on P0/P2 data
   - Images are for documentation, not blocking decisions

---

### Offline Pre-Loaded Data (Site Packs)

**What is a Site Pack?**

A site pack is a complete offline package of essential data loaded onto your device before going to site. This allows you to work completely offline with access to:

- All plant/equipment lists
- All employee names and roles
- PV Areas and Block Numbers
- Activity templates
- Site settings

**Why It Matters:**

Even with zero signal, you can:
- Select plant from dropdown menus
- Assign workers to tasks
- Choose PV Areas and Blocks
- Create activities from templates

**When Site Packs Update:**

- Before deploying to new site
- When new equipment arrives
- When new employees join
- When site layout changes

**How to Update Site Pack:**

1. Connect to good WiFi (office or camp)
2. Go to Settings
3. Tap "Update Site Data"
4. Wait for download (usually 1-2 minutes)
5. Confirmation when complete

**Site Pack Age:**
- Recommended: Update every 7 days
- System warns if older than 7 days
- Still works if outdated, but may be missing new items

---

### Troubleshooting Offline Issues

**Problem: Data Not Syncing**

✅ Check:
- Is Offline Banner showing "Offline"?
- Try moving to different location for signal
- Open Sync Options to see queue size
- Try "Sync Critical Only" first

**Problem: Too Much Queued Data**

✅ Solution:
- Connect to WiFi
- Tap "Sync Everything"
- Wait 5-10 minutes for full upload
- Queue will clear

**Problem: Images Not Uploading**

✅ Remember:
- Images are P3 - lowest priority
- Only sync on good connection
- Use "Sync Everything" on WiFi
- May take 10-30 minutes for many images

**Problem: Critical Request Stuck**

✅ Try:
- Find best signal spot on site
- Tap "Sync Critical Only"
- Takes only 10-20 seconds
- If still fails, try cellular data if available

---

### Network Quality Indicators

**What the Colors Mean:**

🔴 **Red (Offline):**
- No connection available
- All data queuing locally
- Keep working normally
- Will sync when connection returns

🟡 **Yellow (Syncing):**
- Connection available
- Data uploading now
- May be slow or intermittent
- Let it finish

🟢 **Green (Online):**
- Good connection
- All data synced
- Real-time updates flowing
- Ideal state

---

### Understanding Sync Timing

**How Long Does Sync Take?**

**P0 Critical (10-30 seconds):**
- Small data packets
- Quick even on weak signal
- Usually completes in first signal burst

**P2 Production (1-5 minutes):**
- Medium data size
- Needs stable signal for a few minutes
- Usually completes by lunch or end of shift

**P3 Heavy Data (5-30 minutes):**
- Large files (images, photos)
- Needs good WiFi or cellular
- Best done at camp or office

**Total Queue Clear:**
- Small queue (< 50 items): 5-10 minutes on WiFi
- Medium queue (50-200 items): 10-20 minutes on WiFi
- Large queue (> 200 items): 30-60 minutes on WiFi

---

### Technical Note: Firebase Indexes

**For System Administrators:**

The offline priority system uses the existing Firestore index structure. No additional indexes are required beyond those already configured in `firestore.indexes.json`.

**Existing Indexes Support:**
- Priority-based queue sorting
- Request type filtering
- Site-scoped queries
- Status-based filtering

All necessary indexes for the offline system are already in place and documented in `/REQUIRED_FIREBASE_INDEXES.md`.

---

## Common Tasks

### Adding a Task (All Roles)

The "+ ADD TASK" feature is available to most roles and works reliably:

1. Navigate to your dashboard
2. Tap "+ ADD TASK" button
3. Fill in task details:
   - Task title
   - Description
   - Assigned to
   - Due date
   - Priority level
4. Attach any relevant documents or images
5. Tap "SAVE" to create the task

### Viewing Tasks

Tasks are displayed based on your role and permissions:
- Your assigned tasks
- Team tasks (if supervisor/manager)
- All tasks (if admin)

### Updating Task Progress

1. Open the task from your list
2. Update the progress slider or status
3. Add notes or comments
4. Upload photos or documents
5. Save your changes

### Using QR Codes

QR codes are used for:
- Quick user login
- Site check-in
- Equipment tracking
- Document access

**To scan a QR code:**
1. Tap the scan icon
2. Allow camera access
3. Point camera at QR code
4. System will automatically process

---

## Tips & Best Practices

1. **Save Regularly**: Always use the SAVE button after making changes
2. **Expand for Details**: Tap blocks to expand and see full information
3. **Look for Dropdowns**: Dropdown indicators show additional options
4. **Use Filters**: Filter large lists to find information quickly
5. **QR Codes**: Keep QR codes accessible for quick login
6. **Regular Updates**: Update task progress daily for accurate tracking

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

---

## Need Help?

Contact your system administrator or Master User for assistance with:
- Account issues
- Permission problems
- Technical difficulties
- Feature requests

---

## Automatic Request Archiving

### Overview

The system automatically archives requests when they are cancelled by any user role, ensuring clean inbox management and proper audit trails.

### Archiving Rules

**When Supervisor Cancels "Add Task" Request:**
- Supervisor toggles task from active to inactive
- Request status changes to 'CANCELLED'
- Request automatically moves to archived tab
- Planner receives notification of cancellation
- Badge counter updates immediately

**When Planner/Master Rejects Request:**
- Planner clicks "Reject" button
- Request status changes to 'REJECTED'
- Request automatically moves to archived tab
- Supervisor receives rejection notification
- Badge counter updates immediately

**General Pattern:**
- Any cancellation or rejection triggers automatic archiving
- Archived requests remain viewable for audit purposes
- Badge counters only show active/pending requests
- Archived tab shows full history of all processed requests

**Important Notes:**
- Archiving is automatic - no manual action needed
- Archived items cannot be unarchived
- All data is preserved for reporting and compliance
- Filters in archived tab help find specific requests

---

## Activity Card Timestamps

### Overview

All activity cards now display timestamps at the very bottom, providing a complete audit trail of who worked on the activity and when.

**What is Shown:**

1. **Origin Date/Time**
   - Shows when the current person started working on the activity
   - Format: "Started: Jan 15, 2025 at 2:30 PM"
   - Labeled: "Origin: [Date] [Time]"

2. **Next Person's Origin Date/Time**
   - Shows when work was handed over to the next team member
   - Format: "Handed to: Jan 16, 2025 at 9:00 AM"
   - Labeled: "Next: [Date] [Time]"
   - Only appears if handover occurred

**Location:**
- Timestamps appear at the **very bottom** of all activity cards
- Visible on all activities across all menus (Trenching, Cabling, Terminations, etc.)
- Always present, even if only one person has worked on the activity

**Example Display:**
```
[Activity Details]
[Scope Block]
[Progress Bar]
[QC Status]

─────────────────────────
Origin: Jan 15, 2025 at 2:30 PM
Next: Jan 16, 2025 at 9:00 AM
```

**Purpose:**
- Provides clear audit trail
- Shows when work started and transferred
- Helps track activity timeline
- Ensures accountability across teams

**Important Notes:**
- Timestamps are automatically recorded
- Cannot be manually edited
- "Next" timestamp only appears after handover
- Visible to all team members with access to the activity

---

## Default Value Toggle for Scope Approval

### Overview

When a Planner receives a scope approval request, they can now set a default value for ALL activities within the task using a single toggle.

### How It Works

**For Planners:**

1. **Open Scope Approval Message Card**
   - Navigate to received scope request messages
   - Find the scope approval request from supervisor

2. **Enable Default Value Toggle**
   - Look for toggle: "Set Default Value for All Activities"
   - Toggle ON to activate the feature

3. **Set Default Values**
   - Enter default scope value (applies to all activities)
   - Select unit of measurement
   - This will be applied to all activities in the task

4. **Approve Scope**
   - Tap "Approve" button
   - All activities in the task receive the default scope

**What Happens:**
- All activities within the task get the same scope value and unit
- Progress bars appear immediately on all activity cards
- "Scope Pending" messages are removed from activity blocks
- Supervisor can see progress on all activities at once
- Saves significant time when multiple activities have identical scope

**Benefits:**
- Faster processing of multiple activities
- Consistency across similar activities
- Reduced manual entry for planners
- Cleaner activity cards (no pending scope messages)
- Activities can still be adjusted individually later if needed

**Important Notes:**
- Toggle is OFF by default (standard individual scope setting)
- Only affects activities within the current task
- Individual activities can be modified later if needed
- All activities must use the same unit when using default value
- Particularly useful for repetitive tasks with identical scope

---

## Task Details Overview

### Supervisor Task Details Screen

The Task Details screen provides a comprehensive overview of supervisor progress on a specific task.

**Header Block Contains:**

1. **Title**: "Task Details"
2. **PV Area**: Displayed compactly next to label (e.g., "PV Area: PV-A1")
3. **Block Number**: Hugged next to label (e.g., "Block: Block 3")
4. **Total Work Progress**: Calculated overview showing supervisor's overall progress

**Total Work Progress Calculation:**
- Sums all activity completion percentages for this supervisor
- Shows overall progress across all activities in the task
- Formula: (Sum of all activity % completed) / (Number of activities)
- Example: If 3 activities show 50%, 75%, 100%, total = 75% average
- Updates in real-time as activities are completed
- Visual progress bar shows percentage

**Purpose:**
- Provides at-a-glance overview of task completion
- Helps supervisors see their overall performance
- Assists planners in monitoring supervisor progress
- Enables quick identification of lagging tasks

---

Last Updated: January 2025
