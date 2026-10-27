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

const LIST_KEY = "device_agents_v1";
const AUTH_KEY_PREFIXES = ["__convexAuthJWT", "__convexAuthRefreshToken"];

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

async function currentAuthKeys(): Promise<string[]> {
  const keys = await AsyncStorage.getAllKeys();
  return keys.filter((k) => AUTH_KEY_PREFIXES.some((p) => k.startsWith(p)));
}

/**
 * Put the signed-in agent's session aside and clear it from the provider's
 * storage, without signing out on the server. Returns false (nothing saved)
 * when there is no session to keep, e.g. it already expired.
 */
export async function parkSession(user: User): Promise<boolean> {
  if (!user.phone) return false;
  const keys = await currentAuthKeys();
  const pairs = await AsyncStorage.multiGet(keys);
  const tokens = Object.fromEntries(pairs.filter(([, v]) => v !== null)) as Record<string, string>;
  const hasRefresh = Object.keys(tokens).some((k) => k.startsWith("__convexAuthRefreshToken"));
  if (hasRefresh) {
    await SecureStore.setItemAsync(sessionKey(user.id), JSON.stringify(tokens));
    const list = (await listSavedAgents()).filter((a) => a.id !== user.id);
    list.unshift({ id: user.id, name: user.name, phone: user.phone, user, savedAt: Date.now() });
    await writeList(list);
  }
  await AsyncStorage.multiRemove(keys);
  return hasRefresh;
}

/**
 * Put an agent's saved session back where the provider reads it. Returns
 * their saved profile, or null when nothing is saved for them.
 */
export async function restoreSession(agentId: string): Promise<User | null> {
  const agent = (await listSavedAgents()).find((a) => a.id === agentId);
  const raw = await SecureStore.getItemAsync(sessionKey(agentId));
  if (!agent || !raw) return null;
  const tokens = JSON.parse(raw) as Record<string, string>;
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
