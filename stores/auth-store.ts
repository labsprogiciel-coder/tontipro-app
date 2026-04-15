import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { useClientStore } from "@/stores/client-store";
import { useTransactionStore } from "@/stores/transaction-store";

export interface User {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: "agent";
}

interface AuthState {
  isAuthenticated: boolean;
  isInitialized: boolean;
  isLoadingClients: boolean;
  user: User | null;
  registeredPhone: string | null; // persisted so PIN login needs no phone input
  sendOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, token: string) => Promise<void>;
  verifyPin: (pin: string) => Promise<void>;
  savePin: (phone: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  mockLogin: () => void;
}

export const MOCK_USER: User = {
  id: "dev-mock-user",
  name: "Dev Agent",
  email: "dev@kauridorr.test",
  phone: "+22600000000",
  role: "agent",
};

export const getUserDisplayName = (profile: any, supabaseUser: any): string => {
  if (!profile && !supabaseUser) return "Agent";

  // Colonne name de la table profiles
  if (profile?.name) return profile.name;

  // Fallback sur metadata ou email du user Supabase
  if (supabaseUser?.user_metadata?.name) return supabaseUser.user_metadata.name;
  if (supabaseUser?.email) return supabaseUser.email.split("@")[0];
  if (supabaseUser?.phone) return supabaseUser.phone;

  return "Agent";
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      isInitialized: false,
      isLoadingClients: false,
      user: null,
      registeredPhone: null,

      // ✅ Étape 1 : envoie le code OTP par SMS
      sendOtp: async (phone: string) => {
        const { error } = await supabase.auth.signInWithOtp({ phone });
        if (error) throw new Error(error.message);
      },

      // ✅ Étape 2 : vérifie le code OTP reçu par SMS
      verifyOtp: async (phone: string, token: string) => {
        const { data, error } = await supabase.auth.verifyOtp({
          phone,
          token,
          type: "sms",
        });

        if (error) throw new Error(error.message);

        const supabaseUser = data.user;
        if (!supabaseUser) throw new Error("Utilisateur introuvable");

        // Récupère le profil depuis la table profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, name, agent_code, role, phone")
          .eq("id", supabaseUser.id)
          .single();

        set({
          isAuthenticated: true,
          isLoadingClients: true,
          user: {
            id: supabaseUser.id,
            name: getUserDisplayName(profile, supabaseUser),
            email: supabaseUser.email,
            phone: profile?.phone ?? supabaseUser.phone,
            role: profile?.role ?? "agent",
          },
        });

        // ✅ Load clients and transactions from Supabase after successful login
        try {
          await useClientStore.getState().loadClientsFromSupabase();
          await useTransactionStore.getState().loadTransactionsFromSupabase();
          set({ isLoadingClients: false });
        } catch (error) {
          console.error("Failed to load data after login:", error);
          set({ isLoadingClients: false });
          // Don't throw - login should succeed even if load fails
        }
      },

      // ✅ Saves PIN locally and persists the phone for future PIN-only logins
      savePin: async (phone: string, pin: string) => {
        await AsyncStorage.setItem(`pin_${phone}`, pin);
        set({ registeredPhone: phone });
      },

      // ✅ PIN login: reads registeredPhone from state, validates PIN, loads profile
      verifyPin: async (pin: string) => {
        const phone = useAuthStore.getState().registeredPhone;
        if (!phone) throw new Error("Aucun compte enregistré sur cet appareil");

        const stored = await AsyncStorage.getItem(`pin_${phone}`);
        if (!stored || stored !== pin) throw new Error("PIN incorrect");

        // Re-use the existing Supabase session if still valid
        const { data: { session } } = await supabase.auth.getSession();
        const supabaseUser = session?.user ?? null;

        const { data: profile } = await supabase
          .from("profiles")
          .select("id, name, agent_code, role, phone")
          .eq("phone", phone)
          .single();

        set({
          isAuthenticated: true,
          isLoadingClients: true,
          user: {
            id: profile?.id ?? supabaseUser?.id ?? phone!,
            name: getUserDisplayName(profile, supabaseUser),
            email: supabaseUser?.email,
            phone: profile?.phone ?? phone!,
            role: profile?.role ?? "agent",
          },
        });

        try {
          await useClientStore.getState().loadClientsFromSupabase();
          await useTransactionStore.getState().loadTransactionsFromSupabase();
          set({ isLoadingClients: false });
        } catch {
          set({ isLoadingClients: false });
        }
      },

      // ✅ Déconnexion
      logout: async () => {
        useClientStore.getState().clearAll();
        useTransactionStore.getState().clearAll();
        if (!__DEV__) await supabase.auth.signOut();
        set({ isAuthenticated: false, isLoadingClients: false, user: null });
      },

      // ✅ Dev-only: bypass Supabase and log in instantly with mock user + data
      mockLogin: () => {
        if (!__DEV__) return;
        set({ isAuthenticated: true, isLoadingClients: false, user: MOCK_USER });
        useClientStore.getState().loadDevMocks();
        useTransactionStore.getState().loadDevMocks();
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