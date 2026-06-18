import { mutation, query, internalMutation } from './_generated/server'
import { v } from 'convex/values'
import { authz } from './authz'

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const user = await ctx.db
      .query('users')
      .withIndex('by_token', (q) => q.eq('tokenIdentifier', identity.subject))
      .unique()
    if (!user) return null

    const branch = await ctx.db.get(user.branchId)
    const org = branch ? await ctx.db.get(branch.organizationId) : null

    const roles = await authz.withTenant(user.branchId).getUserRoles(ctx, identity.subject)
    const role = roles[0]?.role ?? null

    // Attach the device assigned to this user (if any)
    const device = await ctx.db
      .query('devices')
      .withIndex('by_assigned_to', (q) => q.eq('assignedTo', user._id))
      .first()

    return {
      ...user,
      branch,
      organization: org,
      tenantId: user.branchId,
      role,
      device: device ?? null,
    }
  },
})

export const onboard = mutation({
  args: {
    // Organisation
    orgName: v.string(),
    country: v.string(),
    currency: v.string(),
    licenseNumber: v.string(),
    // Branch
    branchName: v.string(),
    branchLocation: v.string(),
    branchCode: v.string(),
    // User
    fullName: v.string(),
    phoneNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Non authentifié')

    // Prevent duplicate registration
    const existing = await ctx.db
      .query('users')
      .withIndex('by_token', (q) => q.eq('tokenIdentifier', identity.subject))
      .unique()
    if (existing) throw new Error('Ce compte est déjà enregistré')

    const orgId = await ctx.db.insert('organizations', {
      name: args.orgName,
      country: args.country,
      currency: args.currency,
      licenseNumber: args.licenseNumber,
      status: 'active',
    })

    const branchId = await ctx.db.insert('branches', {
      organizationId: orgId,
      name: args.branchName,
      location: args.branchLocation,
      code: args.branchCode,
    })

    await ctx.db.insert('users', {
      fullName: args.fullName,
      email: (identity.email ?? '').toLowerCase(),
      phoneNumber: args.phoneNumber,
      tokenIdentifier: identity.subject,
      branchId,
      status: 'active',
    })

    // Assign admin role so the org creator has full operational permissions
    await authz.withTenant(branchId).assignRole(ctx, identity.subject, 'admin')
  },
})

// Called once after an agent's first Password sign-in.
// Links their convex-auth identity to the pre-created users row (invited|uuid)
// and transfers their role to the new tokenIdentifier.
export const linkAgentAccount = mutation({
  args: { inviteToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Non authentifié')

    // Already linked — nothing to do
    const already = await ctx.db
      .query('users')
      .withIndex('by_token', (q) => q.eq('tokenIdentifier', identity.subject))
      .unique()
    if (already) return already._id

    const email = identity.email?.toLowerCase()
    if (!email) throw new Error('Email introuvable dans le token agent')

    let invitedUser = null;

    if (args.inviteToken) {
      // Find by specific token if provided
      invitedUser = await ctx.db
        .query('users')
        .withIndex('by_token', (q) => q.eq('tokenIdentifier', `invited|${args.inviteToken}`))
        .unique();
    }

    if (!invitedUser) {
      // Fallback: Find the pre-created invited record for this email
      const byEmail = await ctx.db
        .query('users')
        .withIndex('by_email', (q) => q.eq('email', email))
        .collect()
      invitedUser = byEmail.find((u) => u.tokenIdentifier.startsWith('invited|'))
    }

    if (!invitedUser) throw new Error('Aucun agent invité trouvé pour cet email ou token')

    // Swap placeholder tokenIdentifier for the real convex-auth subject
    await ctx.db.patch(invitedUser._id, { tokenIdentifier: identity.subject })

    // Transfer role: remove from placeholder, assign to real subject
    const branchAuthz = authz.withTenant(invitedUser.branchId)
    const roles = await branchAuthz.getUserRoles(ctx, invitedUser.tokenIdentifier)
    if (roles.length > 0) {
      await branchAuthz.removeRole(ctx, invitedUser.tokenIdentifier, roles[0].role)
      await branchAuthz.assignRole(ctx, identity.subject, roles[0].role)
    }

    return invitedUser._id
  },
})
