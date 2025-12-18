# Firebase Security Rules - Project Tracker

## Project Information

**Project Name:** Project Tracker -Live  
**Project ID:** project-tracker-app-33cff  
**Project Number:** 235534188025  
**App ID:** 1:235534188025:web:b7c49ea0c361988cf41128  
**Console:** https://console.firebase.google.com/u/0/project/project-tracker-app-33cff/firestore

---

## Overview

This document provides comprehensive Firestore security rules for the Project Tracker application, implementing role-based access control (RBAC) for 10 user roles.

## User Roles

1. Master User (System Owner)
2. Admin
3. Planner
4. Supervisor
5. QC (Quality Control)
6. Operator
7. Plant Manager
8. Surveyor
9. Staff Manager
10. Logistics Manager

---

## Firestore Security Rules

### Complete Rules Template

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function getUserRole() {
      return request.auth.token.role;
    }
    
    function isMaster() {
      return isAuthenticated() && getUserRole() == 'Master';
    }
    
    function isAdmin() {
      return isAuthenticated() && getUserRole() == 'Admin';
    }
    
    function isPlanner() {
      return isAuthenticated() && getUserRole() == 'Planner';
    }
    
    function isSupervisor() {
      return isAuthenticated() && getUserRole() == 'Supervisor';
    }
    
    function isQC() {
      return isAuthenticated() && getUserRole() == 'QC';
    }
    
    function isManagementRole() {
      return isAuthenticated() && getUserRole() in ['Master', 'Admin', 'Planner', 'Supervisor', 'Plant Manager', 'Staff Manager', 'Logistics Manager'];
    }
    
    function isOperator() {
      return isAuthenticated() && getUserRole() == 'Operator';
    }
    
    function belongsToSameSite(siteId) {
      return isAuthenticated() && request.auth.token.siteId == siteId;
    }
    
    function belongsToSameCompany(companyId) {
      return isAuthenticated() && request.auth.token.companyId == companyId;
    }
    
    function isAssignedToTask(taskId) {
      return isAuthenticated() && 
             get(/databases/$(database)/documents/tasks/$(taskId)).data.assignedUsers.hasAny([request.auth.uid]);
    }
    
    // Companies Collection
    match /companies/{companyId} {
      allow read: if isAuthenticated() && belongsToSameCompany(companyId);
      allow write: if isMaster();
    }
    
    // Master Accounts Collection
    match /masterAccounts/{accountId} {
      allow read: if isAuthenticated() && 
                     (request.auth.uid == accountId || isMaster() || isAdmin());
      allow create: if isAuthenticated();
      allow update: if isMaster() || request.auth.uid == accountId;
      allow delete: if isMaster();
    }
    
    // Users Collection
    match /users/{userId} {
      allow read: if isAuthenticated() && 
                     (request.auth.uid == userId || isManagementRole());
      allow create: if isMaster() || isAdmin();
      allow update: if isMaster() || isAdmin() || request.auth.uid == userId;
      allow delete: if isMaster();
    }
    
    // Sites Collection
    match /sites/{siteId} {
      allow read: if isAuthenticated() && belongsToSameSite(siteId);
      allow create: if isMaster();
      allow update: if isMaster() || isAdmin();
      allow delete: if isMaster();
    }
    
    // Tasks Collection
    match /tasks/{taskId} {
      allow read: if isAuthenticated() && 
                     (isManagementRole() || 
                      isAssignedToTask(taskId) ||
                      belongsToSameSite(resource.data.siteId));
      allow create: if isMaster() || isAdmin() || isPlanner();
      allow update: if isMaster() || isAdmin() || isPlanner() || isSupervisor();
      allow delete: if isMaster() || isAdmin();
    }
    
    // Activities Collection
    match /activities/{activityId} {
      allow read: if isAuthenticated() && belongsToSameSite(resource.data.siteId);
      allow create: if isMaster() || isAdmin() || isPlanner();
      allow update: if isManagementRole() || isQC();
      allow delete: if isMaster() || isAdmin();
    }
    
    // Requests Collection (Task, Scope, QC, etc.)
    match /requests/{requestId} {
      allow read: if isAuthenticated() && belongsToSameSite(resource.data.siteId);
      allow create: if isAuthenticated(); // Any authenticated user can create requests
      allow update: if isMaster() || isAdmin() || isPlanner() || 
                       request.auth.uid == resource.data.createdBy;
      allow delete: if isMaster() || isAdmin() || request.auth.uid == resource.data.createdBy;
    }
    
    // Handover Requests Collection
    match /handoverRequests/{requestId} {
      allow read: if isAuthenticated() && belongsToSameSite(resource.data.siteId);
      allow create: if isSupervisor() || isPlanner();
      allow update: if isPlanner() || request.auth.uid == resource.data.createdBy;
      allow delete: if isMaster() || isAdmin();
    }
    
    // Employees Collection
    match /employees/{employeeId} {
      allow read: if isAuthenticated() && belongsToSameSite(resource.data.siteId);
      allow write: if isMaster() || isAdmin() || getUserRole() == 'Staff Manager';
    }
    
    // Plant Assets Collection
    match /plantAssets/{assetId} {
      allow read: if isAuthenticated() && belongsToSameSite(resource.data.siteId);
      allow write: if isMaster() || isAdmin() || getUserRole() == 'Plant Manager';
    }
    
    // Assets Collection
    match /assets/{assetId} {
      allow read: if isAuthenticated() && belongsToSameSite(resource.data.siteId);
      allow write: if isMaster() || isAdmin() || getUserRole() == 'Plant Manager';
    }
    
    // Onboarding Messages Collection
    match /onboardingMessages/{messageId} {
      allow read: if isAuthenticated() && 
                     (request.auth.uid == resource.data.toUserId || isManagementRole());
      allow create: if isManagementRole();
      allow update: if request.auth.uid == resource.data.toUserId || isManagementRole();
      allow delete: if isMaster() || isAdmin();
    }
    
    // Plant Asset Hours Collection
    match /plantAssetHours/{hourId} {
      allow read: if isAuthenticated() && belongsToSameSite(resource.data.siteId);
      allow create: if isAuthenticated();
      allow update: if getUserRole() in ['Master', 'Admin', 'Plant Manager', 'Operator'] || 
                       request.auth.uid == resource.data.operatorId;
      allow delete: if isMaster() || isAdmin();
    }
    
    // Operator Hours Collection
    match /operatorHours/{hourId} {
      allow read: if isAuthenticated() && 
                     (request.auth.uid == resource.data.operatorId || isManagementRole());
      allow create: if isOperator() || isManagementRole();
      allow update: if request.auth.uid == resource.data.operatorId || isManagementRole();
      allow delete: if isMaster() || isAdmin();
    }
    
    // Company Users Collection (for multi-tenant)
    match /companyUsers/{docId} {
      allow read: if isAuthenticated() && belongsToSameCompany(resource.data.companyId);
      allow write: if isMaster();
    }
    
    // QR Codes Collection
    match /qrCodes/{codeId} {
      allow read: if isAuthenticated();
      allow create: if isMaster() || isAdmin();
      allow update: if isMaster();
      allow delete: if isMaster();
    }
    
    // Surveyor Images Collection
    match /surveyorImages/{imageId} {
      allow read: if isAuthenticated() && belongsToSameSite(resource.data.siteId);
      allow create: if getUserRole() == 'Surveyor' || isManagementRole();
      allow update: if request.auth.uid == resource.data.uploadedBy || isManagementRole();
      allow delete: if isMaster() || isAdmin() || request.auth.uid == resource.data.uploadedBy;
    }
    
    // Activity History Collection (for tracking completed today)
    match /activityHistory/{historyId} {
      allow read: if isAuthenticated() && belongsToSameSite(resource.data.siteId);
      allow create: if isAuthenticated();
      allow update: if false; // History records should not be updated
      allow delete: if isMaster() || isAdmin();
    }
    
    // Materials Requests Collection
    match /materialsRequests/{requestId} {
      allow read: if isAuthenticated() && belongsToSameSite(resource.data.siteId);
      allow create: if isAuthenticated();
      allow update: if getUserRole() == 'Logistics Manager' || isManagementRole();
      allow delete: if isMaster() || isAdmin();
    }
    
    // Staff Requests Collection
    match /staffRequests/{requestId} {
      allow read: if isAuthenticated() && belongsToSameSite(resource.data.siteId);
      allow create: if isAuthenticated();
      allow update: if getUserRole() == 'Staff Manager' || isManagementRole();
      allow delete: if isMaster() || isAdmin();
    }
    
    // Plant Requests Collection
    match /plantRequests/{requestId} {
      allow read: if isAuthenticated() && belongsToSameSite(resource.data.siteId);
      allow create: if isAuthenticated();
      allow update: if getUserRole() == 'Plant Manager' || isManagementRole();
      allow delete: if isMaster() || isAdmin();
    }
    
    // Subcontractors Collection
    match /subcontractors/{subcontractorId} {
      allow read: if isAuthenticated() && belongsToSameSite(resource.data.siteId);
      allow write: if isMaster() || isAdmin() || getUserRole() == 'Staff Manager';
    }
    
    // Default deny rule for any unmatched paths
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## How to Deploy Security Rules

