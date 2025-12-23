const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

const config = getDefaultConfig(__dirname);

// Ensure web platform is properly supported
if (config.resolver) {
  config.resolver.platforms = ['ios', 'android', 'web'];
} else {
  config.resolver = { platforms: ['ios', 'android', 'web'] };
}

module.exports = withRorkMetro(config);
