// lib/admin-api.ts
//
// Functions served by the admin backend (TontiPro-Admin, convex/). They are
// referenced by name because this app's generated API types still come from
// its own deployment (see docs/migration-to-admin-backend.md). Keep the types
// below in step with the admin repo's convex/users.ts and convex/devices.ts.
import { makeFunctionReference } from "convex/server";

/** Role names defined in the admin backend's convex/authz.ts */
export type AdminRole = "field_agent" | "supervisor" | "accountant" | "it_admin";

/** Terminal bound to the signed-in staff member. Serial: BRAND-MODEL-INSTALLID */
export type BoundDevice = {
  serialNumber: string;
  model: string;
  status: "active" | "maintenance" | "lost";
};

/** Result of users:me: null when signed out, `active: false` when suspended */
export type AdminMe =
  | null
  | { id: string; name: string; active: false }
  | {
      id: string;
      active: true;
      name: string;
      email: string;
      phoneNumber: string;
      branchId: string;
      branch: string | null;
      organization: { name: string; currency: string } | null;
      roles: AdminRole[];
      device: BoundDevice | null;
      // UI hints only: the server checks every mutation itself
      can: {
        reverse: boolean;
        approve: boolean;
        liquidate: boolean;
        bind: boolean;
        manageStaff: boolean;
      };
    };

export const me = makeFunctionReference<"query", Record<string, never>, AdminMe>("users:me");

export const myDevice = makeFunctionReference<
  "query",
  Record<string, never>,
  BoundDevice | null
>("devices:myDevice");

// ── Customers (admin convex/customers.ts) ────────────────────────────────────

/** Extra KYC and collection details kept on a customer */
export type CustomerMetadata = {
  address?: string;
  groupName?: string;
  commitmentAmount?: number;
  collectionFrequency?: string;
  collectionDays?: number[];
  savingsGoal?: number;
  accountNumber?: string;
  email?: string;
};

/** A row of customers:list. Balance is derived server-side; no ID number. */
export type AdminCustomer = {
  _id: string;
  fullName: string;
  phoneNumber: string;
  status: "prospect" | "verified" | "rejected";
  metadata: CustomerMetadata;
  createdAt: number;
  balance: number;
  lastDeposit: number | null;
  onboardedBy: string;
  agentName: string;
};

/** Customers of the caller's branch; [] when signed out */
export const listCustomers = makeFunctionReference<
  "query",
  Record<string, never>,
  AdminCustomer[]
>("customers:list");

/** Branch, onboarding agent and status are set by the server */
export const createProspect = makeFunctionReference<
  "mutation",
  { fullName: string; phoneNumber: string; idNumber?: string; metadata?: CustomerMetadata },
  string
>("customers:createProspect");

/** Phone, ID number and a verified customer's name need a supervisor */
export const updateCustomer = makeFunctionReference<
  "mutation",
  {
    id: string;
    fullName?: string;
    phoneNumber?: string;
    idNumber?: string;
    metadata?: CustomerMetadata;
  },
  null
>("customers:update");

const REFUSALS: Record<string, string> = {
  FORBIDDEN: "Action réservée à votre superviseur.",
  INVALID_PHONE: "Numéro de téléphone invalide.",
  PHONE_TAKEN: "Un client de votre agence a déjà ce numéro.",
  NAME_REQUIRED: "Le nom du client est obligatoire.",
  INVALID_ID_NUMBER: "Numéro de pièce d'identité trop long.",
};

/**
 * French message for a refusal the server sent as a ConvexError code, or
 * null for anything else (network failure, crash), which is worth retrying.
 */
export function refusalMessage(error: unknown): string | null {
  const code = (error as { data?: unknown } | null)?.data;
  return typeof code === "string" && code in REFUSALS ? REFUSALS[code] : null;
}

// ── Password reset (admin convex/passwordReset.ts) ───────────────────────────

/**
 * Trade an administrator-issued reset code for a new password. Throws a
 * ConvexError `WEAK_PASSWORD` (under 8 characters) or `RESET_REFUSED`.
 */
export const resetPassword = makeFunctionReference<
  "action",
  { phone: string; code: string; newPassword: string },
  null
>("passwordReset:resetPassword");
