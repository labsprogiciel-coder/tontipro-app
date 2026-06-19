// stores/auth-store.ts
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { convex } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { useClientStore } from "@/stores/client-store";
import { useTransactionStore } from "@/stores/transaction-store";
import { useAgentStore } from "@/stores/agent-store";
import { generateId } from "@/utils/id-generator";
import { AgentPermissions, AgentRole, permissionsForRole } from "@/types/agent";

const PHONES_KEY = "kauridorr_registered_phones";

async function addToPhoneRegistry(phone: string) {
  const raw = await AsyncStorage.getItem(PHONES_KEY);
  const phones: string[] = raw ? JSON.parse(raw) : [];
  if (!phones.includes(phone)) {
    await AsyncStorage.setItem(PHONES_KEY, JSON.stringify([...phones, phone]));
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

export type ConvexRole = AgentRole;

export interface User {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: ConvexRole | "agent"; // "agent" = legacy / offline
  branchId?: string;
  currency?: string; // e.g. "FCFA"
  device?: any | null; // null = unbound → triggers binding flow
  status?: string;
  permissions?: AgentPermissions;
}

interface AuthState {
  isAuthenticated: boolean;
  isInitialized: boolean;
  isLoadingClients: boolean;
  user: User | null;
  registeredPhone: string | null;

  // Convex profile sync
  setConvexUser: (convexUser: any) => void;
  fetchCurrentUser: () => Promise<void>;

  // PIN offline login (unchanged)
  verifyPin: (pin: string) => Promise<void>;
  savePin: (phone: string, pin: string) => Promise<void>;
  registerOffline: (phone: string, name: string, role: "agent", pin: string) => Promise<void>;

  updateUser: (fields: Partial<Pick<User, "name" | "email" | "phone">>) => Promise<void>;
  logout: () => void;
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      isInitialized: false,
      isLoadingClients: false,
      user: null,
      registeredPhone: null,

      /**
       * Called from RootLayoutNav when `useQuery(api.users.currentUser)` returns data.
       * Syncs the Convex user profile into the Zustand store.
       */
      setConvexUser: (convexUser: any) => {
        if (!convexUser) return;

        const user: User = {
          id: convexUser._id,
          name: convexUser.fullName ?? "Agent",
          email: convexUser.email,
          phone: convexUser.phoneNumber,
          role: convexUser.role ?? "agent",
          branchId: convexUser.branchId ?? convexUser.tenantId,
          currency: convexUser.organization?.currency ?? "FCFA",
          device: convexUser.device ?? null,
          status: convexUser.status,
          permissions: convexUser.role ? permissionsForRole(convexUser.role as AgentRole) : undefined,
        };

        set({
          isAuthenticated: true,
          user,
        });

        // Load data from Convex
        const loadData = async () => {
          set({ isLoadingClients: true });
          try {
            await useClientStore.getState().loadClientsFromConvex();
            if (user.branchId) {
              await useTransactionStore.getState().loadTransactions(user.branchId);
              await useAgentStore.getState().loadAgents(user.branchId as any);
            }
          } catch (error) {
            console.error("Failed to load data after Convex auth:", error);
          }
          set({ isLoadingClients: false });
        };
        loadData();
      },

      /**
       * Directly query Convex for the current user profile.
       * Used after signIn() from login/register screens.
       */
      fetchCurrentUser: async () => {
        try {
          const convexUser = await convex.query(api.users.currentUser);
          if (!convexUser) return;

          const user: User = {
            id: convexUser._id,
            name: convexUser.fullName ?? "Agent",
            email: convexUser.email,
            phone: convexUser.phoneNumber,
            role: convexUser.role ?? "agent",
            branchId: convexUser.branchId ?? convexUser.tenantId,
            currency: convexUser.organization?.currency ?? "FCFA",
            device: convexUser.device ?? null,
            status: convexUser.status,
            permissions: convexUser.role ? permissionsForRole(convexUser.role as AgentRole) : undefined,
          };

          set({ isAuthenticated: true, user });
        } catch (e) {
          console.error("[Auth] fetchCurrentUser failed:", e);
        }
      },

      savePin: async (phone: string, pin: string) => {
        await AsyncStorage.setItem(`pin_${phone}`, pin);
        await addToPhoneRegistry(phone);
        set({ registeredPhone: phone });
      },

      // Full offline registration — no server call
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
        const legacy = get().registeredPhone;
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

        const pinAgentRecord = useAgentStore.getState().agents.find((a) => a.phoneNumber === matchedPhone);

        set({
          isAuthenticated: true,
          isLoadingClients: true,
          user: localUser ?? {
            id: matchedPhone,
            name: "Agent",
            phone: matchedPhone,
            role: "agent",
            permissions: pinAgentRecord ? permissionsForRole(pinAgentRecord.role) : undefined,
          },
        });

        // Try loading data from Convex (works if online)
        try {
          await useClientStore.getState().loadClientsFromConvex();
        } catch {
          // offline — local data is enough
        }
        set({ isLoadingClients: false });
      },

      updateUser: async (fields) => {
        const current = get().user;
        if (!current) return;
        const updated = { ...current, ...fields };
        set({ user: updated });
        if (updated.phone) {
          await AsyncStorage.setItem(`user_${updated.phone}`, JSON.stringify(updated));
        }
      },

      logout: () => {
        // Convex signOut is handled by the component (useAuthActions().signOut())
        // This just clears local state
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
