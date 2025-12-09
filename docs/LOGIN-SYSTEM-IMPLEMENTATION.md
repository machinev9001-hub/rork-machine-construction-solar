# Login System Implementation - LOCKED

## Overview
The login system supports multiple authentication methods with a focus on simplicity and reliability.

## Authentication Methods

### 1. Employee Login (ID Number + PIN)
- **Username**: Employee ID Number (as set during employee creation)
- **Password**: 4-digit PIN
- **Example**: ID Number "2222222222222" + PIN "1234"

### 2. QR Code Login
- Employees can scan QR codes for quick authentication
- QR codes are linked to employee accounts

### 3. Master Account Login
- Master accounts use email + password authentication
- Separate from employee authentication flow

## Key Implementation Details

### Employee ID Number
- The ID Number set during employee creation is the permanent username
- This ID Number remains constant throughout the employee lifecycle
- Used for both manual login and when added as a user to companies

### Database Structure
```
employees/
  {docId}/
    employeeIdNumber: "2222222222222"  // Login username
    pin: "1234"                         // Hashed in production
    name: "Employee Name"
    companyId: "company_123"
    ...
```

### Login Flow
1. User enters ID Number (e.g., "2222222222222")
2. User enters 4-digit PIN
3. System queries `employees` collection where `employeeIdNumber == ID`
4. Validates PIN
5. Sets user session with employee data

## Session Routing & Recovery

### Reload + Session Bootstrap (contexts/AuthContext.tsx)
- `loadUserFromStorage()` is the single source of truth for restoring or clearing a session. Never bypass it.
- Web reloads force a fresh login: when `Platform.OS === 'web'`, stored `@user` and `@last_activity` keys are wiped so `/login` always becomes the first screen.
- Native reloads keep the session if the inactivity timeout (5 minutes) has not elapsed. The timer lives in `INACTIVITY_TIMEOUT` and is refreshed through `updateActivity()`.
- Required storage keys: `@user`, `@last_activity`, `@user_last_known`, `@selected_company`. All four must be kept in sync when touching auth.

### Master Navigation Ladder (app/_layout.tsx)
After `loginWithId()` succeeds for a master role, RootLayoutNav enforces the following order:
1. **No companies** → `/company-setup`
2. **Companies but none selected** → `/company-selector`
3. **Company selected, no site selected** → `/master-sites`
4. **Company + site selected** → `/(tabs)` (signed-in dashboard)
5. Any error or missing state kicks the user back to `/login` once `AuthProvider` clears the session.
This ladder prevents the “screen 4 loops back to company selector” bug: if step 3 finishes by setting `currentCompanyId` and site metadata on the user, RootLayoutNav will hit step 4 and stay inside the authenticated tabs.

### Employee & Management Routing
- Management roles (`Admin`, `Planner`, `Supervisor`, `QC`, `master`, `HSE`, `HR`, `Plant Manager`, `Surveyor`, `Staff Manager`, `Logistics Manager`, `Onboarding & Inductions`) are redirected from any public route to `/(tabs)` once `user.currentCompanyId` is set.
- Field employees without management roles skip tabs entirely and go straight to `/employee-timesheet`.
- Employee-only screens (`/employee-timesheet`, `/employee-profile`) are explicitly excluded from auto-routing so form flows are never interrupted.

### Quick Restore Checklist
1. Confirm `contexts/AuthContext.tsx` still removes stored sessions on web reloads and writes all four storage keys during login.
2. Verify RootLayoutNav still defines `publicPaths` with `/login` and guards `router.replace('/login')` when `!user && !masterAccount`.
3. Re-test the master ladder: simulate each step above and ensure the appropriate screen renders; if not, inspect `user.companyIds`, `user.currentCompanyId`, and `user.siteId`.
4. Run `npm test -- login` (or full `npm test`) to catch regressions touching auth state before deployment.

### User Role Assignment
When an employee is added as a user to a company:
- The same ID Number is used as the identifier
- Roles and permissions are assigned separately
- The employee can now access company-specific features

## Critical Points
1. **ID Number Consistency**: The ID Number NEVER changes once set
2. **Simple Authentication**: ID Number + PIN only, no complex flows
3. **User vs Employee**: Being added as a "user" grants additional permissions but doesn't change login credentials
4. **QR Code**: Alternative login method, not a replacement

## Troubleshooting

### Common Issues
1. **User not found**: Verify the exact ID Number entered during employee creation
2. **PIN mismatch**: Ensure 4-digit PIN is correct
3. **Company isolation**: Employees only see data for their assigned company

## Implementation Status
✅ Employee ID Number login working
✅ QR code authentication working  
✅ Master account login working
✅ User role assignment working
✅ Company data isolation working

## Last Verified
- Date: 2025-01-23
- Status: All authentication methods functioning correctly
- Tested scenarios:
  - Manual login with ID Number
  - QR code scanning
  - Master account access
  - Employee-to-user promotion