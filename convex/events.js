import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/** List events for an organization */
export const listByOrganization = query({
  args: { organization_id: v.id("organizations") },
  handler: async (ctx, { organization_id }) => {
    return await ctx.db
      .query("events")
      .withIndex("by_organization", (q) => q.eq("organization_id", organization_id))
      .order("desc")
      .collect();
  },
});

/** Get event by id */
export const getById = query({
  args: { id: v.id("events") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

/** Get event by id and organization (ownership check) */
export const getByIdAndOrg = query({
  args: { id: v.id("events"), organization_id: v.id("organizations") },
  handler: async (ctx, { id, organization_id }) => {
    const event = await ctx.db.get(id);
    if (!event || event.organization_id !== organization_id) return null;
    return event;
  },
});

/** Get event by download_slug (public) */
export const getByDownloadSlug = query({
  args: { download_slug: v.string() },
  handler: async (ctx, { download_slug }) => {
    return await ctx.db
      .query("events")
      .withIndex("by_download_slug", (q) => q.eq("download_slug", download_slug))
      .unique();
  },
});

/** Create event */
export const create = mutation({
  args: {
    organization_id: v.id("organizations"),
    name: v.string(),
    event_date: v.optional(v.string()),
    download_slug: v.optional(v.string()),
    template_asset_url: v.optional(v.string()),
    template_asset_public_id: v.optional(v.string()),
    template_settings: v.optional(v.any()),
    participant_csv: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("events", args);
    return await ctx.db.get(id);
  },
});

/** Delete event (and its certificates) */
export const remove = mutation({
  args: { id: v.id("events") },
  handler: async (ctx, { id }) => {
    const certs = await ctx.db.query("certificates").withIndex("by_event", (q) => q.eq("event_id", id)).collect();
    for (const cert of certs) {
      await ctx.db.delete(cert._id);
    }
    await ctx.db.delete(id);
  },
});

/** Update download_slug */
export const updateDownloadSlug = mutation({
  args: { id: v.id("events"), organization_id: v.id("organizations"), download_slug: v.union(v.string(), v.null()) },
  handler: async (ctx, { id, organization_id, download_slug }) => {
    const event = await ctx.db.get(id);
    if (!event || event.organization_id !== organization_id) return null;
    await ctx.db.patch(id, { download_slug: download_slug || undefined });
    return await ctx.db.get(id);
  },
});

/** Update persisted wizard/template config for an event */
export const updateTemplateConfig = mutation({
  args: {
    id: v.id("events"),
    organization_id: v.id("organizations"),
    template_asset_url: v.optional(v.union(v.string(), v.null())),
    template_asset_public_id: v.optional(v.union(v.string(), v.null())),
    template_settings: v.optional(v.any()),
    participant_csv: v.optional(v.string()),
  },
  handler: async (ctx, { id, organization_id, template_asset_url, template_asset_public_id, template_settings, participant_csv }) => {
    const event = await ctx.db.get(id);
    if (!event || event.organization_id !== organization_id) return null;

    const patch = {};
    if (template_asset_url !== undefined) {
      patch.template_asset_url = template_asset_url || undefined;
    }
    if (template_asset_public_id !== undefined) {
      patch.template_asset_public_id = template_asset_public_id || undefined;
    }
    if (template_settings !== undefined) {
      patch.template_settings = template_settings;
    }
    if (participant_csv !== undefined) {
      patch.participant_csv = participant_csv;
    }

    await ctx.db.patch(id, patch);
    return await ctx.db.get(id);
  },
});
