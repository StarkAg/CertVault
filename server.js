/**
 * CertVault backend — Express server.
 * Serves the frontend and /api/certvault.
 */
import dotenv from 'dotenv';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

dotenv.config();
dotenv.config({ path: '.env.local', override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) || [];
// Allow PUBLIC_URL (e.g. https://yourapp.up.railway.app) so CORS works when deployed
let publicUrl = process.env.PUBLIC_URL?.trim().replace(/\/$/, '');
if (!publicUrl && process.env.RAILWAY_PUBLIC_DOMAIN) {
  publicUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
}
if (publicUrl && !allowedOrigins.includes(publicUrl)) allowedOrigins.push(publicUrl);
const isLocalOrigin = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (process.env.NODE_ENV !== 'production' && isLocalOrigin(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.path === '/api/certvault' && req.query?.action === 'proxy-pdf') {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  } else {
    res.setHeader('X-Frame-Options', 'DENY');
  }
  next();
});

app.get('/healthz', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    status: 'ok',
    service: 'certvault',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

async function handleVercelRoute(handler, req, res) {
  const vercelReq = {
    method: req.method,
    query: req.query,
    body: req.body,
    headers: req.headers,
  };
  const vercelRes = {
    statusCode: 200,
    headers: {},
    headersSent: false,
    setHeader(name, value) {
      this.headers[name] = value;
      if (!res.headersSent) {
        res.setHeader(name, value);
      }
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.headersSent = true;
      if (!res.headersSent) {
        this.setHeader('Content-Type', 'application/json');
        Object.keys(this.headers).forEach(k => res.setHeader(k, this.headers[k]));
      }
      res.status(this.statusCode).json(data);
    },
    send(data) {
      this.headersSent = true;
      if (!res.headersSent) {
        Object.keys(this.headers).forEach(k => res.setHeader(k, this.headers[k]));
      }
      res.status(this.statusCode).send(data);
    },
    write(data) {
      this.headersSent = true;
      if (!res.headersSent) {
        Object.keys(this.headers).forEach(k => res.setHeader(k, this.headers[k]));
      }
      res.statusCode = this.statusCode;
      return res.write(data);
    },
    end(data) {
      this.headersSent = true;
      if (!res.headersSent) {
        Object.keys(this.headers).forEach(k => res.setHeader(k, this.headers[k]));
      }
      res.statusCode = this.statusCode;
      if (data !== undefined) return res.end(data);
      return res.end();
    },
  };
  try {
    await handler(vercelReq, vercelRes);
  } catch (err) {
    console.error('[CertVault Server]', err);
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}

// API
app.all('/api/certvault', async (req, res) => {
  const handler = (await import('./api/certvault.js')).default;
  await handleVercelRoute(handler, req, res);
});

// Ultron 9.0 API (hackathon management)
try {
  const ultronHandler = (await import('./api/ultron.js')).default;
  app.all('/api/ultron', async (req, res) => {
    await handleVercelRoute(ultronHandler, req, res);
  });
  console.log('[CertVault] Ultron API mounted at /api/ultron');
} catch (e) {
  console.warn('[CertVault] Ultron API not loaded:', e.message);
}

// Static build
const distPath = join(__dirname, 'dist');
app.use(express.static(distPath, { index: false }));

// SPA fallback: serve index.html only for non-asset routes (avoid sending HTML for /assets/* → wrong MIME)
app.get('*', (req, res) => {
  if (req.path.startsWith('/assets/')) {
    res.status(404).set('Content-Type', 'text/plain').send('Asset not found. Redeploy to refresh.');
    return;
  }
  const indexFile = join(distPath, 'index.html');
  if (fs.existsSync(indexFile)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexFile);
  } else {
    res.status(404).send('Not found. Run npm run build first.');
  }
});

const server = http.createServer(app);
const port = Number(PORT) || 3001;

// Startup: required env (API will return misconfigured until these are set)
const requiredEnv = ['CONVEX_URL'];
const missing = requiredEnv.filter((k) => !process.env[k] || process.env[k].includes('your-'));
if (missing.length) {
  console.warn('[CertVault] Missing required env:', missing.join(', '));
  console.warn('[CertVault] Run `npx convex dev` to get CONVEX_URL, or set it in Railway / .env — see README');
}

// Startup: verify dist exists (helps debug white screen in production)
try {
  const idx = join(distPath, 'index.html');
  const assetsDir = join(distPath, 'assets');
  const hasIndex = fs.existsSync(idx);
  const hasAssets = fs.existsSync(assetsDir) && fs.readdirSync(assetsDir).length > 0;
  console.log(`[CertVault] dist check: index=${hasIndex}, assets=${hasAssets}`);
} catch (e) {
  console.warn('[CertVault] dist check failed:', e.message);
}

server.listen(port, '0.0.0.0', () => {
  console.log(`[CertVault] Server running at http://0.0.0.0:${port}`);
});
