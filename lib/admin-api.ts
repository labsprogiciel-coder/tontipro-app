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
