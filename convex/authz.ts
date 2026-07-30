// convex/authz.ts
// Stub — the real implementation lives in the Kauri backend repo.
// This file exists only so that convex/users.ts compiles locally
// and `npx convex codegen` can produce the _generated/ API types.

export const authz = {
  withTenant(_branchId: any) {
    return {
      getUserRoles: async (_ctx: any, _subject: string) => [] as any[],
      assignRole: async (_ctx: any, _subject: string, _role: string) => {},
      removeRole: async (_ctx: any, _subject: string, _role: string) => {},
      require: async (_ctx: any, _subject: string, _permission: string) => {
        // Stub: always allows — real authz lives in Kauri backend
      },
      can: async (_ctx: any, _subject: string, _permission: string) => {
        // Stub: always allows — real authz lives in Kauri backend
        return true;
      },
    };
  },
};
