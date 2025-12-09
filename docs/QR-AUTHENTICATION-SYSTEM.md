# QR-Based Role-Aware Authentication System

## Overview
This system implements a single QR code per user that provides different access levels depending on who scans it. The QR code contains only the user's UUID, making it secure and context-aware.

## Architecture

### Core Concept
- **QR Code Content**: `user/{userId}` (just the UUID, no sensitive data)
- **Role-Based Routing**: The system determines what UI to show based on the scanner's role
- **PIN Security**: Users must enter their PIN when accessing their own account
- **Manager Access**: HSE and Admin roles can access user profiles without a PIN

## Implementation

### 1. QR Scanner (`app/qr-scanner.tsx`)
The scanner supports three contexts:

#### Context: `login`
- **Purpose**: Standard user login
- **Flow**: 
  1. User scans their QR code
  2. System resolves UUID → fetches user data
  3. PIN modal appears
  4. After PIN entry → navigates to user's role-specific UI

#### Context: `hse`
- **Purpose**: HSE officer managing workers
- **Flow**:
  1. HSE officer scans worker's QR code
  2. System resolves UUID → fetches employee data
  3. Opens employee detail page directly (no PIN required)
  4. HSE can view/edit employee information

#### Context: `admin`
- **Purpose**: Admin/Master managing users
- **Flow**:
  1. Admin scans user's QR code
  2. System resolves UUID → fetches user data
  3. Opens user management page directly (no PIN required)
  4. Admin can edit user details, permissions, etc.

### 2. QR Generator (`app/generate-qr.tsx`)
- Generates a visual QR-like code for each user
- Users can copy their User ID
- Users can share their information
- Displays security instructions

### 3. Login Page Integration
The login page now has a "Scan QR" button next to "Sign In":
- Clicking opens the QR scanner in `login` context
- After successful scan and PIN entry, user is logged in
- Same as typing ID + PIN manually

## Usage Instructions

### For End Users (Standard Login)
1. Navigate to login page
2. Click "Scan QR" button
3. Scan your personal QR code
4. Enter your PIN when prompted
5. Access your role-specific dashboard

### For HSE Officers (Employee Management)
1. Open HSE dashboard
2. Click "Scan Employee QR" (when implemented)
3. Scan employee's QR code
4. Employee profile opens immediately
5. View/edit employee details, induction status, etc.

### For Admins (User Management)
1. Open Admin panel
2. Click "Scan User QR" (when implemented)
3. Scan user's QR code
4. User management page opens immediately
5. Edit user permissions, roles, settings

## Security Features

### 1. No Sensitive Data in QR
- QR only contains `user/{userId}`
- No PINs, passwords, or private information
- If QR is intercepted, it's just an identifier

### 2. Role-Based Access Control
- System checks scanner's role before granting access
- Users can't access other users' accounts without proper role
- HSE can only view/edit employees
- Admin has full access
- Regular users can only access their own account (with PIN)

### 3. PIN Protection for Personal Access
- When users scan their own QR to login, PIN is required
- PIN never stored in QR code
- PIN verified server-side against hashed value

### 4. Context-Aware Permissions
- Same QR code behaves differently based on context
- Login context: Requires PIN
- HSE context: No PIN, limited to employee data
- Admin context: No PIN, full management access

## Database Structure

### User Document (Firestore)
```typescript
{
  id: string;              // Document ID
  userId: string;          // User identifier (for QR: user/{userId})
  name: string;
  role: UserRole;
  pin?: string;            // Hashed PIN
  siteId?: string;
  masterAccountId?: string;
  // ... other fields
}
```

### Employee Document (Firestore)
```typescript
{
  id: string;              // Document ID (used as userId for QR)
  name: string;
  role: string;
  contact: string;
  inductionStatus: boolean;
  siteId: string;
  masterAccountId: string;
  pin?: string;            // Optional PIN for employee app access
  // ... other fields
}
```

## Integration Points

### Adding QR Scan to HSE Dashboard
```typescript
<TouchableOpacity
  onPress={() => router.push({ 
    pathname: '/qr-scanner', 
    params: { context: 'hse' } 
  })}
>
  <ScanLine size={24} color="#3b82f6" />
  <Text>Scan Employee QR</Text>
</TouchableOpacity>
```

