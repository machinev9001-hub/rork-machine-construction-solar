# Complete Login System Documentation

**Date**: 2025-01-25  
**Purpose**: Complete reference for all login workflows, logic, and troubleshooting

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Database Structure](#database-structure)
3. [Authentication Flow](#authentication-flow)
4. [User Types & Roles](#user-types--roles)
5. [Login Methods](#login-methods)
6. [Navigation Logic](#navigation-logic)
7. [Session Management](#session-management)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Code References](#code-references)

---

## System Overview

### Architecture
The authentication system uses a **dual-identity model**:
- **Master Accounts**: Company owners/admins stored in `masterAccounts` collection
- **Users**: Employees with roles stored in `users` collection
- **Employees**: Workers stored in `employees` collection (can be promoted to users)

### Key Design Principles
1. **ID Number is Permanent**: Once set during employee creation, never changes
2. **Unified State Management**: Masters are stored as both `masterAccount` and `user` with role='master'
3. **No Session Persistence on Refresh**: Intentionally clears sessions for data integrity
4. **Role-Based Navigation**: Different roles navigate to different screens

---

## Database Structure

### 1. masterAccounts Collection
```typescript
{
  id: string;                    // Firestore document ID
  masterId: string;              // Unique login ID (like "MASTER001")
  name: string;                  // Master account name
  pin: string;                   // Hashed PIN (with pinSalt if available)
  pinSalt?: string;              // Salt for secure PIN hashing
  companyIds: string[];          // Array of company IDs this master owns
  currentCompanyId?: string;     // Currently selected company
  activationCodeId?: string;     // Reference to activation code used
  createdAt: Timestamp;
}
```

### 2. users Collection
```typescript
{
  id: string;                    // Firestore document ID
  userId: string;                // Login identifier (can be email, username, etc.)
  employeeIdNumber?: string;     // ID number if promoted from employee
  name: string;
  role: UserRole;                // Admin, Planner, Supervisor, QC, etc. (or 'master')
  companyIds: string[];          // Companies this user can access
  currentCompanyId?: string;     // Currently selected company
  pin?: string;                  // PIN for authentication
  masterAccountId?: string;      // Reference to master account (if applicable)
  siteId?: string;               // Currently assigned site
  siteName?: string;
  disabledMenus?: string[];      // Restricted menu access
  isLocked?: boolean;            // Account lock status
  createdAt: Timestamp;
}
```

### 3. employees Collection
```typescript
{
  id: string;                    // Firestore document ID
  employeeIdNumber: string;      // **THIS IS THE LOGIN USERNAME**
  name: string;
  role: string;                  // Job role (Operator, General Worker, etc.)
  companyId: string;             // Company this employee belongs to
  siteId?: string;               // Assigned work site
  pin?: string;                  // PIN for authentication
  linkedUserId?: string;         // If promoted to user, references users collection
  linkedUserRole?: string;       // Role in users collection if promoted
  createdAt: Timestamp;
}
```

### 4. companies Collection
```typescript
{
  id: string;
  legalEntityName: string;
  alias: string;
  address: string;
  contactNumber: string;
  adminContact: string;
  adminEmail: string;
  companyRegistrationNr: string;
  vatNumber: string;
  industrySector: string;
  status: 'Active' | 'Inactive' | 'Archived';
  createdBy: string;             // Master account ID
  createdAt: Timestamp;
}
```

### 5. sites Collection
```typescript
{
  id: string;
  name: string;
  companyId: string;             // Parent company
  masterAccountId: string;       // Owner master account
  description?: string;
  location?: string;
  status: 'Active' | 'Inactive' | 'Archived';
  createdAt: Timestamp;
}
```

---

## Authentication Flow

### Core Authentication Function: `loginWithId()`
**Location**: `contexts/AuthContext.tsx` (lines 548-1179)

#### Parameters
```typescript
loginWithId(
  userId: string,           // ID to login with
  pin?: string,             // PIN (optional for first-time setup)
  isSettingUpPin?: boolean  // Flag for first-time PIN setup
)
```

#### Authentication Priority Order
1. **Master Account Check** (lines 631-746)
   - Query `masterAccounts` where `masterId == userId`
   - Validate PIN with secure hash
   - Convert to unified User object with role='master'

2. **User by Employee ID Number** (lines 748-783)
   - Query `users` where `employeeIdNumber == userId`
   - This catches **promoted employees** who now have user accounts

3. **Flexible User Identifier Matching** (lines 784-846)
   - Scans all documents in `users` collection
   - Checks multiple identifier fields (userId, loginId, aliases, etc.)

4. **Employee Check** (lines 848-961)
   - Query `employees` where `employeeIdNumber == userId`
   - Creates temporary User object from employee data
   - Handles first-time PIN setup

#### Return Values
```typescript
{
  success: boolean;
  error?: string;
  requiresPin?: boolean;      // User exists but needs PIN
  isFirstTime?: boolean;      // User needs to set up PIN
  isMaster?: boolean;         // Is a master account
  masterAccount?: MasterAccount;
}
```

---

## User Types & Roles

### User Roles
```typescript
type UserRole = 
  | 'master'                    // Master account (full access)
  | 'Admin'                     // Company admin
  | 'Planner'                   // Project planner
  | 'Supervisor'                // Field supervisor
  | 'QC'                        // Quality control
  | 'Operator'                  // Machine operator
  | 'Plant Manager'             // Equipment manager
  | 'Surveyor'                  // Site surveyor
  | 'Staff Manager'             // HR/staff
  | 'Logistics Manager'         // Logistics
  | 'HSE'                       // Health & Safety
  | 'HR'                        // Human Resources
  | 'Onboarding & Inductions'   // Onboarding specialist
  | 'General Worker'            // General labor
```

### Role-Based Navigation
```typescript
// Management roles → Navigate to /(tabs)
const managementRoles = [
  'Admin', 'Planner', 'Supervisor', 'QC', 'master',
  'HSE', 'HR', 'Plant Manager', 'Surveyor',
  'Staff Manager', 'Logistics Manager',
  'Onboarding & Inductions'
];

// Worker roles → Navigate to /employee-timesheet
const workerRoles = [
  'Operator', 'General Worker', 'Foreman',
  'Engineer', 'Electrician', 'Plumber',
  'Carpenter', 'Welder'
];
```

---

## Login Methods

### 1. Manual Login (app/login.tsx)
```
User Flow:
1. Enter ID (Master ID, Employee ID Number, or User ID)
2. Enter PIN (4-6 digits)
3. Click "Sign In"
↓
Calls loginWithId(userId, pin)
↓
Success:
  - Master → Check company/site setup
  - Management user → /(tabs)
  - Worker → /employee-timesheet
↓
First Time:
  - Redirect to PIN setup
↓
Error:
  - Show error message
```

### 2. QR Code Login (app/qr-scanner.tsx)
```
User Flow:
1. Scan QR code containing user ID
2. System looks up user data:
   - Check users collection
   - Check employees collection
   - Check for linked user account
↓
Has PIN? → Show PIN entry modal
No PIN? → Redirect to /setup-employee-pin
↓
PIN Validation
↓
Navigate based on role
```

**Important QR Code Logic** (lines 129-166):
- First checks `users` collection
- Then checks `employees` collection
- If employee has `linkedUserId`, fetches linked user document
- Uses **linked user data** for authentication if available

### 3. First-Time PIN Setup (app/setup-employee-pin.tsx)
```
User Flow:
1. Receives userId, userName, userRole as params
2. Fetches employee/user data to get employeeIdNumber
3. User creates PIN (4-6 digits)
4. User confirms PIN
5. Click "Set Up PIN & Login"
↓
Calls loginWithId(employeeIdNumber, pin, true)
↓
Success → Navigate based on role
Error → Show error message
```

**Critical Issue**: The system uses the **employeeIdNumber** from the document data, NOT the document ID passed in params. This ensures correct login identifier.

---

## Navigation Logic

### Root Layout Navigation (app/_layout.tsx)
**Location**: Lines 230-306 (RootLayoutNav component)

#### Navigation Priority
```typescript
// 1. Loading state → Show splash screen
if (isLoading) {
  return <LoadingScreen />;
}

// 2. No authentication → Login screen
if (!user && !masterAccount) {
  router.replace('/login');
  return;
}

// 3. Master without companies → Company setup
if (user?.role === 'master' && user.companyIds.length === 0) {
  router.replace('/company-setup');
  return;
}

// 4. Master with companies, none selected → Company selector
if (user?.role === 'master' && !user.currentCompanyId) {
  router.replace('/company-selector');
  return;
}

// 5. Master with company, no site → Site management
if (user?.role === 'master' && !user.siteId) {
  router.replace('/master-sites');
  return;
}

// 6. Regular users → Check role-based routing
const managementRoles = [...];
if (managementRoles.includes(user.role)) {
  router.replace('/(tabs)');
} else {
  router.replace('/employee-timesheet');
}
```

#### Public Paths (No Auth Required)
```typescript
const publicPaths = [
  '/login',
  '/activate',
  '/setup-master-pin',
  '/admin-pin-verify',
  '/admin-panel',
  '/company-setup',
  '/company-selector',
  '/generate-qr'
];
```

#### Employee-Specific Paths (Skip Auto-Routing)
```typescript
const employeeOnlyPaths = [
  '/employee-timesheet',
  '/employee-profile',
  '/setup-employee-pin'
];
```

---

## Session Management

### Storage Keys
```typescript
const STORAGE_KEYS = {
  USER: '@user',                    // Current user session
  PIN: '@pin',                      // (Not used)
  OFFLINE_MODE: '@offline_mode',    // Offline flag
  LAST_ACTIVITY: '@last_activity',  // Timestamp for timeout
  LAST_KNOWN_USER: '@user_last_known', // Cached user data
  SELECTED_COMPANY: '@selected_company' // Current company
};
```

### Session Lifecycle

#### 1. Load User From Storage (lines 184-271)
```typescript
loadUserFromStorage() {
  // CRITICAL: Web always clears session
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem('@user');
    await AsyncStorage.removeItem('@last_activity');
    setUser(null);
    return;
  }
  
  // Native: Check session validity
  const storedUser = await AsyncStorage.getItem('@user');
  const lastActivity = await AsyncStorage.getItem('@last_activity');
  
  // Check inactivity timeout (5 minutes)
  if (Date.now() - lastActivity > INACTIVITY_TIMEOUT) {
    // Session expired
    await AsyncStorage.removeItem('@user');
    setUser(null);
    return;
  }
  
  // Restore session
  setUser(JSON.parse(storedUser));
}
```

#### 2. Successful Login Storage
```typescript
// Always save to both keys for persistence
await AsyncStorage.setItem('@user', JSON.stringify(user));
await AsyncStorage.setItem('@user_last_known', JSON.stringify(user));
await AsyncStorage.setItem('@last_activity', Date.now().toString());

// Set user state
setUser(user);
```

#### 3. Inactivity Timeout
- **Duration**: 5 minutes (300,000ms)
- **Check Interval**: Every 30 seconds
- **Behavior**: Auto-logout on timeout

---

## Troubleshooting Guide

### Problem 1: "User not found" Error

#### Symptoms
- Login with correct credentials fails
- Error: "User not found"
- User exists in database

#### Root Causes
1. **Wrong identifier used**: Using document ID instead of employeeIdNumber
2. **Employee promoted to user**: System checks employees collection but user is now in users collection
3. **Case sensitivity**: ID lookup may be case-sensitive

#### Solution
```typescript
// CORRECT: Use employeeIdNumber from document data
const result = await loginWithId(employeeData.employeeIdNumber, pin);

// WRONG: Using document ID
const result = await loginWithId(docId, pin);
```

#### Debug Steps
1. Check document in Firebase Console:
   - Go to `employees/{docId}`
   - Note the `employeeIdNumber` field value
   - This is the login identifier

2. Check if employee was promoted:
   - Look for `linkedUserId` field in employee document
   - If exists, check `users/{linkedUserId}` document
   - Use `employeeIdNumber` from users document if it exists

3. Enable debug logging:
```typescript
console.log('[Auth Debug] Looking for ID:', userId);
console.log('[Auth Debug] Employee data:', employeeData);
console.log('[Auth Debug] Login ID to use:', employeeData.employeeIdNumber);
```

### Problem 2: QR Code Login Directs to Wrong Screen

#### Symptoms
- QR code scan successful
- User redirected to timesheet page regardless of role
- Expected to go to management interface

#### Root Cause
The system uses the wrong role data source:
1. Uses `scannedRole` from params
2. Should use `userData.role` from document

#### Solution
**In qr-scanner.tsx** (lines 240-270):
```typescript
// CORRECT: Use role from fetched userData
const actualRole = userData?.role || scannedUserRole;

const managementRoles = ['Admin', 'Planner', 'Supervisor', ...];
const isManagementUser = managementRoles.includes(actualRole);

if (isManagementUser) {
  router.replace('/(tabs)');
} else {
  router.replace('/employee-timesheet');
}
```

### Problem 3: Employee Promoted to User, Login Fails

#### Symptoms
- Employee was added as user to company
- Login with ID number fails
- Error: "User not found"

#### Root Cause
When employee is promoted to user:
1. New document created in `users` collection
2. `linkedUserId` added to employee document
3. Login system checks employees FIRST
4. Should check users by employeeIdNumber FIRST

#### Solution
**In AuthContext.tsx**, authentication priority should be:
```typescript
// 1. Check masterAccounts (for masters)
// 2. Check users by employeeIdNumber (for promoted employees) ← CRITICAL
// 3. Check users by flexible identifiers
// 4. Check employees by employeeIdNumber (fallback)
```

**Current code** (lines 750-783) implements this correctly:
```typescript
// FIRST: Check users collection for employeeIdNumber
const userByIdNumberQuery = query(
  usersRef, 
  where('employeeIdNumber', '==', normalizedUserId)
);
const userByIdNumberSnapshot = await getDocs(userByIdNumberQuery);

if (!userByIdNumberSnapshot.empty) {
  // Found promoted employee in users collection
  foundUser = constructUserFromDoc(userDoc);
}
```

### Problem 4: Session Lost on Page Refresh

#### Symptoms
- User logs in successfully
- Refreshes page
- Redirected back to login screen

#### Root Cause
**INTENTIONAL BEHAVIOR** - Not a bug!

#### Explanation
```typescript
// In loadUserFromStorage() - lines 197-205
if (Platform.OS === 'web') {
  console.log('[Auth] Web reload detected - forcing login screen');
  await AsyncStorage.removeItem('@user');
  await AsyncStorage.removeItem('@last_activity');
  setUser(null);
  return;
}
```

**Reason**: Ensures data freshness and prevents stale state issues

### Problem 5: Master Account Stuck in Loop

#### Symptoms
- Master logs in successfully
- Creates company
- Selects company
- Gets redirected back to company selector

#### Root Cause
`currentCompanyId` not being set properly in state

#### Solution
Check company selection flow:
```typescript
// In selectCompany() - lines 1468-1539
async selectCompany(companyId: string) {
  // Update user state
  const updatedUser = { ...user, currentCompanyId: companyId };
  setUser(updatedUser);
  
  // CRITICAL: Save to storage
  await AsyncStorage.setItem('@user', JSON.stringify(updatedUser));
  await AsyncStorage.setItem('@selected_company', companyId);
  
  // Also update masterAccount state if exists
  if (masterAccount) {
    setMasterAccount({ ...masterAccount, currentCompanyId: companyId });
  }
}
```

---

## Code References

### Key Files

1. **contexts/AuthContext.tsx** (1562 lines)
   - Core authentication logic
   - `loginWithId()`: Lines 548-1179
   - `loadUserFromStorage()`: Lines 184-271
   - `logout()`: Lines 273-302
   - `selectCompany()`: Lines 1468-1539

2. **app/login.tsx** (503 lines)
   - Login UI and form handling
   - `handleLogin()`: Lines 51-151

3. **app/qr-scanner.tsx** (607 lines)
   - QR code scanning logic
   - `handleBarCodeScanned()`: Lines 65-236
   - `handlePinSubmit()`: Lines 238-297

4. **app/setup-employee-pin.tsx** (434 lines)
   - First-time PIN setup
   - `handleSetupPin()`: Lines 98-175

5. **app/_layout.tsx** (Lines 230-306: RootLayoutNav)
   - Navigation state machine
   - Role-based routing logic

### Critical Logic Sections

#### Employee ID Number Lookup
```typescript
// contexts/AuthContext.tsx:750-783
const userByIdNumberQuery = query(
  usersRef,
  where('employeeIdNumber', '==', normalizedUserId)
);
```

#### QR Code User Fetching
```typescript
// app/qr-scanner.tsx:129-166
let userDoc = await getDoc(doc(db, 'users', userId));

if (!userDoc.exists()) {
  const employeeDoc = await getDoc(doc(db, 'employees', userId));
  
  if (employeeData?.linkedUserId) {
    // Fetch linked user account
    userDoc = await getDoc(doc(db, 'users', linkedUserId));
  }
}
```

#### PIN Setup Login Call
```typescript
// app/setup-employee-pin.tsx:141-143
const loginId = employeeData.employeeIdNumber; // Use from document data
const result = await loginWithId(loginId, pin.trim(), true);
```

---

## Summary

### Key Principles
1. **employeeIdNumber is the permanent login identifier**
2. **Check users collection by employeeIdNumber BEFORE checking employees**
3. **Always use document data fields, not document IDs**
4. **Master accounts are stored as both masterAccount and user (with role='master')**
5. **Web sessions always clear on refresh (intentional)**
6. **Role determines navigation destination**

### Common Mistakes
1. ❌ Using document ID instead of employeeIdNumber
2. ❌ Using role from params instead of fetched document
3. ❌ Not checking linkedUserId in employee documents
4. ❌ Assuming session persists on web refresh
5. ❌ Not saving to both @user and @user_last_known keys

### Debugging Checklist
- [ ] Verify employeeIdNumber value in Firebase Console
- [ ] Check if employee has linkedUserId (promoted to user)
- [ ] Confirm role in document matches expected role
- [ ] Check AsyncStorage keys after login
- [ ] Verify navigation logic matches user role
- [ ] Enable debug logging in AuthContext
- [ ] Test QR code with userData.role

---

## End of Documentation

This document contains the complete authentication and login workflow. Use it as a reference when troubleshooting authentication issues or onboarding new developers.

For updates or corrections, modify this file and increment the date at the top.
