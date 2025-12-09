# iOS Testing Instructions

## For iOS Testers

### Step 1: Install Expo Go
1. Open the **App Store** on your iPhone/iPad
2. Search for **"Expo Go"**
3. Download and install the app
4. Open Expo Go

### Step 2: Access the App

#### Option A: Scan QR Code (Recommended)
1. Open the **Camera app** on your iPhone
2. Point the camera at the QR code provided by the admin
3. A notification will appear at the top of your screen
4. Tap the notification
5. The app will open in Expo Go automatically

**Note:** If you don't see a notification:
- Make sure Camera access is enabled in Settings
- Try moving the camera closer or further from the QR code
- Ensure good lighting

#### Option B: Manual Link Entry
If the QR code doesn't work, ask the admin for the **exp://** link format:
1. Copy the exp:// link (format: `exp://xxx.xxx.xxx.xxx:8081`)
2. Open Expo Go app
3. Tap on "Enter URL manually" at the bottom
4. Paste the link
5. Press "Connect"

### Important Notes

❌ **DO NOT** use web browser links like:
- https://project-management-tracker.rork.app
- These are for web preview only, not iOS testing

✅ **DO** use:
- QR codes (easiest method)
- exp:// links provided by admin

### Troubleshooting

**Problem: "Couldn't load app"**
- Make sure you're on the same WiFi network as the developer
- Or ask developer for a published/production build link

**Problem: QR code opens browser instead of Expo Go**
- Use the iPhone Camera app (not QR scanner apps)
- Make sure Expo Go is installed before scanning

**Problem: App crashes or won't load**
- Close Expo Go completely and reopen
- Make sure you have the latest version of Expo Go from App Store
- Check your internet connection

### Need Help?
Contact the project administrator if you continue to have issues.

---

## For Admin/Developer

### Sharing the App with iOS Testers

1. **During Local Development (Same Network):**
   - Share the QR code from your terminal/Rork interface
   - Testers must be on the same WiFi network
   - Use: `exp://YOUR_LOCAL_IP:8081`

2. **For Remote Testing (Published Build):**
   - Publish your app: `npx expo publish`
   - Share the QR code or exp:// link from Expo
   - Format: `exp://exp.host/@username/project-slug`
   - Testers can be on any network

3. **Production Testing:**
   - Build with EAS: `eas build --platform ios`
   - Distribute via TestFlight or direct IPA installation

### Current Project Info
- Project ID: `8grw9nv9trrk505brxc8u`
- Web Preview: https://project-management-tracker.rork.app (for web browsers only)

### Generating QR Code for Testers

You can generate a QR code using your QRCodeGenerator component:
```typescript
import QRCodeGenerator from '@/components/QRCodeGenerator';

// In your component:
<QRCodeGenerator 
  value="exp://YOUR_IP_OR_PUBLISHED_URL:8081"
  size={256}
/>
```

Or use the Expo dashboard to get the QR code after publishing.
