# Firestore Indexes for Face Clock-In System

This document lists all required Firestore indexes for the face clock-in feature.

## Required Composite Indexes

### 1. faceTemplates Collection

#### Query: Get active template by userId and masterAccountId
```javascript
// Used in: utils/secureFaceStore.ts - getLocalTemplate()
db.collection('faceTemplates')
  .where('userId', '==', userId)
  .where('masterAccountId', '==', masterAccountId)
  .where('isActive', '==', true)
```

**Index Configuration:**
- Collection: `faceTemplates`
- Fields:
  - `userId` (Ascending)
  - `masterAccountId` (Ascending)
  - `isActive` (Ascending)
  - `__name__` (Ascending) - optional for ordering

---

### 2. faceClockAttempts Collection

#### Query: Get attempts by site and date range
```javascript
// Used for reporting/analytics
db.collection('faceClockAttempts')
  .where('siteId', '==', siteId)
  .where('createdAt', '>=', startDate)
  .where('createdAt', '<=', endDate)
  .orderBy('createdAt', 'desc')
```

**Index Configuration:**
- Collection: `faceClockAttempts`
- Fields:
  - `siteId` (Ascending)
  - `createdAt` (Descending)

---

#### Query: Get attempts by user and status
```javascript
// Used for user history
db.collection('faceClockAttempts')
  .where('userId', '==', userId)
  .where('verificationState', '==', 'verified')
  .orderBy('createdAt', 'desc')
```

**Index Configuration:**
- Collection: `faceClockAttempts`
- Fields:
  - `userId` (Ascending)
  - `verificationState` (Ascending)
  - `createdAt` (Descending)

---

#### Query: Get unsynced attempts (offline queue)
```javascript
// Used for offline sync
db.collection('faceClockAttempts')
  .where('offlineMode', '==', true)
  .where('syncedToServer', '==', false)
  .where('createdAt', '>=', cutoffDate)
```

**Index Configuration:**
- Collection: `faceClockAttempts`
- Fields:
  - `offlineMode` (Ascending)
  - `syncedToServer` (Ascending)
  - `createdAt` (Ascending)

---

#### Query: Get failed attempts by site for monitoring
```javascript
// Used for security monitoring
db.collection('faceClockAttempts')
  .where('siteId', '==', siteId)
  .where('verificationState', '==', 'rejected')
  .orderBy('createdAt', 'desc')
  .limit(100)
```

**Index Configuration:**
- Collection: `faceClockAttempts`
- Fields:
  - `siteId` (Ascending)
  - `verificationState` (Ascending)
  - `createdAt` (Descending)

---

#### Query: Get attempts by company and date
```javascript
// Used for company-wide reporting
db.collection('faceClockAttempts')
  .where('masterAccountId', '==', masterAccountId)
  .where('createdAt', '>=', startDate)
  .orderBy('createdAt', 'desc')
```

**Index Configuration:**
- Collection: `faceClockAttempts`
- Fields:
  - `masterAccountId` (Ascending)
  - `createdAt` (Descending)

---

## Firebase Console Commands

You can create these indexes directly in the Firebase Console or using the Firebase CLI.

### Using Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Firestore Database**
4. Click **Indexes** tab
5. Click **Create Index**
6. Add each index as specified above

### Using Firebase CLI

Create a `firestore.indexes.json` file:

```json
{
  "indexes": [
    {
      "collectionGroup": "faceTemplates",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "masterAccountId", "order": "ASCENDING" },
        { "fieldPath": "isActive", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "faceClockAttempts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "siteId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "faceClockAttempts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "verificationState", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "faceClockAttempts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "offlineMode", "order": "ASCENDING" },
        { "fieldPath": "syncedToServer", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "faceClockAttempts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "siteId", "order": "ASCENDING" },
        { "fieldPath": "verificationState", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "faceClockAttempts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "masterAccountId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

Then deploy:

```bash
firebase deploy --only firestore:indexes
```

---

## Security Rules

Add these security rules to `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Face Templates - users can only access their own templates
    match /faceTemplates/{templateId} {
      allow read: if request.auth != null && 
                     (resource.data.userId == request.auth.uid ||
                      resource.data.masterAccountId in request.auth.token.companyIds);
      
      allow create: if request.auth != null && 
                       request.resource.data.userId == request.auth.uid;
      
      allow update: if request.auth != null && 
                       resource.data.userId == request.auth.uid;
      
      allow delete: if request.auth != null && 
                       (resource.data.userId == request.auth.uid ||
                        request.auth.token.role == 'master');
    }
    
    // Face Clock Attempts - users can create their own, admins can read all
    match /faceClockAttempts/{attemptId} {
      allow read: if request.auth != null && 
                     (resource.data.userId == request.auth.uid ||
                      request.auth.token.role in ['master', 'Admin', 'Planner', 'HR']);
      
      allow create: if request.auth != null && 
                       request.resource.data.userId == request.auth.uid &&
                       request.resource.data.method == 'face';
      
      allow update: if request.auth != null && 
                       request.auth.token.role in ['master', 'Admin'];
      
      allow delete: if false; // Never delete attempts for audit trail
    }
  }
}
```

---

## Index Creation Status Tracking

Use this checklist to track which indexes have been created:

### faceTemplates
- [ ] userId + masterAccountId + isActive

### faceClockAttempts
- [ ] siteId + createdAt
- [ ] userId + verificationState + createdAt
- [ ] offlineMode + syncedToServer + createdAt
- [ ] siteId + verificationState + createdAt
- [ ] masterAccountId + createdAt

---

## Performance Notes

1. **Index Build Time**: For large collections, indexes may take hours to build. Plan accordingly.

2. **Query Limits**: Firestore has a limit of 200 composite indexes per database. Monitor usage.

3. **Index Exemptions**: Single-field queries don't require composite indexes.

4. **Cost**: Indexes consume storage and write operations. Monitor Firebase usage.

---

## Troubleshooting

### "Index required" error

If you see an error like:
```
The query requires an index. You can create it here: https://console.firebase.google.com/...
```

1. Click the provided link to create the index
2. Wait for index to build (can take minutes to hours)
3. Retry the query

### Index not working

1. Verify index fields match your query exactly
2. Check field order (Ascending vs Descending)
3. Wait for index build to complete (check Firebase Console)
4. Clear app cache and retry

---

## References

- [Firestore Index Documentation](https://firebase.google.com/docs/firestore/query-data/indexing)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Firestore Query Limitations](https://firebase.google.com/docs/firestore/query-data/queries#query_limitations)
