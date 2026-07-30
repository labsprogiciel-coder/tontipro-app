import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authz } from "./authz";

export const list = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const caller = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();
    if (!caller) throw new Error("User not found");
    const branch = await ctx.db.get(caller.branchId);
    if (!branch || branch.organizationId !== args.organizationId)
      throw new Error("Unauthorized");
    return ctx.db
      .query("products")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect();
  },
});

export const upsert = mutation({
  args: {
    productId: v.optional(v.id("products")),
    organizationId: v.id("organizations"),
    code: v.string(),
    name: v.string(),
    family: v.union(
      v.literal("epargne"),
      v.literal("credit"),
      v.literal("tontine"),
      v.literal("assurance"),
    ),
    summary: v.string(),
    status: v.union(
      v.literal("actif"),
      v.literal("brouillon"),
      v.literal("archive"),
    ),
    rate: v.number(),
    durationMin: v.number(),
    durationMax: v.number(),
    minDeposit: v.number(),
    maxBalance: v.number(),
    fees: v.number(),
    feesUnit: v.union(v.literal("FCFA"), v.literal("%")),
    graceDays: v.number(),
    kycLevel: v.union(
      v.literal("Allégée"),
      v.literal("Standard"),
      v.literal("Renforcée"),
    ),
    targetSegments: v.array(v.string()),
    branchCodes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    await authz
      .withTenant(user.branchId)
      .require(ctx, identity.subject, "products:manage");

    const { productId, ...fields } = args;

    if (productId) {
      return ctx.db.patch(productId, fields);
    }
    return ctx.db.insert("products", fields);
  },
});

export const canManageProducts = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();
    if (!user) return false;

    try {
      await authz
        .withTenant(user.branchId)
        .require(ctx, identity.subject, "products:manage");
      return true;
    } catch {
      return false;
    }
  },
});
