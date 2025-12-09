# Firebase Indexes - Manual Creation Guide

## 🚨 If Indexes Are Not Auto-Deploying, Use This Manual Guide

This document provides **step-by-step instructions** for manually creating all Firebase indexes in the Firebase Console.

---

## 📍 Accessing Firebase Console

1. Go to: https://console.firebase.google.com/
2. Select your project
3. Click **Firestore Database** in the left menu
4. Click the **Indexes** tab at the top
5. Click **Create Index** button

---

## 📋 INDEX CREATION INSTRUCTIONS

For each index below, follow these steps:
1. Click **Create Index**
2. Enter the **Collection ID**
3. Add **Fields** in the exact order shown
4. Set **Query scope** to `Collection` (unless specified as `Collection group`)
5. Click **Create**
6. Wait for the index to build (can take 1-5 minutes)

---

## 🎯 SECTION 1: Menu Management Indexes

### Index 1: Main Menu - Company Lookup
```
Collection ID: mainMenu
Query Scope: Collection

Fields:
  1. companyId          → Ascending
  2. masterAccountId    → Ascending  
  3. order              → Ascending
```

### Index 2: Main Menu - Order by Master Account
```
Collection ID: mainMenu
Query Scope: Collection

Fields:
  1. masterAccountId    → Ascending
  2. order              → Ascending
```

### Index 3: Sub Menus - Order by Main Menu
```
Collection ID: subMenus
Query Scope: Collection

Fields:
  1. mainMenuId         → Ascending
  2. order              → Ascending
```

### Index 4: Menu Activities - Hierarchical Lookup
```
Collection ID: menuActivities
Query Scope: Collection

Fields:
  1. mainMenuId         → Ascending
  2. subMenuId          → Ascending
  3. order              → Ascending
```

---

## 💰 SECTION 2: BOQ (Bill of Quantities) Indexes

### Index 1: BOQ - Site Query
```
Collection ID: boq
Query Scope: Collection

Fields:
  1. siteId             → Ascending
  2. mainMenuId         → Ascending
  3. subMenuId          → Ascending
  4. activityId         → Ascending
```

### Index 2: BOQ - Site + Level
```
Collection ID: boq
Query Scope: Collection

Fields:
  1. siteId             → Ascending
  2. level              → Ascending
  3. createdAt          → Descending
```

### Index 3: BOQ - Site + Main Menu + Level
```
Collection ID: boq
Query Scope: Collection

Fields:
  1. siteId             → Ascending
  2. mainMenuId         → Ascending
  3. level              → Ascending
```

### Index 4: BOQ - Site + Main + Sub Menu + Level
```
Collection ID: boq
Query Scope: Collection

Fields:
  1. siteId             → Ascending
  2. mainMenuId         → Ascending
  3. subMenuId          → Ascending
  4. level              → Ascending
```

### Index 5: BOQ - Master Account Lookup
```
Collection ID: boq
Query Scope: Collection

Fields:
  1. masterAccountId    → Ascending
  2. siteId             → Ascending
  3. createdAt          → Descending
```

### Index 6: BOQ - Master Account + Main Menu
```
Collection ID: boq
Query Scope: Collection

Fields:
  1. masterAccountId    → Ascending
  2. mainMenuId         → Ascending
  3. siteId             → Ascending
```

---

## 👤 SECTION 3: Face Clock System Indexes

### Index 1: Face Templates - User Lookup
```
Collection ID: faceTemplates
Query Scope: Collection

Fields:
  1. userId             → Ascending
  2. masterAccountId    → Ascending
  3. isActive           → Ascending
```

### Index 2: Face Clock Attempts - Site History
```
Collection ID: faceClockAttempts
Query Scope: Collection

Fields:
  1. siteId             → Ascending
  2. createdAt          → Descending
```

### Index 3: Face Clock Attempts - User History
```
Collection ID: faceClockAttempts
Query Scope: Collection

Fields:
  1. userId             → Ascending
  2. verificationState  → Ascending
  3. createdAt          → Descending
```

### Index 4: Face Clock Attempts - Offline Sync Queue
```
Collection ID: faceClockAttempts
Query Scope: Collection

Fields:
  1. offlineMode        → Ascending
  2. syncedToServer     → Ascending
  3. createdAt          → Ascending
```

### Index 5: Face Clock Attempts - Site Status Monitoring
```
Collection ID: faceClockAttempts
Query Scope: Collection

Fields:
  1. siteId             → Ascending
  2. verificationState  → Ascending
  3. createdAt          → Descending
```

