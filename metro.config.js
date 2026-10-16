const { getSentryExpoConfig } = require("@sentry/react-native/metro");

// Same as Expo's default config, plus debug IDs so Sentry can match
// uploaded source maps to the bundle.
const config = getSentryExpoConfig(__dirname);

module.exports = config;
