# Face Clock-In System - Complete Implementation Guide

## Overview

The Face Clock-In System enables secure, location-verified attendance tracking using facial recognition. Users can clock in and out by taking a selfie within a geofenced area, with liveness detection to prevent spoofing.

## Architecture

### System Components

1. **Face Enrollment** (`app/face-enrollment.tsx`)
   - Users enroll their face for recognition
   - Captures face image, runs liveness check
   - Generates facial embedding and encrypts it
   - Stores template locally (AsyncStorage) and remotely (Firestore)

2. **Face Clock In/Out** (`app/face-clock.tsx`)
   - Main attendance tracking interface
   - Verifies user location using GPS and geofencing
   - Captures face and matches against enrolled template
   - Records attendance attempts (successful and failed)

3. **Site Configuration** (`app/site-face-settings.tsx`)
   - Master/Planner interface to configure feature
   - Set geofence center coordinates and radius
   - Configure face matching thresholds and policies

4. **Utilities**
   - `utils/geo.ts` - Haversine distance calculations
   - `utils/secureFaceStore.ts` - Encrypted template storage
   - `utils/faceCapture.ts` - Face capture and matching (currently mock for dev)

### Data Flow

```
┌─────────────┐
│   Enrollment │
└──────┬───────┘
       │
       ├─► Capture Face Image
       ├─► Run Liveness Check
       ├─► Generate Embedding
       ├─► Encrypt Embedding
       ├─► Store Locally (AsyncStorage)
       └─► Store Remotely (Firestore)

┌─────────────┐
│  Clock In   │
└──────┬───────┘
       │
       ├─► Check User Role (Planner, Supervisor, HSE, HR)
       ├─► Verify Feature Enabled
       ├─► Get GPS Location
       ├─► Calculate Distance (Haversine)
       ├─► Check Within Radius
       ├─► Capture Face Image
       ├─► Run Liveness Check (if required)
       ├─► Get Stored Template
       ├─► Generate Current Embedding
       ├─► Compare Embeddings (Cosine Similarity)
       ├─► Verify Match Score >= Threshold
       ├─► Record Attempt
       └─► Show Success/Failure
```

## Role Restrictions

Face clock-in is restricted to these roles:
- **Planner** - Can enroll, clock in/out, and configure settings
- **Supervisor** - Can enroll and clock in/out
- **HSE** - Can enroll and clock in/out
- **HR** - Can enroll and clock in/out
- **master** - Can configure settings (not for clock in/out)

## Configuration

### Site Setup (Master/Planner)

1. Navigate to site settings
2. Go to Face Clock-In Settings page
3. Enable face clock-in feature
4. Set geofence:
   - Enter latitude/longitude OR
   - Use "Current Location" button
   - Set allowed radius in kilometers
5. Configure policy:
   - Set minimum match score (0-100%)
   - Toggle liveness requirement
6. Save settings

### Geofencing

The system uses the **Haversine formula** to calculate distance between:
- User's current GPS location
- Site's configured center point

```typescript
// Example: Site center at -25.7460, 28.1880 with 0.5km radius
// User at -25.7470, 28.1890 is ~0.15km away → ALLOWED
// User at -25.7560, 28.1980 is ~1.2km away → REJECTED
```

### Face Matching Threshold

- **80%** (default) - Balanced security/usability
- **70%** - More lenient, faster enrollment
- **90%** - High security, may require re-enrollment

## User Workflow

### First Time Setup

1. User logs in with their credentials
2. Navigate to Face Enrollment (from settings or onboarding)
3. Follow instructions:
   - Ensure good lighting
   - Remove glasses/caps if possible
   - Look directly at camera
   - Keep neutral expression
4. Tap "Start Enrollment"
5. System captures face, checks liveness, generates embedding
6. Enrollment complete - user can now use face clock-in

### Daily Clock In

