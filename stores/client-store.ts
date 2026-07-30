// stores/client-store.ts
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { generateId } from "@/utils/id-generator";
import { isConnected } from "@/utils/network";
import { convex } from "@/lib/convex"; // ← your ConvexReactClient instance
import { withAuthRetry } from "@/lib/withAuthRetry";
import { api } from "@/convex/_generated/api"; // ← generated API surface
import { Id } from "@/convex/_generated/dataModel";
import { Client } from "@/types/client";
import { DEV_MOCKS_ENABLED } from "@/__dev__/config";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Maps a raw Convex customer document (snake_case-free, camelCase already)
 * to the local `Client` shape used throughout the UI.
 */
export function customerToClient(c: any): Client {
  return {
    // Identity
    id: c._id as string,
    name: c.fullName,
    phone: c.phoneNumber,
    accountNumber: c.metadata?.accountNumber,
    email: c.metadata?.email,

    // Financials
    balance: c.balance ?? 0,
    savingsGoal: c.metadata?.savingsGoal,

    // Collection settings
    commitmentAmount: c.metadata?.commitmentAmount,
    collectionFrequency: c.metadata?.collectionFrequency,
    collectionDays: c.metadata?.collectionDays,

    // Location / group
    address: c.metadata?.address,
    groupName: c.metadata?.groupName,

    // KYC — Convex status 'verified' ↔ kycVerified: true
    idNumber: c.idNumber,
    kycVerified: c.status === "verified",
    kycDate:
      c.status === "verified" ? new Date(c.createdAt).toISOString() : undefined,

    // Timestamps
    joinDate: new Date(c.createdAt).toISOString(),
    lastDeposit: c.lastDeposit,

    // Status
    status: c.status === "rejected" ? "inactive" : "active",

    // Sync
    syncStatus: "synced" as const,
  };
}

/**
 * Builds the `metadata` object sent to Convex from a Client/clientData payload.
 */
function buildMetadata(
  data: Partial<Client> & {
    address?: string;
    groupName?: string;
    commitmentAmount?: number;
    collectionFrequency?: string;
    collectionDays?: number[];
    savingsGoal?: number;
    accountNumber?: string;
    email?: string;
  },
) {
  return {
    address: data.address,
    groupName: data.groupName,
    commitmentAmount: data.commitmentAmount,
    collectionFrequency: data.collectionFrequency as string | undefined,
    collectionDays: data.collectionDays,
    savingsGoal: data.savingsGoal,
    accountNumber: data.accountNumber,
    email: data.email,
  };
}

// ── Store types ───────────────────────────────────────────────────────────────

interface ClientStoreState {
  clients: Client[];
  isLoading: boolean;
  isLoadingClients: boolean;
  error: string | null;

  // Load clients (local first in dev, Convex in production)
  loadClients: () => Promise<void>;

  // Fetch clients from Convex for the current agent's branch
  loadClientsFromConvex: () => Promise<void>;

  addClient: (clientData: {
    id?: string;
    name: string;
    phone: string;
    accountNumber?: string;
    address?: string;
    email?: string;
    groupName?: string;
    commitmentAmount?: number;
    collectionFrequency?: import("@/types/client").CollectionFrequency;
    collectionDays?: number[];
    savingsGoal?: number;
    initialDeposit?: number;
    idNumber?: string;
    idType?: "cni" | "passport" | "permis" | "autre";
  }) => Promise<Client>;

  updateClient: (id: string, clientData: Partial<Client>) => Promise<Client>;
  getClientById: (id: string) => Client | undefined;
  updateClientBalance: (id: string, amount: number) => Promise<void>;
  reconcileBalances: (
    txList: import("@/types/transaction").Transaction[],
  ) => void;

  // Sync clients marked as 'pending' to Convex when back online
  syncPendingClients: () => Promise<void>;

