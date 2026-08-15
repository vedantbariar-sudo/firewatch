import type { AuthConfig } from "convex/server";

// Freebuff-signed federated tokens (see freebuff web's
// src/lib/vly-convex-jwt.ts) let a signed-in freebuff.com user carry their
// identity into this project without going through local sign-in. customJwt
// is correct for this provider: freebuff's tokens and JWKS both carry a
// `kid` header, which the customJwt validation path requires.
const freebuffIssuer =
  process.env.VLY_CONVEX_AUTH_ISSUER ?? "https://freebuff.com";

// Supabase Auth — Supabase signs asymmetric JWTs (ES256 by default) that Convex
// verifies against the project's JWKS endpoint (no shared secret needed). The
// browser presents the Supabase access token through ConvexProviderWithAuth
// (see src/hooks/use-supabase-auth.ts); this provider is what lets Convex
// accept those tokens and resolve a users-row for the caller.
//
// TODO: replace the placeholder with your Supabase project ref (the subdomain
// in your project URL, e.g. "abcxyz" in https://abcxyz.supabase.co) once you've
// created the project. The ref is public — it's part of your Supabase URL — so
// it's safe to hardcode for the demo. If your project signs JWTs with RSA
// instead of the default elliptic-curve key, change the algorithm to "RS256".
//
// NOTE: this must be a literal (not an env var reference): Convex requires any
// env var referenced in this file to already be set in the deployment, and
// SUPABASE_PROJECT_REF isn't set until you add the keys.
const SUPABASE_PROJECT_REF = "REPLACE_WITH_YOUR_SUPABASE_PROJECT_REF";
const supabaseProvider = {
  type: "customJwt" as const,
  issuer: `https://${SUPABASE_PROJECT_REF}.supabase.co/auth/v1`,
  jwks: `https://${SUPABASE_PROJECT_REF}.supabase.co/auth/v1/.well-known/jwks.json`,
  // Supabase access tokens carry aud: "authenticated".
  applicationID: "authenticated",
  algorithm: "ES256" as const,
};

export default {
  providers: [
    // Standard Convex Auth provider for this project's own sign-in ("Get
    // Started" email/guest, see src/convex/auth.ts). The deployment
    // self-issues JWTs (iss = CONVEX_SITE_URL, no `kid` header) validated
    // via OIDC discovery at `${domain}/.well-known/openid-configuration`,
    // served by auth.addHttpRoutes() in convex/http.ts. Do NOT convert this
    // entry to `type: "customJwt"` — that path rejects tokens without a
    // `kid` header, so sign-in would silently never confirm and RequireAuth
    // would loop back to /auth forever.
    {
      domain: process.env.CONVEX_SITE_URL!,
      applicationID: "convex",
    },
    {
      type: "customJwt",
      issuer: freebuffIssuer,
      jwks: `${freebuffIssuer}/api/web/.well-known/jwks.json`,
      applicationID: "vly-convex",
      algorithm: "RS256",
    },
    supabaseProvider,
  ],
} satisfies AuthConfig;
