# Manual Firestore Index Creation Guide

If you prefer to create indexes manually in the Firebase Console instead of deploying via CLI, here are the exact configurations for all 26 indexes.

## How to Create Indexes Manually

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Firestore Database** > **Indexes** tab
4. Click **"Create Index"** button
5. Enter the details below for each index

---

## 1. Master Accounts Collection (3 indexes)

### Index 1: National ID Number Lookup
- **Collection ID:** `masterAccounts`
- **Fields to index:**
  - Field: `nationalIdNumber` | Order: `Ascending`
- **Query scope:** Collection
- **Purpose:** Check uniqueness of national ID numbers

### Index 2: Verification Status Query  
- **Collection ID:** `masterAccounts`
- **Fields to index:**
  1. Field: `idVerificationStatus` | Order: `Ascending`
  2. Field: `createdAt` | Order: `Descending`
- **Query scope:** Collection
- **Purpose:** Query accounts by verification status

### Index 3: Duplicate ID Status Query
- **Collection ID:** `masterAccounts`
- **Fields to index:**
  1. Field: `duplicateIdStatus` | Order: `Ascending`
  2. Field: `createdAt` | Order: `Descending`
- **Query scope:** Collection
- **Purpose:** Find accounts with duplicate ID flags

---

## 2. Company Ownership Collection (4 indexes)

### Index 4: Company Owners Query
- **Collection ID:** `companyOwnership`
- **Fields to index:**
  1. Field: `companyId` | Order: `Ascending`
  2. Field: `status` | Order: `Ascending`
  3. Field: `grantedAt` | Order: `Descending`
- **Query scope:** Collection
- **Purpose:** Get all active owners of a company

### Index 5: Master Account Ownerships Query
- **Collection ID:** `companyOwnership`
- **Fields to index:**
  1. Field: `masterAccountId` | Order: `Ascending`
  2. Field: `status` | Order: `Ascending`
  3. Field: `grantedAt` | Order: `Descending`
- **Query scope:** Collection
- **Purpose:** Get all companies owned by a master account

### Index 6: Specific Ownership Check
- **Collection ID:** `companyOwnership`
- **Fields to index:**
  1. Field: `companyId` | Order: `Ascending`
  2. Field: `masterAccountId` | Order: `Ascending`
  3. Field: `status` | Order: `Ascending`
- **Query scope:** Collection
- **Purpose:** Check if specific master account owns part of specific company

### Index 7: Ownership Percentage Sorting
- **Collection ID:** `companyOwnership`
- **Fields to index:**
  1. Field: `companyId` | Order: `Ascending`
  2. Field: `ownershipPercentage` | Order: `Descending`
- **Query scope:** Collection
- **Purpose:** Sort company owners by ownership percentage

---

## 3. Company Roles Collection (3 indexes)

### Index 8: Company Roles Query
- **Collection ID:** `companyRoles`
- **Fields to index:**
  1. Field: `companyId` | Order: `Ascending`
  2. Field: `status` | Order: `Ascending`
  3. Field: `assignedAt` | Order: `Descending`
- **Query scope:** Collection
- **Purpose:** Get all active roles in a company

### Index 9: Master Account Roles Query
- **Collection ID:** `companyRoles`
- **Fields to index:**
  1. Field: `masterAccountId` | Order: `Ascending`
  2. Field: `status` | Order: `Ascending`
  3. Field: `assignedAt` | Order: `Descending`
- **Query scope:** Collection
- **Purpose:** Get all roles assigned to a master account

### Index 10: Specific Role Check
- **Collection ID:** `companyRoles`
- **Fields to index:**
  1. Field: `companyId` | Order: `Ascending`
  2. Field: `masterAccountId` | Order: `Ascending`
  3. Field: `role` | Order: `Ascending`
- **Query scope:** Collection
- **Purpose:** Check specific role assignment

---

## 4. Master ID Verification Collection (3 indexes)

### Index 11: Verification History Query
- **Collection ID:** `masterIDVerification`
- **Fields to index:**
  1. Field: `masterAccountId` | Order: `Ascending`
  2. Field: `status` | Order: `Ascending`
  3. Field: `submittedAt` | Order: `Descending`
- **Query scope:** Collection
- **Purpose:** Get verification history for a master account

### Index 12: National ID Verification Lookup
- **Collection ID:** `masterIDVerification`
- **Fields to index:**
  1. Field: `nationalIdNumber` | Order: `Ascending`
  2. Field: `status` | Order: `Ascending`
- **Query scope:** Collection
- **Purpose:** Find verification records by national ID number

### Index 13: Admin Verification Queue
- **Collection ID:** `masterIDVerification`
- **Fields to index:**
  1. Field: `status` | Order: `Ascending`
  2. Field: `submittedAt` | Order: `Ascending`
- **Query scope:** Collection
- **Purpose:** Admin dashboard showing pending verifications

---

## 5. Fraud Disputes Collection (4 indexes)

### Index 14: Disputes by National ID
- **Collection ID:** `fraudDisputes`
- **Fields to index:**
  1. Field: `nationalIdNumber` | Order: `Ascending`
  2. Field: `status` | Order: `Ascending`
- **Query scope:** Collection
- **Purpose:** Find all disputes related to a specific national ID

