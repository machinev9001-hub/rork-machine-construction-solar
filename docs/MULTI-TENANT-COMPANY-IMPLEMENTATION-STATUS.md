# Multi-Tenant Company System Implementation Status

## Overview
This document tracks the implementation of the multi-tenant company-first hierarchy system, replacing the previous site-first model.

## Completed Tasks ✅

### 1. Type Definitions Updated
**Files Modified:**
- `types/index.ts` 
  - Added `Company` type with full company details
  - Added `CompanyUser` type for linking users to companies
  - Updated `MasterAccount` type to include `companyIds: string[]`
  - Updated `User` type to include `companyIds: string[]` and `currentCompanyId?: string`
  - Updated `Site` type to include `companyId: string` (companies now own sites)

### 2. Authentication Context Enhanced
**File Modified:** `contexts/AuthContext.tsx`
- Updated `MasterAccount` and `User` types to include company fields
- Added `selectCompany(companyId: string)` method
- Updated `loginWithId` to populate companyIds when loading users
- Updated `openSite` to assign companyIds to master users
- Added support for company selection in auth state

### 3. Company Selector Page Created
**File Created:** `app/company-selector.tsx`
- Lists all companies a user/master has access to
- Auto-selects if only one company available
- Redirects to company setup if master has no companies
- Handles company selection and navigation

### 4. Company Setup Page Created  
**File Created:** `app/company-setup.tsx`
- Full company creation form with all required fields
- Validates all inputs before submission
- Creates company in Firebase `companies` collection
- Routes to site setup after successful creation

## Pending Tasks 🔄

### 5. Update Master Signup Flow
**File to Modify:** `app/master-signup.tsx`
- ✅ Currently routes to `/company-settings` after master creation
- ⚠️ Should route to `/company-setup` instead
- ⚠️ Success message should mention "Now let's set up your company" not "site"

### 6. Update Root Layout Routing
**File to Modify:** `app/_layout.tsx`
- ⚠️ Add logic to check if user/master has selected a company
- ⚠️ If companyIds exists but no currentCompanyId → route to `/company-selector`
- ⚠️ Current logic routes master to `/master-sites` - needs to check company first
- ⚠️ Add `/company-selector` and `/company-setup` to public paths

### 7. Update QR Scanner for Role-Based Routing
**File to Modify:** `app/qr-scanner.tsx`
- ⚠️ After QR scan → PIN entry → route to `/company-selector` instead of directly to dashboard
- ⚠️ Implement different flows based on roles:
  - **User/Admin**: QR + PIN → Company Selector → Role UI
  - **HSE**: QR → No PIN → Direct open route → HSE UI
  - **Others**: QR + PIN → Company Selector → Allocated UI

### 8. Update User Creation/Management
**Files to Modify:**
- `app/add-user.tsx`
- `app/edit-user.tsx`
- `app/manage-users.tsx`

**Changes Needed:**
- Add company selection when creating users
- Link users to companies via `companyIds` array
- Support multiple company assignments per user
- Update user forms to show current company assignments

### 9. Update Site Management
**Files to Modify:**
- `app/master-sites.tsx`
- `app/company-settings.tsx`

**Changes Needed:**
- Sites should be created under a selected company
- Add `companyId` field when creating sites
- Filter sites by current `companyId`
- Update site queries to include company scoping

### 10. Database Indexes Documentation
**File to Create:** `docs/COMPANY-INDEXES.md`

**Required Indexes:**
```
Collection: companies
- Single: status
- Single: createdBy
- Composite: status + createdAt

Collection: users  
- Array-contains: companyIds
- Single: currentCompanyId
- Composite: companyIds + role
- Composite: currentCompanyId + role

Collection: sites
- Single: companyId
- Composite: companyId + masterAccountId
- Composite: companyId + status

Collection: masterAccounts
- Array-contains: companyIds
```

### 11. Migration Strategy
**Considerations:**
- Existing sites need `companyId` assigned
- Existing users need `companyIds` array populated
- Existing masterAccounts need `companyIds` array populated
- Create default companies for existing data

## Architecture Changes

### Before (Site-First):
```
MasterAccount
  └── Sites
        └── Users
```

