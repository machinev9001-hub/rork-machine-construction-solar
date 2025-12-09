# Authentication & Login System

## Overview
This document consolidates all authentication methods including master accounts, employee login, QR code authentication, and session management.

---

## System Architecture

### User Types

1. **Master Account** - Company owner/admin with full control
2. **Regular Users** - Employees with role-based access (Admin, Planner, Supervisor, QC, Operator, etc.)
3. **Employees** - Workers who login with ID numbers

### Database Collections

#### masterAccounts
```typescript
{
  id: string;
  masterId: string;           // Unique login ID
  name: string;
  pin: string;                // Hashed PIN
  pinSalt?: string;           // Salt for secure hashing
  companyIds: string[];       // Array of company IDs
  currentCompanyId?: string;  // Selected company
  createdAt: Timestamp;
}
```

#### users
```typescript
{
  id: string;
  userId: string;
  name: string;
  role: UserRole;            // Including 'master' role
  companyIds: string[];
  currentCompanyId?: string;
  pin?: string;
  masterAccountId?: string;
  siteId?: string;
  siteName?: string;
  createdAt: Timestamp;
}
```

#### employees
```typescript
{
  id: string;
  employeeIdNumber: string;  // ID number for login (USERNAME)
  name: string;
  role: string;
  companyId: string;
  siteId?: string;
  pin?: string;              // 4-digit PIN (PASSWORD)
  createdAt: Timestamp;
}
```

#### companies
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
  status: 'Active' | 'Inactive';
  createdBy: string;         // Master account ID
  createdAt: Timestamp;
}
```

---

## Authentication Methods

### 1. Employee Login (ID Number + PIN)

**Purpose:** Simple login for field workers

**Credentials:**
- **Username**: Employee ID Number (e.g., "2222222222222")
- **Password**: 4-digit PIN (e.g., "1234")

**Flow:**
```
Login Screen
  ↓ Enter ID Number
  ↓ Enter 4-digit PIN
  ↓ Query employees collection where employeeIdNumber == ID
  ↓ Validate PIN (hashed comparison)
  ↓ Create user session
  ↓ Navigate based on role:
    - Management roles → /(tabs)
    - Worker roles → /employee-timesheet
```

**Key Points:**
- ID Number is **permanent** - never changes
- Same ID Number used when added as a user to companies
- PIN is **hashed** in production
- Works **offline** via user cache

**Example:**
```typescript
const loginEmployee = async (idNumber: string, pin: string) => {
  // Query employees collection
  const employeeQuery = query(
    collection(db, 'employees'),
    where('employeeIdNumber', '==', idNumber)
  );
  
  const snapshot = await getDocs(employeeQuery);
  
  if (snapshot.empty) {
    throw new Error('Employee not found');
  }
  
  const employeeDoc = snapshot.docs[0];
  const employee = employeeDoc.data();
  
  // Validate PIN
  const isValid = await validatePin(pin, employee.pin);
  
  if (!isValid) {
    throw new Error('Invalid PIN');
  }
  
  // Create session
  await setUser({
    ...employee,
    id: employeeDoc.id
  });
};
```

---

### 2. QR Code Authentication

**Purpose:** Fast authentication without typing

**How It Works:**
```
QR Code Generated
  ↓ Contains employeeIdNumber
  ↓ Employee scans QR
  ↓ App looks up employee in cache (offline) or Firebase (online)
  ↓ Prompts for PIN
  ↓ Validates and logs in
```

**Implementation:**
```typescript
// Generate QR code
import QRCode from 'react-native-qrcode-svg';

<QRCode
  value={JSON.stringify({
    type: 'employee_login',
    employeeIdNumber: employee.employeeIdNumber
  })}
  size={200}
/>

// Scan QR code
import { BarCodeScanner } from 'expo-barcode-scanner';

const handleBarCodeScanned = async ({ data }) => {
  const payload = JSON.parse(data);
  
  if (payload.type === 'employee_login') {
    // Look up employee (works offline via cache)
    const employee = await getEmployee(payload.employeeIdNumber);
    
    // Prompt for PIN
    const pin = await promptForPin();
    
    // Login
    await loginEmployee(employee.employeeIdNumber, pin);
  }
};
```

**Offline Support:**
- User cache preloaded on first login
- QR codes work offline for 24 hours
- PIN validation happens locally

---

### 3. Master Account Login

**Purpose:** Full system access for company owners

**Credentials:**
- **Master ID**: Unique identifier (e.g., "master123")
- **PIN**: 4-6 digit secure PIN

**Flow:**
```
Login Screen
  ↓ Enter Master ID
  ↓ Enter PIN
  ↓ Query masterAccounts collection
  ↓ Validate PIN (with salt)
  ↓ Load master account
  ↓ Check company status:
    - No companies → /company-setup
    - Multiple companies → /company-selector
    - One company → /master-sites
