import { create } from "zustand";

// Volontairement SANS `persist` : `isUnlocked` doit repartir à `false` à
// chaque cold start (nouveau process JS), c'est ce qui force l'agent à
// retaper son code à chaque ouverture de l'app — pas à chaque retour au
// premier plan (pas de logique AppState/inactivité ici, juste ce reset
// naturel au démarrage).
interface AppLockState {
  isUnlocked: boolean;
  unlock: () => void;
}

export const useAppLockStore = create<AppLockState>((set) => ({
  isUnlocked: false,
  unlock: () => set({ isUnlocked: true }),
}));
