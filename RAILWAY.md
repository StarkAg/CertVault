# CertVault on Railway – Required setup

The **“CertVault server misconfigured. Missing environment variables”** message means the app is missing required env vars. Set them and redeploy.

## Build & deploy

- **Build command** must be **`npm ci && npm run build`** (or `npm install && npm run build`) so that `dist/` and `dist/assets/` are produced. This is set in `railway.toml`; if you override the build in the Railway dashboard, keep this command.
- **Start command**: **`node server.js`** (or `npm start`).
- If the site loads but CSS/JS fail with **"MIME type 'text/html'"** or **404/500 on `/assets/...`**, the front-end build did not run or `dist/` is missing in the deployed image. Check the **build logs** and confirm the build step runs and finishes without errors.
- For custom domain **certvault.gradex.bond**: set **`PUBLIC_URL=https://certvault.gradex.bond`**.
- To reduce free-tier cold starts, point an uptime monitor at **`https://certvault.gradex.bond/healthz`** every 5 minutes. App code cannot wake a sleeping Railway service by itself; it needs an external request or a Railway plan/config that does not sleep.

## Required variables (must set)

Add these in **Railway → your service → Variables** (or **Settings → Variables**):

| Variable | Where to get it | Example |
|----------|-----------------|---------|
| `CONVEX_URL` | Run `npx convex dev` locally (log in with Convex, create/link project). Copy the deployment URL from terminal or Convex dashboard. For production, run `npx convex deploy` and use the production URL. | `https://xxxxx.convex.cloud` |

Without CONVEX_URL, login, signup, events, and certificates will not work.

**Set variables via CLI** (from repo root, with `railway link` already done):

```bash
railway variable set CONVEX_URL=https://YOUR_PROJECT.convex.cloud
```

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

---
