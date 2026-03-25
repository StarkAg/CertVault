import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/** Get organization by email (for login) */
export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("organizations")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
  },
});

/** Get organization by id */
export const getById = query({
  args: { id: v.id("organizations") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

/** Create organization (signup) */
export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    email: v.string(),
    password_hash: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("organizations", args);
    return await ctx.db.get(id);
  },
});

/** Update per-organization Gmail sender config */
export const updateMailerConfig = mutation({
  args: {
    id: v.id("organizations"),
    mailer_email: v.optional(v.string()),
    mailer_app_password: v.optional(v.string()),
    mailer_from_name: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...patch }) => {
    await ctx.db.patch(id, patch);
    return await ctx.db.get(id);
  },
});
