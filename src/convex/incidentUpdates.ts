import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";

/**
 * Incident operations log — team updates and comments attached to a mock
 * incident id (e.g. "ridge-fire"). Seeded with system entries so every
 * incident brief opens with context; operators add their own updates on top.
 */

export const list = query({
  args: { incidentId: v.string() },
  handler: async (ctx, { incidentId }) => {
    return await ctx.db
      .query("incidentUpdates")
      .withIndex("by_incident", (q) => q.eq("incidentId", incidentId))
      .order("desc")
      .collect();
  },
});

export const post = mutation({
  args: {
    incidentId: v.string(),
    body: v.string(),
    parentId: v.optional(v.id("incidentUpdates")),
  },
  handler: async (ctx, { incidentId, body, parentId }) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("You must be signed in to post an update.");
    }
    const trimmed = body.trim();
    if (trimmed.length === 0) {
      throw new Error("Update cannot be empty.");
    }
    if (trimmed.length > 2000) {
      throw new Error("Update is too long (2,000 characters max).");
    }
    await ctx.db.insert("incidentUpdates", {
      incidentId,
      body: trimmed,
      parentId,
      authorId: user._id,
      authorName: user.name ?? user.email ?? "Team member",
      kind: "team",
      createdAt: Date.now(),
    });
  },
});

/** Idempotently seed system log entries for an incident (safe to call often). */
export const seed = mutation({
  args: { incidentId: v.string() },
  handler: async (ctx, { incidentId }) => {
    const existing = await ctx.db
      .query("incidentUpdates")
      .withIndex("by_incident", (q) => q.eq("incidentId", incidentId))
      .first();
    if (existing) {
      return;
    }
    const seeds: { body: string; minutesAgo: number }[] = [
      {
        body: `Incident created — initial perimeter loaded from satellite thermal pass (VIIRS). ${incidentId === "ridge-fire" ? "Type 2 incident; IC requesting Type 1 team." : "Perimeter confirmed by aerial reconnaissance."}`,
        minutesAgo: 240,
      },
      {
        body: "First spread model run complete. Risk zones published to the operations map; evacuation routes validated with local law enforcement.",
        minutesAgo: 180,
      },
      {
        body: "Shelter status confirmed with Red Cross. Occupancy and capacity updated on the response board.",
        minutesAgo: 120,
      },
      {
        body: "Weather briefing: winds trending northeast at 30–45 km/h. Model re-run scheduled at the top of each hour.",
        minutesAgo: 60,
      },
    ];
    for (const seedEntry of seeds) {
      await ctx.db.insert("incidentUpdates", {
        incidentId,
        body: seedEntry.body,
        kind: "system",
        createdAt: Date.now() - seedEntry.minutesAgo * 60_000,
      });
    }
  },
});