### Index 6: Face Clock Attempts - Master Account Reports
```
Collection ID: faceClockAttempts
Query Scope: Collection

Fields:
  1. masterAccountId    → Ascending
  2. createdAt          → Descending
```

---

## 🏢 SECTION 4: Company System Indexes

### Index 1: Companies - Status + Created
```
Collection ID: companies
Query Scope: Collection

Fields:
  1. status             → Ascending
  2. createdAt          → Descending
```

### Index 2: Companies - Industry Sector
```
Collection ID: companies
Query Scope: Collection

Fields:
  1. industrySector     → Ascending
  2. createdAt          → Descending
```

### Index 3: Companies - Status + Industry + Created
```
Collection ID: companies
Query Scope: Collection

Fields:
  1. status             → Ascending
  2. industrySector     → Ascending
  3. createdAt          → Descending
```

### Index 4: Companies - Created By + Industry
```
Collection ID: companies
Query Scope: Collection

Fields:
  1. createdBy          → Ascending
  2. industrySector     → Ascending
  3. createdAt          → Descending
```

### Index 5: Companies - Master Account + Name
```
Collection ID: companies
Query Scope: Collection

Fields:
  1. masterAccountId    → Ascending
  2. name               → Ascending
```

---

## 🚜 SECTION 5: Plant Asset Allocation Indexes

### Index 1: Plant Assets - Company + Allocation
```
Collection ID: plantAssets
Query Scope: Collection

Fields:
  1. companyId              → Ascending
  2. allocationStatus       → Ascending
  3. createdAt              → Descending
```

### Index 2: Plant Assets - Site + Allocation
```
Collection ID: plantAssets
Query Scope: Collection

Fields:
  1. siteId                 → Ascending
  2. allocationStatus       → Ascending
  3. createdAt              → Descending
```

### Index 3: Plant Assets - Master Account + Allocation
```
Collection ID: plantAssets
Query Scope: Collection

Fields:
  1. masterAccountId        → Ascending
  2. allocationStatus       → Ascending
  3. createdAt              → Descending
```

### Index 4: Plant Assets - Company + Industry
```
Collection ID: plantAssets
Query Scope: Collection

Fields:
  1. companyId              → Ascending
  2. industrySector         → Ascending
  3. createdAt              → Descending
```

### Index 5: Plant Assets - Master + Owner Type
```
Collection ID: plantAssets
Query Scope: Collection

Fields:
  1. masterAccountId        → Ascending
  2. ownerType              → Ascending
  3. createdAt              → Descending
```

### Index 6: Plant Assets - Master + Cross Hire
```
Collection ID: plantAssets
Query Scope: Collection

Fields:
  1. masterAccountId        → Ascending
  2. isCrossHire            → Ascending
  3. createdAt              → Descending
```

### Index 7: Plant Assets - Owner ID Lookup
```
Collection ID: plantAssets
Query Scope: Collection

Fields:
  1. ownerId                → Ascending
  2. createdAt              → Descending
```

---

## 👷 SECTION 6: Employee & Timesheet Indexes

### Index 1: Employees - Master + ID Number
```
Collection ID: employees
Query Scope: Collection

Fields:
  1. masterAccountId        → Ascending
  2. employeeIdNumber       → Ascending
```

### Index 2: Employees - Master + Role + Name
```
Collection ID: employees
Query Scope: Collection

Fields:
  1. masterAccountId        → Ascending
  2. role                   → Ascending
  3. name                   → Ascending
```

### Index 3: Employees - Master + Employer Type
```
Collection ID: employees
Query Scope: Collection

Fields:
  1. masterAccountId        → Ascending
  2. employerType           → Ascending
  3. name                   → Ascending
```

### Index 4: Employees - Master + Cross Hire
```
Collection ID: employees
Query Scope: Collection

Fields:
  1. masterAccountId        → Ascending
  2. isCrossHire            → Ascending
  3. createdAt              → Descending
```

### Index 5: Employees - Employer ID Lookup
```
Collection ID: employees
Query Scope: Collection

Fields:
  1. employerId             → Ascending
  2. createdAt              → Descending
```

### Index 6: Operator Timesheets - Master + Status
```
Collection ID: operatorTimesheets
Query Scope: Collection

Fields:
  1. masterAccountId        → Ascending
  2. status                 → Ascending
  3. date                   → Descending
```

