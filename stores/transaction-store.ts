// stores/transaction-store.ts
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { generateId } from "@/utils/id-generator";
import { isConnected } from "@/utils/network";
import { convex } from "@/lib/convex";
import { withAuthRetry } from "@/lib/withAuthRetry";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Transaction } from "@/types/transaction";
import { useClientStore } from "./client-store";
import { useAuthStore } from "./auth-store";
import { DEV_MOCKS_ENABLED } from "@/__dev__/config";
import * as Crypto from "expo-crypto";
import {
  balanceDelta,
  isLocalClient,
  isPermanentSyncError,
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

/**
 * Map a raw Convex document to the app-level Transaction type.
 * `clientName` is resolved from the client store when available; it falls back
 * to the id string so the UI always has something to display.
 */
export function convexRowToTransaction(
  row: any,
  clientNameResolver?: (id: string) => string | undefined,
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
    agentId: row.agentId as string | undefined,
    notes: row.notes,
    clientRef: row.clientRef,
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

          // `transactions.list` derives the branch from the caller's own
          // identity server-side — it takes no arguments.
          const rows = await withAuthRetry(() =>
            convex.query(api.transactions.list, {}),
          );

          const clientStore = useClientStore.getState();
          const clientNameResolver = (id: string) =>
            clientStore.getClientById(id)?.name;

          const fromServer: Transaction[] = rows.map((row: any) =>
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
            const tpeId =
              useAuthStore.getState().user?.device?.serialNumber ?? "web";
            try {
              // createDeposit/createWithdrawal dérivent l'agent et l'agence
              // du token côté serveur et mettent à jour le solde du client de
              // façon atomique — voir convex/transactions.ts. Le clientRef
              // rend un rejeu (réponse perdue → file d'attente) sans effet.
              const createFn =
                transactionData.type === "deposit"
                  ? api.transactions.createDeposit
                  : api.transactions.createWithdrawal;
              const result = await convex.mutation(createFn, {
                customerId: transactionData.clientId as Id<"customers">,
                amount: transactionData.amount,
                tpeId,
                clientRef: newTransaction.clientRef,
              });

              // Reflect the authoritative server balance (plus anything still
              // queued for this client) rather than re-applying the delta.
              setServerBalance(transactionData.clientId, result.newBalance);

              const syncedTransaction: Transaction = {
                ...newTransaction,
                id: result.transactionId as string,
                status: "completed",
              };
              set((state) => ({
                transactions: [syncedTransaction, ...state.transactions],
                isLoading: false,
              }));
              return syncedTransaction;
            } catch (mutErr) {
              // Rejet définitif (solde insuffisant côté serveur, client
              // inconnu…) : on remonte l'erreur, rien n'est mis en file.
              if (isPermanentSyncError(mutErr)) {
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
  const tpeId = useAuthStore.getState().user?.device?.serialNumber ?? "web";
  let transient = 0;
  let rejected = 0;

  for (const tx of queue) {
    const client = useClientStore.getState().getClientById(tx.clientId);
    // Client not created on the server yet — it will be remapped, then retried.
    if (client && isLocalClient(client)) continue;

    try {
      const createFn =
        tx.type === "deposit"
          ? api.transactions.createDeposit
          : api.transactions.createWithdrawal;
      const result = await convex.mutation(createFn, {
        customerId: tx.clientId as Id<"customers">,
        amount: tx.amount,
        tpeId,
        // Transactions queued before clientRef existed use their local id.
        clientRef: tx.clientRef ?? tx.id,
      });

      const synced: Transaction = {
        ...tx,
        id: result.transactionId as string,
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
      setServerBalance(tx.clientId, result.newBalance);
    } catch (err) {
      if (isPermanentSyncError(err)) {
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
  ].filter(Boolean);
  store.setState({
    isLoading: false,
    transactionSyncFailures: transient + rejected,
    error: messages.length > 0 ? messages.join(" · ") : null,
  });
}

/**
 * Set a client's displayed balance from an authoritative server value, plus
 * the net effect of its transactions still waiting in the queue.
 */
function setServerBalance(clientId: string, serverBalance: number) {
  const pendingDelta = pendingBalanceDeltas().get(clientId) ?? 0;
  useClientStore.setState((state) => ({
    clients: state.clients.map((c) =>
      c.id === clientId ? { ...c, balance: serverBalance + pendingDelta } : c,
    ),
  }));
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
