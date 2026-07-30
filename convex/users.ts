// convex/users.ts
import { mutation, query, internalMutation, internalQuery, action } from "./_generated/server";
import { v } from "convex/values";
import { authz } from "./authz";
import { getAuthUserId, retrieveAccount, modifyAccountCredentials } from "@convex-dev/auth/server";
import { normalizePhoneNumber } from "./phone";
import { api, internal } from "./_generated/api";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AgentRole =
  | "field_agent"
  | "supervisor"
  | "accountant"
  | "admin"
  | "it_admin";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Roles that are allowed to manage (create/update/suspend) other users */
const MANAGING_ROLES: AgentRole[] = ["admin", "supervisor"];

async function assertCanManage(
  ctx: any,
  branchId: any,
  callerSubject: string,
): Promise<void> {
  const roles = await authz
    .withTenant(branchId)
    .getUserRoles(ctx, callerSubject);
  const role = roles[0]?.role as AgentRole | undefined;
  if (!role || !MANAGING_ROLES.includes(role)) {
    throw new Error("Insufficient permissions — admin or supervisor required");
  }
}

// ── Queries ───────────────────────────────────────────────────────────────────

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();
    if (!user) return null;

    const branch = await ctx.db.get(user.branchId);
    const org = branch ? await ctx.db.get(branch.organizationId) : null;
    const roles = await authz
      .withTenant(user.branchId)
      .getUserRoles(ctx, identity.subject);
    const role = roles[0]?.role ?? null;
    const device = await ctx.db
      .query("devices")
      .withIndex("by_assigned_to", (q) => q.eq("assignedTo", user._id))
      .first();

    return {
      ...user,
      branch,
      organization: org,
      tenantId: user.branchId,
      role,
      device: device ?? null,
      mustChangePassword: user.mustChangePassword ?? false,
      passwordSetAt: user.passwordSetAt ?? null,
      lockedUntil: user.lockedUntil ?? null,
    };
  },
});

/**
 * List all users (agents) scoped to a branch.
 * Also computes the derived `online` flag from `device.lastSync` (< 5 min).
 * Caller must be admin or supervisor to list — enforced server-side.
 */
export const listByBranch = query({
  args: { branchId: v.id("branches") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Non authentifié");

    await assertCanManage(ctx, args.branchId, identity.subject);

    const users = await ctx.db
      .query("users")
      .withIndex("by_branch", (q: any) => q.eq("branchId", args.branchId))
      .collect();

    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

    return Promise.all(
      users.map(async (u: any) => {
        const roles = await authz
          .withTenant(args.branchId)
          .getUserRoles(ctx, u.tokenIdentifier);
        const role = (roles[0]?.role ?? "field_agent") as AgentRole;

        const device = await ctx.db
          .query("devices")
          .withIndex("by_assigned_to", (q: any) => q.eq("assignedTo", u._id))
          .first();

        const online = device
          ? new Date(device.lastSync ?? 0).getTime() > fiveMinutesAgo
          : false;

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
        };
      }),
    );
  },
});

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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Non authentifié");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_token", (q: any) =>
        q.eq("tokenIdentifier", identity.subject),
      )
      .unique();
    if (existing) throw new Error("Ce compte est déjà enregistré");

    const orgId = await ctx.db.insert("organizations", {
      name: args.orgName,
      country: args.country,
      currency: args.currency,
      licenseNumber: args.licenseNumber,
      status: "active",
    });

    const branchId = await ctx.db.insert("branches", {
      organizationId: orgId,
      name: args.branchName,
      location: args.branchLocation,
      code: args.branchCode,
    });

    await ctx.db.insert("users", {
      fullName: args.fullName,
      email: (identity.email ?? "").toLowerCase(),
      phoneNumber: args.phoneNumber,
      tokenIdentifier: identity.subject,
      branchId,
      status: "active",
    });

    await authz.withTenant(branchId).assignRole(ctx, identity.subject, "admin");
  },
});

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
    branchId: v.id("branches"),
    role: v.union(
      v.literal("field_agent"),
      v.literal("supervisor"),
      v.literal("accountant"),
      v.literal("admin"),
      v.literal("it_admin"),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Non authentifié");

    await assertCanManage(ctx, args.branchId, identity.subject);

    // Prevent duplicate phone/email within the branch
    const allBranchUsers = await ctx.db
      .query("users")
      .withIndex("by_branch", (q: any) => q.eq("branchId", args.branchId))
      .collect();

    const emailLower = args.email.toLowerCase();
    const phoneNumber = normalizePhoneNumber(args.phoneNumber);
    const duplicate = allBranchUsers.find(
      (u: any) => u.email === emailLower || u.phoneNumber === phoneNumber,
    );
    if (duplicate) {
      throw new Error(
        "Un agent avec ce numéro ou cet email existe déjà dans cette agence",
      );
    }

    // Insert with placeholder tokenIdentifier — will be swapped by linkAgentAccount
    const userId = await ctx.db.insert("users", {
      fullName: args.fullName,
      email: emailLower,
      phoneNumber,
      branchId: args.branchId,
      status: "invited",
      tokenIdentifier: `invited|placeholder`, // will be patched with real _id below
    });

    // Use the real _id as the invite token so linkAgentAccount can find this row
    await ctx.db.patch(userId, { tokenIdentifier: `invited|${userId}` });

    await authz
      .withTenant(args.branchId)
      .assignRole(ctx, `invited|${userId}`, args.role);

    return userId;
  },
});