### Index 7: Operator Timesheets - Master + Date
```
Collection ID: operatorTimesheets
Query Scope: Collection

Fields:
  1. masterAccountId        → Ascending
  2. date                   → Descending
```

---

## 🎯 SECTION 7: Sites, Tasks & Activities Indexes

### Index 1: Sites - Company + Master
```
Collection ID: sites
Query Scope: Collection

Fields:
  1. companyId              → Ascending
  2. masterAccountId        → Ascending
```

### Index 2: Sites - Company + Status
```
Collection ID: sites
Query Scope: Collection

Fields:
  1. companyId              → Ascending
  2. status                 → Ascending
```

### Index 3: Sites - Company + Created
```
Collection ID: sites
Query Scope: Collection

Fields:
  1. companyId              → Ascending
  2. createdAt              → Descending
```

### Index 4: Tasks - Company + Site + Supervisor
```
Collection ID: tasks
Query Scope: Collection

Fields:
  1. companyId              → Ascending
  2. siteId                 → Ascending
  3. supervisorId           → Ascending
```

### Index 5: Tasks - Site + Status + Created
```
Collection ID: tasks
Query Scope: Collection

Fields:
  1. siteId                 → Ascending
  2. status                 → Ascending
  3. createdAt              → Descending
```

### Index 6: Activities - Task + Activity ID
```
Collection ID: activities
Query Scope: Collection

Fields:
  1. taskId                 → Ascending
  2. activityId             → Ascending
```

---

## 📨 SECTION 8: Requests & Messages Indexes

### Index 1: Requests - Type + Site + Created
```
Collection ID: requests
Query Scope: Collection

Fields:
  1. type                   → Ascending
  2. siteId                 → Ascending
  3. createdAt              → Descending
```

### Index 2: Requests - Type + Site + Updated
```
Collection ID: requests
Query Scope: Collection

Fields:
  1. type                   → Ascending
  2. siteId                 → Ascending
  3. updatedAt              → Descending
```

### Index 3: Messages - Type + Site + To User
```
Collection ID: messages
Query Scope: Collection

Fields:
  1. type                   → Ascending
  2. siteId                 → Ascending
  3. toUserId               → Ascending
  4. createdAt              → Descending
```

### Index 4: Onboarding Messages - Site + To User
```
Collection ID: onboardingMessages
Query Scope: Collection

Fields:
  1. siteId                 → Ascending
  2. toUserId               → Ascending
  3. createdAt              → Descending
```

---

## 📊 SECTION 9: Progress & History Indexes

### Index 1: Progress Entries - Supervisor History
```
Collection ID: progressEntries
Query Scope: Collection group

Fields:
  1. supervisorId           → Ascending
  2. enteredAt              → Descending
```

### Index 2: Progress Entries - Site History
```
Collection ID: progressEntries
Query Scope: Collection group

Fields:
  1. siteId                 → Ascending
  2. enteredAt              → Descending
```

### Index 3: Progress Entries - Task History
```
Collection ID: progressEntries
Query Scope: Collection group

Fields:
  1. taskId                 → Ascending
  2. enteredAt              → Descending
```

### Index 4: History - Date Sorting
```
Collection ID: history
Query Scope: Collection group

Fields:
  1. date                   → Descending
```

### Index 5: History - Lock Type + Date
```
Collection ID: history
Query Scope: Collection group

Fields:
  1. lockType               → Ascending
  2. date                   → Descending
```

---

## 🏗️ SECTION 10: Subcontractors & Activation Indexes

### Index 1: Subcontractors - Master + Name
```
Collection ID: subcontractors
Query Scope: Collection

Fields:
  1. masterAccountId        → Ascending
  2. name                   → Ascending
```

### Index 2: Subcontractors - Master + Status + Name
```
Collection ID: subcontractors
Query Scope: Collection

Fields:
  1. masterAccountId        → Ascending
  2. status                 → Ascending
  3. name                   → Ascending
```

### Index 3: Activation Codes - Code Lookup
```
Collection ID: activation_codes
Query Scope: Collection

Fields:
  1. code                   → Ascending
```

### Index 4: Activation Codes - Status + Created
```
Collection ID: activation_codes
Query Scope: Collection

Fields:
  1. status                 → Ascending
  2. createdAt              → Descending
```

### Index 5: Master Accounts - Master ID
```
Collection ID: masterAccounts
Query Scope: Collection

Fields:
  1. masterId               → Ascending
```

