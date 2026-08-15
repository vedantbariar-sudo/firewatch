import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // Team log: updates and comments posted by operators against a mock
    // incident id (e.g. "ridge-fire"). `parentId` links a comment to its
    // parent update, so the frontend can render flat threads.
    incidentUpdates: defineTable({
      incidentId: v.string(),
      body: v.string(),
      parentId: v.optional(v.id("incidentUpdates")),
      authorId: v.optional(v.id("users")),
      authorName: v.optional(v.string()),
      kind: v.union(v.literal("system"), v.literal("team")),
      createdAt: v.number(),
    }).index("by_incident", ["incidentId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
