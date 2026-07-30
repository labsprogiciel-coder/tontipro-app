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
}
