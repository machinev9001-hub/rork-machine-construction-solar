const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

const config = getDefaultConfig(__dirname);

const wrappedConfig = withRorkMetro(config);

// Ensure web platform is properly supported after Rork wrapper
if (!wrappedConfig.resolver) {
  wrappedConfig.resolver = {};
}

// Preserve existing platforms and ensure web is included
const existingPlatforms = wrappedConfig.resolver.platforms || [];
if (!existingPlatforms.includes('web')) {
  wrappedConfig.resolver.platforms = [...existingPlatforms, 'web'];
}

// Ensure all necessary source extensions are included for web
const defaultSourceExts = ['js', 'jsx', 'json', 'ts', 'tsx', 'cjs', 'mjs'];
const existingSourceExts = wrappedConfig.resolver.sourceExts || [];
const missingSourceExts = defaultSourceExts.filter(ext => !existingSourceExts.includes(ext));
if (missingSourceExts.length > 0) {
  wrappedConfig.resolver.sourceExts = [...existingSourceExts, ...missingSourceExts];
}

module.exports = wrappedConfig;
