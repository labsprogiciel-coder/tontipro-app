/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agents from "../agents.js";
import type * as auth from "../auth.js";
import type * as authz from "../authz.js";
import type * as crons from "../crons.js";
import type * as customers from "../customers.js";
import type * as dashboard from "../dashboard.js";
import type * as devices from "../devices.js";
import type * as disbursements from "../disbursements.js";
import type * as emails from "../emails.js";
import type * as goals from "../goals.js";
import type * as helpers from "../helpers.js";
import type * as http from "../http.js";
import type * as invitations from "../invitations.js";
import type * as notifications from "../notifications.js";
import type * as otp from "../otp.js";
import type * as phone from "../phone.js";
import type * as products from "../products.js";
import type * as reconciliation from "../reconciliation.js";
import type * as seed from "../seed.js";
import type * as seedDevices from "../seedDevices.js";
import type * as transactions from "../transactions.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agents: typeof agents;
  auth: typeof auth;
  authz: typeof authz;
  crons: typeof crons;
  customers: typeof customers;
  dashboard: typeof dashboard;
  devices: typeof devices;
  disbursements: typeof disbursements;
  emails: typeof emails;
  goals: typeof goals;
  helpers: typeof helpers;
  http: typeof http;
  invitations: typeof invitations;
  notifications: typeof notifications;
  otp: typeof otp;
  phone: typeof phone;
  products: typeof products;
  reconciliation: typeof reconciliation;
  seed: typeof seed;
  seedDevices: typeof seedDevices;
  transactions: typeof transactions;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