```

**Security:**
- PIN is **salted and hashed**
- Uses `bcrypt` or similar
- 5-minute inactivity timeout
- Session cleared on page refresh

**Implementation:**
```typescript
import { hashPin, comparePin } from '@/utils/pinSecurity';

const loginMaster = async (masterId: string, pin: string) => {
  // Query masterAccounts
  const masterQuery = query(
    collection(db, 'masterAccounts'),
    where('masterId', '==', masterId)
  );
  
  const snapshot = await getDocs(masterQuery);
  
  if (snapshot.empty) {
    throw new Error('Master account not found');
  }
  
  const masterDoc = snapshot.docs[0];
  const master = masterDoc.data();
  
  // Validate PIN with salt
  const isValid = await comparePin(pin, master.pin, master.pinSalt);
  
  if (!isValid) {
    throw new Error('Invalid PIN');
  }
  
  // Set session
  await setMasterAccount(master);
  await setUser({
    ...master,
    role: 'master'
  });
};
```

---

## Complete Authentication Workflow

### 1. Initial Page Load
```
User opens app
  ↓ _layout.tsx loads
  ↓ AuthContext initializes
  ↓ loadUserFromStorage() called
  ↓ ALWAYS clears session (for data integrity)
  ↓ Sets user=null, masterAccount=null
  ↓ Navigation to /login
```

### 2. Master Account Creation Flow
```
/login
  ↓ "Activate New Account"
  ↓ /activate
  ↓ Enter activation code
  ↓ /setup-master-pin
  ↓ Create master account:
    - Name
    - Master ID (unique)
    - PIN (4-6 digits)
  ↓ Master account created in masterAccounts collection
  ↓ Redirect to /company-setup
```

### 3. Company Setup Flow
```
/company-setup
  ↓ Enter company details:
    - Industry sector
    - Legal entity name
    - Alias
    - Address
    - Contact details
    - Registration & VAT numbers
  ↓ Company created in companies collection
  ↓ Master account's companyIds[] updated
  ↓ Redirect to /master-sites
```

### 4. Company Selection Flow
```
/company-selector (when multiple companies exist)
  ↓ Display list of companies
  ↓ Select company
  ↓ Updates currentCompanyId in state
  ↓ Saves to AsyncStorage for session
  ↓ Navigate to /master-sites
```

### 5. Site Management Flow
```
/master-sites
  ↓ Create new site:
    - Site name
    - Description
    - Location
  ↓ Site created in sites collection
    - Linked to current companyId
    - Linked to masterAccountId
  ↓ Site appears in list
  ↓ Can open site to manage
```

---

## Session Management

### No Persistence on Refresh
- Session is **ALWAYS cleared** on page refresh
- Forces re-login for data integrity
- Prevents stale data issues

**Rationale:** Ensures fresh data, prevents conflicts, improves security

### Inactivity Timeout
- **5-minute** inactivity timer
- Checks every **30 seconds**
- Auto-logout on timeout

**Implementation:**
```typescript
// In AuthContext
useEffect(() => {
  const interval = setInterval(() => {
    const now = Date.now();
    const lastActivity = await AsyncStorage.getItem('lastActivity');
    
    if (now - parseInt(lastActivity) > 5 * 60 * 1000) {
      // 5 minutes passed
      logout();
    }
  }, 30000); // Check every 30 seconds
  
  return () => clearInterval(interval);
}, []);

// Update lastActivity on any user action
const updateActivity = async () => {
  await AsyncStorage.setItem('lastActivity', Date.now().toString());
};
```

### Navigation State Machine
```
isLoading=true
  ↓ Show loading screen
  
isLoading=false
  ↓ Check user/masterAccount
  
No user & No master
  ↓ /login
  
Master without companies
  ↓ /company-setup
  
Master with companies, none selected
  ↓ /company-selector
  
Master with selected company
  ↓ /master-sites
  
Regular user
  ↓ /(tabs) or /employee-timesheet
```

---

## Activation System

### Activation Codes

**Purpose:** Secure master account creation

**Flow:**
```
Master Account Creation
  ↓ Enter activation code
  ↓ Validate against activationCodes collection
  ↓ Check if unused
  ↓ Mark as used
  ↓ Allow account creation
```

**Database Structure:**
```typescript
interface ActivationCode {
  id: string;
  code: string;              // Unique code
  country: string;
  createdAt: Timestamp;
  expiresAt?: Timestamp;
  usedAt?: Timestamp;
  usedBy?: string;
  maxUses: number;
  currentUses: number;
  status: 'active' | 'used' | 'expired';
}
```

**Implementation:**
```typescript
const validateActivationCode = async (code: string) => {
  const codeDoc = await getDoc(doc(db, 'activationCodes', code));
  
  if (!codeDoc.exists()) {
    throw new Error('Invalid activation code');
  }
  
  const data = codeDoc.data();
  
  if (data.status !== 'active') {
    throw new Error('Activation code already used');
  }
  
  if (data.expiresAt && data.expiresAt < Timestamp.now()) {
    throw new Error('Activation code expired');
  }
  
  // Mark as used
  await updateDoc(codeDoc.ref, {
    status: 'used',
    usedAt: Timestamp.now(),
    usedBy: masterAccountId
  });
};
```

---

## Offline Authentication

### User Cache System

**Purpose:** Enable offline QR code scanning and PIN validation

**How It Works:**
```
User logs in
  ↓ precacheUsers(siteId) called
  ↓ All site users fetched from Firebase
  ↓ Stored in AsyncStorage with encryption
  ↓ Cache valid for 24 hours
  ↓ Offline QR scans use cached data
