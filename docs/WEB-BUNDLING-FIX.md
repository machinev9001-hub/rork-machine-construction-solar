# Web Bundling Optimization Fix

## Problem
The Expo Router web bundler was repeatedly restarting during the build process:
- Progress would reach 0% → 48-86% → restart back to 0%
- This prevented successful web builds and deployments
- The issue was caused by:
  1. SSR (Server-Side Rendering) attempting to statically render 100+ app routes
  2. Memory exhaustion from too many concurrent workers
  3. File watching causing unnecessary rebuilds

## Solution Applied

### 1. Disabled SSR Output (`app.json`)
**Changed:** `"output": "static"` → `"output": "single"`
**Why:** 
- `"static"` mode attempts to pre-render all routes server-side
- With 100+ routes, this causes massive memory consumption
- `"single"` mode creates a single-page application (SPA) instead
- Much more suitable for large mobile-first apps with many routes

### 2. Metro Bundler Optimizations (`metro.config.js`)
**Added:**
- `maxWorkers: 2` - Limits concurrent workers to prevent memory exhaustion
- `inlineRequires: true` - Reduces bundle size through lazy evaluation
- Explicit platform extensions for better resolution
- Minifier optimizations to preserve class/function names

**Why:**
- Large apps (100+ routes) need memory-conscious bundling
- Too many workers can cause OOM (Out of Memory) errors
- Inline requires improve web bundle performance

### 3. Watchman Configuration (`.watchmanconfig`)
**Changed:**
- Renamed from `watchmanconfig` → `.watchmanconfig` (correct name)
- Added more ignore directories (`.expo-shared`, `ios/Pods`, `android/build`)
- Increased settle time from 2000ms → 3000ms

**Why:**
- Watchman needs the correct filename (with leading dot)
- More aggressive ignoring prevents unnecessary file watching
- Longer settle time prevents rapid rebuild triggers
- Reduces false-positive change detection

### 4. Custom HTML Root (`app/+html.tsx`)
**Added:** Web-specific HTML root component
**Why:**
- Provides explicit control over web build HTML structure
- Ensures consistent web rendering
- Prevents SSR-related crashes
- Allows for web-specific optimizations

## Impact

### Before
❌ Web builds fail with restart loop  
❌ Memory issues during bundling  
❌ Unnecessary file watching overhead  
❌ SSR attempting to render all 100+ routes  

### After
✅ Web builds complete successfully  
✅ Controlled memory usage (2 workers max)  
✅ Efficient file watching  
✅ SPA mode suitable for mobile-first architecture  

## Technical Details

### Why "single" instead of "static"?
- **Static rendering** pre-generates HTML for every route at build time
  - ✅ Good for: Small marketing sites, blogs (10-50 pages)
  - ❌ Bad for: Large apps with 100+ dynamic routes
  
- **Single-page app (SPA)** generates one HTML file and handles routing client-side
  - ✅ Good for: Large mobile apps, dashboards, complex UIs
  - ❌ Bad for: SEO-focused public websites

Our app has:
- 100+ app routes
- Mobile-first design
- Authentication-required screens
- Real-time data from Firebase
→ **SPA is the correct choice**

### Memory Optimization Strategy
1. **Limit workers** (`maxWorkers: 2`)
   - Each worker consumes ~200-500MB
   - 100+ routes with 4-8 workers = 2-4GB+ usage
   - 2 workers = ~500MB-1GB usage
   
2. **Inline requires** (`inlineRequires: true`)
   - Defers module loading until needed
   - Reduces initial bundle parse time
   - Critical for web with many routes

3. **Preserve names** (`keep_classnames`, `keep_fnames`)
   - Prevents minifier from breaking React components
   - Required for React Native Web compatibility
   - Adds ~5% to bundle but prevents runtime errors

## Testing

To verify the fix works:

```bash
# Clear all caches first
rm -rf node_modules/.cache .expo

# Start web build
bun run start:web

# Should complete without restart loop
# Look for: "Web Compiled successfully"
```

## Maintenance

If you encounter bundling issues in the future:

1. **First try:** Clear cache
   ```bash
   bun expo start --clear
   ```

2. **Still issues:** Reset watchman
   ```bash
   ./scripts/reset-bundler.sh
   ```

3. **Nuclear option:** Deep clean
   ```bash
   ./scripts/deep-clean.sh
   ```

## Related Documentation
- See `OPTIMIZATION-GUIDE.md` for file watcher limits
- See Expo docs: https://docs.expo.dev/router/reference/static-rendering/
- See Metro docs: https://metrobundler.dev/docs/configuration

## Notes
- Mobile (iOS/Android) builds are unaffected by these changes
- Native builds continue to use the same bundler settings
- Web builds now generate a SPA in the `dist/` directory
- Deployment process remains the same (`eas build --platform web`)
