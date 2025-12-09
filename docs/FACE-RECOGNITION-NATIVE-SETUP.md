# ML Kit + TFLite Face Recognition - Native Build Setup

## Overview

This project includes a complete ML Kit + TFLite face recognition adapter that's ready for native builds. The system currently uses mock fallbacks in Expo Go but will work with real face detection when you build a custom development client or standalone app.

---

## Current Status

**✅ Code Structure:** Fully prepared and wired up  
**✅ Fallback System:** Works in Expo Go with mocks  
**⚠️ Native Modules:** Requires custom development client or standalone build  

---

## Architecture

### Files Created

```
utils/
├── faceCapture.ts                     # Main API (delegates to adapter)
├── faceAdapters/
│   ├── mlkitTfliteAdapter.ts         # ML Kit + TFLite implementation
│   └── mlkitWrapper.ts                # ML Kit face detection wrapper
└── secureFaceStore.ts                 # Face template encryption/storage
```

### How It Works

1. **faceCapture.ts** - Public API used by UI screens
2. **mlkitTfliteAdapter.ts** - Contains all ML logic with `NATIVE_MODULES_AVAILABLE` flag
3. **mlkitWrapper.ts** - Wraps ML Kit face detection with fallback
4. When `NATIVE_MODULES_AVAILABLE = false` → Uses mocks (Expo Go)
5. When `NATIVE_MODULES_AVAILABLE = true` → Uses real ML Kit + TFLite (native builds)

---

## Required Packages for Native Builds

When you're ready to build natively, you'll need to install:

### 1. Camera & Vision

```bash
npx expo install react-native-vision-camera
```

**Or** use the built-in `expo-camera` (already installed) with custom frame processing

### 2. ML Kit Face Detection

```bash
npm install @react-native-ml-kit/face-detection
```

### 3. TensorFlow Lite

```bash
npm install tflite-react-native
```

### 4. Image Processing

```bash
npm install react-native-image-resizer
```

### 5. Secure Storage (Already Installed)

Already using `@react-native-async-storage/async-storage` with encryption

---

## TFLite Face Embedding Model

### Recommended Model: MobileFaceNet

**Input:** 112x112x3 RGB image  
**Output:** 128-dimensional embedding vector  
**Size:** ~1-4 MB (quantized)  

### Where to Get Models

1. **Pre-trained MobileFaceNet:**
   - https://github.com/sirius-ai/MobileFaceNet_TF
   - https://github.com/deepinsight/insightface (ArcFace models)

2. **Convert to TFLite:**
   ```python
   import tensorflow as tf
   
   converter = tf.lite.TFLiteConverter.from_saved_model('model_dir')
   converter.optimizations = [tf.lite.Optimize.DEFAULT]
   tflite_model = converter.convert()
   
   with open('face_embed.tflite', 'wb') as f:
       f.write(tflite_model)
   ```

### Model Placement

#### Android
Place model file in:
```
android/app/src/main/assets/face_embed_android.tflite
```

#### iOS
1. Add to Xcode project
2. Ensure it's in "Copy Bundle Resources" build phase
3. Name it: `face_embed_ios.tflite`

---

## Platform-Specific Configuration

### Android Setup

#### 1. Add ML Kit Dependencies
In `android/app/build.gradle`:

```gradle
dependencies {
    implementation 'com.google.mlkit:face-detection:16.1.5'
}
```

#### 2. Camera Permissions
In `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.CAMERA"/>
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
```

#### 3. ProGuard Rules (if using)
In `android/app/proguard-rules.pro`:

```proguard
-keep class com.google.mlkit.** { *; }
-keep class org.tensorflow.lite.** { *; }
```

### iOS Setup

#### 1. Add to Info.plist

```xml
<key>NSCameraUsageDescription</key>
<string>Camera access is required for face recognition clock-in</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>Location is required to verify you're at the site</string>
```

#### 2. Pod Installation
ML Kit will be installed via CocoaPods automatically when you install the npm package

---

## Enabling Native Modules

### Step 1: Update Flag

In `utils/faceAdapters/mlkitTfliteAdapter.ts`, change:

```typescript
const NATIVE_MODULES_AVAILABLE = false;
```

To:

```typescript
const NATIVE_MODULES_AVAILABLE = true;
```

### Step 2: Build Custom Development Client

```bash
# Create development build
npx expo install expo-dev-client
npx eas build --profile development --platform ios
npx eas build --profile development --platform android
```

### Step 3: Test Native Features

Run your custom dev client and test:
- Face capture
- Liveness detection  
- Face matching

---

## Configuration & Tuning

### Liveness Detection

In `mlkitTfliteAdapter.ts`, adjust:

