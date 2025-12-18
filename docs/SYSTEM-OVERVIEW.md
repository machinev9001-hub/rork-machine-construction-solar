# System Overview - Project Tracker

> **⚠️ NOTICE: This file has been consolidated into [TECHNICAL-GUIDE.md](./TECHNICAL-GUIDE.md)**  
> Please refer to the new consolidated documentation for the most up-to-date information.  
> This file is kept for reference but may not be maintained going forward.

## Architecture

### Technology Stack

**Frontend:**
- React Native with Expo SDK 54
- TypeScript for type safety
- Expo Router for navigation
- React Native components

**Backend:**
- Firebase Authentication
- Cloud Firestore (NoSQL database)
- Firebase Storage (for files/images)

**State Management:**
- React Context API (@nkzw/create-context-hook)
- React Query for server state
- AsyncStorage for local persistence

---

## Application Structure

```
project-tracker/
├── app/                          # Expo Router pages
│   ├── _layout.tsx              # Root layout
│   ├── login.tsx                # Login screen
│   ├── master-signup.tsx        # Master user registration
│   ├── company-settings.tsx     # Company profile management
│   ├── manage-users.tsx         # User management screen
│   ├── add-user.tsx             # Add new user screen
│   ├── modal.tsx                # Modal screens
│   ├── +not-found.tsx           # 404 page
│   └── (tabs)/                  # Tab-based navigation
│       ├── _layout.tsx          # Tabs layout
│       ├── index.tsx            # Home/Dashboard
│       └── settings.tsx         # Settings screen
│
├── components/                   # Reusable components
│   └── QRCodeGenerator.tsx      # QR code generation
│
├── contexts/                     # React contexts
│   └── AuthContext.tsx          # Authentication state
│
├── types/                        # TypeScript definitions
│   └── index.ts                 # Shared types
│
├── constants/                    # App constants
│   └── colors.ts                # Color scheme
│
├── config/                       # Configuration files
│   └── firebase.ts              # Firebase setup
│
├── docs/                         # Documentation (this folder)
│   ├── README.md
│   ├── USER-MANUAL.md
│   ├── SYSTEM-OVERVIEW.md
│   ├── DATABASE-STRUCTURE.md
│   ├── USER-ROLES.md
│   └── SETUP-GUIDE.md
│
└── assets/                       # Static assets
    └── images/                   # App icons and images
```

---

## Key Features

### 1. Authentication & Authorization
- Firebase Authentication
- QR code-based login
- Role-based access control (9 roles)
- Password reset functionality
- Session management

### 2. User Management
- Master user creates company profile
- Add/edit/delete users
- Role assignment
- QR code generation per user
- User filtering and search
- Expandable user cards

### 3. Company Management
- Company profile setup
- Legal entity information
- Contact information
- VAT and registration details
- Expandable settings sections

### 4. Task Management
- Create tasks with full details
- Assign to users
- Progress tracking
- Priority levels
- Due dates
- Attachments support

### 5. QR Code System
- User login QR codes
- Printable for physical distribution
- High-resolution viewing
- Secure token-based

---

## Design Principles

### 1. Mobile-First
- Optimized for mobile screens
- Touch-friendly interface
- Responsive layouts
- Native feel

### 2. Clarity
- Expandable sections to reduce clutter
- Dropdown indicators for select fields
- Clear save buttons
- Visual feedback

### 3. User Experience
- Minimal scrolling required
- Progressive disclosure (expand for details)
- Filter options for large lists
- Quick access to common actions

### 4. Security
- Role-based permissions
- Secure authentication
- Data encryption
- Activity logging

---

## Data Flow

### User Authentication Flow
```
1. User enters credentials or scans QR
   ↓
2. Firebase Authentication validates
   ↓
3. Fetch user profile from Firestore
   ↓
4. Load role and permissions
   ↓
5. Redirect to appropriate dashboard
```

### Task Creation Flow
```
1. User taps "+ ADD TASK"
   ↓
2. Fill in task details form
   ↓
3. Select assignee and dates
   ↓
4. Tap "SAVE" button
   ↓
5. Validate required fields
   ↓
6. Create task in Firestore
   ↓
7. Send notification to assignee
   ↓
8. Update UI with new task
```

### User Management Flow
```
1. Master User navigates to Manage Users
   ↓
2. View list of existing users
   ↓
3. Tap "+ ADD USER"
   ↓
4. Enter User ID (required)
   ↓
5. Fill optional fields
   ↓
6. Select role from dropdown
   ↓
7. Tap "SAVE"
   ↓
8. Generate QR code
   ↓
9. Create user account
   ↓
10. Display in user list
```