1. Arrive at site (within geofenced area)
2. Open app and navigate to Face Clock In
3. Tap "Clock In" button
4. System checks:
   - ✓ User has required role
   - ✓ Feature enabled for site
   - ✓ GPS location acquired
   - ✓ Distance within allowed radius
   - ✓ Face captured successfully
   - ✓ Liveness passed (if required)
   - ✓ Face matches enrolled template
5. Success message shown with match score and distance

### Daily Clock Out

Same process as Clock In, but tap "Clock Out" button.

## Offline Support

### Enrollment Offline
- Face template stored in AsyncStorage immediately
- Syncs to Firestore when online
- No online connection required for enrollment

### Clock In/Out Offline

Currently, online connection is **recommended** because:
- GPS accuracy verification
- Real-time template sync
- Immediate server-side logging

If offline:
- Local template must exist (from previous online session)
- Attempt recorded locally
- Will sync when device comes online

## Security Features

### Template Storage
- Embeddings encrypted using XOR cipher with random salt
- Salt stored separately from encrypted data
- Templates stored in:
  - Local: AsyncStorage (device-only)
  - Remote: Firestore (encrypted, per-user access)

### Liveness Detection
- Prevents photo/video spoofing
- Can be disabled for testing but should remain enabled in production
- Currently mock implementation - integrate real SDK in production

### GPS Verification
- Haversine distance calculation (accurate to ~0.5% error)
- Accuracy threshold can be configured
- Failed attempts logged with GPS coordinates for audit

### Audit Trail
All attempts (successful and failed) logged with:
- User ID, name, role
- Site ID, site name
- Event type (clock-in/clock-out)
- GPS coordinates and accuracy
- Distance from site center
- Match score
- Liveness result
- Verification state (verified/rejected/pending)
- Rejection reason (if failed)
- Device info
- Timestamp (client and server)

## Database Structure

### Sites Collection
```typescript
{
  id: string;
  name: string;
  faceClockInEnabled: boolean;
  faceGeoCenter: {
    latitude: number;
    longitude: number;
  };
  faceGeoRadiusKm: number;
  facePolicy: {
    minMatchScore: number; // 0.0 to 1.0
    requireLiveness: boolean;
    allowOfflineMatch: boolean;
  };
  // ... other site fields
}
```

### faceTemplates Collection
```typescript
{
  id: string;
  userId: string;
  userName: string;
  encryptedEmbedding: string;  // Base64 encoded
  encryptionSalt: string;      // Base64 encoded
  enrolledAt: Timestamp;
  enrolledBy: string;
  version: number;
  isActive: boolean;
  masterAccountId: string;
  companyId?: string;
  siteId?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
```

### faceClockAttempts Collection
```typescript
{
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  siteId: string;
  siteName: string;
  companyId?: string;
  masterAccountId: string;
  eventType: 'clock-in' | 'clock-out';
  method: 'face';
  timestampClient: string;      // ISO string
  timestampServer: Timestamp;
  gps: {
    latitude: number;
    longitude: number;
    accuracy: number;           // meters
  };
  distanceFromSiteKm: number;
  matchScore: number | null;    // 0.0 to 1.0
  livenessPassed: boolean;
  verificationState: 'verified' | 'rejected' | 'pending';
  rejectionReason?: 'out_of_zone' | 'liveness_failed' | 'face_mismatch' | 'gps_accuracy_poor' | 'no_template';
  deviceInfo: {
    deviceId: string;
    appVersion: string;
    platform: string;
  };
  offlineMode: boolean;
  syncedToServer: boolean;
  notes?: string;
  createdAt: Timestamp;
}
```

## Error Handling

### Common Errors and Solutions

