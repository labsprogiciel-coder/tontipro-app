import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { generateId } from "@/utils/id-generator";
import { isConnected } from "@/utils/network";
import { supabase } from "@/lib/supabase";
import { rowToTransaction, transactionToInsertRow } from "@/lib/transaction-supabase";
import { Transaction } from "@/types/transaction";
import { useClientStore } from "./client-store";
import { DEV_MOCKS_ENABLED } from "@/__dev__/config";

function sortByDateDesc(a: Transaction, b: Transaction): number {
  return new Date(b.date).getTime() - new Date(a.date).getTime();
}

export function mergeTransactionsSorted(
  synced: Transaction[],
  pending: Transaction[]
): Transaction[] {
  const byId = new Map<string, Transaction>();
  for (const t of synced) {
    byId.set(t.id, t);
  }
  for (const p of pending) {
    if (!byId.has(p.id)) {
      byId.set(p.id, p);
    }
  }
  return [...byId.values()].sort(sortByDateDesc);
}

interface TransactionStoreState {
  transactions: Transaction[];
  pendingTransactions: Transaction[];
  isLoading: boolean;
  error: string | null;
  /** Nombre d’éléments de `pendingTransactions` dont la dernière sync a échoué */
  transactionSyncFailures: number;

  loadTransactionsFromSupabase: () => Promise<void>;
  addTransaction: (transactionData: {
    clientId: string;
    amount: number;
    type: "deposit" | "withdrawal";
    notes?: string;
  }) => Promise<Transaction>;
  importTransactions: (txList: Transaction[]) => void;
  getTransactionById: (id: string) => Transaction | undefined;
  getTransactionsByClientId: (clientId: string) => Transaction[];
  syncPendingTransactions: () => Promise<void>;
  subscribeToTransactionsRealtime: (userId: string) => () => void;
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
      transactionSyncFailures: 0,

      loadDevMocks: async () => {
        if (!DEV_MOCKS_ENABLED) return;
        if (get().transactions.length > 0) return;
        const { mockTransactions } = await import("@/__dev__/mocks/transactions");
        set({ transactions: mockTransactions, pendingTransactions: [] });
      },

      importTransactions: (txList) => {
        set((state) => {
          const existingIds = new Set(
            [...state.transactions, ...state.pendingTransactions].map((t) => t.id)
          );
          const newTxs = txList.filter((t) => !existingIds.has(t.id));
          if (newTxs.length === 0) return state;
          return {
            transactions: [...newTxs, ...state.transactions].sort(sortByDateDesc),
          };
        });
      },

