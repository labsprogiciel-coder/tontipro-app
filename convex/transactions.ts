// convex/transactions.ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { authz } from "./authz";

// ── list ──────────────────────────────────────────────────────────────────────

/**
 * Returns all transactions recorded by the authenticated agent themselves —
 * not the whole branch. Each agent only ever sees their own ledger on
 * mobile; branch-wide visibility is reserved for supervisors/admins via
 * `listByBranch` (kauri).
 * Used by TontiPro mobile app.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    // Utilisée en hook réactif (useQuery) côté mobile — throw() ferait planter
    // le rendu au moindre instant transitoire sans identité encore résolue
    // (juste après une navigation, avant que la session ne soit confirmée),
    // au lieu d'un simple état "en chargement". `currentUser` (convex/users.ts)
    // suit déjà ce principe en retournant `null` plutôt que de throw.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const agent = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();
    if (!agent) return [];

    await authz
      .withTenant(agent.branchId)
      .require(ctx, identity.subject, "transactions:view_ledger");

    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_agent_date", (q) => q.eq("agentId", agent._id))
      .order("desc")
      .take(100);

    // Enrich with customer names (this agent's own customers only)
    const customers = await ctx.db
      .query("customers")
      .withIndex("by_branch", (q) => q.eq("branchId", agent.branchId))
      .collect();
    const customerMap = new Map(customers.map((c) => [c._id, c.fullName]));

    return transactions.map((t) => ({
      ...t,
      customerName: customerMap.get(t.customerId) ?? "Client inconnu",
      agentName: agent.fullName,
    }));
  },
});

// ── listByBranch ──────────────────────────────────────────────────────────────

/**
 * Returns all transactions for a specific branch.
 * Used by the dashboard (Kauri) to display transactions.
 * 
 * ✅ Supporte maintenant le filtrage par plage de dates (from, to).
 */
export const listByBranch = query({
  args: {
    branchId: v.optional(v.id("branches")),
    limit: v.optional(v.number()),
    from: v.optional(v.number()), // ✅ Timestamp de début (ms)
    to: v.optional(v.number()),   // ✅ Timestamp de fin (ms)
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const agent = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();
    if (!agent) throw new Error("Agent not found");

    // Utiliser le branchId passé OU celui de l'utilisateur
    const targetBranchId = args.branchId ?? agent.branchId;

    // Vérifier que l'agent a accès à cette branche
    if (agent.branchId !== targetBranchId) {
      throw new Error("Unauthorized: Cannot view transactions from another branch");
    }

    await authz
      .withTenant(targetBranchId)
      .require(ctx, identity.subject, "transactions:audit");

    const limit = args.limit ?? 500;

    // Récupérer les transactions de la branche
    let transactions = await ctx.db
      .query("transactions")
      .withIndex("by_branch_timestamp", (q) => q.eq("branchId", targetBranchId))
      .order("desc")
      .take(limit);

    // ✅ Filtrer par plage de dates si fournie
    if (args.from !== undefined || args.to !== undefined) {
      transactions = transactions.filter((t) => {
        if (args.from !== undefined && t.timestamp < args.from) return false;
        if (args.to !== undefined && t.timestamp > args.to) return false;
        return true;
      });
    }

    // Enrich with customer names and agent names
    const customers = await ctx.db
      .query("customers")
      .withIndex("by_branch", (q) => q.eq("branchId", targetBranchId))
      .collect();
    const customerMap = new Map(customers.map((c) => [c._id, c.fullName]));

    const agents = await ctx.db
      .query("users")
      .withIndex("by_branch", (q) => q.eq("branchId", targetBranchId))
      .collect();
    const agentMap = new Map(agents.map((u) => [u._id, u.fullName]));

    return transactions.map((t) => ({
      ...t,
      customerName: customerMap.get(t.customerId) ?? "Client inconnu",
      agentName: agentMap.get(t.agentId) ?? "Agent inconnu",
    }));
  },
});

// ── getById ───────────────────────────────────────────────────────────────────

/**
 * Returns a single transaction by Convex _id.
 */
export const getById = query({
  args: { id: v.id("transactions") },
  handler: async (ctx, { id }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const agent = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();
    if (!agent) throw new Error("Agent not found");

    const transaction = await ctx.db.get(id);
    if (!transaction) throw new Error("Transaction not found");
    if (transaction.branchId !== agent.branchId) throw new Error("Forbidden");

    return transaction;
  },
});

// ── listByAgent ───────────────────────────────────────────────────────────────

/**
 * Returns transactions for a specific agent (used in agent detail views).
 */
export const listByAgent = query({
  args: {
    agentId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const caller = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();
    if (!caller) throw new Error("Agent not found");

    await authz
      .withTenant(caller.branchId)
      .require(ctx, identity.subject, "transactions:audit");

    const limit = args.limit ?? 50;

    return ctx.db
      .query("transactions")
      .withIndex("by_agent_date", (q) => q.eq("agentId", args.agentId))
      .order("desc")
      .take(limit);
  },
});

// ── summarizeByAgent ──────────────────────────────────────────────────────────

/**
 * Returns aggregated stats per agent for the current month.
 * Used by AgentsPage to display KPIs.
 */
