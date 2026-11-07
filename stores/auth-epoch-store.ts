import { create } from "zustand";

// Bumped when the session tokens in storage change outside ConvexAuthProvider
// (an agent switch on a shared TPE, see lib/agent-sessions.ts). The provider
// is keyed on it (app/_layout.tsx), so it remounts and reads them again.
//
// Only the provider of the current epoch may write the tokens, and none while
// a switch moves them (`seal`): the provider being replaced can still finish
// a token refresh or a sign-in it started earlier (offline, Convex holds the
// call until the network is back), and its tokens would land in the next
// agent's storage. That agent would then be signed in as the previous one,
// and parked under the wrong name.
interface AuthEpochState {
  epoch: number;
  /** The epoch whose provider may write the tokens; -1 while sealed. */
  writable: number;
  /** Stop every provider from writing the tokens until the next bump. */
  seal: () => void;
  bump: () => void;
}

export const useAuthEpochStore = create<AuthEpochState>((set) => ({
  epoch: 0,
  writable: 0,
  seal: () => set({ writable: -1 }),
  bump: () => set((s) => ({ epoch: s.epoch + 1, writable: s.epoch + 1 })),
}));
