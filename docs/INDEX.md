# Project Tracker Documentation

Welcome to the Project Tracker system documentation.

## Documentation Structure

### Core Documentation
- [User Manual](./USER-MANUAL.md) - Complete guide for end users including surveyor workflows
- [System Overview](./SYSTEM-OVERVIEW.md) - Technical architecture and recent feature updates
- [Database Structure](./DATABASE-STRUCTURE.md) - Collections, indexes, and data models
- [User Roles & Permissions](./USER-ROLES.md) - Role definitions and access levels
- [Login System Implementation](./LOGIN-SYSTEM-IMPLEMENTATION.md) - Authentication methods and flows (ID Number + PIN)
- [Setup Guide](./SETUP-GUIDE.md) - Installation and configuration instructions
- [API Reference](./API-REFERENCE.md) - Backend endpoints and data structures

### Workflow-Specific Documentation
- [Surveyor Workflow](./USER-MANUAL.md#surveyor-workflow) - Complete surveyor task management guide
- [Request Workflows](./USER-MANUAL.md#request-workflows) - Task, Scope, QC, Cabling, Termination requests
- [Completed Today Workflow](./USER-MANUAL.md#supervisor-completed-today-workflow) - Daily submission and locking mechanism
- [QC Workflow](./USER-MANUAL.md#qc-workflow) - Quality control inspection process

## Quick Start

### For Master Users
1. Create company profile in Company Settings
2. Add users through Manage Users (auto-generated User IDs)
3. Assign appropriate roles to each user
4. Share QR codes or credentials with users

### For Supervisors
1. Log in with your credentials
2. Access your assigned tasks and activities
3. Submit daily "Completed Today" values with toast warning acknowledgment
4. Request scope, QC, or surveyor support as needed
5. Track request status in your dashboard

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

### System Capabilities
- **6 Request Types**: Task, Scope, QC, Cabling, Termination, Surveyor
- **9 User Roles**: Full role-based access control
- **7 Workflow States**: Complete request lifecycle tracking
- **3 Lock Types**: Comprehensive daily submission control
- **48+ Firebase Indexes**: Optimized query performance

## Common Tasks by Role

### Master User
- [Creating Company Profile](./USER-MANUAL.md#company-settings)
- [Managing Users](./USER-MANUAL.md#manage-users)
- [Generating QR Codes](./USER-MANUAL.md#viewing-user-information)

### Supervisor
- [Requesting Task Access](./USER-MANUAL.md#supervisor-requesting-task-access)
- [Submitting Completed Today](./USER-MANUAL.md#understanding-completed-today)
- [Requesting Surveyor Tasks](./USER-MANUAL.md#supervisor-creating-surveyor-task-requests)
- [Requesting QC Inspection](./USER-MANUAL.md#supervisor-requesting-qc-inspection)

### Planner
- [Approving Task Requests](./USER-MANUAL.md#planner-approving-task-access-requests)
- [Setting Activity Scope](./USER-MANUAL.md#planner-setting-activity-scope)
- [Scheduling QC Inspections](./USER-MANUAL.md#planner-scheduling-qc-inspections)
- [Managing Surveyor Requests](./USER-MANUAL.md#planner-reviewing-surveyor-requests)
- [Managing Handovers](./USER-MANUAL.md#handover-requests)

### Surveyor
- [Viewing Assigned Tasks](./USER-MANUAL.md#surveyor-executing-assigned-tasks)
- [Using Image Library](./USER-MANUAL.md#surveyor-image-library)
- [Sharing Survey Results](./USER-MANUAL.md#step-3-share-survey-results)

## Support

For technical support or questions, contact the system administrator.

### Common Support Topics
- Account and login issues
- Permission and access problems
- Request workflow questions
- Technical difficulties
- Feature enhancement requests

---
Last Updated: January 2025
