// stores/transaction-store.ts
import { useMemo } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { generateId } from "@/utils/id-generator";
import { isConnected } from "@/utils/network";
import { convex } from "@/lib/convex";
import { withAuthRetry } from "@/lib/withAuthRetry";
import { currentFix } from "@/lib/location";
import * as adminApi from "@/lib/admin-api";
import { Transaction } from "@/types/transaction";
import type { Client } from "@/types/client";
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
 * Whether a queued transaction was recorded by `agentId`. On a TPE shared by
 * several agents, each one's queue is replayed only under their own session,
 * so the server credits the right agent. Entries queued before agentId was
 * stored count as the current agent's.
 */
export function isOwnTransaction(tx: Transaction, agentId: string | undefined): boolean {
  return !tx.agentId || tx.agentId === agentId;
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
 * Largest withdrawal paid out without the server's confirmation. Same value
 * as the admin backend's OFFLINE_WITHDRAWAL_CAP, which refuses larger replays.
 */
export const OFFLINE_WITHDRAWAL_CAP = 25_000;
/** Offline withdrawals need balances loaded from the server this recently. */
export const OFFLINE_BALANCE_MAX_AGE_MS = 8 * 60 * 60 * 1000;

const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;
export const OFFLINE_WITHDRAWAL_TOO_LARGE = `Hors ligne, un retrait ne peut pas dépasser ${fcfa(OFFLINE_WITHDRAWAL_CAP)}.`;
export const OFFLINE_BALANCES_STALE =
  "Soldes non actualisés depuis plus de 8 h : reconnectez-vous pour actualiser avant un retrait hors ligne.";
export const WITHDRAWAL_OVER_BALANCE = "Solde du client insuffisant pour ce retrait.";
/** The withdrawal may or may not be stored: never pay out on this. */
export const WITHDRAWAL_UNCONFIRMED =
  "Retrait non confirmé : ne remettez pas l'argent. Vérifiez l'historique du client avant de réessayer.";

/**
 * Map an admin backend transaction row to the app-level Transaction type.
 * The server's `clientId` is the app's idempotency key (`clientRef` here);
 * the app's `clientId` is the customer. Rows without a type are deposits.
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
    type: row.type ?? "deposit",
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
  /** Agent whose history `transactions` holds (a TPE can be shared). */
  historyOwnerId: string | null;

  loadTransactions: (branchId: string) => Promise<void>;
  addTransaction: (transactionData: {
    clientId: string;
    amount: number;
    type: "deposit" | "withdrawal";
    notes?: string;
  }) => Promise<Transaction>;
  getTransactionById: (id: string) => Transaction | undefined;
  getTransactionsByClientId: (clientId: string) => Transaction[];
  syncPendingTransactions: (branchId: string) => Promise<void>;
  loadDevMocks: () => Promise<void>;
  /**
   * Called when an agent signs in: if another agent used this phone last,
   * drop their history. Every agent's queued operations stay on the phone
   * and sync at that agent's next sign-in.
   */
  switchAgent: (agentId: string) => void;
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
      historyOwnerId: null,

      // ── Dev mocks ────────────────────────────────────────────────────────

      loadDevMocks: async () => {
        if (!DEV_MOCKS_ENABLED) return;
        if (get().transactions.length > 0) return;
        const { mockTransactions } =
          await import("@/__dev__/mocks/transactions");
        set({ transactions: mockTransactions, pendingTransactions: [] });
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
          const clientStore = useClientStore.getState();
          const client = clientStore.getClientById(transactionData.clientId);
          if (!client) throw new Error("Client not found");

          const online = await isConnected();
          const now = Date.now();

          if (transactionData.type === "withdrawal") {
            const withdrawal = await recordWithdrawal(
              client,
              transactionData.amount,
              online,
              now,
            );
            await clientStore.updateClientBalance(
              transactionData.clientId,
              balanceDelta(withdrawal),
            );
            set((state) =>
              withdrawal.status === "pending"
                ? {
                    pendingTransactions: [...state.pendingTransactions, withdrawal],
                    isLoading: false,
                  }
                : {
                    transactions: [withdrawal, ...state.transactions],
                    isLoading: false,
                  },
            );
            return withdrawal;
          }

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
            location: currentFix(),
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
                ...recordedOn(newTransaction),
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

      // ── Agent change on a shared TPE ──────────────────────────────────────

      switchAgent: (agentId) => {
        const { historyOwnerId } = get();
        if (historyOwnerId === agentId) return;
        // Unknown owner (installs that predate this): the history may be
        // anyone's, so it is reloaded from the server too. Rejected and queued
        // operations are kept; screens show the agent's own (useOwn…)
        set({
          transactions: [],
          historyOwnerId: agentId,
          transactionSyncFailures: 0,
          error: null,
        });
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
          historyOwnerId: null,
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
        historyOwnerId: state.historyOwnerId,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isLoading = false;
          state.error = null;
          state.transactionSyncFailures = 0;
          state.rejectedTransactions ??= [];
          state.historyOwnerId ??= null;
        }
      },
    },
  ),
);

