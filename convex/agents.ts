import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { authz } from './authz'

export const listByBranch = query({
  args: { branchId: v.id('branches') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')
    const users = await ctx.db
      .query('users')
      .withIndex('by_branch', (q) => q.eq('branchId', args.branchId))
      .collect()
    // Join each user with their assigned device + authz role
    return Promise.all(
      users.map(async (u) => {
        const device = await ctx.db
          .query('devices')
          .withIndex('by_assigned_to', (q) => q.eq('assignedTo', u._id))
          .first()
        const roles = await authz.withTenant(args.branchId).getUserRoles(ctx, u.tokenIdentifier)
        const role = roles[0]?.role ?? null
        return { ...u, device, role }
      })
    )
  },
})

const VALID_ROLES = ['admin', 'supervisor', 'field_agent', 'accountant', 'it_admin'] as const

export const createAgent = mutation({
  args: {
    fullName: v.string(),
    email: v.string(),
    phoneNumber: v.string(),
    role: v.union(
      v.literal('admin'),
      v.literal('supervisor'),
      v.literal('field_agent'),
      v.literal('accountant'),
      v.literal('it_admin')
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Non authentifié')

    const caller = await ctx.db
      .query('users')
      .withIndex('by_token', (q) => q.eq('tokenIdentifier', identity.subject))
      .unique()
    if (!caller) throw new Error('Agent appelant introuvable')

    await authz.withTenant(caller.branchId).require(ctx, identity.subject, 'devices:bind')
    const callerRoles = await authz.withTenant(caller.branchId).getUserRoles(ctx, identity.subject)
    const isAdmin = callerRoles.some((r) => r.role === 'admin')
    if (args.role === 'admin' && !isAdmin) {
      throw new Error("Seul un administrateur peut attribuer le rôle 'admin'.")
    }
    const fullName = args.fullName.trim()
    const email = args.email.trim().toLowerCase()
    const phoneNumber = args.phoneNumber.trim()

    if (!fullName || !email || !phoneNumber) {
      throw new Error('Tous les champs sont obligatoires.')
    }

    // Check duplicate email within the same branch
    const existing = await ctx.db
      .query('users')
      .withIndex('by_branch', (q) => q.eq('branchId', caller.branchId))
      .collect()

    if (existing.some((u) => u.email === email)) {
      throw new Error('Un agent avec cet email existe déjà dans cette agence.')
    }
    if (existing.some((u) => u.phoneNumber === phoneNumber)) {
      throw new Error('Un agent avec ce numéro de téléphone existe déjà dans cette agence.')
    }

    // Generate a placeholder tokenIdentifier — the agent will get a real one
    // when they sign up and link their account.
    const placeholderToken = `invited|${crypto.randomUUID()}`

    const userId = await ctx.db.insert('users', {
      fullName,
      email,
      phoneNumber,
      tokenIdentifier: placeholderToken,
      branchId: caller.branchId,
      status: 'active',
    })

    // Assign the selected role to the new agent
    await authz.withTenant(caller.branchId).assignRole(ctx, placeholderToken, args.role)

    return userId
  },
})

export const disable = mutation({
  args: { agentId: v.id('users') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Non authentifié')

    const caller = await ctx.db
      .query('users')
      .withIndex('by_token', (q) => q.eq('tokenIdentifier', identity.subject))
      .unique()
    if (!caller) throw new Error('Agent appelant introuvable')

    await authz.withTenant(caller.branchId).require(ctx, identity.subject, 'devices:bind')
    const target = await ctx.db.get(args.agentId)
    if (!target) throw new Error('Agent introuvable')
    if (target.branchId !== caller.branchId) throw new Error('Unauthorized')
    return ctx.db.patch(args.agentId, { status: 'suspended' })
  },
})

export const bindDevice = mutation({
  args: { userId: v.id('users'), serialNumber: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')

    const caller = await ctx.db
      .query('users')
      .withIndex('by_token', (q) => q.eq('tokenIdentifier', identity.subject))
      .unique()
    if (!caller) throw new Error('User not found')

    await authz.withTenant(caller.branchId).require(ctx, identity.subject, 'devices:bind')
    const device = await ctx.db
      .query('devices')
      .withIndex('by_serial', (q) => q.eq('serialNumber', args.serialNumber))
      .unique()
    if (!device) throw new Error('Device not found')
    return ctx.db.patch(device._id, { assignedTo: args.userId })
  },
})