| Error | Reason | Solution |
|-------|--------|----------|
| "You don't have permission" | User role not in allowed list | Assign Planner/Supervisor/HSE/HR role |
| "Face clock-in not enabled" | Feature disabled for site | Enable in site face settings |
| "Site geofence not configured" | No coordinates/radius set | Configure in site face settings |
| "Could not get location" | GPS permissions denied | Grant location permission |
| "You are outside the allowed radius" | User too far from site | Move closer to site center |
| "Liveness check failed" | Face not detected as real | Improve lighting, try again |
| "No face enrollment found" | User never enrolled | Complete face enrollment first |
| "Face did not match template" | Match score below threshold | Re-enroll or lower threshold |

## Production Considerations

### Replace Mock Implementations

Before production, replace mock face capture functions in `utils/faceCapture.ts`:

```typescript
// Replace these functions with real SDK implementations:
- captureFaceImage()
- runLivenessCheck()
- computeEmbedding()
```

Recommended SDKs:
- **Face SDK**: FaceSDK, AWS Rekognition, Azure Face API
- **Liveness**: iProov, Onfido, Jumio

### Privacy & Compliance

- ✅ Obtain user consent before enrollment
- ✅ Provide privacy policy explaining face data usage
- ✅ Allow users to delete their face template
- ✅ Comply with GDPR, CCPA, BIPA, and local biometric laws
- ✅ Encrypt face templates at rest and in transit
- ✅ Implement data retention policy
- ✅ Provide audit trail access for users

### Performance Optimization

- Use native modules for face detection (off JS thread)
- Cache templates locally to avoid Firestore reads
- Batch clock attempt syncs for offline mode
- Use Firebase Functions for server-side verification
- Implement retry logic with exponential backoff

### Testing

1. **Unit Tests** - Test haversine calculation, encryption, matching logic
2. **Integration Tests** - Test full enrollment and clock-in flows
3. **E2E Tests** - Test with real devices at various distances
4. **Security Tests** - Attempt spoofing with photos, videos, masks
5. **Performance Tests** - Measure time from capture to result
6. **Offline Tests** - Test enrollment and clock-in without internet

## Troubleshooting

### Enrollment Issues

**Problem**: Liveness check always fails
- Check lighting conditions
- Ensure camera permissions granted
- Verify liveness SDK configured correctly

**Problem**: Embedding generation takes too long
- Move computation off UI thread
- Use native module instead of JS
- Reduce embedding size if possible

### Clock In Issues

**Problem**: GPS location not accurate
- Request high accuracy location
- Wait for GPS to stabilize
- Increase allowed radius temporarily

**Problem**: Face match score too low
- Re-enroll with better lighting
- Lower match threshold in site settings
- Ensure same person enrolling and clocking in

**Problem**: Feature not appearing
- Check user role
- Verify feature enabled in site settings
- Check React Native navigation configuration

### Sync Issues

**Problem**: Templates not syncing to Firestore
- Check internet connection
- Verify Firebase permissions
- Check Firestore rules allow write

**Problem**: Clock attempts not appearing in reports
- Check Firebase indexes created
- Verify query permissions
- Check timestamp field format

## Future Enhancements

- [ ] Multi-face enrollment (different lighting, angles)
- [ ] Face aging detection (prompt re-enrollment after X months)
- [ ] Admin dashboard for live clock-in monitoring
- [ ] Export attendance reports (CSV, Excel)
- [ ] Integration with payroll systems
- [ ] Push notifications for clock reminders
- [ ] Beacon-based indoor location for large sites
- [ ] Voice confirmation ("I'm clocking in")
- [ ] Accessibility features (alternative auth methods)

## Support

For issues or questions:
1. Check this documentation first
2. Review error messages and logs
3. Verify Firebase indexes created
4. Check user permissions and roles
5. Test with mock data in development mode

## References

- [Haversine Formula](https://en.wikipedia.org/wiki/Haversine_formula)
- [Firebase Security Rules](https://firebase.google.com/docs/firestore/security/rules-conditions)
- [Expo Location API](https://docs.expo.dev/versions/latest/sdk/location/)
- [React Native AsyncStorage](https://react-native-async-storage.github.io/async-storage/)
