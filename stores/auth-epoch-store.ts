import { create } from "zustand";

// Bumped when the session tokens in storage change outside ConvexAuthProvider
// (an agent switch on a shared TPE, see lib/agent-sessions.ts). The provider
// is keyed on it (app/_layout.tsx), so it remounts and reads them again.
interface AuthEpochState {
  epoch: number;
  bump: () => void;
}

export const useAuthEpochStore = create<AuthEpochState>((set) => ({
  epoch: 0,
  bump: () => set((s) => ({ epoch: s.epoch + 1 })),
}));
