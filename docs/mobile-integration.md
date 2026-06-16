# Kauri — Mobile App Integration Guide

This document covers everything a mobile app needs to integrate with the Kauri backend (Convex).
It targets **field agent** use cases: authentication, device binding, and data access.

---

## Table of Contents

1. [Overview](#overview)
2. [Convex Client Setup](#convex-client-setup)
3. [Authentication](#authentication)
   - [First-time activation (invite token)](#first-time-activation)
   - [Returning agent sign-in](#returning-agent-sign-in)
   - [User profile](#user-profile)
4. [Device Binding](#device-binding)
   - [QR code scan](#qr-code-scan)
   - [PIN entry](#pin-entry)
   - [Expiry and regeneration](#expiry-and-regeneration)
5. [Roles & Permissions](#roles--permissions)
6. [Data Model Reference](#data-model-reference)
7. [API Reference](#api-reference)
8. [Error Reference](#error-reference)

---

## Overview

The Kauri backend is built on [Convex](https://convex.dev). The mobile app communicates exclusively
via the Convex SDK — no REST API.

```
Organization
  └── Branch
        ├── Users (agents)
        │     └── Device (TPE terminal, 1:1)
        ├── Customers
        └── Transactions
```

Every record is scoped to a **branch** (`branchId`). The field agent's branch ID is available
after login via `users.currentUser` and must be used to filter all subsequent queries.

---

## Convex Client Setup

Install the Convex SDK for your mobile platform and create a client pointed at the deployment URL.

```typescript
import { ConvexReactClient } from 'convex/react'   // React Native
// or
import { ConvexClient } from 'convex/browser'       // Plain JS / other

const convex = new ConvexReactClient(process.env.CONVEX_URL)
// CONVEX_URL = value from the Kauri backend deployment (ask your admin)
```

Wrap your app with `ConvexProvider` and `ConvexAuthProvider`:

```tsx
<ConvexProvider client={convex}>
  <ConvexAuthProvider>
    <App />
  </ConvexAuthProvider>
</ConvexProvider>
```

---

## Authentication

Kauri uses **Convex Auth** with email/password. There are two flows: first-time activation (requires
an invite token) and returning sign-in.

### First-time Activation

New agents receive an invite link from their branch manager:

```
https://<app-url>/connexion?token=<invite-token>
```

**Step 1 — Sign up with email + password**

```typescript
import { useAuthActions } from '@convex-dev/auth/react'

const { signIn } = useAuthActions()

await signIn('password', {
  flow: 'signUp',
  email: 'agent@example.com',
  password: 'chosen-password',
})
```

**Step 2 — Link the invite token** (call immediately after `signIn` resolves)

```typescript
import { useMutation } from 'convex/react'
import { api } from '../convex/_generated/api'

const linkAccount = useMutation(api.users.linkAgentAccount)

await linkAccount({ inviteToken: '<raw-token-from-url>' })
```

This call:
- Hashes the raw token and matches it against the stored hash in the database
- Transfers the agent's pre-assigned role to the new auth session
- Burns the invite token (one-time use; subsequent calls with the same token fail)

If the invite token is missing or expired, throw a user-facing error and ask the agent to contact
their manager.

### Returning Agent Sign-in

```typescript
await signIn('password', {
  flow: 'signIn',
  email: 'agent@example.com',
  password: 'password',
})

// No invite token needed; call without args
await linkAccount({})
```

`linkAgentAccount` with no `inviteToken` is a no-op for already-linked accounts — it's safe to
always call it post-login.

### User Profile

After auth resolves, fetch the full profile once and cache it for the session:

```typescript
import { useQuery } from 'convex/react'

const me = useQuery(api.users.currentUser)
```

**Response shape:**

```typescript
{
  _id: string,
  fullName: string,
  email: string,
  phoneNumber: string,
  status: 'active' | 'suspended',
  role: 'admin' | 'supervisor' | 'field_agent' | 'accountant' | 'it_admin',
  branchId: string,         // use this for all branch-scoped queries
  tenantId: string,         // alias for branchId
  branch: {
    _id: string,
    name: string,
    location: string,
    code: string,
  },
  organization: {
    _id: string,
    name: string,
    country: string,
    currency: string,       // e.g. "XOF"
    status: 'active' | 'suspended',
  },
  device: DeviceObject | null,  // null if no device bound yet
}
```

If `me.status === 'suspended'`, block access and display an appropriate message.
If `me.device === null`, prompt the agent to bind their device before collecting transactions.

---

## Device Binding

Each field agent must bind a physical TPE terminal to their account. Binding is initiated by a
manager on the admin dashboard, which generates a 6-digit PIN and a QR code valid for **10 minutes**.

The mobile app receives the credentials via one of two input methods.

### QR Code Scan

The QR code encodes a JSON payload:

```json
{ "token": "<uuid>", "deviceSerial": "<serial>", "branchId": "<branch-id>" }
```

**Validate before claiming:**

```typescript
const payload = JSON.parse(qrValue)

if (payload.branchId !== me.tenantId) {
  throw new Error('Ce QR code appartient à une autre agence.')
}
```

**Claim the device:**

```typescript
const claimByToken = useMutation(api.devices.claimDeviceByToken)

const { deviceId } = await claimByToken({ token: payload.token })
```

### PIN Entry

Display a 6-digit numeric input. Strip any formatting (dashes, spaces) before sending.

```typescript
const claimByPin = useMutation(api.devices.claimDeviceByPin)

// pin must be exactly 6 numeric characters, e.g. "042817"
const { deviceId } = await claimByPin({ pin: pin.replace(/\D/g, '') })
```

### After a Successful Claim

Both mutations return `{ deviceId }`. Re-fetch (or subscribe to) `users.currentUser` — the
`device` field will now be populated. Use this as confirmation and dismiss the binding UI.

### Expiry and Regeneration

Binding credentials expire 10 minutes after generation. Expired credentials return:

- PIN: `"PIN has expired"`
- Token: `"Token has expired"`

The agent must ask their manager to regenerate credentials from the admin dashboard. The app
should surface a clear call-to-action:

> "Ce code a expiré. Demandez à votre superviseur de générer un nouveau code."

---

## Roles & Permissions

Roles control which actions an agent can take. Check `me.role` from `currentUser`.

| Role | Can collect transactions | Can register customers | Can approve disbursements | Can bind devices |
|------|:---:|:---:|:---:|:---:|
| `field_agent` | ✓ | ✓ (prospect) | — | — |
| `supervisor` | ✓ | ✓ | ✓ | ✓ |
| `accountant` | — | — | ✓ (execute) | — |
| `admin` | ✓ | ✓ | ✓ | ✓ |
| `it_admin` | — | — | — | ✓ |

Hide or disable UI elements based on role. The server enforces the same rules — the mobile app
check is only for UX, not security.

---

## Data Model Reference

### `users` table

| Field | Type | Notes |
|-------|------|-------|
| `_id` | `Id<'users'>` | Convex document ID |
| `fullName` | `string` | Display name |
| `email` | `string` | Unique within branch |
| `phoneNumber` | `string` | Unique within branch |
| `tokenIdentifier` | `string` | Auth subject (internal, don't display) |
| `branchId` | `Id<'branches'>` | Tenant scope key |
| `status` | `'active' \| 'suspended'` | Account state |

### `devices` table

| Field | Type | Notes |
|-------|------|-------|
| `_id` | `Id<'devices'>` | Convex document ID |
| `serialNumber` | `string` | Physical TPE serial |
| `model` | `string` | Device model name |
| `branchId` | `Id<'branches'>` | Owning branch |
| `assignedTo` | `Id<'users'> \| undefined` | Currently bound agent |
| `status` | `'active' \| 'maintenance' \| 'lost'` | Device state |
| `lastSync` | `number` | Unix ms, last sync timestamp |
| `batteryPct` | `number \| undefined` | 0–100 |
| `signalLevel` | `number \| undefined` | 0–5 bars |
| `queuedCount` | `number \| undefined` | Pending offline transactions |

---

## API Reference

### `api.users.currentUser`

**Type:** query  
**Args:** none  
**Auth:** any authenticated user  
**Returns:** full user profile (see [User Profile](#user-profile)) or `null` if unauthenticated

---

### `api.users.linkAgentAccount`

**Type:** mutation  
**Args:** `{ inviteToken?: string }`  
**Auth:** must have an active Convex Auth session  
**Returns:** `Id<'users'>`  
**Notes:** call after every `signIn`. No-op for already-linked accounts.

---

### `api.agents.getById`

**Type:** query  
**Args:** `{ userId: Id<'users'> }`  
**Auth:** self or same-branch user with `devices:bind` permission  
**Returns:** agent object with device attached, or `null`

---

### `api.devices.claimDeviceByPin`

**Type:** mutation  
**Args:** `{ pin: string }` — exactly 6 digits  
**Auth:** authenticated agent  
**Returns:** `{ deviceId: Id<'devices'> }`  
**Errors:** `"Invalid PIN"`, `"PIN has expired"`, `"Device is already assigned"`, `"Unauthorized: device does not belong to your branch"`

---

### `api.devices.claimDeviceByToken`

**Type:** mutation  
**Args:** `{ token: string }` — UUID from QR payload  
**Auth:** authenticated agent  
**Returns:** `{ deviceId: Id<'devices'> }`  
**Errors:** `"Invalid token"`, `"Token has expired"`, `"Device is already assigned"`, `"Unauthorized: device does not belong to your branch"`

---

## Error Reference

| Server error message | User-facing message (FR) | Suggested action |
|---|---|---|
| `"Invalid PIN"` | Code invalide. Vérifiez les 6 chiffres. | Ask agent to re-enter |
| `"PIN has expired"` | Code expiré. | Ask manager for new credentials |
| `"Invalid token"` | QR code invalide. | Rescan or switch to PIN |
| `"Token has expired"` | QR code expiré. | Ask manager for new credentials |
| `"Device is already assigned"` | Cet appareil est déjà lié à un agent. | Contact IT admin |
| `"Unauthorized: device does not belong to your branch"` | Appareil hors agence. | QR code from wrong branch |
| `"User is suspended"` | Compte suspendu. Contactez votre responsable. | Block all access |
| `ConvexError` (auth) | Session expirée. Veuillez vous reconnecter. | Redirect to login |

Network errors (no connection) should display a persistent offline banner. Queue mutations locally
and replay when the connection is restored — Convex's optimistic update system supports this
out of the box when using `useMutation`.
