// lib/sentry.ts
//
// Crash and error reporting to Sentry (progiciel-labs/mizo-app). The DSN only
// lets the app send events, so it can live in the bundle; EXPO_PUBLIC_SENTRY_DSN
// overrides it. Off in development builds so local errors stay local.
import * as Sentry from "@sentry/react-native";
import * as Updates from "expo-updates";
import { isRunningInExpoGo } from "expo";

const DSN =
  process.env.EXPO_PUBLIC_SENTRY_DSN ??
  "https://cd5398f36179d1c773c211edcf69500b@o4512016838361088.ingest.de.sentry.io/4512267506483280";

/** Ties performance traces to Expo Router screens; registered in app/_layout.tsx. */
export const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: !isRunningInExpoGo(),
});

Sentry.init({
  dsn: DSN,
  enabled: !__DEV__,
  // "preview" or "production": the EAS Update channel the build listens to
  environment: Updates.channel || (__DEV__ ? "development" : "unknown"),
  // Agents' phone numbers and names stay out of Sentry: only the user id is sent
  sendDefaultPii: false,
  tracesSampleRate: 0.2,
  integrations: [navigationIntegration],
  enableNativeFramesTracking: !isRunningInExpoGo(),
});

// Which OTA update was running, so a crash can be matched to a publish
if (Updates.updateId) Sentry.setTag("expo-update-id", Updates.updateId);

/** Attach the signed-in staff id to later events; null on sign-out. */
export function setSentryUser(id: string | null) {
  Sentry.setUser(id ? { id } : null);
}

export { Sentry };
