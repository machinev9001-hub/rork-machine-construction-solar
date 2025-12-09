# Missing Firebase Indexes - January 2025

## 🚨 URGENT: Three Missing Indexes Detected

Based on console errors from the mobile app, the following composite indexes are missing and need to be created immediately in Firebase Console.

---

## 1. OnboardingMessages Index ❌

**Error Location:** `app/onboarding-messages.tsx:69`

**Collection:** `onboardingMessages`

**Fields:**
- `siteId` (Ascending)
- `toUserId` (Ascending) 
- `createdAt` (Descending)

**Create Link:**
```
https://console.firebase.google.com/v1/r/project/project-tracker-app-33cff/firestore/indexes?create_composite=CmRwcm9qZWN0cy9wcm9qZWN0LXRyYWNrZXItYXBwLTMzY2ZmL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9vbmJvYXJkaW5nTWVzc2FnZXMvaW5kZXhlcy9fEAEaCgoGc2l0ZUlkEAEaDQoJdG9Vc2VySWQQARoNCgljcmVhdGVkQXQQAhoMCghfX25hbWVfXxAB
```

**Query:**
```typescript
query(
  messagesRef,
  where('siteId', '==', user.siteId),
  where('toUserId', '==', user.id),
  orderBy('createdAt', 'desc')
)
```

**Purpose:** Loads inbox messages for onboarding system filtered by site and recipient

---

## 2. PlantAssets (Master Account) Index ❌

**Error Location:** `app/onboarding-assets.tsx:74`

**Collection:** `plantAssets`

**Fields:**
- `masterAccountId` (Ascending)
- `assetId` (Ascending)

**Create Link:**
```
https://console.firebase.google.com/v1/r/project/project-tracker-app-33cff/firestore/indexes?create_composite=CmJwcm9qZWN0cy9wcm9qZWN0LXRyYWNrZXItYXBwLTMzY2ZmL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9wbGFudEFzc2V0cy9pbmRleGVzL18QARoSCg5tYXN0ZXJBY2NvdW50SWQQARoKCgZhc3NldElkEAEaDAoIX19uYW1lX18QAQ
```

**Query:**
```typescript
query(
  assetsRef,
  where('masterAccountId', '==', user.masterAccountId),
  orderBy('assetId', 'asc')
)
```

**Purpose:** Loads all plant assets across all sites for master account users

---

## 3. HandoverRequests (Surveyor) Index ❌

**Error Location:** `app/planner-surveyor-requests.tsx:103`

**Collection:** `handoverRequests`

**Fields:**
- `siteId` (Ascending)
- `requestType` (Ascending)
- `createdAt` (Descending)

**Create Link:**
```
https://console.firebase.google.com/v1/r/project/project-tracker-app-33cff/firestore/indexes?create_composite=CmZwcm9qZWN0cy9wcm9qZWN0LXRyYWNrZXItYXBwLTMzY2ZmL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9oYW5kb3ZlclJlcXVlc3RzL2luZGV4ZXMvXxABGgoKBnNpdGVJZBABGg8LC3JlcXVlc3RUeXBlEAEaDQoJY3JlYXRlZEF0EAIaDAoIX19uYW1lX18QAQ
```

**Query:**
```typescript
query(
  handoverRequestsRef,
  where('siteId', '==', user.siteId),
  where('requestType', '==', 'SURVEYOR_REQUEST'),
  orderBy('createdAt', 'desc')
)
```

**Purpose:** Loads surveyor handover requests filtered by site and request type

---

## How to Create Indexes

### Option 1: Click Links Above (Fastest)
1. Click each "Create Link" above
2. You'll be redirected to Firebase Console with pre-filled index configuration
3. Click "Create Index" button
4. Wait 2-5 minutes for index to build
5. Repeat for all three indexes

### Option 2: Manual Creation in Firebase Console
1. Navigate to: https://console.firebase.google.com/project/project-tracker-app-33cff/firestore/indexes
2. Click "Create Index" button
3. Enter collection name and fields as specified above
4. Save and wait for build

### Option 3: Deploy via Firebase CLI (Recommended for Production)
```bash
firebase deploy --only firestore:indexes
```

This will deploy all indexes defined in `firestore.indexes.json`

---

## Status Tracking

- [ ] OnboardingMessages index created
- [ ] PlantAssets (Master) index created  
- [ ] HandoverRequests (Surveyor) index created

---

## Verification Steps

After creating all indexes:

1. **Test OnboardingMessages:**
   - Navigate to: Onboarding Dashboard → Messages Tab
   - Should load without errors

2. **Test PlantAssets (Master):**
   - Sign in as Master account
   - Navigate to: Onboarding Dashboard → Assets Tab
   - Should load all assets across sites

3. **Test HandoverRequests (Surveyor):**
   - Sign in as Planner
   - Navigate to: Planner Dashboard → Surveyor Requests
   - Should load all surveyor handover requests

---

## Already Defined in firestore.indexes.json

All three indexes have been added to `firestore.indexes.json` and are ready for deployment.

**File location:** `/firestore.indexes.json`

**Deploy command:**
```bash
firebase deploy --only firestore:indexes
```

---

## Notes

- **Build Time:** Each index takes 2-5 minutes to build in Firebase
- **Status:** Check index status in Firebase Console under Firestore → Indexes
- **Priority:** All three are CRITICAL for app functionality
- **Impact:** App screens will crash/error without these indexes

---

## Related Documentation

- `/docs/ONBOARDING-INDEXES.md` - Updated with all three new indexes
- `/firestore.indexes.json` - Contains all index definitions
- `/PREVENT_INDEX_ISSUES.md` - Best practices for index management
