import { useAuthStore } from "@/stores/auth-store";
import { AgentPermissions } from "@/types/agent";

const ALL_PERMISSIONS: AgentPermissions = {
  addClient: true,
  editClient: true,
  deposit: true,
  withdrawal: true,
  exportReports: true,
  manageAgents: true,
};

export function usePermissions(): AgentPermissions {
  return useAuthStore((s) => s.user?.permissions ?? ALL_PERMISSIONS);
}
