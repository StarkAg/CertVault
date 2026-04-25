/**
 * CertVault API
 * 
 * Public endpoints:
 *  - GET /api/certvault?action=verify&certificate_id=XXX - verify certificate
 * 
 * Club auth endpoints:
 *  - POST /api/certvault?action=signup - club signup (email/password backed by Convex)
 *  - POST /api/certvault?action=login - club login (email/password backed by Convex)
 *  - POST /api/certvault?action=passkey-registration-options - start passkey enrollment
 *  - POST /api/certvault?action=passkey-registration-verify - save enrolled passkey
 *  - POST /api/certvault?action=passkey-authentication-options - start passkey sign-in
 *  - POST /api/certvault?action=passkey-authentication-verify - verify passkey sign-in
 *  - GET /api/certvault?action=me - current club
 * 
 * Protected endpoints (requires club auth):
 *  - GET /api/certvault?action=me - get current club info
 *  - POST /api/certvault?action=create-event - create event
 *  - GET /api/certvault?action=list-events - list club's events
 *  - DELETE /api/certvault?action=delete-event - delete event
 *  - GET /api/certvault?action=list-certificates - list certificates for event
 *  - POST /api/certvault?action=generate - generate certificates from data
 *  - POST /api/certvault?action=revoke - revoke a certificate
 *  - POST /api/certvault?action=upload - upload PDF to Cloudinary
 *  - POST /api/certvault?action=delete - delete certificate
 *  - POST /api/certvault?action=match-certificates - match names and return certificates for download
 */

import { getConvexClient, isConvexConfigured, docToApi, docsToApi, api } from '../lib/convex.js';
import { uploadCertificate, deleteCertificate, uploadTemplateImage, isCloudinaryConfigured } from '../lib/cloudinary.js';
import { buildCertVaultVerifyLine, normalizeCertVaultVerifyLine } from '../lib/certvaultVerifyUrl.js';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';

// Convex client is created lazily via getConvexClient() when CONVEX_URL is set

// Certificate generator service URL (Flask service on same server)
const CERTGEN_SERVICE_URL = process.env.CERTGEN_SERVICE_URL?.trim() || '';
const GMAIL_SEND_DELAY_MS = Math.max(0, Number.parseInt(process.env.GMAIL_SEND_DELAY_MS || '3000', 10) || 3000);
const PDF_FETCH_TIMEOUT_MS = Math.max(1000, Number.parseInt(process.env.CERTVAULT_PDF_FETCH_TIMEOUT_MS || '15000', 10) || 15000);
const SMTP_CONNECTION_TIMEOUT_MS = Math.max(1000, Number.parseInt(process.env.CERTVAULT_SMTP_CONNECTION_TIMEOUT_MS || '15000', 10) || 15000);
const SMTP_GREETING_TIMEOUT_MS = Math.max(1000, Number.parseInt(process.env.CERTVAULT_SMTP_GREETING_TIMEOUT_MS || '15000', 10) || 15000);
const SMTP_SOCKET_TIMEOUT_MS = Math.max(1000, Number.parseInt(process.env.CERTVAULT_SMTP_SOCKET_TIMEOUT_MS || '20000', 10) || 20000);
const BREVO_SEND_TIMEOUT_MS = Math.max(1000, Number.parseInt(process.env.CERTVAULT_BREVO_TIMEOUT_MS || '20000', 10) || 20000);
const BREVO_API_KEY = process.env.BREVO_API_KEY?.trim() || '';
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const PASSWORD_HASH_PREFIX = 'scrypt';
const WEBAUTHN_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const WEBAUTHN_RP_NAME = process.env.WEBAUTHN_RP_NAME?.trim() || 'VentArc CertVault';
const AUTHENTICATOR_TRANSPORTS = new Set(['ble', 'cable', 'hybrid', 'internal', 'nfc', 'smart-card', 'usb']);

function isLikelyMailerRateLimit(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('rate limit') ||
    message.includes('too many') ||
    message.includes('quota') ||
    message.includes('daily user sending limit') ||
    message.includes('user-rate limit exceeded') ||
    message.includes('421') ||
    message.includes('432') ||
    message.includes('454')
  );
}

function isPdfGenerationAvailable() {
  return Boolean(CERTGEN_SERVICE_URL);
}

function getPdfGenerationErrorStatus(error) {
  const message = String(error?.message || '');
  if (
    message.includes('PDF generation is not configured') ||
    message.includes('Could not reach the PDF generator service') ||
    message.includes('PDF generator service timed out')
  ) {
    return 503;
  }
  return 500;
}

function hashPassword(password) {
  const normalized = String(password || '');
  const salt = crypto.randomBytes(16).toString('hex');
  const digest = crypto.scryptSync(normalized, salt, 64);
  return `${PASSWORD_HASH_PREFIX}$${salt}$${digest.toString('hex')}`;
}

function verifyPassword(password, storedHash) {
  const candidate = String(password || '');
  const stored = String(storedHash || '');
  if (!stored) return false;

  if (stored === candidate) {
    return true;
  }

  const [scheme, salt, digest] = stored.split('$');
  if (scheme !== PASSWORD_HASH_PREFIX || !salt || !digest) {
    return false;
  }

  const candidateDigest = crypto.scryptSync(candidate, salt, 64);
  const storedDigest = Buffer.from(digest, 'hex');
  if (storedDigest.length !== candidateDigest.length) return false;
  return crypto.timingSafeEqual(candidateDigest, storedDigest);
}

/**
 * Call the certificate generator service to create PDF
 */
async function generateCertificatePDF(template, recipientName, certificateId, settings, cloudinaryFolder) {
  if (!CERTGEN_SERVICE_URL) {
    throw new Error('PDF generation is not configured. Set CERTGEN_SERVICE_URL to your PDF generator service.');
  }
  try {
    const response = await fetch(`${CERTGEN_SERVICE_URL}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template,
        recipient_name: recipientName,
        certificate_id: certificateId,
        settings: settings || {},
        upload_to_cloudinary: true,
        cloudinary_folder: cloudinaryFolder,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(`PDF generator service timed out at ${CERTGEN_SERVICE_URL}`);
    }
    if (err?.message === 'fetch failed') {
      throw new Error(`Could not reach the PDF generator service at ${CERTGEN_SERVICE_URL}`);
    }
    console.error('[CertVault] PDF generation error:', err.message);
    throw err;
  }
}

/**
 * Call the certificate generator service for batch generation
 */
async function generateCertificateBatch(template, recipients, settings, cloudinaryFolder) {
  if (!CERTGEN_SERVICE_URL) {
    throw new Error('PDF generation is not configured. Set CERTGEN_SERVICE_URL to your PDF generator service.');
  }
  try {
    // 30-minute timeout for high-res PDFs
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1800000);

    const response = await fetch(`${CERTGEN_SERVICE_URL}/generate-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template,
        recipients,
        settings: settings || {},
        cloudinary_folder: cloudinaryFolder,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(`PDF generator service timed out at ${CERTGEN_SERVICE_URL}`);
    }
    if (err?.message === 'fetch failed') {
      throw new Error(`Could not reach the PDF generator service at ${CERTGEN_SERVICE_URL}`);
    }
    console.error('[CertVault] Batch PDF generation error:', err.message);
    throw err;
  }
}

