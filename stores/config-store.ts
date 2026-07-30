import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface ConfigState {
  baseUnit: number; // minimum savings unit in FCFA
  maxMultiplier: number; // maximum number of units a client can take
  setBaseUnit: (n: number) => void;
  setMaxMultiplier: (n: number) => void;
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      baseUnit: 250,
      maxMultiplier: 100,
      setBaseUnit: (baseUnit) => set({ baseUnit }),
      setMaxMultiplier: (maxMultiplier) => set({ maxMultiplier }),
    }),
    {
      name: "kauridorr-config",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
