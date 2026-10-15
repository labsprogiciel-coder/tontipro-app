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

/**
 * A ConvexError is a deliberate rejection by the server (insufficient
 * balance, unknown customer…): retrying will never succeed. Anything else
 * (network, auth refresh, redacted "Server Error") is treated as transient.
 */
export function isPermanentSyncError(
  error: unknown,
): error is ConvexError<{ code: string; message: string }> {
  return error instanceof ConvexError;
}

export function syncErrorMessage(error: unknown): string {
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
