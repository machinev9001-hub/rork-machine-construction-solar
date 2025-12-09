# Login System - ID Numbers Only Implementation

## ✅ CONFIRMED: ALL Users Use ID Numbers for Login

### System Design
**CRITICAL**: 
- **NO EMAIL LOGINS**: This system NEVER uses email addresses for authentication
- **ID NUMBERS ONLY**: Every single user (Masters, Employees, all roles) uses ID numbers
- **UNIFIED SYSTEM**: Master accounts work exactly like other accounts - ID + PIN
- **SIMPLE**: One authentication method for everyone: ID Number + PIN

### Login Methods by User Type

#### 1. Master Accounts
- **Collection**: `masterAccounts`  
- **Login Field**: `masterId` (ID number, NOT email)
- **Authentication**: ID Number + PIN
- **Example**: Master with ID "3002" logs in with "3002" + PIN

#### 2. Regular Users (Company Users)
- **Collection**: `users`
- **Login Field**: `userId` (ID number)
- **Authentication**: ID Number + PIN  
- **Example**: User with ID "987654321" logs in with "987654321" + PIN

#### 3. Employees
- **Collection**: `employees`
- **Login Field**: `employeeIdNumber` (ID number)
- **Authentication**: ID Number + PIN
- **Example**: Employee with ID "2222222222222" logs in with "2222222222222" + PIN

### Database Fields Reference

```typescript
// Master Account
{
  masterId: "3002",              // The ID number used for login
  name: "John Master",
  pin: "hashedPin",
  companyIds: [],
  // ... other fields
}

// Regular User
{
  userId: "987654321",           // The ID number used for login
  name: "Jane Planner",
  role: "Planner",
  pin: "1234",
  // ... other fields
}

// Employee
{
  employeeIdNumber: "2222222222222",  // The ID number used for login
  name: "Bob Worker",
  role: "General Worker",
  pin: "5678",
  // ... other fields
}
```

### Authentication Flow

1. User enters ID number (any type: Master ID, User ID, Employee ID)
2. User enters PIN
3. System checks in order:
   - `masterAccounts` collection for `masterId` match
   - `users` collection for `userId` match  
   - `employees` collection for `employeeIdNumber` match
4. Validates PIN
5. Logs in user with appropriate permissions

### QR Code Integration
- QR codes contain: ID Number + PIN
- Same ID number works for both manual and QR login
- Example: Employee "2222222222222" can:
  - Login manually: Enter "2222222222222" + PIN
  - Login via QR: Scan code containing "2222222222222" + PIN

### Key Implementation Details

1. **Login Screen**: Shows "ID / Master ID" field (not email)
2. **Master Setup**: Uses "Master User ID" field (not email)
3. **Employee Addition**: Uses "ID Number" field
4. **User Addition**: Uses "User ID" field

### Fixed Issues (January 2025)

1. ✅ Removed all email references from login system
2. ✅ Master accounts use ID numbers (masterId field)
3. ✅ Employees login with employeeIdNumber
4. ✅ State persistence after employee login
5. ✅ Consistent ID-based authentication across all user types

### Important Notes

- **NO EMAIL FIELDS**: Never use or expect email for authentication
- **UNIQUE IDs**: All ID numbers must be unique across collections
- **CONSISTENT**: Same ID used for manual login, QR codes, and API calls
- **SIMPLE**: One authentication method for all users: ID Number + PIN
- **MASTER = USER**: Masters are handled as regular users with role='master' for consistency

### Technical Implementation (January 2025)

Master accounts are now stored as User objects in storage to ensure consistent state management:
- When a master logs in, they are stored as a User with role='master'
- This prevents state loss issues where `hasMasterAccount: false` after login
- The system sets both `user` and `masterAccount` states for backward compatibility
- All navigation and state checks work consistently