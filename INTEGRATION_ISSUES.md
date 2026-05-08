# TontiPro × Kauri — Integration GitHub Issues

> Paste each issue block into GitHub → New Issue. Labels and milestones are noted per issue.
> Milestone map: **M1** Phase 1 · **M2** Phase 2 · **M3** Phase 3 · **M4** Phase 4 · **M5** Phase 5 · **M6** Phase 6

---

## M1 — Foundation

---

### Issue #1 — Install and configure Convex React Native SDK

**Labels:** `setup` `milestone:M1`

**Description**

Replace the Supabase JS client with the Convex React Native client as the primary backend transport. This is the prerequisite for every other integration issue.

**Tasks**

- [ ] Run `npx expo install convex` in the TontiPro root
- [ ] Add `"convex"` to the `plugins` array in `app.json`
- [ ] Add `EXPO_PUBLIC_CONVEX_URL` to `.env` (point to Kauri Convex deployment)
- [ ] Create `lib/convex.ts` exporting a `ConvexReactClient` instance
- [ ] Wrap the root layout in `app/_layout.tsx` with `<ConvexProvider client={convex}>`
- [ ] Verify the app boots without errors in Expo Go

**Acceptance criteria**
- App launches with `ConvexProvider` in the tree
- `useConvexAuth()` returns `isLoading: false` after init
- No Supabase calls made on cold start

---

### Issue #2 — Migrate authentication: OTP + PIN → Convex Auth

**Labels:** `auth` `milestone:M1` `breaking`

**Description**

The current auth flow in `stores/auth-store.ts` calls `supabase.auth.signInWithOtp` and `supabase.auth.verifyOtp`. These must be rerouted to Kauri's Convex auth mutations while keeping the offline PIN fallback intact.

**Affected files**
- `stores/auth-store.ts`
- `app/(auth)/login.tsx`
- `app/(auth)/register.tsx`
- `app/(auth)/reg.tsx`

**Tasks**

- [ ] Replace `supabase.auth.signInWithOtp({ phone })` → `convex.mutation(api.auth.sendOtp, { phone })`
- [ ] Replace `supabase.auth.verifyOtp({ phone, token })` → `convex.mutation(api.auth.verifyOtp, { phone, token })` — store returned JWT via `setAuth` on the Convex client
- [ ] Replace `supabase.auth.getSession()` on app launch → `useConvexAuth()` hook
- [ ] Move PIN storage from `AsyncStorage` (`pin_${phone}`) to `expo-secure-store` (unencrypted AsyncStorage is a security risk)
- [ ] Keep offline PIN path (`verifyPin()`) unchanged — reads local secure store only
- [ ] Update root layout auth redirect to use `isAuthenticated` from `useConvexAuth()`
- [ ] Remove `supabase.auth.*` imports from auth store

**Acceptance criteria**
- Agent can register via SMS OTP backed by Convex
- Agent can log in with PIN when offline (no network)
- Session persists across app restarts
- No Supabase auth calls remain in the codebase

---

### Issue #3 — Secure token storage: migrate PIN from AsyncStorage to expo-secure-store

**Labels:** `security` `milestone:M1`

**Description**

PINs are currently stored in `AsyncStorage` under the key `pin_${phone}`. AsyncStorage is unencrypted and accessible on rooted devices. Move all credentials to `expo-secure-store`.

**Affected files**
- `stores/auth-store.ts`

**Tasks**

- [ ] Replace all `AsyncStorage.setItem('pin_...')` calls with `SecureStore.setItemAsync`
- [ ] Replace all `AsyncStorage.getItem('pin_...')` calls with `SecureStore.getItemAsync`
- [ ] Replace `kauridorr_registered_phones` array in AsyncStorage with a SecureStore entry
- [ ] Verify that re-install clears SecureStore entries on iOS (expected behavior)
- [ ] Test PIN login flow on a device without network

