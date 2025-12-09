#!/bin/bash

echo "📊 File Watcher Diagnostics"
echo "=============================="
echo ""

if command -v watchman &> /dev/null; then
    echo "✅ Watchman installed"
    watchman version
else
    echo "⚠️  Watchman not installed (optional but recommended)"
    echo "   Install: brew install watchman (macOS)"
fi

echo ""
echo "📁 Directory file counts:"
echo "  App routes: $(find app -type f | wc -l)"
echo "  Docs: $(find docs -type f 2>/dev/null | wc -l || echo 0)"
echo "  Utils: $(find utils -type f 2>/dev/null | wc -l || echo 0)"
echo "  Components: $(find components -type f 2>/dev/null | wc -l || echo 0)"
echo "  Tests: $(find __tests__ -type f 2>/dev/null | wc -l || echo 0)"
echo "  Total project files: $(find . -type f ! -path './node_modules/*' ! -path './.git/*' ! -path './.expo/*' | wc -l)"

echo ""
echo "🗂️  Cache sizes:"
if [ -d "node_modules/.cache" ]; then
    echo "  node_modules/.cache: $(du -sh node_modules/.cache 2>/dev/null | cut -f1)"
else
    echo "  node_modules/.cache: Not present"
fi

if [ -d ".expo" ]; then
    echo "  .expo: $(du -sh .expo 2>/dev/null | cut -f1)"
else
    echo "  .expo: Not present"
fi

if [ -d ".cache" ]; then
    echo "  .cache: $(du -sh .cache 2>/dev/null | cut -f1)"
else
    echo "  .cache: Not present"
fi

echo ""
echo "⚙️  System limits:"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "  max_user_watches: $(cat /proc/sys/fs/inotify/max_user_watches 2>/dev/null || echo 'N/A')"
    echo "  max_user_instances: $(cat /proc/sys/fs/inotify/max_user_instances 2>/dev/null || echo 'N/A')"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo "  maxfiles: $(launchctl limit maxfiles 2>/dev/null || echo 'N/A')"
fi

echo ""
echo "💡 Quick actions:"
echo "  Clean cache:     ./scripts/clean-cache.sh"
echo "  Reset bundler:   ./scripts/reset-bundler.sh"
echo "  Deep clean:      ./scripts/deep-clean.sh"
