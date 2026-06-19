// lib/convex.ts
import { ConvexReactClient } from "convex/react";

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL!;
if (!convexUrl) {
  console.warn("[Convex] Missing EXPO_PUBLIC_CONVEX_URL in .env");
}

export const convex = new ConvexReactClient(convexUrl);
