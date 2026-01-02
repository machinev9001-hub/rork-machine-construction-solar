# New Firestore Indexes - Quick Reference

## Deploy Command
```bash
firebase deploy --only firestore:indexes
```

## Total New Indexes: 26

### Master Accounts (3)
1. `nationalIdNumber` (ASC)
2. `idVerificationStatus` (ASC) + `createdAt` (DESC)
3. `duplicateIdStatus` (ASC) + `createdAt` (DESC)

### Company Ownership (4)
4. `companyId` (ASC) + `status` (ASC) + `grantedAt` (DESC)
5. `masterAccountId` (ASC) + `status` (ASC) + `grantedAt` (DESC)
6. `companyId` (ASC) + `masterAccountId` (ASC) + `status` (ASC)
7. `companyId` (ASC) + `ownershipPercentage` (DESC)

### Company Roles (3)
8. `companyId` (ASC) + `status` (ASC) + `assignedAt` (DESC)
9. `masterAccountId` (ASC) + `status` (ASC) + `assignedAt` (DESC)
10. `companyId` (ASC) + `masterAccountId` (ASC) + `role` (ASC)

### Master ID Verification (3)
11. `masterAccountId` (ASC) + `status` (ASC) + `submittedAt` (DESC)
12. `nationalIdNumber` (ASC) + `status` (ASC)
13. `status` (ASC) + `submittedAt` (ASC)

### Fraud Disputes (4)
14. `nationalIdNumber` (ASC) + `status` (ASC)
15. `status` (ASC) + `priority` (DESC) + `reportedAt` (DESC)
16. `reportedBy` (ASC) + `status` (ASC) + `reportedAt` (DESC)
17. `existingAccountId` (ASC) + `status` (ASC)

### Ownership Change Requests (3)
18. `companyId` (ASC) + `status` (ASC) + `createdAt` (DESC)
19. `requestedBy` (ASC) + `status` (ASC) + `createdAt` (DESC)
20. `targetMasterAccountId` (ASC) + `status` (ASC) + `createdAt` (DESC)

### Master Account Audit Logs (6)
21. `masterAccountId` (ASC) + `timestamp` (DESC)
22. `companyId` (ASC) + `timestamp` (DESC)
23. `actionType` (ASC) + `timestamp` (DESC)
24. `masterAccountId` (ASC) + `actionType` (ASC) + `timestamp` (DESC)
25. `companyId` (ASC) + `actionType` (ASC) + `timestamp` (DESC)
26. `performedBy` (ASC) + `timestamp` (DESC)

## Verification Checklist

After deploying indexes, verify in Firebase Console that all show status "Enabled":

- [ ] 3 masterAccounts indexes
- [ ] 4 companyOwnership indexes
- [ ] 3 companyRoles indexes
- [ ] 3 masterIDVerification indexes
- [ ] 4 fraudDisputes indexes
- [ ] 3 ownershipChangeRequests indexes
- [ ] 6 masterAccountAuditLogs indexes

## Index Build Time Estimates

- **Small DB** (< 1K docs): 1-5 minutes
- **Medium DB** (1K-100K docs): 5-30 minutes
- **Large DB** (> 100K docs): 30+ minutes

## Troubleshooting

If queries fail with "requires an index" errors:
1. Check Firebase Console > Firestore > Indexes
2. Verify status is "Enabled" (not "Building" or "Error")
3. If error, delete and redeploy: `firebase deploy --only firestore:indexes`

See `docs/FIRESTORE_INDEXES_SETUP.md` for detailed information.
