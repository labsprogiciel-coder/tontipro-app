import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { authz } from './authz'

export const requestDisbursement = mutation({
  args: {
    amount: v.number(),
    customerId: v.id('customers'),
    payoutMethod: v.union(v.literal('cash'), v.literal('mobile_money')),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')
    const agent = await ctx.db
      .query('users')
      .withIndex('by_token', (q) => q.eq('tokenIdentifier', identity.subject))
      .unique()
    if (!agent) throw new Error('Agent not found')
    await authz.withTenant(agent.branchId).require(ctx, identity.subject, 'disbursements:request')
    return ctx.db.insert('disbursements', {
      amount: args.amount,
      customerId: args.customerId,
      branchId: agent.branchId,
      initiatedBy: agent._id,
      status: 'pending',
      payoutMethod: args.payoutMethod,
      timestamp: Date.now(),
    })
  },
})

export const listPending = query({
  args: { branchId: v.id('branches') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')
    // Enforce branch membership before exposing any records
    const user = await ctx.db
      .query('users')
      .withIndex('by_token', (q) => q.eq('tokenIdentifier', identity.subject))
      .unique()
    if (!user || user.branchId !== args.branchId) {
      throw new Error('Unauthorized: Cannot view disbursements for this branch')
    }
    return ctx.db
      .query('disbursements')
      .withIndex('by_status', (q) => q.eq('status', 'pending'))
      .filter((q) => q.eq(q.field('branchId'), args.branchId))
      .collect()
  },
})

export const listHistory = query({
  args: { branchId: v.id('branches') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')
    // Enforce branch membership before exposing any records
    const user = await ctx.db
      .query('users')
      .withIndex('by_token', (q) => q.eq('tokenIdentifier', identity.subject))
      .unique()
    if (!user || user.branchId !== args.branchId) {
      throw new Error('Unauthorized: Cannot view disbursements for this branch')
    }
    // Fetch each non-pending status and merge — no by_branch index exists
    const [approved, rejected, executed] = await Promise.all([
      ctx.db
        .query('disbursements')
        .withIndex('by_status', (q) => q.eq('status', 'approved'))
        .filter((q) => q.eq(q.field('branchId'), args.branchId))
        .collect(),
      ctx.db
        .query('disbursements')
        .withIndex('by_status', (q) => q.eq('status', 'rejected'))
        .filter((q) => q.eq(q.field('branchId'), args.branchId))
        .collect(),
      ctx.db
        .query('disbursements')
        .withIndex('by_status', (q) => q.eq('status', 'executed'))
        .filter((q) => q.eq(q.field('branchId'), args.branchId))
        .collect(),
    ])
    return [...approved, ...rejected, ...executed].sort((a, b) => b.timestamp - a.timestamp)
  },
})

export const rejectDisbursement = mutation({
  args: { disbursementId: v.id('disbursements'), reason: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')

    // load the user to scope authorization to their branch (mirrors approveDisbursement)
    const user = await ctx.db
      .query('users')
      .withIndex('by_token', (q) => q.eq('tokenIdentifier', identity.subject))
      .unique()
    if (!user) throw new Error('User not found')

    // Verify the disbursement exists before touching it
    const record = await ctx.db.get(args.disbursementId)
    if (!record) throw new Error('Disbursement not found')

    // Guard against rejecting a non-pending record
    if (record.status !== 'pending') {
      throw new Error('Can only reject pending disbursements')
    }

    // Verify the disbursement belongs to the user's branch before authorizing
    if (record.branchId !== user.branchId) {
      throw new Error('Unauthorized: Cannot reject disbursements from another branch')
    }

    // Fix #2a (cont): branch-scoped authz, consistent with approveDisbursement
    await authz.withTenant(user.branchId).require(ctx, identity.subject, 'disbursements:approve')

    if (args.reason.length > 500) throw new Error('Reason too long (max 500 chars)')
    return ctx.db.patch(args.disbursementId, {
      status: 'rejected',
      rejectionReason: args.reason,
      rejectedBy: user._id,
      transactionId: args.reason, // temporary: reuse transactionId until schema is updated
      approvedBy: user._id, // temporary: reuse as "decidedBy" until schema adds rejectedBy
    })
  },
})

export const approveDisbursement = mutation({
  args: { disbursementId: v.id('disbursements') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')

    const supervisor = await ctx.db
      .query('users')
      .withIndex('by_token', (q) => q.eq('tokenIdentifier', identity.subject))
      .unique()
    if (!supervisor) throw new Error('User not found')

    await authz
      .withTenant(supervisor.branchId)
      .require(ctx, identity.subject, 'disbursements:approve')

    const record = await ctx.db.get(args.disbursementId)
    if (!record) throw new Error('Disbursement not found')

    if (record.status !== 'pending') {
      throw new Error('Can only approve pending disbursements')
    }

    if (record.initiatedBy === supervisor._id) {
      throw new Error('Fraud Prevention: You cannot approve your own request.')
    }

    return ctx.db.patch(args.disbursementId, {
      status: 'approved',
      approvedBy: supervisor._id,
    })
  },
})

export const canApproveDisbursements = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return false
    const user = await ctx.db
      .query('users')
      .withIndex('by_token', (q) => q.eq('tokenIdentifier', identity.subject))
      .unique()
    if (!user) return false
    try {
      await authz.withTenant(user.branchId).require(ctx, identity.subject, 'disbursements:approve')
      return true
    } catch {
      return false
    }
  },
})
