import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    email: v.string(),
    password_hash: v.string(),
    mailer_email: v.optional(v.string()),
    mailer_app_password: v.optional(v.string()),
    mailer_from_name: v.optional(v.string()),
  })
    .index("by_email", ["email"])
    .index("by_slug", ["slug"]),

  organization_passkeys: defineTable({
    organization_id: v.id("organizations"),
    credential_id: v.string(),
    public_key: v.string(),
    counter: v.number(),
    transports: v.optional(v.array(v.string())),
    device_type: v.optional(v.string()),
    backed_up: v.optional(v.boolean()),
  })
    .index("by_organization", ["organization_id"])
    .index("by_credential_id", ["credential_id"]),

  webauthn_challenges: defineTable({
    challenge: v.string(),
    type: v.string(),
    organization_id: v.optional(v.id("organizations")),
    expires_at: v.number(),
    used_at: v.optional(v.number()),
  })
    .index("by_challenge", ["challenge"])
    .index("by_organization", ["organization_id"]),

  events: defineTable({
    organization_id: v.id("organizations"),
    name: v.string(),
    event_date: v.optional(v.string()),
    download_slug: v.optional(v.string()),
    template_asset_url: v.optional(v.string()),
    template_asset_public_id: v.optional(v.string()),
    template_settings: v.optional(v.any()),
    participant_csv: v.optional(v.string()),
  })
    .index("by_organization", ["organization_id"])
    .index("by_download_slug", ["download_slug"]),

  certificates: defineTable({
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
  })
    .index("by_certificate_id", ["certificate_id"])
    .index("by_event", ["event_id"])
    .index("by_organization", ["organization_id"])
    .index("by_status", ["status"]),
});
