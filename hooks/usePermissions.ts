import { useAuthStore } from "@/stores/auth-store";
import { AgentPermissions, AgentRole, permissionsForRole } from "@/types/agent";

const ALL_PERMISSIONS: AgentPermissions = {
  addClient: true,
  editClient: true,
  editSensitiveClient: true,
  deposit: true,
  withdrawal: false, // online-only and role-checked: needs a signed-in role
  exportReports: true,
  manageAgents: true,
};

/**
 * Returns permissions derived from the current user's role.
 * Permissions are implicit — no more per-agent JSON toggles.
 */
export function usePermissions(): AgentPermissions {
  const role = useAuthStore((s) => s.user?.role);
  if (!role || role === "agent") return ALL_PERMISSIONS; // legacy / offline fallback
  return permissionsForRole(role as AgentRole);
}
