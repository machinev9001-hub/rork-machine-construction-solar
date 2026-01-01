# Firestore Indexes - Manual Setup Guide

## CRITICAL: Deploy All Indexes

After merging this PR, you **MUST** deploy the new Firestore indexes:

```bash
firebase deploy --only firestore:indexes
```

## Index Summary

**Total New Indexes: 26**

All indexes are defined in `firestore.indexes.json` and will be automatically created when you run the deploy command above.

## Detailed Index List

### 1. Master Accounts Collection (3 indexes)

#### Index 1: National ID Number Lookup
```json
{
  "collectionGroup": "masterAccounts",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "nationalIdNumber", "order": "ASCENDING" }
  ]
}
```
**Purpose:** Check uniqueness of national ID numbers during verification

#### Index 2: Verification Status Query
```json
{
  "collectionGroup": "masterAccounts",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "idVerificationStatus", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```
**Purpose:** Query accounts by verification status (e.g., find all PENDING_REVIEW accounts)

#### Index 3: Duplicate ID Status Query
```json
{
  "collectionGroup": "masterAccounts",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "duplicateIdStatus", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```
**Purpose:** Find accounts with duplicate ID flags

---

### 2. Company Ownership Collection (4 indexes)

#### Index 4: Company Owners Query
```json
{
  "collectionGroup": "companyOwnership",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "companyId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "grantedAt", "order": "DESCENDING" }
  ]
}
```
**Purpose:** Get all active owners of a company, sorted by when granted

#### Index 5: Master Account Ownerships Query
```json
{
  "collectionGroup": "companyOwnership",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "masterAccountId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "grantedAt", "order": "DESCENDING" }
  ]
}
```
**Purpose:** Get all companies owned by a master account

#### Index 6: Specific Ownership Check
```json
{
  "collectionGroup": "companyOwnership",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "companyId", "order": "ASCENDING" },
    { "fieldPath": "masterAccountId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" }
  ]
}
```
**Purpose:** Check if specific master account owns part of specific company

#### Index 7: Ownership Percentage Sorting
```json
{
  "collectionGroup": "companyOwnership",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "companyId", "order": "ASCENDING" },
    { "fieldPath": "ownershipPercentage", "order": "DESCENDING" }
  ]
}
```
**Purpose:** Sort company owners by ownership percentage (major to minor shareholders)

---

### 3. Company Roles Collection (3 indexes)

#### Index 8: Company Roles Query
```json
{
  "collectionGroup": "companyRoles",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "companyId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "assignedAt", "order": "DESCENDING" }
  ]
}
```
**Purpose:** Get all active roles in a company

#### Index 9: Master Account Roles Query
```json
{
  "collectionGroup": "companyRoles",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "masterAccountId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "assignedAt", "order": "DESCENDING" }
  ]
}
```
**Purpose:** Get all roles assigned to a master account

#### Index 10: Specific Role Check
```json
{
  "collectionGroup": "companyRoles",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "companyId", "order": "ASCENDING" },
    { "fieldPath": "masterAccountId", "order": "ASCENDING" },
    { "fieldPath": "role", "order": "ASCENDING" }
  ]
}
```
**Purpose:** Check specific role assignment

---

### 4. Master ID Verification Collection (3 indexes)

#### Index 11: Verification History Query
```json
{
  "collectionGroup": "masterIDVerification",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "masterAccountId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "submittedAt", "order": "DESCENDING" }
  ]
}
```
**Purpose:** Get verification history for a master account

#### Index 12: National ID Verification Lookup
```json
{
  "collectionGroup": "masterIDVerification",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "nationalIdNumber", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" }
  ]
}
```
**Purpose:** Find verification records by national ID number

#### Index 13: Admin Verification Queue
```json
{
  "collectionGroup": "masterIDVerification",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "submittedAt", "order": "ASCENDING" }
  ]
}
```
**Purpose:** Admin dashboard showing pending verifications in submission order

---

### 5. Fraud Disputes Collection (4 indexes)

#### Index 14: Disputes by National ID
```json
{
  "collectionGroup": "fraudDisputes",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "nationalIdNumber", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" }
  ]
}
```
**Purpose:** Find all disputes related to a specific national ID

#### Index 15: Admin Disputes Dashboard
```json
{
  "collectionGroup": "fraudDisputes",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "priority", "order": "DESCENDING" },
    { "fieldPath": "reportedAt", "order": "DESCENDING" }
  ]
}
```
**Purpose:** Admin dashboard sorting by status and priority

#### Index 16: User's Reported Disputes
```json
{
  "collectionGroup": "fraudDisputes",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "reportedBy", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "reportedAt", "order": "DESCENDING" }
  ]
}
```
**Purpose:** Show disputes reported by a specific user

#### Index 17: Disputes Affecting Account
```json
{
  "collectionGroup": "fraudDisputes",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "existingAccountId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" }
  ]
}
```
**Purpose:** Find disputes where existing account is involved

---

### 6. Ownership Change Requests Collection (3 indexes)

#### Index 18: Company's Pending Requests
```json
{
  "collectionGroup": "ownershipChangeRequests",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "companyId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```
**Purpose:** Get all ownership change requests for a company

#### Index 19: User's Initiated Requests
```json
{
  "collectionGroup": "ownershipChangeRequests",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "requestedBy", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```