/**
 * Update an existing agent's mutable fields and optionally their role.
 * Caller must be admin or supervisor.
 */
export const update = mutation({
  args: {
    id: v.id("users"),
    fullName: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    role: v.optional(
      v.union(
        v.literal("field_agent"),
        v.literal("supervisor"),
        v.literal("accountant"),
        v.literal("admin"),
        v.literal("it_admin"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Non authentifié");

    const user = await ctx.db.get(args.id);
    if (!user) throw new Error("Agent introuvable");

    await assertCanManage(ctx, user.branchId, identity.subject);

    const patch: Record<string, any> = {};
    if (args.fullName !== undefined) patch.fullName = args.fullName;
    if (args.phoneNumber !== undefined) patch.phoneNumber = args.phoneNumber;
    if (Object.keys(patch).length > 0) await ctx.db.patch(args.id, patch);

    if (args.role !== undefined) {
      const branchAuthz = authz.withTenant(user.branchId);
      const roles = await branchAuthz.getUserRoles(ctx, user.tokenIdentifier);
      if (roles.length > 0) {
        await branchAuthz.removeRole(ctx, user.tokenIdentifier, roles[0].role);
      }
      await branchAuthz.assignRole(ctx, user.tokenIdentifier, args.role);
    }

    return ctx.db.get(args.id);
  },
});

/**
 * Suspend an agent — sets status to 'suspended'.
 * Caller must be admin or supervisor.
 */
export const suspend = mutation({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Non authentifié");

    const user = await ctx.db.get(args.id);
    if (!user) throw new Error("Agent introuvable");

    await assertCanManage(ctx, user.branchId, identity.subject);

    await ctx.db.patch(args.id, { status: "suspended" });
  },
});

export const updatePasswordPolicy = mutation({
  args: {
    mustChange: v.boolean(),
    passwordSetAt: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Non authentifié");

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q: any) =>
        q.eq("tokenIdentifier", identity.subject),
      )
      .unique();
    if (!user) throw new Error("Agent introuvable");

    await ctx.db.patch(user._id, {
      mustChangePassword: args.mustChange,
      passwordSetAt: args.passwordSetAt,
      lockedUntil: undefined,
    });
  },
});

// ── Link agent account (activation flow — #44) ────────────────────────────────

/**
 * Supprime un compte d'authentification "password" orphelin pour ce numéro :
 * un signUp qui a réussi mais dont `linkAgentAccount` n'a jamais abouti
 * (crash, bug, connexion coupée) laisse un `authAccounts` row that
 * `signIn(flow:"signUp")` refusera ensuite avec "Account already exists",
 * sans que l'agent n'ait jamais pu se connecter.
 *
 * Sans danger : ne touche que les comptes dont le `users` correspondant est
 * encore `status: "invited"` — un compte déjà activé n'est jamais concerné.
 * Query publique (pas d'authentification requise) car appelée depuis l'écran
 * de login, avant que la session existe.
 */
