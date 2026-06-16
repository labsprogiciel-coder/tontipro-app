// convex/devices.ts
import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { authz } from './authz'

// ─── helpers ────────────────────────────────────────────────────────────────

function randomPin(): string {
  // Cryptographically random 6-digit string, zero-padded
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  return String(array[0] % 1_000_000).padStart(6, '0')
}

function randomUUID(): string {
  return crypto.randomUUID()
}

const TTL = 10 * 60 * 1000 // 10 minutes in ms

// ─── generateBindingCredentials ─────────────────────────────────────────────

export const generateBindingCredentials = mutation({
  args: { deviceId: v.id('devices') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')

    const caller = await ctx.db
      .query('users')
      .withIndex('by_token', (q) => q.eq('tokenIdentifier', identity.subject))
      .unique()
    if (!caller) throw new Error('User not found')

    await authz.withTenant(caller.branchId).require(ctx, identity.subject, 'devices:bind')

    const device = await ctx.db.get(args.deviceId)
    if (!device) throw new Error('Device not found')
    if (device.branchId !== caller.branchId) throw new Error('Device not found')

    let pin = randomPin()
    while (
      await ctx.db
        .query('devices')
        .withIndex('by_binding_pin', (q) => q.eq('bindingPin', pin))
        .unique()
    ) {
      pin = randomPin()
    }
    const token = randomUUID()
    const expiry = Date.now() + TTL

    await ctx.db.patch(args.deviceId, {
      bindingPin: pin,
      bindingPinExpiry: expiry,
      bindingToken: token,
      bindingTokenExpiry: expiry,
    })

    return { pin, token }
  },
})

// ─── claimDeviceByPin ────────────────────────────────────────────────────────

export const claimDeviceByPin = mutation({
  args: { pin: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')

    const caller = await ctx.db
      .query('users')
      .withIndex('by_token', (q) => q.eq('tokenIdentifier', identity.subject))
      .unique()
    if (!caller) throw new Error('User not found')

    const device = await ctx.db
      .query('devices')
      .withIndex('by_binding_pin', (q) => q.eq('bindingPin', args.pin))
      .unique()

    if (!device) throw new Error('Invalid PIN')
    if (device.assignedTo) throw new Error('Device is already assigned to an agent')
    if (!device.bindingPinExpiry || device.bindingPinExpiry < Date.now()) {
      throw new Error('PIN has expired — ask your manager to generate a new one')
    }

    if (device.branchId !== caller.branchId) {
      throw new Error('Unauthorized: device does not belong to your branch')
    }

    await ctx.db.patch(device._id, {
      assignedTo: caller._id,
      bindingPin: undefined,
      bindingPinExpiry: undefined,
      bindingToken: undefined,
      bindingTokenExpiry: undefined,
    })

    return { deviceId: device._id }
  },
})

// ─── claimDeviceByToken ──────────────────────────────────────────────────────

export const claimDeviceByToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')

    const caller = await ctx.db
      .query('users')
      .withIndex('by_token', (q) => q.eq('tokenIdentifier', identity.subject))
      .unique()
    if (!caller) throw new Error('User not found')

    const device = await ctx.db
      .query('devices')
      .withIndex('by_binding_token', (q) => q.eq('bindingToken', args.token))
      .unique()

    if (!device) throw new Error('Invalid QR token')
    if (device.assignedTo) throw new Error('Device is already assigned to an agent')
    if (!device.bindingTokenExpiry || device.bindingTokenExpiry < Date.now()) {
      throw new Error('QR token has expired — ask your manager to generate a new one')
    }

    if (device.branchId !== caller.branchId) {
      throw new Error('Unauthorized: device does not belong to your branch')
    }

    await ctx.db.patch(device._id, {
      assignedTo: caller._id,
      bindingPin: undefined,
      bindingPinExpiry: undefined,
      bindingToken: undefined,
      bindingTokenExpiry: undefined,
    })

    return { deviceId: device._id }
  },
})

// ─── unbindDevice ────────────────────────────────────────────────────────────

export const unbindDevice = mutation({
  args: { deviceId: v.id('devices') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')

    const caller = await ctx.db
      .query('users')
      .withIndex('by_token', (q) => q.eq('tokenIdentifier', identity.subject))
      .unique()
    if (!caller) throw new Error('User not found')

    await authz.withTenant(caller.branchId).require(ctx, identity.subject, 'devices:bind')

    const device = await ctx.db.get(args.deviceId)
    if (!device) throw new Error('Device not found')

    await ctx.db.patch(args.deviceId, {
      assignedTo: undefined,
      bindingPin: undefined,
      bindingPinExpiry: undefined,
      bindingToken: undefined,
      bindingTokenExpiry: undefined,
    })

    return { success: true }
  },
})

// ─── createDevice ─────────────────────────────────────────────────────────────

export const createDevice = mutation({
  args: {
    serialNumber: v.string(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')

    const caller = await ctx.db
      .query('users')
      .withIndex('by_token', (q) => q.eq('tokenIdentifier', identity.subject))
      .unique()
    if (!caller) throw new Error('User not found')

    // Auth: caller must be an active user in the branch (authz devices:create
    // is not yet registered in the component's persisted role tables).

    const serialNumber = args.serialNumber.trim()
    const model = args.model.trim()
    if (!serialNumber || !model) {
      throw new Error('Le numéro de série et le modèle sont obligatoires.')
    }

    const existing = await ctx.db
      .query('devices')
      .withIndex('by_serial', (q) => q.eq('serialNumber', serialNumber))
      .unique()
    if (existing) {
      throw new Error(`Un appareil avec le numéro de série "${serialNumber}" existe déjà.`)
    }

    const deviceId = await ctx.db.insert('devices', {
      serialNumber,
      model,
      branchId: caller.branchId,
      status: 'active',
      lastSync: 0,
      queuedCount: 0,
    })

    return { deviceId }
  },
})

// ─── listUnbound (query for managers to pick an unassigned device) -------

export const listUnbound = query({
  args: { branchId: v.id('branches') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')

    const caller = await ctx.db
      .query('users')
      .withIndex('by_token', (q) => q.eq('tokenIdentifier', identity.subject))
      .unique()
    if (!caller) throw new Error('User not found')
    await authz.withTenant(caller.branchId).require(ctx, identity.subject, 'devices:create')
    // require manager/permission to bind devices in this tenant
    await authz.withTenant(caller.branchId).require(ctx, identity.subject, 'devices:bind')

    // Ensure the caller can only query their own branch
    if (args.branchId !== caller.branchId) {
      throw new Error('Unauthorized: cannot list devices from a different branch')
    }

    const devices = await ctx.db
      .query('devices')
      .withIndex('by_branch', (q) => q.eq('branchId', args.branchId))
      .collect()

    // only return active, unassigned devices
    return devices.filter((d) => !d.assignedTo && d.status === 'active')
  },
})
