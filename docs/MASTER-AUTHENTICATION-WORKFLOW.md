# Master Authentication & Setup Workflow Documentation

## Overview
This document provides comprehensive documentation of the complete authentication workflow for the Machine App, including master account creation, company setup, and site management.

## System Architecture

### User Types
1. **Master Account** - Company owner/admin with full control
2. **Regular Users** - Employees with role-based access (Admin, Planner, Supervisor, QC, Operator, etc.)
3. **Employees** - Workers who login with ID numbers

### Database Structure

#### masterAccounts Collection
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

#### users Collection
```typescript
{
  id: string;
  userId: string;
  name: string;
  role: UserRole;            // Including 'master' role for unified handling
  companyIds: string[];
  currentCompanyId?: string;
  pin?: string;
  masterAccountId?: string;  // Reference to master account
  siteId?: string;
  siteName?: string;
  createdAt: Timestamp;
}
```

#### companies Collection
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

#### sites Collection
```typescript
{
  id: string;
  name: string;
  companyId: string;
  masterAccountId: string;
  description?: string;
  location?: string;
  status: 'Active' | 'Inactive' | 'Archived';
  createdAt: Timestamp;
}
```

#### employees Collection
```typescript
{
  id: string;
  employeeIdNumber: string;  // ID number for login
  name: string;
  role: string;
  companyId: string;
  siteId?: string;
  pin?: string;
  createdAt: Timestamp;
}
```

## Complete Workflow

### 1. Initial Page Load
```
User opens app → _layout.tsx loads → AuthContext initializes
↓
loadUserFromStorage() called
↓
ALWAYS clears session (for data integrity)
↓
Sets user=null, masterAccount=null
↓
Navigation to /login
```

### 2. Master Account Creation Flow
```
/login → "Activate New Account" → /activate
↓
Enter activation code
↓
/setup-master-pin
↓
Create master account with:
- Name
- Master ID (unique)
- PIN (4-6 digits)
- Activation code validation
↓
Master account created in masterAccounts collection
↓
Redirected to /company-setup
```

### 3. Master Account Login Flow
```
/login → Enter Master ID + PIN
↓
System checks masterAccounts collection
↓
PIN validation (hashed comparison)
↓
Master account loaded as both:
- masterAccount state
- user state (with role: 'master')
↓
Check company status:
- No companies → /company-setup
- Has companies but none selected → /company-selector
- Has selected company → /master-sites
```

### 4. Company Setup Flow
```
/company-setup
↓
Enter company details:
- Industry sector
- Legal entity name
- Alias
- Address
- Contact details
- Registration & VAT numbers
↓
Company created in companies collection
↓
Master account's companyIds[] updated
↓
Redirect to /master-sites
```

### 5. Company Selection Flow
```
/company-selector (when multiple companies exist)
↓
Display list of companies
↓
Select company
↓
Updates currentCompanyId in state
↓
Saves to AsyncStorage for session
↓
Navigate to /master-sites
```

### 6. Site Management Flow
```
/master-sites
↓
Create new site:
- Site name
- Description
- Location
↓
Site created in sites collection
- Linked to current companyId
- Linked to masterAccountId
↓
Site appears in list
↓
Can open site to manage (creates master user for that site)
```

### 7. Employee Login Flow
```
/login → Enter Employee ID Number + PIN
↓
System checks:
1. masterAccounts collection
2. users collection
3. employees collection (by employeeIdNumber)
↓
If found in employees:
- First time → Setup PIN
- Has PIN → Validate
↓
Create User object from employee data
↓
Navigate based on role:
- Management roles → /(tabs)
- Worker roles → /employee-timesheet
```

### 8. Session Management

#### No Persistence on Refresh
- Session is ALWAYS cleared on page refresh
- Forces re-login for data integrity
- Prevents stale data issues

#### Inactivity Timeout
- 5-minute inactivity timer
- Checks every 30 seconds
- Auto-logout on timeout

#### Navigation State Machine
```
isLoading=true → Show loading screen
↓
isLoading=false → Check user/masterAccount
↓
No user & No master → /login
↓
Master without companies → /company-setup
↓
Master with companies, none selected → /company-selector
↓
Master with selected company → /master-sites
↓
Regular user → /(tabs) or /employee-timesheet
```

## Common Issues & Solutions

### Issue 1: Page Refresh Logs Out User
**Cause**: Intentional design for data integrity
**Solution**: This is expected behavior - ensures fresh data on each session

### Issue 2: Company Creation Success but Stays on Page
**Cause**: Navigation timing issue
**Solution**: Alert callback explicitly handles navigation after success

### Issue 3: Site Creation Error "No company selected"
**Cause**: currentCompanyId not set in state
**Solution**: System checks multiple sources for company ID:
1. AsyncStorage SELECTED_COMPANY
2. currentCompanyId in state
3. First company in companyIds array

### Issue 4: Debug Messages on Page Load
**Cause**: Console.log statements in initialization
**Solution**: These are for development - will be removed in production

## Security Considerations

1. **PIN Storage**: Always hashed with salt, never plain text
2. **Session Clearing**: Automatic on refresh prevents stale sessions
3. **Inactivity Timeout**: 5-minute auto-logout for security
4. **Role-Based Access**: Each user type has specific allowed routes
5. **Company Isolation**: Users can only access their assigned companies

## Testing Checklist

- [ ] Master account creation with activation code
- [ ] Master account login with PIN
- [ ] Company creation and selection
- [ ] Site creation within company
- [ ] Employee login with ID number
- [ ] PIN setup for first-time users
- [ ] Session timeout after 5 minutes
- [ ] Page refresh clears session
- [ ] Navigation to correct screens based on role
- [ ] Multiple company management

## Migration Notes

### Unified User/Master Handling
The system now treats master accounts as users with role='master' for consistent state management. This allows:
- Single auth flow for all user types
- Consistent navigation logic
- Simplified permission checks
- Better session management