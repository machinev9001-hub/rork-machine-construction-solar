# Project Tracker Documentation

Welcome to the Project Tracker system documentation.

## Documentation Structure

### Core Documentation
- [User Guide](./USER-GUIDE.md) - Complete guide for end users including all roles and workflows (consolidates User Manual and User Roles)
- [Technical Guide](./TECHNICAL-GUIDE.md) - System architecture, theme system, and technical details (consolidates System Overview and Theme System)
- [Quick Reference](./QUICK-REFERENCE.md) - Essential info, code patterns, and common commands for developers
- [Testing Guide](./TESTING.md) - Complete testing documentation and procedures
- [Offline System](./OFFLINE-SYSTEM.md) - Offline functionality and sync system
- [Setup Guide](./SETUP-GUIDE.md) - Installation and configuration instructions
- [API Reference](./API-REFERENCE.md) - Backend endpoints and data structures

### Firebase Documentation
- [Firebase Indexes](./FIREBASE-INDEXES.md) - All 48+ Firebase indexes including company and onboarding indexes
- [Firebase Security Rules](./FIREBASE-SECURITY-RULES.md) - Complete security rules with role-based access control
- [Firebase Setup Checklist](./FIREBASE-SETUP-CHECKLIST.md) - Pre-launch checklist and configuration guide

### Optimization & Performance
- [Optimization Improvements](./OPTIMIZATION-IMPROVEMENTS.md) - New utilities for logging, error handling, and query optimization
- [Migration Examples](./MIGRATION-EXAMPLE.md) - Before/after code examples for adopting new utilities
- [Implementation Summary](./IMPLEMENTATION-SUMMARY.md) - Complete overview of all optimization changes

### Workflow-Specific Documentation
- [Surveyor Workflow](./USER-GUIDE.md#surveyor-functions) - Complete surveyor task management guide
- [Request Workflows](./USER-GUIDE.md#request-workflows) - Task, Scope, QC, Cabling, Termination requests
- [Activities & Tasks](./USER-GUIDE.md#activities--tasks) - Complete task workflow from start to finish
- [Daily Progress Submission](./USER-GUIDE.md#submitting-daily-progress) - Three-layer locking mechanism

## Quick Start

### For Master Users
1. Create company profile in Company Settings
2. Add users through Manage Users (auto-generated User IDs)
3. Assign appropriate roles to each user
4. Share QR codes or credentials with users
5. (Optional) Configure theme settings for global or per-UI customization

### For Supervisors
1. Log in with your credentials
2. Access your assigned tasks and activities
3. Submit daily "Completed Today" values with three-layer locking
4. Request scope, QC, or surveyor support as needed
5. Track request status and progress in your dashboard

### For Planners
1. Monitor incoming requests across all tabs
2. Badge counters show pending items needing attention
3. Review and approve/reject requests with required details
4. Schedule handovers and QC inspections
5. Assign surveyors to surveyor task requests

### For Surveyors
1. View approved tasks in your dashboard
2. Execute surveys at specified PV Areas and Blocks
3. Upload images to surveyor library
4. Share images with supervisors and planners
5. Mark tasks complete when finished

## Recent Updates (January 2025)

### New Features
1. **Surveyor Workflow Module** - Complete surveyor task management from request to completion
2. **Enhanced "Completed Today"** - Three-layer locking with toast warnings
3. **Automatic Request Archiving** - Smart inbox management with auto-archiving
4. **Task Details Progress** - Total work progress calculation and display
5. **Theme System** - Customizable themes with global and per-UI modes
6. **Documentation Consolidation** - Streamlined documentation structure

### System Capabilities
- **6 Request Types**: Task, Scope, QC, Cabling, Termination, Surveyor
- **10 User Roles**: Full role-based access control
- **7 Workflow States**: Complete request lifecycle tracking
- **3 Lock Types**: Comprehensive daily submission control
- **5 Built-in Themes**: Default, Dark Mode, High Contrast, Field Mode, Blueprint Mode
- **48+ Firebase Indexes**: Optimized query performance

## Common Tasks by Role

### Master User
- [Creating Company Profile](./USER-GUIDE.md#company-settings)
- [Managing Users](./USER-GUIDE.md#manage-users)
- [Configuring Theme Settings](./USER-GUIDE.md#theme-settings-master-only)
- [Generating QR Codes](./USER-GUIDE.md#viewing-user-information)

### Supervisor
- [Requesting Task Access](./USER-GUIDE.md#requesting-task-access)
- [Submitting Daily Progress](./USER-GUIDE.md#submitting-daily-progress)
- [Creating Surveyor Requests](./USER-GUIDE.md#creating-surveyor-task-requests)
- [Requesting QC Inspection](./USER-GUIDE.md#requesting-qc-inspection)
- [Requesting Handovers](./USER-GUIDE.md#requesting-handovers)

### Planner
- [Approving Task Requests](./USER-GUIDE.md#approving-task-access-requests)
- [Setting Activity Scope](./USER-GUIDE.md#setting-activity-scope)
- [Scheduling QC Inspections](./USER-GUIDE.md#scheduling-qc-inspections)
- [Managing Handover Requests](./USER-GUIDE.md#managing-handover-requests)

### Surveyor
- [Viewing Assigned Tasks](./USER-GUIDE.md#viewing-assigned-tasks)
- [Using Image Library](./USER-GUIDE.md#using-image-library)
- [Executing Tasks](./USER-GUIDE.md#executing-tasks)

## Support

For technical support or questions, contact the system administrator.

### Common Support Topics
- Account and login issues
- Permission and access problems
- Request workflow questions
- Technical difficulties
- Feature enhancement requests

---

## Documentation Changes

### Consolidated Files (January 2025)
The following documentation has been consolidated for better organization:

**USER-GUIDE.md** (New) - Consolidates:
- USER-MANUAL.md (archived)
- USER-ROLES.md (archived)

**TECHNICAL-GUIDE.md** (New) - Consolidates:
- SYSTEM-OVERVIEW.md (archived)
- THEME-SYSTEM.md (archived)

**FIREBASE-INDEXES.md** (Enhanced) - Already includes:
- COMPANY-INDEXES.md (can be archived)
- ONBOARDING-INDEXES.md (can be archived)

**Standalone Documentation** (Retained):
- TESTING.md - Testing and quality assurance
- OFFLINE-SYSTEM.md - Offline functionality and sync
- ROW-COLUMN-NAMING-CHANGE.md - Specific naming convention changes

---
Last Updated: January 2025
