import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { useClientStore } from "@/stores/client-store";
import { useTransactionStore } from "@/stores/transaction-store";
import { useAgentStore } from "@/stores/agent-store";
import { generateId } from "@/utils/id-generator";
import { AgentPermissions } from "@/types/agent";

const PHONES_KEY = "kauridorr_registered_phones";

async function addToPhoneRegistry(phone: string) {
  const raw = await AsyncStorage.getItem(PHONES_KEY);
  const phones: string[] = raw ? JSON.parse(raw) : [];
  if (!phones.includes(phone)) {
    await AsyncStorage.setItem(PHONES_KEY, JSON.stringify([...phones, phone]));
  }
}

export interface User {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: "agent";
  permissions?: AgentPermissions; // undefined = admin (all permissions)
}

interface AuthState {
  isAuthenticated: boolean;
  isInitialized: boolean;
  isLoadingClients: boolean;
  user: User | null;
  registeredPhone: string | null;
  sendOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, token: string) => Promise<void>;
  verifyPin: (pin: string) => Promise<void>;
  savePin: (phone: string, pin: string) => Promise<void>;
  registerOffline: (phone: string, name: string, role: "agent", pin: string) => Promise<void>;
  updateUser: (fields: Partial<Pick<User, "name" | "email" | "phone">>) => Promise<void>;
  logout: () => Promise<void>;
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
  if (profile?.name) return profile.name;
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

      sendOtp: async (phone: string) => {
        const { error } = await supabase.auth.signInWithOtp({ phone });
        if (error) throw new Error(error.message);
      },

      verifyOtp: async (phone: string, token: string) => {
        const { data, error } = await supabase.auth.verifyOtp({
          phone,
          token,
          type: "sms",
        });
        if (error) throw new Error(error.message);

        const supabaseUser = data.user;
        if (!supabaseUser) throw new Error("Utilisateur introuvable");

        const { data: profile } = await supabase
          .from("profiles")
          .select("id, name, agent_code, role, phone")
          .eq("id", supabaseUser.id)
          .single();

        const otpAgentRecord = useAgentStore.getState().agents.find((a) => a.phone === phone);
        set({
          isAuthenticated: true,
          isLoadingClients: true,
          user: {
            id: supabaseUser.id,
            name: getUserDisplayName(profile, supabaseUser),
            email: supabaseUser.email,
            phone: profile?.phone ?? supabaseUser.phone,
            role: profile?.role ?? "agent",
            permissions: otpAgentRecord?.permissions,
          },
        });

        try {
          await useClientStore.getState().loadClientsFromSupabase();
          await useTransactionStore.getState().loadTransactionsFromSupabase();
          await useAgentStore.getState().loadAgentsFromSupabase();
          set({ isLoadingClients: false });
        } catch (error) {
          console.error("Failed to load data after login:", error);
          set({ isLoadingClients: false });
        }
      },

      savePin: async (phone: string, pin: string) => {
        await AsyncStorage.setItem(`pin_${phone}`, pin);
        await addToPhoneRegistry(phone);
        set({ registeredPhone: phone });
      },

      // Full offline registration — no OTP needed
      registerOffline: async (phone: string, name: string, role: "agent", pin: string) => {
        const id = generateId("USR");
        const user: User = { id, name, phone, role };

        await AsyncStorage.setItem(`pin_${phone}`, pin);
        await AsyncStorage.setItem(`user_${phone}`, JSON.stringify(user));
        await addToPhoneRegistry(phone);

        set({
          isAuthenticated: true,
          isLoadingClients: false,
          registeredPhone: phone,
          user,
        });

      },

      verifyPin: async (pin: string) => {
        const raw = await AsyncStorage.getItem(PHONES_KEY);
        const phones: string[] = raw ? JSON.parse(raw) : [];

        // Include legacy registeredPhone for installs that predate the registry
        const legacy = useAuthStore.getState().registeredPhone;
        if (legacy && !phones.includes(legacy)) phones.unshift(legacy);

        if (phones.length === 0) throw new Error("Aucun compte enregistré sur cet appareil");

        let matchedPhone: string | null = null;
        for (const p of phones) {
          const stored = await AsyncStorage.getItem(`pin_${p}`);
          if (stored === pin) { matchedPhone = p; break; }
        }
        if (!matchedPhone) throw new Error("PIN incorrect");

        // Load locally-saved user profile as offline fallback
        const localRaw = await AsyncStorage.getItem(`user_${matchedPhone}`);
        const localUser: User | null = localRaw ? JSON.parse(localRaw) : null;

        // Try Supabase — fail gracefully when offline
        let supabaseUser = null;
        let profile = null;
        try {
          const { data: { session } } = await supabase.auth.getSession();
          supabaseUser = session?.user ?? null;
          const { data } = await supabase
            .from("profiles")
            .select("id, name, agent_code, role, phone")
            .eq("phone", matchedPhone)
            .single();
          profile = data;
        } catch {
          // offline — use local data below
        }

        const pinAgentRecord = useAgentStore.getState().agents.find((a) => a.phone === matchedPhone);
        set({
          isAuthenticated: true,
          isLoadingClients: true,
          user: {
            id: profile?.id ?? supabaseUser?.id ?? localUser?.id ?? matchedPhone,
            name: profile?.name ?? localUser?.name ?? getUserDisplayName(null, supabaseUser),
            email: supabaseUser?.email ?? localUser?.email,
            phone: profile?.phone ?? localUser?.phone ?? matchedPhone,
            role: profile?.role ?? localUser?.role ?? "agent",
            permissions: pinAgentRecord?.permissions,
          },
        });

        try {
          await useClientStore.getState().loadClientsFromSupabase();
          await useTransactionStore.getState().loadTransactionsFromSupabase();
          await useAgentStore.getState().loadAgentsFromSupabase();
          set({ isLoadingClients: false });
        } catch {
          set({ isLoadingClients: false });
        }
      },

      updateUser: async (fields) => {
        const current = useAuthStore.getState().user;
        if (!current) return;
        const updated = { ...current, ...fields };
        set({ user: updated });
        if (updated.phone) {
          await AsyncStorage.setItem(`user_${updated.phone}`, JSON.stringify(updated));
        }
        try {
          await supabase
            .from("profiles")
            .update({ name: updated.name, phone: updated.phone })
            .eq("id", current.id);
        } catch {
          // offline — local update already applied
        }
      },

      logout: async () => {
        try { await supabase.auth.signOut(); } catch { /* offline */ }
        set({ isAuthenticated: false, isLoadingClients: false, user: null });
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        return () => {
          if (state) state.isInitialized = true;
        };
      },
    }
  )
);