### Index 6: Master Accounts - Activation Code
```
Collection ID: masterAccounts
Query Scope: Collection

Fields:
  1. activationCodeId       → Ascending
  2. createdAt              → Descending
```

### Index 7: Master Accounts - Company
```
Collection ID: masterAccounts
Query Scope: Collection

Fields:
  1. companyId              → Ascending
  2. createdAt              → Descending
```

---

## ⏱️ SECTION 11: Plant Asset Hours & Operator History

### Index 1: Plant Asset Hours - Company + Asset + Date
```
Collection ID: PlantAssetHours
Query Scope: Collection

Fields:
  1. companyId              → Ascending
  2. assetId                → Ascending
  3. date                   → Descending
```

### Index 2: Plant Asset Hours - Operator + Date
```
Collection ID: PlantAssetHours
Query Scope: Collection

Fields:
  1. operatorId             → Ascending
  2. date                   → Descending
```

### Index 3: Plant Asset Hours - Asset + Date
```
Collection ID: PlantAssetHours
Query Scope: Collection

Fields:
  1. assetId                → Ascending
  2. date                   → Descending
```

### Index 4: Plant Asset Hours - Site + Date
```
Collection ID: PlantAssetHours
Query Scope: Collection

Fields:
  1. siteId                 → Ascending
  2. date                   → Descending
```

### Index 5: Plant Asset Hours - Master + Date
```
Collection ID: PlantAssetHours
Query Scope: Collection

Fields:
  1. masterAccountId        → Ascending
  2. date                   → Descending
```

### Index 6: Operator History - Asset + Change Date
```
Collection ID: plantAssetOperatorHistory
Query Scope: Collection

Fields:
  1. assetId                → Ascending
  2. changeDate             → Descending
```

### Index 7: Operator History - Master + Change Date
```
Collection ID: plantAssetOperatorHistory
Query Scope: Collection

Fields:
  1. masterAccountId        → Ascending
  2. changeDate             → Descending
```

### Index 8: Operator History - New Operator + Date
```
Collection ID: plantAssetOperatorHistory
Query Scope: Collection

Fields:
  1. newOperatorId          → Ascending
  2. changeDate             → Descending
```

---

## 👥 SECTION 12: Users Indexes

### Index 1: Users - Site + Role + Active
```
Collection ID: users
Query Scope: Collection

Fields:
  1. siteId                 → Ascending
  2. role                   → Ascending
  3. isActive               → Ascending
```

### Index 2: Users - Employee ID Number
```
Collection ID: users
Query Scope: Collection

Fields:
  1. employeeIdNumber       → Ascending
```

### Index 3: Users - Company + Role
```
Collection ID: users
Query Scope: Collection

Fields:
  1. currentCompanyId       → Ascending
  2. role                   → Ascending
```

---

## ✅ VERIFICATION CHECKLIST

After creating all indexes, verify they're working:

1. **Check Index Status**
   - All indexes should show "Enabled" status (green checkmark)
   - If building, wait until complete (progress bar)

2. **Test Queries**
   - Open your app and navigate to each feature
   - BOQ page should load without errors
   - Face clock system should work
   - Menu management should display correctly
   - Plant allocation should show assets

3. **Check for Error Messages**
   - Look in browser console (F12)
   - Look in Firestore logs
   - Should see NO "index required" errors

4. **Performance Check**
   - Queries should be fast (<1 second)
   - Lists should load smoothly
   - No slow loading spinners

---

## 🔍 TROUBLESHOOTING

### "Index already exists" error
- This means the index is already created
- Skip to the next one

### Index is "Building" for hours
- Large collections take time
- Wait patiently
- Check back in 1-2 hours

### Query still fails after creating index
- Double-check field names (case-sensitive)
- Verify field order matches exactly
- Check Ascending vs Descending
- Clear browser cache and retry

### Too many indexes to create
- Prioritize sections based on what you're using:
  - Section 1 (Menu Management) - High priority
  - Section 2 (BOQ) - High priority  
  - Section 3 (Face Clock) - If using face recognition
  - Sections 4-12 - Create as needed

---

## 📞 NEED HELP?

If indexes still aren't working after following this guide:

1. Copy the exact error message from Firebase Console
2. Take a screenshot of the Indexes tab
3. Note which specific feature is failing
4. Contact support with these details

---

**Last Updated:** January 2025  
**Total Indexes:** 100+  
**Estimated Time:** 2-3 hours to create all manually  
**Alternative:** Use `firebase deploy --only firestore:indexes` with CLI