---

## Security Model

### Authentication
- Firebase Authentication with email/password
- QR code contains encrypted token
- Session timeout after inactivity
- Password strength requirements

### Authorization
- Role checked at database level (Firestore rules)
- Role checked at application level (before rendering)
- Action-based permissions
- Resource-based permissions (own vs. others)

### Data Protection
- All data encrypted in transit (HTTPS)
- Firestore rules prevent unauthorized access
- Activity logging for audit trail
- Sensitive data (passwords) never stored in plain text

---

## Performance Considerations

### Database Optimization
- 48 strategic indexes for fast queries
- Composite indexes for common query patterns
- User-centric indexing (70% of indexes)
- Status and date-based indexing

### Query Optimization
- Pagination for large lists (25-50 items per page)
- Filter before fetching from database
- Cache frequently accessed data
- Real-time listeners only where needed

### UI Performance
- Expandable cards to reduce initial render
- Lazy loading of images
- Optimistic updates for better UX
- Debounced search inputs

---

## Error Handling

### User-Facing Errors
- Clear error messages
- Recovery suggestions
- Retry mechanisms
- Offline detection

### System Errors
- Error logging to monitoring service
- Graceful degradation
- Fallback UI states
- Error boundaries in React

---

## Offline Support

### Capabilities
- View cached data
- Queue actions for sync
- Offline indicator
- Auto-sync when online

### Limitations
- Cannot create new records offline
- Real-time updates unavailable
- QR code scanning requires connection
- Image uploads require connection

---

## Future Enhancements

### Planned Features
1. Document management system
2. Advanced reporting and analytics
3. Equipment tracking with QR codes
4. Site check-in/check-out system
5. Time tracking per task
6. Budget tracking per project
7. Mobile app notifications
8. Integration with external tools
9. Export data to Excel/PDF
10. Multi-language support

### Technical Improvements
1. Progressive Web App (PWA) support
2. Offline-first architecture
3. Advanced caching strategies
4. Performance monitoring
5. Automated testing
6. CI/CD pipeline
7. Version control for data
8. Backup and disaster recovery

---

## Recent Features & Enhancements

### Surveyor Workflow Module (January 2025)
**Complete surveyor task management system:**
- Supervisor request creation with PV Area, Block Number, and image linking
- Planner approval workflow with surveyor assignment
- Surveyor image library with permanent storage
- Image sharing between team members
- Task execution tracking and completion notifications
- Full integration with notification system

### Enhanced "Completed Today" Workflow (January 2025)
**Three-layer locking mechanism:**
- Submit Button Lock: Supervisors explicitly submit daily totals
- QC Interaction Lock: Locks when QC submits inspection value
- Time Lock (18:00): Automatic daily cutoff
- Toast warning system reminds users about daily submission limits
- Automatic unlock at midnight for new day entry

### Automatic Request Archiving (January 2025)
**Intelligent inbox management:**
- Auto-archives when supervisors cancel ADD TASK requests
- Auto-archives when planners reject any request type
- Real-time badge counter updates
- Full audit trail preserved in archived tabs
- Applies to all request types: Task, Scope, QC, Cabling, Termination, Surveyor

### Task Details Progress Overview (January 2025)
**Supervisor performance tracking:**
- Task Details header shows Total Work Progress
- Calculates average completion across all activities
- Real-time progress bar visualization
- Compact display of PV Area and Block Number
- Helps identify lagging tasks quickly

## Known Issues & Limitations

### Current Limitations
1. Single company per Master User
2. No bulk user import yet (manual entry required)
3. Limited offline functionality (view cache only)
4. QR codes expire after certain period (security feature)
5. Toast warnings cannot be permanently dismissed

### Workarounds
1. Contact support for multi-company needs
2. Add users individually (future enhancement: CSV import)
3. Ensure internet connection for full functionality
4. Regenerate QR codes as needed through user management
5. Toast warnings auto-dismiss after acknowledgment

---

## System Statistics

**Total Request Types:** 6 (Task, Scope, QC, Cabling, Termination, Surveyor)
**User Roles:** 9 (Master, Admin, Planner, Supervisor, QC, Operator, Plant Manager, Surveyor, Staff Manager, Logistics Manager)
**Workflow States:** 7 (PENDING, PENDING_APPROVAL, SCHEDULED, APPROVED, REJECTED, COMPLETED, CLOSED)
**Lock Types:** 3 (Submit Button, QC Interaction, Time Lock)
**Firebase Indexes:** 48+ strategic indexes for optimal query performance

---

Last Updated: January 2025