export const clearStaleActivationAccount = mutation({
  args: { phoneNumber: v.string() },
  handler: async (ctx, args) => {
    const phoneNumber = normalizePhoneNumber(args.phoneNumber);
    const user = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", phoneNumber))
      .unique();
    if (!user || user.status !== "invited") return { cleared: false };

    const staleAccount = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", phoneNumber),
      )
      .unique();
    if (!staleAccount) return { cleared: false };

    await ctx.db.delete(staleAccount._id);
    return { cleared: true };
  },
});

// Appelée juste après signUp — remplace le placeholderToken par le vrai.
export const linkAgentAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Non authentifié");

    // La session issue de ConvexCredentials/Password est identifiée par le
    // userId qu'`authorize`/`createOrUpdateUser` a retourné — pas par un
    // champ `email` (le JWT émis par @convex-dev/auth ne contient que `sub`,
    // aucune donnée de profil, sauf `customClaims` explicitement configuré).
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Compte introuvable dans le token");

    const agentRecord = await ctx.db.get(userId);

    if (!agentRecord) {
      throw new Error(
        "Aucun compte trouvé pour ce numéro. Contactez votre gérant.",
      );
    }

    // Déjà lié — no-op
    if (!agentRecord.tokenIdentifier.startsWith("invited|")) {
      return { alreadyLinked: true };
    }

    const oldToken = agentRecord.tokenIdentifier;

    await ctx.db.patch(agentRecord._id, {
      tokenIdentifier: identity.subject,
      status: agentRecord.status === "invited" ? "active" : agentRecord.status,
      // Code d'activation à usage unique — on l'efface une fois le compte lié.
      temporaryPassword: undefined,
    });

    // Migrer le rôle authz de l'ancien token vers le nouveau
    const oldRoles = await authz
      .withTenant(agentRecord.branchId)
      .getUserRoles(ctx, oldToken);
    const role = oldRoles[0]?.role;
    if (role) {
      await authz
        .withTenant(agentRecord.branchId)
        .assignRole(ctx, identity.subject, role);
    }

    return { alreadyLinked: false };
  },
});

// Appelée après que @convex-dev/auth a changé le credential avec succès
export const confirmPasswordChange = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Non authentifié");

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.subject))
      .unique();
    if (!user) throw new Error("Utilisateur introuvable");

    if (!user.mustChangePassword) return; // no-op

    await ctx.db.patch(user._id, {
      mustChangePassword: false,
      passwordSetAt: Date.now(),
      failedLoginAttempts: 0,
    });
  },
});

/**
 * Remplace le mot de passe temporaire (ou permanent) de l'agent par un
 * nouveau, choisi par lui.
 *
 * `@convex-dev/auth`'s `Password` provider ne supporte que les flows
 * "signUp" / "signIn" / "reset" / "reset-verification" / "email-verification"
 * — pas de flow "update" pour un changement de mot de passe en session déjà
 * authentifiée. On utilise donc directement `retrieveAccount` (vérifie
 * l'ancien mot de passe) puis `modifyAccountCredentials` (écrit le nouveau),
 * les deux helpers bas niveau exportés par @convex-dev/auth/server.
 */
export const changePassword = action({
  args: { oldPassword: v.string(), newPassword: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Non authentifié");

    if (!/^\d{4}$/.test(args.newPassword)) {
      throw new Error("Le nouveau mot de passe doit être un code à 4 chiffres");
    }

    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Non authentifié");

    const phoneNumber: string | null = await ctx.runQuery(
      internal.users.getPhoneNumberById,
      { userId },
    );
    if (!phoneNumber) throw new Error("Compte introuvable");

    const retrieved = await retrieveAccount(ctx, {
      provider: "password",
      account: { id: phoneNumber, secret: args.oldPassword },
    });
    if (!retrieved) {
      throw new Error("Mot de passe actuel incorrect");
    }

    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: phoneNumber, secret: args.newPassword },
    });

    await ctx.runMutation(api.users.confirmPasswordChange, {});
  },
});

export const getPhoneNumberById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return user?.phoneNumber ?? null;
  },
});

// ─── Verrouillage progressif à la connexion ──────────────────────────────────
/**
 * Le mot de passe est passé à un code à 4 chiffres (10 000 combinaisons) —
 * sans verrouillage après des essais répétés, le compte devient brute-
 * forçable en ligne. Même principe que `otp.ts:verifyAndTrackActivationCode`
 * (paliers fixes pour le code d'activation), mais progressif ici. À garder
 * synchronisé avec les paliers dupliqués dans `utils/secure-storage.ts`
 * côté mobile (verrouillage hors-ligne, compteur local séparé).
 */
