import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { generateId } from "@/utils/id-generator";
import { Transaction } from "@/types/transaction";
import { useClientStore } from "./client-store";

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
  loadDevMocks: () => Promise<void>;
  clearAll: () => void;
}

export const useTransactionStore = create<TransactionStoreState>()(
  persist(
    (set, get) => ({
      transactions: [],
      pendingTransactions: [],
      isLoading: false,
      error: null,

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

      // ✅ Sync les transactions en attente quand l'appareil revient en ligne
      syncPendingTransactions: async () => {
        const pendingCount = get().transactions.filter(
          (t) => t.status === "pending"
        ).length;

        if (pendingCount === 0) return;

        set({ isLoading: true, error: null });
        try {
          // Pour l'instant marque toutes les pending comme completed
          // À remplacer par un vrai appel Supabase dans une prochaine issue
          set((state) => ({
            transactions: state.transactions.map((t) =>
              t.status === "pending" ? { ...t, status: "completed" as const } : t
            ),
            pendingTransactions: [],
            isLoading: false,
          }));
        } catch (error) {
          // ✅ Erreur silencieuse — les items restent en pending pour réessayer
          console.error("Sync transactions failed:", error);
          set({ isLoading: false, error: error instanceof Error ? error.message : "Sync failed" });
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