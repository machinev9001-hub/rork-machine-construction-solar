# Face Clock-In System Implementation Guide

## Overview

This system implements a secure, offline-capable face recognition clock-in/out system with geo-fencing. The implementation uses the following stack:

- **Face Detection**: Google ML Kit (on-device)
- **Face Embedding**: TFLite model (MobileFaceNet or FaceNet)
- **Storage**: Encrypted local storage (AsyncStorage) + Firestore
- **Geo-fencing**: Haversine distance calculation with configurable radius
- **Liveness Detection**: Heuristic-based (blink detection via ML Kit landmarks)

## Current Status

### ✅ Completed Components

1. **Core Infrastructure**
   - ✅ Geo-fencing utils (`utils/geo.ts`)
   - ✅ Secure face template storage (`utils/secureFaceStore.ts`)
   - ✅ Face capture interface (`utils/faceCapture.ts`)
   - ✅ Site configuration support (lat/lon, radius, policy)

2. **UI Components**
   - ✅ Face Enrollment screen (`app/face-enrollment.tsx`)
   - ✅ Face Clock In/Out screen (`app/face-clock.tsx`)
   - ✅ Site Face Settings screen (`app/site-face-settings.tsx`)
   - ✅ Settings integration (navigation links)

3. **Database Schema**
   - ✅ `faceTemplates` collection (encrypted embeddings)
   - ✅ `faceClockAttempts` collection (clock-in/out records)
   - ✅ Site configuration fields (faceClockInEnabled, faceGeoCenter, faceGeoRadiusKm, facePolicy)

4. **Type Definitions**
   - ✅ All TypeScript types defined in `types/index.ts`

### 🚧 Pending Implementation

1. **ML Kit + TFLite Integration**
   - ⏳ Replace mock functions in `utils/faceCapture.ts`
   - ⏳ Add real camera capture
   - ⏳ Integrate ML Kit face detection
   - ⏳ Integrate TFLite embedding model
   - ⏳ Implement robust liveness check

2. **Testing**
   - ⏳ Test enrollment flow
   - ⏳ Test clock-in/out flow
   - ⏳ Test offline capability
   - ⏳ Test geo-fencing accuracy

## Architecture

### Data Flow

1. **Enrollment Flow**
   ```
   User → Face Enrollment Screen
   → Capture face image (camera)
   → Run liveness check (ML Kit)
   → Compute embedding (TFLite)
   → Encrypt embedding (XOR cipher)
   → Save to AsyncStorage + Firestore
   ```

2. **Clock-In Flow**
   ```
   User → Face Clock Screen
   → Check permissions (role, site config)
   → Get GPS location (expo-location)
   → Calculate distance (haversine)
   → Check if within radius
   → Capture face image
   → Run liveness check
   → Compute embedding
   → Get local template from secure store
   → Decrypt template
   → Compare embeddings (cosine similarity)
   → Check match threshold
   → Create clock attempt record
   → Save to Firestore (if online)
   ```

### Security Model

- **Face embeddings**: Encrypted using XOR cipher with random salt
- **Templates stored**: 
  - Locally: AsyncStorage (encrypted)
  - Server: Firestore (encrypted)
- **No raw images**: Never stored in plaintext
- **Geo-fencing**: Distance check before face processing
- **Role-based access**: Only Planner, Supervisor, HSE, HR

## ML Kit + TFLite Setup

### Requirements

To enable production face recognition, you need to integrate:

1. **Google ML Kit** (face detection + landmarks)
2. **TFLite** (face embedding model)
3. **Camera** (expo-camera or react-native-vision-camera)

### Recommended Packages

```bash
# Camera
npx expo install expo-camera

# ML Kit (requires custom native module or wrapper)
# Option 1: Use Firebase ML Kit
npm install @react-native-firebase/app @react-native-firebase/ml

# Option 2: Use community wrapper
npm install react-native-mlkit-face-detection

# TFLite
npm install tflite-react-native
# or
npm install @tensorflow/tfjs @tensorflow/tfjs-react-native

# Image processing
npx expo install expo-image-manipulator
```

### Model Setup

1. **Download a pre-trained face embedding model**
   - FaceNet: https://github.com/davidsandberg/facenet
   - MobileFaceNet: https://github.com/sirius-ai/MobileFaceNet_TF
   - Recommended: MobileFaceNet (smaller, faster)

