import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { generateId } from "@/utils/id-generator";
import { Transaction } from "@/types/transaction";
import { mockTransactions } from "@/mocks/transactions";
import { useClientStore } from "./client-store";

interface TransactionStoreState {
  transactions: Transaction[];
  pendingTransactions: Transaction[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  addTransaction: (transactionData: {
    clientId: string;
    amount: number;
    type: "deposit" | "withdrawal";
    notes?: string;
  }) => Promise<Transaction>;
  getTransactionById: (id: string) => Transaction | undefined;
  getTransactionsByClientId: (clientId: string) => Transaction[];
  syncPendingTransactions: () => Promise<void>;
}

export const useTransactionStore = create<TransactionStoreState>()(
  persist(
    (set, get) => ({
      transactions: mockTransactions,
      pendingTransactions: [],
      isLoading: false,
      error: null,
      
      addTransaction: async (transactionData) => {
        set({ isLoading: true, error: null });
        
        try {
          const clientStore = useClientStore.getState();
          const client = clientStore.getClientById(transactionData.clientId);
          
          if (!client) {
            throw new Error("Client not found");
          }
          
          // For withdrawals, check if client has sufficient balance
          if (transactionData.type === "withdrawal" && client.balance < transactionData.amount) {
            throw new Error("Insufficient balance");
          }
          
          const newTransaction: Transaction = {
            id: generateId("TR"),
            clientId: transactionData.clientId,
            clientName: client.name,
            amount: transactionData.amount,
            type: transactionData.type,
            date: new Date().toISOString(),
            status: "completed", // In a real app, this might be "pending" until synced
            notes: transactionData.notes,
          };
          
          // Update client balance
          const balanceChange = transactionData.type === "deposit" 
            ? transactionData.amount 
            : -transactionData.amount;
            
          await clientStore.updateClientBalance(transactionData.clientId, balanceChange);
          
          set((state) => ({
            transactions: [newTransaction, ...state.transactions],
            isLoading: false,
          }));
          
          return newTransaction;
        } catch (error) {
          set({ 
            isLoading: false, 
            error: error instanceof Error ? error.message : "Failed to add transaction" 
          });
          throw error;
        }
      },
      
      getTransactionById: (id) => {
        return get().transactions.find((transaction) => transaction.id === id);
      },
      
      getTransactionsByClientId: (clientId) => {
        return get().transactions
          .filter((transaction) => transaction.clientId === clientId)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      },
      
      syncPendingTransactions: async () => {
        set({ isLoading: true, error: null });
        
        try {
          // In a real app, this would send pending transactions to the server
          // For now, we'll just mark them as completed
          set((state) => {
            const updatedTransactions = state.transactions.map((transaction) => {
              if (transaction.status === "pending") {
                return { ...transaction, status: "completed" as const };
              }
              return transaction;
            });
            
            return { 
              transactions: updatedTransactions,
              pendingTransactions: [],
              isLoading: false,
            };
          });
        } catch (error) {
          set({ 
            isLoading: false, 
            error: error instanceof Error ? error.message : "Failed to sync transactions" 
          });
          throw error;
        }
      },
    }),
    {
      name: "transaction-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);