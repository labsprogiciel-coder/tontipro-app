// convex/authz.ts
import { Authz, definePermissions, defineRoles } from '@djpanda/convex-authz'
import { components } from './_generated/api'

// Step 1: Define specific functional permissions
// This makes it easy to add "Supervisor PIN" overrides later
const permissions = definePermissions({
  transactions: {
    collect: true, // Ability to log a new cash deposit
    view_ledger: true, // View personal daily collection history
    reverse: true, // Critical: Ability to void a transaction
    audit: true, // View all transactions across the branch
  },
  kyc: {
    register: true, // Onboard new clients in the field
    validate: true, // Verify client documents (Back-office)
  },
  reconciliation: {
    liquidate: true, // Confirming physical cash-drop from Agent to Branch
  },
  customers: {
    create_prospect: true, // Field onboarding (Draft mode)
    verify_identity: true, // KYC Approval
    edit_sensitive: true, // Changing phone numbers/bank details
    view: true, // View customer details (non-sensitive)
  },
  disbursements: {
    request: true, // Agent initiates a loan payout
    approve: true, // Manager authorizes the funds release
    execute: true, // System/Accountant triggers the final transfer
  },
  devices: {
    bind: true, // Linking a specific TPE serial number to an agent
    create: true, // Register a new TPE in the branch inventory
  },
  products: {
    manage: true, // Create or update product definitions (supervisor/admin only)
  },
})

// Step 2: Define Roles with Inheritance
const roles = defineRoles(permissions, {
  // Field-based role
  field_agent: {
    transactions: ['collect', 'view_ledger'],
    customers: ['create_prospect', 'view'], // Can onboard but not verify
    disbursements: ['request'],
  },

  // Manager-level role
  supervisor: {
    includes: ['field_agent'], // Inherits collection & registration
    transactions: ['collect', 'view_ledger', 'reverse', 'audit'],
    kyc: ['validate'],
    reconciliation: ['liquidate'],
    customers: ['verify_identity', 'edit_sensitive', 'view'],
    disbursements: ['approve'],
    products: ['manage'],
    devices: ['bind', 'create'],
  },

  // Specialized back-office role
  accountant: {
    transactions: ['audit'],
    reconciliation: ['liquidate'],
    // Only the accountant or a system-level role should execute the money move
    disbursements: ['execute'],
    customers: ['verify_identity', 'view'],
  },

  // Full-access role — includes all operational and back-office permissions.
  // Assign to org owners and platform administrators.
  admin: {
    includes: ['supervisor'], // all field + manager permissions
    kyc: ['register', 'validate'],
    disbursements: ['request', 'approve', 'execute'],
    devices: ['bind', 'create'],
  },

  // System management
  it_admin: {
    devices: ['bind', 'create'],
    // Usually IT shouldn't have 'collect' or 'reverse' permissions (Separation of Duties)
  },
})

// Step 3: Create the base client.
// tenantId MUST be overridden per-request via authz.withTenant(user.branchId).
// Never call authz.require / authz.can directly — always go through withTenant first.
export const authz = new Authz(components.authz, {
  permissions,
  roles,
  tenantId: '__unscoped__',
})