async function generateCertificatePreview(template, name, certificateId, settings) {
  if (!CERTGEN_SERVICE_URL) {
    throw new Error('PDF generation is not configured. Set CERTGEN_SERVICE_URL to your PDF generator service.');
  }
  try {
    const response = await fetch(`${CERTGEN_SERVICE_URL}/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template,
        name,
        certificate_id: certificateId,
        settings: settings || {},
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    return data;
  } catch (err) {
    if (err?.message === 'fetch failed') {
      throw new Error(`Could not reach the PDF generator service at ${CERTGEN_SERVICE_URL}`);
    }
    console.error('[CertVault] Certificate preview error:', err.message);
    throw err;
  }
}


/**
 * Generate a unique certificate ID: CV-YEAR-XXXXXX
 */
function generateCertificateId() {
  const year = new Date().getFullYear();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `CV-${year}-${random}`;
}

/**
 * Create session token for club (simple base64, no JWT)
 */
function createClubToken(organizationId, email, slug) {
  const tokenData = JSON.stringify({ organizationId, email, slug, type: 'certvault_club', exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  return Buffer.from(tokenData).toString('base64');
}

/**
 * Verify club session token (simple base64, no JWT)
 */
function verifyClubToken(token) {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    if (decoded.type !== 'certvault_club') return null;
    if (decoded.exp && decoded.exp < Date.now()) return null; // expired
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Extract and verify club from Authorization header.
 * Accepts the CertVault base64 token and returns { organizationId, email, slug } or null.
 */
async function getClubFromRequest(req, convex) {
  const authHeader = req.headers?.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  return verifyClubToken(token);
}

/**
 * Generate slug from organization name
 */
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

function serializeOrganization(org) {
  if (!org) return null;
  return {
    id: org._id,
    name: org.name,
    slug: org.slug,
    email: org.email,
    mailer_email: org.mailer_email || '',
    mailer_from_name: org.mailer_from_name || '',
    has_mailer_app_password: Boolean(org.mailer_app_password),
  };
}

function serializeCertificate(cert) {
  return {
    id: cert._id,
    certificate_id: cert.certificate_id,
    recipient_name: cert.recipient_name,
    recipient_email: cert.recipient_email,
    category: cert.category,
    date_issued: cert.date_issued,
    status: cert.status,
    pdf_url: cert.pdf_url,
    email_send_status: cert.email_send_status || 'pending',
    email_sent_at: cert.email_sent_at,
    email_message_id: cert.email_message_id,
    email_last_error: cert.email_last_error,
  };
}

function getBaseUrl(req) {
  const explicitPublic = process.env.PUBLIC_URL?.trim().replace(/\/$/, '');
  if (explicitPublic) return explicitPublic;
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  const forwardedProto = req.headers['x-forwarded-proto'];
  const forwardedHost = req.headers['x-forwarded-host'];
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`.replace(/\/$/, '');
  }
  const origin = req.headers.origin;
  if (origin) return String(origin).replace(/\/$/, '');
  const host = req.headers.host;
  if (host) {
    const proto = /localhost|127\.0\.0\.1/i.test(host) ? 'http' : 'https';
    return `${proto}://${host}`.replace(/\/$/, '');
  }
  return 'http://localhost:5174';
}

function getWebAuthnRpId(req) {
  const explicitRpId = process.env.WEBAUTHN_RP_ID?.trim();
  if (explicitRpId) return explicitRpId;

  try {
    return new URL(getBaseUrl(req)).hostname;
  } catch {
    const forwardedHost = String(req.headers['x-forwarded-host'] || '').trim();
    if (forwardedHost) {
      return forwardedHost.split(',')[0].trim().replace(/:\d+$/, '');
    }

    return String(req.headers.host || 'localhost').replace(/:\d+$/, '');
  }
}

function getWebAuthnOrigins(req) {
  const origins = new Set();
  const candidates = [
    process.env.PUBLIC_URL?.trim(),
    req.headers.origin,
    getBaseUrl(req),
  ];

  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').trim();
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').trim();
  if (forwardedProto && forwardedHost) {
    origins.add(`${forwardedProto}://${forwardedHost.split(',')[0].trim()}`.replace(/\/$/, ''));
  }

  for (const candidate of candidates) {
    if (!candidate) continue;
    origins.add(String(candidate).replace(/\/$/, ''));
  }

  return Array.from(origins);
}

function normalizeTransports(transports) {
  if (!Array.isArray(transports)) return undefined;
  const filtered = transports.filter((transport) => AUTHENTICATOR_TRANSPORTS.has(transport));
  return filtered.length ? filtered : undefined;
}

function toStoredWebAuthnCredential(passkey) {
  return {
    id: passkey.credential_id,
    publicKey: Buffer.from(passkey.public_key, 'base64url'),
    counter: Number(passkey.counter || 0),
    transports: normalizeTransports(passkey.transports),
  };
}

function getVerifyLineText(req) {
  return buildCertVaultVerifyLine(getBaseUrl(req));
}

function normalizeTemplateSettings(settings, req) {
  const safeSettings = settings && typeof settings === 'object' ? { ...settings } : {};
  safeSettings.verify_line_text = normalizeCertVaultVerifyLine(safeSettings.verify_line_text, getBaseUrl(req));
  return safeSettings;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchUrlAsDataUrl(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not fetch template asset (HTTP ${response.status})`);
  }
  const contentType = response.headers.get('content-type') || 'image/png';
  const arrayBuffer = await response.arrayBuffer();
  return `data:${contentType};base64,${Buffer.from(arrayBuffer).toString('base64')}`;
}

async function resolveTemplateSource(template, event) {
  if (typeof template === 'string' && template.trim()) {
    const normalized = template.trim();
    if (/^https?:\/\//i.test(normalized)) {
      return await fetchUrlAsDataUrl(normalized);
    }
    return normalized;
  }
  if (event?.template_asset_url) {
    return await fetchUrlAsDataUrl(event.template_asset_url);
  }
  return null;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function buildEventSlug(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'event';
}

function buildSendSummary(certificates) {
  const all = certificates || [];
  return {
    total: all.length,
    sent: all.filter((c) => c.email_send_status === 'sent').length,
    pending: all.filter((c) => !c.email_send_status || c.email_send_status === 'pending' || c.email_send_status === 'not_ready').length,
    failed: all.filter((c) => c.email_send_status === 'failed').length,
    eligible: all.filter((c) => c.status === 'valid' && c.pdf_url && isValidEmail(c.recipient_email) && c.email_send_status !== 'sent').length,
  };
}

function stripUndefinedFields(value) {
  return Object.fromEntries(
    Object.entries(value || {}).filter(([, fieldValue]) => fieldValue !== undefined)
  );
}

async function updateTemplateConfigCompat(convex, mutationArgs, fallbackConfig, req) {
  try {
    const updated = await convex.mutation(api.events.updateTemplateConfig, mutationArgs);
    return {
      participant_csv: updated?.participant_csv || '',
      template_asset_url: updated?.template_asset_url || '',
      template_settings: normalizeTemplateSettings(updated?.template_settings || {}, req),
      persisted: true,
    };
  } catch (error) {
    console.warn('[CertVault] Template config persistence unavailable on current Convex deployment:', error.message);
    return {
      participant_csv: fallbackConfig.participant_csv || '',
      template_asset_url: fallbackConfig.template_asset_url || '',
      template_settings: normalizeTemplateSettings(fallbackConfig.template_settings || {}, req),
      persisted: false,
    };
  }
}

async function insertCertificateCompat(convex, payload) {
  try {
    return await convex.mutation(api.certificates.insert, stripUndefinedFields(payload));
  } catch (error) {
    const fallbackPayload = stripUndefinedFields({
      ...payload,
      email_send_status: undefined,
      email_sent_at: undefined,
      email_message_id: undefined,
      email_last_error: undefined,
    });
    console.warn('[CertVault] Falling back to legacy certificate insert payload:', error.message);
    return await convex.mutation(api.certificates.insert, fallbackPayload);
  }
}

async function updateEmailDeliveryCompat(convex, payload) {
  try {
    return await convex.mutation(api.certificates.updateEmailDelivery, stripUndefinedFields(payload));
  } catch (error) {
    console.warn('[CertVault] Email delivery status persistence unavailable on current Convex deployment:', error.message);
    return null;
  }
}

async function updateMailerConfigCompat(convex, patch, fallbackConfig) {
  try {
    const updated = await convex.mutation(api.organizations.updateMailerConfig, patch);
    return {
      mailer_email: updated?.mailer_email || '',
      mailer_from_name: updated?.mailer_from_name || '',
      has_mailer_app_password: Boolean(updated?.mailer_app_password),
      persisted: true,
    };
  } catch (error) {
    console.warn('[CertVault] Mailer config persistence unavailable on current Convex deployment:', error.message);
    return {
      mailer_email: fallbackConfig.mailer_email || '',
      mailer_from_name: fallbackConfig.mailer_from_name || '',
      has_mailer_app_password: Boolean(fallbackConfig.mailer_app_password),
      persisted: false,
    };
  }
}

function createOrgTransporter(org, override = {}) {
  const user = String(override.mailer_email ?? org?.mailer_email ?? '').trim();
  const pass = String(override.mailer_app_password ?? org?.mailer_app_password ?? '').replace(/\s+/g, '');
  if (!user || !pass) {
    throw new Error('Configure the Gmail sender email and app password first');
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
    connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
    socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
  });
}

function getMailerProvider() {
  return BREVO_API_KEY ? 'brevo' : 'gmail';
}

async function fetchPdfBuffer(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PDF_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Could not fetch certificate PDF (HTTP ${response.status})`);
    }
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`Timed out fetching certificate PDF after ${PDF_FETCH_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pdfDownloadUrlForEmail(url, req) {
  if (!url) return '';
  if (url.includes('res.cloudinary.com')) {
    return `${getBaseUrl(req)}/api/certvault?action=proxy-pdf&url=${encodeURIComponent(url)}`;
  }
  return url;
}

async function sendCertificateEmail({ transporter, org, event, cert, req }) {
  const fromAddress = String(org.mailer_email || '').trim();
  const fromName = String(org.mailer_from_name || org.name || 'CertVault').trim();
  const recipientEmail = String(cert.recipient_email || '').trim();
  const verifyUrl = `${getBaseUrl(req)}/certvault/verify?id=${encodeURIComponent(cert.certificate_id)}`;
  console.log(`[CertVault] Email send start ${cert.certificate_id} -> ${recipientEmail}`);
  const pdfBuffer = await fetchPdfBuffer(cert.pdf_url);
  const brandLine = 'CertVault, a GradeX product';
  const issuedByLine = `Issued by ${org.name} through ${brandLine}`;
  const previewUrl = pdfDownloadUrlForEmail(cert.pdf_url, req);
  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: recipientEmail,
    subject: `${event.name} Certificate for ${cert.recipient_name}`,
    text: `Hi ${cert.recipient_name},

Your certificate for ${event.name} is attached to this email as a PDF.

Certificate ID: ${cert.certificate_id}

Verify online: ${verifyUrl}

${brandLine}

${issuedByLine}`,
    html: `
      <div style="margin:0;padding:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
        <div style="max-width:640px;margin:0 auto;padding:32px 18px;">
          <div style="background:#05070b;border-radius:22px 22px 0 0;padding:28px 30px;color:#ffffff;">
            <div style="font-size:12px;letter-spacing:0.22em;text-transform:uppercase;color:#8fb8ff;font-weight:700;">${brandLine}</div>
            <h1 style="margin:12px 0 0;font-size:28px;line-height:1.15;">Your certificate is ready</h1>
          </div>
          <div style="background:#ffffff;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 22px 22px;padding:30px;">
            <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Hi <strong>${escapeHtml(cert.recipient_name)}</strong>,</p>
            <p style="margin:0 0 22px;font-size:16px;line-height:1.6;">Your certificate for <strong>${escapeHtml(event.name)}</strong> has been issued by <strong>${escapeHtml(org.name)}</strong>. The PDF certificate is attached to this email.</p>
            <div style="border:1px solid #e5e7eb;border-radius:16px;padding:18px;margin:0 0 24px;background:#f8fafc;">
              <div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#64748b;font-weight:700;margin-bottom:8px;">Certificate ID</div>
              <div style="font-size:20px;font-weight:800;color:#0f172a;">${escapeHtml(cert.certificate_id)}</div>
            </div>
            <div style="margin:0 0 24px;">
              <a href="${verifyUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:12px;padding:13px 18px;font-size:14px;font-weight:800;">Verify Certificate</a>
              <a href="${previewUrl}" style="display:inline-block;margin-left:10px;color:#2563eb;text-decoration:none;font-size:14px;font-weight:800;">View PDF</a>
            </div>
            <p style="margin:0 0 8px;color:#111827;font-size:14px;font-weight:700;line-height:1.6;">${escapeHtml(brandLine)}</p>
            <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">${escapeHtml(issuedByLine)}</p>
          </div>
        </div>
      </div>
    `,
    attachments: [
      {
        filename: `${cert.certificate_id}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });
  console.log(`[CertVault] Email send success ${cert.certificate_id} -> ${recipientEmail}`);
  return info;
}

