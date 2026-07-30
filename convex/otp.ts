// convex/otp.ts
// First-login activation codes for field agents, sent via Twilio's plain
// Messages API (WhatsApp first, falling back to SMS) — the same pipeline
// already used by convex/notifications.ts. Twilio Verify was tried first but
// isn't usable on this account: its WhatsApp channel requires a production
// WhatsApp Business sender (not available on a Trial account's sandbox
// number), and its SMS channel blocks some local prefixes as anti-fraud
// (observed on a real number here). So the code is generated and stored by
// us (`users.temporaryPassword`) and compared directly — same mechanism the
// project used before, minus the signIn/signUp bug: that decision is made
// from `users.status` (see users.ts:checkLoginEligibility), never by
// parsing an auth error message.
import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { authz } from "./authz";
import { normalizePhoneNumber } from "./phone";

// 4 digits: same format as the permanent password the agent chooses in
// changePassword (convex/users.ts), since this code doubles as the initial
// secret for the `Password` provider's signUp flow (see auth.ts). The
// provider's default validator requires 8+ characters, so auth.ts overrides
// it with `validatePasswordRequirements` to accept 4-digit codes.
function generateActivationCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

const ACTIVATION_CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ACTIVATION_ATTEMPTS = 5;
const ACTIVATION_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function activationMessage(code: string): string {
  return (
    `Voici votre code d'activation Kauridorr : ${code}\n\n` +
    `Saisissez-le dans l'application pour activer votre compte.`
  );
}

async function twilioMessagesRequest(body: Record<string, string>): Promise<{ sid: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error("Twilio non configuré : TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN manquants.");
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      },
      body: new URLSearchParams(body).toString(),
    },
  );

  const json: any = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(json?.message ?? `Erreur Twilio (HTTP ${response.status})`);
  }
  return { sid: json.sid as string };
}

async function sendActivationMessage(
  phoneNumber: string,
  code: string,
): Promise<{ channel: "whatsapp" | "sms"; sid: string }> {
  const message = activationMessage(code);
  const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;

  try {
    if (!whatsappFrom) {
      throw new Error("Twilio non configuré : TWILIO_WHATSAPP_FROM manquant.");
    }
    const { sid } = await twilioMessagesRequest({
      From: `whatsapp:${whatsappFrom}`,
      To: `whatsapp:${phoneNumber}`,
      Body: message,
      // Twilio often accepts a WhatsApp send synchronously (no exception
      // here) and only reports failure later — e.g. error 63016 when the
      // sandbox's 24h session window has expired. This callback is how
      // http.ts's /twilio/status route detects that and triggers the SMS
      // fallback (markDeliveryStatus → sendSmsFallback).
      StatusCallback: `${process.env.CONVEX_SITE_URL}/twilio/status`,
    });
    return { channel: "whatsapp", sid };
  } catch {
    // Repli synchrone : fréquent en Sandbox pour un numéro qui n'a pas
    // rejoint le sandbox WhatsApp — Twilio rejette l'appel avant l'envoi.
    const smsFrom = process.env.TWILIO_SMS_FROM;
    if (!smsFrom) {
      throw new Error("Twilio non configuré : TWILIO_SMS_FROM manquant.");
    }
    const { sid } = await twilioMessagesRequest({
      From: smsFrom,
      To: phoneNumber,
      Body: message,
    });
    return { channel: "sms", sid };
  }
}

// ── Public API ────────────────────────────────────────────────────────────

/** Generates and sends the first-login activation code. Called by an admin/supervisor right after creating an agent. */
export const sendActivationCode = action({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<{ channel: "whatsapp" | "sms" }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Non authentifié");

    const target = await ctx.runQuery(internal.otp.getUserForActivation, {
      callerSubject: identity.subject,
      targetUserId: args.userId,
    });

    const phoneNumber = normalizePhoneNumber(target.phoneNumber);
    const code = generateActivationCode();
    await ctx.runMutation(internal.otp.setActivationCode, {
      userId: args.userId,
      code,
    });

    const { channel, sid } = await sendActivationMessage(phoneNumber, code);
    await ctx.runMutation(internal.notifications.recordDelivery, {
      userId: args.userId,
      branchId: target.branchId,
      phoneNumber,
      channel,
      twilioSid: sid,
      status: "queued" as const,
    });
    return { channel };
  },
});