**Purpose:** Get requests initiated by a specific master account

#### Index 20: Requests Affecting Account
```json
{
  "collectionGroup": "ownershipChangeRequests",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "targetMasterAccountId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```
**Purpose:** Get requests that affect a specific master account (being added/removed)

---

### 7. Master Account Audit Logs Collection (6 indexes)

#### Index 21: Account Audit Trail
```json
{
  "collectionGroup": "masterAccountAuditLogs",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "masterAccountId", "order": "ASCENDING" },
    { "fieldPath": "timestamp", "order": "DESCENDING" }
  ]
}
```
**Purpose:** Get complete audit trail for a master account

#### Index 22: Company Audit Trail
```json
{
  "collectionGroup": "masterAccountAuditLogs",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "companyId", "order": "ASCENDING" },
    { "fieldPath": "timestamp", "order": "DESCENDING" }
  ]
}
```
**Purpose:** Get audit trail for all actions affecting a company

#### Index 23: Filter by Action Type
```json
{
  "collectionGroup": "masterAccountAuditLogs",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "actionType", "order": "ASCENDING" },
    { "fieldPath": "timestamp", "order": "DESCENDING" }
  ]
}
```
**Purpose:** Filter logs by specific action type (e.g., all ownership changes)

#### Index 24: Account's Specific Actions
```json
{
  "collectionGroup": "masterAccountAuditLogs",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "masterAccountId", "order": "ASCENDING" },
    { "fieldPath": "actionType", "order": "ASCENDING" },
    { "fieldPath": "timestamp", "order": "DESCENDING" }
  ]
}
```
**Purpose:** Get specific types of actions for an account (e.g., all ownership changes for John)

#### Index 25: Company's Specific Actions
```json
{
  "collectionGroup": "masterAccountAuditLogs",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "companyId", "order": "ASCENDING" },
    { "fieldPath": "actionType", "order": "ASCENDING" },
    { "fieldPath": "timestamp", "order": "DESCENDING" }
  ]
}
```
**Purpose:** Get specific types of actions for a company

#### Index 26: Actions by Performer
```json
{
  "collectionGroup": "masterAccountAuditLogs",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "performedBy", "order": "ASCENDING" },
    { "fieldPath": "timestamp", "order": "DESCENDING" }
  ]
}
```
**Purpose:** Get all actions performed by a specific user (admin audit trail)

---

## Deployment Instructions

### Step 1: Deploy Indexes

```bash
# Navigate to your project directory
cd /path/to/rork-machine-construction-solar

# Deploy only the indexes (faster than full deployment)
firebase deploy --only firestore:indexes
```

### Step 2: Monitor Index Creation

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to Firestore Database > Indexes
4. Watch for indexes to change from "Building" to "Enabled"

**Note:** Index creation time varies:
- Small databases (< 1000 docs): 1-5 minutes
- Medium databases (1K-100K docs): 5-30 minutes
- Large databases (> 100K docs): 30+ minutes

### Step 3: Verify Indexes

After deployment completes, verify in Firebase Console that all 26 indexes show status "Enabled".

## What Happens if Indexes Are Not Deployed?

If you forget to deploy indexes, queries that depend on them will fail with errors like:

```
FAILED_PRECONDITION: The query requires an index. You can create it here: https://console.firebase.google.com/...
```

Firebase will provide a direct link to create the specific index, but it's much better to deploy all indexes at once using the command above.

## Index Maintenance

### When to Rebuild Indexes

You may need to rebuild indexes if:
- Index gets corrupted
- Data migration causes index issues
- Firebase Console shows index errors

### How to Rebuild

1. Delete the problematic index in Firebase Console
2. Re-run `firebase deploy --only firestore:indexes`

## Performance Impact

These indexes will:
- **Increase write time slightly** (index must be updated on each write)
- **Dramatically speed up queries** (from O(n) to O(log n) complexity)
- **Use additional storage** (minimal - typically < 10% of collection size per index)

The performance benefits far outweigh the costs for query-heavy applications.

## Troubleshooting

### Error: "Invalid index configuration"
- Check `firestore.indexes.json` for syntax errors
- Ensure field names match exactly (case-sensitive)
- Verify collection names are correct

### Error: "Index already exists"
- This is safe to ignore - Firebase won't create duplicates
- Existing indexes will be preserved

### Error: "Permission denied"
- Ensure you're authenticated: `firebase login`
- Verify you have Editor or Owner role in Firebase project

### Slow Index Creation
- Large collections take time - be patient
- Monitor progress in Firebase Console
- Can continue development - queries will work once index is ready

## Next Steps After Deployment

1. ✅ Verify all 26 indexes show "Enabled" in Firebase Console
2. ✅ Run migration scripts to update existing data (see MASTER_ACCOUNT_OWNERSHIP_GUIDE.md)
3. ✅ Test all new query patterns work correctly
4. ✅ Monitor Firebase Console for any index warnings
5. ✅ Update user documentation with new features

## Support

For issues with index deployment:
1. Check Firebase Console > Indexes for specific error messages
2. Review `firestore.indexes.json` for configuration errors
3. Consult Firebase documentation: https://firebase.google.com/docs/firestore/query-data/indexing
4. Contact Firebase Support if indexes fail to build after 24 hours