export const summarizeByAgent = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const agent = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();
    if (!agent) throw new Error("Agent not found");

    await authz
      .withTenant(agent.branchId)
      .require(ctx, identity.subject, "transactions:audit");

    // Get all agents in the branch
    const agents = await ctx.db
      .query("users")
      .withIndex("by_branch", (q) => q.eq("branchId", agent.branchId))
      .collect();

    // Get start of current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    // Get all transactions for the branch this month
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_branch_timestamp", (q) => q.eq("branchId", agent.branchId))
      .filter((q) => q.gte(q.field("timestamp"), startOfMonth))
      .collect();

    // Aggregate per agent
    const stats: Record<string, { collected: number; txMonth: number; clients: number }> = {};
    for (const a of agents) {
      stats[a._id] = { collected: 0, txMonth: 0, clients: 0 };
    }

    const clientSets: Record<string, Set<string>> = {};
    for (const a of agents) {
      clientSets[a._id] = new Set();
    }

    for (const t of transactions) {
      if (t.status !== "completed") continue;
      const agentStats = stats[t.agentId];
      if (!agentStats) continue;

      if (t.type === "deposit") {
        agentStats.collected += t.amount;
      }
      agentStats.txMonth += 1;
      clientSets[t.agentId]?.add(t.customerId);
    }

    // Count unique clients per agent
    for (const agentId of Object.keys(clientSets)) {
      stats[agentId].clients = clientSets[agentId].size;
    }

    return stats;
  },
});

// ── createDeposit ─────────────────────────────────────────────────────────────

/**
 * Creates a new deposit transaction.
 * Used by TontiPro mobile app for field agents.
 */
export const createDeposit = mutation({
  args: {
    customerId: v.id("customers"),
    amount: v.number(),
    tpeId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const agent = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();
    if (!agent) throw new Error("Agent not found");

    await authz
      .withTenant(agent.branchId)
      .require(ctx, identity.subject, "transactions:collect");

    if (args.amount <= 0) throw new Error("Amount must be positive");
    if (args.amount > 10_000_000) throw new Error("Amount too high (max 10M FCFA)");

    const customer = await ctx.db.get(args.customerId);
    if (!customer) throw new Error("Customer not found");
    if (customer.branchId !== agent.branchId) throw new Error("Forbidden");

    const transactionId = await ctx.db.insert("transactions", {
      amount: args.amount,
      currency: "FCFA",
      customerId: args.customerId,
      agentId: agent._id,
      branchId: agent.branchId,
      tpeId: args.tpeId,
      type: "deposit",
      status: "completed",
      timestamp: Date.now(),
    });

    // Update customer balance
    const newBalance = (customer.balance ?? 0) + args.amount;
    await ctx.db.patch(args.customerId, { balance: newBalance });

    return { transactionId, newBalance };
  },
});

// ── createWithdrawal ──────────────────────────────────────────────────────────

/**
 * Creates a new withdrawal transaction.
 */
export const createWithdrawal = mutation({
  args: {
    customerId: v.id("customers"),
    amount: v.number(),
    tpeId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const agent = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();
    if (!agent) throw new Error("Agent not found");

    await authz
      .withTenant(agent.branchId)
      .require(ctx, identity.subject, "transactions:collect");

    if (args.amount <= 0) throw new Error("Amount must be positive");

    const customer = await ctx.db.get(args.customerId);
    if (!customer) throw new Error("Customer not found");
    if (customer.branchId !== agent.branchId) throw new Error("Forbidden");

    const currentBalance = customer.balance ?? 0;
    if (args.amount > currentBalance) {
      throw new Error("Insufficient balance");
    }

    const transactionId = await ctx.db.insert("transactions", {
      amount: args.amount,
      currency: "FCFA",
      customerId: args.customerId,
      agentId: agent._id,
      branchId: agent.branchId,
      tpeId: args.tpeId,
      type: "withdrawal",
      status: "completed",
      timestamp: Date.now(),
    });

    // Update customer balance
    const newBalance = currentBalance - args.amount;
    await ctx.db.patch(args.customerId, { balance: newBalance });

    return { transactionId, newBalance };
  },
});

// ── reverse ───────────────────────────────────────────────────────────────────

/**
 * Reverses a transaction (void).
 * Only supervisors/admins can reverse transactions.
 */
export const reverse = mutation({
  args: {
    transactionId: v.id("transactions"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const agent = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();
    if (!agent) throw new Error("Agent not found");

    await authz
      .withTenant(agent.branchId)
      .require(ctx, identity.subject, "transactions:reverse");

    const transaction = await ctx.db.get(args.transactionId);
    if (!transaction) throw new Error("Transaction not found");
    if (transaction.branchId !== agent.branchId) throw new Error("Forbidden");
    if (transaction.status === "reversed") {
      throw new Error("Transaction already reversed");
    }

    // Mark as reversed
    await ctx.db.patch(args.transactionId, {
      status: "reversed",
      reversalReason: args.reason,
      reversedBy: agent._id,
    });

    // Reverse the balance change
    const customer = await ctx.db.get(transaction.customerId);
    if (customer) {
      const currentBalance = customer.balance ?? 0;
      const delta = transaction.type === "deposit" ? -transaction.amount : transaction.amount;
      const newBalance = Math.max(0, currentBalance + delta);
      await ctx.db.patch(transaction.customerId, { balance: newBalance });
    }

    return { success: true };
  },
});
