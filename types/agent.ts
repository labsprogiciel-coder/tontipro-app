export type AgentRole = "admin" | "agent" | "blocked";

export interface AgentPermissions {
  addClient: boolean;
  editClient: boolean;
  deposit: boolean;
  withdrawal: boolean;
  exportReports: boolean;
  manageAgents: boolean;
  importData: boolean;
}

export interface Agent {
  id: string;
  name: string;
  phone: string;
  zone?: string;
  email?: string;
  role: AgentRole;
  ref: string;
  joinedAt: string;
  online: boolean;
  permissions: AgentPermissions;
  stats: {
    clients: number;
    transactions: number;
    collected: string;
  };
  syncStatus?: "synced" | "pending";
  createdBy?: string;
}
