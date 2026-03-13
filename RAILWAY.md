# CertVault on Railway – Required setup

The **“CertVault server misconfigured. Missing environment variables”** message means the app is missing required env vars. Set them and redeploy.

## Build & deploy

- **Build command** must be **`npm ci && npm run build`** (or `npm install && npm run build`) so that `dist/` and `dist/assets/` are produced. This is set in `railway.toml`; if you override the build in the Railway dashboard, keep this command.
- **Start command**: **`node server.js`** (or `npm start`).
- If the site loads but CSS/JS fail with **"MIME type 'text/html'"** or **404/500 on `/assets/...`**, the front-end build did not run or `dist/` is missing in the deployed image. Check the **build logs** and confirm the build step runs and finishes without errors.
- For custom domain **certvault.gradex.bond**: set **`PUBLIC_URL=https://certvault.gradex.bond`** and add that origin to **Redirect URLs** in Supabase (see below).
- **Supabase + Dockerfile**: If the build fails with missing Supabase env, the build will now only warn (so the deploy succeeds). To enable magic link auth, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Railway Variables; if your Railway setup doesn’t pass them as Docker build args, switch to Nixpacks by renaming `Dockerfile` to e.g. `Dockerfile.bak` so Railway injects Variables at build time.

## Required variables (must set)

Add these in **Railway → your service → Variables** (or **Settings → Variables**):

| Variable | Where to get it | Example |
|----------|-----------------|---------|
| `CONVEX_URL` | Run `npx convex dev` locally (log in with Convex, create/link project). Copy the deployment URL from terminal or Convex dashboard. For production, run `npx convex deploy` and use the production URL. | `https://xxxxx.convex.cloud` |
| `VITE_SUPABASE_URL` | Supabase project URL: Dashboard → Settings → API → Project URL. **Must be set in Railway** so the frontend build gets it (Vite inlines `VITE_*` at build time). | `https://xxxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase **anon/public** key: Dashboard → Settings → API → Project API keys → `anon` `public`. **Must be set in Railway** for the build. Never use the `service_role` key here. With the project **Dockerfile**, these are passed as build args so the frontend bundle gets them. | `eyJhbGc...` |

Without CONVEX_URL, login, signup, events, and certificates will not work. Without the VITE_SUPABASE_* vars, you’ll see “Auth is not configured” and magic link login will be disabled.

**Set variables via CLI** (from repo root, with `railway link` already done):

```bash
# One at a time (replace with your values)
railway variable set VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
railway variable set VITE_SUPABASE_ANON_KEY=eyJhbGc...

# Or from your local .env (so values stay out of shell history)
export $(grep -E '^VITE_SUPABASE_URL=|^VITE_SUPABASE_ANON_KEY=' .env | xargs)
railway variable set "VITE_SUPABASE_URL=$VITE_SUPABASE_URL" "VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY"
```

Setting variables triggers a new deploy so the build picks them up.

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

## Supabase Auth (magic link)

Set **`VITE_SUPABASE_URL`** and **`VITE_SUPABASE_ANON_KEY`** in Railway Variables (see table above), then **redeploy** so the frontend build picks them up. If you see “Auth is not configured”, those vars are missing or the app was built before you set them. The same applies if the console shows "Supabase env missing (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)"—set the vars and trigger a new deploy so the build runs with them. If vars are missing at build time, the build now fails with a clear error.

In **Supabase Dashboard** → your project → **Authentication** → **URL Configuration**:

1. **Site URL**  
   The default redirect URL when one isn’t specified or doesn’t match the allow list. Also used in email templates. No wildcards.  
   Set to your app’s root, e.g. **`https://certvault.gradex.bond`**.

2. **Redirect URLs** (allow list)  
   Add every URL that auth may redirect to after sign-in (exact match). For magic link you need:
   - **`https://certvault.gradex.bond/auth/callback`** (production)
   - **`http://localhost:5174/auth/callback`** (local dev)
