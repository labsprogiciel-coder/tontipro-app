import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { generateId } from "@/utils/id-generator";
import { Client } from "@/types/client";
import { mockClients } from "@/mocks/clients";

interface ClientStoreState {
  clients: Client[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
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
}

export const useClientStore = create<ClientStoreState>()(
  persist(
    (set, get) => ({
      clients: mockClients,
      isLoading: false,
      error: null,
      
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
            error: error instanceof Error ? error.message : "Failed to add client" 
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
          
          if (!updatedClient) {
            throw new Error("Client not found");
          }
          
          return updatedClient;
        } catch (error) {
          set({ 
            isLoading: false, 
            error: error instanceof Error ? error.message : "Failed to update client" 
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
            error: error instanceof Error ? error.message : "Failed to update balance" 
          });
          throw error;
        }
      },
    }),
    {
      name: "client-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);