import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { authz } from './authz'

export const settleDailyCash = mutation({
  args: {
    agentId: v.id('users'),
    date: v.optional(v.string()),
    physicalAmount: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')

    const verifier = await ctx.db
      .query('users')
      .withIndex('by_token', (q) => q.eq('tokenIdentifier', identity.subject))
      .unique()
    if (!verifier) throw new Error('User not found')

    await authz
      .withTenant(verifier.branchId)
      .require(ctx, identity.subject, 'reconciliation:liquidate')

    // Use provided date or fall back to today
    const date = args.date ?? new Date().toISOString().split('T')[0]

    // Guard: prevent duplicate reconciliation for same agent/date
    const existing = await ctx.db
      .query('reconciliations')
      .withIndex('by_agent_date', (q) => q.eq('agentId', args.agentId).eq('date', date))
      .unique()
    if (existing) throw new Error(`Réconciliation déjà effectuée pour cet agent le ${date}.`)

    const startOfDay = new Date(date + 'T00:00:00Z').getTime()
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1

    const transactions = await ctx.db
      .query('transactions')
      .withIndex('by_agent_date', (q) => q.eq('agentId', args.agentId))
      .filter((q) =>
        q.and(
          q.or(q.eq(q.field('status'), 'completed'), q.eq(q.field('status'), 'pending')),
          q.gte(q.field('timestamp'), startOfDay),
          q.lte(q.field('timestamp'), endOfDay)
        )
      )
      .collect()

    if (!transactions[0]) throw new Error('Aucune transaction trouvée pour cet agent à cette date.')

    const systemExpected = transactions.reduce((sum, tx) => sum + tx.amount, 0)
    const variance = args.physicalAmount - systemExpected
    const status = variance === 0 ? 'settled' : 'discrepancy'

    const reconciliationId = await ctx.db.insert('reconciliations', {
      agentId: args.agentId,
      branchId: transactions[0].branchId,
      verifiedBy: verifier._id,
      date, // ← date argument, not hardcoded today
      systemExpectedAmount: systemExpected,
      physicalCashReceived: args.physicalAmount,
      variance,
      status,
      timestamp: Date.now(),
      notes: args.notes,
    })

    return { reconciliationId, variance, status }
  },
})

export const listByBranch = query({
  args: { branchId: v.id('branches'), date: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')

    const user = await ctx.db
      .query('users')
      .withIndex('by_token', (q) => q.eq('tokenIdentifier', identity.subject))
      .unique()
    if (!user) throw new Error('User not found')

    if (user.branchId !== args.branchId) throw new Error('Unauthorized')

    await authz.withTenant(user.branchId).require(ctx, identity.subject, 'reconciliation:liquidate')

    const { branchId, date } = args
    const records = date
      ? await ctx.db
          .query('reconciliations')
          .withIndex('by_branch_date', (r) => r.eq('branchId', branchId).eq('date', date))
          .order('desc')
          .collect()
      : await ctx.db
          .query('reconciliations')
          .withIndex('by_branch_date', (r) => r.eq('branchId', branchId))
          .order('desc')
          .take(90)

    // Enrich with agent and verifier names
    return Promise.all(
      records.map(async (r) => {
        const agent = await ctx.db.get(r.agentId)
        const verifier = await ctx.db.get(r.verifiedBy)
        return {
          ...r,
          agentName: agent?.fullName ?? agent?.email ?? null,
          verifierName: verifier?.fullName ?? verifier?.email ?? null,
        }
      })
    )
  },
})

export const getAgentDailySummary = query({
  args: { agentId: v.id('users'), date: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')

    const startOfDay = new Date(args.date + 'T00:00:00Z').getTime()
    const endOfDay = new Date(args.date + 'T23:59:59Z').getTime()

    return ctx.db
      .query('transactions')
      .withIndex('by_agent_date', (q) => q.eq('agentId', args.agentId))
      .filter((q) =>
        q.and(
          q.eq(q.field('status'), 'completed'),
          q.gte(q.field('timestamp'), startOfDay),
          q.lte(q.field('timestamp'), endOfDay)
        )
      )
      .collect()
  },
})
