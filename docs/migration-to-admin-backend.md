# Migration plan: mobile app onto the admin (Kauri) backend

Status: **phase 0 done** (device binding; admin side in TontiPro-Admin#8).
Everything else is open. Last checked against admin `main` on 2026-10-15.

## Goal

The mobile agent app (`TontiPro`, Expo) talks to the same Convex backend as the
admin dashboard (`TontiPro-Admin-main`, dev deployment `giddy-leopard-614`)
instead of its own (`posh-nightingale-973`). One schema, one auth, one set of
permissions.

## Where we are

| | Mobile today | Admin backend |
|---|---|---|
| Deployment | `posh-nightingale-973` | `giddy-leopard-614` |
| Staff login | Phone + code / OTP, plus Clerk for admins | Email + password, one-time activation code (Convex Auth, invite-only); admin-issued reset code for forgotten passwords |
| Roles | `role: string` on the user, `permissionsForRole()` in the client | `@djpanda/convex-authz` roles, permission checked per mutation; `users.me().can` flags for the UI |
| Device binding | PIN/QR claim by the agent | `devices:bindDevice` by an `it_admin`, by serial number |

### Done (phase 0)

- Admin (TontiPro-Admin#8): `users.me` returns `device`; new `devices.myDevice`
  query. Both return `{ serialNumber, model, status }` or `null`. Until that
  PR is merged and deployed, the two mobile screens below fail with "Could not
  find public function for 'devices:myDevice'".
- Mobile: `bind-device.tsx` is a waiting screen that shows the phone's serial;
  `verify-device.tsx` compares that serial with the bound terminal;
  `register-device.tsx` removed; register button and `getBySerial` removed from
  `login.tsx`.
- Serial format is `BRAND-MODEL-INSTALLID`, uppercase, max 50 characters. The
  admin must enter exactly what the phone displays.

### Phase 1, profile (labsprogiciel-coder/tontipro-app#12)

- The app reads its profile from admin `users.me` (`stores/auth-store.ts`,
  `userFromMe`). The first role becomes the app's `AgentRole`. `active:
  false` (suspended) signs the agent out locally. Admin `users.me` also
  returns `branchId`, `phoneNumber` and `organization` (TontiPro-Admin#18).
- Admin functions are referenced by name with `makeFunctionReference` in
  `lib/admin-api.ts`, which also holds their result types. Keep it in step
  with the admin repo until the generated API is shared (phase 5).
- `.env.example` points at the admin dev deployment; put the URL in
  `.env.local`.
- The admin backend has no forced password change, password expiry or
  server lockout, so `mustChangePassword`, `passwordSetAt` and `lockedUntil`
  are always unset.

### Phase 1, login (labsprogiciel-coder/tontipro-app#13)

- `app/(auth)/login.tsx`: phone + password (`signIn("phone", …)`),
  "Première connexion" (phone + IT activation code + new password) and
  "Mot de passe oublié" (phone + IT reset code + new password, via
  `passwordReset:resetPassword`). `register.tsx` and every call to
  `checkLoginEligibility`, `verifyLoginPassword`, `linkAgentAccount`,
  `clearStaleActivationAccount` and `otp.*` are gone.
- `change-password.tsx` is no longer reachable; it still calls the old
  `users.changePassword` until TontiPro-Admin#11 is decided.

## Gap: calls the mobile app makes that the admin backend lacks

Counts are call sites in `app/ lib/ hooks/ stores/ utils/ components/`. The
last column is the closest thing the admin backend has today.

| Area | Missing functions | Admin equivalent |
|---|---|---|
| Session / profile | `users.update`, `users.changePassword` (`users.currentUser` replaced by `users.me`) | `users.me` (profile, roles, `device`, `can`). No self-service profile edit or password change; forgotten passwords use an admin-issued reset code (`staff.issueResetCode` → `passwordReset.resetPassword`) |
| Login eligibility | `users.checkLoginEligibility`, `users.verifyLoginPassword`, `users.linkAgentAccount`, `users.clearStaleActivationAccount` | None needed: Convex Auth `signIn("password", …)` with `flow: "signIn"` / `"signUp"` + `code` |
| Activation | `otp.checkActivationCode`, `otp.resendActivationCode` | Activation code issued by IT from the dashboard (`staff.issueActivationCode`) or CLI (`users:issueActivationCode`) |
| Agents | None left: the app's agent screens were removed (phase 4) | `staff.create`, `staff.setStatus`, `staff.setRole`, `staff.get` (all `staff:manage`); `admin.listAgents` (not branch-scoped) |
| Customers | None left (phase 2) | `customers.list`, `createProspect`, `update` (branch-scoped) |
| Transactions | None left (phase 3) | `transactions.createDeposit`, `createWithdrawal`, `list`, `listMineInRange`, `listByAgent`, `listByBranch`, `reverseTransaction` |

The admin backend also has read queries for the dashboard (`admin.*`) and
`disbursements.*` / `reconciliation.*`. Reuse their tables and permissions; do
not copy the mobile schema over.

## Decisions needed before phase 1

1. **Login identifier.** Decided: **phone number.** Staff keep one password
   account keyed on their email; the admin backend's `phone` provider finds
   the staff member by phone and checks that same password, so the dashboard
   (email) and the app (phone) share one password (TontiPro-Admin#20).
2. **Activation.** Admin issues a one-time code per user, from the staff
   drawer on the dashboard or `users:issueActivationCode`. The same mechanism
   now covers forgotten passwords. Mobile uses SMS OTP (`otp.ts`, Twilio).
   Keep one. Recommended: keep the admin code, drop OTP for activation.
3. **Offline PIN unlock.** Decided: the server password (8+ characters) is
   only typed to sign in on a device. The agent then picks a 4-digit PIN kept
   on the device (`app/(auth)/set-pin.tsx`, hashed in SecureStore); each
   launch asks for it, online or offline. It never signs in to the server.
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
  "Premiere connexion" (`signIn("password", { email, password, flow:
  "signUp", code })`), plus "Mot de passe oublié" via
  `passwordReset.resetPassword({ email, code, newPassword })`. Remove the
  Clerk provider and `checkLoginEligibility` / `linkAgentAccount` /
  `clearStaleActivationAccount`.
- `users.changePassword` has no admin equivalent. Either add one (it must
  re-check the current password) or drop the screen and use the reset code.
- Exit criteria: an agent activates, logs in, and `user.device` is populated.

### Phase 2 - Customers

Done: backend in TontiPro-Admin#19, app in #14.

- `stores/client-store.ts` and the dashboard read `customers:list` and write
  `customers:createProspect` / `customers:update` through `lib/admin-api.ts`.
- The list covers the whole branch (not only the agent's own customers).
  Balance and last deposit are derived on the server; the app never writes a
  balance (the balance editor on the client screen is gone).
- New clients are always prospects. A scanned ID number is stored, but KYC
  verification happens on the dashboard.
- Phone, ID number and a verified client's name need a supervisor
  (`customers:edit_sensitive`). The edit form locks them for field agents,
  and a refusal from the server is shown and not retried.

### Phase 3 - Transactions

Done: deposits and history (backend TontiPro-Admin#21), withdrawals
(TontiPro-Admin#22); app #15.

- `transaction-store` records deposits with `transactions:createDeposit`
  (`customerId`, `amount`, `clientId`). The `clientId` is the UUID made when
  the collection is recorded and kept across retries, so a replay returns the
  stored deposit. The TPE, agent, branch and time come from the server.
- History comes from `transactions:list` / `listMineInRange` (own) and
  `listByBranch` (supervisor/accountant reports).
- Refusals: `DAY_CLOSED` and `NO_DEVICE` keep the deposit queued with a
  message (they lift the next day / once IT binds a TPE); the others move it
  to "rejected" and undo its effect on the local balance. Online, every
  refusal is shown at once and nothing is queued.
- **Withdrawals are a direct debit** (decided: no supervisor approval).
  `transactions:createWithdrawal` takes the same arguments and rules as
  deposits, plus `INSUFFICIENT_BALANCE`. Field agents and supervisors have
  `transactions:withdraw`. They are online only: cash leaves the agent's
  hands, so the server must confirm the balance first. A failed call is
  retried once with the same `clientId`; if that fails too the agent is told
  not to pay out and to check the history. A withdrawal queued by an older
  app version is rejected, not replayed.

### Phase 4 - Agent management

Done in the app (#16). Staff management lives on the dashboard only:
`staff.create`, `setRole`, `setStatus`, `get` and the activation/reset codes,
all `staff:manage` (IT admin).

- Removed the app's agents screens and `stores/agent-store.ts`, so
  `users.create`, `users.suspend` and `users.listByBranch` are no longer called.
- The profile screen (`app/(app)/profile.tsx`) is read-only and tells the
  agent to ask IT for changes. No `users.update` on the backend.
- Reports list the agents that appear in the period's transactions instead of
  the branch roster. A supervisor team view would need a read-only,
  branch-scoped backend query (new issue if wanted).

### Phase 5 - Cutover

- Run the data move (decision 4), switch the production env file, release via
  EAS, then remove the old `convex/` directory from the mobile repo and use the
  admin repo's generated API.
- Delete leftovers: Clerk dependencies, `otp.ts` flows, unused
  `claimDevice*` references. Rewrite `docs/device-auth-vs-binding.md` and
  `docs/mobile-integration.md` for the new flow: both still describe Clerk
  login, PIN/QR claiming, `linkAgentAccount` and `users.currentUser`.

## Risks

- Two repos with diverging `convex/` folders. Until cutover, schema changes in
  the admin repo must be checked against the mobile types. Consider moving the
  backend to one shared package before phase 2.
- Deploying admin code to the shared dev deployment replaces whatever another
  copy pushed earlier. Agree on one checkout as the source of truth.
- Serial matching is exact. A reinstall changes the install id and breaks the
  binding; document the "unbind then rebind" procedure for IT.
- convex-authz stores a copy of each role's permissions at assignment time.
  After any change to `defineRoles()` in the admin `authz.ts`, run
  `npx convex run users:syncRolePermissions` or existing users keep the old
  permissions.

## Verification checklist per phase

- `npx tsc --noEmit` clean in the mobile repo.
- `npx convex dev --once` clean in the admin repo, then
  `npx convex run users:syncRolePermissions` if roles changed.
- Manual run on a device: activate, log in, bind, record a deposit, see it in
  the dashboard.
