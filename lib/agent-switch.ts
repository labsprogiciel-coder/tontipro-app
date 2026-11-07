// lib/agent-switch.ts
//
// Switching agents on a shared TPE with a PIN (see lib/agent-sessions.ts for
// where the sessions are kept).
import { forgetAgent, parkSession, restoreSession, type SavedAgent } from "@/lib/agent-sessions";
import { useAuthStore } from "@/stores/auth-store";
import { useAppLockStore } from "@/stores/app-lock-store";
import { useAuthEpochStore } from "@/stores/auth-epoch-store";
import { verifyOfflineCredential } from "@/utils/secure-storage";
import { forgetDeviceKey } from "@/lib/device-key";

/**
 * "Changer d'agent": keep the signed-in agent's session and PIN on the phone,
 * then show the agent picker. Nothing is signed out on the server.
 */
export async function handOverDevice(): Promise<void> {
  const user = useAuthStore.getState().user;
  // From here the current provider must not write tokens any more
  useAuthEpochStore.getState().seal();
  if (user) {
    try {
      await parkSession(user);
    } catch (e) {
      // Not kept: this agent signs in with their password next time
      console.error("[agent-switch] parkSession failed:", e);
    }
  }
  useAuthStore.getState().logout({ keepOnDevice: true });
  useAppLockStore.getState().lock();
  useAuthEpochStore.getState().bump();
}

export type SwitchResult =
  | { ok: true }
  | { ok: false; message: string; needsPassword?: boolean };

/**
 * Come back as a saved agent with their PIN. Works offline: the session is
 * refreshed on the server once the phone is online.
 */
export async function switchToAgent(agent: SavedAgent, pin: string): Promise<SwitchResult> {
  const check = await verifyOfflineCredential(agent.phone, pin);
  if (!check.valid) return { ok: false, message: check.message ?? "Code incorrect." };
  useAuthEpochStore.getState().seal();
  let user: Awaited<ReturnType<typeof restoreSession>>;
  try {
    user = await restoreSession(agent.id);
  } catch (e) {
    // Nothing moved for good: the current provider may write again
    useAuthEpochStore.setState((s) => ({ writable: s.epoch }));
    throw e;
  }
  if (!user) {
    useAuthEpochStore.setState((s) => ({ writable: s.epoch }));
    return {
      ok: false,
      needsPassword: true,
      message: "Session expirée sur ce téléphone : reconnectez-vous avec votre mot de passe.",
    };
  }
  useAuthStore.getState().switchTo(user);
  useAppLockStore.getState().unlock();
  useAuthEpochStore.getState().bump();
  return { ok: true };
}

/**
 * Remove the signed-in agent from the phone: their PIN, saved session and
 * device key go (revoked on the server when online). Next time they need
 * the password, and so the network.
 */
export async function forgetCurrentAgent(): Promise<void> {
  const user = useAuthStore.getState().user;
  if (user) await forgetDeviceKey(user.id, true).catch(() => {});
  useAuthStore.getState().logout();
  if (user) await forgetAgent(user.id).catch(() => {});
}
