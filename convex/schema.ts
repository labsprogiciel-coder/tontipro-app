// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  organizations: defineTable({
    name: v.string(),
    country: v.string(),
    currency: v.string(),
    licenseNumber: v.string(),
    status: v.union(v.literal("active"), v.literal("suspended")),
    logoUrl: v.optional(v.string()),
    slug: v.optional(v.string()),
  })
    .index("by_country", ["country"])
    .index("by_slug", ["slug"]),

  branches: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    location: v.string(),
    code: v.string(),
  })
    .index("by_code", ["code"])
    .index("by_organization", ["organizationId"]),

  teams: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    parentTeamId: v.optional(v.id("teams")),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_slug", ["organizationId", "slug"])
    .index("by_parent", ["parentTeamId"]),

  invitations: defineTable({
    organizationId: v.id("organizations"),
    inviteeIdentifier: v.string(),
    identifierType: v.optional(v.string()),
    role: v.string(),
    teamId: v.optional(v.id("teams")),
    inviterId: v.id("users"),
    inviterName: v.optional(v.string()),
    message: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("declined"),
      v.literal("cancelled"),
      v.literal("expired"),
    ),
    expiresAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_status", ["organizationId", "status"])
    .index("by_invitee_identifier_and_status", ["inviteeIdentifier", "status"])
    .index("by_org_invitee_and_status", [
      "organizationId",
      "inviteeIdentifier",
      "status",
    ])
    .index("by_organization_and_user", ["organizationId", "inviterId"])
    .index("by_team_and_user", ["teamId", "inviterId"]),

  members: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    role: v.string(),
    status: v.optional(v.union(v.literal("active"), v.literal("suspended"))),
    joinedAt: v.optional(v.number()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_user", ["userId"])
    .index("by_organization_and_user", ["organizationId", "userId"]),

  teamMembers: defineTable({
    teamId: v.id("teams"),
    userId: v.id("users"),
    role: v.string(),
  })
    .index("by_team", ["teamId"])
    .index("by_user", ["userId"])
    .index("by_team_and_user", ["teamId", "userId"]),

  users: defineTable({
    fullName: v.string(),
  email: v.string(),
  phoneNumber: v.string(),
  tokenIdentifier: v.string(),
  branchId: v.id("branches"),
  status: v.union(
    v.literal("active"),
    v.literal("suspended"),
    v.literal("invited"),
  ),
  mustChangePassword: v.optional(v.boolean()),
  passwordSetAt: v.optional(v.number()),
  failedLoginAttempts: v.optional(v.number()),
  lockedUntil: v.optional(v.number()),
  temporaryPassword: v.optional(v.string()),
  temporaryPasswordExpiresAt: v.optional(v.number()),
  activationAttempts: v.optional(v.number()),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_email", ["email"])
    .index("by_phone", ["phoneNumber"])
    .index("by_branch", ["branchId"]),

  customers: defineTable({
    fullName: v.string(),
    phoneNumber: v.string(),
    idNumber: v.optional(v.string()),
    organizationId: v.id("organizations"), // ← ajouté
    branchId: v.id("branches"),
    onboardedBy: v.id("users"),
    status: v.union(
      v.literal("prospect"),
      v.literal("verified"),
      v.literal("rejected"),
    ),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    balance: v.optional(v.number()),
  })
    .index("by_phone", ["phoneNumber"])
    .index("by_status", ["status"])
    .index("by_branch", ["branchId"])
    .index("by_branch_status", ["branchId", "status"])
    .index("by_id_number", ["idNumber"])
    .index("by_organization_phone", ["organizationId", "phoneNumber"])
    .index("by_organization_id_number", ["organizationId", "idNumber"]),

  devices: defineTable({
    serialNumber: v.string(),
    model: v.string(),
    brand: v.optional(v.string()),
    branchId: v.id("branches"),
    assignedTo: v.optional(v.id("users")),
    status: v.union(
      v.literal("active"),
      v.literal("maintenance"),
      v.literal("lost"),
    ),
    lastSync: v.number(),
    batteryPct: v.optional(v.number()),
    signalLevel: v.optional(v.number()),
    queuedCount: v.optional(v.number()),
    registrationLocation: v.optional(
      v.object({
        latitude: v.number(),
        longitude: v.number(),
        accuracy: v.optional(v.number()),
        timestamp: v.number(),
      }),
    ),
    registrationDate: v.optional(v.number()),
    bindingPin: v.optional(v.string()), // 6-digit numeric string
    bindingPinExpiry: v.optional(v.number()), // Unix ms — TTL 10 minutes
    bindingToken: v.optional(v.string()), // UUID embedded in QR payload
    bindingTokenExpiry: v.optional(v.number()), // Unix ms — TTL 10 minutes
  })
    .index("by_serial", ["serialNumber"])
    .index("by_branch", ["branchId"])
    .index("by_assigned_to", ["assignedTo"])
    .index("by_binding_pin", ["bindingPin"])
    .index("by_binding_token", ["bindingToken"]),

  deviceRegistrations: defineTable({
    branchId: v.id("branches"),
    token: v.string(),
    pin: v.string(),
    expiresAt: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("expired"),
    ),
    deviceId: v.optional(v.id("devices")),
  })
    .index("by_token", ["token"])
    .index("by_pin", ["pin"])
    .index("by_branch", ["branchId"])
    .index("by_status", ["status"]),

  transactions: defineTable({
    amount: v.number(),
    currency: v.string(),
    customerId: v.id("customers"),
    agentId: v.id("users"),
    branchId: v.id("branches"),
    tpeId: v.string(),
    type: v.union(v.literal("deposit"), v.literal("withdrawal")),
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("reversed"),
    ),
    reversalReason: v.optional(v.string()),
    reversedBy: v.optional(v.id("users")),
    timestamp: v.number(),
  })
    .index("by_agent_date", ["agentId"])
    .index("by_branch", ["branchId"])
    .index("by_branch_timestamp", ["branchId", "timestamp"])
    .index("by_customer", ["customerId", "status"]),

  disbursements: defineTable({
    amount: v.number(),
    customerId: v.id("customers"),
    branchId: v.id("branches"),
    initiatedBy: v.id("users"),
    approvedBy: v.optional(v.id("users")),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("executed"),
      v.literal("rejected"),
    ),
    timestamp: v.number(),
    payoutMethod: v.union(v.literal("cash"), v.literal("mobile_money")),
    transactionId: v.optional(v.string()),
    rejectionReason: v.optional(v.string()),
    rejectedBy: v.optional(v.id("users")),
  }).index("by_status", ["status"]),

  reconciliations: defineTable({
    agentId: v.id("users"),
    branchId: v.id("branches"),
    verifiedBy: v.id("users"),
    date: v.string(),
    systemExpectedAmount: v.number(),
    physicalCashReceived: v.number(),
    variance: v.number(),
    status: v.union(
      v.literal("settled"),
      v.literal("discrepancy"),
      v.literal("pending"),
    ),
    timestamp: v.number(),
    notes: v.optional(v.string()),
  })
    .index("by_branch_status", ["branchId", "status"])
    .index("by_branch_date", ["branchId", "date"])
    .index("by_agent_date", ["agentId", "date"]),

  products: defineTable({
    organizationId: v.id("organizations"),
    code: v.string(),
    name: v.string(),
    family: v.union(
      v.literal("epargne"),
      v.literal("credit"),
      v.literal("tontine"),
      v.literal("assurance"),
    ),
    summary: v.string(),
    status: v.union(
      v.literal("actif"),
      v.literal("brouillon"),
      v.literal("archive"),
    ),
    rate: v.number(),
    durationMin: v.number(),
    durationMax: v.number(),
    minDeposit: v.number(),
    maxBalance: v.number(),
    fees: v.number(),
    feesUnit: v.union(v.literal("FCFA"), v.literal("%")),
    graceDays: v.number(),
    kycLevel: v.union(
      v.literal("Allégée"),
      v.literal("Standard"),
      v.literal("Renforcée"),
    ),
    targetSegments: v.array(v.string()),
    branchCodes: v.array(v.string()),
  })
    .index("by_org", ["organizationId"])
    .index("by_status", ["organizationId", "status"]),

  savingsGoals: defineTable({
    customerId: v.id("customers"),
    branchId: v.id("branches"),
    agentId: v.id("users"),
    category: v.string(),
    productCode: v.string(),
    targetAmount: v.number(),
    deadline: v.string(),
    status: v.union(
      v.literal("encours"),
      v.literal("atteint"),
      v.literal("enretard"),
      v.literal("enpause"),
    ),
    createdAt: v.number(),
  })
    .index("by_customer", ["customerId", "status"])
    .index("by_branch_status", ["branchId", "status"])
    .index("by_agent", ["agentId"]),

  // Tracks each attempt to deliver an agent's temporary password (WhatsApp
  // first, SMS as fallback). One row per attempt — a single credential send
  // can produce two rows (whatsapp then sms) if the fallback triggers.
  credentialDeliveries: defineTable({
    userId: v.id("users"),
    branchId: v.id("branches"),
    phoneNumber: v.string(),
    channel: v.union(v.literal("whatsapp"), v.literal("sms")),
    twilioSid: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("undelivered"),
      v.literal("failed"),
    ),
    errorCode: v.optional(v.string()),
    fallbackTriggered: v.optional(v.boolean()),
    createdAt: v.number(),
  })
    .index("by_twilio_sid", ["twilioSid"])
    .index("by_user", ["userId"])
    .index("by_phone", ["phoneNumber"]),
});
