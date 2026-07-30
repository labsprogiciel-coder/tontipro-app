import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const NAVIGATION_PERSISTENCE_KEY = "NAVIGATION_STATE_V1";

interface NavigationState {
  currentRoute: string;
  previousRoute: string | null;
  params: Record<string, any>;
  setCurrentRoute: (route: string, params?: Record<string, any>) => void;
  clearNavigationState: () => void;
}

export const useNavigationStore = create<NavigationState>()(
  persist(
    (set) => ({
      currentRoute: "/",
      previousRoute: null,
      params: {},
      setCurrentRoute: (route, params = {}) =>
        set((state) => ({
          previousRoute: state.currentRoute,
          currentRoute: route,
          params,
        })),
      clearNavigationState: () =>
        set({
          currentRoute: "/",
          previousRoute: null,
          params: {},
        }),
    }),
    {
      name: NAVIGATION_PERSISTENCE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
