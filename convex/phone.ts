// convex/phone.ts
// Normalizes phone numbers to E.164 so the same number typed as
// "+22670000000", "22670000000", "0022670000000" or "70000000" all resolve
// to the same `users.phoneNumber` value and the same Twilio Verify identity.
// Bare local numbers (8 digits, no country code) are assumed to be Burkina
// Faso (+226) — the only country code currently in use across the fixtures.
const DEFAULT_COUNTRY_CODE = "226";

export function normalizePhoneNumber(raw: string): string {
  let digits = raw.trim().replace(/[^\d+]/g, "");

  if (digits.startsWith("00")) {
    digits = `+${digits.slice(2)}`;
  }

  if (!digits.startsWith("+")) {
    digits = digits.length <= 8 ? `+${DEFAULT_COUNTRY_CODE}${digits}` : `+${digits}`;
  }

  return digits;
}
