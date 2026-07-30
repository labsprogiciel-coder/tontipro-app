import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";

const http = httpRouter();
auth.addHttpRoutes(http);

// ── Twilio status webhook ────────────────────────────────────────────────────
// Twilio POSTs delivery status updates here (application/x-www-form-urlencoded)
// for messages sent with a StatusCallback (see convex/notifications.ts). This
// is how we detect a WhatsApp send that Twilio accepted but failed to deliver,
// and trigger the SMS fallback.

async function verifyTwilioSignature(
  url: string,
  params: URLSearchParams,
  signatureHeader: string | null,
  authToken: string,
): Promise<boolean> {
  if (!signatureHeader) return false;

  let data = url;
  for (const key of Array.from(params.keys()).sort()) {
    data += key + params.get(key);
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data),
  );
  const computed = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
  return computed === signatureHeader;
}

http.route({
  path: "/twilio/status",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const rawBody = await request.text();
    const params = new URLSearchParams(rawBody);

    if (authToken) {
      const valid = await verifyTwilioSignature(
        request.url,
        params,
        request.headers.get("X-Twilio-Signature"),
        authToken,
      );
      if (!valid) {
        return new Response("Invalid signature", { status: 403 });
      }
    }

    const sid = params.get("MessageSid");
    const status = params.get("MessageStatus");
    if (sid && status) {
      await ctx.runMutation(internal.notifications.markDeliveryStatus, {
        twilioSid: sid,
        status,
        errorCode: params.get("ErrorCode") ?? undefined,
      });
    }

    return new Response(null, { status: 204 });
  }),
});

export default http;