async function sendCertificateEmailWithBrevo({ org, event, cert, req }) {
  const fromAddress = String(org.mailer_email || '').trim();
  const fromName = String(org.mailer_from_name || org.name || 'CertVault').trim();
  const recipientEmail = String(cert.recipient_email || '').trim();
  if (!fromAddress || !isValidEmail(fromAddress)) {
    throw new Error('Configure a valid sender email before sending');
  }
  if (!recipientEmail || !isValidEmail(recipientEmail)) {
    throw new Error('Recipient email is invalid');
  }

  const verifyUrl = `${getBaseUrl(req)}/certvault/verify?id=${encodeURIComponent(cert.certificate_id)}`;
  const pdfBuffer = await fetchPdfBuffer(cert.pdf_url);
  const brandLine = 'CertVault, a GradeX product';
  const issuedByLine = `Issued by ${org.name} through ${brandLine}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BREVO_SEND_TIMEOUT_MS);
  console.log(`[CertVault] Email send start ${cert.certificate_id} -> ${recipientEmail}`);
  let response;
  try {
    response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        sender: { name: fromName, email: fromAddress },
        to: [{ email: recipientEmail, name: cert.recipient_name }],
        subject: `${event.name} Certificate for ${cert.recipient_name}`,
        textContent: `Hi ${cert.recipient_name},

Your certificate for ${event.name} is attached to this email as a PDF.

Certificate ID: ${cert.certificate_id}

Verify online: ${verifyUrl}

${brandLine}

${issuedByLine}`,
      htmlContent: `
        <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
          <p style="margin:0 0 12px; font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:#2563eb; font-weight:700;">${brandLine}</p>
          <p>Hi ${cert.recipient_name},</p>
          <p>Your certificate for <strong>${event.name}</strong> is attached to this email as a PDF.</p>
          <p>Certificate ID: <strong>${cert.certificate_id}</strong></p>
          <p>Verify online: <a href="${verifyUrl}">${verifyUrl}</a></p>
          <p><strong>${brandLine}</strong></p>
          <p>${issuedByLine}</p>
        </div>
      `,
      attachment: [
        {
          name: `${cert.certificate_id}.pdf`,
          content: pdfBuffer.toString('base64'),
        },
      ],
      }),
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`Brevo send timed out after ${BREVO_SEND_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `Brevo send failed with HTTP ${response.status}`);
  }
  console.log(`[CertVault] Email send success ${cert.certificate_id} -> ${recipientEmail}`);
  return { messageId: data.messageId || data.messageIds?.[0] || '' };
}