2. **Convert to TFLite format** (if needed)
   ```python
   import tensorflow as tf
   
   converter = tf.lite.TFLiteConverter.from_saved_model('model_dir')
   converter.optimizations = [tf.lite.Optimize.DEFAULT]
   tflite_model = converter.convert()
   
   with open('face_embedding.tflite', 'wb') as f:
       f.write(tflite_model)
   ```

3. **Add model to app**
   - Android: `android/app/src/main/assets/face_embedding.tflite`
   - iOS: Add to Xcode project (Copy Bundle Resources)

### Platform Configuration

#### Android

1. **Add permissions** (`android/app/src/main/AndroidManifest.xml`):
   ```xml
   <uses-permission android:name="android.permission.CAMERA" />
   <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
   <uses-feature android:name="android.hardware.camera" />
   ```

2. **Add ML Kit dependency** (`android/app/build.gradle`):
   ```gradle
   dependencies {
       implementation 'com.google.mlkit:face-detection:16.1.5'
   }
   ```

#### iOS

1. **Add permissions** (`ios/YourApp/Info.plist`):
   ```xml
   <key>NSCameraUsageDescription</key>
   <string>We need camera access to capture your face for attendance</string>
   <key>NSLocationWhenInUseUsageDescription</key>
   <string>We need location to verify you are at the work site</string>
   ```

2. **Add ML Kit** (via CocoaPods):
   ```ruby
   # ios/Podfile
   pod 'GoogleMLKit/FaceDetection'
   ```

### Implementation Steps

#### 1. Replace Mock Functions in `utils/faceCapture.ts`

Current file has mock implementations for development. Replace with real SDK calls:

```typescript
// Example structure (adapt to your chosen SDKs)
import { Camera } from 'expo-camera';
import MLKit from 'react-native-mlkit-face-detection';
import TFLite from 'tflite-react-native';

export async function captureFaceImage(): Promise<ImageBlob | null> {
  // Use expo-camera or react-native-vision-camera
  // Return captured image
}

export async function runLivenessCheck(image: ImageBlob): Promise<LivenessResult> {
  // Use ML Kit to detect landmarks
  // Check for blink, head movement
  // Return liveness result
}

export async function computeEmbedding(image: ImageBlob): Promise<EmbeddingResult> {
  // Preprocess image (resize, normalize)
  // Run TFLite model
  // Return embedding vector
}
```

#### 2. Test Integration

1. **Test face detection**:
   ```typescript
   const faces = await MLKit.detectFacesFromFile(imageUri);
   console.log('Detected faces:', faces.length);
   ```

2. **Test embedding generation**:
   ```typescript
   const embedding = await computeEmbedding(image);
   console.log('Embedding length:', embedding.embedding.length);
   ```

3. **Test end-to-end flow**:
   - Enroll a user
   - Verify template is saved (encrypted)
   - Clock in with same user
   - Verify match score > threshold

## Configuration

### Site Settings

Masters/Planners can configure face clock-in per site:

1. Navigate to: **Settings → Face Clock-In Settings**
2. Enable face clock-in
3. Set geo-fence:
   - **Latitude/Longitude**: Site center coordinates
   - **Radius**: Maximum allowed distance (km)
4. Set face policy:
   - **Min Match Score**: 0.80 (80%) recommended
   - **Require Liveness**: Enable for better security

### Role Permissions

Only these roles can use face clock-in:
- Planner
- Supervisor
- HSE
- HR

## User Workflow

### First Time Setup (Enrollment)

1. User navigates to **Settings → Face Enrollment**
2. Follow on-screen instructions:
   - Ensure good lighting
   - Remove glasses/caps
   - Look directly at camera
   - Keep neutral expression
3. System captures face, checks liveness, generates embedding
4. Encrypted template saved locally and synced to server
5. User can now use face clock-in

### Daily Usage (Clock In/Out)

1. User navigates to **Settings → Face Clock In/Out**
2. Tap **Clock In** or **Clock Out** button
3. System automatically:
   - Checks GPS location
   - Verifies user is within allowed radius
   - Captures face
   - Checks liveness
   - Matches against enrolled template
   - Records attendance
4. User sees success/failure message

## Database Collections

### `faceTemplates`

Stores encrypted face embeddings:

```typescript
{
  id: string;
  userId: string;
  userName: string;
  encryptedEmbedding: string;  // Base64 encrypted
  encryptionSalt: string;       // Random salt
  enrolledAt: timestamp;
  enrolledBy: string;
  version: number;              // Template version
  isActive: boolean;
  masterAccountId: string;
  companyId?: string;
  siteId?: string;
  createdAt: timestamp;
  updatedAt?: timestamp;
}
```

