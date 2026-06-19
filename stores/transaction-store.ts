// stores/transaction-store.ts
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { generateId } from "@/utils/id-generator";
import { isConnected } from "@/utils/network";
import { convex } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Transaction } from "@/types/transaction";
import { useClientStore } from "./client-store";
import { useAuthStore } from "./auth-store";
import { DEV_MOCKS_ENABLED } from "@/__dev__/config";

// ─── helpers ─────────────────────────────────────────────────────────────────

function sortByTimestampDesc(a: Transaction, b: Transaction): number {
  return new Date(b.date).getTime() - new Date(a.date).getTime();
}

/**
 * Merge server-synced and locally-pending transactions into a single sorted
 * list, deduplicating by id. Pending items that already appear in the synced
 * list are dropped (the server version wins).
 */
export function mergeTransactionsSorted(
  synced: Transaction[],
  pending: Transaction[]
): Transaction[] {
  const byId = new Map<string, Transaction>();
  for (const t of synced) byId.set(t.id, t);
  for (const p of pending) {
    if (!byId.has(p.id)) byId.set(p.id, p);
  }
  return [...byId.values()].sort(sortByTimestampDesc);
}

// ─── Convex row → Transaction ─────────────────────────────────────────────────

/**
 * Map a raw Convex document to the app-level Transaction type.
 * `clientName` is resolved from the client store when available; it falls back
 * to the id string so the UI always has something to display.
 */
function convexRowToTransaction(
  row: any,
  clientNameResolver?: (id: string) => string | undefined
): Transaction {
  const clientName =
    clientNameResolver?.(row.customerId) ?? row.customerId ?? "—";
  return {
    id: row._id as string,
    clientId: row.customerId as string,
    clientName,
    amount: row.amount,
    type: row.type as "deposit" | "withdrawal",
    date: new Date(row.timestamp).toISOString(),
    status: row.status as "completed" | "pending" | "reversed",
    notes: row.notes,
  };
}

// ─── Store types ──────────────────────────────────────────────────────────────

interface TransactionStoreState {
  transactions: Transaction[];
  pendingTransactions: Transaction[];
  isLoading: boolean;
  error: string | null;
  /** Number of pending transactions whose last sync attempt failed. */
  transactionSyncFailures: number;

