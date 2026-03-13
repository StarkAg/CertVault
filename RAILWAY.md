# CertVault on Railway – Required setup

The **“CertVault server misconfigured. Missing environment variables”** message means the app is missing required env vars. Set them and redeploy.

## Required variables (must set)

Add these in **Railway → your service → Variables** (or **Settings → Variables**):

| Variable | Where to get it | Example |
|----------|-----------------|---------|
| `CONVEX_URL` | Run `npx convex dev` locally (log in with Convex, create/link project). Copy the deployment URL from terminal or Convex dashboard. For production, run `npx convex deploy` and use the production URL. | `https://xxxxx.convex.cloud` |

Without this, login, signup, events, and certificates will not work.

## Optional variables

| Variable | Purpose |
|----------|--------|
| `PUBLIC_URL` | Your app URL (e.g. `https://certvault-web-production.up.railway.app`) for CORS. Railway often sets `RAILWAY_PUBLIC_DOMAIN` automatically. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Required only if you want to store certificate PDFs on Cloudinary. |
| `CERTGEN_SERVICE_URL` | URL of the certgen service (see `certgen-service/README.md` for deploying it). |
| `ALLOWED_ORIGINS` | Comma-separated extra origins for CORS (e.g. a custom domain). |

## Convex setup

1. Install Convex CLI and log in: `npx convex login`.
2. From the CertVault repo, run **`npx convex dev`**. This creates/links a Convex project and pushes the schema + functions. It will print your **CONVEX_URL** (e.g. `https://happy-animal-123.convex.cloud`).
3. Copy that URL → set **CONVEX_URL** in Railway Variables (and in local `.env` for development).
4. For production, run **`npx convex deploy`** and use the production deployment URL as **CONVEX_URL** on Railway.

**Full PDF generation:** Deploy the **certgen-service** (same repo, root directory `certgen-service`) and set its Cloudinary vars. Then set **CERTGEN_SERVICE_URL** on certvault-web to the certgen service URL. See `certgen-service/README.md`.
