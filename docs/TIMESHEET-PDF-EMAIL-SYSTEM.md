# Timesheet PDF & Email System

## Overview
This system generates PDF timesheets for plant assets and sends them via email. It supports both bulk generation (all subcontractor assets) and selective generation (specific assets).

## Current Implementation Status

### ✅ Completed (Development)
- PDF generation using `react-native-pdf` and `react-native-html-to-pdf`
- UI components for report generation modal
- Bulk vs selective export modes
- PDF preview functionality
- Timesheet data aggregation logic
- Email delivery workflow structure
- Error handling and loading states

### 🚧 Requires Production Setup
1. Email service integration
2. Firebase storage for PDF files
3. Backend email API (optional but recommended)
4. Firebase indexes for queries
5. Environment variables configuration

---

## Production Setup Guide

### Step 1: Install Required Packages

```bash
# PDF generation (already installed if working in dev)
bun expo install react-native-pdf react-native-html-to-pdf

# File system (should already be installed)
bun expo install expo-file-system

# Firebase storage (if not already installed)
bun expo install firebase/storage
```

### Step 2: Email Service Setup

You have **two options** for sending emails:

#### Option A: Backend Email API (Recommended)
Use a backend service with email capability. This is more secure and reliable.

**Setup Steps:**
1. Create a Cloud Function or API endpoint
2. Use an email service provider:
   - **SendGrid** (recommended, 100 free emails/day)
   - **Resend** (100 free emails/day, modern API)
   - **AWS SES** (cheap for volume)
   - **Mailgun** (good free tier)

**Example Backend Function (Firebase Cloud Functions):**

```typescript
// functions/src/sendTimesheetEmail.ts
import * as functions from 'firebase-functions';
import * as sgMail from '@sendgrid/mail';

sgMail.setApiKey(functions.config().sendgrid.key);

export const sendTimesheetEmail = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { to, subject, body, pdfUrl } = data;

  const msg = {
    to,
    from: 'noreply@yourcompany.com', // Your verified sender
    subject,
    html: body,
    attachments: [
      {
        filename: 'timesheet.pdf',
        content: pdfUrl, // or base64 content
        type: 'application/pdf',
      }
    ]
  };

  try {
    await sgMail.send(msg);
    return { success: true };
  } catch (error) {
    console.error('Email send error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send email');
  }
});
```

**SendGrid Setup:**
1. Sign up at https://sendgrid.com
2. Verify your sender email/domain
3. Create API key with "Mail Send" permissions
4. Set in Firebase config:
   ```bash
   firebase functions:config:set sendgrid.key="YOUR_API_KEY"
   ```

**Resend Setup (Alternative):**
1. Sign up at https://resend.com
2. Verify domain
3. Get API key
4. Similar implementation to SendGrid

#### Option B: Direct Client-Side Email (Not Recommended)
Use `expo-mail-composer` for basic email functionality. This opens the user's email client.

**Limitations:**
- Requires user to have email app configured
- User must manually send
- No automation
- PDF must be stored locally first

**Only use this for:**
- Quick demos
- Personal use apps
- When backend setup is not possible

### Step 3: Firebase Storage Setup

PDFs need to be temporarily stored so they can be attached to emails.

**Configure Storage Rules:**

```javascript
// firebase storage.rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Timesheet PDFs - temporary storage
    match /timesheets/{masterAccountId}/{fileName} {
      allow write: if request.auth != null 
                   && request.auth.token.masterAccountId == masterAccountId;
      allow read: if request.auth != null 
                  && request.auth.token.masterAccountId == masterAccountId;
    }
  }
}
```

**Enable Storage in Firebase Console:**
1. Go to Firebase Console → Storage
2. Click "Get Started"
3. Choose security rules (use above rules)
4. Select storage location (closest to your users)

### Step 4: Environment Variables

Create/update your `.env` file:

```bash
# Email Service Configuration
EMAIL_SERVICE_PROVIDER=sendgrid # or 'resend', 'ses', etc.
SENDGRID_API_KEY=your_api_key_here
FROM_EMAIL=noreply@yourcompany.com

# Or for Resend
RESEND_API_KEY=your_resend_key_here

# Firebase Storage
FIREBASE_STORAGE_BUCKET=your-project.appspot.com

# Backend API (if using Option A)
BACKEND_EMAIL_API_URL=https://your-region-your-project.cloudfunctions.net/sendTimesheetEmail
```

### Step 5: Firebase Indexes

Add required indexes for timesheet queries:

```json
{
  "indexes": [
    {
      "collectionGroup": "verifiedTimesheets",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "masterAccountId", "order": "ASCENDING" },
        { "fieldPath": "siteId", "order": "ASCENDING" },
        { "fieldPath": "ownerId", "order": "ASCENDING" },
        { "fieldPath": "verifiedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "verifiedTimesheets",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "masterAccountId", "order": "ASCENDING" },
        { "fieldPath": "siteId", "order": "ASCENDING" },
        { "fieldPath": "assetId", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "DESCENDING" }
      ]
    }
  ]
}
```

**Apply indexes:**
```bash
firebase deploy --only firestore:indexes
```

Or manually create in Firebase Console → Firestore → Indexes

---

## Implementation Files