const LOGIN_LOCKOUT_TIERS: { attempts: number; lockoutMs: number }[] = [
  { attempts: 5, lockoutMs: 5 * 60 * 1000 }, // 5 min
  { attempts: 10, lockoutMs: 30 * 60 * 1000 }, // 30 min
  { attempts: 15, lockoutMs: 2 * 60 * 60 * 1000 }, // 2h
  { attempts: 20, lockoutMs: 24 * 60 * 60 * 1000 }, // 24h (palier max, réappliqué au-delà)
];

function computeLockoutMs(attempts: number): number | null {
  let lockoutMs: number | null = null;
  for (const tier of LOGIN_LOCKOUT_TIERS) {
    if (attempts >= tier.attempts) lockoutMs = tier.lockoutMs;
  }
  return lockoutMs;
}

export const getUserAuthStatusByPhone = internalQuery({
  args: { phoneNumber: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", args.phoneNumber))
      .unique();
    if (!user) return null;
    return { userId: user._id, lockedUntil: user.lockedUntil ?? null };
  },
});

export const recordLoginFailure = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<{ message: string }> => {
    const user = await ctx.db.get(args.userId);
    if (!user) return { message: "Mot de passe incorrect." };

    const attempts = (user.failedLoginAttempts ?? 0) + 1;
    const lockoutMs = computeLockoutMs(attempts);
    await ctx.db.patch(args.userId, {
      failedLoginAttempts: attempts,
      ...(lockoutMs ? { lockedUntil: Date.now() + lockoutMs } : {}),
    });

    if (lockoutMs) {
      const minutes = Math.ceil(lockoutMs / 60000);
      return {
        message:
          minutes >= 60
            ? `Trop de tentatives. Compte verrouillé ${Math.round(minutes / 60)}h.`
            : `Trop de tentatives. Compte verrouillé ${minutes} minutes.`,
      };
    }
    return { message: "Mot de passe incorrect." };
  },
});

export const resetLoginAttempts = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { failedLoginAttempts: 0 });
  },
});

/**
 * Vérifie le mot de passe AVANT le `signIn` réel côté client, pour que le
 * suivi des tentatives ratées se fasse de façon fiable côté serveur — même
 * schéma que `verifyAndTrackActivationCode` dans otp.ts. Le `signIn` du
 * provider Password lui-même n'incrémente jamais de compteur en cas d'échec
 * (voir @convex-dev/auth/dist/providers/Password.js — `authorize` ne fait
 * que retrieveAccount/throw, sans hook d'échec).
 */
export const verifyLoginPassword = action({
  args: { phoneNumber: v.string(), password: v.string() },
  handler: async (ctx, args): Promise<{ valid: boolean; message?: string }> => {
    const phoneNumber = normalizePhoneNumber(args.phoneNumber);
    const status = await ctx.runQuery(internal.users.getUserAuthStatusByPhone, {
      phoneNumber,
    });
    if (!status) return { valid: false, message: "Mot de passe incorrect." };

    if (status.lockedUntil && status.lockedUntil > Date.now()) {
      const minutes = Math.ceil((status.lockedUntil - Date.now()) / 60000);
      return {
        valid: false,
        message: `Compte verrouillé. Réessayez dans ${minutes} minutes.`,
      };
    }

    const retrieved = await retrieveAccount(ctx, {
      provider: "password",
      account: { id: phoneNumber, secret: args.password },
    });

    if (!retrieved) {
      const { message } = await ctx.runMutation(internal.users.recordLoginFailure, {
        userId: status.userId,
      });
      return { valid: false, message };
    }

    await ctx.runMutation(internal.users.resetLoginAttempts, {
      userId: status.userId,
    });
    return { valid: true };
  },
});

// ─── verifyFirstLogin ─────────────────────────────────────────────────────────
/**
 * Vérifie si un email correspond à un agent valide avec un TPE assigné.
 * Utilisé avant l'authentification pour afficher des messages d'erreur clairs.
 * 
 * Cette query est publique (pas d'authentification requise) car elle est
 * appelée depuis l'écran de login avant la connexion.
 */
