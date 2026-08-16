import { getAuthUserId } from "@convex-dev/auth/server";
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
