// convex/customers.ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { authz } from "./authz";

// ── Shared validator for metadata fields ──────────────────────────────────────

const metadataValidator = v.optional(
  v.object({
    address: v.optional(v.string()),
    groupName: v.optional(v.string()),
    commitmentAmount: v.optional(v.number()),
    collectionFrequency: v.optional(v.string()),
    collectionDays: v.optional(v.array(v.number())),
    savingsGoal: v.optional(v.number()),
    accountNumber: v.optional(v.string()),
    email: v.optional(v.string()),
  }),
);

// ── list ──────────────────────────────────────────────────────────────────────

/**
 * Returns the customers onboarded by the authenticated agent themselves —
 * not the whole branch. Branch-wide visibility is reserved for
 * supervisors/admins via `listByBranch` (kauri).
 * Strips idNumber from the returned payload for privacy.
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
    if (!agent || !agent.branchId) return [];

    await authz
      .withTenant(agent.branchId)
      .require(ctx, identity.subject, "customers:view");

    // Chaque agent ne voit que les clients qu'il a lui-même onboardés — pas
    // le portefeuille entier de la branche.
    const customers = await ctx.db
      .query("customers")
      .withIndex("by_branch", (q) => q.eq("branchId", agent.branchId))
      .filter((q) => q.eq(q.field("onboardedBy"), agent._id))
      .collect();

    return customers.map((c) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { idNumber, ...safeCustomer } = c;
      return {
        ...safeCustomer,
        agentName: agent.fullName,
      };
    });
  },
});

// ── listByBranch ──────────────────────────────────────────────────────────────

/**
 * Returns all customers for a specific branch.
 * Used by the dashboard (Kauri) to display clients.
 */
export const listByBranch = query({
  args: {
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const agent = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();
    if (!agent) throw new Error("Agent not found");

    // ✅ CORRECTION : Vérifier que branchId existe
    if (!agent.branchId) {
      throw new Error("Agent sans agence assignée");
    }

    // Utiliser le branchId passé OU celui de l'utilisateur
    const targetBranchId = args.branchId ?? agent.branchId;

    // Vérifier que l'agent a accès à cette branche
    if (agent.branchId !== targetBranchId) {
      throw new Error("Unauthorized: Cannot view customers from another branch");
    }

    await authz
      .withTenant(targetBranchId)
      .require(ctx, identity.subject, "customers:view");

    const customers = await ctx.db
      .query("customers")
      .withIndex("by_branch", (q) => q.eq("branchId", targetBranchId))
      .collect();

    // Build a name map for agents in the same branch
    const branchUsers = await ctx.db
      .query("users")
      .withIndex("by_branch", (q) => q.eq("branchId", targetBranchId))
      .collect();
    const userMap = new Map(branchUsers.map((u) => [u._id, u.fullName]));

    return customers.map((c) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { idNumber, ...safeCustomer } = c;
      return {
        ...safeCustomer,
        agentName: userMap.get(c.onboardedBy) ?? "—",
      };
    });
  },
});

// ── getById ───────────────────────────────────────────────────────────────────

/**
 * Returns a single customer by Convex _id.
 * The caller must belong to the same branch.
 */
export const getById = query({
  args: { id: v.id("customers") },
  handler: async (ctx, { id }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const agent = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();
    if (!agent) throw new Error("Agent not found");

    // ✅ CORRECTION : Vérifier que branchId existe
    if (!agent.branchId) {
      throw new Error("Agent sans agence assignée");
    }

    await authz
      .withTenant(agent.branchId)
      .require(ctx, identity.subject, "customers:view");

    const customer = await ctx.db.get(id);
    if (!customer) throw new Error("Customer not found");

    // ✅ CORRECTION : Vérifier que c'est bien un customer avec branchId
    if (!("branchId" in customer) || !customer.branchId) {
      throw new Error("Customer invalide");
    }
    if (customer.branchId !== agent.branchId) throw new Error("Forbidden");

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { idNumber, ...safeCustomer } = customer;
    return safeCustomer;
  },
});

// ── createProspect ────────────────────────────────────────────────────────────

/**
 * Creates a new prospect customer.
 * organizationId is resolved server-side from the agent's branch.
 */
