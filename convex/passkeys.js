import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listByOrganization = query({
  args: { organization_id: v.id("organizations") },
  handler: async (ctx, { organization_id }) => {
    return await ctx.db
      .query("organization_passkeys")
      .withIndex("by_organization", (q) => q.eq("organization_id", organization_id))
      .collect();
  },
});

export const getByCredentialId = query({
  args: { credential_id: v.string() },
  handler: async (ctx, { credential_id }) => {
    return await ctx.db
      .query("organization_passkeys")
      .withIndex("by_credential_id", (q) => q.eq("credential_id", credential_id))
      .unique();
  },
});

export const create = mutation({
  args: {
    organization_id: v.id("organizations"),
    credential_id: v.string(),
    public_key: v.string(),
    counter: v.number(),
    transports: v.optional(v.array(v.string())),
    device_type: v.optional(v.string()),
    backed_up: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("organization_passkeys", args);
    return await ctx.db.get(id);
  },
});

export const updateCounter = mutation({
  args: {
    credential_id: v.string(),
    counter: v.number(),
    device_type: v.optional(v.string()),
    backed_up: v.optional(v.boolean()),
  },
  handler: async (ctx, { credential_id, ...patch }) => {
    const existing = await ctx.db
      .query("organization_passkeys")
      .withIndex("by_credential_id", (q) => q.eq("credential_id", credential_id))
      .unique();

    if (!existing) {
      return null;
    }

    await ctx.db.patch(existing._id, patch);
    return await ctx.db.get(existing._id);
  },
});
