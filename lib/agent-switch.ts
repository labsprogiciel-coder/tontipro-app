// lib/agent-switch.ts
//
// Switching agents on a shared TPE with a PIN (see lib/agent-sessions.ts for
// where the sessions are kept).
import { forgetAgent, parkSession, restoreSession, type SavedAgent } from "@/lib/agent-sessions";
import { useAuthStore } from "@/stores/auth-store";
import { useAppLockStore } from "@/stores/app-lock-store";
import { useAuthEpochStore } from "@/stores/auth-epoch-store";
import { verifyOfflineCredential } from "@/utils/secure-storage";

/**
 * "Changer d'agent": keep the signed-in agent's session and PIN on the phone,
 * then show the agent picker. Nothing is signed out on the server.
 */
export async function handOverDevice(): Promise<void> {
  const user = useAuthStore.getState().user;
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
  const user = await restoreSession(agent.id);
  if (!user) {
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

/** Full sign-out of the signed-in agent: their PIN and saved session go. */
export async function forgetCurrentAgent(): Promise<void> {
  const user = useAuthStore.getState().user;
  useAuthStore.getState().logout();
  if (user) await forgetAgent(user.id).catch(() => {});
}