### Index 15: Admin Disputes Dashboard
- **Collection ID:** `fraudDisputes`
- **Fields to index:**
  1. Field: `status` | Order: `Ascending`
  2. Field: `priority` | Order: `Descending`
  3. Field: `reportedAt` | Order: `Descending`
- **Query scope:** Collection
- **Purpose:** Admin dashboard sorting by status and priority

### Index 16: User's Reported Disputes
- **Collection ID:** `fraudDisputes`
- **Fields to index:**
  1. Field: `reportedBy` | Order: `Ascending`
  2. Field: `status` | Order: `Ascending`
  3. Field: `reportedAt` | Order: `Descending`
- **Query scope:** Collection
- **Purpose:** Show disputes reported by a specific user

### Index 17: Disputes Affecting Account
- **Collection ID:** `fraudDisputes`
- **Fields to index:**
  1. Field: `existingAccountId` | Order: `Ascending`
  2. Field: `status` | Order: `Ascending`
- **Query scope:** Collection
- **Purpose:** Find disputes where existing account is involved

---

## 6. Ownership Change Requests Collection (3 indexes)

### Index 18: Company's Pending Requests
- **Collection ID:** `ownershipChangeRequests`
- **Fields to index:**
  1. Field: `companyId` | Order: `Ascending`
  2. Field: `status` | Order: `Ascending`
  3. Field: `createdAt` | Order: `Descending`
- **Query scope:** Collection
- **Purpose:** Get all ownership change requests for a company

### Index 19: User's Initiated Requests
- **Collection ID:** `ownershipChangeRequests`
- **Fields to index:**
  1. Field: `requestedBy` | Order: `Ascending`
  2. Field: `status` | Order: `Ascending`
  3. Field: `createdAt` | Order: `Descending`
- **Query scope:** Collection
- **Purpose:** Get requests initiated by a specific master account

### Index 20: Requests Affecting Account
- **Collection ID:** `ownershipChangeRequests`
- **Fields to index:**
  1. Field: `targetMasterAccountId` | Order: `Ascending`
  2. Field: `status` | Order: `Ascending`
  3. Field: `createdAt` | Order: `Descending`
- **Query scope:** Collection
- **Purpose:** Get requests that affect a specific master account

---

## 7. Master Account Audit Logs Collection (6 indexes)

### Index 21: Account Audit Trail
- **Collection ID:** `masterAccountAuditLogs`
- **Fields to index:**
  1. Field: `masterAccountId` | Order: `Ascending`
  2. Field: `timestamp` | Order: `Descending`
- **Query scope:** Collection
- **Purpose:** Get complete audit trail for a master account

### Index 22: Company Audit Trail
- **Collection ID:** `masterAccountAuditLogs`
- **Fields to index:**
  1. Field: `companyId` | Order: `Ascending`
  2. Field: `timestamp` | Order: `Descending`
- **Query scope:** Collection
- **Purpose:** Get audit trail for all actions affecting a company

### Index 23: Filter by Action Type
- **Collection ID:** `masterAccountAuditLogs`
- **Fields to index:**
  1. Field: `actionType` | Order: `Ascending`
  2. Field: `timestamp` | Order: `Descending`
- **Query scope:** Collection
- **Purpose:** Filter logs by specific action type

### Index 24: Account's Specific Actions
- **Collection ID:** `masterAccountAuditLogs`
- **Fields to index:**
  1. Field: `masterAccountId` | Order: `Ascending`
  2. Field: `actionType` | Order: `Ascending`
  3. Field: `timestamp` | Order: `Descending`
- **Query scope:** Collection
- **Purpose:** Get specific types of actions for an account

### Index 25: Company's Specific Actions
- **Collection ID:** `masterAccountAuditLogs`
- **Fields to index:**
  1. Field: `companyId` | Order: `Ascending`
  2. Field: `actionType` | Order: `Ascending`
  3. Field: `timestamp` | Order: `Descending`
- **Query scope:** Collection
- **Purpose:** Get specific types of actions for a company

### Index 26: Actions by Performer
- **Collection ID:** `masterAccountAuditLogs`
- **Fields to index:**
  1. Field: `performedBy` | Order: `Ascending`
  2. Field: `timestamp` | Order: `Descending`
- **Query scope:** Collection
- **Purpose:** Get all actions performed by a specific user

---

## Verification Checklist

After creating all indexes, verify they all show "Enabled" status:

- [ ] 3 masterAccounts indexes
- [ ] 4 companyOwnership indexes
- [ ] 3 companyRoles indexes
- [ ] 3 masterIDVerification indexes
- [ ] 4 fraudDisputes indexes
- [ ] 3 ownershipChangeRequests indexes
- [ ] 6 masterAccountAuditLogs indexes

**Total: 26 indexes**

## Alternative: Automatic Deployment

Instead of creating manually, you can deploy all 26 indexes automatically:

```bash
firebase deploy --only firestore:indexes
```

All indexes are already defined in `firestore.indexes.json` and will be created automatically with this command.

## Troubleshooting

### Index Creation Failed
- Double-check field names (case-sensitive)
- Verify collection names are exactly as shown
- Ensure field exists in at least one document

### Index Takes Too Long
- Large collections can take 30+ minutes
- Monitor progress in Firebase Console
- Index will be available once status shows "Enabled"

### Query Still Requires Index
- Wait for index to finish building
- Check index status in Firebase Console
- Verify field names match exactly in your query
