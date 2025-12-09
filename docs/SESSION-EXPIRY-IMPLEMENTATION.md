# Session Expiry Implementation

## Overview
Implemented automatic session expiry for data integrity and security. The system now clears sessions on page refresh and after 5 minutes of inactivity.

## Key Changes

### 1. Session Cleared on Page Refresh
- **Location**: `contexts/AuthContext.tsx` - `loadUserFromStorage` function
- **Behavior**: When the app loads, it immediately clears the stored user session
- **Purpose**: Ensures data integrity by requiring fresh authentication
- **Implementation**:
  ```typescript
  // Clear session on page refresh for data integrity
  await AsyncStorage.removeItem(STORAGE_KEYS.USER);
  await AsyncStorage.removeItem(STORAGE_KEYS.LAST_ACTIVITY);
  ```

### 2. 5-Minute Inactivity Timeout
- **Location**: `contexts/AuthContext.tsx` - `INACTIVITY_TIMEOUT` constant
- **Previous**: 8 hours (8 * 60 * 60 * 1000 ms)
- **Current**: 5 minutes (5 * 60 * 1000 ms)
- **Check Frequency**: Every 30 seconds
- **Behavior**: Automatically logs out user after 5 minutes of no activity

### 3. Inactivity Monitoring
- **Implementation**: Interval timer checks activity every 30 seconds
- **Location**: `contexts/AuthContext.tsx` - lines 410-425
- **Features**:
  - Tracks last activity timestamp
  - Compares against 5-minute threshold
  - Automatic logout with reason tracking
  - Updates activity while user is active

## User Experience

### Login Flow
1. User opens/refreshes the app
2. Session is automatically cleared
3. User must enter ID Number + PIN
4. Session remains active for 5 minutes of activity
5. After 5 minutes of inactivity, automatic logout

### Security Benefits
- **Data Integrity**: Fresh authentication ensures current data
- **Security**: Prevents unauthorized access from unattended devices
- **Consistency**: All users (master, employees, operators) follow same rules

## Technical Details

### Storage Keys Affected
- `@user` - Cleared on refresh and timeout
- `@last_activity` - Cleared on refresh, updated during activity

### Cached Data Retention
- **Important**: Only the session is cleared
- **Offline data remains intact** for quick re-authentication
- **Firestore cache preserved** for offline operations
- **AsyncStorage data preserved** for offline login

## Testing

### Test Scenarios
1. **Page Refresh**: Refresh page → Should require login
2. **5-Minute Timeout**: Login → Wait 5 minutes idle → Should auto-logout
3. **Active Use**: Login → Keep using app → Should remain logged in
4. **Background/Foreground**: Put app in background → Return after 5 min → Should require login

## Configuration

To adjust timeout period, modify:
```typescript
const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // Change 5 to desired minutes
```

To adjust check frequency, modify:
```typescript
}, 30 * 1000); // Change 30 to desired seconds
```

## Impact on Features

### Preserved Features
- Offline login capability
- Cached data for offline operations
- Quick re-authentication
- All user types supported

### Changed Behavior
- No persistent sessions across refreshes
- Automatic timeout after inactivity
- Must re-authenticate regularly

## Notes
- Session expiry is for security and data integrity
- Does not affect offline data caching
- Users can quickly re-login with cached credentials
- All authentication methods (ID Number, QR Code) respect session expiry