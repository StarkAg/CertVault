import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    challenge: v.string(),
    type: v.string(),
    organization_id: v.optional(v.id("organizations")),
    expires_at: v.number(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("webauthn_challenges", args);
    return await ctx.db.get(id);
  },
});

export const consume = mutation({
  args: {
    challenge: v.string(),
    type: v.string(),
    organization_id: v.optional(v.id("organizations")),
  },
  handler: async (ctx, { challenge, type, organization_id }) => {
    const record = await ctx.db
      .query("webauthn_challenges")
      .withIndex("by_challenge", (q) => q.eq("challenge", challenge))
      .unique();

    if (!record) {
      return null;
    }

    if (record.type !== type) {
      return null;
    }

    if (record.used_at || record.expires_at < Date.now()) {
      return null;
    }

    if (organization_id && record.organization_id !== organization_id) {
      return null;
    }

    await ctx.db.patch(record._id, { used_at: Date.now() });
    return await ctx.db.get(record._id);
  },
});
