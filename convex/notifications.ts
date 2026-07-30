// convex/notifications.ts
// Delivers an agent's temporary password via WhatsApp (Twilio), with an
// automatic SMS fallback when WhatsApp delivery fails. Twilio has no API to
// check in advance whether a number has WhatsApp, so failure is detected two
// ways:
//  1. Synchronously — the initial Twilio API call itself is rejected (common
//     in Sandbox for a number that hasn't joined it).
//  2. Asynchronously — Twilio accepts the message but later reports
//     "failed"/"undelivered" via the StatusCallback webhook (see http.ts).
import { v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { authz } from "./authz";

const DELIVERY_STATUSES = new Set([
  "queued",
  "sent",
  "delivered",
  "undelivered",
  "failed",
]);
const FAILURE_STATUSES = new Set(["failed", "undelivered"]);

function credentialsMessage(fullName: string, temporaryPassword: string) {
  return (
    `Bienvenue ${fullName} ! Voici votre mot de passe temporaire pour ` +
    `TontiPro : ${temporaryPassword}\n\n` +
    `Connectez-vous avec ce mot de passe puis changez-le lors de votre ` +
    `première connexion.`
  );
}

// ── Twilio REST helper ───────────────────────────────────────────────────────

async function twilioRequest(body: Record<string, string>): Promise<{ sid: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error(
      "Twilio non configuré : TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN manquants.",
    );
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

async function sendSmsAndRecord(
  ctx: { runMutation: (ref: any, args: any) => Promise<any> },
  args: {
    userId: Id<"users">;
    branchId: Id<"branches">;
    phoneNumber: string;
    message: string;
  },
): Promise<string> {
  const smsFrom = process.env.TWILIO_SMS_FROM;
  if (!smsFrom) {
    throw new Error("Twilio non configuré : TWILIO_SMS_FROM manquant.");
  }

  const { sid } = await twilioRequest({
    From: smsFrom,
    To: args.phoneNumber,
    Body: args.message,
  });

  await ctx.runMutation(internal.notifications.recordDelivery, {
    userId: args.userId,
    branchId: args.branchId,
    phoneNumber: args.phoneNumber,
    channel: "sms" as const,
    twilioSid: sid,
    status: "queued" as const,
  });

  return sid;
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Sends (or resends) an agent's temporary password over WhatsApp. Falls back
 * to SMS immediately if the initial WhatsApp send is rejected by Twilio, and
 * again later (via the StatusCallback webhook → sendSmsFallback) if Twilio
 * accepts the message but fails to deliver it.
 */
export const sendAgentCredentials = action({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<{ channel: "whatsapp" | "sms"; sid: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Non authentifié");

    const target = await ctx.runQuery(internal.notifications.getUserForDelivery, {
      callerSubject: identity.subject,
      targetUserId: args.userId,
    });

    const message = credentialsMessage(target.fullName, target.temporaryPassword);
    const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;

    try {
      if (!whatsappFrom) {
        throw new Error("Twilio non configuré : TWILIO_WHATSAPP_FROM manquant.");
      }

      const { sid } = await twilioRequest({
        From: `whatsapp:${whatsappFrom}`,
        To: `whatsapp:${target.phoneNumber}`,
        Body: message,
        StatusCallback: `${process.env.CONVEX_SITE_URL}/twilio/status`,
      });

      await ctx.runMutation(internal.notifications.recordDelivery, {
        userId: args.userId,
        branchId: target.branchId,
        phoneNumber: target.phoneNumber,
        channel: "whatsapp" as const,
        twilioSid: sid,
        status: "queued" as const,
      });

      return { channel: "whatsapp", sid };
    } catch {
      // Repli synchrone : fréquent en Sandbox pour un numéro qui n'a pas
      // rejoint le sandbox — Twilio rejette l'appel avant même de tenter
      // l'envoi WhatsApp.
      const sid = await sendSmsAndRecord(ctx, {
        userId: args.userId,
        branchId: target.branchId,
        phoneNumber: target.phoneNumber,
        message,
      });
      return { channel: "sms", sid };
    }
  },
});

/** Reactive delivery history for one agent — drives the dashboard's status UI. */
export const getDeliveryStatus = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Non authentifié");

    const rows = await ctx.db
      .query("credentialDeliveries")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return rows.sort((a, b) => a.createdAt - b.createdAt);
  },
});

// ── Internal (server-to-server) ──────────────────────────────────────────────

export const getUserForDelivery = internalQuery({
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
    if (!target.phoneNumber) {
      throw new Error("Cet agent n'a pas de numéro de téléphone enregistré.");
    }
    if (!target.temporaryPassword) {
      throw new Error(
        "Aucun mot de passe temporaire à envoyer (déjà activé ou changé).",
      );
    }

    return {
      fullName: target.fullName,
      phoneNumber: target.phoneNumber,
      temporaryPassword: target.temporaryPassword,
      branchId: target.branchId,
    };
  },
});

export const getUserById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    return {
      fullName: user.fullName,
      temporaryPassword: user.temporaryPassword,
    };
  },
});

export const getDeliveryById = internalQuery({
  args: { deliveryId: v.id("credentialDeliveries") },
  handler: async (ctx, args) => ctx.db.get(args.deliveryId),
});

export const recordDelivery = internalMutation({
  args: {
    userId: v.id("users"),
    branchId: v.id("branches"),
    phoneNumber: v.string(),
    channel: v.union(v.literal("whatsapp"), v.literal("sms")),
    twilioSid: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("undelivered"),
      v.literal("failed"),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("credentialDeliveries", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

/** Called by the Twilio StatusCallback webhook (see http.ts). */
export const markDeliveryStatus = internalMutation({
  args: {
    twilioSid: v.string(),
    status: v.string(),
    errorCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const delivery = await ctx.db
      .query("credentialDeliveries")
      .withIndex("by_twilio_sid", (q) => q.eq("twilioSid", args.twilioSid))
      .unique();
    if (!delivery) return;

    const patch: Record<string, unknown> = {};
    if (DELIVERY_STATUSES.has(args.status)) patch.status = args.status;
    if (args.errorCode) patch.errorCode = args.errorCode;
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(delivery._id, patch);
    }

    const shouldFallback =
      delivery.channel === "whatsapp" &&
      FAILURE_STATUSES.has(args.status) &&
      !delivery.fallbackTriggered;

    if (shouldFallback) {
      await ctx.db.patch(delivery._id, { fallbackTriggered: true });
      await ctx.scheduler.runAfter(0, internal.notifications.sendSmsFallback, {
        deliveryId: delivery._id,
      });
    }
  },
});

/** Scheduled by markDeliveryStatus when the WhatsApp send ends up failing. */
export const sendSmsFallback = internalAction({
  args: { deliveryId: v.id("credentialDeliveries") },
  handler: async (ctx, args) => {
    const delivery = await ctx.runQuery(internal.notifications.getDeliveryById, {
      deliveryId: args.deliveryId,
    });
    if (!delivery) return;

    const user = await ctx.runQuery(internal.notifications.getUserById, {
      userId: delivery.userId,
    });
    if (!user?.temporaryPassword) return;

    await sendSmsAndRecord(ctx, {
      userId: delivery.userId,
      branchId: delivery.branchId,
      phoneNumber: delivery.phoneNumber,
      message: credentialsMessage(user.fullName, user.temporaryPassword),
    });
  },
});
