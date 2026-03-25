import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { generateId } from "@/utils/id-generator";
import { Transaction } from "@/types/transaction";
import { useClientStore } from "./client-store";

// ✅ Plus d'import de mockTransactions — tableau vide en production
// Les données fictives sont dans __dev__/mocks/transactions.ts si besoin en dev

interface TransactionStoreState {
  transactions: Transaction[];
  pendingTransactions: Transaction[];
  isLoading: boolean;
  error: string | null;

  addTransaction: (transactionData: {
    clientId: string;
    amount: number;
    type: "deposit" | "withdrawal";
    notes?: string;
  }) => Promise<Transaction>;
  getTransactionById: (id: string) => Transaction | undefined;
  getTransactionsByClientId: (clientId: string) => Transaction[];
  syncPendingTransactions: () => Promise<void>;
  loadDevMocks: () => Promise<void>; // ✅ Chargement optionnel des mocks en dev
  clearAll: () => void; // ✅ Nettoie le store (utile si on passe dev=false)
}

export const useTransactionStore = create<TransactionStoreState>()(
  persist(
    (set, get) => ({
      transactions: [], // ✅ Tableau vide — pas de données fictives en production
      pendingTransactions: [],
      isLoading: false,
      error: null,

      // ✅ Charge les mocks uniquement si DEV_LOAD_MOCKS=true dans .env
      loadDevMocks: async () => {
        if (process.env.EXPO_PUBLIC_DEV_LOAD_MOCKS !== "true") return;
        const { mockTransactions } = await import("@/__dev__/mocks/transactions");
        set({ transactions: mockTransactions });
      },

      addTransaction: async (transactionData) => {
        set({ isLoading: true, error: null });
        try {
          const clientStore = useClientStore.getState();
          const client = clientStore.getClientById(transactionData.clientId);

          if (!client) throw new Error("Client not found");

          if (
            transactionData.type === "withdrawal" &&
            client.balance < transactionData.amount
          ) {
            throw new Error("Insufficient balance");
          }

          const newTransaction: Transaction = {
            id: generateId("TR"),
            clientId: transactionData.clientId,
            clientName: client.name,
            amount: transactionData.amount,
            type: transactionData.type,
            date: new Date().toISOString(),
            status: "completed",
            notes: transactionData.notes,
          };

          const balanceChange =
            transactionData.type === "deposit"
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
            error: error instanceof Error ? error.message : "Failed to add transaction",
          });
          throw error;
        }
      },

      getTransactionById: (id) => {
        return get().transactions.find((transaction) => transaction.id === id);
      },

      getTransactionsByClientId: (clientId) => {
        return get()
          .transactions.filter((transaction) => transaction.clientId === clientId)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      },

      syncPendingTransactions: async () => {
        set({ isLoading: true, error: null });
        try {
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
            error: error instanceof Error ? error.message : "Failed to sync transactions",
          });
          throw error;
        }
      },

      clearAll: () => {
        set({ transactions: [], pendingTransactions: [], isLoading: false, error: null });
      },
    }),
    {
      name: "transaction-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);