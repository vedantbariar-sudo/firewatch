import { getAuthUserId } from "@convex-dev/auth/server";
import { sha256 } from "@oslojs/crypto/sha2";
import { encodeHexLowerCase } from "@oslojs/encoding";
import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";

/**
 * Get the current signed in user. Returns null if the user is not signed in.
 * Usage: const signedInUser = await ctx.runQuery(api.authHelpers.currentUser);
 * THIS FUNCTION IS READ-ONLY. DO NOT MODIFY.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);

    if (user === null) {
      return null;
    }

    return user;
  },
});

/**
 * Use this function internally to get the current user data. Remember to handle the null user case.
 * @param ctx
 * @returns
 */
export const getCurrentUser = async (ctx: QueryCtx) => {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    return null;
  }
  return await ctx.db.get(userId);
};

/**
 * Delete Convex Auth's failed-attempt counter for an email address.
 *
 * Convex Auth rate-limits code verification per identifier (10 failed
 * attempts per hour by default). Once the counter is exhausted, even a
 * *correct* code is rejected with "Could not verify code". The email OTP
 * provider calls this right before emailing a fresh code, so a legitimate
 * user is never stuck behind earlier failed attempts. Deliberate demo
 * tradeoff: the brute-force limiter only applies between code requests.
 */
export const resetSignInAttempts = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const limit = await ctx.db
      .query("authRateLimits")
      .withIndex("identifier", (q) => q.eq("identifier", email))
      .unique();
    if (limit !== null) {
      await ctx.db.delete(limit._id);
    }
  },
});

/**
 * Record the raw OTP code issued for an email so the auth page can show it in
 * demo mode (see getOtpDemoCode). Replaces any previously pending code.
 */
export const storePendingOtpCode = mutation({
  args: { email: v.string(), code: v.string(), expiresAt: v.number() },
  handler: async (ctx, { email, code, expiresAt }) => {
    const existing = await ctx.db
      .query("pendingOtpCodes")
      .withIndex("email", (q) => q.eq("email", email))
      .collect();
    for (const row of existing) {
      await ctx.db.delete(row._id);
    }
    await ctx.db.insert("pendingOtpCodes", { email, code, expiresAt });
  },
});

/**
 * Demo-only: return the most recent OTP code for an email so the auth page
 * can display it when email delivery is unavailable. This exposes the raw
 * code to any caller — remove for production.
 *
 * The code is only returned while Convex Auth's live verification row still
 * exists. That row is deleted the moment the code is used (or replaced by a
 * resend), so a consumed code can never linger in the UI and fail with
 * "already been used" — the demo box simply disappears until a fresh code is
 * requested.
 */
export const getOtpDemoCode = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const pending = await ctx.db
      .query("pendingOtpCodes")
      .withIndex("email", (q) => q.eq("email", email))
      .order("desc")
      .first();
    if (pending === null || pending.expiresAt < Date.now()) {
      return null;
    }
    // Hash the pending code the same way Convex Auth does and check the live
    // verification row still exists and belongs to this email.
    const hash = encodeHexLowerCase(
      sha256(new TextEncoder().encode(pending.code)),
    );
    const live = await ctx.db
      .query("authVerificationCodes")
      .withIndex("code", (q) => q.eq("code", hash))
      .unique();
    if (
      live === null ||
      live.emailVerified !== email ||
      live.expirationTime < Date.now()
    ) {
      return null;
    }
    return { code: pending.code, expiresAt: pending.expiresAt };
  },
});
