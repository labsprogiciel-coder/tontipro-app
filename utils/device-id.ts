// utils/device-id.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "kauridorr_device_install_id";

/**
 * `expo-device`'s OS-level fields (osInternalBuildId, modelId) describe the
 * firmware build or hardware model, not the physical unit — devices sharing
 * the same OS build (very common: same manufacturer/region/year) report
 * identical values, so using them as a device fingerprint makes different
 * phones collide and look like the same already-registered TPE. We mint a
 * random id on first run and persist it instead — unique per install,
 * stable across app restarts on the same phone.
 */
export async function getOrCreateDeviceInstallId(): Promise<string> {
  const existing = await AsyncStorage.getItem(STORAGE_KEY);
  if (existing) return existing;

  const id = `${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 10)}`.toUpperCase();
  await AsyncStorage.setItem(STORAGE_KEY, id);
  return id;
}
