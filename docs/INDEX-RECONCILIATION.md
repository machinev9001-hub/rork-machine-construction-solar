# Firebase Index Reconciliation Guide

## Overview

This guide helps you reconcile Firebase Firestore indexes between your local `firestore.indexes.json` file and remote Firebase Console indexes.

---

## ✅ Fixed Issues (January 2025)

The following typos and casing issues have been resolved in `firestore.indexes.json`:

### Removed Duplicate/Incorrect Indexes:
1. **`PlantAssets`** (capitalized) - duplicate removed, only lowercase `plantAssets` remains
2. **`PlantAssetHours`** (capitalized) - duplicate removed, only lowercase `plantAssetHours` remains
3. **`Companies`** (capitalized) - duplicate removed, only lowercase `companies` remains
4. **`Subcontractors`** (capitalized) - duplicate removed, only lowercase `subcontractors` remains
5. **`BOQ`** (uppercase) - duplicate removed, only lowercase `boq` remains
6. **`imesheets`** (typo) - removed, correct collection is `timesheets`

### Current Index Count:
- **Total indexes:** 106 (cleaned and consolidated)
- **Collection groups:** All properly lowercase
- **Duplicates:** None

---

## 🔧 Helper Scripts

Three new scripts have been added to help manage indexes:

### 1. Backup Script
**File:** `scripts/backup-indexes.sh`

Creates timestamped backups of your `firestore.indexes.json` file.

```bash
# Make executable
chmod +x scripts/backup-indexes.sh

# Run backup
./scripts/backup-indexes.sh
```

Backups are stored in: `firestore-index-backups/`

---

### 2. Diff Script
**File:** `scripts/diff-indexes.js`

Compares local `firestore.indexes.json` with remote Firebase indexes.

```bash
# First, export remote indexes
gcloud firestore indexes list --format=json > firestore-remote-indexes.json

# Then run diff
node scripts/diff-indexes.js
```

**Output:**
- ✅ Indexes in sync (present in both)
- 📤 Local-only indexes (will be created on deploy)
- 📥 Remote-only indexes (CLI will prompt to delete)
- ⚠️  Suspicious indexes (casing issues, typos)

---

### 3. Converter Script
**File:** `scripts/convert-remote-to-local.js`

Converts remote index format to local `firestore.indexes.json` format.

```bash
# First, export remote indexes
gcloud firestore indexes list --format=json > firestore-remote-indexes.json

# Then convert
node scripts/convert-remote-to-local.js
```

**Output file:** `firestore-remote-converted.json`

This file can be manually merged with your local `firestore.indexes.json`.

---

## 📋 Reconciliation Workflow

Follow these steps to reconcile your indexes:

### Step 1: Backup Current State
```bash
./scripts/backup-indexes.sh
```

### Step 2: Export Remote Indexes
```bash
gcloud firestore indexes list --format=json > firestore-remote-indexes.json
```

### Step 3: Run Comparison
```bash
node scripts/diff-indexes.js
```

### Step 4: Review Differences

**For indexes flagged as suspicious (casing/typos):**
- These are likely duplicates or mistakes
- They will be deleted when you run the deploy command
- Review the list and confirm they should be removed

**For legitimate remote-only indexes:**
- Use the converter to transform them
- Manually add them to `firestore.indexes.json`
- Re-run diff to verify

### Step 5: Convert Remote Format (Optional)
```bash
node scripts/convert-remote-to-local.js
```

Review `firestore-remote-converted.json` and manually merge any legitimate indexes.

### Step 6: Deploy Indexes
```bash
firebase deploy --only firestore:indexes
```

**The CLI will:**
- Create any local-only indexes
- Prompt you to delete remote-only indexes
- Show confirmation before making changes

### Step 7: Verify Deployment

After deployment completes (2-5 minutes):

