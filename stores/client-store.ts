import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { generateId } from "@/utils/id-generator";
import { isConnected } from "@/utils/network";
import { supabase } from "@/lib/supabase";
import { Client } from "@/types/client";
import { DEV_MOCKS_ENABLED } from "@/__dev__/config";

interface ClientStoreState {
  clients: Client[];
  isLoading: boolean;
  isLoadingClients: boolean;
  error: string | null;

  // ✅ Fetch clients from Supabase for the current agent
  loadClientsFromSupabase: () => Promise<void>;
  
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
  reconcileBalances: (txList: import("@/types/transaction").Transaction[]) => void;

  // ✅ Sync clients marked as 'pending' to Supabase when back online
  syncPendingClients: () => Promise<void>;
  
  loadDevMocks: () => Promise<void>;
  clearAll: () => void;
}

export const useClientStore = create<ClientStoreState>()(
  persist(
    (set, get) => ({
      clients: [],
      isLoading: false,
      isLoadingClients: false,
      error: null,

      // ✅ Fetch all clients from Supabase for the current agent
      loadClientsFromSupabase: async () => {
        set({ isLoadingClients: true, error: null });
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (!user) {
            // ✅ No authenticated user - fallback to dev mocks in dev mode
            if (DEV_MOCKS_ENABLED) {
              console.warn("No authenticated user, loading dev mocks instead");
              await get().loadDevMocks();
              set({ isLoadingClients: false });
              return;
            }
            set({ clients: [], isLoadingClients: false, error: null });
            return;
          }

          // ✅ Query clients where agent_id = auth.uid() (enforced by RLS)
          const { data: supabaseClients, error } = await supabase
            .from("clients")
            .select("*")
            .eq("agent_id", user.id);

          if (error) {
            throw new Error(error.message);
          }

          // ✅ Transform Supabase data (snake_case) to Client type (camelCase)
          const clients: Client[] = (supabaseClients || []).map((client: any) => ({
            id: client.id,
            name: client.name,
            phone: client.phone,
            accountNumber: client.account_number,
            balance: client.balance,
            joinDate: client.join_date,
            lastDeposit: client.last_deposit,
            status: client.status,
            address: client.address,
            email: client.email,
            groupName: client.group_name,
            commitmentAmount: client.commitment_amount,
            collectionFrequency: client.collection_frequency,
            collectionDays: client.collection_days,
            savingsGoal: client.savings_goal,
            idNumber: client.id_number,
            idType: client.id_type,
            kycVerified: client.kyc_verified,
            kycDate: client.kyc_date,
            syncStatus: "synced" as const,
          }));

          set({ clients, isLoadingClients: false });
        } catch (error) {
          set({
            isLoadingClients: false,
            error: error instanceof Error ? error.message : "Failed to load clients",
          });
          throw error;
        }
      },

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

      // ✅ Add client - optimistic update, sync in background
      addClient: async (clientData) => {
        set({ isLoading: true, error: null });
        try {
          const online = await isConnected();

          const newClient: Client = {
            id: clientData.id ?? generateId("CL"),
            name: clientData.name,
            phone: clientData.phone,
            accountNumber: clientData.accountNumber,
            balance: clientData.initialDeposit || 0,
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
            idType: clientData.idType,
            kycVerified: !!clientData.idNumber,
            kycDate: clientData.idNumber ? new Date().toISOString() : undefined,
            syncStatus: online ? ("synced" as const) : ("pending" as const),
          };

          // ✅ Optimistic update - add to local store immediately
          set((state) => ({
            clients: [...state.clients, newClient],
            isLoading: false,
          }));

          // ✅ If online, sync to Supabase in background (non-blocking)
          if (online) {
            const {
              data: { user },
            } = await supabase.auth.getUser();

            if (user) {
              // ✅ Insert to Supabase (background sync - don't await)
              (async () => {
                try {
                  await supabase.from("clients").insert({
                    id: newClient.id,
                    name: newClient.name,
                    phone: newClient.phone,
                    account_number: newClient.accountNumber,
                    balance: newClient.balance,
                    join_date: newClient.joinDate,
                    status: newClient.status,
                    address: newClient.address,
                    email: newClient.email,
                    group_name: newClient.groupName,
                    commitment_amount: newClient.commitmentAmount,
                    collection_frequency: newClient.collectionFrequency,
                    collection_days: newClient.collectionDays,
                    savings_goal: newClient.savingsGoal,
                    id_number: newClient.idNumber,
                    id_type: newClient.idType,
                    kyc_verified: newClient.kycVerified,
                    kyc_date: newClient.kycDate,
                    agent_id: user.id,
                  });
                  // Mark as synced when confirmed
                  set((state) => ({
                    clients: state.clients.map((c) =>
                      c.id === newClient.id ? { ...c, syncStatus: "synced" as const } : c
                    ),
                  }));
                } catch (error) {
                  console.error("Failed to sync new client to Supabase:", error);
                  // Mark as pending for retry
                  set((state) => ({
                    clients: state.clients.map((c) =>
                      c.id === newClient.id ? { ...c, syncStatus: "pending" as const } : c
                    ),
                  }));
                }
              })();
            }
          }

          return newClient;
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : "Failed to add client",
          });
          throw error;
        }
      },

      // ✅ Update client - optimistic update, sync in background
      updateClient: async (id, clientData) => {
        set({ isLoading: true, error: null });
        try {
          const online = await isConnected();
          let updatedClient: Client | undefined;

          // ✅ Optimistic update - update locally immediately
          set((state) => {
            const updatedClients = state.clients.map((client) => {
              if (client.id === id) {
                updatedClient = {
                  ...client,
                  ...clientData,
                  syncStatus: online ? ("synced" as const) : ("pending" as const),
                };
                return updatedClient;
              }
              return client;
            });
            return { clients: updatedClients, isLoading: false };
          });

          if (!updatedClient) throw new Error("Client not found");

          // ✅ If online, sync to Supabase in background
          if (online) {
            const {
              data: { user },
            } = await supabase.auth.getUser();

            if (user) {
              // Prepare update data with snake_case column names
              const updateData: Record<string, any> = {};
              Object.entries(clientData).forEach(([key, value]) => {
                // Convert camelCase to snake_case
                const snakeKey = key
                  .replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
                  .replace(/^_/, "");
                updateData[snakeKey] = value;
              });

              // ✅ Update Supabase (background sync)
              (async () => {
                try {
                  await supabase
                    .from("clients")
                    .update(updateData)
                    .eq("id", id)
                    .eq("agent_id", user.id);
                  // Mark as synced when confirmed
                  set((state) => ({
                    clients: state.clients.map((c) =>
                      c.id === id ? { ...c, syncStatus: "synced" as const } : c
                    ),
                  }));
                } catch (error: any) {
                  console.error("Failed to sync client update to Supabase:", error);
                  // Mark as pending for retry
                  set((state) => ({
                    clients: state.clients.map((c) =>
                      c.id === id ? { ...c, syncStatus: "pending" as const } : c
                    ),
                  }));
                }
              })();
            }
          }

          return updatedClient;
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : "Failed to update client",
          });
          throw error;
        }
      },

      getClientById: (id) => {
        return get().clients.find((client) => client.id === id);
      },

      updateClientBalance: async (id, amount) => {
        set({ isLoading: true, error: null });
        try {
          const online = await isConnected();

          set((state) => {
            const updatedClients = state.clients.map((client) => {
              if (client.id === id) {
                return {
                  ...client,
                  balance: client.balance + amount,
                  lastDeposit:
                    amount > 0 ? new Date().toISOString() : client.lastDeposit,
                  syncStatus: online ? ("synced" as const) : ("pending" as const),
                };
              }
              return client;
            });
            return { clients: updatedClients, isLoading: false };
          });

          // ✅ Sync balance update to Supabase if online
          if (online) {
            const {
              data: { user },
            } = await supabase.auth.getUser();

            if (user) {
              const client = get().clients.find((c) => c.id === id);
              if (client) {
                (async () => {
                  try {
                    await supabase
                      .from("clients")
                      .update({ balance: client.balance })
                      .eq("id", id)
                      .eq("agent_id", user.id);
                  } catch (error: any) {
                    console.error("Failed to sync balance to Supabase:", error);
                  }
                })();
              }
            }
          }
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : "Failed to update balance",
          });
          throw error;
        }
      },

      // ✅ Sync all pending clients to Supabase
      syncPendingClients: async () => {
        const { clients } = get();
        const pendingClients = clients.filter((c) => c.syncStatus === "pending");

        if (pendingClients.length === 0) return;

        set({ isLoading: true, error: null });
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (!user) {
            throw new Error("No authenticated user");
          }

          // ✅ Sync each pending client
          for (const client of pendingClients) {
            const { id, ...clientData } = client;

            // Check if client exists in Supabase
            const { data: existing } = await supabase
              .from("clients")
              .select("id")
              .eq("id", id)
              .eq("agent_id", user.id)
              .single();

            if (existing) {
              // ✅ Update existing client
              const updateData: Record<string, any> = {};
              Object.entries(clientData).forEach(([key, value]) => {
                if (key !== "syncStatus") {
                  const snakeKey = key
                    .replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
                    .replace(/^_/, "");
                  updateData[snakeKey] = value;
                }
              });

              await supabase
                .from("clients")
                .update(updateData)
                .eq("id", id)
                .eq("agent_id", user.id);
            } else {
              // ✅ Insert new client
              await supabase.from("clients").insert({
                id: client.id,
                name: client.name,
                phone: client.phone,
                account_number: client.accountNumber,
                balance: client.balance,
                join_date: client.joinDate,
                status: client.status,
                address: client.address,
                email: client.email,
                group_name: client.groupName,
                commitment_amount: client.commitmentAmount,
                collection_frequency: client.collectionFrequency,
                collection_days: client.collectionDays,
                savings_goal: client.savingsGoal,
                id_number: client.idNumber,
                id_type: client.idType,
                kyc_verified: client.kycVerified,
                kyc_date: client.kycDate,
                agent_id: user.id,
              });
            }

            // ✅ Mark as synced
            set((state) => ({
              clients: state.clients.map((c) =>
                c.id === id ? { ...c, syncStatus: "synced" } : c
              ),
            }));
          }

          set({ isLoading: false });
        } catch (error) {
          // ✅ Silent error - items remain pending for retry
          console.error("Sync pending clients failed:", error);
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : "Sync failed",
          });
        }
      },

      reconcileBalances: (txList) => {
        set((state) => ({
          clients: state.clients.map((client) => {
            const balance = txList
              .filter((t) => t.clientId === client.id)
              .reduce((sum, t) => sum + (t.type === "deposit" ? t.amount : -t.amount), 0);
            return { ...client, balance: Math.max(0, balance) };
          }),
        }));
      },

      clearAll: () => {
        set({ clients: [], isLoading: false, isLoadingClients: false, error: null });
      },
    }),
    {
      name: "client-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // ✅ Only persist clients, not loading states
        clients: state.clients,
      }),
      onRehydrateStorage: () => (state) => {
        // ✅ Reset loading states after rehydration
        if (state) {
          state.isLoading = false;
          state.isLoadingClients = false;
        }
      },
    }
  )
);