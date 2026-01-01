# Master Account & Company Ownership System - Implementation Guide

## Overview

This document provides a comprehensive guide to implementing the Master Account and Company Ownership System in your MACHINE Business Tracker application. This system introduces robust identity verification, multi-owner company support, and comprehensive audit trails.

## Key Concepts

### 1. Master Account Definition
- **A Master Account represents a real, unique human being**
- Every person has exactly one Master Account
- All companies, roles, permissions originate from a Master Account
- Master Accounts are the root identity layer

### 2. National ID Uniqueness
- One National ID Number = One Master Account
- ID Numbers are globally unique across the platform
- Database-level enforcement through application logic

### 3. Verification Workflow
- New accounts start as `UNVERIFIED`
- Must upload certified ID document
- Admin reviews and approves/rejects
- Only `VERIFIED` accounts can:
  - Own companies
  - Receive payouts
  - Approve ownership changes

### 4. Multi-Owner Companies
- Companies can have multiple owners
- Ownership defined by percentage shares
- Total ownership must equal 100%
- Ownership is separate from roles

## Firestore Indexes - Manual Setup Required

### CRITICAL: Deploy Indexes

After pulling this PR, you **MUST** deploy the new Firestore indexes:

```bash
firebase deploy --only firestore:indexes
```

### New Indexes Summary

The following indexes have been added to `firestore.indexes.json`:

#### Master Accounts (3 new indexes)
1. `nationalIdNumber` (single field) - For uniqueness checking
2. `idVerificationStatus` + `createdAt` - Query accounts by verification status
3. `duplicateIdStatus` + `createdAt` - Query duplicate ID cases

#### Company Ownership (4 new indexes)
1. `companyId` + `status` + `grantedAt` - Get all owners of a company
2. `masterAccountId` + `status` + `grantedAt` - Get all companies owned by account
3. `companyId` + `masterAccountId` + `status` - Check specific ownership
4. `companyId` + `ownershipPercentage` - Sort owners by percentage

#### Company Roles (3 new indexes)
1. `companyId` + `status` + `assignedAt` - Get all roles in a company
2. `masterAccountId` + `status` + `assignedAt` - Get all roles for an account
3. `companyId` + `masterAccountId` + `role` - Check specific role

#### Master ID Verification (3 new indexes)
1. `masterAccountId` + `status` + `submittedAt` - Get verification history
2. `nationalIdNumber` + `status` - Find verifications by ID number
3. `status` + `submittedAt` - Admin queue of pending verifications

#### Fraud Disputes (4 new indexes)
1. `nationalIdNumber` + `status` - Find disputes for an ID number
2. `status` + `priority` + `reportedAt` - Admin dashboard sorting
3. `reportedBy` + `status` + `reportedAt` - User's reported disputes
4. `existingAccountId` + `status` - Disputes affecting an account

#### Ownership Change Requests (3 new indexes)
1. `companyId` + `status` + `createdAt` - Company's pending requests
2. `requestedBy` + `status` + `createdAt` - User's initiated requests
3. `targetMasterAccountId` + `status` + `createdAt` - Requests affecting account

#### Master Account Audit Logs (6 new indexes)
1. `masterAccountId` + `timestamp` - Account's audit trail
2. `companyId` + `timestamp` - Company's audit trail
3. `actionType` + `timestamp` - Filter by action type
4. `masterAccountId` + `actionType` + `timestamp` - Account's specific actions
5. `companyId` + `actionType` + `timestamp` - Company's specific actions
6. `performedBy` + `timestamp` - Actions by specific user

**Total: 26 new composite indexes**

### Index Deployment Time

Firestore index creation can take several minutes to hours depending on existing data size. Monitor progress in Firebase Console:
- Go to Firestore Database > Indexes tab
- Watch for "Building" status to change to "Enabled"

## New Firestore Collections

### 1. companyOwnership
**Purpose:** Links master accounts to companies with ownership percentages

**Fields:**
- `companyId` - Company document ID
- `masterAccountId` - Owner's master account ID
- `masterAccountName` - Denormalized for performance
- `ownershipPercentage` - 0-100, total must equal 100 per company
- `status` - active | pending | suspended | revoked
- `votingRights` - boolean
- `economicRights` - boolean
- `grantedAt` - timestamp
- `grantedBy` - Master account ID who granted
- `approvedAt` - timestamp
- `approvedBy` - Master account ID who approved
- `notes` - optional string

