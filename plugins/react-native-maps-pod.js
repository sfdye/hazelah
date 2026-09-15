const { withPodfile } = require('@expo/config-plugins');

// Expo's react-native-maps integration still emits the legacy pod name
// 'react-native-google-maps', which react-native-maps >= 1.2 no longer ships.
// Rewrite it to the real podspec and add the Google Maps SDK pods it detects.
const LEGACY_LINE =
  "pod 'react-native-google-maps', path: File.dirname(`node --print \"require.resolve('react-native-maps/package.json')\"`)";
const FIXED_LINES =
  "pod 'react-native-maps/Google', path: File.dirname(`node --print \"require.resolve('react-native-maps/package.json')\"`)";

function withReactNativeMapsPod(config) {
  return withPodfile(config, (config) => {
    if (config.modResults.contents.includes(LEGACY_LINE)) {
      config.modResults.contents = config.modResults.contents.replace(
        LEGACY_LINE,
        FIXED_LINES,
      );
    }
    return config;
  });
}

module.exports = withReactNativeMapsPod;
