const path = require('path');
const {getDefaultConfig} = require('@react-native/metro-config');
const {withNativeWind} = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

config.resolver = {
  ...(config.resolver || {}),
  alias: {
    ...(config.resolver?.alias || {}),
    '@': path.resolve(__dirname),
  },
};

module.exports = withNativeWind(config, {
  input: './global.css',
  inlineRem: 16,
});
