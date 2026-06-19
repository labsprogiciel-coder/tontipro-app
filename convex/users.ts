// convex/users.ts
import { mutation, query, internalMutation } from './_generated/server'
import { v } from 'convex/values'
import { authz } from './authz'

// ── Types ─────────────────────────────────────────────────────────────────────

export type AgentRole =
  | 'field_agent'
  | 'supervisor'
  | 'accountant'
  | 'admin'
  | 'it_admin'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Roles that are allowed to manage (create/update/suspend) other users */
const MANAGING_ROLES: AgentRole[] = ['admin', 'supervisor']

async function assertCanManage(
  ctx: any,
  branchId: any,
  callerSubject: string
): Promise<void> {
  const roles = await authz.withTenant(branchId).getUserRoles(ctx, callerSubject)
  const role = roles[0]?.role as AgentRole | undefined
  if (!role || !MANAGING_ROLES.includes(role)) {
    throw new Error('Insufficient permissions — admin or supervisor required')
  }
}

// ── Queries ───────────────────────────────────────────────────────────────────

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const user = await ctx.db
      .query('users')
      .withIndex('by_token', (q: any) => q.eq('tokenIdentifier', identity.subject))
      .unique()
    if (!user) return null

    const branch = await ctx.db.get(user.branchId)
    const org = branch ? await ctx.db.get(branch.organizationId) : null

    const roles = await authz.withTenant(user.branchId).getUserRoles(ctx, identity.subject)
    const role = roles[0]?.role ?? null

    const device = await ctx.db
      .query('devices')
      .withIndex('by_assigned_to', (q: any) => q.eq('assignedTo', user._id))
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

/**
 * List all users (agents) scoped to a branch.
 * Also computes the derived `online` flag from `device.lastSync` (< 5 min).
 * Caller must be admin or supervisor to list — enforced server-side.
 */
export const listByBranch = query({
  args: { branchId: v.id('branches') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Non authentifié')

    await assertCanManage(ctx, args.branchId, identity.subject)

    const users = await ctx.db
      .query('users')
      .withIndex('by_branch', (q: any) => q.eq('branchId', args.branchId))
      .collect()

    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000

    return Promise.all(
      users.map(async (u: any) => {
        const roles = await authz.withTenant(args.branchId).getUserRoles(ctx, u.tokenIdentifier)
        const role = (roles[0]?.role ?? 'field_agent') as AgentRole

        const device = await ctx.db
          .query('devices')
          .withIndex('by_assigned_to', (q: any) => q.eq('assignedTo', u._id))
          .first()

        const online = device
          ? new Date(device.lastSync ?? 0).getTime() > fiveMinutesAgo
          : false

        return {
          _id: u._id,
          fullName: u.fullName,
          email: u.email,
          phoneNumber: u.phoneNumber,
          status: u.status,
          branchId: u.branchId,
          tokenIdentifier: u.tokenIdentifier,
          role,
          online,
          device: device ?? null,
        }
      })
    )
  },
})

// ── Mutations ─────────────────────────────────────────────────────────────────

export const onboard = mutation({
  args: {
    orgName: v.string(),
    country: v.string(),
    currency: v.string(),
    licenseNumber: v.string(),
    branchName: v.string(),
    branchLocation: v.string(),
    branchCode: v.string(),
    fullName: v.string(),
    phoneNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Non authentifié')

    const existing = await ctx.db
      .query('users')
      .withIndex('by_token', (q: any) => q.eq('tokenIdentifier', identity.subject))
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

    await authz.withTenant(branchId).assignRole(ctx, identity.subject, 'admin')
  },
})

/**
 * Create a new agent user within a branch.
 * Caller must be admin or supervisor.
 * The new user is created with `status: 'invited'` and a placeholder
 * `tokenIdentifier` of `invited|<_id>` until they complete activation (#44).
 */
