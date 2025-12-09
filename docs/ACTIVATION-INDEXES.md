# Activation System & Authentication Indexes

## ✅ Updated: January 19, 2025

All required indexes for the **Activation Code & Master PIN Workflow** have been added to `firestore.indexes.json`.

---

## New Indexes Added

### 1. **Activation Codes Collection**

#### Index 1: Code Lookup (Single Field)
```json
{
  "collectionGroup": "activation_codes",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "code", "order": "ASCENDING" }
  ]
}
```
**Purpose:** Fast lookup when validating activation codes during account setup  
**Query:** `where('code', '==', 'XXXX-XXXX-XXXX-XXXX')`  
**Location:** `utils/activationCode.ts` line 16

#### Index 2: Status + CreatedAt (Composite)
```json
{
  "collectionGroup": "activation_codes",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```
**Purpose:** Admin dashboard to view active/redeemed/expired codes chronologically  
**Query:** `where('status', '==', 'active').orderBy('createdAt', 'desc')`

---

### 2. **Master Accounts Collection**

#### Index 3: Master ID Lookup (Single Field)
```json
{
  "collectionGroup": "masterAccounts",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "masterId", "order": "ASCENDING" }
  ]
}
```
**Purpose:** Master account login lookup  
**Query:** `where('masterId', '==', '3002')`  
**Location:** `contexts/AuthContext.tsx` line 492

#### Index 4: Activation Code Reference (Composite)
```json
{
  "collectionGroup": "masterAccounts",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "activationCodeId", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```
**Purpose:** Track which master accounts used which activation codes  
**Query:** `where('activationCodeId', '==', 'abc123').orderBy('createdAt', 'desc')`

#### Index 5: Company ID Reference (Composite)
```json
{
  "collectionGroup": "masterAccounts",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "companyId", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```
**Purpose:** View all master accounts for a specific company  
**Query:** `where('companyId', '==', 'company-123').orderBy('createdAt', 'desc')`

---

### 3. **Employees Collection**

#### Index 6: Master Account + Created At (Composite)
```json
{
  "collectionGroup": "employees",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "masterAccountId", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```
**Purpose:** Master account viewing all employees they created  
**Query:** `where('masterAccountId', '==', 'master-id').orderBy('createdAt', 'desc')`  
**Location:** `app/onboarding-employees.tsx`

---

## Existing Indexes (Already Present)

These indexes were already in the file and support employee login:

### Employees - Employee ID Number Lookup
```json
{
  "collectionGroup": "employees",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "employeeIdNumber", "order": "ASCENDING" },
    { "fieldPath": "__name__", "order": "ASCENDING" }
  ]
}
```
**Purpose:** Employee login by ID number (South African 13-digit or foreign)  
**Location:** Lines 217-222 in `firestore.indexes.json`

### Employees - Site + ID Number Lookup
```json
{
  "collectionGroup": "employees",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "siteId", "order": "ASCENDING" },
    { "fieldPath": "employeeIdNumber", "order": "ASCENDING" },
    { "fieldPath": "__name__", "order": "ASCENDING" }
  ]
}
```
**Purpose:** Filter employees by site and ID number  
**Location:** Lines 224-231 in `firestore.indexes.json`

---

## Summary

### Total Indexes Added: **6 new indexes**
1. ✅ Activation Codes - Code lookup
2. ✅ Activation Codes - Status + CreatedAt
3. ✅ Master Accounts - Master ID lookup
4. ✅ Master Accounts - Activation Code reference
5. ✅ Master Accounts - Company ID reference
6. ✅ Employees - Master Account + CreatedAt

### Collections Covered:
- ✅ `activation_codes` (2 indexes)
- ✅ `masterAccounts` (3 indexes)
- ✅ `employees` (1 new index + 3 existing)

---

## Authentication Flow Support

### 1. **Standard User Login** (ID Number + PIN)
**Supported by:**
- Existing `users` collection indexes (lines 101-108, 208-214)
- Existing `employees` collection indexes (lines 217-222, 224-231)
- New `employees.masterAccountId + createdAt` index (lines 233-239)

### 2. **Activate New Account** (Activation Key)
**Supported by:**
- New `activation_codes.code` index (lines 241-246)
- New `activation_codes.status + createdAt` index (lines 248-254)
- New `masterAccounts.masterId` index (lines 256-261)
- New `masterAccounts.activationCodeId + createdAt` index (lines 263-269)

### 3. **Hidden Gesture: Creator/Admin Access** (Super-User)
**Supported by:**
- New `masterAccounts.masterId` index (lines 256-261)
- Hardcoded credential check (username: 3002, pin: 3002)

---

## Deployment Instructions

### Step 1: Deploy Indexes to Firebase
```bash
firebase deploy --only firestore:indexes
```