  loadDevMocks: () => Promise<void>;
  clearAll: () => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useClientStore = create<ClientStoreState>()(
  persist(
    (set, get) => ({
      clients: [],
      isLoading: false,
      isLoadingClients: false,
      error: null,

      // ── loadClients ──────────────────────────────────────────────────────────

      loadClients: async () => {
        if (DEV_MOCKS_ENABLED) {
          set({ isLoadingClients: true, error: null });
          try {
            if (get().clients.length === 0) {
              await get().loadDevMocks();
            }
            set({ isLoadingClients: false });
          } catch (error) {
            set({
              isLoadingClients: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to load clients",
            });
          }
          return;
        }
        await get().loadClientsFromConvex();
      },

      // ── loadClientsFromConvex ────────────────────────────────────────────────

      loadClientsFromConvex: async () => {
        set({ isLoadingClients: true, error: null });
        try {
          // `convex.query` returns a promise when called imperatively
          const rawCustomers = await withAuthRetry(() =>
            convex.query(api.customers.list, {}),
          );
          const clients: Client[] = rawCustomers.map(customerToClient);
          set({ clients, isLoadingClients: false });
        } catch (error) {
          // Offline-first: keep whatever is already persisted locally
          set({
            isLoadingClients: false,
            error:
              error instanceof Error ? error.message : "Failed to load clients",
          });
        }
      },

      // ── loadDevMocks ─────────────────────────────────────────────────────────

      loadDevMocks: async () => {
        if (!DEV_MOCKS_ENABLED) return;
        if (get().clients.length > 0) return;
        const { mockClients } = await import("@/__dev__/mocks/clients");
        const mockClientsWithSync: Client[] = mockClients.map((c) => ({
          ...c,
          syncStatus: "synced" as const,
        }));
        set({ clients: mockClientsWithSync });
      },

      // ── addClient ────────────────────────────────────────────────────────────

      addClient: async (clientData) => {
        set({ isLoading: true, error: null });
        try {
          const online = await isConnected();

          // Optimistic local record (uses a temporary local id until Convex confirms)
          const tempId = clientData.id ?? generateId("CL");
          const newClient: Client = {
            id: tempId,
            name: clientData.name,
            phone: clientData.phone,
            accountNumber: clientData.accountNumber,
            balance: clientData.initialDeposit ?? 0,
            joinDate: new Date().toISOString(),
            status: "active",
            address: clientData.address,
            email: clientData.email,
            groupName: clientData.groupName,
            commitmentAmount: clientData.commitmentAmount,
            collectionFrequency: clientData.collectionFrequency,
            collectionDays: clientData.collectionDays,
            savingsGoal: clientData.savingsGoal,
            idNumber: clientData.idNumber,
            kycVerified: !!clientData.idNumber,
            kycDate: clientData.idNumber ? new Date().toISOString() : undefined,
            syncStatus: online ? ("synced" as const) : ("pending" as const),
          };

          // Optimistic update — add to local store immediately
          set((state) => ({
            clients: [...state.clients, newClient],
            isLoading: false,
          }));

          // If online, sync to Convex in background
          if (online) {
            (async () => {
              try {
                const convexId = await convex.mutation(
                  api.customers.createProspect,
                  {
                    fullName: clientData.name,
                    phoneNumber: clientData.phone,
                    idNumber: clientData.idNumber,
                    balance: clientData.initialDeposit ?? 0,
                    metadata: buildMetadata(clientData as any),
                  },
                );

                // Replace the temp local id with the real Convex _id
                set((state) => ({
                  clients: state.clients.map((c) =>
                    c.id === tempId
                      ? {
                          ...c,
                          id: convexId as string,
                          syncStatus: "synced" as const,
                        }
                      : c,
                  ),
                }));
              } catch (error) {
                console.error("Failed to sync new client to Convex:", error);
                set((state) => ({
                  clients: state.clients.map((c) =>
                    c.id === tempId
                      ? { ...c, syncStatus: "pending" as const }
                      : c,
                  ),
                }));
              }
            })();
          }

          return newClient;
        } catch (error) {
          set({
            isLoading: false,
            error:
              error instanceof Error ? error.message : "Failed to add client",
          });
          throw error;
        }
      },

      // ── updateClient ─────────────────────────────────────────────────────────

      updateClient: async (id, clientData) => {
        set({ isLoading: true, error: null });
        try {
          const online = await isConnected();
          let updatedClient: Client | undefined;

          // Optimistic update locally
          set((state) => {
            const updatedClients = state.clients.map((client) => {
              if (client.id === id) {
                updatedClient = {
                  ...client,
                  ...clientData,
                  syncStatus: online
                    ? ("synced" as const)
                    : ("pending" as const),
                };
                return updatedClient;
              }
              return client;
            });
            return { clients: updatedClients, isLoading: false };
          });

          if (!updatedClient) throw new Error("Client not found");

          // Sync to Convex in background if online
          if (online) {
            (async () => {
              try {
                // Separate top-level fields from metadata fields
                const { name, phone, idNumber, balance, status, ...rest } =
                  clientData as any;

                // Build the metadata patch from whatever was changed
                const metadataPatch = buildMetadata(rest);
                const hasMetadata = Object.values(metadataPatch).some(
                  (v) => v !== undefined,
                );

                await convex.mutation(api.customers.update, {
                  id: id as Id<"customers">,
                  ...(name !== undefined && { fullName: name }),
                  ...(phone !== undefined && { phoneNumber: phone }),
                  ...(idNumber !== undefined && { idNumber }),
                  ...(balance !== undefined && { balance }),
                  ...(status !== undefined && {
                    // Map local status string to Convex enum
                    status: status === "active" ? "prospect" : "rejected",
                  }),
                  ...(hasMetadata && { metadata: metadataPatch }),
                });

                set((state) => ({
                  clients: state.clients.map((c) =>
                    c.id === id ? { ...c, syncStatus: "synced" as const } : c,
                  ),
                }));
              } catch (error) {
                console.error("Failed to sync client update to Convex:", error);
                set((state) => ({
                  clients: state.clients.map((c) =>
                    c.id === id ? { ...c, syncStatus: "pending" as const } : c,
                  ),
                }));
              }
            })();
          }

          return updatedClient;
        } catch (error) {
          set({
            isLoading: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to update client",
          });
          throw error;
        }
      },

      // ── getClientById ────────────────────────────────────────────────────────

      getClientById: (id) => {
        return get().clients.find((client) => client.id === id);
      },

      // ── updateClientBalance ──────────────────────────────────────────────────

      updateClientBalance: async (id, amount) => {
        set({ isLoading: true, error: null });
        try {
          const online = await isConnected();

          // Optimistic balance update
          set((state) => {
            const updatedClients = state.clients.map((client) => {
              if (client.id === id) {
                return {
                  ...client,
                  balance: client.balance + amount,
                  lastDeposit:
                    amount > 0 ? new Date().toISOString() : client.lastDeposit,
                  syncStatus: online
                    ? ("synced" as const)
                    : ("pending" as const),
                };
              }
              return client;
            });
            return { clients: updatedClients, isLoading: false };
          });

          if (online) {
            (async () => {
              try {
                await convex.mutation(api.customers.updateBalance, {
                  id: id as Id<"customers">,
                  delta: amount,
                });
              } catch (error) {
                console.error("Failed to sync balance to Convex:", error);
              }
            })();
          }
        } catch (error) {
          set({
            isLoading: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to update balance",
          });
          throw error;
        }
      },

      // ── syncPendingClients ───────────────────────────────────────────────────

      syncPendingClients: async () => {
        const { clients } = get();
        const pendingClients = clients.filter(
          (c) => c.syncStatus === "pending",
        );
        if (pendingClients.length === 0) return;

        set({ isLoading: true, error: null });
        try {
          for (const client of pendingClients) {
            try {
              // Attempt upsert: try update first, fall back to create
              let convexId: string | null = null;
              try {
                await convex.mutation(api.customers.update, {
                  id: client.id as Id<"customers">,
                  fullName: client.name,
                  phoneNumber: client.phone,
                  idNumber: client.idNumber,
                  balance: client.balance,
                  metadata: buildMetadata(client),
                });
                convexId = client.id;
              } catch {
                // Customer doesn't exist yet — create it
                const newId = await convex.mutation(
                  api.customers.createProspect,
                  {
                    fullName: client.name,
                    phoneNumber: client.phone,
                    idNumber: client.idNumber,
                    balance: client.balance,
                    metadata: buildMetadata(client),
                  },
                );
                convexId = newId as string;
              }

              set((state) => ({
                clients: state.clients.map((c) =>
                  c.id === client.id
                    ? { ...c, id: convexId!, syncStatus: "synced" as const }
                    : c,
                ),
              }));
            } catch (error) {
              console.error(`Failed to sync client ${client.id}:`, error);
              // Leave as pending — will retry on next call
            }
          }

          set({ isLoading: false });
        } catch (error) {
          console.error("Sync pending clients failed:", error);
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : "Sync failed",
          });
        }
      },

      // ── reconcileBalances ────────────────────────────────────────────────────

      reconcileBalances: (txList) => {
        set((state) => ({
          clients: state.clients.map((client) => {
            const balance = txList
              .filter((t) => t.clientId === client.id)
              .reduce(
                (sum, t) => sum + (t.type === "deposit" ? t.amount : -t.amount),
                0,
              );
            return { ...client, balance: Math.max(0, balance) };
          }),
        }));
      },

      // ── clearAll ─────────────────────────────────────────────────────────────

      clearAll: () => {
        set({
          clients: [],
          isLoading: false,
          isLoadingClients: false,
          error: null,
        });
      },
    }),
    {
      name: "client-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Only persist clients, not transient loading states
        clients: state.clients,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isLoading = false;
          state.isLoadingClients = false;
        }
      },
    },
  ),
);
