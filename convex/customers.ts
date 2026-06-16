import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { authz } from './authz'

export const listByBranch = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')

    const agent = await ctx.db
      .query('users')
      .withIndex('by_token', (q) => q.eq('tokenIdentifier', identity.subject))
      .unique()
    if (!agent) throw new Error('Agent not found')

    await authz.withTenant(agent.branchId).require(ctx, identity.subject, 'customers:view')

    const customers = await ctx.db
      .query('customers')
      .withIndex('by_branch', (q) => q.eq('branchId', agent.branchId))
      .collect()

    const branchUsers = await ctx.db
      .query('users')
      .withIndex('by_branch', (q) => q.eq('branchId', agent.branchId))
      .collect()

    const userMap = new Map(branchUsers.map((u) => [u._id, u.fullName]))

    return customers.map((c) => {
      const { idNumber, metadata, ...safeCustomer } = c
      return {
        ...safeCustomer,
        agentName: userMap.get(c.onboardedBy) ?? '—',
      }
    })
  },
})

export const createProspect = mutation({
  args: {
    fullName: v.string(),
    phoneNumber: v.string(),
    idNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const fullName = args.fullName.trim()
    const phoneNumber = args.phoneNumber.trim()
    const idNumber = args.idNumber.trim()
    if (!fullName || !phoneNumber || !idNumber) {
      throw new Error('All fields are required')
    }
    if (fullName.length > 200) throw new Error('Full name too long (max 200 chars)')
    if (phoneNumber.length > 20) throw new Error('Phone number too long (max 20 chars)')
    if (idNumber.length > 50) throw new Error('ID number too long (max 50 chars)')

    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')

    const agent = await ctx.db
      .query('users')
      .withIndex('by_token', (q) => q.eq('tokenIdentifier', identity.subject))
      .unique()
    if (!agent) throw new Error('Agent not found')

    await authz
      .withTenant(agent.branchId)
      .require(ctx, identity.subject, 'customers:create_prospect')
    // ← Résoudre l'organizationId depuis la branche de l'agent
    const branch = await ctx.db.get(agent.branchId)
    if (!branch) throw new Error('Branch not found')
    const { organizationId } = branch

    // Duplicate phone check (scoped to organization)
    const existingPhone = await ctx.db
      .query('customers')
      .withIndex('by_organization_phone', (q) =>
        q.eq('organizationId', organizationId).eq('phoneNumber', phoneNumber)
      )
      .first()
    if (existingPhone) throw new Error('Un client avec ce numéro de téléphone existe déjà')

    // Duplicate ID check (scoped to organization)
    const existingId = await ctx.db
      .query('customers')
      .withIndex('by_organization_id_number', (q) =>
        q.eq('organizationId', organizationId).eq('idNumber', idNumber)
      )
      .first()
    if (existingId) throw new Error("Un client avec ce numéro de pièce d'identité existe déjà")

    return ctx.db.insert('customers', {
      fullName,
      phoneNumber,
      idNumber,
      organizationId, // ← ajouté
      branchId: agent.branchId,
      onboardedBy: agent._id,
      status: 'prospect',
      createdAt: Date.now(),
    })
  },
})