export default async function handler(req, res) {
  // CORS: Restrict to allowed origins only (no wildcard)
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) || [];
  let publicUrl = process.env.PUBLIC_URL?.trim().replace(/\/$/, '');
  if (!publicUrl && process.env.RAILWAY_PUBLIC_DOMAIN) {
    publicUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  if (publicUrl && !allowedOrigins.includes(publicUrl)) allowedOrigins.push(publicUrl);
  const origin = req.headers.origin;
  
  // Only set CORS header if origin is in allowed list
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  // If no origin header (same-origin request), allow it
  else if (!origin) {
    // Same-origin request, allow it
  }
  // Origin not allowed - don't set CORS header (browser will block)
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const action = req.query?.action || req.body?.action;

  const needsConvex = action !== 'proxy-pdf';
  const missingEnv = [];
  if (needsConvex && !isConvexConfigured()) {
    missingEnv.push('CONVEX_URL');
  }
  if (missingEnv.length) {
    console.error('[CertVault] Missing required env:', missingEnv.join(', '));
    return res.status(500).json({
      success: false,
      error: 'CertVault server misconfigured. Missing environment variables.',
      missing: missingEnv,
      hint: 'Set CONVEX_URL in Railway Variables or .env. Run `npx convex dev` to get your URL. See README.',
    });
  }

  const convex = getConvexClient();
  if (needsConvex && !convex) {
    return res.status(500).json({ success: false, error: 'Convex client not configured.' });
  }

  try {
    // =====================
    // CLUB AUTH ENDPOINTS
    // =====================

    // POST: Club signup
    if (action === 'signup') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
      }

      const { name, email, password } = req.body || {};
      
      if (!name || !email || !password) {
        return res.status(400).json({ success: false, error: 'Name, email, and password are required' });
      }

      if (password.length < 6) {
        return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
      }

      const emailTrim = email.trim().toLowerCase();
      const nameTrim = name.trim();
      const slug = generateSlug(nameTrim);

      const existing = await convex.query(api.organizations.getByEmail, { email: emailTrim });
      if (existing) {
        return res.status(400).json({ success: false, error: 'Email already registered' });
      }

      const org = await convex.mutation(api.organizations.create, {
        name: nameTrim,
        slug,
        email: emailTrim,
        password_hash: hashPassword(password),
      });

      if (!org) {
        return res.status(500).json({ success: false, error: 'Failed to create organization' });
      }

      const token = createClubToken(org._id, org.email, org.slug);

      return res.status(200).json({
        success: true,
        token,
        organization: {
          id: org._id,
          name: org.name,
          slug: org.slug,
          email: org.email,
        },
      });
    }

    // POST: Club login
    if (action === 'login') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
      }

      const { email, password } = req.body || {};

      if (!email) {
        return res.status(400).json({ success: false, error: 'Email and password are required' });
      }

      const emailTrim = email.trim().toLowerCase();

      const org = await convex.query(api.organizations.getByEmail, { email: emailTrim });

      if (!org || !verifyPassword(password, org.password_hash)) {
        return res.status(401).json({ success: false, error: 'Invalid email or password' });
      }

      const token = createClubToken(org._id, org.email, org.slug);

      return res.status(200).json({
        success: true,
        token,
        organization: {
          id: org._id,
          name: org.name,
          slug: org.slug,
          email: org.email,
        },
      });
    }

    // POST: Begin passkey registration for the signed-in organizer
    if (action === 'passkey-registration-options') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
      }

      const club = await getClubFromRequest(req, convex);
      if (!club) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const org = await convex.query(api.organizations.getById, { id: club.organizationId });
      if (!org) {
        return res.status(404).json({ success: false, error: 'Organization not found' });
      }

      const existingPasskeys = await convex.query(api.passkeys.listByOrganization, {
        organization_id: org._id,
      });

      const options = await generateRegistrationOptions({
        rpName: WEBAUTHN_RP_NAME,
        rpID: getWebAuthnRpId(req),
        userName: org.email,
        userID: Uint8Array.from(Buffer.from(String(org._id))),
        userDisplayName: org.name,
        attestationType: 'none',
        excludeCredentials: existingPasskeys.map((passkey) => ({
          id: passkey.credential_id,
          transports: normalizeTransports(passkey.transports),
        })),
        authenticatorSelection: {
          residentKey: 'required',
          userVerification: 'preferred',
        },
      });

      await convex.mutation(api.webauthnChallenges.create, {
        challenge: options.challenge,
        type: 'registration',
        organization_id: org._id,
        expires_at: Date.now() + WEBAUTHN_CHALLENGE_TTL_MS,
      });

      return res.status(200).json({
        success: true,
        options,
      });
    }

    // POST: Verify passkey registration and persist the authenticator
    if (action === 'passkey-registration-verify') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
      }

      const club = await getClubFromRequest(req, convex);
      if (!club) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const { credential, challenge } = req.body || {};

      if (!credential || !challenge) {
        return res.status(400).json({ success: false, error: 'Credential response and challenge are required' });
      }

      const challengeRecord = await convex.mutation(api.webauthnChallenges.consume, {
        challenge: String(challenge),
        type: 'registration',
        organization_id: club.organizationId,
      });

      if (!challengeRecord) {
        return res.status(400).json({ success: false, error: 'Passkey registration expired. Try again.' });
      }

      let verification;
      try {
        verification = await verifyRegistrationResponse({
          response: credential,
          expectedChallenge: String(challenge),
          expectedOrigin: getWebAuthnOrigins(req),
          expectedRPID: getWebAuthnRpId(req),
          requireUserVerification: true,
        });
      } catch (err) {
        return res.status(400).json({
          success: false,
          error: err?.message || 'Could not verify passkey registration',
        });
      }

      if (!verification.verified || !verification.registrationInfo) {
        return res.status(400).json({ success: false, error: 'Could not verify passkey registration' });
      }

      const existingPasskey = await convex.query(api.passkeys.getByCredentialId, {
        credential_id: verification.registrationInfo.credential.id,
      });

      if (!existingPasskey) {
        await convex.mutation(api.passkeys.create, {
          organization_id: club.organizationId,
          credential_id: verification.registrationInfo.credential.id,
          public_key: Buffer.from(verification.registrationInfo.credential.publicKey).toString('base64url'),
          counter: verification.registrationInfo.credential.counter,
          transports: normalizeTransports(verification.registrationInfo.credential.transports),
          device_type: verification.registrationInfo.credentialDeviceType,
          backed_up: verification.registrationInfo.credentialBackedUp,
        });
      }

      return res.status(200).json({
        success: true,
        already_registered: Boolean(existingPasskey),
      });
    }

    // POST: Begin passkey authentication
    if (action === 'passkey-authentication-options') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
      }

      const options = await generateAuthenticationOptions({
        rpID: getWebAuthnRpId(req),
        userVerification: 'preferred',
      });

      await convex.mutation(api.webauthnChallenges.create, {
        challenge: options.challenge,
        type: 'authentication',
        expires_at: Date.now() + WEBAUTHN_CHALLENGE_TTL_MS,
      });

      return res.status(200).json({
        success: true,
        options,
      });
    }

    // POST: Verify passkey authentication and sign the organizer in
    if (action === 'passkey-authentication-verify') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
      }

      const { credential, challenge } = req.body || {};

      if (!credential || !challenge) {
        return res.status(400).json({ success: false, error: 'Credential response and challenge are required' });
      }

      const challengeRecord = await convex.mutation(api.webauthnChallenges.consume, {
        challenge: String(challenge),
        type: 'authentication',
      });

      if (!challengeRecord) {
        return res.status(400).json({ success: false, error: 'Passkey sign-in expired. Try again.' });
      }

      const storedPasskey = await convex.query(api.passkeys.getByCredentialId, {
        credential_id: String(credential.id || ''),
      });

      if (!storedPasskey) {
        return res.status(401).json({ success: false, error: 'Passkey not recognized for this workspace' });
      }

      const org = await convex.query(api.organizations.getById, { id: storedPasskey.organization_id });
      if (!org) {
        return res.status(404).json({ success: false, error: 'Organization not found' });
      }

      let verification;
      try {
        verification = await verifyAuthenticationResponse({
          response: credential,
          expectedChallenge: String(challenge),
          expectedOrigin: getWebAuthnOrigins(req),
          expectedRPID: getWebAuthnRpId(req),
          credential: toStoredWebAuthnCredential(storedPasskey),
        });
      } catch (err) {
        return res.status(401).json({
          success: false,
          error: err?.message || 'Could not verify passkey sign-in',
        });
      }

      if (!verification.verified) {
        return res.status(401).json({ success: false, error: 'Could not verify passkey sign-in' });
      }

      await convex.mutation(api.passkeys.updateCounter, {
        credential_id: storedPasskey.credential_id,
        counter: verification.authenticationInfo.newCounter,
        device_type: verification.authenticationInfo.credentialDeviceType,
        backed_up: verification.authenticationInfo.credentialBackedUp,
      });

      const token = createClubToken(org._id, org.email, org.slug);

      return res.status(200).json({
        success: true,
        token,
        organization: {
          id: org._id,
          name: org.name,
          slug: org.slug,
          email: org.email,
        },
      });
    }

    // GET: Get current club info
    if (action === 'me') {
      const club = await getClubFromRequest(req, convex);
      if (!club) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const org = await convex.query(api.organizations.getById, { id: club.organizationId });

      if (!org) {
        return res.status(404).json({ success: false, error: 'Organization not found' });
      }

      return res.status(200).json({
        success: true,
        organization: serializeOrganization(org),
      });
    }

    if (action === 'mailer-config') {
      const club = await getClubFromRequest(req, convex);
      if (!club) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }
      const org = await convex.query(api.organizations.getById, { id: club.organizationId });
      if (!org) {
        return res.status(404).json({ success: false, error: 'Organization not found' });
      }

      if (req.method === 'GET') {
        return res.status(200).json({
          success: true,
          config: {
            mailer_email: org.mailer_email || '',
            mailer_from_name: org.mailer_from_name || '',
            has_mailer_app_password: Boolean(org.mailer_app_password),
          },
        });
      }

      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
      }

      const mailerEmail = String(req.body?.mailer_email || '').trim().toLowerCase();
      const mailerFromName = String(req.body?.mailer_from_name || '').trim();
      const appPasswordInput = req.body?.mailer_app_password;
      const patch = {
        id: club.organizationId,
        mailer_email: mailerEmail || undefined,
        mailer_from_name: mailerFromName || undefined,
      };
      if (appPasswordInput !== undefined) {
        const normalizedPassword = String(appPasswordInput || '').replace(/\s+/g, '');
        patch.mailer_app_password = normalizedPassword || undefined;
      }

      if (mailerEmail && !isValidEmail(mailerEmail)) {
        return res.status(400).json({ success: false, error: 'Enter a valid Gmail address' });
      }

      const updated = await updateMailerConfigCompat(convex, patch, {
        mailer_email: mailerEmail,
        mailer_from_name: mailerFromName,
        mailer_app_password: appPasswordInput !== undefined ? String(appPasswordInput || '').replace(/\s+/g, '') : '',
      });
      return res.status(200).json({
        success: true,
        persisted: updated.persisted,
        config: {
          mailer_email: updated.mailer_email || '',
          mailer_from_name: updated.mailer_from_name || '',
          has_mailer_app_password: Boolean(updated.has_mailer_app_password),
        },
      });
    }

    if (action === 'template-config') {
      const club = await getClubFromRequest(req, convex);
      if (!club) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }
      const eventId = req.query?.eventId || req.body?.eventId;
      if (!eventId) {
        return res.status(400).json({ success: false, error: 'eventId is required' });
      }

      const event = await convex.query(api.events.getByIdAndOrg, { id: eventId, organization_id: club.organizationId });
      if (!event) {
        return res.status(404).json({ success: false, error: 'Event not found' });
      }

      if (req.method === 'GET') {
        return res.status(200).json({
          success: true,
          config: {
            participant_csv: event.participant_csv || '',
            template_asset_url: event.template_asset_url || '',
            template_settings: normalizeTemplateSettings(event.template_settings || {}, req),
          },
        });
      }

      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
      }

      const org = await convex.query(api.organizations.getById, { id: club.organizationId });
      if (!org) {
        return res.status(404).json({ success: false, error: 'Organization not found' });
      }

      let templateAssetUrl;
      let templateAssetPublicId;
      if (req.body?.template_data_url) {
        if (!isCloudinaryConfigured()) {
          return res.status(503).json({ success: false, error: 'Cloudinary is required to save certificate templates' });
        }
        const uploaded = await uploadTemplateImage(
          req.body.template_data_url,
          org.slug || 'default',
          buildEventSlug(event.name)
        );
        templateAssetUrl = uploaded.secure_url;
        templateAssetPublicId = uploaded.public_id;
      }

      const mutationArgs = {
        id: eventId,
        organization_id: club.organizationId,
      };
      if (templateAssetUrl !== undefined) {
        mutationArgs.template_asset_url = templateAssetUrl;
      }
      if (templateAssetPublicId !== undefined) {
        mutationArgs.template_asset_public_id = templateAssetPublicId;
      }
      if (req.body?.template_settings !== undefined) {
        mutationArgs.template_settings = normalizeTemplateSettings(req.body.template_settings || {}, req);
      }
      if (req.body?.participant_csv !== undefined) {
        mutationArgs.participant_csv = String(req.body.participant_csv || '');
      }

      const updated = await updateTemplateConfigCompat(
        convex,
        mutationArgs,
        {
          participant_csv: req.body?.participant_csv !== undefined ? String(req.body.participant_csv || '') : event.participant_csv || '',
          template_asset_url: templateAssetUrl !== undefined ? templateAssetUrl : event.template_asset_url || '',
          template_settings: req.body?.template_settings !== undefined
            ? normalizeTemplateSettings(req.body.template_settings || {}, req)
            : normalizeTemplateSettings(event.template_settings || {}, req),
        },
        req
      );

      return res.status(200).json({
        success: true,
        config: {
          participant_csv: updated?.participant_csv || '',
          template_asset_url: updated?.template_asset_url || '',
          template_settings: normalizeTemplateSettings(updated?.template_settings || {}, req),
        },
      });
    }

    if (action === 'send-status') {
      const club = await getClubFromRequest(req, convex);
      if (!club) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }
      const eventId = req.query?.eventId || req.body?.eventId;
      if (!eventId) {
        return res.status(400).json({ success: false, error: 'eventId is required' });
      }
      const event = await convex.query(api.events.getByIdAndOrg, { id: eventId, organization_id: club.organizationId });
      if (!event) {
        return res.status(404).json({ success: false, error: 'Event not found' });
      }
      const certificates = await convex.query(api.certificates.listByEvent, { event_id: eventId });
      return res.status(200).json({
        success: true,
        summary: buildSendSummary(certificates),
      });
    }

    // =====================
    // EVENT ENDPOINTS
    // =====================

    // POST: Create event
    if (action === 'create-event') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
      }

      const club = await getClubFromRequest(req, convex);
      if (!club) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const { name, event_date, download_slug } = req.body || {};
      
      if (!name) {
        return res.status(400).json({ success: false, error: 'Event name is required' });
      }

      const slug = typeof download_slug === 'string' ? download_slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '') || null : null;

      const event = await convex.mutation(api.events.create, {
        organization_id: club.organizationId,
        name: name.trim(),
        event_date: event_date || undefined,
        download_slug: slug || undefined,
        participant_csv: '',
      });

      if (!event) {
        return res.status(500).json({ success: false, error: 'Failed to create event' });
      }

      return res.status(200).json({ success: true, event: docToApi(event) });
    }

    // GET: List events for organization
    if (action === 'list-events') {
      const club = await getClubFromRequest(req, convex);
      if (!club) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const events = await convex.query(api.events.listByOrganization, { organization_id: club.organizationId });
      const eventsWithCounts = await Promise.all(
        events.map(async (event) => {
          const count = await convex.query(api.certificates.countByEvent, { event_id: event._id });
          return {
            ...docToApi(event),
            certificate_count: count,
            has_template: Boolean(event.template_asset_url),
          };
        })
      );

      return res.status(200).json({ success: true, events: eventsWithCounts });
    }

    // DELETE: Delete event (and all its certificates)
    if (action === 'delete-event') {
      if (req.method !== 'POST' && req.method !== 'DELETE') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
      }

      const club = await getClubFromRequest(req, convex);
      if (!club) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const eventId = req.body?.eventId || req.query?.eventId;
      if (!eventId) {
        return res.status(400).json({ success: false, error: 'eventId is required' });
      }

      const event = await convex.query(api.events.getByIdAndOrg, { id: eventId, organization_id: club.organizationId });
      if (!event) {
        return res.status(404).json({ success: false, error: 'Event not found' });
      }

      await convex.mutation(api.events.remove, { id: eventId });
      return res.status(200).json({ success: true, message: 'Event deleted' });
    }

    // POST: Set download slug for event (public page like /certvault/hize)
    if (action === 'set-download-slug') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
      }
      const club = await getClubFromRequest(req, convex);
      if (!club) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }
      const { eventId, download_slug } = req.body || {};
      if (!eventId) {
        return res.status(400).json({ success: false, error: 'eventId is required' });
      }
      const slug = typeof download_slug === 'string' ? download_slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '') || null : null;
      const event = await convex.mutation(api.events.updateDownloadSlug, {
        id: eventId,
        organization_id: club.organizationId,
        download_slug: slug,
      });
      if (!event) {
        return res.status(404).json({ success: false, error: 'Event not found' });
      }
      return res.status(200).json({ success: true, event: docToApi(event) });
    }

    // =====================
    // CERTIFICATE ENDPOINTS
    // =====================

    // GET: List certificates for an event
    if (action === 'list-certificates') {
      const club = await getClubFromRequest(req, convex);
      if (!club) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const eventId = req.query?.eventId;
      if (!eventId) {
        return res.status(400).json({ success: false, error: 'eventId is required' });
      }

      const event = await convex.query(api.events.getByIdAndOrg, { id: eventId, organization_id: club.organizationId });
      if (!event) {
        return res.status(404).json({ success: false, error: 'Event not found' });
      }

      const certificates = await convex.query(api.certificates.listByEvent, { event_id: eventId });
      return res.status(200).json({
        success: true,
        event: { id: event._id, name: event.name },
        certificates: (certificates || []).map(serializeCertificate),
      });
    }

    if (action === 'template-preview') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
      }
      const club = await getClubFromRequest(req, convex);
      if (!club) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }
      const { eventId, template, settings, name, certificateId } = req.body || {};
      if (!eventId) {
        return res.status(400).json({ success: false, error: 'eventId is required' });
      }

      const event = await convex.query(api.events.getByIdAndOrg, { id: eventId, organization_id: club.organizationId });
      if (!event) {
        return res.status(404).json({ success: false, error: 'Event not found' });
      }

      const templateSource = await resolveTemplateSource(template, event);
      if (!templateSource) {
        return res.status(400).json({ success: false, error: 'Template is required' });
      }

      try {
        const preview = await generateCertificatePreview(
          templateSource,
          typeof name === 'string' && name.trim() ? name.trim() : 'Elon Musk',
          typeof certificateId === 'string' && certificateId.trim() ? certificateId.trim() : 'CV-2026-SAMPLE',
          normalizeTemplateSettings(settings || event.template_settings || {}, req)
        );
        return res.status(200).json({ success: true, ...preview });
      } catch (error) {
        return res.status(getPdfGenerationErrorStatus(error)).json({
          success: false,
          error: error.message || 'Could not render certificate preview',
        });
      }
    }

    // POST: Generate certificates from recipient list (with optional PDF generation)
    if (action === 'generate') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
      }

      const club = await getClubFromRequest(req, convex);
      if (!club) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const { eventId, recipients, template, settings } = req.body || {};
      
      if (!eventId || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'eventId and recipients array are required' 
        });
      }

      // Verify event belongs to this organization
      const event = await convex.query(api.events.getByIdAndOrg, { id: eventId, organization_id: club.organizationId });

      if (!event) {
        return res.status(404).json({ success: false, error: 'Event not found' });
      }

      const normalizedRecipients = recipients.map((recipient, index) => ({
        row: index + 1,
        name: String(recipient?.name || '').trim(),
        email: String(recipient?.email || '').trim().toLowerCase(),
        category: String(recipient?.category || 'Participant').trim() || 'Participant',
      }));

      const invalidRows = normalizedRecipients
        .filter((recipient) => !recipient.name || !recipient.email || !isValidEmail(recipient.email))
        .map((recipient) => ({
          row: recipient.row,
          error: !recipient.name
            ? 'Name is required'
            : !recipient.email
              ? 'Email is required'
              : 'Email format is invalid',
        }));

      if (invalidRows.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Fix invalid participant rows before generating certificates',
          errors: invalidRows,
        });
      }

      // Get organization info for Cloudinary folder
      const org = await convex.query(api.organizations.getById, { id: club.organizationId });
      if (!org) {
        return res.status(404).json({ success: false, error: 'Organization not found' });
      }

      const cloudinaryFolder = `certvault/${org?.slug || 'default'}/${event.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      const resolvedTemplate = await resolveTemplateSource(template, event);
      const resolvedSettings = normalizeTemplateSettings(settings || event.template_settings || {}, req);

      // Generate certificates for each recipient
      const results = [];
      const errors = [];

      if (!resolvedTemplate) {
        return res.status(400).json({
          success: false,
          error: 'A certificate template is required before generating certificates',
        });
      }

      if (!isPdfGenerationAvailable()) {
        return res.status(503).json({
          success: false,
          error: 'PDF generation is not configured. Set CERTGEN_SERVICE_URL to your PDF generator service.',
        });
      }

      try {
        const recipientsWithIds = normalizedRecipients.map((recipient) => ({
          ...recipient,
          certificate_id: generateCertificateId(),
        }));

        const CHUNK_SIZE = 20;
        const pdfUrlMap = new Map();
        const publicIdMap = new Map();
        let totalPdfsGenerated = 0;

        for (let i = 0; i < recipientsWithIds.length; i += CHUNK_SIZE) {
          const chunk = recipientsWithIds.slice(i, i + CHUNK_SIZE);
          const pdfResult = await generateCertificateBatch(
            resolvedTemplate,
            chunk.map((recipient) => ({ name: recipient.name, certificate_id: recipient.certificate_id })),
            resolvedSettings,
            cloudinaryFolder
          );

          if (pdfResult.success === false) {
            throw new Error(pdfResult.error || 'Certificate generator returned an error');
          }

          (pdfResult.results || []).forEach((result) => {
            if (result.pdf_url) pdfUrlMap.set(result.certificate_id, result.pdf_url);
            if (result.public_id) publicIdMap.set(result.certificate_id, result.public_id);
          });
          (pdfResult.errors || []).forEach((error) => {
            const certificateId = error?.recipient?.certificate_id;
            const recipient = chunk.find((item) => item.certificate_id === certificateId);
            errors.push({
              row: recipient?.row,
              error: error?.error || 'PDF generation failed',
            });
          });
          totalPdfsGenerated += pdfResult.generated || 0;
        }

        if (errors.length > 0 || totalPdfsGenerated !== recipientsWithIds.length) {
          return res.status(502).json({
            success: false,
            error: `PDF generation failed for ${errors.length || recipientsWithIds.length - totalPdfsGenerated} recipient(s)`,
            generated: 0,
            failed: errors.length || recipientsWithIds.length - totalPdfsGenerated,
            errors: errors.length > 0 ? errors : undefined,
            pdfsGenerated: totalPdfsGenerated,
          });
        }

        for (const recipient of recipientsWithIds) {
          const pdfUrl = pdfUrlMap.get(recipient.certificate_id);
          const cert = await insertCertificateCompat(convex, {
            certificate_id: recipient.certificate_id,
            event_id: eventId,
            organization_id: club.organizationId,
            recipient_name: recipient.name,
            recipient_email: recipient.email,
            category: recipient.category,
            status: 'valid',
            date_issued: new Date().toISOString(),
            pdf_url: pdfUrl || undefined,
            cloudinary_public_id: publicIdMap.get(recipient.certificate_id) || undefined,
            email_send_status: pdfUrl ? 'pending' : 'not_ready',
          });

          if (cert) {
            results.push(serializeCertificate(cert));
          } else {
            errors.push({ row: recipient.row, error: 'Insert failed' });
          }
        }
      } catch (pdfError) {
        console.error('[CertVault] PDF batch error:', pdfError);
        return res.status(getPdfGenerationErrorStatus(pdfError)).json({
          success: false,
          error: `PDF generation failed: ${pdfError.message}`,
        });
      }

      return res.status(200).json({
        success: true,
        generated: results.length,
        failed: errors.length,
        certificates: results,
        errors: errors.length > 0 ? errors : undefined,
        pdfsGenerated: results.filter((cert) => cert.pdf_url).length,
      });
    }

    // POST: Generate PDFs for certificates that don't have one
    if (action === 'generate-missing-pdfs') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
      }
      const club = await getClubFromRequest(req, convex);
      if (!club) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }
      const { eventId, template, settings } = req.body || {};
      if (!eventId || !template) {
        return res.status(400).json({ success: false, error: 'eventId and template are required' });
      }
      const event = await convex.query(api.events.getByIdAndOrg, { id: eventId, organization_id: club.organizationId });
      if (!event) {
        return res.status(404).json({ success: false, error: 'Event not found' });
      }
      const org = await convex.query(api.organizations.getById, { id: club.organizationId });
      const cloudinaryFolder = `certvault/${org?.slug || 'default'}/${event.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

      const allCerts = await convex.query(api.certificates.listByEventForOrg, { event_id: eventId, organization_id: club.organizationId });
      const needPdf = (allCerts || []).filter((c) => !c.pdf_url);
      if (needPdf.length === 0) {
        return res.status(200).json({ success: true, generated: 0, message: 'All certificates already have PDFs' });
      }

      const recipients = needPdf.map((c) => ({ name: c.recipient_name, certificate_id: c.certificate_id }));
      const resolvedTemplate = await resolveTemplateSource(template, event);
      const resolvedSettings = normalizeTemplateSettings(settings || event.template_settings || {}, req);
      const CHUNK_SIZE = 20;
      const pdfUrlMap = new Map();
      const publicIdMap = new Map();
      const allErrors = [];

      try {
        for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
          const chunk = recipients.slice(i, i + CHUNK_SIZE);
          const pdfResult = await generateCertificateBatch(resolvedTemplate, chunk, resolvedSettings, cloudinaryFolder);
          (pdfResult.results || []).forEach((r) => {
            if (r.pdf_url) pdfUrlMap.set(r.certificate_id, r.pdf_url);
            if (r.public_id) publicIdMap.set(r.certificate_id, r.public_id);
          });
          if (pdfResult.errors) {
            allErrors.push(...pdfResult.errors.map((e) => ({ name: e.recipient?.name || 'unknown', error: e.error })));
          }
        }
      } catch (e) {
        return res.status(getPdfGenerationErrorStatus(e)).json({
          success: false,
          error: `PDF generation failed: ${e.message}. Ensure certgen service is running and Cloudinary is configured.`,
        });
      }

      let generated = 0;
      for (const cert of needPdf) {
        const pdfUrl = pdfUrlMap.get(cert.certificate_id);
        const publicId = publicIdMap.get(cert.certificate_id);
        if (pdfUrl) {
          await convex.mutation(api.certificates.updatePdfByCertificateId, {
            certificate_id: cert.certificate_id,
            pdf_url: pdfUrl,
            cloudinary_public_id: publicId || undefined,
          });
          generated++;
        }
      }

      return res.status(200).json({
        success: true,
        generated,
        failed: allErrors.length,
        errors: allErrors.length > 0 ? allErrors : undefined,
      });
    }

    // POST: Regenerate PDFs for ALL certificates in an event
    if (action === 'regenerate-all-pdfs') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
      }
      const club = await getClubFromRequest(req, convex);
      if (!club) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }
      const { eventId, template, settings } = req.body || {};
      if (!eventId || !template) {
        return res.status(400).json({ success: false, error: 'eventId and template are required' });
      }
      const event = await convex.query(api.events.getByIdAndOrg, { id: eventId, organization_id: club.organizationId });
      if (!event) {
        return res.status(404).json({ success: false, error: 'Event not found' });
      }
      const org = await convex.query(api.organizations.getById, { id: club.organizationId });
      const cloudinaryFolder = `certvault/${org?.slug || 'default'}/${event.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

      const certs = await convex.query(api.certificates.listByEventForOrg, { event_id: eventId, organization_id: club.organizationId });
      const validCerts = (certs || []).filter((c) => c.status === 'valid');
      if (validCerts.length === 0) {
        return res.status(200).json({ success: true, generated: 0, message: 'No certificates to regenerate' });
      }

      const recipients = validCerts.map((c) => ({ name: c.recipient_name, certificate_id: c.certificate_id }));
      const resolvedTemplate = await resolveTemplateSource(template, event);
      const resolvedSettings = normalizeTemplateSettings(settings || event.template_settings || {}, req);
      const CHUNK_SIZE = 20;
      const pdfUrlMap = new Map();
      const publicIdMap = new Map();
      const allErrors = [];

      try {
        for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
          const chunk = recipients.slice(i, i + CHUNK_SIZE);
          const pdfResult = await generateCertificateBatch(resolvedTemplate, chunk, resolvedSettings, cloudinaryFolder);
          (pdfResult.results || []).forEach((r) => {
            if (r.pdf_url) pdfUrlMap.set(r.certificate_id, r.pdf_url);
            if (r.public_id) publicIdMap.set(r.certificate_id, r.public_id);
          });
          if (pdfResult.errors) {
            allErrors.push(...pdfResult.errors.map((e) => ({ name: e.recipient?.name || 'unknown', error: e.error })));
          }
        }
      } catch (e) {
        return res.status(getPdfGenerationErrorStatus(e)).json({
          success: false,
          error: `PDF generation failed: ${e.message}. Ensure certgen service is running and Cloudinary is configured.`,
        });
      }

      let generated = 0;
      for (const cert of validCerts) {
        const pdfUrl = pdfUrlMap.get(cert.certificate_id);
        const publicId = publicIdMap.get(cert.certificate_id);
        if (pdfUrl) {
          await convex.mutation(api.certificates.updatePdfByCertificateId, {
            certificate_id: cert.certificate_id,
            pdf_url: pdfUrl,
            cloudinary_public_id: publicId || undefined,
          });
          generated++;
        }
      }

      return res.status(200).json({
        success: true,
        generated,
        failed: allErrors.length,
        errors: allErrors.length > 0 ? allErrors : undefined,
      });
    }

    if (action === 'send-certificates') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
      }
      const club = await getClubFromRequest(req, convex);
      if (!club) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const { eventId, mailer_email, mailer_from_name, mailer_app_password, stream } = req.body || {};
      const wantsProgressStream = stream === true || req.headers?.accept === 'application/x-ndjson';
      if (!eventId) {
        return res.status(400).json({ success: false, error: 'eventId is required' });
      }

      const [event, org, certificates] = await Promise.all([
        convex.query(api.events.getByIdAndOrg, { id: eventId, organization_id: club.organizationId }),
        convex.query(api.organizations.getById, { id: club.organizationId }),
        convex.query(api.certificates.listByEvent, { event_id: eventId }),
      ]);

      if (!event) {
        return res.status(404).json({ success: false, error: 'Event not found' });
      }
      if (!org) {
        return res.status(404).json({ success: false, error: 'Organization not found' });
      }

      const runtimeMailerConfig = {
        mailer_email: typeof mailer_email === 'string' && mailer_email.trim() ? mailer_email.trim().toLowerCase() : undefined,
        mailer_from_name: typeof mailer_from_name === 'string' && mailer_from_name.trim() ? mailer_from_name.trim() : undefined,
        mailer_app_password: typeof mailer_app_password === 'string' && mailer_app_password.trim()
          ? mailer_app_password.replace(/\s+/g, '')
          : undefined,
      };
      const effectiveOrg = {
        ...org,
        ...(runtimeMailerConfig.mailer_email ? { mailer_email: runtimeMailerConfig.mailer_email } : {}),
        ...(runtimeMailerConfig.mailer_from_name ? { mailer_from_name: runtimeMailerConfig.mailer_from_name } : {}),
        ...(runtimeMailerConfig.mailer_app_password ? { mailer_app_password: runtimeMailerConfig.mailer_app_password } : {}),
      };

      const mailerProvider = getMailerProvider();
      let transporter = null;
      if (mailerProvider === 'gmail') {
        try {
          transporter = createOrgTransporter(org, runtimeMailerConfig);
        } catch (error) {
          return res.status(400).json({ success: false, error: error.message });
        }
      }

      const eligible = (certificates || []).filter((cert) =>
        cert.status === 'valid' &&
        cert.pdf_url &&
        isValidEmail(cert.recipient_email) &&
        cert.email_send_status !== 'sent'
      );

      const sent = [];
      const failed = [];
      const writeProgress = (payload) => {
        if (!wantsProgressStream) return;
        res.write(`${JSON.stringify(payload)}\n`);
      };

      if (wantsProgressStream) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('X-Accel-Buffering', 'no');
        writeProgress({
          type: 'start',
          provider: mailerProvider,
          total: eligible.length,
          sent: 0,
          failed: 0,
          delay_ms: mailerProvider === 'gmail' ? GMAIL_SEND_DELAY_MS : 0,
        });
      }

      let limitReached = false;
      for (let index = 0; index < eligible.length; index += 1) {
        const cert = eligible[index];
        writeProgress({
          type: 'progress',
          phase: 'sending',
          current: index + 1,
          total: eligible.length,
          sent: sent.length,
          failed: failed.length,
          certificate_id: cert.certificate_id,
          email: cert.recipient_email,
        });
        try {
          const info = mailerProvider === 'brevo'
            ? await sendCertificateEmailWithBrevo({ org: effectiveOrg, event, cert, req })
            : await sendCertificateEmail({ transporter, org: effectiveOrg, event, cert, req });
          await updateEmailDeliveryCompat(convex, {
            certificate_id: cert.certificate_id,
            email_send_status: 'sent',
            email_sent_at: new Date().toISOString(),
            email_message_id: info.messageId,
            email_last_error: undefined,
          });
          sent.push({ certificate_id: cert.certificate_id, email: cert.recipient_email, messageId: info.messageId });
          writeProgress({
            type: 'progress',
            phase: 'sent',
            current: index + 1,
            total: eligible.length,
            sent: sent.length,
            failed: failed.length,
            certificate_id: cert.certificate_id,
            email: cert.recipient_email,
          });
        } catch (error) {
          await updateEmailDeliveryCompat(convex, {
            certificate_id: cert.certificate_id,
            email_send_status: 'failed',
            email_last_error: error.message,
          });
          failed.push({ certificate_id: cert.certificate_id, email: cert.recipient_email, error: error.message });
          writeProgress({
            type: 'progress',
            phase: 'failed',
            current: index + 1,
            total: eligible.length,
            sent: sent.length,
            failed: failed.length,
            certificate_id: cert.certificate_id,
            email: cert.recipient_email,
            error: error.message,
            rate_limited: isLikelyMailerRateLimit(error),
          });
          if (isLikelyMailerRateLimit(error)) {
            limitReached = true;
            break;
          }
        }

        if (index < eligible.length - 1 && GMAIL_SEND_DELAY_MS > 0) {
          writeProgress({
            type: 'progress',
            phase: 'cooldown',
            current: index + 1,
            total: eligible.length,
            sent: sent.length,
            failed: failed.length,
            delay_ms: GMAIL_SEND_DELAY_MS,
          });
          await sleep(GMAIL_SEND_DELAY_MS);
        }
      }

      const responsePayload = {
        success: true,
        provider: mailerProvider,
        attempted: eligible.length,
        sent: sent.length,
        failed: failed.length,
        delay_ms: GMAIL_SEND_DELAY_MS,
        limit_reached: limitReached,
        results: { sent, failed },
      };

      if (wantsProgressStream) {
        writeProgress({ type: 'done', ...responsePayload });
        return res.end();
      }

      return res.status(200).json(responsePayload);
    }

    // PUBLIC: Proxy PDF (bypasses Cloudinary free-tier 401 on direct URLs)
    if (action === 'proxy-pdf') {
      const rawUrl = req.query?.url;
      const forceDownload = req.query?.download === '1' || req.query?.download === 'true';
      if (!rawUrl || typeof rawUrl !== 'string') {
        return res.status(400).send('Missing url parameter');
      }
      let targetUrl;
      try {
        targetUrl = decodeURIComponent(rawUrl);
      } catch {
        return res.status(400).send('Invalid url');
      }
      if (!targetUrl.startsWith('https://res.cloudinary.com/')) {
        return res.status(400).send('Only Cloudinary PDF URLs are allowed');
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const r = await fetch(targetUrl, { method: 'GET', redirect: 'follow', signal: controller.signal });
        clearTimeout(timeout);
        if (!r.ok) {
          const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>PDF Unavailable</title></head><body style="font-family:system-ui;max-width:480px;margin:80px auto;padding:24px;"><h1>PDF Unavailable</h1><p>Certificate PDFs are hosted on Cloudinary. Your account may restrict PDF delivery. Please ask the organizer to upgrade their Cloudinary plan or use a different storage option.</p><p><a href="javascript:history.back()">← Go back</a></p></body></html>`;
          res.setHeader('Content-Type', 'text/html');
          return res.status(200).send(html);
        }
        const buf = Buffer.from(await r.arrayBuffer());
        res.setHeader('Content-Type', 'application/pdf');
        // Use attachment for download links, inline for embeds/preview
        const disposition = forceDownload ? 'attachment' : 'inline';
        res.setHeader('Content-Disposition', `${disposition}; filename="certificate.pdf"`);
        res.setHeader('X-Frame-Options', 'SAMEORIGIN'); // Allow embedding in iframe on same origin
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.send(buf);
      } catch (e) {
        clearTimeout(timeout);
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Error</title></head><body style="font-family:system-ui;max-width:480px;margin:80px auto;padding:24px;"><h1>Could not load PDF</h1><p>${String(e.message || 'Proxy failed').replace(/</g, '&lt;')}</p><p><a href="javascript:history.back()">← Go back</a></p></body></html>`;
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(html);
      }
      return;
    }

    // =====================
    // PUBLIC ENDPOINTS
    // =====================

    // PUBLIC: Verify certificate
    if (action === 'verify') {
      const certificateId = (req.query?.certificate_id || req.body?.certificate_id || '').trim();
      
      if (!certificateId) {
        return res.status(400).json({ valid: false, error: 'Certificate ID required' });
      }

      const cert = await convex.query(api.certificates.getByCertificateId, { certificate_id: certificateId });

      if (!cert) {
        return res.status(200).json({ valid: false });
      }

      if (cert.status === 'revoked') {
        return res.status(200).json({
          valid: false,
          revoked: true,
          message: 'This certificate has been revoked'
        });
      }

      const event = await convex.query(api.events.getById, { id: cert.event_id });
      const org = event ? await convex.query(api.organizations.getById, { id: cert.organization_id }) : null;

      return res.status(200).json({
        valid: true,
        certificate_id: cert.certificate_id,
        recipient_name: cert.recipient_name,
        category: cert.category,
        date_issued: cert.date_issued,
        event_name: event?.name,
        event_date: event?.event_date,
        issuing_organization: org?.name,
        pdf_url: cert.pdf_url,
      });
    }

    // PUBLIC: Match names / email and return certificates for download (no auth)
    if (action === 'public-download') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
      }
      const { eventSlug, names } = req.body || {};
      if (!eventSlug || !names || !Array.isArray(names)) {
        return res.status(400).json({ success: false, error: 'eventSlug and names array are required' });
      }
      const slug = String(eventSlug).trim().toLowerCase();
      const event = await convex.query(api.events.getByDownloadSlug, { download_slug: slug });
      if (!event) {
        return res.status(404).json({ success: false, error: 'Event not found' });
      }
      const certificates = await convex.query(api.certificates.listByEventId, { event_id: event._id });
      const validCerts = (certificates || []).filter((c) => c.status === 'valid');

      const queries = (names || [])
        .map((n) => String(n || '').trim().toLowerCase())
        .filter(Boolean);
      const querySet = new Set(queries);

      const matched = validCerts.filter((c) => {
        const rn = String(c.recipient_name || '').trim().toLowerCase();
        const re = String(c.recipient_email || '').trim().toLowerCase();
        return querySet.has(rn) || (re && querySet.has(re));
      });

      const notFound = queries.filter((q) => !validCerts.some((c) => {
        const rn = String(c.recipient_name || '').trim().toLowerCase();
        const re = String(c.recipient_email || '').trim().toLowerCase();
        return q === rn || (re && q === re);
      }));

      return res.status(200).json({
        success: true,
        event: { id: event._id, name: event.name },
        matched: matched.map(serializeCertificate),
        notFound,
      });
    }

    // PROTECTED: Upload PDF to Cloudinary
    if (action === 'upload') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
      }

      // Check Cloudinary configuration
      if (!isCloudinaryConfigured()) {
        return res.status(503).json({
          success: false,
          error: 'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET'
        });
      }

      const {
        certificateId,
        organizationSlug,
        eventSlug,
        pdfBase64,
        pdfBuffer
      } = req.body;

      if (!certificateId || !organizationSlug || !eventSlug) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: certificateId, organizationSlug, eventSlug'
        });
      }

      if (!pdfBase64 && !pdfBuffer) {
        return res.status(400).json({
          success: false,
          error: 'Missing PDF data: provide pdfBase64 or pdfBuffer'
        });
      }

      // Write PDF to temp file
      const tempFilePath = join(tmpdir(), `${certificateId}.pdf`);
      const pdfData = pdfBase64 
        ? Buffer.from(pdfBase64, 'base64') 
        : Buffer.from(pdfBuffer);
      
      await writeFile(tempFilePath, pdfData);

      try {
        // Upload to Cloudinary
        const { secure_url, public_id } = await uploadCertificate(
          tempFilePath,
          organizationSlug,
          eventSlug,
          certificateId
        );

        // Delete temp file
        await unlink(tempFilePath);

        return res.status(200).json({
          success: true,
          pdf_url: secure_url,
          cloudinary_public_id: public_id
        });
      } catch (uploadError) {
        // Clean up temp file on error
        try {
          await unlink(tempFilePath);
        } catch {}

        return res.status(500).json({
          success: false,
          error: uploadError.message
        });
      }
    }

    // PROTECTED: Revoke certificate
    if (action === 'revoke') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
      }

      const { certificateId } = req.body;

      if (!certificateId) {
        return res.status(400).json({
          success: false,
          error: 'certificateId required'
        });
      }

      const updated = await convex.mutation(api.certificates.updateStatus, {
        certificate_id: certificateId,
        status: 'revoked',
      });

      if (!updated) {
        return res.status(404).json({ success: false, error: 'Certificate not found' });
      }

      return res.status(200).json({
        success: true,
        message: 'Certificate revoked successfully'
      });
    }

    // PROTECTED: Delete certificate (revoke + delete from Cloudinary)
    if (action === 'delete') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
      }

      const { certificateId } = req.body;

      if (!certificateId) {
        return res.status(400).json({
          success: false,
          error: 'certificateId required'
        });
      }

      const cert = await convex.query(api.certificates.getByCertificateId, { certificate_id: certificateId });

      if (!cert) {
        return res.status(404).json({
          success: false,
          error: 'Certificate not found'
        });
      }

      if (cert.cloudinary_public_id && isCloudinaryConfigured()) {
        try {
          await deleteCertificate(cert.cloudinary_public_id);
        } catch (cloudinaryError) {
          console.error('[CertVault] Cloudinary delete error:', cloudinaryError);
        }
      }

      await convex.mutation(api.certificates.deleteByCertificateId, { certificate_id: certificateId });

      return res.status(200).json({
        success: true,
        message: 'Certificate deleted successfully'
      });
    }

    // POST: Match names / email against event certificates and return matched certificates for download
    if (action === 'match-certificates') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
      }

      const club = await getClubFromRequest(req, convex);
      if (!club) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const { eventId, names } = req.body || {};
      if (!eventId || !names || !Array.isArray(names)) {
        return res.status(400).json({ success: false, error: 'eventId and names array are required' });
      }

      const event = await convex.query(api.events.getByIdAndOrg, { id: eventId, organization_id: club.organizationId });

      if (!event) {
        return res.status(404).json({ success: false, error: 'Event not found' });
      }

      const certificates = await convex.query(api.certificates.listByEvent, { event_id: eventId });

      const queries = (names || [])
        .map((n) => String(n || '').trim().toLowerCase())
        .filter(Boolean);
      const querySet = new Set(queries);

      const matched = (certificates || []).filter((c) => {
        const rn = String(c.recipient_name || '').trim().toLowerCase();
        const re = String(c.recipient_email || '').trim().toLowerCase();
        return querySet.has(rn) || (re && querySet.has(re));
      });

      const notFound = queries.filter((q) => !(certificates || []).some((c) => {
        const rn = String(c.recipient_name || '').trim().toLowerCase();
        const re = String(c.recipient_email || '').trim().toLowerCase();
        return q === rn || (re && q === re);
      }));

      return res.status(200).json({
        success: true,
        event: { id: event._id, name: event.name },
        matched: matched.map(serializeCertificate),
        notFound,
      });
    }

    return res.status(400).json({
      error: 'Invalid action. Available actions: signup, login, passkey-registration-options, passkey-registration-verify, passkey-authentication-options, passkey-authentication-verify, me, mailer-config, template-config, template-preview, send-status, create-event, list-events, delete-event, set-download-slug, list-certificates, generate, generate-missing-pdfs, regenerate-all-pdfs, send-certificates, verify, proxy-pdf, upload, revoke, delete, match-certificates, public-download'
    });

  } catch (err) {
    console.error('[CertVault API]', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: err.message
    });
  }
}
