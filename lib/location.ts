// lib/location.ts
//
// Where the TPE is, for the fraud checks on the dashboard: each deposit and
// withdrawal carries the latest GPS fix, and the heartbeat reports it too.
// Recording never waits for the GPS: it takes the fix already in hand
// (refreshed by the heartbeat and when the new-transaction screen opens).
import * as Location from "expo-location";

export type GeoFix = {
  lat: number;
  lng: number;
  accuracy?: number; // metres
  /** Android's "mock location" flag: a fake-GPS app is feeding the position */
  mocked?: boolean;
  /** When the fix was taken (phone clock) */
  at?: number;
};

// A fix older than this isn't attached to a transaction
const MAX_AGE_MS = 15 * 60 * 1000;
const FIX_TIMEOUT_MS = 10_000;

let lastFix: GeoFix | undefined;
let refreshing: Promise<GeoFix | undefined> | undefined;

const toFix = (p: Location.LocationObject): GeoFix => ({
  lat: p.coords.latitude,
  lng: p.coords.longitude,
  accuracy: p.coords.accuracy ?? undefined,
  mocked: p.mocked === true ? true : undefined,
  at: p.timestamp,
});

/** Whether the app may read the position; asks once if the agent hasn't answered yet. */
export async function locationAllowed(): Promise<boolean> {
  try {
    const current = await Location.getForegroundPermissionsAsync();
    if (current.granted) return true;
    if (current.status !== Location.PermissionStatus.UNDETERMINED || !current.canAskAgain) {
      return false;
    }
    return (await Location.requestForegroundPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** Take a new fix in the background (falls back to the last known one). Never throws. */
export function refreshFix(): Promise<GeoFix | undefined> {
  refreshing ??= (async () => {
    try {
      if (!(await locationAllowed())) return undefined;
      const position = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), FIX_TIMEOUT_MS)),
      ]).catch(() => null);
      const p = position ?? (await Location.getLastKnownPositionAsync().catch(() => null));
      if (p) lastFix = toFix(p);
      return lastFix;
    } finally {
      refreshing = undefined;
    }
  })();
  return refreshing;
}

/** The latest fix if it is recent enough to place a transaction, without waiting. */
export function currentFix(): GeoFix | undefined {
  if (!lastFix) return undefined;
  if (lastFix.at !== undefined && Date.now() - lastFix.at > MAX_AGE_MS) return undefined;
  return lastFix;
}