### Adding QR Scan to Admin Panel
```typescript
<TouchableOpacity
  onPress={() => router.push({ 
    pathname: '/qr-scanner', 
    params: { context: 'admin' } 
  })}
>
  <ScanLine size={24} color="#3b82f6" />
  <Text>Scan User QR</Text>
</TouchableOpacity>
```

### Generating User's QR Code
```typescript
<TouchableOpacity
  onPress={() => router.push({ 
    pathname: '/generate-qr',
    params: { userId: user.userId, userName: user.name }
  })}
>
  <QrCode size={24} color="#3b82f6" />
  <Text>View My QR Code</Text>
</TouchableOpacity>
```

## Error Handling

### Common Scenarios
1. **User Not Found**
   - Scanner checks both `users` and `employees` collections
   - Shows "User not found" error
   - Allows re-scanning

2. **Permission Denied**
   - If scanner doesn't have proper role for context
   - Shows "Access Denied" message
   - Prevents unauthorized access

3. **Incorrect PIN**
   - Shows "Incorrect PIN" error
   - Allows retry without re-scanning
   - Clears PIN field for security

4. **Network Error**
   - Catches Firestore errors gracefully
   - Shows user-friendly error message
   - Suggests checking connection

## Benefits

### For Users
- Fast login (scan + PIN vs typing ID + PIN)
- No need to remember/type User ID
- One QR code for all purposes
- Secure (PIN still required for personal access)

### For HSE Officers
- Quickly access employee profiles on-site
- No need to search by name/ID
- Instant access to induction status, certifications
- Edit details immediately

### For Admins
- Rapid user management
- On-the-spot permission changes
- Easy user verification
- Efficient account maintenance

### For System
- Scalable (same QR works everywhere)
- Secure (no sensitive data exposed)
- Flexible (easy to extend for new roles)
- Maintainable (centralized authentication logic)

## Future Enhancements

1. **QR Code Printing**
   - Generate printable PDFs
   - Include user photo and details
   - Create ID badges

2. **Bulk QR Generation**
   - Admin generates QRs for all employees
   - Export as PDF sheet
   - Print and distribute

3. **QR Expiration**
   - Time-limited QR codes for visitors
   - Temporary access codes
   - Auto-revoke after period

4. **Audit Trail**
   - Log all QR scans
   - Track who accessed whose profile
   - Security monitoring

5. **Offline Support**
   - Cache user data for offline scanning
   - Queue scans when offline
   - Sync when connection restored

## Testing Checklist

### User Login via QR
- [ ] Scan QR from login page
- [ ] PIN modal appears
- [ ] Enter correct PIN → login succeeds
- [ ] Enter wrong PIN → error shown, can retry
- [ ] Cancel → returns to scanner

### HSE Employee Management
- [ ] HSE role can scan employee QR
- [ ] Employee detail page opens without PIN
- [ ] Can view employee information
- [ ] Can edit employee details
- [ ] Non-HSE role blocked from this flow

### Admin User Management
- [ ] Admin role can scan user QR
- [ ] User edit page opens without PIN
- [ ] Can modify user permissions
- [ ] Can lock/unlock accounts
- [ ] Non-admin role blocked from this flow

### Error Handling
- [ ] Invalid QR shows error
- [ ] Network error handled gracefully
- [ ] Permission denied shows appropriate message
- [ ] Can retry after errors

### Security
- [ ] QR doesn't expose sensitive data
- [ ] PIN required for personal account access
- [ ] Role-based access enforced
- [ ] Unauthorized access prevented

## Files Modified/Created

### New Files
- `app/qr-scanner.tsx` - QR scanning and role-based routing
- `app/generate-qr.tsx` - QR code display and sharing
- `docs/QR-AUTHENTICATION-SYSTEM.md` - This documentation

### Modified Files
- `app/login.tsx` - Added "Scan QR" button
- Package dependencies - Added expo-clipboard

## Dependencies
- `expo-camera` - QR code scanning
- `expo-clipboard` - Copy user ID
- `react-native-svg` - Visual QR code display

## Notes
- The QR code in `generate-qr.tsx` is a simplified visual representation
- For production, consider using actual QR libraries if custom native builds are available
- Current implementation works with Expo Go and is web-compatible