### Method 1: Firebase Console (Recommended for testing)

1. Go to [Firebase Console - Firestore Rules](https://console.firebase.google.com/u/0/project/project-tracker-app-33cff/firestore/rules)
2. Copy the rules from above
3. Paste into the rules editor
4. Click "Publish"
5. Wait for deployment to complete

### Method 2: Firebase CLI (Recommended for production)

1. Ensure you have Firebase CLI installed:
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Initialize Firebase in your project (if not already done):
   ```bash
   firebase init firestore
   ```

4. Copy the rules to `firestore.rules` file in your project root

5. Deploy the rules:
   ```bash
   firebase deploy --only firestore:rules
   ```

---

## Testing Security Rules

### Using Firebase Rules Simulator

1. Go to [Firestore Rules](https://console.firebase.google.com/u/0/project/project-tracker-app-33cff/firestore/rules)
2. Click on "Rules Playground" tab
3. Test various scenarios:

**Example Test 1: Master User Creating Company**
```
Location: /companies/company123
Authenticated: Yes
Auth UID: master-user-id
Custom Claims: { "role": "Master", "siteId": "site1", "companyId": "company123" }
Operation: Create
Result: Should ALLOW
```

**Example Test 2: Operator Reading Other User's Tasks**
```
Location: /tasks/task123
Authenticated: Yes
Auth UID: operator-user-id
Custom Claims: { "role": "Operator", "siteId": "site1" }
Operation: Read
Result: Should DENY (unless assigned to task)
```

**Example Test 3: Planner Approving Request**
```
Location: /requests/request123
Authenticated: Yes
Auth UID: planner-user-id
Custom Claims: { "role": "Planner", "siteId": "site1" }
Operation: Update
Result: Should ALLOW
```

---

## Custom Claims Setup

Security rules rely on custom claims set in Firebase Auth. Here's how to set them:

### Backend Function to Set Custom Claims

```typescript
import * as admin from 'firebase-admin';

export async function setUserCustomClaims(
  uid: string,
  role: string,
  siteId: string,
  companyId: string
) {
  try {
    await admin.auth().setCustomUserClaims(uid, {
      role,
      siteId,
      companyId,
    });
    console.log(`Custom claims set for user ${uid}`);
  } catch (error) {
    console.error('Error setting custom claims:', error);
    throw error;
  }
}
```

### When to Set Custom Claims

1. **User Registration:** When Master creates a new user
2. **Role Change:** When user role is updated
3. **Site Assignment:** When user is assigned to a site
4. **Company Assignment:** When user joins a company

---

## Security Audit Checklist

Before going to production:

- [ ] All collections have security rules defined
- [ ] No wildcard rules allowing unrestricted access
- [ ] Custom claims are properly set for all users
- [ ] Rules tested with Firebase Rules Simulator
- [ ] Role-based access working correctly
- [ ] Site-based isolation working (multi-tenant)
- [ ] Company-based isolation working (if applicable)
- [ ] Sensitive operations restricted to authorized roles
- [ ] History/audit records cannot be modified
- [ ] QR codes are properly secured
- [ ] File uploads have size/type restrictions
- [ ] Rate limiting considered for write operations

---

## Common Scenarios

### Scenario 1: Supervisor Submitting Daily Progress

**Collection:** `activities/{activityId}`  
**Operation:** Update  
**Required:** 
- Authenticated
- Role: Supervisor (or higher)
- Same site as activity

**Rule:** Covered by activities update rule

### Scenario 2: QC Inspector Entering QC Value

**Collection:** `activities/{activityId}`  
**Operation:** Update  
**Required:**
- Authenticated
- Role: QC
- Same site as activity

**Rule:** Covered by activities update rule

### Scenario 3: Operator Viewing Own Tasks

**Collection:** `tasks/{taskId}`  
**Operation:** Read  
**Required:**
- Authenticated
- Assigned to task OR same site

**Rule:** Covered by tasks read rule with isAssignedToTask check

---

## Monitoring & Logging

### Enable Firestore Audit Logs

1. Go to [IAM & Admin - Audit Logs](https://console.cloud.google.com/iam-admin/audit)
2. Find "Cloud Firestore API"
3. Enable:
   - Admin Read
   - Data Read
   - Data Write

### Monitor Security Rule Violations

1. Go to [Firestore Usage](https://console.firebase.google.com/u/0/project/project-tracker-app-33cff/firestore/usage)
2. Check "Security Rules Evaluations"
3. Look for denied requests
4. Investigate patterns

---

## Troubleshooting

### Issue: "Permission Denied" Errors

**Possible Causes:**
1. Custom claims not set on user
2. User not authenticated
3. User role doesn't have permission
4. Site ID mismatch
5. Company ID mismatch

**Debug Steps:**
1. Check user's custom claims in Firebase Auth
2. Verify user is authenticated
3. Check security rule for the operation
4. Use Rules Simulator to test

### Issue: Rules Not Updating

**Solutions:**
1. Wait a few minutes for propagation
2. Clear browser cache
3. Force refresh the app
4. Check deployment status in console

---

## Performance Considerations

### Rule Evaluation Limits

- Maximum 10 `get()` calls per rule evaluation
- Maximum 20 `exists()` calls per rule evaluation
- Keep rules simple and efficient
- Use indexed fields for lookups

### Optimization Tips

1. Cache role checks in variables
2. Use early returns in helper functions
3. Avoid nested get() calls
4. Structure data to minimize lookups

---

## Backup & Recovery

### Backup Current Rules

Before deploying new rules:

```bash
# Download current rules
firebase firestore:rules:get > firestore.rules.backup

# Add timestamp
cp firestore.rules.backup "firestore.rules.backup.$(date +%Y%m%d-%H%M%S)"
```

### Rollback Rules

If issues occur:

```bash
# Restore from backup
cp firestore.rules.backup firestore.rules

# Deploy
firebase deploy --only firestore:rules
```

---

## Related Documentation

- [Firebase Security Rules Documentation](https://firebase.google.com/docs/firestore/security/get-started)
- [USER-GUIDE.md](./USER-GUIDE.md) - User roles and permissions
- [TECHNICAL-GUIDE.md](./TECHNICAL-GUIDE.md) - System architecture

---

**Last Updated:** December 18, 2025  
**Status:** Ready for deployment  
**Review Schedule:** Monthly
