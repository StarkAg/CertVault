/**
 * CertVault API
 * 
 * Public endpoints:
 *  - GET /api/certvault?action=verify&certificate_id=XXX - verify certificate
 * 
 * Club auth endpoints:
 *  - POST /api/certvault?action=signup - club signup
 *  - POST /api/certvault?action=login - club login
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

import { createClient } from '@supabase/supabase-js';
import { uploadCertificate, deleteCertificate, isCloudinaryConfigured } from '../lib/cloudinary.js';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import crypto from 'crypto';

// Supabase client (service_role for backend operations)
const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

// Certificate generator service URL (Flask service on same server)
const CERTGEN_SERVICE_URL = process.env.CERTGEN_SERVICE_URL || 'http://localhost:5050';

/**
 * Call the certificate generator service to create PDF
 */
async function generateCertificatePDF(template, recipientName, certificateId, settings, cloudinaryFolder) {
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
    console.error('[CertVault] PDF generation error:', err.message);
    throw err;
  }
}

/**
 * Call the certificate generator service for batch generation
 */
async function generateCertificateBatch(template, recipients, settings, cloudinaryFolder) {
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
    console.error('[CertVault] Batch PDF generation error:', err.message);
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
 * Extract and verify club from Authorization header
 */
function getClubFromRequest(req) {
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

  const needsSupabase = action !== 'proxy-pdf';
  const missingEnv = [];
  if (needsSupabase) {
    if (!process.env.SUPABASE_URL) missingEnv.push('SUPABASE_URL');
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missingEnv.push('SUPABASE_SERVICE_ROLE_KEY');
  }
  if (missingEnv.length) {
    console.error('[CertVault] Missing required env:', missingEnv.join(', '));
    return res.status(500).json({
      success: false,
      error: 'CertVault server misconfigured. Missing environment variables.',
      missing: missingEnv,
    });
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

      // Check if email already exists
      const { data: existing } = await supabase
        .from('certvault_organizations')
        .select('id')
        .eq('email', emailTrim)
        .maybeSingle();

      if (existing) {
        return res.status(400).json({ success: false, error: 'Email already registered' });
      }

      // Create organization
      const { data: org, error } = await supabase
        .from('certvault_organizations')
        .insert({
          name: nameTrim,
          slug,
          email: emailTrim,
          password_hash: password,
        })
        .select()
        .single();

      if (error) {
        console.error('[CertVault] Signup error:', error);
        return res.status(500).json({ success: false, error: error.message });
      }

      // Create token
      const token = createClubToken(org.id, org.email, org.slug);

      return res.status(200).json({
        success: true,
        token,
        organization: {
          id: org.id,
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
      
      if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email and password are required' });
      }

      const emailTrim = email.trim().toLowerCase();

      // Find organization
      const { data: org, error } = await supabase
        .from('certvault_organizations')
        .select('id, name, slug, email, password_hash')
        .eq('email', emailTrim)
        .maybeSingle();

      if (error || !org) {
        return res.status(401).json({ success: false, error: 'Invalid email or password' });
      }

      // Verify password (direct comparison)
      if (org.password_hash !== password) {
        return res.status(401).json({ success: false, error: 'Invalid email or password' });
      }

      // Create token
      const token = createClubToken(org.id, org.email, org.slug);

      return res.status(200).json({
        success: true,
        token,
        organization: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          email: org.email,
        },
      });
    }

    // GET: Get current club info
    if (action === 'me') {
      const club = getClubFromRequest(req);
      if (!club) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const { data: org } = await supabase
        .from('certvault_organizations')
        .select('id, name, slug, email, created_at')
        .eq('id', club.organizationId)
        .single();

      if (!org) {
        return res.status(404).json({ success: false, error: 'Organization not found' });
      }

      return res.status(200).json({ success: true, organization: org });
    }

    // =====================
    // EVENT ENDPOINTS
    // =====================

    // POST: Create event
    if (action === 'create-event') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
      }

      const club = getClubFromRequest(req);
      if (!club) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const { name, event_date, download_slug } = req.body || {};
      
      if (!name) {
        return res.status(400).json({ success: false, error: 'Event name is required' });
      }

      const slug = typeof download_slug === 'string' ? download_slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '') || null : null;

      const { data: event, error } = await supabase
        .from('certvault_events')
        .insert({
          organization_id: club.organizationId,
          name: name.trim(),
          event_date: event_date || null,
          download_slug: slug || null,
        })
        .select()
        .single();

      if (error) {
        console.error('[CertVault] Create event error:', error);
        return res.status(500).json({ success: false, error: error.message });
      }

      return res.status(200).json({ success: true, event });
    }

    // GET: List events for organization
    if (action === 'list-events') {
      const club = getClubFromRequest(req);
      if (!club) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const { data: events, error } = await supabase
        .from('certvault_events')
        .select('id, name, event_date, download_slug, created_at')
        .eq('organization_id', club.organizationId)
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }

      // Get certificate counts for each event
      const eventsWithCounts = await Promise.all(events.map(async (event) => {
        const { count } = await supabase
          .from('certvault_certificates')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', event.id);
        return { ...event, certificate_count: count || 0 };
      }));

      return res.status(200).json({ success: true, events: eventsWithCounts });
    }

    // DELETE: Delete event (and all its certificates)
    if (action === 'delete-event') {
      if (req.method !== 'POST' && req.method !== 'DELETE') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
      }

      const club = getClubFromRequest(req);
      if (!club) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const eventId = req.body?.eventId || req.query?.eventId;
      if (!eventId) {
        return res.status(400).json({ success: false, error: 'eventId is required' });
      }

      // Verify event belongs to this organization
      const { data: event } = await supabase
        .from('certvault_events')
        .select('id')
        .eq('id', eventId)
        .eq('organization_id', club.organizationId)
        .single();

      if (!event) {
        return res.status(404).json({ success: false, error: 'Event not found' });
      }

      // Delete event (certificates will cascade delete)
      const { error } = await supabase
        .from('certvault_events')
        .delete()
        .eq('id', eventId);

      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }

      return res.status(200).json({ success: true, message: 'Event deleted' });
    }

    // POST: Set download slug for event (public page like /certvault/hize)
    if (action === 'set-download-slug') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
      }
      const club = getClubFromRequest(req);
      if (!club) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }
      const { eventId, download_slug } = req.body || {};
      if (!eventId) {
        return res.status(400).json({ success: false, error: 'eventId is required' });
      }
      const slug = typeof download_slug === 'string' ? download_slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '') || null : null;
      const { data: event, error } = await supabase
        .from('certvault_events')
        .update({ download_slug: slug })
        .eq('id', eventId)
        .eq('organization_id', club.organizationId)
        .select()
        .single();
      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }
      if (!event) {
        return res.status(404).json({ success: false, error: 'Event not found' });
      }
      return res.status(200).json({ success: true, event });
    }

    // =====================
    // CERTIFICATE ENDPOINTS
    // =====================

    // GET: List certificates for an event
    if (action === 'list-certificates') {
      const club = getClubFromRequest(req);
      if (!club) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const eventId = req.query?.eventId;
      if (!eventId) {
        return res.status(400).json({ success: false, error: 'eventId is required' });
      }

      // Verify event belongs to this organization
      const { data: event } = await supabase
        .from('certvault_events')
        .select('id, name')
        .eq('id', eventId)
        .eq('organization_id', club.organizationId)
        .single();

      if (!event) {
        return res.status(404).json({ success: false, error: 'Event not found' });
      }

      const { data: certificates, error } = await supabase
        .from('certvault_certificates')
        .select('id, certificate_id, recipient_name, recipient_email, category, date_issued, status, pdf_url')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }

      return res.status(200).json({ success: true, event, certificates });
    }

    // POST: Generate certificates from recipient list (with optional PDF generation)
    if (action === 'generate') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
      }

      const club = getClubFromRequest(req);
      if (!club) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const { eventId, recipients, template, settings, generatePdf } = req.body || {};
      
      if (!eventId || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'eventId and recipients array are required' 
        });
      }

      // Verify event belongs to this organization
      const { data: event } = await supabase
        .from('certvault_events')
        .select('id, name')
        .eq('id', eventId)
        .eq('organization_id', club.organizationId)
        .single();

      if (!event) {
        return res.status(404).json({ success: false, error: 'Event not found' });
      }

      // Get organization info for Cloudinary folder
      const { data: org } = await supabase
        .from('certvault_organizations')
        .select('slug')
        .eq('id', club.organizationId)
        .single();

      const cloudinaryFolder = `certvault/${org?.slug || 'default'}/${event.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

      // Generate certificates for each recipient
      const results = [];
      const errors = [];

      // If template provided and generatePdf is true, use batch PDF generation
      if (template && generatePdf) {
        try {
          // Prepare recipients with certificate IDs
          const recipientsWithIds = recipients.map(r => ({
            name: r.name?.trim(),
            certificate_id: generateCertificateId(),
            email: r.email,
            category: r.category || 'Participant',
          })).filter(r => r.name);

          // Process in chunks of 50 to avoid timeouts
          const CHUNK_SIZE = 20;
          const pdfUrlMap = new Map();
          let totalPdfsGenerated = 0;

          for (let i = 0; i < recipientsWithIds.length; i += CHUNK_SIZE) {
            const chunk = recipientsWithIds.slice(i, i + CHUNK_SIZE);
            console.log(`[CertVault] Processing chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(recipientsWithIds.length / CHUNK_SIZE)} (${chunk.length} certificates)`);

            const pdfResult = await generateCertificateBatch(
              template,
              chunk.map(r => ({ name: r.name, certificate_id: r.certificate_id })),
              settings,
              cloudinaryFolder
            );

            (pdfResult.results || []).forEach(r => {
              if (r.pdf_url) pdfUrlMap.set(r.certificate_id, r.pdf_url);
            });
            totalPdfsGenerated += (pdfResult.generated || 0);
          }

          // Insert certificates into database with PDF URLs
          for (const recipient of recipientsWithIds) {
            const pdfUrl = pdfUrlMap.get(recipient.certificate_id);

            const { data: cert, error } = await supabase
              .from('certvault_certificates')
              .insert({
                certificate_id: recipient.certificate_id,
                event_id: eventId,
                organization_id: club.organizationId,
                recipient_name: recipient.name,
                recipient_email: recipient.email ? recipient.email.trim().toLowerCase() : null,
                category: recipient.category,
                status: 'valid',
                pdf_url: pdfUrl || null,
              })
              .select()
              .single();

            if (error) {
              errors.push({ recipient, error: error.message });
            } else {
              results.push(cert);
            }
          }

          return res.status(200).json({
            success: true,
            generated: results.length,
            failed: errors.length,
            certificates: results,
            errors: errors.length > 0 ? errors : undefined,
            pdfsGenerated: totalPdfsGenerated,
          });

        } catch (pdfError) {
          console.error('[CertVault] PDF batch error:', pdfError);
          // Fall through to generate without PDFs
          return res.status(500).json({
            success: false,
            error: `PDF generation failed: ${pdfError.message}. Try without PDF generation.`
          });
        }
      }

      // Standard generation without PDFs
      for (const recipient of recipients) {
        const { name, email, category } = recipient;
        
        if (!name) {
          errors.push({ recipient, error: 'Name is required' });
          continue;
        }

        const certificateId = generateCertificateId();

        const { data: cert, error } = await supabase
          .from('certvault_certificates')
          .insert({
            certificate_id: certificateId,
            event_id: eventId,
            organization_id: club.organizationId,
            recipient_name: name.trim(),
            recipient_email: email ? email.trim().toLowerCase() : null,
            category: category || 'Participant',
            status: 'valid',
          })
          .select()
          .single();

        if (error) {
          errors.push({ recipient, error: error.message });
        } else {
          results.push(cert);
        }
      }

      return res.status(200).json({
        success: true,
        generated: results.length,
        failed: errors.length,
        certificates: results,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    // POST: Generate PDFs for certificates that don't have one
    if (action === 'generate-missing-pdfs') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
      }
      const club = getClubFromRequest(req);
      if (!club) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }
      const { eventId, template, settings } = req.body || {};
      if (!eventId || !template) {
        return res.status(400).json({ success: false, error: 'eventId and template are required' });
      }
      const { data: event } = await supabase
        .from('certvault_events')
        .select('id, name')
        .eq('id', eventId)
        .eq('organization_id', club.organizationId)
        .single();
      if (!event) {
        return res.status(404).json({ success: false, error: 'Event not found' });
      }
      const { data: org } = await supabase
        .from('certvault_organizations')
        .select('slug')
        .eq('id', club.organizationId)
        .single();
      const cloudinaryFolder = `certvault/${org?.slug || 'default'}/${event.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

      const { data: allCerts } = await supabase
        .from('certvault_certificates')
        .select('id, certificate_id, recipient_name, pdf_url')
        .eq('event_id', eventId)
        .eq('organization_id', club.organizationId)
        .eq('status', 'valid');

      const needPdf = (allCerts || []).filter(c => !c.pdf_url);
      if (needPdf.length === 0) {
        return res.status(200).json({ success: true, generated: 0, message: 'All certificates already have PDFs' });
      }

      const recipients = needPdf.map(c => ({ name: c.recipient_name, certificate_id: c.certificate_id }));
      
      // Process in chunks of 50 to avoid timeouts
      const CHUNK_SIZE = 20;
      const pdfUrlMap = new Map();
      const allErrors = [];

      try {
        for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
          const chunk = recipients.slice(i, i + CHUNK_SIZE);
          console.log(`[CertVault] Generate-missing: Processing chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(recipients.length / CHUNK_SIZE)} (${chunk.length} PDFs)`);

          const pdfResult = await generateCertificateBatch(template, chunk, settings || {}, cloudinaryFolder);
          (pdfResult.results || []).forEach(r => {
            if (r.pdf_url) pdfUrlMap.set(r.certificate_id, r.pdf_url);
          });
          if (pdfResult.errors) {
            allErrors.push(...pdfResult.errors.map(e => ({ name: e.recipient?.name || 'unknown', error: e.error })));
          }
        }
      } catch (e) {
        return res.status(500).json({
          success: false,
          error: `PDF generation failed: ${e.message}. Ensure certgen service is running and Cloudinary is configured.`,
        });
      }

      let generated = 0;
      const errs = allErrors;

      for (const cert of needPdf) {
        const pdfUrl = pdfUrlMap.get(cert.certificate_id);
        if (pdfUrl) {
          await supabase
            .from('certvault_certificates')
            .update({ pdf_url: pdfUrl })
            .eq('id', cert.id);
          generated++;
        }
      }

      return res.status(200).json({
        success: true,
        generated,
        failed: errs.length,
        errors: errs.length > 0 ? errs : undefined,
      });
    }

    // POST: Regenerate PDFs for ALL certificates in an event
    if (action === 'regenerate-all-pdfs') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
      }
      const club = getClubFromRequest(req);
      if (!club) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }
      const { eventId, template, settings } = req.body || {};
      if (!eventId || !template) {
        return res.status(400).json({ success: false, error: 'eventId and template are required' });
      }
      const { data: event } = await supabase
        .from('certvault_events')
        .select('id, name')
        .eq('id', eventId)
        .eq('organization_id', club.organizationId)
        .single();
      if (!event) {
        return res.status(404).json({ success: false, error: 'Event not found' });
      }
      const { data: org } = await supabase
        .from('certvault_organizations')
        .select('slug')
        .eq('id', club.organizationId)
        .single();
      const cloudinaryFolder = `certvault/${org?.slug || 'default'}/${event.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

      const { data: allCerts } = await supabase
        .from('certvault_certificates')
        .select('id, certificate_id, recipient_name, pdf_url')
        .eq('event_id', eventId)
        .eq('organization_id', club.organizationId)
        .eq('status', 'valid');

      const certs = allCerts || [];
      if (certs.length === 0) {
        return res.status(200).json({ success: true, generated: 0, message: 'No certificates to regenerate' });
      }

      const recipients = certs.map(c => ({ name: c.recipient_name, certificate_id: c.certificate_id }));
      
      // Process in chunks of 50 to avoid timeouts
      const CHUNK_SIZE = 20;
      const pdfUrlMap = new Map();
      const allErrors = [];

      try {
        for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
          const chunk = recipients.slice(i, i + CHUNK_SIZE);
          console.log(`[CertVault] Regenerate-all: Processing chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(recipients.length / CHUNK_SIZE)} (${chunk.length} PDFs)`);

          const pdfResult = await generateCertificateBatch(template, chunk, settings || {}, cloudinaryFolder);
          (pdfResult.results || []).forEach(r => {
            if (r.pdf_url) pdfUrlMap.set(r.certificate_id, r.pdf_url);
          });
          if (pdfResult.errors) {
            allErrors.push(...pdfResult.errors.map(e => ({ name: e.recipient?.name || 'unknown', error: e.error })));
          }
        }
      } catch (e) {
        return res.status(500).json({
          success: false,
          error: `PDF generation failed: ${e.message}. Ensure certgen service is running and Cloudinary is configured.`,
        });
      }

      let generated = 0;
      const errs = allErrors;

      for (const cert of certs) {
        const pdfUrl = pdfUrlMap.get(cert.certificate_id);
        if (pdfUrl) {
          await supabase
            .from('certvault_certificates')
            .update({ pdf_url: pdfUrl })
            .eq('id', cert.id);
          generated++;
        }
      }

      return res.status(200).json({
        success: true,
        generated,
        failed: errs.length,
        errors: errs.length > 0 ? errs : undefined,
      });
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

      // Query certificate from database
      const { data: cert, error } = await supabase
        .from('certvault_certificates')
        .select(`
          certificate_id,
          recipient_name,
          recipient_email,
          category,
          date_issued,
          status,
          pdf_url,
          certvault_events (
            name,
            event_date,
            certvault_organizations (
              name
            )
          )
        `)
        .eq('certificate_id', certificateId)
        .single();

      if (error || !cert) {
        return res.status(200).json({ valid: false });
      }

      // Check if revoked
      if (cert.status === 'revoked') {
        return res.status(200).json({
          valid: false,
          revoked: true,
          message: 'This certificate has been revoked'
        });
      }

      // Return certificate details
      return res.status(200).json({
        valid: true,
        certificate_id: cert.certificate_id,
        recipient_name: cert.recipient_name,
        category: cert.category,
        date_issued: cert.date_issued,
        event_name: cert.certvault_events?.name,
        event_date: cert.certvault_events?.event_date,
        issuing_organization: cert.certvault_events?.certvault_organizations?.name,
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
      const { data: event } = await supabase
        .from('certvault_events')
        .select('id, name')
        .eq('download_slug', slug)
        .single();
      if (!event) {
        return res.status(404).json({ success: false, error: 'Event not found' });
      }
      const { data: certificates, error } = await supabase
        .from('certvault_certificates')
        .select('id, certificate_id, recipient_name, recipient_email, category, status, pdf_url')
        .eq('event_id', event.id)
        .eq('status', 'valid');
      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }

      // Treat each entry as either a name OR an email, case-insensitive
      const queries = (names || [])
        .map(n => String(n || '').trim().toLowerCase())
        .filter(Boolean);
      const querySet = new Set(queries);

      const matched = (certificates || []).filter(c => {
        const rn = String(c.recipient_name || '').trim().toLowerCase();
        const re = String(c.recipient_email || '').trim().toLowerCase();
        return querySet.has(rn) || (re && querySet.has(re));
      });

      const notFound = queries.filter(q => !(certificates || []).some(c => {
        const rn = String(c.recipient_name || '').trim().toLowerCase();
        const re = String(c.recipient_email || '').trim().toLowerCase();
        return q === rn || (re && q === re);
      }));
      return res.status(200).json({
        success: true,
        event: { id: event.id, name: event.name },
        matched,
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

      // Update status to revoked
      const { error } = await supabase
        .from('certvault_certificates')
        .update({ status: 'revoked' })
        .eq('certificate_id', certificateId);

      if (error) {
        return res.status(500).json({
          success: false,
          error: error.message
        });
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

      // Get certificate with cloudinary_public_id
      const { data: cert, error: fetchError } = await supabase
        .from('certvault_certificates')
        .select('cloudinary_public_id')
        .eq('certificate_id', certificateId)
        .single();

      if (fetchError || !cert) {
        return res.status(404).json({
          success: false,
          error: 'Certificate not found'
        });
      }

      // Delete from Cloudinary if public_id exists
      if (cert.cloudinary_public_id && isCloudinaryConfigured()) {
        try {
          await deleteCertificate(cert.cloudinary_public_id);
        } catch (cloudinaryError) {
          console.error('[CertVault] Cloudinary delete error:', cloudinaryError);
          // Continue with database deletion even if Cloudinary fails
        }
      }

      // Delete from database
      const { error: deleteError } = await supabase
        .from('certvault_certificates')
        .delete()
        .eq('certificate_id', certificateId);

      if (deleteError) {
        return res.status(500).json({
          success: false,
          error: deleteError.message
        });
      }

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

      const club = getClubFromRequest(req);
      if (!club) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const { eventId, names } = req.body || {};
      if (!eventId || !names || !Array.isArray(names)) {
        return res.status(400).json({ success: false, error: 'eventId and names array are required' });
      }

      const { data: event } = await supabase
        .from('certvault_events')
        .select('id, name')
        .eq('id', eventId)
        .eq('organization_id', club.organizationId)
        .single();

      if (!event) {
        return res.status(404).json({ success: false, error: 'Event not found' });
      }

      const { data: certificates, error } = await supabase
        .from('certvault_certificates')
        .select('id, certificate_id, recipient_name, recipient_email, category, status, pdf_url')
        .eq('event_id', eventId);

      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }

      // Treat each entry as either a name OR an email, case-insensitive
      const queries = (names || [])
        .map(n => String(n || '').trim().toLowerCase())
        .filter(Boolean);
      const querySet = new Set(queries);

      const matched = (certificates || []).filter(c => {
        const rn = String(c.recipient_name || '').trim().toLowerCase();
        const re = String(c.recipient_email || '').trim().toLowerCase();
        return querySet.has(rn) || (re && querySet.has(re));
      });

      const notFound = queries.filter(q => !(certificates || []).some(c => {
        const rn = String(c.recipient_name || '').trim().toLowerCase();
        const re = String(c.recipient_email || '').trim().toLowerCase();
        return q === rn || (re && q === re);
      }));

      return res.status(200).json({
        success: true,
        event: { id: event.id, name: event.name },
        matched,
        notFound,
      });
    }

    return res.status(400).json({
      error: 'Invalid action. Available actions: signup, login, me, create-event, list-events, delete-event, set-download-slug, list-certificates, generate, generate-missing-pdfs, regenerate-all-pdfs, verify, proxy-pdf, upload, revoke, delete, match-certificates, public-download'
    });

  } catch (err) {
    console.error('[CertVault API]', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: err.message
    });
  }
}
