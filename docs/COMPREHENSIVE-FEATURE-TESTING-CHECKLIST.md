# Comprehensive Feature Testing Checklist

**Document Purpose:** Complete testing checklist for all features, workflows, and user roles in the system.

**Last Updated:** 2025-12-04  
**Status:** Production-Ready

---

## Table of Contents

1. [Authentication & Session Management](#1-authentication--session-management)
2. [Master Account Features](#2-master-account-features)
3. [Dynamic Menu System](#3-dynamic-menu-system)
4. [Planner Workflows](#4-planner-workflows)
5. [Supervisor Workflows](#5-supervisor-workflows)
6. [QC Workflows](#6-qc-workflows)
7. [Plant Manager Workflows](#7-plant-manager-workflows)
8. [Staff Manager Workflows](#8-staff-manager-workflows)
9. [Logistics Manager Workflows](#9-logistics-manager-workflows)
10. [Onboarding & HR](#10-onboarding--hr)
11. [Billing & Configuration](#11-billing--configuration)
12. [Face Recognition System](#12-face-recognition-system)
13. [Progress Tracking & Reporting](#13-progress-tracking--reporting)
14. [Offline System & Sync](#14-offline-system--sync)
15. [QR Code System](#15-qr-code-system)
16. [Multi-Tenant & Company Management](#16-multi-tenant--company-management)
17. [Settings & User Management](#17-settings--user-management)
18. [Cross-Platform Compatibility](#18-cross-platform-compatibility)
19. [Performance & Security](#19-performance--security)

---

## 1. Authentication & Session Management

### Master Account Login
- [ ] Login with Master ID and PIN
- [ ] Invalid credentials show error message
- [ ] Company selector appears after successful login
- [ ] Can switch between companies
- [ ] Site selection works correctly
- [ ] User info persists during session

### Employee Login
- [ ] Login with Employee ID number and PIN
- [ ] Employee assigned to correct site
- [ ] Role-specific home screen loads
- [ ] Site name displays on home screen (small indicator)
- [ ] Invalid credentials handled properly

### QR Code Authentication
- [ ] QR scanner opens correctly
- [ ] Scan QR code to log in to site
- [ ] Proper permissions requested for camera
- [ ] Site context loaded correctly
- [ ] Error handling for invalid QR codes

### Session Management
- [ ] Session expires after 5 minutes of inactivity
- [ ] Page refresh clears session
- [ ] Logout works correctly
- [ ] Logout confirmation dialog appears
- [ ] User redirected to login after logout
- [ ] No data persists after logout

---

## 2. Master Account Features

### Company Management
- [ ] Create new company
- [ ] Edit company details
- [ ] View company list
- [ ] Switch between companies
- [ ] Company selector shows all accessible companies
- [ ] Industry sector selection works

### Site Management
- [ ] Create new site within company
- [ ] Edit site details
- [ ] View all sites for company
- [ ] Select site to work on
- [ ] Site-specific data isolation verified
- [ ] Generate site QR code

### Master Dashboard Access
- [ ] Access Planner features
- [ ] Access Supervisor features
- [ ] Access QC features
- [ ] Access Plant Manager features
- [ ] Access Staff Manager features
- [ ] Access Logistics features
- [ ] Access Onboarding features
- [ ] Access Subcontractors management

### Master-Specific Features
- [ ] Admin panel access
- [ ] Admin PIN verification works
- [ ] Company setup wizard
- [ ] Company settings page
- [ ] Master PIN setup
- [ ] Seed menus functionality
- [ ] Menu manager access
- [ ] Debug information page
- [ ] Generate QR codes

---

## 3. Dynamic Menu System

### Menu Manager (Master Only)
- [ ] Access menu manager page
- [ ] View all main menu items
- [ ] View all sub-menu items
- [ ] View all activities
- [ ] Add new main menu item
- [ ] Add new sub-menu item
- [ ] Add new activity item
- [ ] Edit existing menu items
- [ ] Delete menu items (with cleanup)
- [ ] Sort order works correctly
- [ ] Expand/collapse main menus
- [ ] Expand/collapse sub-menus

### Activity Module Configuration
- [ ] Configure scope policy (NONE, BOQ, GRID, BOQ+GRID)
- [ ] Set measurement unit
- [ ] Enable/disable handover requests
- [ ] Enable/disable QC requests
- [ ] Enable/disable grid tracking
- [ ] Set grid tracking type (ACTION_CHECKLIST, SURVEYOR_MEASUREMENTS)
- [ ] Activity module settings save correctly

### Menu Display for Roles
- [ ] Supervisor sees dynamically created menus
- [ ] Main menu items display correctly
- [ ] Sub-menu items display under correct main menu
- [ ] Activities display under correct sub-menu
- [ ] Module configuration applies correctly
- [ ] Hard-coded menus still appear if needed
- [ ] Menu hierarchy is correct

### Orphaned Data Cleanup
- [ ] Deleting main menu cascades to sub-menus
- [ ] Deleting sub-menu cascades to activities
- [ ] Deleting activity removes related activities collection data
- [ ] Deleting activity removes related requests
- [ ] Cleanup runs successfully without errors

---

## 4. Planner Workflows

### Home Screen
- [ ] Planner menu item appears
- [ ] Navigate to planner dashboard
- [ ] Site name indicator visible on home screen
- [ ] All role-specific menu items visible

### Request Management
- [ ] View all pending requests
- [ ] Filter requests by type (Activity, Task, QC, Cabling, Termination, Handover, Commissioning, Concrete, Surveyor)
- [ ] View request details
- [ ] Approve request
- [ ] Reject request
- [ ] Request counter updates in real-time
- [ ] Approved requests create activities/tasks
- [ ] Supervisor receives notification

### Activity Requests
- [ ] View activity request list
- [ ] See scope amount, unit, supervisor name
- [ ] Approve activity request
- [ ] Activity created in activities collection
- [ ] Reject with reason
- [ ] Request removed from list after action

### Task Requests
- [ ] View task request list
- [ ] See taskId, taskName, activityName
- [ ] Approve task request
- [ ] Task gets approved status
- [ ] Supervisor can start work on task

### QC Requests
- [ ] View QC request list
- [ ] See activity details
- [ ] Approve/reject QC
- [ ] Activity status updates
- [ ] QC can proceed with inspection

### Handover Requests
- [ ] View handover request list
- [ ] See handover details
- [ ] Approve handover
- [ ] Next activity unlocked
- [ ] Workflow progression works

### Cabling/Termination/Commissioning Requests
- [ ] View specific request type
- [ ] Approve/reject each type
- [ ] Specialist can proceed after approval

---

## 5. Supervisor Workflows

### Home Screen
- [ ] Supervisor menu item appears
- [ ] Navigate to supervisor dashboard
- [ ] Site name indicator visible on home screen
- [ ] Dynamic menus display correctly

### Dynamic Menu Navigation
- [ ] Main menu items created in menu manager appear
- [ ] Click main menu opens sub-menu list
- [ ] Sub-menu items display correctly
- [ ] Click sub-menu shows activities
- [ ] Activities list with proper configuration

### Activity Management
- [ ] View activity list for sub-menu
- [ ] See activity name, scope, unit
- [ ] See total vs completed progress
- [ ] Grid view shows blocks/rows/columns (if enabled)
- [ ] Action checklist view (if enabled)
- [ ] Click activity opens detail view

### Request Activity Scope
- [ ] Request button visible
- [ ] Fill in scope amount
- [ ] Submit request to planner
- [ ] Request appears in planner's queue
- [ ] Approval notification received
- [ ] Activity appears after approval

### Task Management
- [ ] View tasks for activity
- [ ] Request new task
- [ ] Enter task details
- [ ] Submit task request
- [ ] Planner approval workflow
- [ ] Start work on approved task
- [ ] Update progress on task
- [ ] Complete task

### Grid Tracking (if enabled)
- [ ] View PV blocks
- [ ] View rows in block
- [ ] View columns in row
- [ ] Track progress at column level
- [ ] Action checklist per cell
- [ ] Mark checklist items complete
- [ ] Cell completion updates progress
- [ ] Progress rolls up to activity level

### Action Checklist Tracking
- [ ] View action checklist for activity
- [ ] See all checklist items
- [ ] Mark item as complete
- [ ] Completion percentage updates
- [ ] Lock prevents duplicate completion
- [ ] Progress syncs to dashboard

### Completed Today Entry
- [ ] Enter "Completed Today" value
- [ ] Unit matches activity configuration
- [ ] Lock prevents multiple entries same day
- [ ] Lock resets at midnight
- [ ] Total completed updates
- [ ] Progress percentage recalculates

### Handover Workflow
- [ ] Request handover (if enabled in module)
- [ ] Handover request sent to planner
- [ ] Planner approval required
- [ ] Next activity unlocks after approval
- [ ] Handover status visible

### QC Workflow
- [ ] Request QC (if enabled in module)
- [ ] QC request sent to planner
- [ ] Planner approval required
- [ ] QC inspector notified
- [ ] QC inspection can proceed
- [ ] Activity status updates after QC

### Messages
- [ ] View messages for tasks
- [ ] Send message
- [ ] Receive notifications
- [ ] Message history visible

---

## 6. QC Workflows

### Home Screen
- [ ] QC menu item appears
- [ ] Navigate to QC dashboard
- [ ] Site name indicator visible on home screen

### QC Request Management
- [ ] View pending QC requests
- [ ] View scheduled QC inspections
- [ ] View completed QC inspections
- [ ] Filter by activity type
- [ ] See activity details

### QC Inspection
- [ ] Open QC request
- [ ] View activity information
- [ ] Mark inspection complete
- [ ] Pass/fail status
- [ ] Add inspection notes
- [ ] Update activity status
- [ ] Notify supervisor of results

---

## 7. Plant Manager Workflows

### Home Screen
- [ ] Plant Manager menu item appears
- [ ] Navigate to plant manager dashboard
- [ ] Site name indicator visible on home screen

### Plant Asset Management
- [ ] View all plant assets
- [ ] Filter by asset type
- [ ] Search assets
- [ ] View asset details
- [ ] Add new asset
- [ ] Edit asset details
- [ ] Asset checklist completion

### Asset Allocation
- [ ] View allocation requests
- [ ] Approve/reject allocation request
- [ ] Allocate asset to site
- [ ] Set allocation dates
- [ ] Assign operator to asset
- [ ] View allocation overview
- [ ] Track asset location

### Asset Operator Management
- [ ] Change asset operator
- [ ] View operator history
- [ ] Track operator hours
- [ ] Operator performance metrics

### Asset Hours Tracking
- [ ] Record daily hours for asset
- [ ] View asset timesheet
- [ ] Calculate total hours
- [ ] Export asset hours report
- [ ] Track maintenance schedules

### EPH (Estimated Plant Hours)
- [ ] Set EPH for asset
- [ ] View EPH vs actual hours
- [ ] Generate EPH reports

---

## 8. Staff Manager Workflows

### Home Screen
- [ ] Staff Manager menu item appears
- [ ] Navigate to staff manager dashboard
- [ ] Site name indicator visible on home screen

### Employee Management
- [ ] View all employees
- [ ] Filter by role
- [ ] Search employees
- [ ] Add new employee
- [ ] Edit employee details
- [ ] View employee profile
- [ ] Setup employee PIN
- [ ] Assign employee to site

### Staff Allocation
- [ ] View staff allocation requests
- [ ] Approve/reject allocation
- [ ] Allocate staff to site
- [ ] Set allocation dates
- [ ] View allocation overview
- [ ] Track staff assignments

### Employee Timesheets
- [ ] View employee timesheet
- [ ] Record work hours
- [ ] Track overtime
- [ ] Generate timesheet reports
- [ ] Export timesheets

### Operator Man-Hours
- [ ] Track operator man-hours
- [ ] View operator dashboard
- [ ] Generate man-hours reports

---

## 9. Logistics Manager Workflows

### Home Screen
- [ ] Logistics menu item appears
- [ ] Navigate to logistics dashboard
- [ ] Site name indicator visible on home screen

### Materials Management
- [ ] View materials requests
- [ ] Approve/reject material requests
- [ ] Track material delivery
- [ ] Update material status
- [ ] View materials inventory

### Logistics Coordination
- [ ] Coordinate deliveries
- [ ] Track shipments
- [ ] Update delivery schedules
- [ ] Notify site of arrivals

---

## 10. Onboarding & HR

### Home Screen
- [ ] Onboarding menu item appears
- [ ] Navigate to onboarding dashboard
- [ ] Site name indicator visible on home screen

### Employee Onboarding
- [ ] View onboarding dashboard
- [ ] View employees list
- [ ] Add new employee
- [ ] Employee detail page
- [ ] Complete onboarding steps
- [ ] Face enrollment (if enabled)
- [ ] Setup employee PIN
- [ ] Assign to site

### Asset Onboarding
- [ ] View assets list
- [ ] Add new asset
- [ ] Asset detail page
- [ ] Complete asset checklist
- [ ] Upload asset documents
- [ ] Assign asset number

### Induction Messages
- [ ] View messages
- [ ] Create induction message
- [ ] Send to employees
- [ ] Track message delivery
- [ ] Employee acknowledgment

---

## 11. Billing & Configuration

### Billing Config Page
- [ ] Access billing config (from Settings menu)
- [ ] View billing configuration tabs
- [ ] Configure weekday billing
- [ ] Configure Saturday billing
- [ ] Configure Sunday billing
- [ ] Configure public holiday billing
- [ ] Set billing method (per hour / minimum billing)
- [ ] Set rate multipliers
- [ ] Set minimum hours
- [ ] Enable/disable day types
- [ ] Configure rain day policy
- [ ] Save button works correctly
- [ ] Configuration persists after save
- [ ] Validation for required fields

### EPH Configuration
- [ ] View EPH records
- [ ] Add EPH for asset
- [ ] Edit EPH record
- [ ] Delete EPH record
- [ ] Search/filter assets

### Timesheets View
- [ ] View timesheet records
- [ ] Filter by date range
- [ ] Filter by asset/operator
- [ ] Export timesheets
- [ ] Calculate totals

---

## 12. Face Recognition System

### Face Enrollment
- [ ] Access face enrollment page
- [ ] Camera permission requested
- [ ] Camera preview displays
- [ ] Capture face photo
- [ ] Face detection works
- [ ] Face encoding generated
- [ ] Face data saved to secure store
- [ ] Associate face with employee ID
- [ ] Success confirmation

### Face Clock In/Out
- [ ] Access face clock page
- [ ] Camera opens automatically
- [ ] Face recognition runs
- [ ] Match employee from database
- [ ] Clock in recorded
- [ ] Clock out recorded
- [ ] Time stamp accurate
- [ ] Location captured (if enabled)
- [ ] Success/failure message shown

### Face Recognition Settings
- [ ] Configure face recognition
- [ ] Enable/disable face clock
- [ ] Set recognition threshold
- [ ] Manage enrolled faces
- [ ] Delete face data

---

## 13. Progress Tracking & Reporting

### Dashboard (Moved to Settings Menu)
- [ ] Access dashboard from Settings menu
- [ ] View overall progress
- [ ] Filter by date range
- [ ] Filter by activity type
- [ ] View by main menu
- [ ] View by sub-menu
- [ ] Real-time updates

### Progress Report (Moved to Settings Menu)
- [ ] Access progress report from Settings menu
- [ ] Select date range
- [ ] Select activities
- [ ] Generate report
- [ ] View BOQ progress
- [ ] View completed vs planned
- [ ] Export report (PDF/Excel)
- [ ] Weekly progress chart

### BOQ Progress Dashboard
- [ ] View BOQ items
- [ ] See total vs completed quantities
- [ ] Percentage completion
- [ ] Progress bar visualization
- [ ] Filter by trade/activity
- [ ] Real-time sync

### Activity Detail View
- [ ] Click activity to view details
- [ ] See total scope amount
- [ ] See completed amount
- [ ] See remaining amount
- [ ] View completion percentage
- [ ] View task list
- [ ] View progress history
- [ ] View grid breakdown (if enabled)

### Per User Progress
- [ ] View progress by user
- [ ] Select user/employee
- [ ] See activities worked on
- [ ] See completion amounts
- [ ] See time tracking
- [ ] Generate user report

### Weekly Progress Chart
- [ ] View weekly progress graph
- [ ] See daily completions
- [ ] Compare weeks
- [ ] Filter by activity
- [ ] Interactive chart

---

## 14. Offline System & Sync

### Offline Operations
- [ ] App works without internet
- [ ] Operations queued offline
- [ ] Offline banner displays
- [ ] Pending count shown
- [ ] P0 operations prioritized
- [ ] User sees queued operations

### Sync System
- [ ] Auto-sync when online
- [ ] Manual sync button works
- [ ] P0 operations sync first
- [ ] P1 operations sync next
- [ ] P2 operations sync last
- [ ] Failed operations shown
- [ ] Retry failed operations
- [ ] Sync indicator in header
- [ ] Real-time sync status

### Data Freshness
- [ ] Real-time listeners active
- [ ] Timestamp comparison works
- [ ] Fresher data prioritized
- [ ] P0 sync notification appears
- [ ] Pull-to-refresh works on lists
- [ ] Banner shows sync status

### Offline Cache
- [ ] User cache works offline
- [ ] Employee cache populated
- [ ] Task cache functional
- [ ] Site pack downloaded
- [ ] Site pack used offline
- [ ] Cache updates when online

---

## 15. QR Code System

### QR Code Generation
- [ ] Generate plant QR codes
- [ ] Generate employee QR codes
- [ ] Generate site QR codes
- [ ] QR code displays correctly
- [ ] Print QR codes page works
- [ ] Multiple QR codes printed

### QR Code Scanning
- [ ] QR scanner opens
- [ ] Camera permission handled
- [ ] Scan QR code successfully
- [ ] Valid QR code recognized
- [ ] Invalid QR code rejected
- [ ] Navigate to correct page after scan
- [ ] Site context loaded from QR
- [ ] Employee info loaded from QR

---

## 16. Multi-Tenant & Company Management

### Company Isolation
- [ ] Data isolated per company
- [ ] Users cannot see other company data
- [ ] Sites isolated per company
- [ ] Activities isolated per site
- [ ] Requests isolated per site
- [ ] BOQ isolated per site

### Company Selector
- [ ] Company selector appears at login
- [ ] List all accessible companies
- [ ] Select company
- [ ] Company context persists
- [ ] Switch between companies
- [ ] Site selection after company selection

### Company Settings
- [ ] View company details
- [ ] Edit company name
- [ ] Edit company contact info
- [ ] Edit industry sector
- [ ] Save company settings
- [ ] Settings persist

---

## 17. Settings & User Management

### Settings Menu (Reorganized)
- [ ] Access settings tab
- [ ] Account information displayed
- [ ] Company details expandable
- [ ] Site details shown
- [ ] **Billing** menu item (moved to Settings)
- [ ] **Dashboard** menu item (moved to Settings)
- [ ] **Progress Report** menu item (moved to Settings)

### User Management (Master)
- [ ] Access manage users
- [ ] View all users
- [ ] Add new user
- [ ] Edit user details
- [ ] Delete user
- [ ] Assign user role
- [ ] Assign user to site
- [ ] Reset user PIN

### Admin Panel (Master)
- [ ] Access admin panel
- [ ] Admin PIN verification
- [ ] View system stats
- [ ] Access debug features
- [ ] Manage global settings

### Debug Features (Master)
- [ ] Debug info page
- [ ] Debug progress page
- [ ] View system logs
- [ ] Test offline queue
- [ ] Test sync system
- [ ] Clear cache

---

## 18. Cross-Platform Compatibility

### Mobile (iOS/Android)
- [ ] App runs on iOS
- [ ] App runs on Android
- [ ] Camera works on both platforms
- [ ] Face recognition works
- [ ] QR scanner works
- [ ] Offline storage works
- [ ] Push notifications work (if enabled)
- [ ] Gestures work correctly
- [ ] Safe area handled correctly

### Web
- [ ] App runs in web browser
- [ ] Camera polyfill works
- [ ] Face recognition polyfilled
- [ ] QR scanner works
- [ ] Offline storage works (localStorage)
- [ ] Responsive design
- [ ] Desktop navigation works
- [ ] Mobile web navigation works

### Tablet
- [ ] Optimized layout for tablets
- [ ] Side-by-side views work
- [ ] Larger touch targets
- [ ] Grid view optimized

---

## 19. Performance & Security

### Performance
- [ ] App loads within 3 seconds
- [ ] Navigation is smooth
- [ ] Lists scroll smoothly
- [ ] Images load efficiently
- [ ] No memory leaks
- [ ] Cache used effectively
- [ ] Real-time updates don't lag

### Security
- [ ] PIN authentication secure
- [ ] Session timeout works
- [ ] Data encrypted at rest (face data)
- [ ] Firebase security rules enforce isolation
- [ ] No data leaks between companies
- [ ] User cannot access unauthorized pages
- [ ] QR codes properly validated
- [ ] Admin features protected

### Locking Systems
- [ ] Task lock prevents concurrent edits
- [ ] Lock expires after timeout
- [ ] Completed today lock prevents duplicates
- [ ] Lock resets at midnight UTC
- [ ] Grid cell lock works
- [ ] QC toggle lock works

### Error Handling
- [ ] User-friendly error messages
- [ ] Network errors handled gracefully
- [ ] Form validation works
- [ ] Required fields enforced
- [ ] Invalid input rejected
- [ ] Error boundaries catch crashes
- [ ] Console logs for debugging

---

## Testing Summary Stats

### Total Features Tested
- **20 major feature categories**
- **300+ individual test cases**
- **8 user roles covered**
- **Dynamic menu system integration**
- **Multi-tenant architecture**
- **Offline-first capabilities**

### Priority Testing Areas
1. **P0 - Critical:** Authentication, Session Management, Data Isolation
2. **P1 - High:** Dynamic Menus, Request Workflows, Progress Tracking
3. **P2 - Medium:** Reports, Billing, Admin Features
4. **P3 - Low:** Debug Tools, Advanced Settings

---

## Test Execution Guide

### Pre-Testing Setup
1. Create test company
2. Create test site
3. Add test users for each role
4. Configure dynamic menus
5. Add test data (activities, tasks)
6. Configure billing settings

### Testing Order
1. Start with authentication
2. Test master account features
3. Create dynamic menus
4. Test each role workflow
5. Test cross-role interactions
6. Test offline mode
7. Test sync system
8. Verify data isolation
9. Test edge cases
10. Performance testing

### Post-Testing
1. Review all test results
2. Document any bugs found
3. Verify critical paths work
4. Check performance metrics
5. Security audit
6. Generate test report

---

## Related Documentation

- [TESTING.md](./TESTING.md) - Automated testing guide
- [SUPERVISOR-CHECKLIST.md](./SUPERVISOR-CHECKLIST.md) - Old supervisor checklist (legacy)
- [USER-MANUAL.md](./USER-MANUAL.md) - User documentation
- [COMPLETE-WORKFLOW-DOCUMENTATION.md](./COMPLETE-WORKFLOW-DOCUMENTATION.md) - Workflow details
- [SYSTEM-OVERVIEW.md](./SYSTEM-OVERVIEW.md) - System architecture

---

**Document Version:** 2.0  
**Generated:** 2025-12-04  
**System:** Complete Construction Management System  
**Status:** Ready for Testing
