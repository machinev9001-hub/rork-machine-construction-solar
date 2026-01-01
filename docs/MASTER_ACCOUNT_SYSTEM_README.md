# Master Account & Company Ownership System

## 🎯 Overview

This implementation adds a comprehensive identity verification and multi-owner company system to the MACHINE Business Tracker application.

## 📋 What's New

### Core Features
- ✅ **National ID Verification**: Secure identity verification with admin approval
- ✅ **Duplicate Detection**: Automatic detection and fraud dispute resolution
- ✅ **Multi-Owner Companies**: Multiple owners with percentage-based ownership
- ✅ **Ownership vs Roles**: Economic ownership separated from functional roles
- ✅ **Audit Trails**: Complete accountability for all operations
- ✅ **Backward Compatible**: No breaking changes to existing functionality

### New Collections
1. **companyOwnership** - Multi-owner support with percentages
2. **companyRoles** - Functional roles (Director, Admin, Manager, etc.)
3. **masterIDVerification** - ID document verification workflow
4. **fraudDisputes** - Duplicate national ID conflict resolution
5. **ownershipChangeRequests** - Multi-owner approval workflow (ready for implementation)
6. **masterAccountAuditLogs** - Enhanced audit logging

### Updated Collections
- **masterAccounts** - Added verification status and permission flags
- **companies** - Added ownership tracking fields

## 🚀 Quick Start

### 1. Deploy Indexes (CRITICAL)
```bash
firebase deploy --only firestore:indexes
```

### 2. Read Documentation
- **[Master Account & Ownership Guide](./MASTER_ACCOUNT_OWNERSHIP_GUIDE.md)** - Complete implementation guide
- **[Firestore Indexes Setup](./FIRESTORE_INDEXES_SETUP.md)** - Detailed index documentation
- **[New Indexes Summary](./NEW_INDEXES_SUMMARY.md)** - Quick reference list

### 3. Migrate Existing Data
Use migration scripts in the implementation guide to:
- Update existing master accounts with new fields
- Create ownership records for existing companies

## 📊 New Firestore Indexes

**26 new composite indexes** have been added to support efficient queries:

- 3 for masterAccounts (verification queries)
- 4 for companyOwnership (ownership queries)
- 3 for companyRoles (role queries)
- 3 for masterIDVerification (verification workflow)
- 4 for fraudDisputes (fraud detection)
- 3 for ownershipChangeRequests (approval workflow)
- 6 for masterAccountAuditLogs (audit trail queries)

See [NEW_INDEXES_SUMMARY.md](./NEW_INDEXES_SUMMARY.md) for the complete list.

## 🔐 Security Model

### Verification Levels
- **UNVERIFIED** (default): Restricted access, cannot own companies or receive payouts
- **PENDING_REVIEW**: ID document submitted, awaiting admin approval
- **VERIFIED**: Full access, can own companies and receive payouts
- **REJECTED**: Verification failed, restrictions remain

### Permission Flags
Each master account has three permission flags (default: false):
- `canOwnCompanies` - Can be a company owner
- `canReceivePayouts` - Can receive financial distributions
- `canApproveOwnershipChanges` - Can approve ownership changes

All three require `VERIFIED` status.

## 🏢 Company Ownership

### Ownership Structure
- Multiple owners supported per company
- Ownership defined by percentages (must total 100%)
- Each ownership record includes:
  - Ownership percentage (0-100)
  - Voting rights (boolean)
  - Economic rights (boolean)
  - Status (active, pending, suspended, revoked)

### Ownership vs Roles
**Ownership** = Economic rights and voting power  
**Roles** = Functional permissions and responsibilities

A master account can have:
- Ownership percentage (e.g., 30%)
- One or more roles (e.g., Director, Manager)
- Or just ownership without a role
- Or just a role without ownership

## 📝 Usage Examples

### Check National ID Uniqueness
```typescript
import { checkNationalIdExists } from '@/utils/masterIdVerification';

const { exists, masterAccountId, masterAccountName } = 
  await checkNationalIdExists("8901234567089");

if (exists) {
  console.log(`ID already registered to ${masterAccountName}`);
}
```

### Submit ID Verification
```typescript
import { submitIdVerification } from '@/utils/masterIdVerification';

const result = await submitIdVerification({
  masterAccountId: "master_xyz",
  nationalIdNumber: "8901234567089",
  documentType: "national_id",
  documentUrl: "https://storage...",
  storagePath: "path/to/doc",
  metadata: { fileName: "id.pdf", fileSize: 2048000 }
});
```

