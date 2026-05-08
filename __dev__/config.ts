/**
 * DEV_MODE — single source of truth for dev/mock behaviour.
 *
 * Auto-login and mock data are active whenever the Metro bundler runs the app
 * in development mode (__DEV__ === true).  Set the env var to "false" to force
 * the real Supabase flow even while running through Metro (useful for testing
 * the auth journey locally).
 *
 *   EXPO_PUBLIC_DEV_MOCK=false npx expo start
 */
export const DEV_MODE = false;
export const DEV_MOCKS_ENABLED = DEV_MODE;