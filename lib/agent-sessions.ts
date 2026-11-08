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
export const jwtKey = () => `__convexAuthJWT_${namespace()}`;
export const refreshKey = () => `__convexAuthRefreshToken_${namespace()}`;

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

/** The staff member an access token belongs to (`sub` is "userId|sessionId"). */
export function jwtOwner(jwt: string | null | undefined): string | null {
  const payload = jwt?.split(".")[1];
  if (!payload) return null;
  try {
    const sub = JSON.parse(decodeBase64Url(payload)).sub;
    return typeof sub === "string" ? sub.split("|")[0] : null;
  } catch {
    return null;
  }
}

/**
 * The staff member a set of session tokens belongs to, or null when it can't
 * be read or there is no access token for this app's deployment.
 */
export function tokensOwner(tokens: Record<string, string>): string | null {
  return jwtOwner(tokens[jwtKey()]);
}

// Tokens a replaced provider received after its agent was put aside: a
// refresh that was in flight at the switch (Convex refreshes right after
// each sign-in is confirmed). The server has already replaced the refresh
// token, so the copy put aside is stale, and using it again more than 10 s
// later ends the session on the server. They go to the agent's saved
// session instead (parkSession / restoreSession merge them).
const lateTokens = new Map<string, Record<string, string>>();

/**
 * Keep a token a replaced provider wrote for `owner`: in their saved session
 * (or for parkSession, if it is running), and in the provider's storage when
 * `owner` is the signed-in agent again (`active`).
 */
export async function adoptLateToken(owner: string, key: string, value: string, active: boolean) {
  if (key !== jwtKey() && key !== refreshKey()) return;
  lateTokens.set(owner, { ...lateTokens.get(owner), [key]: value });
  if (active) await AsyncStorage.setItem(key, value);
  const raw = await SecureStore.getItemAsync(sessionKey(owner));
  if (!raw) return;
  try {
    const saved = JSON.parse(raw) as Record<string, string>;
    if (tokensOwner(saved) !== owner) return;
    await SecureStore.setItemAsync(sessionKey(owner), JSON.stringify({ ...saved, [key]: value }));
  } catch {
    // unreadable copy: restoreSession falls back on the device key
  }
}

/** `tokens` with the late ones received for `agentId` on top, which are then consumed. */
function withLateTokens(agentId: string, tokens: Record<string, string>) {
  const late = lateTokens.get(agentId);
  lateTokens.delete(agentId);
  return late ? { ...tokens, ...late } : tokens;
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
  let tokens = Object.fromEntries(pairs.filter(([, v]) => v !== null)) as Record<string, string>;
  if (tokensOwner(tokens) === user.id) tokens = withLateTokens(user.id, tokens);
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
  let raw = await SecureStore.getItemAsync(sessionKey(agentId));
  const late = lateTokens.get(agentId);
  if (!raw && late?.[refreshKey()] && jwtOwner(late[jwtKey()]) === agentId) {
    // Put aside without a session, then a late refresh brought one
    raw = JSON.stringify(late);
  }
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
  tokens = withLateTokens(agentId, tokens);
  await AsyncStorage.multiRemove(await currentAuthKeys());
  await AsyncStorage.multiSet(Object.entries(tokens));
  // A session is in use by one agent at a time: the copy here would go stale
  // as the provider rotates the refresh token
  await SecureStore.deleteItemAsync(sessionKey(agentId));
  await writeList((await listSavedAgents()).filter((a) => a.id !== agentId));
  return agent.user;
}

/** Drop the session tokens from the provider's storage (local sign-out). */
export async function clearProviderTokens(): Promise<void> {
  await AsyncStorage.multiRemove(await currentAuthKeys());
}

/** Remove an agent from this phone (full sign-out). */
export async function forgetAgent(agentId: string): Promise<void> {
  await SecureStore.deleteItemAsync(sessionKey(agentId));
  await writeList((await listSavedAgents()).filter((a) => a.id !== agentId));
}
