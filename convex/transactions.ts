// convex/transactions.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * All transactions for a branch, newest first.
 * Used by the history screen and the store's loadTransactions().
 */
export const list = query({
  args: { branchId: v.id("branches") },
  handler: async (ctx, { branchId }) => {
    return await ctx.db
      .query("transactions")
      .withIndex("by_branch_timestamp", (q) => q.eq("branchId", branchId))
      .order("desc")
      .collect();
  },
});

/**
 * All transactions for a single customer, newest first.
 * Used by the client detail screen.
 */
export const listByCustomer = query({
  args: { customerId: v.id("customers") },
  handler: async (ctx, { customerId }) => {
    return await ctx.db
      .query("transactions")
      .withIndex("by_customer", (q) => q.eq("customerId", customerId))
      .order("desc")
      .collect();
  },
});

/**
 * Single transaction by id — used by the detail screen.
 */
export const getById = query({
  args: { id: v.id("transactions") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

// ─── Mutations ───────────────────────────────────────────────────────────────

/**
 * Create a transaction and update the customer balance atomically.
 * Both writes happen in the same mutation — Convex guarantees atomicity.
 */
export const create = mutation({
  args: {
    amount: v.number(),
    currency: v.string(),
    customerId: v.id("customers"),
    agentId: v.id("users"),
    branchId: v.id("branches"),
    tpeId: v.string(),
    type: v.union(v.literal("deposit"), v.literal("withdrawal")),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const customer = await ctx.db.get(args.customerId);
    if (!customer) throw new Error("Customer not found");

    if (args.type === "withdrawal" && (customer.balance ?? 0) < args.amount) {
      throw new Error("Insufficient balance");
    }

    // Insert transaction first so we have an id to return.
    const transactionId = await ctx.db.insert("transactions", {
      amount: args.amount,
      currency: args.currency,
      customerId: args.customerId,
      agentId: args.agentId,
      branchId: args.branchId,
      tpeId: args.tpeId,
      type: args.type,
      timestamp: args.timestamp,
      status: "completed",
    });

    // Update customer balance atomically in the same mutation.
    const balanceDelta = args.type === "deposit" ? args.amount : -args.amount;
    await ctx.db.patch(args.customerId, {
      balance: (customer.balance ?? 0) + balanceDelta,
    });

    return transactionId;
  },
});

/**
 * Reverse a completed transaction.
 * Sets status to 'reversed' and rolls back the customer balance.
 */
export const reverse = mutation({
  args: {
    id: v.id("transactions"),
    reversalReason: v.string(),
    reversedBy: v.id("users"),
  },
  handler: async (ctx, { id, reversalReason, reversedBy }) => {
    const tx = await ctx.db.get(id);
    if (!tx) throw new Error("Transaction not found");
    if (tx.status !== "completed") {
      throw new Error(`Cannot reverse a transaction with status '${tx.status}'`);
    }

    const customer = await ctx.db.get(tx.customerId);
    if (!customer) throw new Error("Customer not found");

    // Roll back the balance change.
    const rollbackDelta = tx.type === "deposit" ? -tx.amount : tx.amount;
    await ctx.db.patch(tx.customerId, {
      balance: (customer.balance ?? 0) + rollbackDelta,
    });

    await ctx.db.patch(id, {
      status: "reversed",
      reversalReason,
      reversedBy,
    });
  },
});
