# Technical Guide - Project Tracker System

## Table of Contents
1. [Architecture](#architecture)
2. [Application Structure](#application-structure)
3. [Key Features](#key-features)
4. [Theme System](#theme-system)
5. [Data Flow](#data-flow)
6. [Security Model](#security-model)
7. [Performance Considerations](#performance-considerations)
8. [Error Handling](#error-handling)
9. [Recent Features](#recent-features)
10. [Known Issues](#known-issues)

---

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
│   └── (tabs)/                  # Tab-based navigation
│       ├── _layout.tsx          # Tabs layout
│       ├── index.tsx            # Home/Dashboard
│       └── settings.tsx         # Settings screen
│
├── components/                   # Reusable components
│   ├── QRCodeGenerator.tsx      # QR code generation
│   ├── ThemedScreen.tsx         # Theme wrapper
│   └── OfflineBanner.tsx        # Offline status
│
├── contexts/                     # React contexts
│   ├── AuthContext.tsx          # Authentication state
│   └── ThemeContext.tsx         # Theme management
│
├── types/                        # TypeScript definitions
│   └── index.ts                 # Shared types
│
├── constants/                    # App constants
│   └── colors.ts                # Color scheme
│
├── themes/                       # Theme definitions
│   └── themeRegistry.json       # All theme configs
│
├── config/                       # Configuration files
│   └── firebase.ts              # Firebase setup
│
├── utils/                        # Utility functions
│   ├── offlineQueue.ts          # Offline sync
│   ├── userCache.ts             # User caching
│   └── hooks/                   # Custom hooks
│       └── useTheme.ts          # Theme hook
│
├── docs/                         # Documentation
└── assets/                       # Static assets
```

---

## Key Features

### 1. Authentication & Authorization
- Firebase Authentication
- QR code-based login
- Role-based access control (9+ roles)
- Password reset functionality
- Session management
- Offline authentication with cached users

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
- Multi-tenant support

### 4. Task Management
- Create tasks with full details
- Assign to users
- Progress tracking with "Completed Today"
- Priority levels
- Due dates
- Three-layer locking mechanism

### 5. QR Code System
- User login QR codes
- Printable for physical distribution
- High-resolution viewing
- Secure token-based

### 6. Offline Capabilities
- Priority-based sync (P0-P3)
- User caching for offline auth
- Automatic queue management
- Real-time data freshness

---

## Theme System

### Overview

The theme system provides centralized styling and customization across the entire application. It supports both global theming and per-UI theming.

### Theme Architecture

**Core Components:**
1. **Theme Registry** (`themes/themeRegistry.json`)
   - Contains all theme definitions
   - Modular design for easy additions
   - No code changes needed to add themes

2. **Theme Context** (`contexts/ThemeContext.tsx`)
   - Provides `useThemeConfig()` hook
   - Provides `useThemedStyles(uiKey?)` hook
   - Listens to Firestore for real-time updates

3. **Color Constants** (`constants/colors.ts`)
   - Default color palette
   - Role-based accent colors
   - Common style definitions

### Theme Colors

The main theme colors defined in `Colors` object:
- `background: '#000000'` - Main screen background (black)
- `text: '#FFFFFF'` - Primary text color (white)
- `textSecondary: '#A0A0A0'` - Secondary text (gray)
- `accent: '#FFD600'` - Accent color (yellow)
- `surface: '#1A1A1A'` - Surface elements (dark gray)
- `border: '#333333'` - Borders and dividers
- `cardBg: '#FFFFFF'` - Card backgrounds (white)
- `headerBg: '#000000'` - Header backgrounds (black)

### Available Themes

**1. Default (Machine)**
- White/Black/Grey base colors
- Yellow highlight accents
- Current Machine brand identity
- Clean, professional appearance

**2. Dark Mode**
- Dark Grey/Black base colors
- Soft grey text
- Yellow or Blue accent elements
- Reduced eye strain in low light

**3. High Contrast**
- Pure Black background
- White text
- Strong Yellow highlights
- Maximum readability
- Larger font scale (1.1x)

**4. Field Mode**
- Light Grey background
- Yellow highlights
- Larger text (1.2x scale)
- Enhanced outdoor readability

**5. Blueprint Mode**
- Machine Blue background
- White text
- Yellow buttons and accents
- Technical, professional look

### Theme Modes

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

### Using Themes in Code

**Importing Colors:**
```typescript
import { Colors } from '@/constants/colors';
```

**Applying Theme Colors:**
```typescript
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.surface,
    borderBottomColor: Colors.border,
  },
  text: {
    color: Colors.text,
  },
  card: {
    backgroundColor: Colors.cardBg,
    borderColor: Colors.border,
  },
});
```

**Using the Theme Hook:**
```typescript
import { useTheme } from '@/utils/hooks/useTheme';

function MyComponent() {
  const { theme, roleAccentColor, commonStyles } = useTheme();
  
  return (
    <View style={commonStyles.container}>
      {/* Content */}
    </View>
  );
}
```

**Using ThemedScreen Component:**
```typescript
import { ThemedScreen } from '@/components/ThemedScreen';

export default function MyScreen() {
  return (
    <ThemedScreen>
      {/* Your content */}
    </ThemedScreen>
  );
}
```

### Role-Based Accent Colors

The theme provides role-based accent colors via `getRoleAccentColor(role)`:
- Master: '#FFD600' (Yellow)
- Admin: '#3B82F6' (Blue)
- Planner: '#10B981' (Green)
- Supervisor: '#F59E0B' (Amber)
- QC: '#EF4444' (Red)
- Operator: '#8B5CF6' (Purple)
- Plant Manager: '#F97316' (Orange)
- Surveyor: '#06B6D4' (Cyan)
- Staff Manager: '#EC4899' (Pink)
- Logistics Manager: '#14B8A6' (Teal)

### Theme Storage

**Firebase Document:**
```
Path: sites/{siteId}/config/themeSettings

Structure:
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

**Synchronization:**
- Theme changes sync via Firebase Firestore
- All devices update automatically
- Changes apply per site (site-scoped)
- If offline, theme settings wait until online to sync

**Performance:**
- Theme switching is instant (no reload required)
- Styles are applied using React context
- No performance impact on app speed

**No Additional Indexes Required:**
- Theme settings use simple document read/write
- No queries or complex filtering
- All existing Firebase indexes support theme system

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
5. Apply role-specific theme (if per-UI mode)
   ↓
6. Redirect to appropriate dashboard
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
6. Create task in Firestore (or queue if offline)
   ↓
7. Send notification to assignee
   ↓
8. Update UI with new task
```

### Theme Application Flow
```
1. User (MASTER) changes theme settings
   ↓
2. Settings saved to Firestore
   ↓
3. Real-time listener detects change
   ↓
4. Theme context updates
   ↓
5. All components re-render with new theme
   ↓
6. No app restart required
```

---

## Security Model

### Authentication
- Firebase Authentication with email/password
- QR code contains encrypted token
- Session timeout after inactivity
- Password strength requirements
- Offline authentication via cached credentials

### Authorization
- Role checked at database level (Firestore rules)
- Role checked at application level
- Action-based permissions
- Resource-based permissions
- Theme settings restricted to MASTER role

### Data Protection
- All data encrypted in transit (HTTPS)
- Firestore rules prevent unauthorized access
- Activity logging for audit trail
- Sensitive data never stored in plain text
- Theme settings scoped per site

---

## Performance Considerations

### Database Optimization
- 48+ strategic indexes for fast queries
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
- Instant theme switching with React context

### Offline Performance
- Priority-based sync (P0-P3)
- Small burst budgets for weak signals
- User cache for fast offline auth
- Automatic queue management

---

## Error Handling

### User-Facing Errors
- Clear error messages
- Recovery suggestions
- Retry mechanisms
- Offline detection with banner

### System Errors
- Error logging to monitoring service
- Graceful degradation
- Fallback UI states
- Error boundaries in React

### Theme-Specific Errors
- Fallback to default theme on error
- Theme load failures handled gracefully
- Invalid theme IDs default to "default"
- Offline theme changes queued for sync

---

## Recent Features & Enhancements

### Surveyor Workflow Module (January 2025)
**Complete surveyor task management system:**
- Supervisor request creation with PV Area, Block Number
- Planner approval workflow with surveyor assignment
- Surveyor image library with permanent storage
- Image sharing between team members
- Task execution tracking and completion notifications

### Enhanced "Completed Today" Workflow (January 2025)
**Three-layer locking mechanism:**
- Submit Button Lock: Explicit submission
- QC Interaction Lock: Locks when QC submits
- Time Lock (18:00): Automatic daily cutoff
- Toast warning system for daily submission limits
- Automatic unlock at midnight

### Automatic Request Archiving (January 2025)
**Intelligent inbox management:**
- Auto-archives when supervisors cancel requests
- Auto-archives when planners reject requests
- Real-time badge counter updates
- Full audit trail preserved

### Task Details Progress Overview (January 2025)
**Supervisor performance tracking:**
- Task Details header shows Total Work Progress
- Calculates average completion across activities
- Real-time progress bar visualization
- Compact display of PV Area and Block Number

### Theme System Implementation (January 2025)
**Comprehensive theming:**
- 5 built-in themes
- Global and per-UI theme modes
- Real-time theme switching
- MASTER-only access control
- Automatic synchronization across devices
- No additional Firebase indexes required

---

## Known Issues & Limitations

### Current Limitations
1. Single company per Master User
2. No bulk user import (manual entry required)
3. Toast warnings cannot be permanently dismissed
4. Theme settings only accessible to MASTER users
5. Per-UI themes require manual assignment per role

### Workarounds
1. Contact support for multi-company needs
2. Add users individually (future: CSV import)
3. Toast warnings auto-dismiss after acknowledgment
4. Other roles cannot modify themes (security feature)
5. Use Global Theme mode for simpler management

### Theme Troubleshooting

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

---

## System Statistics

**Total Request Types:** 6 (Task, Scope, QC, Cabling, Termination, Surveyor)
**User Roles:** 10 (Master, Admin, Planner, Supervisor, QC, Operator, Plant Manager, Surveyor, Staff Manager, Logistics Manager)
**Workflow States:** 7 (PENDING, PENDING_APPROVAL, SCHEDULED, APPROVED, REJECTED, COMPLETED, CLOSED)
**Lock Types:** 3 (Submit Button, QC Interaction, Time Lock)
**Firebase Indexes:** 48+ strategic indexes
**Available Themes:** 5 (Default, Dark Mode, High Contrast, Field Mode, Blueprint Mode)
**Theme Modes:** 2 (Global, Per-UI)

---

## Design Principles

### 1. Mobile-First
- Optimized for mobile screens
- Touch-friendly interface
- Responsive layouts
- Native feel

### 2. Clarity
- Expandable sections to reduce clutter
- Clear visual hierarchy
- Consistent theme application
- Role-based color coding

### 3. User Experience
- Minimal scrolling required
- Progressive disclosure
- Filter options for large lists
- Quick access to common actions
- Instant theme switching

### 4. Security
- Role-based permissions
- Secure authentication
- Data encryption
- Activity logging
- Theme settings restricted to MASTER

---

## Future Enhancements

### Planned Features
1. Light/dark mode toggle for all themes
2. Multiple theme presets per company
3. User-customizable themes
4. Theme persistence optimization
5. Document management system
6. Advanced reporting and analytics
7. Multi-language support
8. PWA support

### Technical Improvements
1. Offline-first architecture enhancements
2. Advanced caching strategies
3. Performance monitoring
4. Automated testing
5. CI/CD pipeline
6. Version control for data
7. Backup and disaster recovery

---

## Best Practices

### Theme Development
1. **Always use theme colors** instead of hardcoded values
2. **Use the useTheme hook** for dynamic theming
3. **Keep accessibility in mind** - ensure sufficient contrast
4. **Test on both light and dark device settings**
5. **Use ThemedScreen component** for simple screens

### Code Organization
1. Keep theme definitions in `themeRegistry.json`
2. Use consistent naming for theme IDs
3. Document custom themes thoroughly
4. Test themes across all roles
5. Ensure fallbacks for theme failures

### Performance
1. Avoid inline styles when possible
2. Use StyleSheet.create for optimization
3. Minimize re-renders on theme changes
4. Cache theme-derived values
5. Use React.memo for expensive components

---

Last Updated: January 2025
