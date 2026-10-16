// stores/auth-store.ts
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { convex } from "@/lib/convex";
import { withAuthRetry } from "@/lib/withAuthRetry";
import * as adminApi from "@/lib/admin-api";
import type { AdminMe } from "@/lib/admin-api";
import { useClientStore } from "@/stores/client-store";
import { useTransactionStore } from "@/stores/transaction-store";
import { generateId } from "@/utils/id-generator";
import { AgentPermissions, AgentRole, permissionsForRole } from "@/types/agent";
import { clearOfflineCredential } from "@/utils/secure-storage";
import { setSentryUser } from "@/lib/sentry";

const PHONES_KEY = "kauridorr_registered_phones";

// `users:me` est une query réactive : elle se redéclenche à chaque
// changement du document (device, statut, etc.), pas seulement à la
// connexion. Sans ce garde, `setConvexUser` relançait loadClients/
// loadTransactions/loadAgents à chaque mise à jour, créant des appels
// concurrents redondants avec ceux de dashboard.tsx et multipliant les
// occasions de retomber sur la course d'authentification token/transport.
let lastLoadedUserId: string | null = null;

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
  branchName?: string;
  currency?: string; // e.g. "FCFA"
  device?: any | null; // null = unbound → triggers binding flow
  status?: string;
  permissions?: AgentPermissions;
  mustChangePassword?: boolean;
  passwordSetAt?: number | null;
  lockedUntil?: number | null;
  organization?: {
    name: string;
    currency: string;
  };
}

interface AuthState {
  isAuthenticated: boolean;
  isInitialized: boolean;
  isLoadingClients: boolean;
  user: User | null;
  registeredPhone: string | null;

  // Convex profile sync
  setConvexUser: (convexUser: AdminMe) => void;
  fetchCurrentUser: () => Promise<void>;

  // PIN offline login (unchanged)
  verifyPin: (pin: string) => Promise<void>;
  savePin: (phone: string, pin: string) => Promise<void>;
  registerOffline: (
    phone: string,
    name: string,
    role: "agent",
    pin: string,
  ) => Promise<void>;

  logout: () => void;
}

/**
 * Build the store's user from the admin backend's users:me. The admin backend
 * has no forced password change, password expiry or server-side lockout, so
 * those fields are left unset. The first role decides the app's permissions.
 */
export function userFromMe(me: Extract<AdminMe, { active: true }>): User {
  const role: AgentRole | undefined = me.roles[0];
  return {
    id: me.id,
    name: me.name,
    email: me.email,
    phone: me.phoneNumber,
    role: role ?? "agent",
    branchId: me.branchId,
    branchName: me.branch ?? undefined,
    currency: me.organization?.currency ?? "FCFA",
    device: me.device,
    status: "active",
    permissions: role ? permissionsForRole(role) : undefined,
    mustChangePassword: false,
    passwordSetAt: null,
    lockedUntil: null,
    organization: me.organization
      ? { name: me.organization.name, currency: me.organization.currency }
      : undefined,
  };
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
       * Called from RootLayoutNav when `useQuery(adminApi.me)` returns data.
       * Syncs the Convex user profile into the Zustand store.
       */
      setConvexUser: (convexUser: AdminMe) => {
        if (!convexUser) return;
        if (!convexUser.active) {
          // Suspendu : le serveur ferme ses sessions et refuse toute nouvelle
          // connexion ; on vide l'état local pour que le garde de navigation
          // renvoie vers /login.
          lastLoadedUserId = null;
          set({ isAuthenticated: false, user: null });
          return;
        }
        const user = userFromMe(convexUser);
        setSentryUser(user.id);

        set({
          isAuthenticated: true,
          user,
        });

        // Ne charger qu'une fois par session — pas à chaque re-déclenchement
        // réactif de users:me (voir `lastLoadedUserId` ci-dessus).
        if (lastLoadedUserId === user.id) return;
        lastLoadedUserId = user.id;

        // Load data from Convex
        const loadData = async () => {
          set({ isLoadingClients: true });
          try {
            await useClientStore.getState().loadClientsFromConvex();
            if (user.branchId) {
              await useTransactionStore
                .getState()
                .loadTransactions(user.branchId);
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
          const convexUser = await withAuthRetry(() => convex.query(adminApi.me, {}));
          if (!convexUser) return;
          // Le serveur refuse déjà la connexion d'un compte suspendu ; ce cas
          // ne survient que si la suspension tombe entre signIn et cette query.
          if (!convexUser.active) {
            set({ isAuthenticated: false, user: null });
            return;
          }
          set({ isAuthenticated: true, user: userFromMe(convexUser) });
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
      registerOffline: async (
        phone: string,
        name: string,
        role: "agent",
        pin: string,
      ) => {
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

        if (phones.length === 0)
          throw new Error("Aucun compte enregistré sur cet appareil");

        let matchedPhone: string | null = null;
        for (const p of phones) {
          const stored = await AsyncStorage.getItem(`pin_${p}`);
          if (stored === pin) {
            matchedPhone = p;
            break;
          }
        }
        if (!matchedPhone) throw new Error("PIN incorrect");

        // Load locally-saved user profile as offline fallback
        const localRaw = await AsyncStorage.getItem(`user_${matchedPhone}`);
        const localUser: User | null = localRaw ? JSON.parse(localRaw) : null;

        set({
          isAuthenticated: true,
          isLoadingClients: true,
          user: localUser ?? {
            id: matchedPhone,
            name: "Agent",
            phone: matchedPhone,
            role: "agent",
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

      logout: () => {
        // Convex signOut is handled by the component (useAuthActions().signOut())
        // This just clears local state
        const phone = get().user?.phone;
        lastLoadedUserId = null;
        set({ isAuthenticated: false, isLoadingClients: false, user: null });
        setSentryUser(null);
        // Un logout peut signifier que le téléphone change de main (agent
        // suivant sur un TPE partagé) — on efface le secret de
        // déverrouillage hors-ligne de l'agent précédent (voir
        // utils/secure-storage.ts). Fire-and-forget : logout() reste
        // synchrone, rien n'attend cette purge.
        if (phone) {
          clearOfflineCredential(phone).catch((e) =>
            console.error("[Auth] clearOfflineCredential failed:", e),
          );
        }
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
    },
  ),
);
