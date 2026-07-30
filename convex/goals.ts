// convex/goals.ts
import { v } from "convex/values";
import {
  query,
  mutation,
  internalMutation,
  internalAction,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute days remaining until an ISO-date deadline (YYYY-MM-DD). */
function daysUntil(deadline: string): number {
  const now = Date.now();
  const end = new Date(deadline).getTime();
  return Math.round((end - now) / 86_400_000);
}

/** Derive status from progress % and days remaining. */
function deriveStatus(
  pct: number,
  daysLeft: number,
): "atteint" | "enretard" | "encours" {
  if (pct >= 100) return "atteint";
  if (daysLeft < 21 && pct < 80) return "enretard";
  return "encours";
}

// ---------------------------------------------------------------------------
// listByBranch — returns goals enriched with live currentAmount + pct
// ---------------------------------------------------------------------------

export const listByBranch = query({
  args: { branchId: v.id("branches") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const goals = await ctx.db
      .query("savingsGoals")
      .withIndex("by_branch_status", (q) => q.eq("branchId", args.branchId))
      .collect();

    return Promise.all(
      goals.map(async (g) => {
        // Fix: use by_customer index — eliminates the full-table scan
        const txs = await ctx.db
          .query("transactions")
          .withIndex("by_customer", (q) =>
            q.eq("customerId", g.customerId).eq("status", "completed"),
          )
          .collect();

        const currentAmount = txs.reduce((s, t) => s + t.amount, 0);
        const pct =
          g.targetAmount > 0
            ? Math.round((currentAmount / g.targetAmount) * 100)
            : 0;
        const daysLeft = daysUntil(g.deadline);

        return { ...g, currentAmount, pct, daysLeft };
      }),
    );
  },
});

// ---------------------------------------------------------------------------
// create — field agents create new savings goals
// ---------------------------------------------------------------------------

export const create = mutation({
  args: {
    customerId: v.id("customers"),
    category: v.string(),
    productCode: v.string(),
    targetAmount: v.number(),
    deadline: v.string(), // ISO date YYYY-MM-DD
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    // Fix: validate targetAmount once (was duplicated in the original)
    if (args.targetAmount <= 0)
      throw new Error("targetAmount must be greater than 0");

    // Fix: deadlineMs was referenced but never declared in the original
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(args.deadline);
    if (!match) {
      throw new Error("deadline must be a valid date in the future");
    }

    const [, year, month, day] = match;
    const deadline = new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day)),
    );
    const isExactDate =
      deadline.getUTCFullYear() === Number(year) &&
      deadline.getUTCMonth() === Number(month) - 1 &&
      deadline.getUTCDate() === Number(day);

    const now = new Date();
    const todayUtc = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    );
    if (!isExactDate || deadline.getTime() <= todayUtc) {
      throw new Error("deadline must be a valid date in the future");
    }

    const agent = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();
    if (!agent) throw new Error("Agent not found");

    const customer = await ctx.db.get(args.customerId);
    if (!customer || customer.branchId !== agent.branchId) {
      throw new Error("Unauthorized: Customer does not belong to your branch");
    }

    return ctx.db.insert("savingsGoals", {
      ...args,
      branchId: agent.branchId,
      agentId: agent._id,
      status: "encours",
      createdAt: Date.now(),
    });
  },
});

// ---------------------------------------------------------------------------
// refreshStatuses — orchestrator action, fans out per branch
//
// Called by the daily cron. Fetches all distinct branchIds from the branches
// table, then schedules one refreshBranchStatuses mutation per branch.
// This keeps each mutation well within Convex's per-function read budget.
//
// Read-cost estimate (target scale):
//   Branches:     50
//   Goals/branch: 200  → 10,000 total, minus ~20% 'atteint' = 8,000 active
//   Txs/customer: ~50  (indexed lookup via by_customer, not a full scan)
//   Reads/run:    8,000 goals × 50 txs = ~400,000 reads  ✓ well under 1M
//   Per mutation: ~200 goals × 50 txs  = ~10,000 reads   ✓ fast and isolated
// ---------------------------------------------------------------------------

export const refreshStatuses = internalAction({
  args: {},
  handler: async (ctx) => {
    const branchIds: string[] = await ctx.runQuery(
      internal.goals.listActiveBranchIds,
    );

    for (const branchId of branchIds) {
      await ctx.scheduler.runAfter(0, internal.goals.refreshBranchStatuses, {
        branchId: branchId as any,
      });
    }
  },
});