export const createProspect = mutation({
  args: {
    fullName: v.string(),
    phoneNumber: v.string(),
    idNumber: v.optional(v.string()),
    metadata: metadataValidator,
    balance: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const fullName = args.fullName.trim();
    const phoneNumber = args.phoneNumber.trim();
    const idNumber = args.idNumber?.trim() ?? "";

    if (!fullName) throw new Error("Full name is required");
    if (!phoneNumber) throw new Error("Phone number is required");
    if (fullName.length > 200)
      throw new Error("Full name too long (max 200 chars)");
    if (phoneNumber.length > 20)
      throw new Error("Phone number too long (max 20 chars)");
    if (idNumber.length > 50)
      throw new Error("ID number too long (max 50 chars)");

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const agent = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();
    if (!agent) throw new Error("Agent not found");

    // ✅ CORRECTION : Vérifier que branchId existe
    if (!agent.branchId) {
      throw new Error("Agent sans agence assignée");
    }

    await authz
      .withTenant(agent.branchId)
      .require(ctx, identity.subject, "customers:create_prospect");

    // Resolve organizationId from the agent's branch (server-side only)
    const branch = await ctx.db.get(agent.branchId);
    if (!branch) throw new Error("Branch not found");
    const { organizationId } = branch;

    // Duplicate phone check (scoped to organization)
    const existingPhone = await ctx.db
      .query("customers")
      .withIndex("by_organization_phone", (q) =>
        q.eq("organizationId", organizationId).eq("phoneNumber", phoneNumber),
      )
      .first();
    if (existingPhone)
      throw new Error("Un client avec ce numéro de téléphone existe déjà");

    // Duplicate ID check (scoped to organization, only when idNumber provided)
    if (idNumber) {
      const existingId = await ctx.db
        .query("customers")
        .withIndex("by_organization_id_number", (q) =>
          q.eq("organizationId", organizationId).eq("idNumber", idNumber),
        )
        .first();
      if (existingId)
        throw new Error(
          "Un client avec ce numéro de pièce d'identité existe déjà",
        );
    }

    // KYC status: if idNumber is provided at creation, mark as verified
    const status = idNumber ? "verified" : "prospect";

    return ctx.db.insert("customers", {
      fullName,
      phoneNumber,
      idNumber: idNumber || undefined,
      organizationId,
      branchId: agent.branchId,
      onboardedBy: agent._id,
      status,
      balance: args.balance ?? 0,
      metadata: args.metadata,
      createdAt: Date.now(),
    });
  },
});

// ── update ────────────────────────────────────────────────────────────────────

/**
 * Patches a customer's fields.
 * Only fields explicitly passed are updated (undefined = no change).
 */
export const update = mutation({
  args: {
    id: v.id("customers"),
    fullName: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    idNumber: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("prospect"),
        v.literal("verified"),
        v.literal("rejected"),
      ),
    ),
    balance: v.optional(v.number()),
    metadata: metadataValidator,
  },
  handler: async (ctx, { id, ...fields }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const agent = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();
    if (!agent) throw new Error("Agent not found");

    // ✅ CORRECTION : Vérifier que branchId existe
    if (!agent.branchId) {
      throw new Error("Agent sans agence assignée");
    }

    await authz
      .withTenant(agent.branchId)
      .require(ctx, identity.subject, "customers:update");

    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Customer not found");

    // ✅ CORRECTION : Vérifier que c'est bien un customer avec branchId
    if (!("branchId" in existing) || !existing.branchId) {
      throw new Error("Customer invalide");
    }
    if (existing.branchId !== agent.branchId) throw new Error("Forbidden");

    // Build the patch — omit undefined values so we don't overwrite with null
    const patch: Record<string, unknown> = {};

    if (fields.fullName !== undefined) patch.fullName = fields.fullName.trim();
    if (fields.phoneNumber !== undefined)
      patch.phoneNumber = fields.phoneNumber.trim();
    if (fields.idNumber !== undefined) {
      patch.idNumber = fields.idNumber.trim();
      // Auto-upgrade status to verified when an ID number is added
      if (!existing.idNumber && fields.idNumber.trim()) {
        patch.status = "verified";
      }
    }
    if (fields.status !== undefined) patch.status = fields.status;
    if (fields.balance !== undefined) patch.balance = fields.balance;
    if (fields.metadata !== undefined) {
      // Merge metadata rather than replace, so callers can patch a single field
      patch.metadata = { ...(existing.metadata ?? {}), ...fields.metadata };
    }

    await ctx.db.patch(id, patch);
    return ctx.db.get(id);
  },
});

// ── updateBalance ─────────────────────────────────────────────────────────────

/**
 * Increments (or decrements) a customer's balance by `delta`.
 * Use a positive delta for deposits and negative for withdrawals.
 */
export const updateBalance = mutation({
  args: {
    id: v.id("customers"),
    delta: v.number(),
  },
  handler: async (ctx, { id, delta }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const agent = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();
    if (!agent) throw new Error("Agent not found");

    // ✅ CORRECTION : Vérifier que branchId existe
    if (!agent.branchId) {
      throw new Error("Agent sans agence assignée");
    }

    await authz
      .withTenant(agent.branchId)
      .require(ctx, identity.subject, "customers:update");

    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Customer not found");

    // ✅ CORRECTION : Vérifier que c'est bien un customer avec branchId
    if (!("branchId" in existing) || !existing.branchId) {
      throw new Error("Customer invalide");
    }
    if (existing.branchId !== agent.branchId) throw new Error("Forbidden");

    const newBalance = Math.max(0, (existing.balance ?? 0) + delta);
    await ctx.db.patch(id, { balance: newBalance });
    return newBalance;
  },
});