**Acceptance criteria**
- No plaintext credentials in AsyncStorage
- PIN login works offline after migration

---

## M2 — Client Data Layer

---

### Issue #4 — Map and migrate client store to Convex `customers` table

**Labels:** `data` `clients` `milestone:M2`

**Description**

`stores/client-store.ts` reads and writes to Supabase's `clients` table. Reroute all calls to Kauri's Convex `customers` table. The offline queue (Zustand + AsyncStorage) stays unchanged — only the flush target changes.

**Schema mapping**

| Supabase `clients` | Convex `customers` |
|---|---|
| `id` (text, `CL*`) | Keep as `ref` display field; use `_id` (ConvexId) as primary key |
| `agent_id` (uuid) | `agentId` (ConvexId) from auth context |
| `kyc_verified` (bool) | `status`: `"prospect"` / `"verified"` / `"rejected"` |
| `balance` (number) | Remove — derive from transaction sum query |
| `sync_status` | Local Zustand field only, no server equivalent |

**Affected files**
- `stores/client-store.ts`
- `lib/supabase.ts` (partial)
- `types/client.ts`

**Tasks**

- [ ] Update `Client` type in `types/client.ts` — replace `balance` with optional derived field, add `_id?: Id<"customers">`
- [ ] Replace `supabase.from("clients").select(...)` → `convex.query(api.customers.listByAgent, { agentId })`
- [ ] Replace `supabase.from("clients").insert(...)` in `addClient()` → `convex.mutation(api.customers.create, {...})`
- [ ] Replace `supabase.from("clients").update(...)` in `updateClient()` → `convex.mutation(api.customers.update, {...})`
- [ ] Update `syncPendingClients()` to drain the Zustand pending queue into `api.customers.create` Convex mutations
- [ ] Remove `balance` field from client Supabase insert — display balance is now derived from transactions
- [ ] Verify optimistic update pattern still works (write to Zustand first, then sync)

**Acceptance criteria**
- Client list loads from Convex when online
- New client created offline appears in Convex after reconnect
- No Supabase calls in `client-store.ts`

---

### Issue #5 — Replace client balance with derived transaction sum

**Labels:** `data` `clients` `milestone:M2`

**Description**

Client `balance` was a stored field in Supabase. In Convex, it should be computed from the sum of the agent's transactions for that client. This avoids balance drift from sync conflicts.

**Affected files**
- `stores/client-store.ts`
- `app/(app)/clients/[id].tsx`
- `app/(app)/clients/index.tsx`

**Tasks**

- [ ] Add `api.customers.getBalance` Convex query (sum of `transactions` where `customerId = id`)
- [ ] Replace all reads of `client.balance` in UI with the query result
- [ ] Show a loading skeleton on the balance field while query resolves
- [ ] Remove `balance` from the Zustand `Client` type (or mark `@deprecated`)

**Acceptance criteria**
- Balance shown in client detail and list reflects actual transaction history
- Balance updates immediately after a new transaction (Convex reactivity)

---

### Issue #6 — Update KYC flow: `kyc_verified` bool → `status` enum

**Labels:** `kyc` `clients` `milestone:M2`

**Description**

Supabase stored KYC as a boolean `kyc_verified`. Convex uses a `status` enum: `prospect` / `verified` / `rejected`. The client add form and detail screen need to reflect the richer status.

**Affected files**
- `app/(app)/clients/add.tsx`
- `app/(app)/clients/[id].tsx`
- `types/client.ts`

**Tasks**

- [ ] Update `Client` type: replace `kycVerified: boolean` with `status: "prospect" | "verified" | "rejected"`
- [ ] In `clients/add.tsx` — new clients default to `status: "prospect"` on create
- [ ] In `clients/[id].tsx` — show status badge (Prospect / Verified / Rejected)
- [ ] Supervisor-only: add action buttons to mark client as `verified` or `rejected` (calls `api.customers.updateStatus`)
- [ ] Update any filter logic in `clients/index.tsx` that used `kyc_verified`