### Add Company Owner
```typescript
import { addCompanyOwner } from '@/utils/companyOwnership';

const result = await addCompanyOwner({
  companyId: "comp_abc",
  masterAccountId: "master_xyz",
  masterAccountName: "John Smith",
  ownershipPercentage: 30,
  votingRights: true,
  economicRights: true,
  grantedBy: "master_admin",
  notes: "New partner"
});
```

### Assign Company Role
```typescript
import { assignCompanyRole } from '@/utils/companyOwnership';

await assignCompanyRole({
  companyId: "comp_abc",
  masterAccountId: "master_xyz",
  masterAccountName: "John Smith",
  role: "Director",
  permissions: ["manage_users", "approve_timesheets"],
  assignedBy: "master_admin"
});
```

## 🧪 Testing

### Manual Test Flow
1. Create new master account → Should be UNVERIFIED
2. Try to create company → Should fail with permission error
3. Submit ID verification → Status changes to PENDING_REVIEW
4. Admin approves → Status changes to VERIFIED, permissions enabled
5. Create company → Should succeed
6. Add second owner with 30% → Should succeed
7. Try to add third owner with 80% → Should fail (would exceed 100%)
8. Change first owner to 35% → Should succeed
9. Assign role to owner → Should succeed
10. Check audit logs → All operations logged

### Unit Tests (Future)
- National ID uniqueness validation
- Ownership percentage validation
- Permission flag enforcement
- Duplicate detection logic

## 📈 Performance Considerations

### Denormalization
To optimize query performance, certain fields are denormalized:
- Master account names in ownership/role records
- Company names in ownership change requests
- This avoids joins and improves read speed

### Index Usage
All common query patterns are covered by composite indexes:
- Get all owners of a company
- Get all companies owned by a master account
- Get pending verification requests
- Get active fraud disputes
- Query audit logs by various criteria

### Transaction Safety
Ownership changes use Firestore transactions to prevent:
- Race conditions when adding owners
- Ownership exceeding 100%
- Concurrent modification conflicts

## 🔄 Migration Guide

### Existing Master Accounts
All existing master accounts will default to:
- `idVerificationStatus: UNVERIFIED`
- `duplicateIdStatus: NONE`
- `canOwnCompanies: false`
- `canReceivePayouts: false`
- `canApproveOwnershipChanges: false`

**Action Required**: Run migration script to verify existing accounts or update their permissions.

### Existing Companies
Companies created before this update need ownership records created.

**Action Required**: Run migration script to create 100% ownership for the creator.

See [MASTER_ACCOUNT_OWNERSHIP_GUIDE.md](./MASTER_ACCOUNT_OWNERSHIP_GUIDE.md) for detailed migration scripts.

## 🐛 Troubleshooting

### Index Errors
If queries fail with "requires an index" errors:
1. Check Firebase Console > Firestore > Indexes
2. Verify all 26 indexes are "Enabled" (not "Building")
3. If stuck, delete and redeploy: `firebase deploy --only firestore:indexes`

### Permission Errors
If operations fail with permission errors:
1. Check master account's verification status
2. Verify permission flags are set correctly
3. Ensure admin has verified the account

### Ownership Percentage Errors
If ownership changes fail:
1. Verify total ownership doesn't exceed 100%
2. Check that percentages are positive numbers
3. Use transactions for concurrent modifications

## 📚 Further Reading

- **[Implementation Guide](./MASTER_ACCOUNT_OWNERSHIP_GUIDE.md)** (21KB)
  - Complete feature documentation
  - Database schema details
  - Code examples
  - Migration strategies
  - Security considerations

- **[Indexes Setup Guide](./FIRESTORE_INDEXES_SETUP.md)** (13KB)
  - All 26 indexes explained
  - Deployment instructions
  - Troubleshooting guide
  - Performance impact

- **[Indexes Quick Reference](./NEW_INDEXES_SUMMARY.md)** (3KB)
  - Index list for easy reference
  - Verification checklist

## 🤝 Contributing

When working with this system:
1. Always use transactions for ownership changes
2. Log all operations to audit trail
3. Validate ownership percentages
4. Check verification status before restricted operations
5. Follow existing patterns in utility functions

## 📞 Support

For questions or issues:
1. Review the documentation guides
2. Check type definitions in `types/index.ts`
3. Examine utility functions in `utils/` directory
4. Review Firestore rules in `firestore.rules`

## ⚖️ License

Same as the main MACHINE Business Tracker application.