### `faceClockAttempts`

Stores all clock-in/out attempts (success and failures):

```typescript
{
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  siteId: string;
  siteName?: string;
  companyId?: string;
  masterAccountId: string;
  eventType: 'clock-in' | 'clock-out';
  method: 'face';
  timestampClient: string;      // ISO timestamp from device
  timestampServer?: timestamp;  // Server timestamp
  gps: {
    latitude: number;
    longitude: number;
    accuracy: number;           // Meters
  };
  distanceFromSiteKm: number;
  matchScore: number | null;    // 0-1, null if not compared
  livenessPassed: boolean;
  verificationState: 'verified' | 'rejected' | 'pending';
  rejectionReason?: string;     // 'out_of_zone' | 'liveness_failed' | 'face_mismatch' | 'gps_accuracy_poor' | 'no_template'
  deviceInfo: {
    deviceId: string;
    appVersion: string;
    platform: string;
  };
  offlineMode: boolean;
  syncedToServer: boolean;
  notes?: string;
  createdAt: timestamp;
  updatedAt?: timestamp;
}
```

### Required Indexes

See `docs/FACE-CLOCK-INDEXES.md` for Firestore indexes.

## Troubleshooting

### "Face capture cancelled"
- User cancelled camera permission
- Camera not available on device

### "Liveness check failed"
- Poor lighting conditions
- Photo/video replay attack (if using basic liveness)
- User not moving during capture

### "Face did not match enrolled template"
- Different lighting conditions
- Different angle/pose
- Template may need re-enrollment
- Threshold too high (adjust in site settings)

### "Out of allowed zone"
- User is outside geo-fence radius
- GPS accuracy too poor
- Site coordinates not configured correctly

### "No face enrollment found"
- User has not enrolled yet
- Template was deleted or corrupted
- Offline and template not cached

## Performance Optimization

### On-Device Processing
- Use TFLite for fast embedding generation
- Run ML Kit on separate thread to avoid UI blocking
- Use GPU acceleration if available

### Network Optimization
- Cache templates locally for offline use
- Queue failed attempts for sync when online
- Compress images before upload (if needed)

### Battery Optimization
- Use camera in burst mode only when needed
- Close camera immediately after capture
- Limit GPS polling to clock-in events only

## Security Considerations

### Data Protection
- ✅ Face embeddings encrypted at rest
- ✅ No raw images stored
- ✅ Encrypted transmission to server
- ✅ Role-based access control

### Anti-Spoofing
- ✅ Basic liveness check (blink detection)
- ⚠️ Consider commercial SDK for production:
  - FaceTec ZoOm
  - iProov
  - Onfido

### Privacy Compliance
- ✅ User consent required for enrollment
- ✅ Data retention policy documented
- ✅ User can delete their template
- ⚠️ Review local regulations (POPIA, GDPR, etc.)

## Testing Checklist

- [ ] Enrollment works with good lighting
- [ ] Enrollment fails with poor lighting
- [ ] Enrollment detects liveness correctly
- [ ] Clock-in succeeds within radius
- [ ] Clock-in fails outside radius
- [ ] Clock-in fails with wrong face
- [ ] Clock-in works offline (with cached template)
- [ ] Clock-out works correctly
- [ ] Templates sync to server
- [ ] Attempts sync to server
- [ ] Multiple users can enroll on same device
- [ ] User can re-enroll to update template

## Next Steps

1. **Integrate ML Kit + TFLite**
   - Follow setup instructions above
   - Replace mock functions in `utils/faceCapture.ts`
   - Test thoroughly

2. **Enhance Liveness Detection**
   - Consider commercial SDK
   - Or implement challenge-response (blink, turn head)

3. **Add Reporting**
   - Dashboard for clock-in/out records
   - Export to CSV/Excel
   - Visual analytics

4. **Optimize Performance**
   - Profile camera/ML operations
   - Add loading states
   - Improve error messages

## References

- [Google ML Kit Face Detection](https://developers.google.com/ml-kit/vision/face-detection)
- [TensorFlow Lite](https://www.tensorflow.org/lite)
- [FaceNet Paper](https://arxiv.org/abs/1503.03832)
- [MobileFaceNet Paper](https://arxiv.org/abs/1804.07573)
- [Expo Camera](https://docs.expo.dev/versions/latest/sdk/camera/)
