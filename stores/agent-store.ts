import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { generateId } from "@/utils/id-generator";
import { isConnected } from "@/utils/network";
import { supabase } from "@/lib/supabase";
import { Agent, AgentPermissions, AgentRole } from "@/types/agent";

interface AgentStoreState {
  agents: Agent[];
  isLoading: boolean;
  isLoadingAgents: boolean;
  error: string | null;

  loadAgentsFromSupabase: () => Promise<void>;
  setAgentPin: (agentId: string, pin: string) => Promise<void>;
  addAgent: (data: {
    name: string;
    phone: string;
    zone?: string;
    email?: string;
    role: AgentRole;
    permissions: AgentPermissions;
    pin?: string;
  }) => Promise<Agent>;
  updateAgent: (id: string, data: Partial<Agent>) => Promise<Agent>;
  getAgentById: (id: string) => Agent | undefined;
  syncPendingAgents: () => Promise<void>;
  loadDevMocks: () => Promise<void>;
  clearAll: () => void;
}

function permissionsToDb(p: AgentPermissions) {
  return {
    add_client: p.addClient,
    edit_client: p.editClient,
    deposit: p.deposit,
    withdrawal: p.withdrawal,
    export_reports: p.exportReports,
    manage_agents: p.manageAgents,
  };
}

function permissionsFromDb(p: any): AgentPermissions {
  return {
    addClient: p?.add_client ?? false,
    editClient: p?.edit_client ?? false,
    deposit: p?.deposit ?? false,
    withdrawal: p?.withdrawal ?? false,
    exportReports: p?.export_reports ?? false,
    manageAgents: p?.manage_agents ?? false,
  };
}

