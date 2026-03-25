# CertGen — PDF certificate generator

Flask service used by CertVault to generate certificate PDFs from templates and upload them to Cloudinary.

**Endpoints:** `POST /generate`, `POST /generate-batch`, `POST /preview`, `GET /health`

**Env:** `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (or `CLOUDINARY_URL`), `PORT` (default 5050).

## Run locally

```bash
cd certgen-service
python -m venv venv
source venv/bin/activate   # or venv\Scripts\activate on Windows
pip install -r requirements.txt
# Set CLOUDINARY_* in ../.env or here
export PORT=5050
python app.py
```

## Deploy on Railway (second service)

1. In the same Railway project as CertVault, add a **new service**.
2. Connect the **same GitHub repo** (CertVault).
3. Set **Root Directory** to `certgen-service`.
4. Railway will detect the **Dockerfile** in that directory and build the Python image.
5. Set variables: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. Optionally `PORT` (Railway sets it automatically).
6. Generate a **domain** for this service (e.g. `certvault-certgen-production.up.railway.app`).
7. In the **certvault-web** service variables, set:
   `CERTGEN_SERVICE_URL=https://certvault-certgen-production.up.railway.app`  
   (use the actual URL Railway gives you).

After that, "Generate PDFs" in CertVault will work.
