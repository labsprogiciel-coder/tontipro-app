import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";

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
  user: User | null;
  // Étape 1 : envoie le SMS OTP
  sendOtp: (phone: string) => Promise<void>;
  // Étape 2 : vérifie le code OTP et connecte l'agent
  verifyOtp: (phone: string, token: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      isInitialized: false,
      user: null,

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
          .select("id, name, email, phone, role")
          .eq("id", supabaseUser.id)
          .single();

        set({
          isAuthenticated: true,
          user: {
            id: supabaseUser.id,
            name: profile?.name ?? "Agent",
            email: profile?.email ?? supabaseUser.email,
            phone: profile?.phone ?? supabaseUser.phone,
            role: profile?.role ?? "agent",
          },
        });
      },

      // ✅ Déconnexion
      logout: async () => {
        await supabase.auth.signOut();
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