      loadTransactionsFromSupabase: async () => {
        set({ isLoading: true, error: null });
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (!user) {
            if (DEV_MOCKS_ENABLED) {
              await get().loadDevMocks();
              set({ isLoading: false, error: null });
              return;
            }
            set({ transactions: [], pendingTransactions: [], isLoading: false, error: null });
            return;
          }

          const { data: rows, error } = await supabase
            .from("transactions")
            .select("*")
            .eq("agent_id", user.id)
            .order("date", { ascending: false });

          if (error) {
            throw new Error(error.message);
          }

          const fromServer: Transaction[] = (rows || []).map((row: any) => rowToTransaction(row));

          set((state) => {
            const serverIds = new Set(fromServer.map((t) => t.id));
            const stillPending = state.pendingTransactions.filter((p) => !serverIds.has(p.id));
            return {
              transactions: fromServer,
              pendingTransactions: stillPending,
              isLoading: false,
            };
          });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : "Failed to load transactions",
          });
          throw error;
        }
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

          const online = await isConnected();

          const newTransaction: Transaction = {
            id: generateId("TR"),
            clientId: transactionData.clientId,
            clientName: client.name,
            amount: transactionData.amount,
            type: transactionData.type,
            date: new Date().toISOString(),
            status: online ? "completed" : "pending",
            notes: transactionData.notes,
          };

          const balanceChange =
            transactionData.type === "deposit"
              ? transactionData.amount
              : -transactionData.amount;

          if (online) {
            const {
              data: { user },
            } = await supabase.auth.getUser();

            let synced = false;

            if (user) {
              const row = transactionToInsertRow(
                { ...newTransaction, status: "completed" },
                user.id
              );
              const { error: insertError } = await supabase.from("transactions").insert(row);
              if (insertError) {
                // Client not yet synced to Supabase (e.g. locally imported) — queue as pending
                console.warn("Transaction sync deferred:", insertError.message);
              } else {
                synced = true;
              }
            }

            await clientStore.updateClientBalance(transactionData.clientId, balanceChange);

            if (synced) {
              set((state) => ({
                transactions: [{ ...newTransaction, status: "completed" }, ...state.transactions],
                isLoading: false,
              }));
            } else {
              set((state) => ({
                pendingTransactions: [newTransaction, ...state.pendingTransactions],
                isLoading: false,
              }));
            }
          } else {
            await clientStore.updateClientBalance(transactionData.clientId, balanceChange);

            set((state) => ({
              pendingTransactions: [newTransaction, ...state.pendingTransactions],
              isLoading: false,
            }));
          }

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
        const { transactions, pendingTransactions } = get();
        return (
          transactions.find((t) => t.id === id) ||
          pendingTransactions.find((t) => t.id === id)
        );
      },

      getTransactionsByClientId: (clientId) => {
        const { transactions, pendingTransactions } = get();
        return [...transactions, ...pendingTransactions]
          .filter((t) => t.clientId === clientId)
          .sort(sortByDateDesc);
      },

      syncPendingTransactions: async () => {
        const pending = get().pendingTransactions;
        if (pending.length === 0) {
          set({ transactionSyncFailures: 0 });
          return;
        }

        set({ isLoading: true, error: null, transactionSyncFailures: 0 });
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (!user) {
            throw new Error("No authenticated user");
          }

          let failures = 0;
          const toMove: Transaction[] = [];
          const stillPending: Transaction[] = [];

          for (const tx of pending) {
            const completed: Transaction = { ...tx, status: "completed" };
            const row = transactionToInsertRow(completed, user.id);

            const { error: insertError } = await supabase.from("transactions").insert(row);

            if (insertError) {
              failures++;
              stillPending.push(tx);
              console.error("Sync transaction failed:", insertError.message, tx.id);
              continue;
            }

            toMove.push(completed);

            const client = useClientStore.getState().getClientById(tx.clientId);
            if (client) {
              const { error: balErr } = await supabase
                .from("clients")
                .update({ balance: client.balance })
                .eq("id", tx.clientId)
                .eq("agent_id", user.id);

              if (balErr) {
                console.error("Sync client balance after transaction:", balErr.message);
              }
            }
          }

          set((state) => ({
            transactions: [...toMove, ...state.transactions].sort(sortByDateDesc),
            pendingTransactions: stillPending,
            isLoading: false,
            transactionSyncFailures: failures,
            error:
              failures > 0
                ? `${failures} transaction(s) n’ont pas pu être synchronisée(s)`
                : null,
          }));
        } catch (error) {
          console.error("Sync transactions failed:", error);
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : "Sync failed",
            transactionSyncFailures: get().pendingTransactions.length,
          });
        }
      },

      subscribeToTransactionsRealtime: (userId: string) => {
        const channel: RealtimeChannel = supabase
          .channel(`agent-transactions-${userId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "transactions",
              filter: `agent_id=eq.${userId}`,
            },
            (payload) => {
              const row = payload.new;
              if (!row || typeof row !== "object" || !("id" in row)) return;
              const incoming = rowToTransaction(row as any);

              set((state) => {
                if (state.transactions.some((t) => t.id === incoming.id)) {
                  return state;
                }
                const wasPending = state.pendingTransactions.some((p) => p.id === incoming.id);
                return {
                  transactions: [incoming, ...state.transactions].sort(sortByDateDesc),
                  pendingTransactions: wasPending
                    ? state.pendingTransactions.filter((p) => p.id !== incoming.id)
                    : state.pendingTransactions,
                };
              });
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      },

      clearAll: () => {
        set({
          transactions: [],
          pendingTransactions: [],
          isLoading: false,
          error: null,
          transactionSyncFailures: 0,
        });
      },
    }),
    {
      name: "transaction-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        transactions: state.transactions,
        pendingTransactions: state.pendingTransactions,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isLoading = false;
          state.error = null;
          state.transactionSyncFailures = 0;
        }
      },
    }
  )
);
