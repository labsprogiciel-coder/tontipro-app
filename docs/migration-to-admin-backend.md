# Migration plan: mobile app onto the admin (Kauri) backend

Status: **phase 0 done** (device binding). Everything else is open.

## Goal

The mobile agent app (`TontiPro`, Expo) talks to the same Convex backend as the
admin dashboard (`TontiPro-Admin-main`, dev deployment `giddy-leopard-614`)
instead of its own (`posh-nightingale-973`). One schema, one auth, one set of
permissions.

## Where we are

| | Mobile today | Admin backend |
|---|---|---|
| Deployment | `posh-nightingale-973` | `giddy-leopard-614` |
| Staff login | Phone + code / OTP, plus Clerk for admins | Email + password, one-time activation code (Convex Auth, invite-only) |
| Roles | `role: string` on the user, `permissionsForRole()` in the client | `@djpanda/convex-authz` roles, permission checked per mutation |
| Device binding | PIN/QR claim by the agent | `devices:bindDevice` by an `it_admin`, by serial number |

### Done (phase 0)

- Admin: `users.me` returns `device`; new `devices.myDevice` query.
- Mobile: `bind-device.tsx` is a waiting screen that shows the phone's serial;
  `verify-device.tsx` compares that serial with the bound terminal;
  `register-device.tsx` removed; register button and `getBySerial` removed from
  `login.tsx`.
- Serial format is `BRAND-MODEL-INSTALLID`, uppercase, max 50 characters. The
  admin must enter exactly what the phone displays.

## Gap: calls the mobile app makes that the admin backend lacks

Counts are call sites in `app/ lib/ hooks/ stores/ utils/ components/`.

| Area | Missing functions |
|---|---|
| Session / profile | `users.currentUser` (6), `users.update`, `users.changePassword` |
| Login eligibility | `users.checkLoginEligibility`, `users.verifyLoginPassword`, `users.linkAgentAccount`, `users.clearStaleActivationAccount` |
| Activation | `otp.checkActivationCode`, `otp.resendActivationCode` |
| Agents | `users.create`, `users.suspend`, `users.listByBranch` |
| Customers | `customers.list`, `customers.createProspect`, `customers.update` |
| Transactions | `transactions.list`, `transactions.listMineInRange`, `transactions.createDeposit`, `transactions.createWithdrawal` (only `transactions.listByBranch` exists on both) |

The admin backend already has read queries for the dashboard (`admin.*`),
`transactions.*` for reversal, and `disbursements.*` / `reconciliation.*`.
Reuse their tables and permissions; do not copy the mobile schema over.

## Decisions needed before phase 1

1. **Login identifier.** Admin uses email. Mobile agents log in with a phone
   number. Choose: agents get an email too, or add phone as a second lookup.
   This drives `auth.ts` and the whole activation screen set (`reg.tsx`,
   `register.tsx`, `login.tsx`).
2. **Activation.** Admin issues a one-time code per user
   (`users:issueActivationCode`). Mobile uses SMS OTP (`otp.ts`, Twilio). Keep
   one. Recommended: keep the admin code, drop OTP for activation.
3. **Offline PIN unlock.** `verifyPin` and `utils/secure-storage.ts` unlock the
   app offline. Keep as a local convenience layered on top of the Convex
   session, not as a login method.
4. **Data move.** The mobile deployment holds real or test customers and
   transactions. Decide whether to export/import them or start clean.

## Phases

Each phase ends with the app working for the screens it covers.

### Phase 1 - Session and identity

- Add a mobile-shaped profile to the admin backend: either `users.currentUser`
  returning `_id, fullName, email, phoneNumber, branchId, organization, device,
  role` or change the store to read `users.me`. Prefer changing the store
  (one source of truth); map `roles[0]` to the app's `AgentRole`.
- Point `EXPO_PUBLIC_CONVEX_URL` / `EXPO_PUBLIC_CONVEX_SITE_URL` at
  `giddy-leopard-614` in a **separate env file** first, so both backends stay
  usable during the migration.
- Replace the login flow with email + password and the activation-code
  "Premiere connexion". Remove the Clerk provider and `checkLoginEligibility`
  / `linkAgentAccount` / `clearStaleActivationAccount`.
- Exit criteria: an agent activates, logs in, and `user.device` is populated.

### Phase 2 - Customers

- Port `customers.list`, `createProspect`, `update` onto the admin `customers`
  table. Gate with `customers:create_prospect` and `customers:edit_sensitive`
  from `authz.ts`; scope reads to the caller's branch.
- Check field names against the admin schema (mobile and admin differ on
  status and KYC fields) and update `client-store`.

### Phase 3 - Transactions

- Port `createDeposit`, `createWithdrawal`, `list`, `listMineInRange`.
  Require `transactions:collect`, set `agentId` from the session (never from
  arguments), and set the terminal from the agent's bound device so every
  collection traces to one TPE.
- Keep the "cannot post to a day already settled" rule from
  `reconciliation.ts`.
- Offline queue (`transaction-store`) must send an idempotency key; add one
  server-side before enabling replay.

### Phase 4 - Agent management

- `users.create`, `update`, `suspend`, `listByBranch` map to existing admin
  staff management (`staff:manage`, `users.ts`). Prefer deleting these screens
  from the mobile app if only the dashboard should manage staff.

### Phase 5 - Cutover

- Run the data move (decision 4), switch the production env file, release via
  EAS, then remove the old `convex/` directory from the mobile repo and use the
  admin repo's generated API.
- Delete leftovers: Clerk dependencies, `otp.ts` flows, unused
  `claimDevice*` references, `docs/device-auth-vs-binding.md` (rewrite for the
  new flow).

## Risks

- Two repos with diverging `convex/` folders. Until cutover, schema changes in
  the admin repo must be checked against the mobile types. Consider moving the
  backend to one shared package before phase 2.
- Deploying admin code to the shared dev deployment replaces whatever another
  copy pushed earlier. Agree on one checkout as the source of truth.
- Serial matching is exact. A reinstall changes the install id and breaks the
  binding; document the "unbind then rebind" procedure for IT.

## Verification checklist per phase

- `npx tsc --noEmit` clean in the mobile repo.
- `npx convex dev --once` clean in the admin repo.
- Manual run on a device: activate, log in, bind, record a deposit, see it in
  the dashboard.
