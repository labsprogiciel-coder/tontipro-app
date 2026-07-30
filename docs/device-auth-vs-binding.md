# Device Auth vs Device Binding

Two concepts that are easy to conflate because they both involve devices and security credentials.
They solve different problems, involve different actors, and happen at different times.

---

## Quick summary

|                       | Device Auth                  | Device Binding                       |
| --------------------- | ---------------------------- | ------------------------------------ |
| **Question answered** | Who are you?                 | Which hardware is yours?             |
| **Actor**             | Field agent                  | Manager (generates) + Agent (claims) |
| **Frequency**         | Every session                | Once per device assignment           |
| **Mechanism**         | Clerk JWT                    | 6-digit PIN or QR token              |
| **Expires**           | Session lifetime             | 10 minutes                           |
| **Result**            | Authenticated Convex session | `device.assignedTo` set in DB        |

---

## Device Auth — who can log in

Device auth is the standard login flow. An agent opens the TPE app and authenticates with their
credentials. Kauri validates the resulting JWT via the Clerk provider configured in
`convex/auth.config.ts`.

Once authenticated, every Convex query and mutation the app calls runs under that agent's identity.
The server reads `ctx.auth.getUserIdentity()` and looks up the corresponding user record to enforce
branch-level access control.

**Auth is a prerequisite for everything else.** No unauthenticated call to any Convex function
succeeds — the server throws immediately.

---

## Device Binding — which physical terminal belongs to which agent

Binding is a one-time provisioning step that links a `devices` record (the TPE's database entry) to
a specific agent's user record. It does not create or replace a login session.

### Why binding exists separately from auth

An agent can be authenticated without a bound device — for example, on their first day, or after
their terminal is lost and replaced. The app checks `me.device` after login; if it is `null`, the
agent must complete binding before collecting transactions.

### The binding flow

```
Manager (dashboard)                     Agent (TPE app)
──────────────────                      ───────────────
1. Opens BindDeviceDrawer
2. Picks an unassigned TPE
3. Calls generateBindingCredentials
   → PIN + token stored on device record
   → Both expire in 10 min
4. Shows QR code / reads PIN to agent  →  5. Scans QR (claimDeviceByToken)
                                              or types PIN (claimDeviceByPin)
                                          6. Server validates credentials,
                                             sets device.assignedTo = caller._id,
                                             clears PIN + token from DB
```

Both claim mutations require the caller to be authenticated — binding cannot happen before auth.

### Branch isolation

The server enforces that the device and the claiming agent belong to the same branch. An agent
cannot accidentally (or intentionally) claim a device registered to a different branch, even if
they somehow obtain the credentials.

---

## How they interact

```
Agent opens app
      │
      ▼
  [AUTH]  ←── Clerk JWT validated by Convex
      │
      ├── me.device != null ──► normal operation
      │
      └── me.device == null ──► [BINDING REQUIRED]
                                      │
                            Manager generates PIN/QR
                                      │
                            Agent scans QR or enters PIN
                                      │
                            claimDeviceByToken / claimDeviceByPin
                                      │
                                 me.device populated
                                      │
                                normal operation
```

Auth establishes _identity_. Binding establishes _which hardware_ that identity operates on.
Both must be complete before an agent can record transactions.

---

## Relevant source files

| File                                | What it contains                                                                       |
| ----------------------------------- | -------------------------------------------------------------------------------------- |
| `convex/auth.config.ts`             | Trusted JWT issuers (Clerk)                                                            |
| `convex/auth.ts`                    | Convex Auth provider setup                                                             |
| `convex/devices.ts`                 | `generateBindingCredentials`, `claimDeviceByPin`, `claimDeviceByToken`, `unbindDevice` |
| `src/pages/BindDeviceDrawer.jsx`    | Manager UI — device picker, QR display, countdown                                      |
| `src/components/AddDeviceModal.jsx` | Manager UI — register a new physical TPE in the branch                                 |

For the mobile app's perspective on both flows, see `docs/mobile-integration.md`.