// ---------------------------------------------------------------------------
// listActiveBranchIds — internal query used by the refreshStatuses orchestrator
//
// Reads from the branches table (O(branches) ≈ 50 reads) rather than
// paginating all savingsGoals (O(total goals), grows unboundedly as
// 'atteint' goals accumulate over time).
//
// refreshBranchStatuses already filters to encours/enretard via the
// by_branch_status index, so branches that have no active goals are a
// natural no-op — no extra filtering needed here.
//
// NOTE: If branches can grow into the thousands, replace .collect() with
// the same paginate loop pattern and keep everything else unchanged.
// ---------------------------------------------------------------------------

export const listActiveBranchIds = internalQuery({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    const branches = await ctx.db.query("branches").collect();
    return branches.map((b) => b._id as string);
  },
});

// ---------------------------------------------------------------------------
// refreshBranchStatuses — per-branch internal mutation
//
// Processes only the active (encours + enretard) goals for one branch.
// Skips 'enpause' (manual pause should not be overridden by the cron).
// Skips 'atteint' (terminal — status can only increase, never regress).
// ---------------------------------------------------------------------------

export const refreshBranchStatuses = internalMutation({
  args: { branchId: v.id("branches") },
  handler: async (ctx, args) => {
    // Fetch encours and enretard goals for this branch using the composite index.
    // 'atteint' and 'enpause' are intentionally excluded.
    const [encours, enretard] = await Promise.all([
      ctx.db
        .query("savingsGoals")
        .withIndex("by_branch_status", (q) =>
          q.eq("branchId", args.branchId).eq("status", "encours"),
        )
        .collect(),
      ctx.db
        .query("savingsGoals")
        .withIndex("by_branch_status", (q) =>
          q.eq("branchId", args.branchId).eq("status", "enretard"),
        )
        .collect(),
    ]);

    await Promise.all(
      [...encours, ...enretard].map(async (g) => {
        // Fix: use by_customer index — eliminates the N+1 full-table scan
        const txs = await ctx.db
          .query("transactions")
          .withIndex("by_customer", (q) =>
            q.eq("customerId", g.customerId).eq("status", "completed"),
          )
          .collect();

        const currentAmount = txs.reduce((s, t) => s + t.amount, 0);
        const pct =
          g.targetAmount > 0
            ? Math.round((currentAmount / g.targetAmount) * 100)
            : 0;
        const daysLeft = daysUntil(g.deadline);
        const newStatus = deriveStatus(pct, daysLeft);

        if (newStatus !== g.status) {
          await ctx.db.patch(g._id, { status: newStatus });
        }
      }),
    );
  },
});

/*
 * ---------------------------------------------------------------------------
 * Integration test sketch (convex/goals.test.ts with convex-test)
 * ---------------------------------------------------------------------------
 *
 * describe('refreshBranchStatuses', () => {
 *   it('marks a goal atteint when 100% funded', async () => {
 *     // seed branch, customer, goal (status: encours, target: 1000)
 *     // seed transaction (amount: 1000, status: completed, customerId)
 *     // run mutation → expect goal.status === 'atteint'
 *   })
 *
 *   it('marks a goal enretard when < 80% funded with < 21 days left', async () => {
 *     // seed goal (deadline: today + 10 days, target: 1000)
 *     // seed transaction (amount: 700, completed)
 *     // run mutation → expect goal.status === 'enretard'
 *   })
 *
 *   it('does not override a paused goal', async () => {
 *     // seed goal (status: enpause, target: 1000)
 *     // seed transaction (amount: 1000, completed)
 *     // run mutation → expect goal.status === 'enpause' (unchanged)
 *   })
 *
 *   it('does not process atteint goals', async () => {
 *     // seed goal (status: atteint)
 *     // run mutation → assert ctx.db.patch never called
 *   })
 * })
 *
 * describe('listActiveBranchIds', () => {
 *   it('returns all branch IDs regardless of goal distribution', async () => {
 *     // seed 3 branches (one with only atteint goals, one with encours, one empty)
 *     // run query → expect all 3 branchIds returned
 *     // refreshBranchStatuses handles the empty/atteint cases as no-ops
 *   })
 * })
 *
 * Read-cost assertion (documented):
 *   listActiveBranchIds: O(branches) ≈ 50 reads — fixed, does not grow with history.
 *   200 goals/branch (encours + enretard only) × 50 txs (indexed) = 10,000 reads
 *   50 branches × 10,000 = 500,000 total reads/cron run — under the 1M limit.
 * ---------------------------------------------------------------------------
 */