**Acceptance criteria**
- New clients created with `status: "prospect"`
- Supervisors can approve/reject KYC from the client detail screen
- Status badge renders correctly for all three states

---

## M3 — Transactions

---

### Issue #7 — Migrate transaction store to Convex

**Labels:** `data` `transactions` `milestone:M3`

**Description**

`stores/transaction-store.ts` calls Supabase for all transaction reads and writes. Reroute to Convex. The Supabase realtime subscription can be deleted — Convex queries are reactive by default.

**Affected files**
- `stores/transaction-store.ts`
- `hooks/useTransactionRealtime.ts`
- `lib/transaction-supabase.ts`

**Tasks**

- [ ] Replace `supabase.from("transactions").select(...)` → `convex.query(api.transactions.listByAgent, { agentId })`
- [ ] Replace deposit `insert` → `convex.mutation(api.transactions.collectCash, { customerId, amount, agentId, deviceId })`
- [ ] Replace withdrawal `insert` → `convex.mutation(api.transactions.recordWithdrawal, { customerId, amount, agentId })`
- [ ] Delete `hooks/useTransactionRealtime.ts` — replace its usage in screens with `useQuery(api.transactions.listByAgent)` directly
- [ ] Replace `lib/transaction-supabase.ts` row converter with a Convex document ↔ `Transaction` type converter (camelCase, `_id` instead of `id`)
- [ ] Update `syncPendingTransactions()` to drain queue into Convex mutations

**Acceptance criteria**
- Transaction list updates in real-time without manual refresh
- Deposit and withdrawal flows write to Convex
- `hooks/useTransactionRealtime.ts` deleted
- No Supabase calls remain in `transaction-store.ts`

---

### Issue #8 — Wire `transactions/new.tsx` confirmation to `collectCash` mutation

**Labels:** `transactions` `ux` `milestone:M3`

**Description**

The "hold-to-confirm" gesture in `app/(app)/transactions/new.tsx` currently calls the Supabase-backed store action. Wire it to the Convex `collectCash` mutation and include terminal approval code metadata once the terminal SDK is available (stub the field for now).

**Affected files**
- `app/(app)/transactions/new.tsx`

**Tasks**

- [ ] Replace store dispatch with `useMutation(api.transactions.collectCash)`
- [ ] Pass `{ customerId, amount, agentId, deviceId, approvalCode: null }` — `approvalCode` is stubbed until Phase 4
- [ ] On success: trigger `expo-haptics` feedback + navigate to `transactions/[id]` receipt
- [ ] On error: show inline error toast, keep form state (do not reset)
- [ ] On offline: push to Zustand pending queue (existing pattern, no change needed)

**Acceptance criteria**
- Hold-to-confirm triggers Convex mutation when online
- Failed mutation shows error without losing entered amount
- Offline transaction queues and syncs on reconnect

---

### Issue #9 — Transaction receipt screen

**Labels:** `transactions` `ux` `milestone:M3`

**Description**

`app/(app)/transactions/[id].tsx` should load the transaction from Convex and offer a "Print Receipt" action that calls the terminal printer (stubbed until Phase 4).

**Affected files**
- `app/(app)/transactions/[id].tsx`

**Tasks**

- [ ] Replace Zustand store lookup with `useQuery(api.transactions.get, { id })`
- [ ] Add "Print Receipt" button (calls `TerminalService.printReceipt(txId)` — stub returning `Promise.resolve()` until Phase 4)
- [ ] Add "Share Receipt" action using `expo-sharing` (generate plain-text receipt)

**Acceptance criteria**
- Receipt screen loads transaction from Convex
- Print button present (stubbed, no crash)

---

## M4 — Agent Management

---

### Issue #10 — Migrate agent store to Convex `users` table

**Labels:** `agents` `milestone:M4`

