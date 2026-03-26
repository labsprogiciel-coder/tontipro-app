import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { generateId } from "@/utils/id-generator";
import { Client } from "@/types/client";

interface ClientStoreState {
  clients: Client[];
  pendingClients: Client[]; // ✅ Clients en attente de sync
  isLoading: boolean;
  error: string | null;

  addClient: (clientData: {
    name: string;
    phone: string;
    address?: string;
    initialDeposit?: number;
    idNumber?: string;
    idType?: "cni" | "passport" | "permis" | "autre";
  }) => Promise<Client>;
  updateClient: (id: string, clientData: Partial<Client>) => Promise<Client>;
  getClientById: (id: string) => Client | undefined;
  updateClientBalance: (id: string, amount: number) => Promise<void>;
  syncPendingClients: () => Promise<void>; // ✅ Sync hors ligne → en ligne
  loadDevMocks: () => Promise<void>;
  clearAll: () => void;
}

export const useClientStore = create<ClientStoreState>()(
  persist(
    (set, get) => ({
      clients: [],
      pendingClients: [], // ✅ Tableau des clients en attente de sync
      isLoading: false,
      error: null,

      loadDevMocks: async () => {
        if (process.env.EXPO_PUBLIC_DEV_LOAD_MOCKS !== "true") return;
        const { mockClients } = await import("@/__dev__/mocks/clients");
        set({ clients: mockClients });
      },

      addClient: async (clientData) => {
        set({ isLoading: true, error: null });
        try {
          const newClient: Client = {
            id: generateId("CL"),
            name: clientData.name,
            phone: clientData.phone,
            balance: clientData.initialDeposit || 0,
            joinDate: new Date().toISOString(),
            status: "active",
            idNumber: clientData.idNumber,
            idType: clientData.idType,
            kycVerified: !!clientData.idNumber,
            kycDate: clientData.idNumber ? new Date().toISOString() : undefined,
          };

          set((state) => ({
            clients: [...state.clients, newClient],
            isLoading: false,
          }));

          return newClient;
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : "Failed to add client",
          });
          throw error;
        }
      },

      updateClient: async (id, clientData) => {
        set({ isLoading: true, error: null });
        try {
          let updatedClient: Client | undefined;

          set((state) => {
            const updatedClients = state.clients.map((client) => {
              if (client.id === id) {
                updatedClient = { ...client, ...clientData };
                return updatedClient;
              }
              return client;
            });
            return { clients: updatedClients, isLoading: false };
          });

          if (!updatedClient) throw new Error("Client not found");
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
          set((state) => {
            const updatedClients = state.clients.map((client) => {
              if (client.id === id) {
                return {
                  ...client,
                  balance: client.balance + amount,
                  lastDeposit: amount > 0 ? new Date().toISOString() : client.lastDeposit,
                };
              }
              return client;
            });
            return { clients: updatedClients, isLoading: false };
          });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : "Failed to update balance",
          });
          throw error;
        }
      },

      // ✅ Sync les clients en attente quand l'appareil revient en ligne
      syncPendingClients: async () => {
        const { pendingClients } = get();
        if (pendingClients.length === 0) return;

        set({ isLoading: true, error: null });
        try {
          // Pour l'instant marque tous les pending comme syncés
          // À remplacer par un vrai appel Supabase dans une prochaine issue
          set((state) => ({
            clients: [
              ...state.clients,
              ...state.pendingClients.filter(
                (pc) => !state.clients.find((c) => c.id === pc.id)
              ),
            ],
            pendingClients: [],
            isLoading: false,
          }));
        } catch (error) {
          // ✅ Erreur silencieuse — les items restent en pending pour réessayer
          console.error("Sync clients failed:", error);
          set({ isLoading: false, error: error instanceof Error ? error.message : "Sync failed" });
        }
      },

      clearAll: () => {
        set({ clients: [], pendingClients: [], isLoading: false, error: null });
      },
    }),
    {
      name: "client-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);