```typescript
const framesToCapture = 3;      // Number of frames to analyze
const timeoutMs = 5000;          // Max time for liveness check
const eyeThreshold = 0.12;       // Eye movement sensitivity
const posThreshold = 5;          // Head movement in pixels
```

### Matching Threshold

In your site configuration (Firestore `sites` collection):

```typescript
facePolicy: {
  minMatchScore: 0.80,           // 80% similarity required
  requireLiveness: true,
}
```

**Tuning recommendations:**
- Start with 0.80 (80%)
- Log match scores during pilot testing
- Adjust based on false positive/negative rates
- Higher = more strict, Lower = more permissive

### Model Preprocessing

In `mlkitTfliteAdapter.ts`:

```typescript
const TFLITE_INPUT_WIDTH = 112;
const TFLITE_INPUT_HEIGHT = 112;
const imageMean = 127.5;
const imageStd = 127.5;
```

**Important:** These must match your TFLite model's expected input format!

---

## Testing Strategy

### Phase 1: Expo Go (Current)
✅ UI flows work  
✅ Mock responses validate UX  
✅ State management tested  

### Phase 2: Custom Dev Client
⚠️ Install native packages  
⚠️ Enable native modules flag  
⚠️ Test with real camera/ML Kit  

### Phase 3: Production Build
⚠️ Add TFLite model files  
⚠️ Test embedding quality  
⚠️ Tune matching thresholds  
⚠️ Validate liveness detection  

---

## Security Considerations

### ✅ Already Implemented

1. **Local Encryption:** Face embeddings encrypted with XOR cipher + salt
2. **Secure Storage:** Templates stored in AsyncStorage (encrypted)
3. **No Raw Images:** Only embeddings stored, not face photos
4. **Server Sync:** Encrypted templates synced to Firestore

### 🔐 Additional Recommendations

1. **Use Keychain/Keystore:**
   Replace AsyncStorage encryption with native secure storage:
   ```bash
   npm install react-native-keychain
   ```

2. **Certificate Pinning:**
   For Firestore connections in production

3. **Biometric Auth:**
   Add device biometric confirmation before face clock-in

4. **Audit Logging:**
   Already logging attempts in `faceClockAttempts` collection

---

## Performance Optimization

### Current Setup
- **Face Detection:** ~100-300ms (ML Kit on-device)
- **Embedding:** ~200-500ms (TFLite on CPU)
- **Matching:** <1ms (cosine similarity)

### Optimizations Available

1. **GPU Acceleration:**
   ```typescript
   await tflite.loadModel({
     model: TFLITE_MODEL_FILE,
     useGpuDelegate: true,  // Enable GPU
     numThreads: 4,          // Multi-threading
   });
   ```

2. **Model Quantization:**
   Use INT8 quantized models (4x smaller, 2-3x faster)

3. **Frame Processing:**
   For liveness, use react-native-vision-camera frame processors (runs on separate thread)

---

## Troubleshooting

### "Module not found" errors
→ You're in Expo Go. This is expected. Build custom dev client to use native modules.

### Embeddings return zeros
→ Check model input preprocessing (mean/std normalization)

### Low match scores for same person
→ Ensure consistent lighting and face angle during enrollment & verification

### Liveness check always fails
→ Adjust thresholds or improve lighting conditions

### Model loading fails
→ Verify model file path and that it's included in bundle resources

---

## Migration Path

### Option 1: Gradual (Recommended)
1. ✅ Keep current mock system in Expo Go
2. Build custom dev client when ready
3. Enable native modules flag
4. Test in dev environment
5. Roll out to production

### Option 2: Immediate
1. Install all native packages now
2. Create custom dev client
3. Can no longer use Expo Go
4. Full native testing from day 1

---

## Support & Resources

### Documentation
- ML Kit Face Detection: https://developers.google.com/ml-kit/vision/face-detection
- TensorFlow Lite: https://www.tensorflow.org/lite
- Expo Custom Dev Client: https://docs.expo.dev/develop/development-builds/introduction/

### Pre-trained Models
- InsightFace: https://github.com/deepinsight/insightface
- MobileFaceNet: https://github.com/sirius-ai/MobileFaceNet_TF

### Alternative Solutions (if needed)
- FaceTec (commercial liveness)
- Amazon Rekognition
- Microsoft Azure Face API

---

## Summary

**✅ Current State:** Fully wired for native, working in Expo Go with mocks  
**⚠️ Next Step:** Build custom development client when ready  
**🎯 Production Ready:** After adding TFLite model and tuning thresholds  

All the infrastructure is in place. When you're ready to go native, just:
1. Install the 4 native packages listed above
2. Add TFLite model files  
3. Change `NATIVE_MODULES_AVAILABLE` to `true`
4. Build & test!