**Description**

`stores/agent-store.ts` manages sub-agents locally with no Supabase table (the current schema has no `agents` table). Kauri's Convex backend has a proper `users` table with roles. Wire agent CRUD to Convex.

**Affected files**
- `stores/agent-store.ts`
- `app/(app)/agents/index.tsx`
- `app/(app)/agents/add.tsx`
- `app/(app)/agents/[id].tsx`

**Tasks**

- [ ] Replace local agent array with `useQuery(api.users.listByOrg)` (admin-only)
- [ ] Replace `addAgent()` local write → `convex.mutation(api.users.createAgent, { name, phone, role, permissions })`
- [ ] Replace `updateAgentPermissions()` → `convex.mutation(api.users.updatePermissions, { agentId, permissions })`
- [ ] Replace `blockAgent()` → `convex.mutation(api.users.setRole, { agentId, role: "blocked" })`
- [ ] Remove `syncStatus` from agent objects — Convex is the source of truth
- [ ] Keep `stats` fields (clients count, transactions count, collected) as derived Convex queries

**Acceptance criteria**
- Admin sees live agent list from Convex
- New agent persists across devices (not local-only)
- Blocked agent can no longer log in

---

### Issue #11 — Server-side permission enforcement

**Labels:** `security` `agents` `milestone:M4`

**Description**

`hooks/usePermissions.ts` checks permissions from the local Zustand store. This is fine for UI gating but must never be the sole guard for mutations. All Convex mutations must validate `ctx.auth` and the caller's role server-side.

**Affected files**
- `hooks/usePermissions.ts`
- All Convex mutation files in Kauri (`convex/transactions.ts`, `convex/customers.ts`, etc.)

**Tasks**

- [ ] Audit all Convex mutations in Kauri — confirm each reads `ctx.auth` and checks role before writing
- [ ] Add server-side guard to any mutation missing an auth check
- [ ] Update `hooks/usePermissions.ts` comment to make clear it is UI-only — not a security boundary
- [ ] Add integration test: attempt `collectCash` mutation as a `"blocked"` agent → expect rejection

**Acceptance criteria**
- Blocked or unauthorized agent cannot call any write mutation, even via direct API call
- All Convex mutations have auth checks in Kauri backend

---

## M5 — Terminal Integration

---

### Issue #12 — Create unified `TerminalService` JS facade

**Labels:** `terminal` `milestone:M5`

**Description**

Before writing native modules, define the JS interface that the rest of the app will call. This lets all other screens be wired against a stable contract while native modules are developed in parallel.

**New file**
- `modules/terminal/TerminalService.ts`

**Tasks**

- [ ] Define `TerminalService` interface:
  ```ts
  connect(ip: string, port: number): Promise<void>
  doSale(amount: number, currency: string): Promise<{ approvalCode: string }>
  printReceipt(data: ReceiptData): Promise<void>
  getDeviceInfo(): Promise<{ battery: number; signal: number; model: string }>
  disconnect(): Promise<void>
  ```
- [ ] Implement a `MockTerminalService` that resolves all calls with stub data (used in dev and simulator)
- [ ] Export the real or mock implementation based on `__DEV__` / env flag
- [ ] Add `ReceiptData` type covering: `txId`, `agentName`, `clientName`, `amount`, `type`, `date`

**Acceptance criteria**
- `TerminalService.doSale()` callable from `transactions/new.tsx` without crashing in simulator
- Mock implementation returns `{ approvalCode: "MOCK-001" }`

---

### Issue #13 — Native module: PAX A920 (POSLINK SDK)

**Labels:** `terminal` `native` `android` `milestone:M5`

**Description**

Wrap the PAX POSLINK Android SDK in an Expo native module exposing the `TerminalService` interface.

**New files**
- `modules/terminal/PaxModule/index.ts`
- `modules/terminal/PaxModule/android/PaxModule.kt`

**Tasks**

