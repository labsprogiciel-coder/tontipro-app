//convex/transactions.ts
import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { authz } from './authz'
import { QueryCtx, MutationCtx } from './_generated/server'

// Helpers
async function resolveAgent(ctx: QueryCtx | MutationCtx, subject: string) {
  const agent = await ctx.db
    .query('users')
    .withIndex('by_token', (q) => q.eq('tokenIdentifier', subject))
    .unique()
  if (!agent) throw new Error('Agent not found')
  return agent
}

// Queries
export const listByCustomer = query({
  args: {
    customerId: v.id('customers'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')

    const agent = await resolveAgent(ctx, identity.subject)

    // Fix 1: explicit permission check — branch membership alone is not sufficient
    await authz
      .withTenant(agent.branchId)
      .require(ctx, identity.subject, 'transactions:view_ledger')

    // Charger le client et vérifier qu'il appartient à la même branche
    const customer = await ctx.db.get(args.customerId)
    if (!customer) throw new Error('Customer not found')
    if (customer.branchId !== agent.branchId) throw new Error('Unauthorized')

    const rows = await ctx.db
      .query('transactions')
      .withIndex('by_branch', (q) => q.eq('branchId', agent.branchId))
      .filter((q) => q.eq(q.field('customerId'), args.customerId))
      .order('desc')
      .take(args.limit ?? 10)

    const agentIds = [...new Set(rows.map((t) => t.agentId))]
    const agents = await Promise.all(agentIds.map((id) => ctx.db.get(id)))
    const agentMap = Object.fromEntries(agents.map((a) => [a!._id, a]))
    return rows.map((t) => ({ ...t, agentName: agentMap[t.agentId]?.fullName ?? '—' }))
  },
})

// T1 + T5 — liste branche avec filtre date server-side
export const listByBranch = query({
  args: {
    from: v.optional(v.number()),
    to: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')

    const agent = await resolveAgent(ctx, identity.subject)

    await authz.withTenant(agent.branchId).require(ctx, identity.subject, 'transactions:audit')

    const rows = await ctx.db
      .query('transactions')
      .withIndex('by_branch_timestamp', (q: any) => {
        let r = q.eq('branchId', agent.branchId)
        if (args.from) r = r.gte('timestamp', args.from)
        if (args.to) r = r.lte('timestamp', args.to)
        return r
      })
      .order('desc')
      .take(500)

    return Promise.all(
      rows.map(async (t) => {
        const agentRecord = await ctx.db.get(t.agentId)
        const customer = await ctx.db.get(t.customerId)
        return {
          ...t,
          agentName: agentRecord?.fullName ?? '—',
          customerName: customer?.fullName ?? '—',
        }
      })
    )
  },
})

// ─── Mutations ───────────────────────────────────────────────────────────────

// T1 — collecte de cash
export const collectCash = mutation({
  args: {
    customerId: v.id('customers'),
    amount: v.number(),
    tpeId: v.string(),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')

    const agent = await resolveAgent(ctx, identity.subject)

    await authz.withTenant(agent.branchId).require(ctx, identity.subject, 'transactions:collect')

    const customer = await ctx.db.get(args.customerId)
    if (!customer) throw new Error('Customer not found')
    if (customer.branchId !== agent.branchId) throw new Error('Unauthorized')

    // Fix 2: reject non-positive amounts before writing to the ledger
    if (args.amount <= 0) throw new Error('Amount must be greater than 0')

    return ctx.db.insert('transactions', {
      amount: args.amount,
      currency: args.currency ?? 'XOF',
      type: 'deposit',
      customerId: args.customerId,
      agentId: agent._id,
      branchId: agent.branchId,
      tpeId: args.tpeId,
      status: 'pending',
      timestamp: Date.now(),
    })
  },
})

// T2 — valider une transaction pending
export const validateTransaction = mutation({
  args: { transactionId: v.id('transactions') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')

    const agent = await resolveAgent(ctx, identity.subject)

    await authz.withTenant(agent.branchId).require(ctx, identity.subject, 'transactions:audit')

    const tx = await ctx.db.get(args.transactionId)
    if (!tx) throw new Error('Transaction not found')
    if (tx.branchId !== agent.branchId) throw new Error('Unauthorized')
    if (tx.status !== 'pending') throw new Error('Only pending transactions can be validated')

    return ctx.db.patch(args.transactionId, { status: 'completed' })
  },
})

// T3 — annulation avec raison
export const reverseTransaction = mutation({
  args: {
    transactionId: v.id('transactions'),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')

    const agent = await resolveAgent(ctx, identity.subject)

    await authz.withTenant(agent.branchId).require(ctx, identity.subject, 'transactions:reverse')

    const tx = await ctx.db.get(args.transactionId)
    if (!tx) throw new Error('Transaction not found')
    if (tx.branchId !== agent.branchId) throw new Error('Unauthorized')
    if (tx.status === 'reversed') throw new Error('Already reversed')
    if (args.reason.length > 500) throw new Error('Reason too long (max 500 chars)')

    // Fix 3: scope reconciliation guard to the transaction's agent + date,
    // replacing the broken lte+gte exact-equality filter that missed most
    // settled reconciliations and wasn't scoped to the agent
    const txDate = new Date(tx.timestamp).toISOString().slice(0, 10)
    const reconciled = await ctx.db
      .query('reconciliations')
      .withIndex('by_agent_date', (q) => q.eq('agentId', tx.agentId).eq('date', txDate))
      .filter((q) => q.eq(q.field('status'), 'settled'))
      .first()
    if (reconciled) throw new Error('Transaction already reconciled — reversal blocked')

    return ctx.db.patch(args.transactionId, {
      status: 'reversed',
      reversalReason: args.reason,
      reversedBy: agent._id,
    })
  },
})

export const summarizeByAgent = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')

    const agent = await resolveAgent(ctx, identity.subject)

    const allowed = await authz
      .withTenant(agent.branchId)
      .can(ctx, identity.subject, 'transactions:audit')
    if (!allowed) return {}

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime()

    const txs = await ctx.db
      .query('transactions')
      .withIndex('by_branch_timestamp', (q) =>
        q.eq('branchId', agent.branchId).gte('timestamp', startOfMonth)
      )
      // Fix 4: restrict to deposit + completed — prevents reversals, withdrawals,
      // or any future transaction type from inflating collected/txMonth/clients
      .filter((q) => q.and(q.eq(q.field('status'), 'completed'), q.eq(q.field('type'), 'deposit')))
      .collect()

    // Agréger par agentId
    const map = new Map<string, { collected: number; txMonth: number; customers: Set<string> }>()
    for (const tx of txs) {
      const key = tx.agentId as string
      if (!map.has(key)) map.set(key, { collected: 0, txMonth: 0, customers: new Set() })
      const entry = map.get(key)!
      entry.collected += tx.amount
      entry.txMonth += 1
      entry.customers.add(tx.customerId as string)
    }

    return Object.fromEntries(
      [...map.entries()].map(([agentId, v]) => [
        agentId,
        { collected: v.collected, txMonth: v.txMonth, clients: v.customers.size },
      ])
    )
  },
})
