import type { GeoFix } from "@/lib/location";

export interface Transaction {
  id: string;
  clientId: string;
  clientName: string;
  amount: number;
  type: "deposit" | "withdrawal";
  date: string;
  status: "completed" | "pending" | "reversed";
  agentId?: string;
  notes?: string;
  /** Idempotency key sent with the server mutation (queued transactions). */
  clientRef?: string;
  /** Where the TPE was when it was recorded (sent to the server for audit). */
  location?: GeoFix;
  /** Set when the server permanently rejected a queued transaction. */
  syncError?: string;
}
