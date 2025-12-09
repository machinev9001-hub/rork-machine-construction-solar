# Activation Code & Master PIN Workflow

## Overview
The activation code system replaces the hardcoded PIN ('3002') with a scalable, secure activation workflow for multiple tenants and companies.

## Architecture

### 1. Activation Code Flow
```
User Journey:
1. Login Screen → Click "Activate New Account"
2. Activation Code Entry → Enter 16-character code (XXXX-XXXX-XXXX-XXXX)
3. Code Validation → Checks against Firestore `activation_codes` collection
4. Master PIN Setup → Set secure PIN with confirmation
5. Account Creation → Master account created in `masterAccounts` collection
6. Login → Use Master ID and PIN to log in
```

### 2. Database Structure

#### Collection: `activation_codes`
```typescript
{
  id: string;                        // Auto-generated document ID
  code: string;                      // Activation code (e.g., "A7F9-3K2L-9XQ1-4B2H")
  companyId?: string;                // Optional company/tenant ID
  companyName?: string;              // Optional company name
  status: 'active' | 'redeemed' | 'expired' | 'revoked';
  expiryDate?: Timestamp | null;    // Optional expiry date
  redeemedAt?: Timestamp | null;    // When code was redeemed
  redeemedBy?: string;               // Master account ID that redeemed
  createdAt: Timestamp;              // When code was created
  updatedAt?: Timestamp;             // Last update
  maxRedemptions?: number;           // Max times code can be used (default: 1)
  currentRedemptions?: number;       // Current redemption count
}
```

#### Collection: `masterAccounts` (Updated)
```typescript
{
  id: string;                        // Auto-generated document ID
  masterId: string;                  // Master user ID for login
  name: string;                      // Master name
  pin: string;                       // Hashed PIN (PBKDF2)
  pinSalt: string;                   // Salt for PIN hashing
  activationCodeId?: string;         // Reference to activation code
  companyId?: string;                // Company/tenant ID
  companyName?: string;              // Company name
  createdAt: Timestamp;              // Account creation timestamp
}
```

### 3. Security Features

#### PIN Hashing
- **Algorithm**: PBKDF2 with SHA-256
- **Iterations**: 10,000
- **Key Size**: 256 bits
- **Salt**: 128-bit random salt per user
- **Storage**: Hash and salt stored separately

```typescript
// Example
const { hash, salt } = hashPin("1234");
// hash: "a7f3b2..." (hashed PIN)
// salt: "c4e9d1..." (random salt)
```

#### PIN Validation
```typescript
const isValid = verifyPin(userInput, storedHash, storedSalt);
// Returns true if PIN matches, false otherwise
```

#### PIN Security Rules
- Length: 4-6 digits
- Must be numeric
- Cannot be all same digit (e.g., 1111)
- Cannot contain sequential digits (e.g., 1234)

### 4. Code Generation

```typescript
generateActivationCode();
// Returns: "A7F9-3K2L-9XQ1-4B2H"
// Format: 4 segments of 4 characters
// Characters: A-Z (excluding I, O), 2-9 (excluding 0, 1)
```

### 5. Validation Logic

```typescript
validateActivationCode(code: string): Promise<ActivationValidationResult>
```

Checks:
1. Code exists in database
2. Status is 'active'
3. Not expired (if expiryDate set)
4. Below max redemptions (if set)

Returns:
```typescript
{
  isValid: boolean;
  error?: string;
  activationCode?: ActivationCode;
}
```

### 6. Redemption Process

```typescript
markActivationCodeAsRedeemed(codeId: string, redeemedBy: string)
```

Actions:
1. Increment currentRedemptions
2. Set redeemedAt timestamp
3. Set redeemedBy to master account ID
4. If currentRedemptions >= maxRedemptions, set status to 'redeemed'

## File Structure

```
/app
  /activate.tsx                    # Activation code entry screen
  /setup-master-pin.tsx            # Master PIN setup screen
  /login.tsx                       # Updated to link to activation
  /_layout.tsx                     # Updated navigation

/contexts
  /AuthContext.tsx                 # Updated with secure PIN and activation

/utils
  /activationCode.ts               # Activation validation and redemption
  /pinSecurity.ts                  # PIN hashing and validation

/types
  /activation.ts                   # TypeScript types for activation
```

## Migration from Old System

### Before (Hardcoded)
```typescript
if (activationCode !== '3002') {
  return { success: false, error: 'Invalid activation code' };
}
```

### After (Database-driven)
```typescript
const result = await validateActivationCode(activationCode);
if (!result.isValid) {
  return { success: false, error: result.error };
}
```

## Creating Activation Codes

### Manual Creation (Firestore Console)
```json
{
  "code": "A7F9-3K2L-9XQ1-4B2H",
  "companyName": "Acme Corp",
  "companyId": "acme-001",
  "status": "active",
  "createdAt": "2025-01-19T10:00:00Z",
  "maxRedemptions": 1,
  "currentRedemptions": 0,
  "expiryDate": "2026-01-19T10:00:00Z"
}
```

### Programmatic Generation
```typescript
import { generateActivationCode } from '@/utils/activationCode';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const code = generateActivationCode();
await addDoc(collection(db, 'activation_codes'), {
  code,
  companyName: 'Acme Corp',
  status: 'active',
  createdAt: serverTimestamp(),
  maxRedemptions: 1,
  currentRedemptions: 0,
});
```

## Testing

### Test Activation Code Creation
1. Go to Firestore console
2. Create document in `activation_codes` collection
3. Use generated code in app
4. Verify redemption updates correctly

### Test Secure PIN
1. Create master account with PIN "1234"
2. Check `masterAccounts` collection
3. Verify `pin` field contains hash, not plaintext
4. Verify `pinSalt` field exists
5. Login with PIN "1234" - should work
6. Login with wrong PIN - should fail

## Offline Behavior

### Activation (Requires Online)
- Initial activation MUST be online
- Code validation requires Firestore access
- After activation, credentials cached locally

### Login (Works Offline)
- PIN verification can work offline using cached hash
- Fallback to stored hash if salt missing (legacy support)

## Multi-Tenant Support

### Per-Company Codes
```typescript
{
  code: "A7F9-3K2L-9XQ1-4B2H",
  companyId: "acme-001",
  companyName: "Acme Corp",
  status: "active"
}
```

### Multi-Use Codes (Optional)
```typescript
{
  code: "MULTI-CODE-HERE",
  maxRedemptions: 10,      // Allow 10 users
  currentRedemptions: 3,   // 3 have activated
  status: "active"         // Still active
}
```

## Security Best Practices

1. **Activation Codes**
   - Generate random, unpredictable codes
   - Use time-limited expiry
   - Rotate codes regularly
   - Track redemptions

2. **PINs**
   - Always hash before storage
   - Use unique salt per user
   - Never log plaintext PINs
   - Enforce complexity rules

3. **Database Rules**
   - Restrict activation_codes read access
   - Only allow authenticated writes
   - Log all redemption attempts

## Future Enhancements

1. **Email Integration**
   - Send activation codes via email
   - Verification workflows

2. **Admin Dashboard**
   - Generate codes via UI
   - Monitor redemptions
   - Revoke codes

3. **Rate Limiting**
   - Limit validation attempts
   - Prevent brute force

4. **Two-Factor Authentication**
   - SMS/Email verification
   - TOTP support
