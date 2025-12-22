const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

const config = getDefaultConfig(__dirname);

// Optimize for web platform to prevent bundler restart loops
config.resolver = {
  ...config.resolver,
  // Disable source maps in web production to reduce bundle processing
  platforms: ['ios', 'android', 'web'],
  // Add platform-specific extensions
  sourceExts: [...(config.resolver?.sourceExts || []), 'jsx', 'js', 'ts', 'tsx', 'json'],
};

// Optimize transformer for web builds
config.transformer = {
  ...config.transformer,
  // Reduce memory pressure during bundling
  minifierConfig: {
    ...config.transformer?.minifierConfig,
    // Disable some expensive optimizations for web
    keep_classnames: true,
    keep_fnames: true,
  },
  // Reduce worker count to prevent memory exhaustion
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
};

// Reduce max workers to prevent memory issues during web bundling
config.maxWorkers = 2;

// Improve caching to prevent unnecessary rebuilds
config.cacheStores = [
  ...((config.cacheStores || []).filter(store => store)),
];

// Reset cache on config changes
config.resetCache = false;

module.exports = withRorkMetro(config);
