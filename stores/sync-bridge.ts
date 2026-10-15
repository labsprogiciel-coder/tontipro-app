// stores/sync-bridge.ts
//
// Shared offline-sync helpers. client-store and transaction-store need to
// talk to each other (id remapping, pending balance deltas) but
// transaction-store already imports client-store — this module lets
// transaction-store register callbacks here instead of creating a require
// cycle.
import { ConvexError } from "convex/values";
import type { Client } from "@/types/client";
import type { Transaction } from "@/types/transaction";

// ── Local vs server ids ──────────────────────────────────────────────────────

// Convex document ids are lowercase base32 strings; local ids are
// `generateId("CL")` (uppercase prefix + digits) or CSV external ids.
const CONVEX_ID_RE = /^[0-9a-z]{25,40}$/;

/**
 * True while a client exists only on this device (its id is not a Convex id
 * yet). Clients persisted before `localOnly` existed fall back to the id shape.
 */
export function isLocalClient(
  client: Pick<Client, "id" | "localOnly" | "syncStatus">,
): boolean {
  if (client.localOnly !== undefined) return client.localOnly;
  return client.syncStatus === "pending" && !CONVEX_ID_RE.test(client.id);
}

// ── Transaction helpers ──────────────────────────────────────────────────────

export function balanceDelta(tx: Pick<Transaction, "type" | "amount">): number {
  return tx.type === "deposit" ? tx.amount : -tx.amount;
}

// Refusal codes of the admin backend's createDeposit / createWithdrawal. The first
// two lift on their own (the next day, or once IT binds a TPE), so a queued
// deposit refused with them stays queued; the others never will.
const RETRY_LATER_CODES = new Set(["DAY_CLOSED", "NO_DEVICE"]);
const SYNC_MESSAGES: Record<string, string> = {
  DAY_CLOSED: "Caisse du jour clôturée : l'opération sera envoyée demain.",
  NO_DEVICE: "Aucun TPE actif n'est lié à votre compte. Contactez votre administrateur.",
  INVALID_AMOUNT: "Montant invalide.",
  INSUFFICIENT_BALANCE: "Solde du client insuffisant pour ce retrait.",
  CUSTOMER_NOT_FOUND: "Client introuvable dans votre agence.",
  DUPLICATE_CLIENT_ID: "Opération en double refusée par le serveur.",
  INVALID_CLIENT_ID: "Opération invalide.",
  FORBIDDEN: "Vous n'avez pas l'autorisation pour cette opération.",
};

function errorCode(error: unknown): string | null {
  if (!(error instanceof ConvexError)) return null;
  const data = error.data as { code?: string } | string;
  return typeof data === "string" ? data : (data?.code ?? null);
}

/**
 * The server refused the operation for good (unknown customer, invalid
 * amount…): retrying will never succeed. Network failures, auth refreshes,
 * redacted "Server Error" and the retry-later codes are not permanent.
 */
export function isPermanentSyncError(
  error: unknown,
): error is ConvexError<{ code: string; message: string }> {
  const code = errorCode(error);
  return error instanceof ConvexError && !(code && RETRY_LATER_CODES.has(code));
}

/** Refused for now (day closed, no TPE bound): keep it queued and say why. */
export function isRetryLaterSyncError(error: unknown): boolean {
  const code = errorCode(error);
  return code !== null && RETRY_LATER_CODES.has(code);
}

export function syncErrorMessage(error: unknown): string {
  const code = errorCode(error);
  if (code && SYNC_MESSAGES[code]) return SYNC_MESSAGES[code];
  if (error instanceof ConvexError) {
    const data = error.data as { message?: string } | string;
    if (typeof data === "string") return data;
    if (data?.message) return data.message;
  }
  return error instanceof Error ? error.message : String(error);
}

// ── Cross-store callbacks ────────────────────────────────────────────────────

type ClientIdRemapListener = (oldId: string, newId: string) => void;
let clientIdRemapListener: ClientIdRemapListener | null = null;
let pendingDeltaProvider: (() => Map<string, number>) | null = null;

/** Registered by transaction-store to repoint queued transactions. */
export function onClientIdRemapped(listener: ClientIdRemapListener) {
  clientIdRemapListener = listener;
}

/** Called by client-store once Convex has assigned a real id to a local client. */
export function notifyClientIdRemapped(oldId: string, newId: string) {
  if (oldId !== newId) clientIdRemapListener?.(oldId, newId);
}

/** Registered by transaction-store: net balance change of queued transactions per client. */
export function registerPendingDeltaProvider(
  provider: () => Map<string, number>,
) {
  pendingDeltaProvider = provider;
}

export function getPendingBalanceDeltas(): Map<string, number> {
  return pendingDeltaProvider?.() ?? new Map();
}