### After (Company-First):
```
MasterAccount
  └── Companies
        ├── Sites
        └── Users (linked via companyIds array)
```

### Key Differences:
1. **Companies are top-level tenants** - Not nested under sites
2. **Users can belong to multiple companies** - via `companyIds: string[]`
3. **Sites belong to companies** - via `companyId: string`
4. **Company Selector page** - Users choose which company to access
5. **Master can manage multiple companies** - via `companyIds: string[]`

## QR Authentication Flow

### Updated Flow:
1. **User scans QR code** → Extracts User UUID
2. **System resolves UUID** → Fetches user profile from Firebase
3. **Role check**:
   - **HSE Role**: No PIN → Direct open route → HSE UI (company-scoped)
   - **Other Roles**: Prompt for PIN
4. **PIN Authentication** (if required)
5. **Company Selection**:
   - If user has `companyIds.length === 1` → Auto-select
   - If user has `companyIds.length > 1` → Show Company Selector
   - If user has `companyIds.length === 0` → Error (no access)
6. **Route to Role UI** (within selected company context)

### Security:
- QR contains only User UUID (no sensitive data)
- PIN required for all roles except HSE
- Company scoping prevents cross-tenant data leakage
- RBAC enforced at company AND site levels

## Next Steps

1. ✅ Fix lint warning in `company-selector.tsx` (move handleSelectCompany before loadCompanies)
2. ⚠️ Update `master-signup.tsx` to route to company-setup
3. ⚠️ Update `app/_layout.tsx` routing logic for company selection
4. ⚠️ Create Firebase indexes for companies collection
5. ⚠️ Update QR scanner with new role-based routing
6. ⚠️ Update user management pages to support companies
7. ⚠️ Update site management to be company-scoped
8. ⚠️ Test complete authentication flow

## Testing Checklist

### Master Flow:
- [ ] Create master account → should route to company setup
- [ ] Create company → should route to site management
- [ ] Login as master → should show company selector (if multiple companies)
- [ ] Login as master → should auto-select company (if one company)
- [ ] Create users under selected company

### User Flow:
- [ ] User scans QR → enters PIN → sees company selector
- [ ] User with one company → auto-routed to dashboard
- [ ] User with multiple companies → can choose company
- [ ] User can switch companies (if needed)

### HSE Flow:
- [ ] HSE scans worker QR → no PIN prompt → opens worker profile
- [ ] HSE sees only company-scoped worker data
- [ ] HSE cannot access other companies' data

### Security:
- [ ] QR only contains UUID (no PIN/sensitive data)
- [ ] Cross-tenant data isolation works
- [ ] Users cannot access companies they're not linked to
- [ ] Company selection persists across app restarts

## Known Issues

1. **Minor lint warning** in `company-selector.tsx` - function order in useCallback dependencies
2. **UserCache** doesn't have companyIds fields - using `as any` workaround for offline mode
3. **Master signup** still routes to old `/company-settings` instead of `/company-setup`
4. **No Firebase indexes created yet** - will need manual setup
5. **No migration script** for existing data to new company structure

## File Manifest

### Created Files:
- `app/company-selector.tsx` - Company selection page
- `app/company-setup.tsx` - Company creation/setup page
- `docs/MULTI-TENANT-COMPANY-IMPLEMENTATION-STATUS.md` - This file

### Modified Files:
- `types/index.ts` - Added Company, CompanyUser types; updated User, MasterAccount, Site
- `contexts/AuthContext.tsx` - Added companyIds support and selectCompany method

### Files Needing Updates:
- `app/_layout.tsx` - Routing logic
- `app/master-signup.tsx` - Post-creation routing
- `app/qr-scanner.tsx` - Role-based routing
- `app/add-user.tsx` - Company assignment
- `app/edit-user.tsx` - Company management
- `app/manage-users.tsx` - Company filtering
- `app/master-sites.tsx` - Company scoping
- `app/company-settings.tsx` - Possible deprecation (replaced by company-setup)

---

**Last Updated:** 2025-01-20
**Implementation Progress:** ~40% Complete
**Estimated Remaining Work:** 4-6 hours for full implementation + testing
