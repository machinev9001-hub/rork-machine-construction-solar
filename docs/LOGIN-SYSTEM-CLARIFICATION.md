# Login System Clarification - ID Numbers Only

## CRITICAL: All Users Use ID Numbers

### Authentication Method
- **ALL users (including Master Accounts) use ID Numbers + PIN**
- **NO email-based authentication**
- **NO separate login methods for different user types**

### User Types and Their Login

#### 1. Master Accounts
- **Login with**: Master ID Number (e.g., "123456789") + PIN
- **Stored in**: `masterAccounts` collection
- **Key field**: `masterId` (stores the ID number, NOT email)
- **Example**: Master with ID "123456789" logs in with "123456789" + their PIN

#### 2. Regular Users (Added via Company Settings)
- **Login with**: User ID Number + PIN
- **Stored in**: `users` collection
- **Key field**: `userId` (stores the ID number)
- **Example**: User with ID "987654321" logs in with "987654321" + their PIN

#### 3. Employees (Added via Add Employee)
- **Login with**: Employee ID Number + PIN
- **Stored in**: `employees` collection
- **Key field**: `employeeIdNumber` (stores the ID number)
- **Example**: Employee with ID "2222222222222" logs in with "2222222222222" + their PIN

### Database Structure

```javascript
// Master Account Document
{
  masterId: "123456789",        // ID number, NOT email
  name: "Master User",
  pin: "hashedPin",
  companyIds: [],
  // ... other fields
}

// Regular User Document
{
  userId: "987654321",           // ID number
  name: "Regular User",
  role: "Planner",
  pin: "1234",
  // ... other fields
}

// Employee Document
{
  employeeIdNumber: "2222222222222",  // ID number
  name: "Employee Name",
  role: "General Worker",
  pin: "1234",
  // ... other fields
}
```

### Login Flow
1. User enters their ID number (Master ID, User ID, or Employee ID)
2. User enters their PIN
3. System checks in this order:
   - `masterAccounts` collection for `masterId` match
   - `users` collection for `userId` match
   - `employees` collection for `employeeIdNumber` match
4. If found, validates PIN and logs in

### IMPORTANT NOTES
- **NEVER use email for authentication**
- **ID numbers are the ONLY username**
- **All ID numbers must be unique across all collections**
- **When creating ANY user type, use their ID number as the login identifier**

### QR Code Login
- QR codes contain the ID number + PIN
- Same ID number is used for both manual and QR login
- An employee with ID "2222222222222" can login:
  - Manually: Enter "2222222222222" + PIN
  - QR Code: Scan code containing "2222222222222" + PIN