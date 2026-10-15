// stores/transaction-store.ts
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { generateId } from "@/utils/id-generator";
import { isConnected } from "@/utils/network";
import { convex } from "@/lib/convex";
import { withAuthRetry } from "@/lib/withAuthRetry";
import * as adminApi from "@/lib/admin-api";
import { Transaction } from "@/types/transaction";
import { useClientStore } from "./client-store";
import { useAuthStore } from "./auth-store";
import { DEV_MOCKS_ENABLED } from "@/__dev__/config";
import * as Crypto from "expo-crypto";
import {
  balanceDelta,
  isLocalClient,
  isPermanentSyncError,
  isRetryLaterSyncError,
  onClientIdRemapped,
  registerPendingDeltaProvider,
  syncErrorMessage,
} from "./sync-bridge";

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
  pending: Transaction[],
): Transaction[] {
  const byId = new Map<string, Transaction>();
  const syncedRefs = new Set<string>();
  for (const t of synced) {
    byId.set(t.id, t);
    if (t.clientRef) syncedRefs.add(t.clientRef);
  }
  for (const p of pending) {
    // Already recorded server-side (sync response lost) — shown once.
    if (syncedRefs.has(p.clientRef ?? p.id)) continue;
    if (!byId.has(p.id)) byId.set(p.id, p);
  }
  return [...byId.values()].sort(sortByTimestampDesc);
}

// ─── Convex row → Transaction ─────────────────────────────────────────────────

/** Withdrawals wait on the direct-debit vs supervisor-approval decision. */
export const WITHDRAWALS_UNAVAILABLE =
  "Les retraits ne sont pas encore disponibles dans l'application.";

/**
 * Map an admin backend transaction row to the app-level Transaction type.
 * The server's `clientId` is the app's idempotency key (`clientRef` here);
 * the app's `clientId` is the customer. Every server row is a deposit for now.
 */
export function convexRowToTransaction(
  row: Partial<adminApi.AdminTransaction> & {
    _id: string;
    customerId: string;
    amount: number;
    timestamp: number;
    status: "completed" | "reversed";
    agentId?: string;
  },
  clientNameResolver?: (id: string) => string | undefined,
): Transaction {
  const clientName =
    row.customerName ?? clientNameResolver?.(row.customerId) ?? "—";
  return {
    id: row._id,
    clientId: row.customerId,
    clientName,
    amount: row.amount,
    type: "deposit",
    date: new Date(row.timestamp).toISOString(),
    status: row.status,
    agentId: row.agentId,
    notes: row.reversalReason ?? undefined,
    clientRef: row.clientId ?? undefined,
  };
}

// ─── Store types ──────────────────────────────────────────────────────────────

interface TransactionStoreState {
  transactions: Transaction[];
  pendingTransactions: Transaction[];
  /** Queued transactions the server permanently refused (kept for review). */
  rejectedTransactions: Transaction[];
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
      rejectedTransactions: [],
      isLoading: false,
      error: null,
      transactionSyncFailures: 0,

      // ── Dev mocks ────────────────────────────────────────────────────────

      loadDevMocks: async () => {
        if (!DEV_MOCKS_ENABLED) return;
        if (get().transactions.length > 0) return;
        const { mockTransactions } =
          await import("@/__dev__/mocks/transactions");
        set({ transactions: mockTransactions, pendingTransactions: [] });
      },

      // ── Import (CSV / bulk) ───────────────────────────────────────────────

