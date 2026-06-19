// types/agent.ts
// Agent types aligned with Convex users table schema.
// Old fields (id, name, phone, permissions, stats, createdBy, zone, ref, joinedAt)
// have been removed — everything now comes from the Convex `users` table.

export type AgentRole =
  | "field_agent"
  | "supervisor"
  | "accountant"
  | "admin"
  | "it_admin";

/**
 * Permissions are now implicit based on role.
 * This interface is kept for backward compatibility with usePermissions().
 */
export interface AgentPermissions {
  addClient: boolean;
  editClient: boolean;
  deposit: boolean;
  withdrawal: boolean;
  exportReports: boolean;
  manageAgents: boolean;
  importData: boolean;
}

/** Derive permissions from role — no more per-agent JSON toggles */
export function permissionsForRole(role: AgentRole): AgentPermissions {
  switch (role) {
    case "admin":
    case "it_admin":
      return {
        addClient: true,
        editClient: true,
        deposit: true,
        withdrawal: true,
        exportReports: true,
        manageAgents: true,
        importData: true,
      };
    case "supervisor":
      return {
        addClient: true,
        editClient: true,
        deposit: true,
        withdrawal: true,
        exportReports: true,
        manageAgents: false,
        importData: false,
      };
    case "accountant":
      return {
        addClient: false,
        editClient: false,
        deposit: false,
        withdrawal: false,
        exportReports: true,
        manageAgents: false,
        importData: false,
      };
    case "field_agent":
    default:
      return {
        addClient: true,
        editClient: true,
        deposit: true,
        withdrawal: false,
        exportReports: false,
        manageAgents: false,
        importData: false,
      };
  }
}