export const verifyFirstLogin = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const emailLower = args.email.toLowerCase().trim();

    // 1. Vérifier si l'email existe
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", emailLower))
      .unique();

    if (!user) {
      return {
        valid: false,
        reason: "email_not_found",
        message:
          "Aucun compte trouvé pour cet email. Vérifiez l'adresse ou contactez votre administrateur.",
      };
    }

    // 2. Vérifier si le compte est suspendu
    if (user.status === "suspended") {
      return {
        valid: false,
        reason: "account_suspended",
        message:
          "Votre compte a été suspendu. Veuillez contacter votre gérant.",
      };
    }

    // 3. Vérifier si le compte est verrouillé
    if (user.lockedUntil && user.lockedUntil > Date.now()) {
      const minutes = Math.ceil((user.lockedUntil - Date.now()) / 60000);
      return {
        valid: false,
        reason: "account_locked",
        message: `Compte verrouillé. Réessayez dans ${minutes} minutes.`,
      };
    }

    // 4. Vérifier si un TPE est assigné
    const device = await ctx.db
      .query("devices")
      .withIndex("by_assigned_to", (q) => q.eq("assignedTo", user._id))
      .first();

    if (!device) {
      return {
        valid: false,
        reason: "no_device_assigned",
        message:
          "Aucun terminal n'est assigné à votre compte. Veuillez contacter votre administrateur pour qu'il vous assigne un TPE.",
      };
    }

    // 5. Tout OK
    return {
      valid: true,
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        mustChangePassword: user.mustChangePassword ?? false,
      },
      device: {
        _id: device._id,
        serialNumber: device.serialNumber,
        model: device.model,
        brand: device.brand,
      },
    };
  },
});

// ─── checkLoginEligibility ────────────────────────────────────────────────────
/**
 * Vérifie qu'un numéro de téléphone correspond à un agent valide, AVANT de
 * tenter l'authentification. Indique au client s'il s'agit d'une première
 * connexion (`status: "invited"`, code d'activation Twilio requis) ou d'une
 * connexion normale (`status: "active"`, mot de passe permanent).
 *
 * Ne compare aucun mot de passe — c'est ce qui rend la décision signIn/signUp
 * fiable côté client, sans avoir à interpréter le message d'une erreur auth.
 *
 * Query publique (pas d'authentification requise) car appelée depuis l'écran de login.
 */
export const checkLoginEligibility = query({
  args: { phoneNumber: v.string() },
  handler: async (ctx, args) => {
    const phoneNumber = normalizePhoneNumber(args.phoneNumber);
    const user = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", phoneNumber))
      .unique();

    if (!user) {
      return {
        valid: false,
        reason: "phone_not_found",
        message: "Aucun compte trouvé pour ce numéro. Contactez votre administrateur.",
      };
    }

    if (user.status === "suspended") {
      return {
        valid: false,
        reason: "account_suspended",
        message: "Votre compte a été suspendu. Veuillez contacter votre gérant.",
      };
    }

    if (user.lockedUntil && user.lockedUntil > Date.now()) {
      const minutes = Math.ceil((user.lockedUntil - Date.now()) / 60000);
      return {
        valid: false,
        reason: "account_locked",
        message: `Compte verrouillé. Réessayez dans ${minutes} minutes.`,
      };
    }

    // La première connexion (activation) ne doit pas aboutir tant qu'aucun
    // TPE n'a été assigné à l'agent sur kauri — sinon le compte se retrouve
    // pleinement activé (authAccount créé, status → "active") avant même
    // que l'agent puisse faire quoi que ce soit avec.
    if (user.status === "invited") {
      const device = await ctx.db
        .query("devices")
        .withIndex("by_assigned_to", (q) => q.eq("assignedTo", user._id))
        .first();
      if (!device) {
        return {
          valid: false,
          reason: "no_device_assigned",
          message:
            "Aucun terminal n'est assigné à votre compte. Contactez votre administrateur pour qu'il vous assigne un TPE avant votre première connexion.",
        };
      }
    }

    return {
      valid: true,
      status: user.status as "invited" | "active",
      user: {
        _id: user._id,
        fullName: user.fullName,
      },
    };
  },
});