// ─── Withdrawals ──────────────────────────────────────────────────────────────

/**
 * Why an offline withdrawal can't be paid out, or null if it can: at most
 * OFFLINE_WITHDRAWAL_CAP, within the local balance (which already counts
 * this device's queued movements), and balances loaded from the server in
 * the last 8 hours, so the local balance is not too stale.
 */
export function offlineWithdrawalRefusal(
  client: Pick<Client, "balance">,
  amount: number,
  balancesFetchedAt: number | null,
  now: number,
): string | null {
  if (amount > OFFLINE_WITHDRAWAL_CAP) return OFFLINE_WITHDRAWAL_TOO_LARGE;
  if (balancesFetchedAt === null || now - balancesFetchedAt > OFFLINE_BALANCE_MAX_AGE_MS) {
    return OFFLINE_BALANCES_STALE;
  }
  if (amount > client.balance) return WITHDRAWAL_OVER_BALANCE;
  return null;
}

/**
 * Record a withdrawal and return it, or throw a French message for the agent
 * (who must then not pay out).
 *
 * Online, the server confirms it against the customer's balance; a failed
 * call is retried once with the same clientRef, so a lost response can't
 * debit twice. Offline (or if both calls fail, or the client isn't on the
 * server yet), it is queued as "pending" within the offline limits, and the
 * sync replays it with `offline: true`: the cash is already handed over, so
 * the server records it even if it overdraws the account.
 */
async function recordWithdrawal(
  client: Client,
  amount: number,
  online: boolean,
  now: number,
): Promise<Transaction> {
  const withdrawal: Transaction = {
    id: generateId("TR"),
    clientRef: Crypto.randomUUID(),
    clientId: client.id,
    clientName: client.name,
    amount,
    type: "withdrawal",
    date: new Date(now).toISOString(),
    status: "pending",
    agentId: useAuthStore.getState().user?.id,
    location: currentFix(),
  };

  let attempted = false;
  if (online && !isLocalClient(client)) {
    const args = {
      customerId: client.id,
      amount,
      clientId: withdrawal.clientRef!,
      ...recordedOn(withdrawal),
    };
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        attempted = true;
        const id = await convex.mutation(adminApi.createWithdrawal, args);
        return { ...withdrawal, id, status: "completed" };
      } catch (err) {
        if (isPermanentSyncError(err) || isRetryLaterSyncError(err)) {
          throw new Error(syncErrorMessage(err));
        }
        console.warn("Withdrawal attempt failed:", err);
      }
    }
  }

  const refusal = offlineWithdrawalRefusal(
    client,
    amount,
    useClientStore.getState().balancesFetchedAt,
    now,
  );
  // A call that may have reached the server must not be reported as refused
  // without warning: the agent checks the history before trying again.
  if (refusal) throw new Error(attempted ? WITHDRAWAL_UNCONFIRMED : refusal);
  return withdrawal;
}

/**
 * When and where the agent recorded a movement, for the server's audit: a
 * queued one arrives later than it was recorded, and the dashboard shows by
 * how much.
 */
function recordedOn(tx: Transaction) {
  const recordedAt = new Date(tx.date).getTime();
  return {
    ...(Number.isFinite(recordedAt) ? { recordedAt } : {}),
    ...(tx.location ? { location: tx.location } : {}),
  };
}

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
  // Another agent's operations on a shared TPE wait for their own session
  const me = useAuthStore.getState().user?.id;
  if (!me) return;
  const queue = store.getState().pendingTransactions.filter((t) => isOwnTransaction(t, me)).sort(
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
      const args = {
        customerId: tx.clientId,
        amount: tx.amount,
        // Transactions queued before clientRef existed use their local id.
        clientId: tx.clientRef ?? tx.id,
        ...recordedOn(tx),
      };
      // A queued withdrawal was paid out offline: the server records it even
      // past the customer's balance (flagged as an overdraft)
      const transactionId =
        tx.type === "withdrawal"
          ? await convex.mutation(adminApi.createWithdrawal, { ...args, offline: true })
          : await convex.mutation(adminApi.createDeposit, args);

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
        isPermanentSyncError(err)
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

// ─── Current agent's view ─────────────────────────────────────────────────────

/** Queued operations of the signed-in agent (a shared TPE holds others'). */
export function useOwnPendingTransactions(): Transaction[] {
  const pending = useTransactionStore((s) => s.pendingTransactions);
  const me = useAuthStore((s) => s.user?.id);
  return useMemo(() => pending.filter((t) => isOwnTransaction(t, me)), [pending, me]);
}

/** Operations the server refused, for the signed-in agent. */
export function useOwnRejectedTransactions(): Transaction[] {
  const rejected = useTransactionStore((s) => s.rejectedTransactions);
  const me = useAuthStore((s) => s.user?.id);
  return useMemo(() => rejected.filter((t) => isOwnTransaction(t, me)), [rejected, me]);
}