  loadTransactions: (branchId: string) => Promise<void>;
  addTransaction: (transactionData: {
    clientId: string;
    amount: number;
    type: "deposit" | "withdrawal";
    notes?: string;
  }) => Promise<Transaction>;
  importTransactions: (txList: Transaction[]) => void;
  getTransactionById: (id: string) => Transaction | undefined;
  getTransactionsByClientId: (clientId: string) => Transaction[];
  syncPendingTransactions: (branchId: string) => Promise<void>;
  loadDevMocks: () => Promise<void>;
  clearAll: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useTransactionStore = create<TransactionStoreState>()(
  persist(
    (set, get) => ({
      transactions: [],
      pendingTransactions: [],
      isLoading: false,
      error: null,
      transactionSyncFailures: 0,

      // ── Dev mocks ────────────────────────────────────────────────────────

      loadDevMocks: async () => {
        if (!DEV_MOCKS_ENABLED) return;
        if (get().transactions.length > 0) return;
        const { mockTransactions } = await import("@/__dev__/mocks/transactions");
        set({ transactions: mockTransactions, pendingTransactions: [] });
      },

      // ── Import (CSV / bulk) ───────────────────────────────────────────────

      importTransactions: (txList) => {
        set((state) => {
          const existingIds = new Set(
            [...state.transactions, ...state.pendingTransactions].map((t) => t.id)
          );
          const newTxs = txList.filter((t) => !existingIds.has(t.id));
          if (newTxs.length === 0) return state;
          return {
            transactions: [...newTxs, ...state.transactions].sort(sortByTimestampDesc),
          };
        });
      },

      // ── Load from Convex ──────────────────────────────────────────────────

      loadTransactions: async (branchId) => {
        set({ isLoading: true, error: null });
        try {
          if (DEV_MOCKS_ENABLED) {
            await get().loadDevMocks();
            set({ isLoading: false });
            return;
          }

          const rows = await convex.query(api.transactions.list, {
            branchId: branchId as Id<"branches">,
          });

          const clientStore = useClientStore.getState();
          const clientNameResolver = (id: string) =>
            clientStore.getClientById(id)?.name;

          const fromServer: Transaction[] = rows.map((row: any) =>
            convexRowToTransaction(row, clientNameResolver)
          );

          set((state) => {
            const serverIds = new Set(fromServer.map((t) => t.id));
            const stillPending = state.pendingTransactions.filter(
              (p) => !serverIds.has(p.id)
            );
            return {
              transactions: fromServer,
              pendingTransactions: stillPending,
              isLoading: false,
            };
          });
        } catch (error) {
          set({
            isLoading: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to load transactions",
          });
          throw error;
        }
      },

      // ── Add transaction ───────────────────────────────────────────────────

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
          const now = Date.now();

          // Build a local Transaction for immediate UI feedback and offline queue.
          const localId = generateId("TR");
          const newTransaction: Transaction = {
            id: localId,
            clientId: transactionData.clientId,
            clientName: client.name,
            amount: transactionData.amount,
            type: transactionData.type,
            date: new Date(now).toISOString(),
            status: online ? "completed" : "pending",
          };

          const balanceDelta =
            transactionData.type === "deposit"
              ? transactionData.amount
              : -transactionData.amount;

          if (online) {
            const authStore = useAuthStore.getState();
            const branchId = authStore.user?.branchId;
            const currency = authStore.user?.currency ?? "FCFA";
            const tpeId = authStore.user?.device?.serialNumber ?? "web";

            let serverIdStr: string | null = null;

            if (branchId && authStore.user?.id) {
              try {
                const serverId = await convex.mutation(api.transactions.create, {
                  amount: transactionData.amount,
                  currency,
                  customerId: transactionData.clientId as Id<"customers">,
                  agentId: authStore.user!.id as Id<"users">,
                  branchId: branchId as Id<"branches">,
                  tpeId,
                  type: transactionData.type,
                  timestamp: now,
                });
                serverIdStr = serverId as string;
              } catch (mutErr) {
                // Customer not yet synced or other transient error — fall
                // through to the pending queue.
                console.warn("Transaction sync deferred:", mutErr);
              }
            }

            // Balance is updated atomically on the server; mirror locally.
            await clientStore.updateClientBalance(
              transactionData.clientId,
              balanceDelta
            );

            if (serverIdStr) {
              // Use the server-assigned id so the local record matches Convex.
              const syncedTransaction: Transaction = {
                ...newTransaction,
                id: serverIdStr,
                status: "completed",
              };
              set((state) => ({
                transactions: [syncedTransaction, ...state.transactions],
                isLoading: false,
              }));
              return syncedTransaction;
            } else {
              // Queued as pending — keep local id for reconciliation.
              set((state) => ({
                pendingTransactions: [newTransaction, ...state.pendingTransactions],
                isLoading: false,
              }));
            }
          } else {
            // Offline path — update local balance, queue for later sync.
            await clientStore.updateClientBalance(
              transactionData.clientId,
              balanceDelta
            );
            set((state) => ({
              pendingTransactions: [newTransaction, ...state.pendingTransactions],
              isLoading: false,
            }));
          }

          return newTransaction;
        } catch (error) {
          set({
            isLoading: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to add transaction",
          });
          throw error;
        }
      },

      // ── Getters ───────────────────────────────────────────────────────────

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
          .sort(sortByTimestampDesc);
      },

      // ── Sync pending queue ────────────────────────────────────────────────

      syncPendingTransactions: async (branchId) => {
        const pending = get().pendingTransactions;
        if (pending.length === 0) {
          set({ transactionSyncFailures: 0 });
          return;
        }

        set({ isLoading: true, error: null, transactionSyncFailures: 0 });
        try {
          const authStore = useAuthStore.getState();
          const currency = authStore.user?.currency ?? "FCFA";
          const tpeId = authStore.user?.device?.serialNumber ?? "web";
          const agentConvexId = authStore.user?.id;

          if (!agentConvexId) throw new Error("No authenticated user");

          let failures = 0;
          const toMove: Transaction[] = [];
          const stillPending: Transaction[] = [];

          for (const tx of pending) {
            try {
              const serverId = await convex.mutation(api.transactions.create, {
                amount: tx.amount,
                currency: currency ?? "FCFA",
                customerId: tx.clientId as Id<"customers">,
                agentId: agentConvexId as Id<"users">,
                branchId: branchId as Id<"branches">,
                tpeId: tpeId ?? "web",
                type: tx.type,
                timestamp: new Date(tx.date).getTime(),
              });

              toMove.push({
                ...tx,
                id: serverId as string,
                status: "completed",
              });
            } catch (err) {
              failures++;
              stillPending.push(tx);
              console.error("Sync transaction failed:", err, tx.id);
            }
          }

          set((state) => ({
            transactions: [...toMove, ...state.transactions].sort(sortByTimestampDesc),
            pendingTransactions: stillPending,
            isLoading: false,
            transactionSyncFailures: failures,
            error:
              failures > 0
                ? `${failures} transaction(s) n'ont pas pu être synchronisée(s)`
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

      // ── Reset ─────────────────────────────────────────────────────────────

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