      importTransactions: (txList) => {
        set((state) => {
          const existingIds = new Set(
            [...state.transactions, ...state.pendingTransactions].map(
              (t) => t.id,
            ),
          );
          const newTxs = txList.filter((t) => !existingIds.has(t.id));
          if (newTxs.length === 0) return state;
          return {
            transactions: [...newTxs, ...state.transactions].sort(
              sortByTimestampDesc,
            ),
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

          // The caller's own collections; the server knows who is asking
          const rows = await withAuthRetry(() =>
            convex.query(adminApi.listMyTransactions, {}),
          );

          const clientStore = useClientStore.getState();
          const clientNameResolver = (id: string) =>
            clientStore.getClientById(id)?.name;

          const fromServer: Transaction[] = rows.map((row) =>
            convexRowToTransaction(row, clientNameResolver),
          );

          set((state) => {
            const serverIds = new Set(fromServer.map((t) => t.id));
            const serverRefs = new Set(
              fromServer.flatMap((t) => (t.clientRef ? [t.clientRef] : [])),
            );
            const stillPending = state.pendingTransactions.filter(
              (p) =>
                !serverIds.has(p.id) && !serverRefs.has(p.clientRef ?? p.id),
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
          if (transactionData.type === "withdrawal") {
            throw new Error(WITHDRAWALS_UNAVAILABLE);
          }
          const clientStore = useClientStore.getState();
          const client = clientStore.getClientById(transactionData.clientId);
          if (!client) throw new Error("Client not found");

          const online = await isConnected();
          const now = Date.now();

          // Build a local Transaction for immediate UI feedback and offline queue.
          const localId = generateId("TR");
          const newTransaction: Transaction = {
            id: localId,
            clientRef: Crypto.randomUUID(),
            clientId: transactionData.clientId,
            clientName: client.name,
            amount: transactionData.amount,
            type: transactionData.type,
            date: new Date(now).toISOString(),
            status: "pending",
            agentId: useAuthStore.getState().user?.id,
          };

          // A client created on this device has no Convex id yet: queue until
          // syncPendingClients has created it and remapped the id.
          if (online && !isLocalClient(client)) {
            try {
              // The server takes the agent, branch, time and TPE (the bound
              // device) from the session. The clientRef makes a replay
              // (lost response → queue) return the same deposit.
              const transactionId = await convex.mutation(adminApi.createDeposit, {
                customerId: transactionData.clientId,
                amount: transactionData.amount,
                clientId: newTransaction.clientRef!,
              });

              await clientStore.updateClientBalance(
                transactionData.clientId,
                balanceDelta(newTransaction),
              );

              const syncedTransaction: Transaction = {
                ...newTransaction,
                id: transactionId,
                status: "completed",
              };
              set((state) => ({
                transactions: [syncedTransaction, ...state.transactions],
                isLoading: false,
              }));
              return syncedTransaction;
            } catch (mutErr) {
              // Refused (client unknown, day closed, no TPE…): say so now,
              // nothing is queued — the agent is still with the customer.
              if (isPermanentSyncError(mutErr) || isRetryLaterSyncError(mutErr)) {
                throw new Error(syncErrorMessage(mutErr));
              }
              // Erreur transitoire — bascule vers la file d'attente.
              console.warn("Transaction sync deferred:", mutErr);
            }
          }

          // Offline / deferred path — update local balance, queue for later sync.
          await clientStore.updateClientBalance(
            transactionData.clientId,
            balanceDelta(newTransaction),
          );
          // Appended: the queue is kept in recording order, which breaks
          // replay-order ties between transactions stamped the same instant.
          set((state) => ({
            pendingTransactions: [...state.pendingTransactions, newTransaction],
            isLoading: false,
          }));
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
        const { transactions, pendingTransactions, rejectedTransactions } =
          get();
        return (
          transactions.find((t) => t.id === id) ||
          pendingTransactions.find((t) => t.id === id) ||
          rejectedTransactions.find((t) => t.id === id)
        );
      },

      getTransactionsByClientId: (clientId) => {
        const { transactions, pendingTransactions } = get();
        return [...transactions, ...pendingTransactions]
          .filter((t) => t.clientId === clientId)
          .sort(sortByTimestampDesc);
      },

      // ── Sync pending queue ────────────────────────────────────────────────

      // `branchId` is kept for callers; the server derives it from the token.
      syncPendingTransactions: async (_branchId) => {
        // The network hook, a client-id remap and the manual button can all
        // trigger a sync; a second caller just asks the running loop for one
        // more pass (e.g. to pick up transactions whose client was created).
        if (syncInFlight) {
          syncRerunRequested = true;
          return;
        }
        syncInFlight = true;
        try {
          do {
            syncRerunRequested = false;
            await syncPendingOnce();
          } while (syncRerunRequested);
        } finally {
          syncInFlight = false;
        }
      },

      // ── Reset ─────────────────────────────────────────────────────────────

      clearAll: () => {
        set({
          transactions: [],
          pendingTransactions: [],
          rejectedTransactions: [],
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
        rejectedTransactions: state.rejectedTransactions,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isLoading = false;
          state.error = null;
          state.transactionSyncFailures = 0;
          state.rejectedTransactions ??= [];
        }
      },
    },
  ),
);

// ─── Offline queue replay ─────────────────────────────────────────────────────

let syncInFlight = false;
let syncRerunRequested = false;

/**
 * Replays queued transactions oldest-first (a withdrawal can depend on a
 * deposit queued before it). Each one carries its clientRef, so a replay of
 * something the server already recorded is a no-op there.
 */
async function syncPendingOnce(): Promise<void> {
  const store = useTransactionStore;
  const queue = [...store.getState().pendingTransactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  if (queue.length === 0) {
    store.setState({ transactionSyncFailures: 0 });
    return;
  }

  store.setState({ isLoading: true, error: null });
  let transient = 0;
  let rejected = 0;
  // Refused for now (day closed, no TPE): count and reasons
  let waitingCount = 0;
  const waiting = new Set<string>();

  for (const tx of queue) {
    const client = useClientStore.getState().getClientById(tx.clientId);
    // Client not created on the server yet — it will be remapped, then retried.
    if (client && isLocalClient(client)) continue;

    try {
      // Queued before withdrawals were turned off: the server has no
      // withdrawal yet, so it can't be replayed.
      if (tx.type === "withdrawal") throw new Error(WITHDRAWALS_UNAVAILABLE);
      const transactionId = await convex.mutation(adminApi.createDeposit, {
        customerId: tx.clientId,
        amount: tx.amount,
        // Transactions queued before clientRef existed use their local id.
        clientId: tx.clientRef ?? tx.id,
      });

      // The local balance already counts this deposit (applied when it was
      // queued); it only moves from "pending" to "synced".
      const synced: Transaction = {
        ...tx,
        id: transactionId,
        status: "completed",
      };
      // Committed one by one so an interrupted sync resumes where it stopped.
      store.setState((state) => ({
        pendingTransactions: state.pendingTransactions.filter(
          (p) => p.id !== tx.id,
        ),
        transactions: [
          synced,
          ...state.transactions.filter((t) => t.id !== synced.id),
        ].sort(sortByTimestampDesc),
      }));
    } catch (err) {
      if (isRetryLaterSyncError(err)) {
        // Stays queued as is; the next sync tries again
        waitingCount++;
        waiting.add(syncErrorMessage(err));
        continue;
      }
      if (
        isPermanentSyncError(err) ||
        (err instanceof Error && err.message === WITHDRAWALS_UNAVAILABLE)
      ) {
        // Le serveur a refusé l'opération (solde insuffisant, client
        // inconnu…) : la rejouer ne changera rien. On la sort de la file,
        // on annule son effet sur le solde local et on la garde visible.
        rejected++;
        store.setState((state) => ({
          pendingTransactions: state.pendingTransactions.filter(
            (p) => p.id !== tx.id,
          ),
          rejectedTransactions: [
            { ...tx, syncError: syncErrorMessage(err) },
            ...state.rejectedTransactions,
          ],
        }));
        await useClientStore
          .getState()
          .updateClientBalance(tx.clientId, -balanceDelta(tx));
        console.error("Transaction rejected by server:", err, tx.id);
      } else {
        transient++;
        console.error("Sync transaction failed:", err, tx.id);
      }
    }
  }

  const messages = [
    rejected > 0 && `${rejected} transaction(s) rejetée(s) par le serveur`,
    transient > 0 &&
      `${transient} transaction(s) n'ont pas pu être synchronisée(s)`,
    ...waiting,
  ].filter(Boolean);
  store.setState({
    isLoading: false,
    transactionSyncFailures: transient + rejected + waitingCount,
    error: messages.length > 0 ? messages.join(" · ") : null,
  });
}

function pendingBalanceDeltas(): Map<string, number> {
  const deltas = new Map<string, number>();
  for (const tx of useTransactionStore.getState().pendingTransactions) {
    deltas.set(tx.clientId, (deltas.get(tx.clientId) ?? 0) + balanceDelta(tx));
  }
  return deltas;
}

registerPendingDeltaProvider(pendingBalanceDeltas);

// A client created offline just got its Convex id: repoint its queued
// transactions, then let them sync.
onClientIdRemapped((oldId, newId) => {
  const { pendingTransactions } = useTransactionStore.getState();
  if (!pendingTransactions.some((t) => t.clientId === oldId)) return;
  useTransactionStore.setState({
    pendingTransactions: pendingTransactions.map((t) =>
      t.clientId === oldId ? { ...t, clientId: newId } : t,
    ),
  });
  const branchId = useAuthStore.getState().user?.branchId;
  if (branchId) {
    void useTransactionStore.getState().syncPendingTransactions(branchId);
  }
});
