import { ConvexReactClient } from "convex/react";

/**
 * Shared Convex client. The app shell (main.tsx) and the service layer
 * (src/lib/api.ts, for server-side proxy calls like the FIRMS hotspots action)
 * use the same instance so auth state and connections aren't duplicated.
 */
export const convex = new ConvexReactClient(
  import.meta.env.VITE_CONVEX_URL as string,
);
