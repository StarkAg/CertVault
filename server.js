/**
 * CertVault backend — Express server.
 * Serves the frontend and /api/certvault.
 */
import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

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
    setHeader(name, value) {
      this.headers[name] = value;
      res.setHeader(name, value);
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.setHeader('Content-Type', 'application/json');
      Object.keys(this.headers).forEach(k => res.setHeader(k, this.headers[k]));
      res.status(this.statusCode).json(data);
    },
    send(data) {
      Object.keys(this.headers).forEach(k => res.setHeader(k, this.headers[k]));
      res.status(this.statusCode).send(data);
    },
    end(data) {
      Object.keys(this.headers).forEach(k => res.setHeader(k, this.headers[k]));
      if (data) res.status(this.statusCode).send(data);
      else res.status(this.statusCode).end();
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

// Static build
const distPath = join(__dirname, 'dist');
app.use(express.static(distPath, { index: false }));

app.get('*', (req, res) => {
  const indexFile = join(distPath, 'index.html');
  if (fs.existsSync(indexFile)) {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexFile);
  } else {
    res.status(404).send('Not found. Run npm run build first.');
  }
});

const server = http.createServer(app);
const port = Number(PORT) || 3001;
server.listen(port, '0.0.0.0', () => {
  console.log(`[CertVault] Server running at http://0.0.0.0:${port}`);
});