1. Go to [Firebase Console → Firestore → Indexes](https://console.firebase.google.com/)
2. Verify all indexes show status: **Enabled** (green)
3. Test critical app screens (see verification checklist below)

---

## 🚫 Common Issues & Solutions

### Issue 1: CLI Wants to Delete Many Indexes

**Symptom:** CLI prompts to delete 10+ indexes

**Cause:** Remote indexes not defined in local file

**Solutions:**
1. Review the indexes using diff script
2. If they're duplicates with casing issues → allow deletion
3. If they're legitimate → add them to local file first
4. Re-run deploy

---

### Issue 2: Index Already Exists Error

**Symptom:** `Error: Index already exists`

**Cause:** Attempting to create duplicate index

**Solution:**
1. Wait 5 minutes (indexes may still be building)
2. Run diff script to confirm duplication
3. Remove duplicate from `firestore.indexes.json`
4. Re-deploy

---

### Issue 3: Build Failed / Timeout

**Symptom:** Index stuck in "Building" state

**Solutions:**
1. Wait up to 10 minutes for large indexes
2. Check Firebase Console for build status
3. If error persists, delete and recreate via CLI

---

## ✅ Verification Checklist

After deploying indexes, test these critical screens:

### Core Workflow
- [ ] Planner - Task Requests
- [ ] Planner - Activity Requests  
- [ ] Planner - QC Requests
- [ ] Supervisor - Activity Detail

### Plant & Employees
- [ ] Master - Plant Manager
- [ ] Master - Employee Manager
- [ ] Operator - Hours Dashboard

### BOQ System
- [ ] Master - BOQ Manager (all 3 levels)
- [ ] Planner - BOQ by Main Category
- [ ] Planner - BOQ by Sub Menu

### Company Management
- [ ] Master - Company Selector
- [ ] Admin - Company Setup

### Face Clock System
- [ ] Site - Face Clock Attempts
- [ ] Master - Face Templates

### Menu Management
- [ ] Master - Menu Manager
- [ ] Sub Menu Management
- [ ] Activity Management

---

## 📊 Index Naming Conventions

All collection names should follow these rules:

### ✅ Correct
- `boq` (lowercase)
- `plantAssets` (camelCase)
- `plantAssetHours` (camelCase)
- `companies` (lowercase plural)
- `subcontractors` (lowercase plural)
- `timesheets` (lowercase)

### ❌ Incorrect
- `BOQ` (uppercase)
- `PlantAssets` (PascalCase)
- `PlantAssetHours` (PascalCase)
- `Companies` (PascalCase)
- `Subcontractors` (PascalCase)
- `imesheets` (typo)

---

## 🔍 Finding Specific Indexes

### By Collection Group
```bash
# In firestore.indexes.json
grep -A 8 '"collectionGroup": "boq"' firestore.indexes.json
```

### By Field Path
```bash
# Find all indexes using masterAccountId
grep -B 3 -A 5 '"masterAccountId"' firestore.indexes.json
```

### Count Indexes per Collection
```bash
# Count all boq indexes
grep '"collectionGroup": "boq"' firestore.indexes.json | wc -l
```

---

## 📁 Related Files

- `/firestore.indexes.json` - Local index definitions
- `/scripts/backup-indexes.sh` - Backup script
- `/scripts/diff-indexes.js` - Comparison tool
- `/scripts/convert-remote-to-local.js` - Converter tool
- `/docs/FIREBASE-INDEXES.md` - Main index documentation
- `/docs/BOQ-FIREBASE-INDEXES.md` - BOQ-specific indexes
- `/docs/MISSING-INDEXES-2025.md` - Previously missing indexes

---

## 🆘 Getting Help

If you encounter issues:

1. **Check index build status** in Firebase Console
2. **Review error messages** from CLI deployment
3. **Run diff script** to see current state
4. **Check docs** in `/docs/FIREBASE-INDEXES.md`
5. **Restore from backup** if needed:
   ```bash
   cp firestore-index-backups/firestore.indexes.TIMESTAMP.json firestore.indexes.json
   ```

---

## 🎯 Quick Reference Commands

```bash
# Backup indexes
./scripts/backup-indexes.sh

# Export remote indexes
gcloud firestore indexes list --format=json > firestore-remote-indexes.json

# Compare local vs remote
node scripts/diff-indexes.js

# Convert remote to local format
node scripts/convert-remote-to-local.js

# Deploy indexes
firebase deploy --only firestore:indexes

# List all backups
ls -lh firestore-index-backups/

# Restore from backup
cp firestore-index-backups/firestore.indexes.YYYYMMDD_HHMMSS.json firestore.indexes.json
```

---

**Last Updated:** January 2025  
**Status:** All indexes cleaned and ready for deployment  
**Next Action:** Run `firebase deploy --only firestore:indexes` to sync