- [ ] Obtain PAX POSLINK Android SDK (`poslink-android-*.aar`) — requires vendor NDA/agreement
- [ ] Create Expo module using `expo-modules-core`
- [ ] Implement `connectTCP(ip, port)` — wraps `POSLinkAndroid.connect()`
- [ ] Implement `doSale(amount, currency)` — wraps `POSLinkAndroid.doSale()`; return approval code
- [ ] Implement `printReceipt(data)` — wraps `POSLinkAndroid.print()`
- [ ] Implement `getDeviceInfo()` — returns battery %, wifi signal, model string
- [ ] Wire into `TerminalService.ts` — use PaxModule when `deviceModel === "PAX_A920"`
- [ ] Test on physical PAX A920 device

**Acceptance criteria**
- `TerminalService.doSale(1000, "XOF")` completes a test sale on PAX A920
- Receipt prints on terminal thermal printer
- `getDeviceInfo()` returns live battery and signal data

**Blockers**
- PAX SDK vendor agreement must be signed before development starts

---

### Issue #14 — Native module: Sunmi P2 SDK

**Labels:** `terminal` `native` `android` `milestone:M5`

**Description**

Wrap the Sunmi Pay SDK in an Expo native module using the same `TerminalService` interface.

**New files**
- `modules/terminal/SunmiModule/index.ts`
- `modules/terminal/SunmiModule/android/SunmiModule.kt`

**Tasks**

- [ ] Add Sunmi Pay SDK dependency (`com.sunmi:sunmipaysdk`) to `android/build.gradle`
- [ ] Implement `bindPayService()` on module init
- [ ] Implement `doTransHttp(params)` — wraps Sunmi payment transaction
- [ ] Implement `getPrinterStatus()` — check paper and printer ready state
- [ ] Implement `printReceipt(data)` using Sunmi's AIDL printer interface
- [ ] Wire into `TerminalService.ts` — use SunmiModule when `deviceModel === "SUNMI_P2"`
- [ ] Test on physical Sunmi P2 device

**Acceptance criteria**
- Same acceptance criteria as Issue #13, on Sunmi P2 hardware

---

### Issue #15 — Terminal management screen

**Labels:** `terminal` `ux` `milestone:M5`

**Description**

Agents need a screen to pair, view status, and manage their assigned terminal. Maps to the `devices` table in Kauri's Convex backend.

**New file**
- `app/(app)/terminal/index.tsx`

**Tasks**

- [ ] Add "Terminal" entry to the bottom tab or settings menu
- [ ] Implement IP scan to discover PAX/Sunmi terminals on local network (`expo-network` + TCP probe on port 8080)
- [ ] On device found: call `api.devices.register({ deviceId, model, agentId, ip })`
- [ ] Display paired terminal card: model name, battery %, last sync timestamp, signal strength
- [ ] Poll `api.devices.getStatus` every 30 seconds when screen is focused
- [ ] Add "Unpair" action: calls `api.devices.unregister`
- [ ] Wire `deviceId` from paired device into transaction store so `collectCash` always includes it

**Acceptance criteria**
- Agent can discover and pair a terminal from the app
- Terminal status (battery, signal) visible on screen
- `deviceId` included in all `collectCash` calls after pairing

---

### Issue #16 — Pass terminal `approvalCode` into `collectCash`

**Labels:** `terminal` `transactions` `milestone:M5`

**Description**