### Files Modified/Created:
1. `components/accounts/ReportGenerationModal.tsx` - UI for generating reports
2. `utils/timesheetPdfGenerator.ts` - PDF generation logic
3. `utils/agreedTimesheetManager.ts` - Agreement workflow
4. `components/accounts/AgreedHoursModal.tsx` - Agreement UI

### Key Functions:

**PDF Generation:**
```typescript
// utils/timesheetPdfGenerator.ts
generateTimesheetPDF(timesheets, options) 
  → Returns PDF file URI
```

**Email Sending (needs backend):**
```typescript
// This function needs to call your backend
async function sendTimesheetEmail(pdfUri: string, recipientEmail: string) {
  // Upload PDF to Firebase Storage
  const pdfUrl = await uploadPDFToStorage(pdfUri);
  
  // Call backend email function
  const sendEmail = httpsCallable(functions, 'sendTimesheetEmail');
  await sendEmail({
    to: recipientEmail,
    subject: 'Timesheet Report',
    body: '<p>Please find attached timesheet report.</p>',
    pdfUrl: pdfUrl
  });
}
```

---

## Workflow

### Bulk Export (All Subcontractor Assets)
1. Admin clicks "Generate Report" without selecting assets
2. System fetches all verified timesheets for subcontractor
3. Generates single PDF with all assets
4. Uploads to Firebase Storage
5. Sends email with PDF attachment
6. Cleans up temporary files

### Selective Export (Selected Assets Only)
1. Admin selects specific assets using checkboxes
2. Clicks "Generate Selected" option
3. System fetches timesheets for selected assets only
4. Generates PDF with filtered data
5. Same upload/email/cleanup process

### Agreement Workflow
1. Admin reviews timesheet data
2. Makes any necessary adjustments
3. Marks as "agreed" in system
4. System creates `agreedTimesheet` record
5. Once all parties agree, admin can "Approve & Send"
6. PDF is generated and emailed

---

## Testing

### Development Testing (Without Production Setup)
- PDF generation works locally
- Preview functionality works
- Exports show "Email would be sent to..." message
- Use `__DEV__` flag to skip actual email sending

### Production Testing Checklist
- [ ] Verify email service credentials
- [ ] Test email delivery
- [ ] Verify PDF attachments work
- [ ] Test bulk generation (10+ assets)
- [ ] Test selective generation (1-3 assets)
- [ ] Verify Firebase Storage uploads
- [ ] Test error handling (no internet, failed email, etc.)
- [ ] Verify storage cleanup after sending

---

## Cost Considerations

### SendGrid (Recommended for small-medium volume)
- **Free Tier:** 100 emails/day
- **Paid:** Starts at $15/month for 40,000 emails

### Resend (Recommended for developers)
- **Free Tier:** 100 emails/day
- **Paid:** Starts at $20/month for 50,000 emails

### Firebase Storage
- **Free Tier:** 5GB storage, 1GB/day downloads
- **Paid:** $0.026/GB storage, $0.12/GB downloads
- **Note:** Delete PDFs after sending to minimize costs

### Firebase Cloud Functions
- **Free Tier:** 2M invocations/month
- **Paid:** $0.40 per million invocations
- **Note:** Email sending should fit comfortably in free tier

---

## Security Considerations

### Best Practices:
1. **Never expose API keys in client code**
   - Use backend functions
   - Store keys in Firebase Functions config
   
2. **Validate permissions**
   - Check user roles before generating reports
   - Verify user has access to requested data
   
3. **Sanitize email recipients**
   - Validate email format
   - Prevent email injection attacks
   
4. **Limit file sizes**
   - Set max PDF size (e.g., 10MB)
   - Paginate large reports
   
5. **Temporary storage only**
   - Delete PDFs after 24 hours
   - Use signed URLs with expiration

---

## Troubleshooting

### "Email failed to send"
- Check API key is correct
- Verify sender email is verified in SendGrid/Resend
- Check function logs in Firebase Console
- Verify user permissions

### "PDF generation failed"
- Check if data exists for selected period
- Verify file system permissions
- Check memory limits (large reports)

### "Storage upload failed"
- Verify Firebase Storage is enabled
- Check storage rules
- Verify authentication token

### "Index not found"
- Deploy firestore indexes
- Wait 5-10 minutes for indexes to build
- Check Firebase Console → Firestore → Indexes

---

## Future Enhancements

### Potential Improvements:
1. **Batch email sending** for multiple subcontractors
2. **Scheduled reports** (weekly/monthly automatic sending)
3. **Email templates** with company branding
4. **PDF customization** (logo, colors, format)
5. **Email tracking** (delivery, opens, clicks)
6. **Multi-language support** for PDF content
7. **Digital signatures** for timesheet approval
8. **Cloud storage integration** (Google Drive, Dropbox)

---

## Support

For issues with:
- **Email delivery:** Check email service provider docs
- **PDF generation:** Check react-native-html-to-pdf issues
- **Firebase:** Check Firebase Console logs
- **App functionality:** Check app logs and error messages

## Quick Start Commands

```bash
# Install dependencies
bun expo install react-native-pdf react-native-html-to-pdf

# Deploy Firebase indexes
firebase deploy --only firestore:indexes

# Set Firebase function config (SendGrid)
firebase functions:config:set sendgrid.key="YOUR_KEY"

# Deploy backend functions
firebase deploy --only functions
```

---

**Status:** Development complete, awaiting production setup (email service + backend integration)
