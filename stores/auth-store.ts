import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { validateCredentials } from "@/mocks/auth";

export interface User {
  id: string;
  name: string;
  email?: string;
  role: "agent";
}

interface AuthState {
  isAuthenticated: boolean;
  isInitialized: boolean;
  user: User | null;
  login: (agentId: string, pin: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      isInitialized: false,
      user: null,
      login: async (agentId: string, pin: string) => {
        return new Promise<void>((resolve, reject) => {
          setTimeout(() => {
            const agent = validateCredentials(agentId, pin);
            if (agent) {
              set({
                isAuthenticated: true,
                user: {
                  id: agent.id,
                  name: agent.name,
                  email: agent.email,
                  role: agent.role,
                },
              });
              resolve();
            } else {
              reject(new Error("Invalid credentials"));
            }
          }, 800);
        });
      },
      logout: () => {
        set({ isAuthenticated: false, user: null });
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        return () => {
          if (state) {
            state.isInitialized = true;
          }
        };
      },
    }
  )
);