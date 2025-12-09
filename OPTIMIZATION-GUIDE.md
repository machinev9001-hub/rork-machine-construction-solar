# Optimization Guide - File Watcher Limits

## Problem
Your app has many files (200+ files) which can exceed system file watcher limits, causing:
- Slow hot reload
- Metro bundler issues
- "ENOSPC: System limit for number of file watchers reached" errors

## Solutions Applied

### 1. Enhanced .gitignore
Added aggressive caching and build artifact exclusions:
- `node_modules/.cache/` - Metro cache
- `.cache/` - General cache
- `coverage/` - Test coverage
- `*.log` - Log files

### 2. Watchman Configuration (.watchmanconfig)
Created `.watchmanconfig` to exclude unnecessary directories from watching:
- `node_modules`, `.git`, `.expo`, `dist`, `web-build`
- `coverage`, `__tests__/coverage`, `.cache`
- `docs` folder (comment out if needed)

### 3. Cleanup Scripts
Created 3 scripts in `scripts/` folder:

**clean-cache.sh** - Quick cache cleanup
```bash
chmod +x scripts/clean-cache.sh
./scripts/clean-cache.sh
```

**reset-bundler.sh** - Reset Metro + Watchman
```bash
chmod +x scripts/reset-bundler.sh
./scripts/reset-bundler.sh
```

**deep-clean.sh** - Complete reinstall
```bash
chmod +x scripts/deep-clean.sh
./scripts/deep-clean.sh
```

## Usage

### Quick Start Commands

```bash
# Clean cache and start
bun expo start --clear

# Reset everything
./scripts/reset-bundler.sh

# Deep clean (when really stuck)
./scripts/deep-clean.sh
```

### Increase System File Watcher Limit (Linux/macOS)

**macOS:**
```bash
# Check current limit
launchctl limit maxfiles

# Increase limit (requires restart)
sudo launchctl limit maxfiles 65536 200000
```

**Linux:**
```bash
# Check current limit
cat /proc/sys/fs/inotify/max_user_watches

# Temporarily increase
echo 524288 | sudo tee /proc/sys/fs/inotify/max_user_watches

# Permanently increase (add to /etc/sysctl.conf)
echo "fs.inotify.max_user_watches=524288" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

## Optimization Tips

### 1. Reduce Documentation
If you don't need docs during development, uncomment this in `.gitignore`:
```
# docs/
```
This excludes all 30+ documentation files from being watched.

### 2. Use Metro Cache Wisely
Metro cache speeds up rebuilds but can get stale:
```bash
# Clear only when needed (config changes, stuck builds)
rm -rf node_modules/.cache
bun expo start --clear
```

### 3. Minimize Watchers
- Close other dev servers
- Close unused IDE windows
- Limit running npm scripts

### 4. File Organization
Your app has:
- **100+ app routes** (app/ folder)
- **30+ docs** (docs/ folder)
- **50+ utilities** (utils/, components/)
- **10+ tests** (__tests__/)

Consider:
- Moving docs to a separate repo or wiki
- Lazy loading routes
- Code splitting large utilities

## Quick Troubleshooting

### App stuck loading
```bash
./scripts/reset-bundler.sh
```

### WebSocket errors
```bash
rm -rf node_modules/.cache
bun expo start --clear
```

### "Detected change in babel/metro config"
```bash
# Always restart after config changes
# Press 'r' in terminal or
./scripts/reset-bundler.sh
```

### Still hitting limits
```bash
# Nuclear option
./scripts/deep-clean.sh
# Then increase system limits (see above)
```

## Maintenance

Run cleanup weekly:
```bash
./scripts/clean-cache.sh
```

Run reset when stuck:
```bash
./scripts/reset-bundler.sh
```

Run deep clean monthly or when very stuck:
```bash
./scripts/deep-clean.sh
```

## Performance Benefits

After optimization:
- ✅ Faster hot reload
- ✅ Reduced memory usage  
- ✅ Fewer Metro restarts
- ✅ Stable WebSocket connections
- ✅ No file watcher limit errors
