// convex/auth.config.ts
export default {
  providers: [
    // Clerk — org/branch admin users
    {
      domain: process.env.VITE_CLERK_ISSUER_DOMAIN,
      applicationID: 'convex',
    },
    // @convex-dev/auth — field agents (Password provider)
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: 'convex',
    },
  ],
}
