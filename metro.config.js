const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

const config = getDefaultConfig(__dirname);

const wrappedConfig = withRorkMetro(config);

// Ensure web platform is properly supported after Rork wrapper
if (wrappedConfig.resolver) {
  wrappedConfig.resolver.platforms = ['ios', 'android', 'web'];
} else {
  wrappedConfig.resolver = { platforms: ['ios', 'android', 'web'] };
}

module.exports = wrappedConfig;