/** Regenerates and resends the activation code — called from the mobile login screen if the code expired. */
export const resendActivationCode = action({
  args: { phoneNumber: v.string() },
  handler: async (ctx, args): Promise<{ channel: "whatsapp" | "sms" }> => {
    const phoneNumber = normalizePhoneNumber(args.phoneNumber);
    const user = await ctx.runQuery(internal.otp.getInvitedUserByPhone, {
      phoneNumber,
    });
    if (!user) {
      throw new Error("Aucune activation en attente pour ce numéro.");
    }

    const code = generateActivationCode();
    await ctx.runMutation(internal.otp.setActivationCode, {
      userId: user._id,
      code,
    });

    const { channel, sid } = await sendActivationMessage(phoneNumber, code);
    await ctx.runMutation(internal.notifications.recordDelivery, {
      userId: user._id,
      branchId: user.branchId,
      phoneNumber,
      channel,
      twilioSid: sid,
      status: "queued" as const,
    });
    return { channel };
  },
});

/** Checks a code entered on the mobile login screen against the stored activation code. */
export const checkActivationCode = action({
  args: { phoneNumber: v.string(), code: v.string() },
  handler: async (ctx, args): Promise<{ valid: boolean; message?: string }> => {
    return await ctx.runMutation(internal.otp.verifyAndTrackActivationCode, {
      phoneNumber: normalizePhoneNumber(args.phoneNumber),
      code: args.code,
    });
  },
});

// ── Internal ──────────────────────────────────────────────────────────────

export const getUserForActivation = internalQuery({
  args: { callerSubject: v.string(), targetUserId: v.id("users") },
  handler: async (ctx, args) => {
    const caller = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.callerSubject))
      .unique();
    if (!caller) throw new Error("Utilisateur appelant introuvable");

    await authz
      .withTenant(caller.branchId)
      .require(ctx, args.callerSubject, "devices:bind");

    const target = await ctx.db.get(args.targetUserId);
    if (!target) throw new Error("Agent introuvable");
    if (target.branchId !== caller.branchId) throw new Error("Unauthorized");
    if (target.status !== "invited") {
      throw new Error("Cet agent a déjà activé son compte.");
    }
    if (!target.phoneNumber) {
      throw new Error("Cet agent n'a pas de numéro de téléphone enregistré.");
    }

    return { phoneNumber: target.phoneNumber, branchId: target.branchId as Id<"branches"> };
  },
});

export const setActivationCode = internalMutation({
  args: { userId: v.id("users"), code: v.string() },
  handler: async (ctx, args) => {
    // Nouveau code = nouveau budget de tentatives ; sinon un agent verrouillé
    // par de mauvaises tentatives sur un ancien code resterait bloqué même
    // après avoir demandé un nouveau code via "Renvoyer".
    await ctx.db.patch(args.userId, {
      temporaryPassword: args.code,
      temporaryPasswordExpiresAt: Date.now() + ACTIVATION_CODE_TTL_MS,
      activationAttempts: 0,
    });
  },
});

/**
 * Vérifie le code d'activation saisi, avec expiration et verrouillage anti-
 * brute-force — même mécanisme (`lockedUntil`) que le login normal, donc
 * `checkLoginEligibility` bloque aussi la suite dès qu'un agent est verrouillé
 * ici. Mutation (pas query) car elle doit pouvoir écrire le compteur de
 * tentatives et le verrouillage.
 */
export const verifyAndTrackActivationCode = internalMutation({
  args: { phoneNumber: v.string(), code: v.string() },
  handler: async (ctx, args): Promise<{ valid: boolean; message?: string }> => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", args.phoneNumber))
      .unique();
    if (!user || user.status !== "invited") {
      return { valid: false, message: "Code incorrect ou expiré." };
    }

    if (user.lockedUntil && user.lockedUntil > Date.now()) {
      const minutes = Math.ceil((user.lockedUntil - Date.now()) / 60000);
      return {
        valid: false,
        message: `Compte verrouillé. Réessayez dans ${minutes} minutes.`,
      };
    }

    const isExpired =
      !user.temporaryPasswordExpiresAt ||
      user.temporaryPasswordExpiresAt < Date.now();
    const isMatch = !!user.temporaryPassword && user.temporaryPassword === args.code;

    if (!isMatch || isExpired) {
      const attempts = (user.activationAttempts ?? 0) + 1;
      if (attempts >= MAX_ACTIVATION_ATTEMPTS) {
        await ctx.db.patch(user._id, {
          activationAttempts: 0,
          lockedUntil: Date.now() + ACTIVATION_LOCKOUT_MS,
        });
      } else {
        await ctx.db.patch(user._id, { activationAttempts: attempts });
      }
      return { valid: false, message: "Code incorrect ou expiré." };
    }

    if (user.activationAttempts) {
      await ctx.db.patch(user._id, { activationAttempts: 0 });
    }
    return { valid: true };
  },
});

export const getInvitedUserByPhone = internalQuery({
  args: { phoneNumber: v.string() },
  handler: async (ctx, args) => {
    const phoneNumber = normalizePhoneNumber(args.phoneNumber);
    const user = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", phoneNumber))
      .unique();
    if (!user || user.status !== "invited") return null;
    return user;
  },
});
