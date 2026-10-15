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
  /** Set when the server permanently rejected a queued transaction. */
  syncError?: string;
}