**Example Document:**
```javascript
{
  companyId: "comp_abc123",
  masterAccountId: "master_xyz789",
  masterAccountName: "John Smith",
  ownershipPercentage: 50,
  status: "active",
  votingRights: true,
  economicRights: true,
  grantedAt: Timestamp,
  grantedBy: "master_admin",
  approvedAt: Timestamp,
  approvedBy: "master_admin",
  notes: "Founding partner",
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### 2. companyRoles
**Purpose:** Defines functional roles separate from ownership

**Fields:**
- `companyId` - Company document ID
- `masterAccountId` - Role holder's master account ID
- `masterAccountName` - Denormalized
- `role` - Director | Admin | Manager | Viewer | Custom
- `customRoleName` - optional, for Custom role
- `permissions` - array of permission strings
- `status` - active | suspended | revoked
- `assignedAt` - timestamp
- `assignedBy` - Master account ID
- `notes` - optional

**Example Document:**
```javascript
{
  companyId: "comp_abc123",
  masterAccountId: "master_xyz789",
  masterAccountName: "John Smith",
  role: "Director",
  permissions: ["manage_users", "approve_timesheets", "view_financials"],
  status: "active",
  assignedAt: Timestamp,
  assignedBy: "master_admin",
  notes: "Operations director",
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### 3. masterIDVerification
**Purpose:** Tracks ID document uploads and verification status

**Fields:**
- `masterAccountId` - Account being verified
- `nationalIdNumber` - The ID number being verified
- `documentType` - national_id | passport | drivers_license | other
- `documentUrl` - Firebase Storage URL
- `storagePath` - Storage path for cleanup
- `status` - UNVERIFIED | PENDING_REVIEW | VERIFIED | REJECTED
- `submittedAt` - timestamp
- `reviewedAt` - timestamp
- `reviewedBy` - Admin ID
- `reviewNotes` - optional
- `rejectionReason` - if rejected
- `verifiedAt` - timestamp
- `metadata` - { fileName, fileSize, mimeType }

**Example Document:**
```javascript
{
  masterAccountId: "master_xyz789",
  nationalIdNumber: "8901234567089",
  documentType: "national_id",
  documentUrl: "https://storage.googleapis.com/...",
  storagePath: "id_verifications/master_xyz789/...",
  status: "VERIFIED",
  submittedAt: Timestamp,
  reviewedAt: Timestamp,
  reviewedBy: "admin_123",
  reviewNotes: "Document verified successfully",
  verifiedAt: Timestamp,
  metadata: {
    fileName: "id_document.pdf",
    fileSize: 2048000,
    mimeType: "application/pdf"
  },
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### 4. fraudDisputes
**Purpose:** Handles duplicate national ID number conflicts

**Fields:**
- `nationalIdNumber` - The disputed ID
- `reportedBy` - Master account ID reporting
- `reportedByName` - Name
- `reportedByEmail` - optional
- `existingAccountId` - Account already using this ID
- `existingAccountName` - Name
- `newAccountId` - New account trying to use ID
- `newAccountName` - Name
- `status` - pending | under_investigation | resolved | dismissed
- `priority` - low | medium | high | critical
- `disputeType` - duplicate_id | identity_theft | data_error | other
- `explanation` - Reporter's explanation
- `supportingDocuments` - array of { url, storagePath, fileName, uploadedAt }
- `resolution` - verified_original | verified_new | both_legitimate | both_blocked
- `resolvedAt` - timestamp
- `resolvedBy` - Admin ID
- `resolutionDetails` - explanation

**Example Document:**
```javascript
{
  nationalIdNumber: "8901234567089",
  reportedBy: "master_new123",
  reportedByName: "Jane Doe",
  reportedByEmail: "jane@example.com",
  existingAccountId: "master_old456",
  existingAccountName: "John Imposter",
  newAccountId: "master_new123",
  newAccountName: "Jane Doe",
  status: "under_investigation",
  priority: "high",
  disputeType: "identity_theft",
  explanation: "This is my ID number, the other account is fraudulent",
  supportingDocuments: [
    {
      url: "https://storage.googleapis.com/...",
      storagePath: "fraud_disputes/...",
      fileName: "my_id.pdf",
      uploadedAt: Timestamp
    }
  ],
  reportedAt: Timestamp,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### 5. ownershipChangeRequests
**Purpose:** Multi-owner approval workflow for ownership changes

**Fields:**
- `companyId` - Company being changed
- `companyName` - Denormalized
- `requestType` - add_owner | remove_owner | change_percentage | transfer_ownership
- `requestedBy` - Master account ID
- `requestedByName` - Name
- `status` - pending | approved | rejected | cancelled
- `targetMasterAccountId` - Account being added/removed/changed
- `targetMasterAccountName` - Name
- `currentOwnershipPercentage` - optional
- `proposedOwnershipPercentage` - optional
- `transferToMasterAccountId` - optional, for transfers
- `requiredApprovals` - number needed
- `currentApprovals` - number received
- `approvers` - array of { masterAccountId, masterAccountName, approvedAt, reason }
- `reason` - explanation
- `notes` - optional

**Example Document:**
```javascript
{
  companyId: "comp_abc123",
  companyName: "ABC Construction",
  requestType: "add_owner",
  requestedBy: "master_founder",
  requestedByName: "Founder Name",
  status: "pending",
  targetMasterAccountId: "master_newpartner",
  targetMasterAccountName: "New Partner",
  proposedOwnershipPercentage: 25,
  requiredApprovals: 2,
  currentApprovals: 1,
  approvers: [
    {
      masterAccountId: "master_founder",
      masterAccountName: "Founder Name",
      approvedAt: Timestamp,
      reason: "Approved as initiator"
    },
    {
      masterAccountId: "master_partner2",
      masterAccountName: "Partner 2",
      approvedAt: null,
      reason: null
    }
  ],
  reason: "Adding new investment partner",
  notes: "Investment agreement signed",
  createdAt: Timestamp
}
```

### 6. masterAccountAuditLogs
**Purpose:** Comprehensive audit trail for all master account operations

**Fields:**
- `masterAccountId` - Account performing or affected by action
- `masterAccountName` - Denormalized
- `companyId` - optional, if company-specific
- `companyName` - optional
- `siteId` - optional
- `siteName` - optional
- `actionType` - enum of actions (see types/index.ts)
- `actionDescription` - human-readable description
- `performedBy` - Master account ID who performed action
- `performedByName` - Name
- `targetEntity` - ID of entity acted upon
- `targetEntityType` - master_account | company | ownership | role | site | asset | user | timesheet
- `previousValue` - JSON string of previous state
- `newValue` - JSON string of new state
- `timestamp` - when action occurred

**Example Document:**
```javascript
{
  masterAccountId: "master_xyz789",
  masterAccountName: "John Smith",
  companyId: "comp_abc123",
  companyName: "ABC Construction",
  actionType: "company_ownership_added",
  actionDescription: "Added 30% ownership",
  performedBy: "master_admin",
  performedByName: "Admin User",
  targetEntity: "ownership_id123",
  targetEntityType: "ownership",
  previousValue: null,
  newValue: JSON.stringify({ ownershipPercentage: 30 }),
  timestamp: Timestamp,
  createdAt: Timestamp
}
```

## Updated Firestore Collections

### masterAccounts (updated)

**New Fields Added:**
```javascript
{
  // Existing fields...
  id: string,
  masterId: string,
  name: string,
  pin: string,
  companyIds: string[],
  createdAt: Timestamp,
  
  // NEW FIELDS (all optional for backward compatibility)
  nationalIdNumber: string,           // Unique national ID
  idVerificationStatus: "UNVERIFIED" | "PENDING_REVIEW" | "VERIFIED" | "REJECTED",
  idVerifiedAt: Timestamp,            // When verified
  idVerifiedBy: string,               // Admin who verified
  idDocumentUrl: string,              // Uploaded document URL
  duplicateIdStatus: "NONE" | "DUPLICATE_DETECTED" | "UNDER_REVIEW" | "RESOLVED",
  contactEmail: string,
  contactPhone: string,
  
  // Permission flags (default false for new accounts)
  canOwnCompanies: boolean,           // Requires VERIFIED
  canReceivePayouts: boolean,         // Requires VERIFIED
  canApproveOwnershipChanges: boolean,// Requires VERIFIED
  
  restrictionReason: string,          // If restricted
  restrictedUntil: Timestamp          // Temporary restriction
}
```

**Default Values for New Accounts:**
```javascript
{
  idVerificationStatus: "UNVERIFIED",
  duplicateIdStatus: "NONE",
  canOwnCompanies: false,
  canReceivePayouts: false,
  canApproveOwnershipChanges: false
}
```

### companies (updated)

**New Fields Added:**
```javascript
{
  // Existing fields...
  id: string,
  legalEntityName: string,
  alias: string,
  // ... other fields ...
  createdBy: string,  // Master Account ID
  
  // NEW FIELDS (optional)
  totalOwnershipPercentage: number,  // Should equal 100
  ownerCount: number                 // Number of owners
}
```

## Implementation Functions

### Master ID Verification

```typescript
import { 
  checkNationalIdExists,
  submitIdVerification,
  approveIdVerification,
  rejectIdVerification,
  reportFraudDispute
} from '@/utils/masterIdVerification';

// Check if ID is already in use
const { exists, masterAccountId, masterAccountName } = 
  await checkNationalIdExists("8901234567089");

// Submit ID for verification
const result = await submitIdVerification({
  masterAccountId: "master_xyz",
  nationalIdNumber: "8901234567089",
  documentType: "national_id",
  documentUrl: "https://...",
  storagePath: "path/to/doc",
  metadata: { fileName: "id.pdf", fileSize: 2048000, mimeType: "application/pdf" }
});

// Admin: Approve verification
await approveIdVerification("verification_id", "admin_id", "Verified successfully");

// Admin: Reject verification
await rejectIdVerification("verification_id", "admin_id", "Document unclear");

// Report fraud dispute
await reportFraudDispute({
  nationalIdNumber: "8901234567089",
  reportedBy: "master_xyz",
  reportedByName: "John Smith",
  explanation: "This is my ID",
  supportingDocuments: [...]
});
```

### Company Ownership

```typescript
import {
  addCompanyOwner,
  getCompanyOwners,
  getMasterAccountOwnerships,
  changeOwnershipPercentage,
  assignCompanyRole,
  getMasterAccountRoles
} from '@/utils/companyOwnership';

// Add an owner to a company
const result = await addCompanyOwner({
  companyId: "comp_abc",
  masterAccountId: "master_xyz",
  masterAccountName: "John Smith",
  ownershipPercentage: 30,
  votingRights: true,
  economicRights: true,
  grantedBy: "master_admin",
  notes: "Founding partner"
});

// Get all owners of a company
const owners = await getCompanyOwners("comp_abc");

// Get all companies owned by master account
const ownerships = await getMasterAccountOwnerships("master_xyz");

// Change ownership percentage
await changeOwnershipPercentage({
  ownershipId: "ownership_id",
  newPercentage: 35,
  changedBy: "master_admin",
  reason: "Investment round"
});

// Assign a role
await assignCompanyRole({
  companyId: "comp_abc",
  masterAccountId: "master_xyz",
  masterAccountName: "John Smith",
  role: "Director",
  permissions: ["manage_users", "approve_timesheets"],
  assignedBy: "master_admin"
});

// Get roles for master account
const roles = await getMasterAccountRoles("master_xyz", "comp_abc");
```

## Migration Strategy

### For Existing Master Accounts

Run this migration script to update existing master accounts:

```typescript
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/config/firebase';

async function migrateMasterAccounts() {
  const masterAccountsRef = collection(db, 'masterAccounts');
  const snapshot = await getDocs(masterAccountsRef);
  
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    
    // Only update if new fields don't exist
    if (!data.idVerificationStatus) {
      await updateDoc(doc(db, 'masterAccounts', docSnap.id), {
        idVerificationStatus: 'UNVERIFIED',
        duplicateIdStatus: 'NONE',
        canOwnCompanies: false,
        canReceivePayouts: false,
        canApproveOwnershipChanges: false
      });
      
      console.log(`Updated master account: ${docSnap.id}`);
    }
  }
  
  console.log('Migration complete');
}
```

### For Existing Companies

Run this to create initial ownership records:

```typescript
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';

async function migrateCompanyOwnership() {
  const companiesRef = collection(db, 'companies');
  const snapshot = await getDocs(companiesRef);
  
  for (const docSnap of snapshot.docs) {
    const company = docSnap.data();
    const createdBy = company.createdBy;
    
    if (!createdBy) {
      console.warn(`Company ${docSnap.id} has no createdBy field`);
      continue;
    }
    
    // Create 100% ownership for creator
    await addDoc(collection(db, 'companyOwnership'), {
      companyId: docSnap.id,
      masterAccountId: createdBy,
      masterAccountName: company.alias || 'Owner', // You may need to fetch actual name
      ownershipPercentage: 100,
      status: 'active',
      votingRights: true,
      economicRights: true,
      grantedAt: serverTimestamp(),
      grantedBy: createdBy,
      approvedAt: serverTimestamp(),
      approvedBy: createdBy,
      notes: 'Migrated from initial creation',
      createdAt: company.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    console.log(`Created ownership for company: ${docSnap.id}`);
  }
  
  console.log('Ownership migration complete');
}
```

## Testing Checklist

### Unit Tests
- [ ] Type validation for all new types
- [ ] Ownership percentage validation (0-100, total = 100)
- [ ] National ID uniqueness checking
- [ ] Duplicate detection logic

### Integration Tests
- [ ] Master account creation with new fields
- [ ] ID verification workflow end-to-end
- [ ] Duplicate ID detection and dispute creation
- [ ] Company ownership addition and validation
- [ ] Ownership percentage changes
- [ ] Role assignment and retrieval
- [ ] Audit log creation

### Manual Testing
- [ ] Create new master account (should be UNVERIFIED)
- [ ] Attempt to create company with UNVERIFIED account (should fail)
- [ ] Submit ID verification
- [ ] Admin approve ID verification
- [ ] Create company with VERIFIED account
- [ ] Add second owner to company
- [ ] Verify total ownership = 100%
- [ ] Assign roles to owners
- [ ] Check audit logs

## Security Considerations

1. **National ID Numbers**: Highly sensitive - ensure proper encryption at rest
2. **ID Documents**: Store in private Firebase Storage buckets with signed URLs
3. **Audit Logs**: Immutable - prevent tampering
4. **Ownership Changes**: Require multi-owner approval for high-value changes
5. **Admin Functions**: Restrict to verified admin accounts only

## Performance Considerations

1. **Denormalization**: Master account names and company names denormalized for query performance
2. **Indexes**: All common query patterns covered by composite indexes
3. **Transactions**: Used for ownership changes to prevent race conditions
4. **Caching**: Consider caching ownership structures for active users

## Troubleshooting

### Index Build Failures
- Check Firebase Console > Firestore > Indexes for error messages
- Ensure field names match exactly (case-sensitive)
- Verify collection names are correct

### Permission Errors
- Ensure master account has `canOwnCompanies: true` before ownership operations
- Check verification status is `VERIFIED` for restricted operations

### Ownership Percentage Issues
- Always validate total ownership before adding/changing
- Use transactions to prevent race conditions
- Check for floating-point precision issues (multiply by 100 for integer storage if needed)

## Support & Questions

For questions or issues:
1. Check this guide thoroughly
2. Review the type definitions in `types/index.ts`
3. Examine utility functions in `utils/masterIdVerification.ts` and `utils/companyOwnership.ts`
4. Check Firestore rules in `firestore.rules`
5. Review indexes in `firestore.indexes.json`

## Next Steps

1. **Deploy Indexes**: `firebase deploy --only firestore:indexes`
2. **Run Migrations**: Migrate existing master accounts and companies
3. **Implement UI**: Create screens for ID verification, ownership management
4. **Testing**: Comprehensive testing of all workflows
5. **Documentation**: Update user documentation with new features
6. **Training**: Train admins on verification and dispute resolution workflows