export const create = mutation({
  args: {
    fullName: v.string(),
    email: v.string(),
    phoneNumber: v.string(),
    branchId: v.id('branches'),
    role: v.union(
      v.literal('field_agent'),
      v.literal('supervisor'),
      v.literal('accountant'),
      v.literal('admin'),
      v.literal('it_admin')
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Non authentifié')

    await assertCanManage(ctx, args.branchId, identity.subject)

    // Prevent duplicate phone/email within the branch
    const allBranchUsers = await ctx.db
      .query('users')
      .withIndex('by_branch', (q: any) => q.eq('branchId', args.branchId))
      .collect()

    const emailLower = args.email.toLowerCase()
    const duplicate = allBranchUsers.find(
      (u: any) =>
        u.email === emailLower || u.phoneNumber === args.phoneNumber
    )
    if (duplicate) {
      throw new Error('Un agent avec ce numéro ou cet email existe déjà dans cette agence')
    }

    // Insert with placeholder tokenIdentifier — will be swapped by linkAgentAccount
    const userId = await ctx.db.insert('users', {
      fullName: args.fullName,
      email: emailLower,
      phoneNumber: args.phoneNumber,
      branchId: args.branchId,
      status: 'invited',
      tokenIdentifier: `invited|placeholder`, // will be patched with real _id below
    })

    // Use the real _id as the invite token so linkAgentAccount can find this row
    await ctx.db.patch(userId, { tokenIdentifier: `invited|${userId}` })

    await authz.withTenant(args.branchId).assignRole(ctx, `invited|${userId}`, args.role)

    return userId
  },
})

/**
 * Update an existing agent's mutable fields and optionally their role.
 * Caller must be admin or supervisor.
 */
export const update = mutation({
  args: {
    id: v.id('users'),
    fullName: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    role: v.optional(
      v.union(
        v.literal('field_agent'),
        v.literal('supervisor'),
        v.literal('accountant'),
        v.literal('admin'),
        v.literal('it_admin')
      )
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Non authentifié')

    const user = await ctx.db.get(args.id)
    if (!user) throw new Error('Agent introuvable')

    await assertCanManage(ctx, user.branchId, identity.subject)

    const patch: Record<string, any> = {}
    if (args.fullName !== undefined) patch.fullName = args.fullName
    if (args.phoneNumber !== undefined) patch.phoneNumber = args.phoneNumber
    if (Object.keys(patch).length > 0) await ctx.db.patch(args.id, patch)

    if (args.role !== undefined) {
      const branchAuthz = authz.withTenant(user.branchId)
      const roles = await branchAuthz.getUserRoles(ctx, user.tokenIdentifier)
      if (roles.length > 0) {
        await branchAuthz.removeRole(ctx, user.tokenIdentifier, roles[0].role)
      }
      await branchAuthz.assignRole(ctx, user.tokenIdentifier, args.role)
    }

    return ctx.db.get(args.id)
  },
})

/**
 * Suspend an agent — sets status to 'suspended'.
 * Caller must be admin or supervisor.
 */
export const suspend = mutation({
  args: { id: v.id('users') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Non authentifié')

    const user = await ctx.db.get(args.id)
    if (!user) throw new Error('Agent introuvable')

    await assertCanManage(ctx, user.branchId, identity.subject)

    await ctx.db.patch(args.id, { status: 'suspended' })
  },
})

// ── Link agent account (activation flow — #44) ────────────────────────────────

export const linkAgentAccount = mutation({
  args: { inviteToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Non authentifié')

    const already = await ctx.db
      .query('users')
      .withIndex('by_token', (q: any) => q.eq('tokenIdentifier', identity.subject))
      .unique()
    if (already) return already._id

    const email = identity.email?.toLowerCase()
    if (!email) throw new Error('Email introuvable dans le token agent')

    let invitedUser = null

    if (args.inviteToken) {
      invitedUser = await ctx.db
        .query('users')
        .withIndex('by_token', (q: any) =>
          q.eq('tokenIdentifier', `invited|${args.inviteToken}`)
        )
        .unique()
    }

    if (!invitedUser) {
      const byEmail = await ctx.db
        .query('users')
        .withIndex('by_email', (q: any) => q.eq('email', email))
        .collect()
      invitedUser = byEmail.find((u: any) => u.tokenIdentifier.startsWith('invited|'))
    }

    if (!invitedUser) throw new Error('Aucun agent invité trouvé pour cet email ou token')

    await ctx.db.patch(invitedUser._id, {
      tokenIdentifier: identity.subject,
      status: 'active',
    })

    const branchAuthz = authz.withTenant(invitedUser.branchId)
    const roles = await branchAuthz.getUserRoles(ctx, invitedUser.tokenIdentifier)
    if (roles.length > 0) {
      await branchAuthz.removeRole(ctx, invitedUser.tokenIdentifier, roles[0].role)
      await branchAuthz.assignRole(ctx, identity.subject, roles[0].role)
    }

    return invitedUser._id
  },
})