`collectCash` currently accepts a stubbed `approvalCode: null` (Issue #8). Once the terminal SDK is wired, the real approval code returned by `doSale()` must flow into the mutation.

**Affected files**
- `app/(app)/transactions/new.tsx`
- `stores/transaction-store.ts`

**Tasks**

- [ ] In `transactions/new.tsx` confirmation handler: call `TerminalService.doSale(amount, "XOF")` first
- [ ] On terminal approval: extract `approvalCode` from response
- [ ] Pass `approvalCode` into `api.transactions.collectCash` mutation
- [ ] On terminal decline: show decline reason, do NOT submit to Convex
- [ ] Handle terminal timeout (>30s): cancel and show error

**Acceptance criteria**
- Approval code from terminal appears in Convex transaction record
- Declined transactions never written to Convex
- Terminal timeout handled gracefully

---

## M6 — Reconciliation, Reports & Cleanup

---

### Issue #17 — Wire reports screen to Convex reconciliation queries

**Labels:** `reports` `milestone:M6`

**Description**

`app/(app)/reports.tsx` currently aggregates data from the local Zustand store. Replace with Convex queries for authoritative daily and weekly summaries.

**Affected files**
- `app/(app)/reports.tsx`

**Tasks**

- [ ] Replace local aggregation with `useQuery(api.reconciliations.getDailySummary, { agentId, date })`
- [ ] Add weekly summary view: `useQuery(api.reconciliations.getWeeklySummary, { agentId, weekStart })`
- [ ] Add "Export PDF" button using `expo-print` — generates a formatted daily report
- [ ] Add "Submit EOD Reconciliation" button — calls `api.reconciliations.create` mutation
- [ ] Show confirmation dialog before submitting (action is irreversible — totals are locked)

**Acceptance criteria**
- Reports reflect Convex data, not local store
- EOD reconciliation submits and locks daily totals in Convex
- PDF export generates a readable report

---

### Issue #18 — Remove Supabase dependency

**Labels:** `cleanup` `milestone:M6`

**Description**

Once all stores and screens are migrated, remove Supabase entirely from the project.

**Tasks**

- [ ] Confirm zero Supabase imports remain: `grep -r "supabase" app/ stores/ hooks/ lib/`
- [ ] Delete `lib/supabase.ts`
- [ ] Delete `lib/transaction-supabase.ts`
- [ ] Remove `@supabase/supabase-js` from `package.json`
- [ ] Remove `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from `.env`
- [ ] Archive `supabase/schema.sql` to `backup/supabase-schema.sql` (for reference)
- [ ] Run `bun install` and confirm clean build

**Acceptance criteria**
- `grep -r "@supabase" app/ stores/ hooks/ lib/` returns no results
- App builds and passes smoke test without Supabase env vars set

---

### Issue #19 — Strip dev mocks from production builds

**Labels:** `cleanup` `security` `milestone:M6`

**Description**

`__dev__/mocks/` contains hardcoded client, agent, and transaction data for Ouagadougou-area mock profiles. These must not ship in production builds.

**Affected files**
- `__dev__/config.ts`
- `app.json` / `eas.json`

**Tasks**

- [ ] Confirm `__dev__/config.ts` `DEV_MODE` flag gates all mock usage
- [ ] Add `IS_DEV` check using Expo's `Constants.expoConfig.extra` or `process.env.APP_ENV`
- [ ] In `eas.json` production profile: set `APP_ENV=production` — this disables mock data
- [ ] Add a CI check: `grep -r "DEV_MODE" app/` to ensure no mock imports leak into screen files
- [ ] Verify production EAS build boots without mock data loaded

**Acceptance criteria**
- Production EAS build contains no mock client/transaction data
- Dev build still works with `DEV_MODE=true`

---

### Issue #20 — Offline queue hardening: stale entry warning

**Labels:** `offline` `ux` `milestone:M6`

**Description**

`hooks/useNetworkSync.ts` auto-syncs on reconnect. There is no guard against very old pending entries causing silent data issues. Add a warning banner and max queue age policy.

**Affected files**
- `hooks/useNetworkSync.ts`
- `app/(app)/_layout.tsx` (to show persistent banner)

**Tasks**

- [ ] On each app foreground event, check Zustand pending queues for entries older than 8 hours
- [ ] If stale entries found: show a persistent warning banner ("X transactions pending sync — last attempt: Y hours ago")
- [ ] Use `expo-notifications` (local, no network) to fire a background reminder if app is backgrounded with pending queue
- [ ] Add "Force Sync" button on the banner — triggers immediate `syncPendingClients()` + `syncPendingTransactions()`
- [ ] Conflict resolution policy: document that server (`updatedAt`) wins for balance fields; client wins for new records

**Acceptance criteria**
- Banner appears when pending queue contains entries older than 8h
- Local notification fires when app is backgrounded with stale queue
- Force sync button drains queue and dismisses banner

---

## Cross-cutting

---

### Issue #21 — End-to-end smoke test suite

**Labels:** `testing` `milestone:M6`

**Description**

No automated tests exist for the integration. Add a minimal E2E smoke suite covering the critical paths.

**Tasks**

- [ ] Set up Maestro or Detox for E2E testing
- [ ] Write test: Agent login (OTP) → Dashboard loads
- [ ] Write test: Add client → client appears in list
- [ ] Write test: Create deposit → transaction appears in list + balance updates
- [ ] Write test: Offline deposit → reconnect → transaction syncs to Convex
- [ ] Run suite in CI (GitHub Actions) on every PR to `main`

**Acceptance criteria**
- All 4 smoke tests pass in CI
- Offline sync test passes using network toggle in emulator

---

### Issue #22 — Update `README.md` with Convex setup instructions

**Labels:** `docs` `milestone:M6`

**Description**

The current README references Supabase setup. Update it to reflect the Convex backend and new environment variables.

**Tasks**

- [ ] Replace Supabase setup section with Convex project setup steps
- [ ] Add `EXPO_PUBLIC_CONVEX_URL` to the env vars table
- [ ] Remove `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from docs
- [ ] Add terminal SDK setup section (PAX + Sunmi vendor requirements)
- [ ] Add offline mode / dev mock usage notes

**Acceptance criteria**
- A new developer can follow README to get a working local build against Convex

---

## Issue Summary Table

| # | Title | Phase | Labels |
|---|---|---|---|
| 1 | Install and configure Convex React Native SDK | M1 | `setup` |
| 2 | Migrate authentication: OTP + PIN → Convex Auth | M1 | `auth` `breaking` |
| 3 | Secure token storage: PIN → expo-secure-store | M1 | `security` |
| 4 | Map and migrate client store to Convex `customers` | M2 | `data` `clients` |
| 5 | Replace client balance with derived transaction sum | M2 | `data` `clients` |
| 6 | Update KYC flow: bool → status enum | M2 | `kyc` `clients` |
| 7 | Migrate transaction store to Convex | M3 | `data` `transactions` |
| 8 | Wire `transactions/new.tsx` to `collectCash` mutation | M3 | `transactions` `ux` |
| 9 | Transaction receipt screen | M3 | `transactions` `ux` |
| 10 | Migrate agent store to Convex `users` table | M4 | `agents` |
| 11 | Server-side permission enforcement | M4 | `security` `agents` |
| 12 | Create unified `TerminalService` JS facade | M5 | `terminal` |
| 13 | Native module: PAX A920 (POSLINK SDK) | M5 | `terminal` `native` |
| 14 | Native module: Sunmi P2 SDK | M5 | `terminal` `native` |
| 15 | Terminal management screen | M5 | `terminal` `ux` |
| 16 | Pass terminal `approvalCode` into `collectCash` | M5 | `terminal` `transactions` |
| 17 | Wire reports screen to Convex reconciliation queries | M6 | `reports` |
| 18 | Remove Supabase dependency | M6 | `cleanup` |
| 19 | Strip dev mocks from production builds | M6 | `cleanup` `security` |
| 20 | Offline queue hardening: stale entry warning | M6 | `offline` `ux` |
| 21 | End-to-end smoke test suite | M6 | `testing` |
| 22 | Update README with Convex setup instructions | M6 | `docs` |
