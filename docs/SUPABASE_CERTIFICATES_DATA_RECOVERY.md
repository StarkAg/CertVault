# Supabase `certvault_certificates` – data recovery

The table that held **student name + CertVault ID** (and related fields) was:

- **Table name:** `public.certvault_organizations` (orgs), `public.certvault_events` (events), **`public.certvault_certificates`** (the one with student/cert data).

**Relevant columns in `certvault_certificates`:**
- `certificate_id` – CertVault ID (e.g. CV-2026-ABC123)
- `recipient_name` – student/recipient name
- `recipient_email` – optional
- `event_id`, `organization_id`, `category`, `date_issued`, `status`, `pdf_url`, `cloudinary_public_id`, `created_at`

The **migration SQL** (schema only) is back in `supabase/migrations/042_certvault_tables.sql`, `043_*`, `044_*`. That does **not** contain the actual rows.

---

## How to try to get the **data** back

1. **Supabase project**
   - **Dashboard → Database → Backups** (if you have backups enabled).
   - **Point-in-Time Recovery (PITR)** on paid plans: restore to a time before the table was dropped.
   - **Logs / History**: sometimes you can see recent queries or exports.

2. **Convex**
   - CertVault now uses **Convex** for certificates (`convex/certificates.js`, `organizations`, `events`). If you ever migrated or re-issued certs after switching to Convex, the same student/certificate data may exist in the Convex dashboard (Data tab). Check there for `certificates` and `recipient_name` / `certificate_id`.

3. **Exports**
   - Any CSV/JSON you downloaded from Supabase (Table Editor → export) or from your app (e.g. “Download all” or reports).

4. **Other**
   - Local DB dumps, scripts that logged or wrote certificate IDs and names to a file, or another app that copied from Supabase.

---

**Summary:** Git only had the **table definitions**. The live data was only in Supabase (and possibly in Convex if you migrated). Use Supabase backups/PITR first, then Convex data and any exports you have.