export const useAgentStore = create<AgentStoreState>()(
  persist(
    (set, get) => ({
      agents: [],
      isLoading: false,
      isLoadingAgents: false,
      error: null,

      loadAgentsFromSupabase: async () => {
        set({ isLoadingAgents: true, error: null });
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) throw new Error("No authenticated user");

          const { data: rows, error } = await supabase
            .from("agents")
            .select("*")
            .eq("created_by", user.id);

          if (error) throw new Error(error.message);

          const agents: Agent[] = (rows || []).map((row: any) => ({
            id: row.id,
            name: row.name,
            phone: row.phone,
            zone: row.zone,
            email: row.email,
            role: row.role,
            ref: row.ref,
            joinedAt: row.joined_at,
            online: row.online ?? false,
            permissions: permissionsFromDb(row.permissions),
            stats: {
              clients: row.stats?.clients ?? 0,
              transactions: row.stats?.transactions ?? 0,
              collected: row.stats?.collected ?? "0",
            },
            syncStatus: "synced" as const,
            createdBy: row.created_by,
          }));

          set({ agents, isLoadingAgents: false });
        } catch (error) {
          set({
            isLoadingAgents: false,
            error: error instanceof Error ? error.message : "Failed to load agents",
          });
          throw error;
        }
      },

      setAgentPin: async (agentId, pin) => {
        const agent = get().agents.find((a) => a.id === agentId);
        if (!agent) throw new Error("Agent not found");
        await AsyncStorage.setItem(`pin_${agent.phone}`, pin);
        const raw = await AsyncStorage.getItem("kauridorr_registered_phones");
        const phones: string[] = raw ? JSON.parse(raw) : [];
        if (!phones.includes(agent.phone)) {
          await AsyncStorage.setItem(
            "kauridorr_registered_phones",
            JSON.stringify([...phones, agent.phone])
          );
        }
      },

      loadDevMocks: async () => {
        if (!__DEV__) return;
        if (get().agents.length > 0) return;
        const { mockAgents } = await import("@/__dev__/mocks/agents");
        const agents: Agent[] = mockAgents.map((a) => ({
          id: a.id,
          name: a.name,
          phone: a.phone,
          zone: a.zone,
          role: a.role,
          ref: a.ref,
          joinedAt: a.joinedAt,
          online: a.online,
          permissions: a.permissions,
          stats: a.stats,
          syncStatus: "synced" as const,
        }));
        set({ agents });
      },

      addAgent: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const online = await isConnected();
          const id = generateId("AGT");
          const ref = `AGT-${new Date().getFullYear()}-${id.slice(-3)}`;

          // Persist temporary PIN so the agent can log in via PIN screen
          if (data.pin) {
            await AsyncStorage.setItem(`pin_${data.phone}`, data.pin);
            const raw = await AsyncStorage.getItem("kauridorr_registered_phones");
            const phones: string[] = raw ? JSON.parse(raw) : [];
            if (!phones.includes(data.phone)) {
              await AsyncStorage.setItem(
                "kauridorr_registered_phones",
                JSON.stringify([...phones, data.phone])
              );
            }
          }

          const newAgent: Agent = {
            id,
            name: data.name,
            phone: data.phone,
            zone: data.zone,
            email: data.email,
            role: data.role,
            ref,
            joinedAt: new Date().toISOString(),
            online: false,
            permissions: data.permissions,
            stats: { clients: 0, transactions: 0, collected: "0" },
            syncStatus: online ? ("synced" as const) : ("pending" as const),
          };

          set((state) => ({
            agents: [...state.agents, newAgent],
            isLoading: false,
          }));

          if (online) {
            const {
              data: { user },
            } = await supabase.auth.getUser();
            if (user) {
              (async () => {
                try {
                  await supabase.from("agents").insert({
                    id: newAgent.id,
                    name: newAgent.name,
                    phone: newAgent.phone,
                    zone: newAgent.zone,
                    email: newAgent.email,
                    role: newAgent.role,
                    ref: newAgent.ref,
                    joined_at: newAgent.joinedAt,
                    online: newAgent.online,
                    permissions: permissionsToDb(newAgent.permissions),
                    stats: newAgent.stats,
                    created_by: user.id,
                  });
                  set((state) => ({
                    agents: state.agents.map((a) =>
                      a.id === newAgent.id ? { ...a, syncStatus: "synced" as const } : a
                    ),
                  }));
                } catch (err) {
                  console.error("Failed to sync new agent:", err);
                  set((state) => ({
                    agents: state.agents.map((a) =>
                      a.id === newAgent.id ? { ...a, syncStatus: "pending" as const } : a
                    ),
                  }));
                }
              })();
            }
          }

          return newAgent;
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : "Failed to add agent",
          });
          throw error;
        }
      },

      updateAgent: async (id, data) => {
        set({ isLoading: true, error: null });
        try {
          const online = await isConnected();
          let updatedAgent: Agent | undefined;

          set((state) => {
            const updatedAgents = state.agents.map((agent) => {
              if (agent.id === id) {
                updatedAgent = {
                  ...agent,
                  ...data,
                  syncStatus: online ? ("synced" as const) : ("pending" as const),
                };
                return updatedAgent;
              }
              return agent;
            });
            return { agents: updatedAgents, isLoading: false };
          });

          if (!updatedAgent) throw new Error("Agent not found");

          if (online) {
            const {
              data: { user },
            } = await supabase.auth.getUser();
            if (user) {
              const updatePayload: Record<string, any> = {};
              Object.entries(data).forEach(([key, value]) => {
                if (key === "permissions") {
                  updatePayload.permissions = permissionsToDb(value as AgentPermissions);
                } else if (key !== "syncStatus" && key !== "createdBy") {
                  const snakeKey = key
                    .replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`)
                    .replace(/^_/, "");
                  updatePayload[snakeKey] = value;
                }
              });
              (async () => {
                try {
                  await supabase
                    .from("agents")
                    .update(updatePayload)
                    .eq("id", id)
                    .eq("created_by", user.id);
                  set((state) => ({
                    agents: state.agents.map((a) =>
                      a.id === id ? { ...a, syncStatus: "synced" as const } : a
                    ),
                  }));
                } catch (err) {
                  console.error("Failed to sync agent update:", err);
                  set((state) => ({
                    agents: state.agents.map((a) =>
                      a.id === id ? { ...a, syncStatus: "pending" as const } : a
                    ),
                  }));
                }
              })();
            }
          }

          return updatedAgent;
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : "Failed to update agent",
          });
          throw error;
        }
      },

      getAgentById: (id) => get().agents.find((a) => a.id === id),

      syncPendingAgents: async () => {
        const { agents } = get();
        const pending = agents.filter((a) => a.syncStatus === "pending");
        if (pending.length === 0) return;

        set({ isLoading: true, error: null });
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) throw new Error("No authenticated user");

          for (const agent of pending) {
            const payload = {
              name: agent.name,
              phone: agent.phone,
              zone: agent.zone,
              email: agent.email,
              role: agent.role,
              ref: agent.ref,
              joined_at: agent.joinedAt,
              online: agent.online,
              permissions: permissionsToDb(agent.permissions),
              stats: agent.stats,
              created_by: user.id,
            };

            const { data: existing } = await supabase
              .from("agents")
              .select("id")
              .eq("id", agent.id)
              .eq("created_by", user.id)
              .single();

            if (existing) {
              await supabase
                .from("agents")
                .update(payload)
                .eq("id", agent.id)
                .eq("created_by", user.id);
            } else {
              await supabase.from("agents").insert({ id: agent.id, ...payload });
            }

            set((state) => ({
              agents: state.agents.map((a) =>
                a.id === agent.id ? { ...a, syncStatus: "synced" as const } : a
              ),
            }));
          }

          set({ isLoading: false });
        } catch (error) {
          console.error("Sync pending agents failed:", error);
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : "Sync failed",
          });
        }
      },

      clearAll: () => {
        set({ agents: [], isLoading: false, isLoadingAgents: false, error: null });
      },
    }),
    {
      name: "agent-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ agents: state.agents }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isLoading = false;
          state.isLoadingAgents = false;
        }
      },
    }
  )
);
