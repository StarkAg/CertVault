# CertVault

Certificate hosting and verification — **fully standalone** (frontend + backend). No GradeX dependency.

## Location

- `~/Desktop/Code PlayGround/CertVault` — this repo (frontend + API + server)
- `~/Desktop/Code PlayGround/GradeX` — separate app; no CertVault code

## Stack

- **Frontend:** React + Vite (port 5174)
- **Backend:** Node + Express (port 3001), serves `/api/certvault` and static build
- **DB:** Convex (backend and data; run `npx convex dev` to create/link project and get `CONVEX_URL`)
- **PDFs:** Cloudinary (certificate PDF hosting)
- **PDF generation:** Optional separate service (certgen) at `CERTGEN_SERVICE_URL` (e.g. Flask on 5050)

## Env

Copy `.env.example` to `.env` and set:

- **`CONVEX_URL`** — required; run `npx convex dev` to create a Convex project and get the URL
- `CLOUDINARY_*` — for PDF hosting
- `CERTGEN_SERVICE_URL` — for generating PDFs (e.g. `http://localhost:5050`); omit if you only create records without PDFs
- `ALLOWED_ORIGINS` — comma-separated origins for CORS (e.g. `http://localhost:5174`)
- `PUBLIC_URL` — optional; when set (e.g. `https://your-app.up.railway.app`), this origin is allowed for CORS. On Railway, `RAILWAY_PUBLIC_DOMAIN` is used automatically if set.

## Deploy on Railway

1. **Create a new project** at [railway.app](https://railway.app) and connect this repo (GitHub/GitLab or deploy from CLI).

2. **Configure build & start** (optional — repo includes `railway.toml`):
   - Build: `npm ci && npm run build`
   - Start: `node server.js`  
   Railway sets `PORT`; the app listens on `0.0.0.0`.

3. **Set environment variables** in the Railway service:
   - **Required:** **`CONVEX_URL`** — run `npx convex dev` locally to create a Convex project and get the URL; for production use `npx convex deploy` and set the production URL. See [RAILWAY.md](RAILWAY.md).
   - **For PDF hosting:** `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
   - **Optional:** `PUBLIC_URL` — set to your Railway app URL if CORS blocks requests; Railway may also set `RAILWAY_PUBLIC_DOMAIN`.
   - **Optional:** `CERTGEN_SERVICE_URL` — only if you run a separate PDF generator service.

4. **Generate a domain** in Railway (Settings → Networking → Generate Domain). Use this URL as `PUBLIC_URL` if needed.

5. **Convex:** Ensure `npx convex dev` (or `npx convex deploy` for prod) has been run from this repo so your Convex project has the schema and functions. No separate DB migrations — Convex schema is in `convex/schema.js`.

After deploy, the app serves the frontend and `/api/certvault` from the same origin. Sign up, create events, and add certificates; PDF generation works only if `CERTGEN_SERVICE_URL` points to a running certgen service.

## Run locally

**Frontend + backend together:**

```bash
npm install
npm run dev:all
```

- Frontend: http://localhost:5174 (Vite proxies `/api` to backend)
- Backend: http://localhost:3001

**Or separately:**

```bash
npm run server    # backend on 3001
npm run dev       # frontend on 5174 (set Vite proxy to 3001)
```

**Build and run production:**

```bash
npm run build
PORT=3001 node server.js
```

Serves the built app and API from port 3001.

## Convex (database)

Schema and functions are in `convex/`. Run **`npx convex dev`** to create/link a project and push the schema. No separate migrations — Convex syncs the schema from `convex/schema.js`.

## CertGen (PDF generation)

For generating certificate PDFs from templates, you need the certgen service (e.g. the Flask app in GradeX’s `certgen-service/`). Run it separately and set `CERTGEN_SERVICE_URL` in `.env`. If you don’t need PDF generation, you can leave it unset and only create certificate records.

## Routes (frontend)

| Path            | Page              |
|-----------------|-------------------|
| `/`             | Home              |
| `/how-it-works` | How it works      |
| `/for-clubs`    | For clubs         |
| `/verify`       | Verify certificate |
| `/login`        | Club login        |
| `/dashboard`    | Club dashboard    |
| `/design`       | Certificate design |
| `/:eventSlug`   | Public download   |