### Step 2: Wait for Index Build
- Each index takes 2-5 minutes to build
- Monitor status in [Firebase Console](https://console.firebase.google.com/project/project-tracker-app-33cff/firestore/indexes)
- All indexes must show "Enabled" status before use

### Step 3: Verify in Console
1. Go to Firebase Console → Firestore Database → Indexes
2. Confirm these collections have indexes:
   - ✅ `activation_codes` (2 composite indexes)
   - ✅ `masterAccounts` (3 composite indexes)
   - ✅ `employees` (4 composite indexes total)

### Step 4: Test Authentication
1. Try activating a new account with activation code
2. Try logging in as master with Master ID
3. Try logging in as employee with ID number
4. All should work without "missing index" errors

---

## Database Structure

### Activation Codes Collection
```typescript
{
  id: string;
  code: string;                      // "XXXX-XXXX-XXXX-XXXX"
  companyId?: string;
  companyName?: string;
  status: 'active' | 'redeemed' | 'expired' | 'revoked';
  expiryDate?: Timestamp | null;
  redeemedAt?: Timestamp | null;
  redeemedBy?: string;               // Master account ID
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  maxRedemptions?: number;
  currentRedemptions?: number;
}
```

### Master Accounts Collection
```typescript
{
  id: string;
  masterId: string;                  // Master ID for login
  name: string;
  pin: string;                       // Hashed with PBKDF2
  pinSalt: string;                   // Salt for hashing
  activationCodeId?: string;         // Reference to activation code
  companyId?: string;
  companyName?: string;
  createdAt: Timestamp;
}
```

### Employees Collection (Updated)
```typescript
{
  id: string;
  name: string;
  role: string;
  employeeIdNumber: string;          // For login (13-digit SA or variable foreign)
  citizenshipCountry: string;        // "South Africa" or other
  contact: string;
  email?: string;
  siteId: string;
  masterAccountId: string;           // Links to master account
  pin?: string;                      // Set on first login
  inductionStatus: boolean;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  
  // Certificate Expiry Dates
  medicalExpiryDate?: Timestamp;
  licenseExpiryDate?: Timestamp;
  competencyExpiryDate?: Timestamp;
  pdpExpiryDate?: Timestamp;
}
```

---

## Query Examples

### Validate Activation Code
```typescript
const q = query(
  collection(db, 'activation_codes'),
  where('code', '==', 'A7F9-3K2L-9XQ1-4B2H')
);
// Uses index: activation_codes.code
```

### Master Account Login
```typescript
const q = query(
  collection(db, 'masterAccounts'),
  where('masterId', '==', '3002')
);
// Uses index: masterAccounts.masterId
```

### Employee Login
```typescript
const employeeDoc = doc(db, 'employees', employeeIdNumber);
// Direct document lookup, no index needed
```

### View All Employees for Master
```typescript
const q = query(
  collection(db, 'employees'),
  where('masterAccountId', '==', masterAccountId),
  orderBy('createdAt', 'desc')
);
// Uses index: employees.masterAccountId + createdAt
```

---

## Security Considerations

### PIN Storage
- ✅ Master PINs hashed with PBKDF2 + SHA-256
- ✅ 10,000 iterations for key derivation
- ✅ Unique 128-bit salt per user
- ✅ Never store plaintext PINs

### Activation Codes
- ✅ Random generation (no predictable patterns)
- ✅ Status tracking (active/redeemed/expired)
- ✅ Optional expiry dates
- ✅ Multi-use support with redemption limits

### Database Rules Required
```javascript
// activation_codes collection
match /activation_codes/{codeId} {
  allow read: if request.auth != null;
  allow write: if request.auth.token.role == 'admin';
}

// masterAccounts collection
match /masterAccounts/{masterId} {
  allow read: if request.auth.uid == masterId;
  allow create: if request.auth != null;
  allow update, delete: if request.auth.uid == masterId;
}

// employees collection
match /employees/{employeeId} {
  allow read: if request.auth != null;
  allow write: if request.auth.token.role in ['master', 'admin', 'Onboarding & Inductions'];
}
```

---

## Testing Checklist

### ✅ Activation Code Flow
- [ ] Generate activation code in Firestore
- [ ] Enter code in app
- [ ] Validation succeeds
- [ ] Master account created with hashed PIN
- [ ] Code marked as redeemed
- [ ] Same code can't be used twice (if maxRedemptions = 1)

### ✅ Master Login
- [ ] Login with Master ID + PIN
- [ ] PIN verification works (hashed comparison)
- [ ] Incorrect PIN rejected
- [ ] Session persists after login

### ✅ Employee Login
- [ ] Login with 13-digit SA ID number
- [ ] Login with foreign ID number (variable length)
- [ ] First-time login prompts for PIN setup
- [ ] PIN setup works and persists
- [ ] Subsequent logins validate PIN
- [ ] Incorrect PIN rejected

### ✅ Super-User Access
- [ ] Hidden gesture (5-tap) pre-fills credentials
- [ ] Login with 3002/3002 works
- [ ] Access to admin panel granted

---

## Files Modified

1. **`firestore.indexes.json`** - Added 6 new indexes
2. **`docs/ACTIVATION-INDEXES.md`** - This documentation file

---

## Related Documentation

- [docs/ACTIVATION-SYSTEM.md](./ACTIVATION-SYSTEM.md) - Complete activation system architecture
- [docs/DATABASE-STRUCTURE.md](./DATABASE-STRUCTURE.md) - Database schema overview
- [utils/activationCode.ts](../utils/activationCode.ts) - Activation code validation
- [utils/pinSecurity.ts](../utils/pinSecurity.ts) - PIN hashing utilities
- [contexts/AuthContext.tsx](../contexts/AuthContext.tsx) - Authentication logic

---

**Last Updated:** January 19, 2025  
**Status:** ✅ All indexes defined and ready for deployment  
**Action Required:** Run `firebase deploy --only firestore:indexes`
