import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/** List certificates for an event */
export const listByEvent = query({
  args: { event_id: v.id("events") },
  handler: async (ctx, { event_id }) => {
    return await ctx.db
      .query("certificates")
      .withIndex("by_event", (q) => q.eq("event_id", event_id))
      .order("desc")
      .collect();
  },
});

/** Get certificate by certificate_id (public ID like CV-2026-XXX) */
export const getByCertificateId = query({
  args: { certificate_id: v.string() },
  handler: async (ctx, { certificate_id }) => {
    return await ctx.db
      .query("certificates")
      .withIndex("by_certificate_id", (q) => q.eq("certificate_id", certificate_id))
      .unique();
  },
});

/** Get certificate by id (Convex _id) */
export const getById = query({
  args: { id: v.id("certificates") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

/** Count certificates by event */
export const countByEvent = query({
  args: { event_id: v.id("events") },
  handler: async (ctx, { event_id }) => {
    return (await ctx.db.query("certificates").withIndex("by_event", (q) => q.eq("event_id", event_id)).collect()).length;
  },
});

/** Insert one certificate */
export const insert = mutation({
  args: {
    certificate_id: v.string(),
    event_id: v.id("events"),
    organization_id: v.id("organizations"),
    recipient_name: v.string(),
    recipient_email: v.optional(v.string()),
    category: v.string(),
    date_issued: v.optional(v.string()),
    status: v.string(),
    pdf_url: v.optional(v.string()),
    cloudinary_public_id: v.optional(v.string()),
    email_send_status: v.optional(v.string()),
    email_sent_at: v.optional(v.string()),
    email_message_id: v.optional(v.string()),
    email_last_error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("certificates", args);
    return await ctx.db.get(id);
  },
});

/** Update certificate pdf_url and cloudinary_public_id */
export const updatePdf = mutation({
  args: {
    id: v.id("certificates"),
    pdf_url: v.optional(v.string()),
    cloudinary_public_id: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...patch } = args;
    await ctx.db.patch(id, patch);
    return await ctx.db.get(id);
  },
});

/** Update certificate status (e.g. revoke) */
export const updateStatus = mutation({
  args: { certificate_id: v.string(), status: v.string() },
  handler: async (ctx, { certificate_id, status }) => {
    const cert = await ctx.db
      .query("certificates")
      .withIndex("by_certificate_id", (q) => q.eq("certificate_id", certificate_id))
      .unique();
    if (!cert) return null;
    await ctx.db.patch(cert._id, { status });
    return await ctx.db.get(cert._id);
  },
});

/** Update pdf_url (and optionally cloudinary_public_id) by certificate_id */
export const updatePdfByCertificateId = mutation({
  args: {
    certificate_id: v.string(),
    pdf_url: v.string(),
    cloudinary_public_id: v.optional(v.string()),
  },
  handler: async (ctx, { certificate_id, pdf_url, cloudinary_public_id }) => {
    const cert = await ctx.db
      .query("certificates")
      .withIndex("by_certificate_id", (q) => q.eq("certificate_id", certificate_id))
      .unique();
    if (!cert) return null;
    await ctx.db.patch(cert._id, { pdf_url, ...(cloudinary_public_id != null && { cloudinary_public_id }) });
    return await ctx.db.get(cert._id);
  },
});

/** Update email delivery state by certificate_id */
export const updateEmailDelivery = mutation({
  args: {
    certificate_id: v.string(),
    email_send_status: v.optional(v.string()),
    email_sent_at: v.optional(v.string()),
    email_message_id: v.optional(v.string()),
    email_last_error: v.optional(v.string()),
  },
  handler: async (ctx, { certificate_id, ...patch }) => {
    const cert = await ctx.db
      .query("certificates")
      .withIndex("by_certificate_id", (q) => q.eq("certificate_id", certificate_id))
      .unique();
    if (!cert) return null;
    await ctx.db.patch(cert._id, patch);
    return await ctx.db.get(cert._id);
  },
});

/** Delete certificate by certificate_id */
export const deleteByCertificateId = mutation({
  args: { certificate_id: v.string() },
  handler: async (ctx, { certificate_id }) => {
    const cert = await ctx.db
      .query("certificates")
      .withIndex("by_certificate_id", (q) => q.eq("certificate_id", certificate_id))
      .unique();
    if (!cert) return null;
    await ctx.db.delete(cert._id);
    return cert._id;
  },
});

/** Get certificates by event (for match-certificates and generate-missing) */
export const listByEventForOrg = query({
  args: { event_id: v.id("events"), organization_id: v.id("organizations") },
  handler: async (ctx, { event_id, organization_id }) => {
    return await ctx.db
      .query("certificates")
      .withIndex("by_event", (q) => q.eq("event_id", event_id))
      .collect();
  },
});

/** Get certificates by event (public, for public-download by slug) */
export const listByEventId = query({
  args: { event_id: v.id("events") },
  handler: async (ctx, { event_id }) => {
    return await ctx.db
      .query("certificates")
      .withIndex("by_event", (q) => q.eq("event_id", event_id))
      .collect();
  },
});
