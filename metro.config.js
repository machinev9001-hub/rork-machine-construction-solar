const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts = [...(config.resolver.sourceExts || []), 'cjs'];

config.transformer = {
...config.transformer,
minifierConfig: {
  keep_classnames: true,
  keep_fnames: true,
  mangle: {
    keep_classnames: true,
    keep_fnames: true,
  },
},
};

config.watchFolders = [__dirname];

module.exports = config;
