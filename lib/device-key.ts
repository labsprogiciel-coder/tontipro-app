// lib/device-key.ts
//
// PIN-only sign-in after a phone's first setup. The first sign-in needs the
// password and the network; once signed in, the app gets a device key from
// the admin backend (convex/deviceKeys.ts) and keeps it in SecureStore, one
// per agent. When the server session ends (it expires after 30 days), the
// app signs the agent back in with that key instead of asking for the
// password: the PIN, checked on the phone, stays all they type. The server
// deletes the keys when the agent is suspended, unbound from the TPE or has
// their password reset; the password is then needed again.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { convex } from "@/lib/convex";
import * as adminApi from "@/lib/admin-api";

const INSTALL_ID_KEY = "app_install_id";

type DeviceKey = { keyId: string; secret: string };

// SecureStore keys: alphanumeric, ".", "-" and "_" only
const storeKey = (agentId: string) => `device_key_${agentId.replace(/[^\w.-]/g, "")}`;

/** A random id for this app install, made once (the server keeps one key per install). */
async function installId(): Promise<string> {
  const saved = await AsyncStorage.getItem(INSTALL_ID_KEY);
  if (saved) return saved;
  const id = Crypto.randomUUID();
  await AsyncStorage.setItem(INSTALL_ID_KEY, id);
  return id;
}

export async function getDeviceKey(agentId: string): Promise<DeviceKey | null> {
  const raw = await SecureStore.getItemAsync(storeKey(agentId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DeviceKey;
  } catch {
    return null;
  }
}

export async function hasDeviceKey(agentId: string): Promise<boolean> {
  return (await getDeviceKey(agentId)) !== null;
}

/**
 * Get a device key for the signed-in agent if this phone has none (or
 * `replace`, after a password sign-in: a reset may have deleted the old one).
 * Needs the network; a failure only means the password may be asked later.
 */
export async function ensureDeviceKey(agentId: string, replace = false): Promise<void> {
  if (!replace && (await hasDeviceKey(agentId))) return;
  const key = await convex.mutation(adminApi.issueDeviceKey, { installId: await installId() });
  await SecureStore.setItemAsync(storeKey(agentId), JSON.stringify(key));
}

/** Drop the agent's key from the phone, and on the server when online. */
export async function forgetDeviceKey(agentId: string, revokeOnServer = false): Promise<void> {
  const key = await getDeviceKey(agentId);
  await SecureStore.deleteItemAsync(storeKey(agentId));
  if (revokeOnServer && key) {
    // Best effort: offline, the key stays valid on the server until IT
    // unbinds the agent from the TPE
    convex.mutation(adminApi.revokeDeviceKey, { keyId: key.keyId }).catch(() => {});
  }
}
