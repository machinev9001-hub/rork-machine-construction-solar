# Firebase Setup Checklist - Project Tracker

## Project Details

**Project Name:** Project Tracker -Live  
**Project ID:** project-tracker-app-33cff  
**Project Number:** 235534188025  
**Web App ID:** 1:235534188025:web:b7c49ea0c361988cf41128  

**Console Links:**
- [Firestore Database](https://console.firebase.google.com/u/0/project/project-tracker-app-33cff/firestore)
- [Firestore Indexes](https://console.firebase.google.com/u/0/project/project-tracker-app-33cff/firestore/databases/-default-/indexes)
- [Authentication](https://console.firebase.google.com/u/0/project/project-tracker-app-33cff/authentication)
- [Security Rules](https://console.firebase.google.com/u/0/project/project-tracker-app-33cff/firestore/rules)
- [Storage](https://console.firebase.google.com/u/0/project/project-tracker-app-33cff/storage)

---

## Pre-Launch Checklist

### 1. Firestore Database ✅

#### A. Indexes (CRITICAL)
- [ ] All 48+ indexes created (see [FIREBASE-INDEXES.md](./FIREBASE-INDEXES.md))
- [ ] Company indexes created
- [ ] User indexes created
- [ ] Task/Activity indexes created
- [ ] Request indexes created
- [ ] Onboarding indexes created
- [ ] Plant asset indexes created
- [ ] All indexes showing "Enabled" status

**Verify:** https://console.firebase.google.com/u/0/project/project-tracker-app-33cff/firestore/databases/-default-/indexes

#### B. Security Rules (CRITICAL)
- [ ] Security rules deployed (see [FIREBASE-SECURITY-RULES.md](./FIREBASE-SECURITY-RULES.md))
- [ ] All 10 roles properly configured
- [ ] Site-based isolation working
- [ ] Company-based isolation working
- [ ] Tested with Rules Simulator
- [ ] No wildcard allow rules in production

**Verify:** https://console.firebase.google.com/u/0/project/project-tracker-app-33cff/firestore/rules

#### C. Collections Structure
- [ ] `companies` collection
- [ ] `masterAccounts` collection
- [ ] `users` collection
- [ ] `sites` collection
- [ ] `tasks` collection
- [ ] `activities` collection
- [ ] `requests` collection
- [ ] `handoverRequests` collection
- [ ] `employees` collection
- [ ] `plantAssets` collection
- [ ] `onboardingMessages` collection
- [ ] All other required collections

---

### 2. Authentication ✅

#### A. Authentication Methods
- [ ] Email/Password enabled
- [ ] Email verification configured (optional)
- [ ] Password reset email template customized

**Verify:** https://console.firebase.google.com/u/0/project/project-tracker-app-33cff/authentication/providers

#### B. Custom Claims
- [ ] Backend function to set custom claims deployed
- [ ] Test setting role claim
- [ ] Test setting siteId claim
- [ ] Test setting companyId claim
- [ ] Verify claims persist after token refresh

**Test Script:**
```javascript
// In Firebase Functions or backend
import * as admin from 'firebase-admin';

async function testCustomClaims(uid: string) {
  await admin.auth().setCustomUserClaims(uid, {
    role: 'Supervisor',
    siteId: 'test-site-123',
    companyId: 'test-company-456',
  });
  
  const user = await admin.auth().getUser(uid);
  console.log('Custom claims:', user.customClaims);
}
```

#### C. User Management
- [ ] Master user creation flow tested
- [ ] QR code generation working
- [ ] User ID generation (auto-increment or UUID)
- [ ] PIN creation and validation
- [ ] Password strength requirements set

---

### 3. Storage ✅

#### A. Storage Buckets
- [ ] Default bucket configured
- [ ] Storage rules deployed
- [ ] File upload limits set
- [ ] Supported file types configured

**Storage Rules Template:**
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // User profile pictures
    match /profiles/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
                      request.auth.uid == userId &&
                      request.resource.size < 5 * 1024 * 1024; // 5MB limit
    }
    
    // Surveyor images
    match /surveyor-images/{siteId}/{allPaths=**} {
      allow read: if request.auth != null &&
                     request.auth.token.siteId == siteId;
      allow write: if request.auth != null &&
                      request.auth.token.role == 'Surveyor' &&
                      request.auth.token.siteId == siteId &&
                      request.resource.size < 10 * 1024 * 1024; // 10MB limit
    }
    
    // QR codes
    match /qr-codes/{userId}.png {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
                      request.auth.token.role in ['Master', 'Admin'];
    }
    
    // Activity photos
    match /activity-photos/{siteId}/{allPaths=**} {
      allow read: if request.auth != null &&
                     request.auth.token.siteId == siteId;
      allow write: if request.auth != null &&
                      request.auth.token.siteId == siteId &&
                      request.resource.size < 5 * 1024 * 1024; // 5MB limit
    }
  }
}
```

**Deploy:**
```bash
firebase deploy --only storage:rules
```

---

### 4. Environment Configuration ✅

#### A. Environment Variables
- [ ] `.env` file created from `env.example`
- [ ] Firebase API key set
- [ ] Firebase Auth Domain set
- [ ] Firebase Project ID set
- [ ] Firebase Storage Bucket set
- [ ] Firebase Messaging Sender ID set
- [ ] Firebase App ID set
- [ ] `.env` added to `.gitignore`

**Verify .env file:**
```bash
# Check all required variables are set
grep -E "EXPO_PUBLIC_FIREBASE" .env | wc -l
# Should return 6
```

#### B. App Configuration
- [ ] `config/firebase.ts` correctly configured
- [ ] Firebase initialized in app
- [ ] Connection tested in development
- [ ] Connection tested in production build

---

### 5. Monitoring & Analytics ✅

#### A. Performance Monitoring
- [ ] Firebase Performance Monitoring enabled
- [ ] Traces configured for critical paths
- [ ] Network request monitoring enabled

**Enable in console:** 
https://console.firebase.google.com/u/0/project/project-tracker-app-33cff/performance

#### B. Crashlytics (Recommended)
- [ ] Firebase Crashlytics integrated
- [ ] Test crash reporting
- [ ] Error boundaries sending errors to Crashlytics

#### C. Analytics
- [ ] Firebase Analytics enabled
- [ ] Key events tracked:
  - User login
  - Task creation
  - Request submission
  - QC completion
  - Scope approval

---

### 6. Usage Quotas & Billing ✅

#### A. Current Plan
- [ ] Verify current Firebase plan (Spark/Blaze)
- [ ] Set up billing if needed
- [ ] Configure budget alerts

**Check plan:** https://console.firebase.google.com/u/0/project/project-tracker-app-33cff/usage

#### B. Quotas to Monitor
- [ ] Firestore read operations
- [ ] Firestore write operations
- [ ] Storage usage
- [ ] Authentication users
- [ ] Cloud Functions invocations (if using)

#### C. Budget Alerts
- [ ] Set alert at 50% of budget
- [ ] Set alert at 80% of budget
- [ ] Set alert at 100% of budget

**Recommended Alerts:**
```
Read Operations: 50,000/day (free tier)
Write Operations: 20,000/day (free tier)
Storage: 1 GB (free tier)
```

---

### 7. Security Audit ✅

#### A. Access Control
- [ ] Only authorized users have Firebase console access
- [ ] Service account keys secured
- [ ] No API keys exposed in client code (use EXPO_PUBLIC_ prefix correctly)
- [ ] Admin SDK only used in secure backend

#### B. Data Protection
- [ ] Sensitive data encrypted in transit (HTTPS)
- [ ] Firestore rules prevent unauthorized access
- [ ] Storage rules prevent unauthorized uploads
- [ ] No PII in logs

#### C. Compliance
- [ ] GDPR considerations addressed
- [ ] Data retention policy defined
- [ ] User data deletion process implemented
- [ ] Privacy policy updated

---

### 8. Testing ✅

#### A. Functional Tests
- [ ] Master user creation flow
- [ ] User authentication (email/password)
- [ ] QR code login
- [ ] Task creation and assignment
- [ ] Activity progress submission
- [ ] Request workflows (all 6 types)
- [ ] QC inspection flow
- [ ] Surveyor workflow
- [ ] Offline queue sync

#### B. Security Tests
- [ ] Unauthorized read attempts blocked
- [ ] Unauthorized write attempts blocked
- [ ] Cross-site data access blocked
- [ ] Role-based access working correctly

#### C. Performance Tests
- [ ] Query response times < 1s
- [ ] Large list rendering smooth
- [ ] Pagination working
- [ ] Offline mode functional
- [ ] Query limits enforced

---

### 9. Backup & Disaster Recovery ✅

#### A. Automated Backups
- [ ] Firestore export scheduled
- [ ] Backup destination configured (Cloud Storage)
- [ ] Backup frequency set (daily recommended)

**Setup Scheduled Export:**
https://console.firebase.google.com/u/0/project/project-tracker-app-33cff/firestore/databases/-default-/backup

#### B. Manual Backup
- [ ] Export critical collections before major changes
- [ ] Test restoration process

**Export Command:**
```bash
gcloud firestore export gs://project-tracker-app-33cff.appspot.com/backups/$(date +%Y%m%d)
```

#### C. Recovery Plan
- [ ] Document recovery steps
- [ ] Test recovery from backup
- [ ] Define RTO (Recovery Time Objective)
- [ ] Define RPO (Recovery Point Objective)

---

### 10. Documentation ✅

#### A. Internal Documentation
- [ ] [FIREBASE-INDEXES.md](./FIREBASE-INDEXES.md) - All indexes documented
- [ ] [FIREBASE-SECURITY-RULES.md](./FIREBASE-SECURITY-RULES.md) - Security rules documented
- [ ] [USER-GUIDE.md](./USER-GUIDE.md) - User roles and workflows
- [ ] [TECHNICAL-GUIDE.md](./TECHNICAL-GUIDE.md) - System architecture
- [ ] [OPTIMIZATION-IMPROVEMENTS.md](./OPTIMIZATION-IMPROVEMENTS.md) - Performance utilities

#### B. Operations Documentation
- [ ] Deployment procedures documented
- [ ] Rollback procedures documented
- [ ] Incident response plan
- [ ] On-call rotation (if applicable)

---

## Launch Day Checklist

### 24 Hours Before Launch
- [ ] Final security rules review
- [ ] All indexes verified as "Enabled"
- [ ] Backup taken
- [ ] Performance monitoring enabled
- [ ] Budget alerts configured
- [ ] Team briefed on launch plan

### Launch Hour
- [ ] Monitor Firebase console for errors
- [ ] Watch Firestore usage metrics
- [ ] Monitor authentication success rates
- [ ] Check query performance
- [ ] Watch for security rule violations

### Post-Launch (First 24 Hours)
- [ ] Review Firestore read/write counts
- [ ] Check for any security rule violations
- [ ] Monitor error rates
- [ ] Review user feedback
- [ ] Check storage usage
- [ ] Verify all workflows functioning

---

## Maintenance Schedule

### Daily
- [ ] Check Firebase usage metrics
- [ ] Review error logs
- [ ] Monitor security rule violations

### Weekly
- [ ] Review query performance
- [ ] Check storage usage trends
- [ ] Review authentication issues
- [ ] Analyze slow queries

### Monthly
- [ ] Security rules audit
- [ ] Index performance review
- [ ] Cost optimization review
- [ ] Backup verification
- [ ] Documentation updates

---

## Emergency Contacts

**Firebase Support:**
- Console: https://firebase.google.com/support
- Status: https://status.firebase.google.com
- Community: https://firebase.google.com/community

**Internal Team:**
- Primary: [Your contact info]
- Backup: [Backup contact info]
- On-call: [On-call rotation]

---

## Common Issues & Solutions

### Issue 1: Permission Denied Errors
**Symptoms:** Users getting "permission denied" when accessing data

**Solutions:**
1. Check user's custom claims in Firebase Auth
2. Verify security rules are deployed
3. Check if user is authenticated
4. Verify siteId/companyId match

### Issue 2: Slow Queries
**Symptoms:** Queries taking > 3 seconds

**Solutions:**
1. Check if required index exists
2. Verify query limit is set
3. Use query planner to identify bottlenecks
4. Consider denormalizing data

### Issue 3: Authentication Issues
**Symptoms:** Users unable to log in

**Solutions:**
1. Check Firebase Auth service status
2. Verify user exists in Authentication
3. Check custom claims are set
4. Verify network connectivity

### Issue 4: Quota Exceeded
**Symptoms:** Operations failing due to quota limits

**Solutions:**
1. Check current usage in Firebase console
2. Identify source of excessive reads/writes
3. Implement caching
4. Add query limits
5. Upgrade to Blaze plan if needed

---

## Useful Commands

### Firebase CLI

```bash
# Login
firebase login

# List projects
firebase projects:list

# Use specific project
firebase use project-tracker-app-33cff

# Deploy everything
firebase deploy

# Deploy only Firestore rules
firebase deploy --only firestore:rules

# Deploy only Firestore indexes
firebase deploy --only firestore:indexes

# Deploy only Storage rules
firebase deploy --only storage:rules

# Export Firestore data
gcloud firestore export gs://bucket-name/path

# Import Firestore data
gcloud firestore import gs://bucket-name/path
```

---

## Next Steps

1. **Complete this checklist** item by item
2. **Test each section** thoroughly in development
3. **Deploy to staging** (if available) for final testing
4. **Schedule launch** when all items are checked
5. **Monitor closely** during first 48 hours post-launch

---

**Checklist Version:** 1.0  
**Last Updated:** December 18, 2025  
**Next Review:** Before launch