```

**Implementation:**
```typescript
import { precacheUsers, getCachedUser } from '@/utils/userCache';

// On login
await precacheUsers(user.siteId);

// On QR scan (offline)
const employee = await getCachedUser(employeeIdNumber);
if (employee) {
  // Validate PIN locally
  const isValid = await validatePinLocally(pin, employee.pin);
  if (isValid) {
    await loginEmployee(employee);
  }
}
```

---

## Security Best Practices

### 1. PIN Storage
- **Never** store PINs in plain text
- Always hash with salt
- Use `bcrypt`, `argon2`, or similar

```typescript
import bcrypt from 'bcryptjs';

// Hash PIN
const hashPin = async (pin: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(pin, salt);
};

// Compare PIN
const comparePin = async (pin: string, hash: string): Promise<boolean> => {
  return await bcrypt.compare(pin, hash);
};
```

### 2. Session Security
- Clear session on refresh
- Implement inactivity timeout
- Use secure storage (AsyncStorage with encryption)

### 3. Role-Based Access Control
- Check user role before accessing screens
- Implement permission middleware
- Restrict Firebase rules by role

```typescript
// Firestore Rules
match /sites/{siteId} {
  allow read: if request.auth != null && 
    (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['master', 'planner', 'supervisor']);
  allow write: if request.auth != null && 
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'master';
}
```

---

## Common Issues & Solutions

### Issue 1: Page Refresh Logs Out User
**Cause:** Intentional design for data integrity  
**Solution:** This is expected behavior

### Issue 2: Company Creation Success but Stays on Page
**Cause:** Navigation timing issue  
**Solution:** Alert callback explicitly handles navigation

### Issue 3: Site Creation Error "No company selected"
**Cause:** currentCompanyId not set  
**Solution:** Check AsyncStorage and state

### Issue 4: Employee Not Found
**Cause:** ID number mismatch  
**Solution:** Verify exact ID number from employee creation

### Issue 5: Offline Login Not Working
**Cause:** User cache expired or not initialized  
**Solution:** Ensure precacheUsers() called on login

---

## Testing Checklist

- [ ] Master account creation with activation code
- [ ] Master account login with PIN
- [ ] Company creation and selection
- [ ] Site creation within company
- [ ] Employee login with ID number + PIN
- [ ] PIN setup for first-time users
- [ ] Session timeout after 5 minutes
- [ ] Page refresh clears session
- [ ] Navigation to correct screens based on role
- [ ] Multiple company management
- [ ] QR code authentication
- [ ] Offline authentication with cached users
- [ ] PIN validation works offline

---

## Related Files

**Core Authentication:**
- `contexts/AuthContext.tsx` - Auth state management
- `utils/pinSecurity.ts` - PIN hashing utilities
- `utils/activationCode.ts` - Activation code validation
- `utils/userCache.ts` - User caching for offline auth

**Authentication Screens:**
- `app/login.tsx` - Main login screen
- `app/activate.tsx` - Activation code entry
- `app/setup-master-pin.tsx` - Master PIN setup
- `app/setup-employee-pin.tsx` - Employee PIN setup
- `app/admin-pin-verify.tsx` - Admin PIN verification
- `app/qr-scanner.tsx` - QR code scanner
- `app/generate-qr.tsx` - QR code generator
- `app/print-qr-codes.tsx` - QR code printing

**Company & Site Management:**
- `app/company-setup.tsx` - Company creation
- `app/company-selector.tsx` - Company selection
- `app/company-settings.tsx` - Company settings
- `app/master-sites.tsx` - Site management

**Archived Docs:**
- `docs/LOGIN-SYSTEM-IMPLEMENTATION.md` (archived)
- `docs/LOGIN-SYSTEM-CLARIFICATION.md` (archived)
- `docs/LOGIN-SYSTEM-ID-NUMBERS-ONLY.md` (archived)
- `docs/LOGIN-SYSTEM-PERSISTENCE-FIX.md` (archived)
- `docs/SESSION-EXPIRY-IMPLEMENTATION.md` (archived)
- `docs/MASTER-AUTHENTICATION-WORKFLOW.md` (archived)
- `docs/QR-AUTHENTICATION-SYSTEM.md` (archived)
- `docs/ACTIVATION-SYSTEM.md` (archived)

---

**Last Updated:** 2025-01-23  
**Status:** Complete and production-ready
