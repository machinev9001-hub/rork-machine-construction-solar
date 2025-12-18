# Firebase Deployment Guide - Step by Step

## Quick Links

**Your Firebase Project:**
- [Firebase Console Dashboard](https://console.firebase.google.com/u/0/project/project-tracker-app-33cff)
- [Firestore Rules Editor](https://console.firebase.google.com/u/0/project/project-tracker-app-33cff/firestore/rules)
- [Firestore Indexes](https://console.firebase.google.com/u/0/project/project-tracker-app-33cff/firestore/databases/-default-/indexes)
- [Authentication](https://console.firebase.google.com/u/0/project/project-tracker-app-33cff/authentication)
- [Storage Rules](https://console.firebase.google.com/u/0/project/project-tracker-app-33cff/storage/rules)

---

## Part 1: Deploy Firestore Security Rules

### Step 1: Open Firebase Console
1. Click this link: https://console.firebase.google.com/u/0/project/project-tracker-app-33cff/firestore/rules
2. You should see the **Firestore Database Rules** editor
3. Look for a large text editor in the middle of the screen

### Step 2: Get the Security Rules
The complete security rules are in: **`docs/FIREBASE-SECURITY-RULES.md`**

Open that file in your repository and scroll to the section titled **"Complete Rules Template"** (around line 32).

### Step 3: Copy the Rules
Copy ALL the rules starting from:
```javascript
rules_version = '2';
service cloud.firestore {
```

All the way to the end:
```javascript
    }
  }
}
```

### Step 4: Paste into Firebase Console
1. In the Firebase Console Rules editor, **select all existing text** (Ctrl+A or Cmd+A)
2. **Delete** the existing rules
3. **Paste** the new rules you copied
4. Click the **"Publish"** button (top right, blue button)
5. Confirm by clicking **"Publish"** in the dialog

### Step 5: Verify Deployment
- You should see a green success message: "Rules published successfully"
- The timestamp at the top should update to the current time

---

## Part 2: Deploy Storage Rules (Optional)

### Step 1: Open Storage Rules
1. Click this link: https://console.firebase.google.com/u/0/project/project-tracker-app-33cff/storage/rules
2. You should see the **Storage Rules** editor

### Step 2: Get the Storage Rules
In **`docs/FIREBASE-SECURITY-RULES.md`**, scroll to the "Storage Rules Template" section.

### Step 3: Copy and Paste
1. Copy the storage rules from the documentation
2. Paste into the Storage Rules editor
3. Click **"Publish"**

---

## Part 3: Verify Indexes

### Step 1: Open Indexes Page
1. Click this link: https://console.firebase.google.com/u/0/project/project-tracker-app-33cff/firestore/databases/-default-/indexes
2. You should see a list of indexes

### Step 2: Check Status
Look at each index in the list:
- **Green checkmark + "Enabled"** = Good! ✅
- **Clock icon + "Building"** = Wait a few minutes ⏳
- **Red X + "Error"** = Needs attention ❌

### Step 3: Create Missing Indexes
If you see any "Index required" errors in your app:
1. The error message will include a clickable link
2. Click the link to automatically create the index
3. Wait 2-5 minutes for it to build

**All required indexes are documented in:** `docs/FIREBASE-INDEXES.md`

---

## Part 4: Test the Deployment

### Test Security Rules

1. Go to: https://console.firebase.google.com/u/0/project/project-tracker-app-33cff/firestore/rules
2. Click the **"Rules Playground"** tab (next to "Rules" tab)
3. Try these test scenarios:

**Test 1: Master User Can Create Company**
```
Location: /companies/test-company-123
Authenticated: Yes
Provider: Custom
Auth UID: test-master-uid
Custom Claims:
{
  "role": "Master",
  "siteId": "test-site",
  "companyId": "test-company-123"
}
```
- Click **"Get"** or **"Set"**
- Result should be: ✅ **"Allowed"**

**Test 2: Operator Cannot Create Company**
```
Location: /companies/test-company-123
Authenticated: Yes
Provider: Custom
Auth UID: test-operator-uid
Custom Claims:
{
  "role": "Operator",
  "siteId": "test-site",
  "companyId": "test-company-123"
}
```
- Click **"Set"**
- Result should be: ❌ **"Denied"**

If both tests pass, your security rules are working correctly!

---

## Part 5: Alternative Deployment Method (CLI)

If you prefer using the command line:

### Step 1: Install Firebase CLI
```bash
npm install -g firebase-tools
```

### Step 2: Login
```bash
firebase login
```

### Step 3: Initialize Project (if not done)
```bash
cd /path/to/your/project
firebase init firestore
```
- Select your project: `project-tracker-app-33cff`
- Keep default file names

### Step 4: Copy Rules to File
Copy the rules from `docs/FIREBASE-SECURITY-RULES.md` into `firestore.rules` in your project root.

### Step 5: Deploy
```bash
firebase deploy --only firestore:rules
```

### Step 6: Deploy Indexes (if needed)
```bash
firebase deploy --only firestore:indexes
```

---

## Common Issues & Solutions

### Issue 1: "Can't find the edit button"

**Solution:** The edit area is the large text box in the middle of the screen. You don't need a special "edit" button - just click in the text area to start editing.

### Issue 2: "Rules won't save"

**Possible causes:**
1. Syntax error in the rules - check for red squiggly lines
2. Missing closing braces `}`
3. Not logged in with correct account

**Solution:** 
- Check for any red error indicators in the editor
- Make sure you copied the complete rules (from `rules_version` to final `}`)
- Verify you're logged into the correct Google account

### Issue 3: "Permission denied errors in app"

**Causes:**
1. Rules not deployed yet
2. User doesn't have custom claims set
3. User not authenticated

**Solution:**
1. Wait a few minutes for rules to propagate
2. Check user's custom claims (see below)
3. Ensure user is logged in

### Issue 4: "How do I check custom claims?"

In your app code:
```typescript
import { getAuth } from 'firebase/auth';

const auth = getAuth();
const user = auth.currentUser;
if (user) {
  const idTokenResult = await user.getIdTokenResult();
  console.log('Custom claims:', idTokenResult.claims);
}
```

Expected output:
```javascript
{
  role: "Supervisor",
  siteId: "site-123",
  companyId: "company-456"
}
```

---

## Visual Guide to Firebase Console

### Where to Find Rules Editor

1. **Main Dashboard** → Click "Firestore Database" in left sidebar
2. **Firestore Database** → Click "Rules" tab at the top
3. You should see:
   - Large text editor in center
   - "Publish" button at top right
   - Timestamp showing last update

### Where to Find Indexes

1. **Main Dashboard** → Click "Firestore Database" in left sidebar
2. **Firestore Database** → Click "Indexes" tab at the top
3. You should see:
   - List of indexes with status
   - "Create Index" button at top
   - Search/filter options

---

## Checklist After Deployment

- [ ] Firestore security rules deployed
- [ ] Firestore rules tested with Rules Playground
- [ ] Storage rules deployed (if using Firebase Storage)
- [ ] All indexes showing "Enabled" status
- [ ] Test login in your app
- [ ] Test creating a task/activity
- [ ] Test role-based permissions
- [ ] Check console for any permission errors

---

## Need Help?

**Documentation Files:**
- `docs/FIREBASE-SECURITY-RULES.md` - Complete rules and explanation
- `docs/FIREBASE-SETUP-CHECKLIST.md` - Full pre-launch checklist
- `docs/QUICK-REFERENCE.md` - Quick code patterns and links

**Firebase Support:**
- [Firebase Documentation](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Status](https://status.firebase.google.com)
- [Firebase Support](https://firebase.google.com/support)

**If rules still won't deploy:**
1. Try a different browser
2. Check Firebase Status page
3. Clear browser cache and try again
4. Use Firebase CLI method instead

---

**Last Updated:** December 18, 2025  
**Your Project ID:** project-tracker-app-33cff
