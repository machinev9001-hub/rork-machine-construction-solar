const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

const config = getDefaultConfig(__dirname);

const wrappedConfig = withRorkMetro(config);

// Ensure web platform is properly supported after Rork wrapper
if (wrappedConfig.resolver) {
  wrappedConfig.resolver.platforms = ['ios', 'android', 'web'];
  // Ensure all necessary source extensions are included for web
  if (!wrappedConfig.resolver.sourceExts) {
    wrappedConfig.resolver.sourceExts = ['js', 'jsx', 'json', 'ts', 'tsx', 'cjs', 'mjs'];
  }
} else {
  wrappedConfig.resolver = { 
    platforms: ['ios', 'android', 'web'],
    sourceExts: ['js', 'jsx', 'json', 'ts', 'tsx', 'cjs', 'mjs']
  };
}

module.exports = wrappedConfig;
