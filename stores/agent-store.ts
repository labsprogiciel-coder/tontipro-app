// stores/agent-store.ts
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { convex } from '@/lib/convex'           // your ConvexReactClient instance
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { DEV_MOCKS_ENABLED } from '@/__dev__/config'

// ── Types ─────────────────────────────────────────────────────────────────────

export type AgentRole =
  | 'field_agent'
  | 'supervisor'
  | 'accountant'
  | 'admin'
  | 'it_admin'

export type AgentStatus = 'active' | 'invited' | 'suspended'

export interface Agent {
  _id: Id<'users'>
  fullName: string
  email: string
  phoneNumber: string
  branchId: Id<'branches'>
  status: AgentStatus
  tokenIdentifier: string
  role: AgentRole
  /** Derived from device.lastSync < 5 min — not stored */
  online: boolean
  device: { _id: Id<'devices'>; lastSync?: string } | null
}

export interface CreateAgentParams {
  fullName: string
  email: string
  phoneNumber: string
  branchId: Id<'branches'>
  role: AgentRole
  /** Temporary PIN stored locally for first-login flow */
  pin?: string
}

export interface UpdateAgentParams {
  fullName?: string
  phoneNumber?: string
  role?: AgentRole
}

interface AgentStoreState {
  agents: Agent[]
  isLoading: boolean
  error: string | null

  /** Fetch all agents for the given branch via Convex */
  loadAgents: (branchId: Id<'branches'>) => Promise<void>

  /** Create a new agent via Convex — admin/supervisor only */
  addAgent: (params: CreateAgentParams) => Promise<Agent>

  /** Update mutable agent fields and/or role via Convex */
  updateAgent: (id: Id<'users'>, params: UpdateAgentParams) => Promise<void>

  /** Suspend an agent (sets status: 'suspended') via Convex */
  suspendAgent: (id: Id<'users'>) => Promise<void>

  /**
   * Store the agent's temporary PIN in AsyncStorage, keyed by their Convex _id.
   * Local-only — no server call required.
   */
  setAgentPin: (agentId: Id<'users'>, phoneNumber: string, pin: string) => Promise<void>

  getAgentById: (id: Id<'users'>) => Agent | undefined

  loadDevMocks: () => Promise<void>
  clearAll: () => void
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAgentStore = create<AgentStoreState>()(
  persist(
    (set, get) => ({
      agents: [],
      isLoading: false,
      error: null,

      // ── Load ──────────────────────────────────────────────────────────────

      loadAgents: async (branchId) => {
        set({ isLoading: true, error: null })
        try {
          const agents = await convex.query(api.users.listByBranch, { branchId })
          set({ agents: agents as Agent[], isLoading: false })
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : 'Impossible de charger les agents',
          })
          throw err
        }
      },

      // ── Create ────────────────────────────────────────────────────────────

      addAgent: async (params) => {
        set({ isLoading: true, error: null })
        try {
          const userId = await convex.mutation(api.users.create, {
            fullName: params.fullName,
            email: params.email,
            phoneNumber: params.phoneNumber,
            branchId: params.branchId,
            role: params.role,
          })

          // Store PIN locally keyed by _id (updated key format post-migration)
          if (params.pin) {
            await get().setAgentPin(userId as Id<'users'>, params.phoneNumber, params.pin)
          }

          // Reload to get the full hydrated agent (role, online, device)
          await get().loadAgents(params.branchId)

          const created = get().agents.find((a) => a._id === userId)
          if (!created) throw new Error('Agent créé mais introuvable après rechargement')

          set({ isLoading: false })
          return created
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : "Impossible de créer l'agent",
          })
          throw err
        }
      },

      // ── Update ────────────────────────────────────────────────────────────

      updateAgent: async (id, params) => {
        set({ isLoading: true, error: null })
        try {
          await convex.mutation(api.users.update, { id, ...params })

          // Optimistic update in local cache
          set((state) => ({
            isLoading: false,
            agents: state.agents.map((a) => {
              if (a._id !== id) return a
              return {
                ...a,
                ...(params.fullName !== undefined && { fullName: params.fullName }),
                ...(params.phoneNumber !== undefined && { phoneNumber: params.phoneNumber }),
                ...(params.role !== undefined && { role: params.role }),
              }
            }),
          }))
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : "Impossible de mettre à jour l'agent",
          })
          throw err
        }
      },

      // ── Suspend ───────────────────────────────────────────────────────────

      suspendAgent: async (id) => {
        set({ isLoading: true, error: null })
        try {
          await convex.mutation(api.users.suspend, { id })
          set((state) => ({
            isLoading: false,
            agents: state.agents.map((a) =>
              a._id === id ? { ...a, status: 'suspended' as AgentStatus } : a
            ),
          }))
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : "Impossible de suspendre l'agent",
          })
          throw err
        }
      },

      // ── PIN (local-only) ──────────────────────────────────────────────────
      //
      // Key format is now `pin_agent_<_id>` (was `pin_<phone>`).
      // phoneNumber is still registered in `kauridorr_registered_phones` so the
      // PIN login screen can look it up.

      setAgentPin: async (agentId, phoneNumber, pin) => {
        await AsyncStorage.setItem(`pin_agent_${agentId}`, pin)

        const raw = await AsyncStorage.getItem('kauridorr_registered_phones')
        const phones: string[] = raw ? JSON.parse(raw) : []
        if (!phones.includes(phoneNumber)) {
          await AsyncStorage.setItem(
            'kauridorr_registered_phones',
            JSON.stringify([...phones, phoneNumber])
          )
        }

        // Also register a phoneNumber → agentId mapping so the login screen can
        // resolve which key to read when the user enters their phone number
        await AsyncStorage.setItem(`agent_id_for_phone_${phoneNumber}`, agentId)
      },

      // ── Helpers ───────────────────────────────────────────────────────────

      getAgentById: (id) => get().agents.find((a) => a._id === id),

      // ── Dev mocks ─────────────────────────────────────────────────────────

      loadDevMocks: async () => {
        if (!DEV_MOCKS_ENABLED) return
        if (get().agents.length > 0) return
        const { mockAgents } = await import('@/__dev__/mocks/agents')
        // mockAgents must be updated to use the new schema shape
        set({ agents: mockAgents as unknown as Agent[] })
      },

      clearAll: () => {
        set({ agents: [], isLoading: false, error: null })
      },
    }),
    {
      name: 'agent-storage-v2',   // bumped version to avoid stale v1 shape
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ agents: state.agents }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isLoading = false
        }
      },
    }
  )
)
