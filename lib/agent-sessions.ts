// lib/agent-sessions.ts
//
// Agents who share this TPE switch with their PIN, not their password. When an
// agent hands the phone over ("Changer d'agent"), their server session is not
// signed out: its tokens (the `__convexAuth*` keys ConvexAuthProvider keeps in
// AsyncStorage, see app/_layout.tsx) move into SecureStore, one entry per
// agent. Picking an agent and typing their PIN puts the tokens back; the
// provider is then remounted (stores/auth-epoch-store.ts) so it reads them and
// refreshes the session as usual. A full sign-out ("Déconnexion") forgets the
// agent and their saved session.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import type { User } from "@/stores/auth-store";
import { hasDeviceKey } from "@/lib/device-key";
import { convex } from "@/lib/convex";

const LIST_KEY = "device_agents_v1";
const AUTH_KEY_PREFIXES = ["__convexAuthJWT", "__convexAuthRefreshToken"];
// ConvexAuthProvider suffixes its keys with the deployment URL, letters and
// digits only: tokens of another deployment (a preview build) are ignored
const namespace = () => convex.url.replace(/[^a-zA-Z0-9]/g, "");
const jwtKey = () => `__convexAuthJWT_${namespace()}`;
const refreshKey = () => `__convexAuthRefreshToken_${namespace()}`;

/** An agent who can come back on this phone with their PIN. */
export interface SavedAgent {
  id: string;
  name: string;
  phone: string;
  /** Profile shown until users:me answers (and offline). */
  user: User;
  savedAt: number;
}

// SecureStore keys: alphanumeric, ".", "-" and "_" only
function sessionKey(agentId: string) {
  return `agent_session_${agentId.replace(/[^\w.-]/g, "")}`;
}

export async function listSavedAgents(): Promise<SavedAgent[]> {
  try {
    const raw = await AsyncStorage.getItem(LIST_KEY);
    return raw ? (JSON.parse(raw) as SavedAgent[]) : [];
  } catch {
    return [];
  }
}

async function writeList(list: SavedAgent[]) {
  await AsyncStorage.setItem(LIST_KEY, JSON.stringify(list));
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Base64url to text, without relying on atob (not on every Hermes build). */
function decodeBase64Url(input: string): string {
  const s = input.replace(/-/g, "+").replace(/_/g, "/");
  let bits = 0;
  let value = 0;
  let out = "";
  for (const ch of s) {
    const i = B64.indexOf(ch);
    if (i < 0) continue;
    value = (value << 6) | i;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((value >> bits) & 0xff);
    }
  }
  return out; // bytes as Latin-1: enough for the ASCII ids in `sub`
}

/**
 * The staff member a set of session tokens belongs to (the access token's
 * `sub` is "userId|sessionId"), or null when it can't be read or there is no
 * access token for this app's deployment.
 */
export function tokensOwner(tokens: Record<string, string>): string | null {
  const jwt = tokens[jwtKey()];
  const payload = jwt?.split(".")[1];
  if (!payload) return null;
  try {
    const sub = JSON.parse(decodeBase64Url(payload)).sub;
    return typeof sub === "string" ? sub.split("|")[0] : null;
  } catch {
    return null;
  }
}

async function currentAuthKeys(): Promise<string[]> {
  const keys = await AsyncStorage.getAllKeys();
  return keys.filter((k) => AUTH_KEY_PREFIXES.some((p) => k.startsWith(p)));
}

/**
 * Put the signed-in agent's session aside and clear it from the provider's
 * storage, without signing out on the server. Returns false (agent not kept
 * on the phone) when there is neither a session to keep nor a device key
 * to sign them back in with (lib/device-key.ts).
 */
export async function parkSession(user: User): Promise<boolean> {
  if (!user.phone) return false;
  const keys = await currentAuthKeys();
  const pairs = await AsyncStorage.multiGet(keys);
  const tokens = Object.fromEntries(pairs.filter(([, v]) => v !== null)) as Record<string, string>;
  // Tokens of another agent (left by a provider that wrote after a switch)
  // must not be filed under this one: they would sign the wrong agent in
  const hasRefresh =
    typeof tokens[refreshKey()] === "string" &&
    tokensOwner(tokens) === user.id;
  let kept = false;
  try {
    if (hasRefresh) {
      await SecureStore.setItemAsync(sessionKey(user.id), JSON.stringify(tokens));
    } else {
      await SecureStore.deleteItemAsync(sessionKey(user.id));
    }
    kept = hasRefresh || (await hasDeviceKey(user.id));
    if (kept) {
      const list = (await listSavedAgents()).filter((a) => a.id !== user.id);
      list.unshift({ id: user.id, name: user.name, phone: user.phone, user, savedAt: Date.now() });
      await writeList(list);
    }
  } finally {
    // Even when saving failed: the next agent must not inherit this session
    await AsyncStorage.multiRemove(keys);
  }
  return kept;
}

/**
 * Put an agent's saved session back where the provider reads it. Returns
 * their saved profile, or null when nothing is saved for them.
 */
export async function restoreSession(agentId: string): Promise<User | null> {
  const agent = (await listSavedAgents()).find((a) => a.id === agentId);
  if (!agent) return null;
  const raw = await SecureStore.getItemAsync(sessionKey(agentId));
  if (!raw) {
    // No session kept, but a device key: start signed out on the server, the
    // root layout signs the agent back in with the key (online)
    if (!(await hasDeviceKey(agentId))) return null;
    await AsyncStorage.multiRemove(await currentAuthKeys());
    await writeList((await listSavedAgents()).filter((a) => a.id !== agentId));
    return agent.user;
  }
  let tokens: Record<string, string> | null = null;
  try {
    tokens = JSON.parse(raw) as Record<string, string>;
  } catch {
    tokens = null;
  }
  if (!tokens || tokensOwner(tokens) !== agentId) {
    // Unreadable, or another agent's: not this agent's session. Their device
    // key signs them back in (online); without one, the password
    await SecureStore.deleteItemAsync(sessionKey(agentId));
    if (!(await hasDeviceKey(agentId))) {
      await forgetAgent(agentId).catch(() => {});
      return null;
    }
    await AsyncStorage.multiRemove(await currentAuthKeys());
    await writeList((await listSavedAgents()).filter((a) => a.id !== agentId));
    return agent.user;
  }
  await AsyncStorage.multiRemove(await currentAuthKeys());
  await AsyncStorage.multiSet(Object.entries(tokens));
  // A session is in use by one agent at a time: the copy here would go stale
  // as the provider rotates the refresh token
  await SecureStore.deleteItemAsync(sessionKey(agentId));
  await writeList((await listSavedAgents()).filter((a) => a.id !== agentId));
  return agent.user;
}

/** Remove an agent from this phone (full sign-out). */
export async function forgetAgent(agentId: string): Promise<void> {
  await SecureStore.deleteItemAsync(sessionKey(agentId));
  await writeList((await listSavedAgents()).filter((a) => a.id !== agentId));
}
