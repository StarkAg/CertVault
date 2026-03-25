/**
 * Ultron 9.0 API endpoint
 * Handles hackathon management: CSV upload, QR generation, check-in, food distribution, reviews
 */

import { supabaseAdmin, isSupabaseConfigured, supabase } from '../lib/api-utils/supabase-client.js';
import QRCode from 'qrcode';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import crypto from 'crypto';

const require = createRequire(import.meta.url);
const { teamIdToEncryptedCode } = require('../lib/ultron-team-code.cjs');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -----------------------------------------------------------------------------
// QR payload encryption (team_name -> token) so QR does NOT expose team_id.
// -----------------------------------------------------------------------------
// QR payload format (JSON string): { t: "<base64url(iv||tag||ciphertext)>" }
// Backwards compatible: old QR payloads with `{team_id}` or plain TEAM_ID still work.
//
// IMPORTANT: Set `ULTRON_QR_SECRET` in the backend environment.

let ultronQrSecretFallbackWarned = false;

function base64UrlEncode(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(str) {
  const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (s.length % 4)) % 4;
  return Buffer.from(s + '='.repeat(padLen), 'base64');
}

function getUltronQrKey() {
  // Prefer dedicated QR secret, but fall back to other server secrets so the system
  // still works even if ULTRON_QR_SECRET isn't configured yet.
  const secret =
    process.env.ULTRON_QR_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.EMAIL_PASS;

  if (!secret || typeof secret !== 'string' || secret.trim() === '') return null;

  if (!process.env.ULTRON_QR_SECRET && !ultronQrSecretFallbackWarned) {
    ultronQrSecretFallbackWarned = true;
    console.warn('[Ultron] ULTRON_QR_SECRET not set; using fallback secret for QR encryption.');
  }

  return crypto.createHash('sha256').update(secret, 'utf8').digest(); // 32 bytes
}

function encryptTeamName(teamName) {
  const key = getUltronQrKey();
  if (!key) throw new Error('ULTRON_QR_SECRET is not configured on the server');

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(teamName), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag(); // 16 bytes

  return base64UrlEncode(Buffer.concat([iv, tag, ciphertext]));
}

function decryptTeamName(token) {
  const key = getUltronQrKey();
  if (!key) throw new Error('ULTRON_QR_SECRET is not configured on the server');

  const raw = base64UrlDecode(token);
  if (raw.length < 12 + 16 + 1) throw new Error('Invalid QR token');

  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

function isTenDigitCode(str) {
  return typeof str === 'string' && /^\d{10}$/.test(str.trim());
}

async function lookupTeamIdByEncryptedCode(code) {
  const c = String(code || '').trim();
  if (!/^\d{10}$/.test(c)) return null;
  const { data: teams, error } = await supabaseAdmin
    .from('ultron_teams')
    .select('team_id')
    .eq('team_name_encrypted', c)
    .limit(2);
  if (error) throw error;
  if (!teams || teams.length === 0) return null;
  if (teams.length > 1) throw new Error('Duplicate team_name_encrypted found. Please contact admin.');
  return teams[0].team_id.toString().toUpperCase().trim();
}

async function lookupTeamIdByTeamId(teamId) {
  const tid = String(teamId || '').toUpperCase().trim();
  if (!tid) return null;
  const { data, error } = await supabaseAdmin
    .from('ultron_teams')
    .select('team_id')
    .eq('team_id', tid)
    .limit(1);
  if (error) throw error;
  if (!data || data.length === 0) return null;
  return data[0].team_id.toString().toUpperCase().trim();
}

async function lookupTeamIdByTeamNameExact(teamName) {
  const tn = String(teamName || '').trim();
  if (!tn) return null;
  // NOTE: ilike is case-insensitive; since we pass a literal string (no %),
  // this behaves like case-insensitive equality for most inputs.
  const { data, error } = await supabaseAdmin
    .from('ultron_teams')
    .select('team_id, team_name')
    .ilike('team_name', tn)
    .limit(2);
  if (error) throw error;
  if (!data || data.length === 0) return null;
  if (data.length > 1) {
    throw new Error('Multiple teams match this name. Use 10-digit code or ULTRON ID.');
  }
  return data[0].team_id.toString().toUpperCase().trim();
}

/** Extract "code" from qr_payload or team_id. Handles JSON { code, team_id }. */
function extractCode(team_id, qr_payload) {
  const raw = (qr_payload || team_id || '').toString().trim();
  if (!raw) return null;
  if (!raw.startsWith('{')) return raw;
  try {
    const p = JSON.parse(raw);
    const c = (p.code || p.team_id || '').toString().trim();
    return c || null;
  } catch {
    return raw;
  }
}

/**
 * Resolve team_id from:
 * - 10-digit code (team_name_encrypted)
 * - ULTRON### team_id
 * - exact team_name (case-insensitive)
 */
async function resolveTeamIdFromPayload({ qr_payload }) {
  const code = extractCode(null, qr_payload);
  if (!code) return null;

  // 10-digit code
  if (isTenDigitCode(code)) {
    return await lookupTeamIdByEncryptedCode(code);
  }

  // ULTRON### team id
  const upper = String(code).toUpperCase().trim();
  if (/^ULTRON\d{3}$/.test(upper)) {
    // Verify it exists (prevents accidental check-ins for typos)
    return await lookupTeamIdByTeamId(upper);
  }

  // Direct team_id fallback (if someone enters ULTRON001 etc with extra spaces handled above)
  const byId = await lookupTeamIdByTeamId(upper);
  if (byId) return byId;

  // Team name (exact, case-insensitive)
  return await lookupTeamIdByTeamNameExact(code);
}

// Direct QR download endpoint
async function handleDownloadQR(req, res) {
  const { team_id } = req.query;
  
  if (!team_id) {
    return res.status(400).json({ error: 'team_id is required' });
  }

  // Normalize team_id to uppercase for case-insensitive matching
  const normalizedTeamId = team_id.toUpperCase().trim();

  try {
    const qrPath = path.join(process.cwd(), 'public', 'qrcodes', `${normalizedTeamId}.png`);
    
    if (!fs.existsSync(qrPath)) {
      return res.status(404).json({ error: 'QR code not found' });
    }

    const qrBuffer = fs.readFileSync(qrPath);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="${normalizedTeamId}.png"`);
    res.setHeader('Content-Length', qrBuffer.length);
    res.send(qrBuffer);
  } catch (error) {
    console.error('[Ultron] Error downloading QR:', error);
    res.status(500).json({ error: 'Error downloading QR code' });
  }
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Debug: Log everything
  console.log('\n=== ULTRON API REQUEST ===');
  console.log('Method:', req.method);
  console.log('Query:', JSON.stringify(req.query));
  console.log('Body:', JSON.stringify(req.body));
  console.log('Query.action:', req.query?.action);
  console.log('Body.action:', req.body?.action);
  
  const action = req.query?.action || req.body?.action;
  console.log('Resolved action:', action);
  
  if (!action) {
    console.log('ERROR: No action provided');
    return res.status(400).json({ 
      error: 'Invalid action', 
      debug: {
        query: req.query,
        body: req.body,
        action: action,
        queryAction: req.query?.action,
        bodyAction: req.body?.action
      }
    });
  }
  
  console.log('Processing action:', action);
  
  try {
    switch (action) {
      case 'upload-csv':
        return await handleUploadCSV(req, res);
      case 'send-qrs':
        return await handleSendQRs(req, res);
      case 'checkin':
        return await handleCheckin(req, res);
      case 'food':
        return await handleFood(req, res);
      case 'review':
        return await handleReview(req, res);
      case 'team':
        return await handleGetTeam(req, res);
      case 'stats':
        return await handleGetStats(req, res);
      case 'teams':
        return await handleGetTeams(req, res);
      case 'reviews':
        return await handleGetReviews(req, res);
      case 'update-team':
        return await handleUpdateTeam(req, res);
      case 'update-team-size':
        return await handleUpdateTeamSize(req, res);
      case 'add-members':
        return await handleAddMembers(req, res);
      case 'reset-food':
        return await handleResetFood(req, res);
      case 'downloadqr':
        return await handleDownloadQR(req, res);
      default:
        console.error('[Ultron API] Action not matched:', action, 'Type:', typeof action);
        return res.status(400).json({ 
          error: 'Invalid action - DEBUG v2',
          receivedAction: action,
          actionType: typeof action,
          actionLength: action?.length,
          actionCodes: action ? action.split('').map(c => c.charCodeAt(0)) : null,
          allCases: ['upload-csv', 'send-qrs', 'checkin', 'food', 'review', 'team', 'stats', 'teams', 'reviews', 'update-team']
        });
    }
  } catch (error) {
    console.error('[Ultron API] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

// Upload and process CSV
async function handleUploadCSV(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const csvText = req.body.csv;
  if (!csvText) {
    return res.status(400).json({ error: 'CSV text is required' });
  }

  try {
    // Parse CSV
    const { parse } = await import('csv-parse/sync');
    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    if (records.length === 0) {
      return res.status(400).json({ error: 'CSV is empty' });
    }

    // Group by team_id
    const teamsMap = new Map();
    
    for (const record of records) {
      // Support multiple column name formats
      const rawTeamId = record['Team ID'] || record['team_id'] || record['TeamID'] || record['Team Id'];
      if (!rawTeamId) continue;
      
      // Normalize team_id to uppercase for case-insensitive matching
      const teamId = rawTeamId.toString().toUpperCase().trim();

      if (!teamsMap.has(teamId)) {
        teamsMap.set(teamId, {
          team_id: teamId,
          team_name: record['Team Name'] || record['team_name'] || record['TeamName'] || record['Team name'] || '',
          members: [],
          leader: null
        });
      }

      // Support multiple column name formats for member data
      // Get email with multiple fallbacks and trim whitespace
      const rawEmail = record['Email'] || record['email'] || 
                       record["Candidate's Email"] || record["Candidate Email"] || record['Candidate Email'] || '';
      const email = typeof rawEmail === 'string' ? rawEmail.trim() : '';
      
      const member = {
        name: (record['Full Name'] || record['full_name'] || record['FullName'] || record['Name'] || 
               record["Candidate's Name"] || record["Candidate Name"] || record['Candidate Name'] || '').trim(),
        email: email,
        phone: (record['Phone'] || record['phone'] || 
               record["Candidate's Mobile"] || record["Candidate Mobile"] || record['Candidate Mobile'] || '').trim(),
        role: (record['Role'] || record['role'] || 
              record['Candidate role'] || record['Candidate Role'] || 'Member').trim()
      };

      // Debug logging for first few records
      if (teamsMap.size <= 3) {
        console.log(`[Ultron CSV] Processing record for team ${teamId}:`, {
          name: member.name,
          email: member.email,
          role: member.role,
          rawRecord: Object.keys(record).reduce((acc, key) => {
            if (key.toLowerCase().includes('email') || key.toLowerCase().includes('name') || key.toLowerCase().includes('role')) {
              acc[key] = record[key];
            }
            return acc;
          }, {})
        });
      }

      teamsMap.get(teamId).members.push(member);

      // Identify leader (support various role formats)
      const roleLower = member.role.toLowerCase().trim();
      if (roleLower === 'leader' || roleLower === 'team leader' || roleLower.includes('leader')) {
        teamsMap.get(teamId).leader = member;
        console.log(`[Ultron CSV] Identified leader for team ${teamId}:`, {
          name: member.name,
          email: member.email,
          role: member.role
        });
      }
    }

    // Insert into database
    const results = [];
    const errors = [];

    for (const [teamId, teamData] of teamsMap) {
      try {
        // Find or set leader
        let leader = teamData.leader;
        if (!leader) {
          leader = teamData.members[0]; // First member as fallback
        }

        // Insert/update team
        const leaderEmail = (leader.email || '').trim();
        const leaderName = (leader.name || '').trim();
        
        const teamDataToInsert = {
          team_id: teamId,
          team_name: (teamData.team_name || `Team ${teamId}`).trim(),
          leader_name: leaderName,
          leader_email: leaderEmail,
          team_size: teamData.members.length,
          team_name_encrypted: teamIdToEncryptedCode(teamId) || null,
          updated_at: new Date().toISOString()
        };

        console.log(`[Ultron CSV] Inserting team ${teamId}:`, {
          leader_name: teamDataToInsert.leader_name,
          leader_email: teamDataToInsert.leader_email,
          team_size: teamDataToInsert.team_size,
          leader_object: { name: leader.name, email: leader.email, role: leader.role }
        });

        const { data: team, error: teamError } = await supabaseAdmin
          .from('ultron_teams')
          .upsert(teamDataToInsert, {
            onConflict: 'team_id'
          })
          .select()
          .single();

        if (teamError) {
          console.error(`[Ultron CSV] Error inserting team ${teamId}:`, teamError);
          throw teamError;
        }

        console.log(`[Ultron CSV] Successfully inserted team ${teamId}`);

        // Delete existing members and insert new ones
        // teamId is already normalized to uppercase in the loop above
        await supabaseAdmin
          .from('ultron_members')
          .delete()
          .eq('team_id', teamId);

        const membersToInsert = teamData.members.map(m => ({
          team_id: teamId,
          name: m.name,
          email: m.email || null,
          phone: m.phone || null,
          role: m.role === 'Leader' || m.role === 'leader' ? 'Leader' : 'Member'
        }));

        if (membersToInsert.length > 0) {
          const { error: membersError } = await supabaseAdmin
            .from('ultron_members')
            .insert(membersToInsert);

          if (membersError) throw membersError;
        }

        results.push({ team_id: teamId, status: 'success' });
      } catch (error) {
        errors.push({ team_id: teamId, error: error.message });
      }
    }

    return res.json({
      success: true,
      processed: results.length,
      errors: errors.length,
      results,
      errors
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

// Lock to prevent concurrent QR sending
let isSendingQRs = false;

// Generate and send QR codes
async function handleSendQRs(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Prevent concurrent sends
  if (isSendingQRs) {
    return res.status(429).json({ error: 'QR code sending is already in progress. Please wait.' });
  }

  isSendingQRs = true;

  try {
    // Check if specific team_ids or email was requested in the request body
    const requestedTeamIds = req.body?.team_ids || [];
    const requestedEmail = req.body?.email?.toLowerCase().trim();
    const forceResend = !!req.body?.force_resend;
    const sendToAll = requestedTeamIds.length === 0 && !requestedEmail;
    
    // IMPORTANT: Prevent accidental mass sends - require explicit confirmation
    if (sendToAll && !req.body?.confirm_send_all) {
      return res.status(400).json({ 
        error: 'Mass send to all teams requires explicit confirmation. Please set confirm_send_all: true in the request body, or specify team_ids or email to send to specific teams.' 
      });
    }
    
    // Get all teams including qr_sent_at and team_size for emails
    const { data: allTeams, error } = await supabaseAdmin
      .from('ultron_teams')
      .select('team_id, leader_email, team_name, leader_name, team_size, qr_sent_at');

    if (error) throw error;
    
    // Filter teams based on request
    let filteredTeams = allTeams;
    if (requestedEmail) {
      // Only send to teams with the specified email
      filteredTeams = allTeams.filter(team => {
        return (team.leader_email || '').toLowerCase().trim() === requestedEmail;
      });
      console.log(`[Ultron] Filtered to ${filteredTeams.length} teams with email ${requestedEmail} out of ${allTeams.length} total`);
    } else if (requestedTeamIds.length > 0) {
      // Only send to requested team IDs
      const normalizedRequestedIds = requestedTeamIds.map(id => id.toString().toUpperCase().trim());
      filteredTeams = allTeams.filter(team => {
        const normalizedId = (team.team_id || '').toString().toUpperCase().trim();
        return normalizedRequestedIds.includes(normalizedId);
      });
      console.log(`[Ultron] Filtered to ${filteredTeams.length} requested teams out of ${allTeams.length} total`);
    } else {
      console.log(`[Ultron] WARNING: Sending to ALL ${allTeams.length} teams (confirm_send_all was set)`);
    }
    
    // Deduplicate by team_id ONLY - one email per unique team_id
    // Build a map to keep only the first occurrence of each team_id
    const teamMap = new Map();
    for (const team of filteredTeams) {
      const normalizedId = (team.team_id || '').toString().toUpperCase().trim();
      
      // Only keep the first occurrence of each team_id
      if (!teamMap.has(normalizedId)) {
        teamMap.set(normalizedId, team);
      } else {
        console.log(`[Ultron] Skipping duplicate team_id: ${normalizedId}`);
      }
    }
    
    // Convert map back to array
    let teams = Array.from(teamMap.values());
    const maxPerRun = Math.max(0, parseInt(process.env.ULTRON_SEND_MAX_PER_RUN || '0', 10));
    if (maxPerRun > 0 && teams.length > maxPerRun) {
      teams = teams.slice(0, maxPerRun);
      console.log(`[Ultron] Capped to ${maxPerRun} teams per run (ULTRON_SEND_MAX_PER_RUN). Run again to send to the rest.`);
    }
    
    console.log(`[Ultron] Sending QR codes to ${teams.length} teams. Gmail-friendly: 2s delay between emails.`);
    
    // Count unique emails for logging
    const uniqueEmails = new Set(teams.map(t => (t.leader_email || '').toLowerCase().trim()).filter(e => e));
    console.log(`[Ultron] ${teams.length} unique team IDs will receive emails to ${uniqueEmails.size} unique email addresses`);

    // Setup email transporter
    // Remove spaces from app password if present
    const emailPass = process.env.EMAIL_PASS?.replace(/\s+/g, '') || process.env.EMAIL_PASS;
    
    if (!process.env.EMAIL_USER || !emailPass) {
      return res.status(500).json({ error: 'Email credentials not configured. Please set EMAIL_USER and EMAIL_PASS environment variables.' });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: emailPass
      },
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      pool: false
    });

    // Use absolute path for QR codes directory
    // For ES modules, use process.cwd() which should be /opt/gradex when server runs
    const qrDir = path.join(process.cwd(), 'public', 'qrcodes');
    if (!fs.existsSync(qrDir)) {
      fs.mkdirSync(qrDir, { recursive: true });
    }
    
    console.log(`[Ultron] QR directory: ${qrDir}`);
    console.log(`[Ultron] QR directory exists: ${fs.existsSync(qrDir)}`);
    console.log(`[Ultron] Process CWD: ${process.cwd()}`);

    const results = [];
    const errors = [];
    const skipped = [];

    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      
      // Skip teams without valid email addresses
      if (!team.leader_email || team.leader_email.trim() === '') {
        skipped.push({ 
          team_id: team.team_id, 
          team_name: team.team_name,
          reason: 'No leader email address found' 
        });
        console.log(`[Ultron] Skipping team ${team.team_id}: No leader email`);
        continue;
      }
      
      // Skip if QR was already sent within last 2 minutes (avoid duplicate clicks) unless force_resend
      if (!forceResend && team.qr_sent_at) {
        const lastSentTime = new Date(team.qr_sent_at).getTime();
        const minutesSinceLastSend = (Date.now() - lastSentTime) / (1000 * 60);
        if (minutesSinceLastSend < 2) {
          console.log(`[Ultron] Skipping team ${team.team_id}: QR already sent ${minutesSinceLastSend.toFixed(1)} min ago`);
          skipped.push({ team_id: team.team_id, team_name: team.team_name, email: team.leader_email, reason: `QR sent ${minutesSinceLastSend.toFixed(1)} min ago` });
          continue;
        }
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(team.leader_email.trim())) {
        skipped.push({ 
          team_id: team.team_id, 
          team_name: team.team_name,
          email: team.leader_email,
          reason: 'Invalid email format' 
        });
        console.log(`[Ultron] Skipping team ${team.team_id}: Invalid email format - ${team.leader_email}`);
        continue;
      }
      
      try {
        const normalizedTeamId = team.team_id.toString().toUpperCase().trim();
        const tenDigitCode = teamIdToEncryptedCode(normalizedTeamId);
        if (!tenDigitCode) {
          console.log(`[Ultron] Skipping team ${normalizedTeamId}: could not derive 10-digit code`);
          skipped.push({ team_id: normalizedTeamId, team_name: team.team_name, email: team.leader_email, reason: 'No 10-digit code' });
          continue;
        }
        const qrPath = path.join(qrDir, `${normalizedTeamId}.png`);
        await QRCode.toFile(qrPath, tenDigitCode, { width: 300, margin: 2 });

        console.log(`[Ultron] Generated QR code for team ${normalizedTeamId} at ${qrPath}`);

        // Verify QR file exists
        if (!fs.existsSync(qrPath)) {
          throw new Error(`QR code file was not created: ${qrPath}`);
        }

        // Send email
        console.log(`[Ultron] Attempting to send email to ${team.leader_email} for team ${normalizedTeamId}`);
        
        // Verify attachment file exists before sending
        if (!fs.existsSync(qrPath)) {
          throw new Error(`QR code file not found at ${qrPath}`);
        }
        
        const fileStats = fs.statSync(qrPath);
        console.log(`[Ultron] QR file size: ${fileStats.size} bytes`);
        console.log(`[Ultron] QR file path: ${qrPath}`);
        console.log(`[Ultron] QR file readable: ${fs.constants.R_OK ? 'yes' : 'no'}`);
        
        // Read file as buffer for attachment
        const qrBuffer = fs.readFileSync(qrPath);
        console.log(`[Ultron] QR buffer size: ${qrBuffer.length} bytes`);

        const teamSize = Math.max(1, Number(team.team_size) || 1);
        
        const mailOptions = {
          from: `"Ultron 9.0 Hackathon" <${process.env.EMAIL_USER}>`,
          to: team.leader_email.trim(),
          subject: `Your Team QR Code - ${team.team_name}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5; padding: 20px 0;">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                      <!-- Header -->
                      <tr>
                        <td style="padding: 40px 40px 30px 40px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
                          <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: 0.5px;">Ultron 9.0 Hackathon</h1>
                          <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px; font-weight: 400;">Welcome to the Event!</p>
                        </td>
                      </tr>
                      
                      <!-- Content -->
                      <tr>
                        <td style="padding: 40px;">
                          <p style="margin: 0 0 16px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                            Hello <strong>${team.leader_name || 'Team Leader'}</strong>,
                          </p>
                          <p style="margin: 0 0 24px 0; color: #555555; font-size: 15px; line-height: 1.6;">
                            Your team <strong style="color: #667eea;">${team.team_name}</strong> has been successfully registered for the Ultron 9.0 Hackathon.
                          </p>
                          
                          <!-- Team Details Card -->
                          <div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 16px 20px; margin: 24px 0; border-radius: 4px;">
                            <p style="margin: 0 0 8px 0; color: #333333; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Team Details</p>
                            <p style="margin: 4px 0; color: #555555; font-size: 15px;">
                              <strong>Your code:</strong> <span style="font-family: 'Courier New', monospace; background-color: #e9ecef; padding: 2px 8px; border-radius: 3px;">${tenDigitCode}</span>
                            </p>
                            <p style="margin: 4px 0; color: #555555; font-size: 15px;">
                              <strong>Team Name:</strong> ${team.team_name}
                            </p>
                            <p style="margin: 4px 0; color: #555555; font-size: 15px;">
                              <strong>Team Size:</strong> ${teamSize} member${teamSize !== 1 ? 's' : ''}
                            </p>
                            <p style="margin: 12px 0 0 0;">
                              <a href="https://www.gradex.bond/ultron/team/${tenDigitCode}" style="display: inline-block; padding: 10px 20px; background: #667eea; color: #fff; text-decoration: none; font-weight: 600; border-radius: 6px;">Manage ur team!</a>
                            </p>
                          </div>
                          
                          <!-- QR Code Section -->
                          <div style="text-align: center; margin: 32px 0;">
                            <p style="margin: 0 0 16px 0; color: #333333; font-size: 16px; font-weight: 600;">Your Team QR Code</p>
                            <div style="display: inline-block; padding: 20px; background-color: #ffffff; border: 2px solid #e9ecef; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                              <img src="cid:qrcode" alt="Team QR Code" style="width: 280px; height: 280px; display: block;"/>
                            </div>
                          </div>
                          
                          <!-- Instructions -->
                          <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 16px 20px; margin: 24px 0; border-radius: 4px;">
                            <p style="margin: 0 0 12px 0; color: #856404; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">📋 Important Instructions</p>
                            <ul style="margin: 0; padding-left: 20px; color: #856404; font-size: 14px; line-height: 1.8;">
                              <li>Save this QR code image to your device</li>
                              <li>Present this QR code at the event for <strong>entry check-in</strong></li>
                              <li>Use this QR code for <strong>food distribution</strong></li>
                              <li>Keep this QR code accessible during the entire event</li>
                            </ul>
                          </div>
                          
                          <p style="margin: 32px 0 0 0; color: #555555; font-size: 15px; line-height: 1.6; text-align: center;">
                            We look forward to seeing you at the event!<br/>
                            <strong style="color: #667eea;">Best of luck with your hackathon journey!</strong>
                          </p>
                        </td>
                      </tr>
                      
                      <!-- Footer -->
                      <tr>
                        <td style="padding: 24px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; border-top: 1px solid #e9ecef;">
                          <p style="margin: 0; color: #6c757d; font-size: 12px; text-align: center; line-height: 1.6;">
                            This email was automatically generated by the Ultron 9.0 Hackathon Management System.<br/>
                            <span style="color: #667eea; font-weight: 600;">Event Platform by GradeX</span>
                          </p>
                          <p style="margin: 12px 0 0 0; color: #adb5bd; font-size: 11px; text-align: center;">
                            © ${new Date().getFullYear()} GradeX. All rights reserved.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `,
          attachments: [{
            filename: `${normalizedTeamId}.png`,
            content: qrBuffer,
            contentType: 'image/png',
            cid: 'qrcode' // Content-ID for inline reference
          }]
        };
        
        console.log(`[Ultron] Sending email with QR attachment (CID: qrcode, ${qrBuffer.length} bytes)`);

        const emailResult = await transporter.sendMail(mailOptions);
        console.log(`[Ultron] Email sent successfully to ${team.leader_email} for team ${normalizedTeamId}. MessageId: ${emailResult.messageId}`);
        
        // Update database to track that QR was sent
        try {
          await supabaseAdmin
            .from('ultron_teams')
            .update({ qr_sent_at: new Date().toISOString() })
            .eq('team_id', normalizedTeamId);
          console.log(`[Ultron] Updated qr_sent_at timestamp for team ${normalizedTeamId}`);
        } catch (dbError) {
          console.error(`[Ultron] Warning: Failed to update qr_sent_at for team ${normalizedTeamId}:`, dbError.message);
          // Don't fail the whole operation if DB update fails
        }
        
        results.push({ team_id: normalizedTeamId, email: team.leader_email, status: 'sent', messageId: emailResult.messageId });

        // Gmail-friendly: 2s delay between emails to avoid rate limits / blocks
        if (i < teams.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        const normalizedTeamId = team.team_id.toString().toUpperCase().trim();
        console.error(`[Ultron] Error sending QR to team ${normalizedTeamId}:`, error);
        console.error(`[Ultron] Error details:`, {
          message: error.message,
          code: error.code,
          response: error.response,
          stack: error.stack
        });
        errors.push({ 
          team_id: normalizedTeamId, 
          email: team.leader_email, 
          error: error.message,
          code: error.code,
          response: error.response
        });
      }
    }

    return res.json({
      success: true,
      sent: results.length,
      failed: errors.length,
      skipped: skipped.length,
      total_teams: teams.length,
      results,
      errors,
      skipped
    });
  } catch (error) {
    console.error('[Ultron] Error in handleSendQRs:', error);
    return res.status(500).json({ error: error.message });
  } finally {
    // Always release the lock
    isSendingQRs = false;
  }
}

// Check-in handler
async function handleCheckin(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const qr = (body.qr_payload || '').toString().trim();
  let normalizedTeamId;
  if (!qr) {
    return res.status(400).json({ status: 'invalid', message: 'qr_payload is required' });
  }
  try {
    normalizedTeamId = await resolveTeamIdFromPayload({ qr_payload: qr });
  } catch (e) {
    return res.status(400).json({ status: 'invalid', message: e.message || 'Invalid QR' });
  }
  if (!normalizedTeamId) {
    return res.status(400).json({ status: 'invalid', message: 'Team not found. Use 10-digit code, ULTRON ID, or exact team name.' });
  }

  try {
    const { data: team, error } = await supabaseAdmin
      .from('ultron_teams')
      .select('*')
      .eq('team_id', normalizedTeamId)
      .single();

    if (error || !team) {
      return res.json({ status: 'invalid', message: 'Invalid Team ID' });
    }

    if (team.checked_in) {
      return res.json({ 
        status: 'already', 
        message: 'Team already checked in',
        checkin_time: team.checkin_time
      });
    }

    // Update check-in
    const { error: updateError } = await supabaseAdmin
      .from('ultron_teams')
      .update({
        checked_in: true,
        checkin_time: new Date().toISOString()
      })
      .eq('team_id', normalizedTeamId);

    if (updateError) throw updateError;

    return res.json({ 
      status: 'success', 
      message: 'Entry Approved',
      checkin_time: new Date().toISOString(),
      team: { team_id: team.team_id, team_name: team.team_name, team_size: team.team_size }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

// Food distribution handler
async function handleFood(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const qr = (body.qr_payload || '').toString().trim();
  let normalizedTeamId;
  if (!qr) {
    return res.status(400).json({ status: 'invalid', message: 'qr_payload is required' });
  }
  try {
    normalizedTeamId = await resolveTeamIdFromPayload({ qr_payload: qr });
  } catch (e) {
    return res.status(400).json({ status: 'invalid', message: e.message || 'Invalid QR' });
  }
  if (!normalizedTeamId) {
    return res.status(400).json({ status: 'invalid', message: 'Team not found. Use 10-digit code, ULTRON ID, or exact team name.' });
  }

  console.log(`[Ultron Food] Processing food collection for team: ${normalizedTeamId}`);

  try {
    // Get team
    const { data: team, error } = await supabaseAdmin
      .from('ultron_teams')
      .select('*')
      .eq('team_id', normalizedTeamId)
      .single();

    if (error || !team) {
      console.log(`[Ultron Food] Team not found: ${normalizedTeamId}`);
      return res.json({ status: 'invalid', message: 'Invalid Team ID' });
    }

    console.log(
      `[Ultron Food] Team found: ${team.team_name}, checked_in: ${team.checked_in}, food_collected: ${team.food_collected}, food_count: ${team.food_count}`
    );

    // Check if team has checked in first
    if (!team.checked_in) {
      console.log(`[Ultron Food] Team ${normalizedTeamId} has not checked in yet`);
      return res.json({ 
        status: 'not_checked_in', 
        message: 'Team must check in first',
        team: { team_id: team.team_id, team_name: team.team_name, team_size: team.team_size }
      });
    }

    // If a dedicated food_count column exists, use it to track per-portion scans (cap at team_size)
    const hasFoodCountColumn = Object.prototype.hasOwnProperty.call(team, 'food_count');

    if (hasFoodCountColumn) {
      const parsedCount = Number(team.food_count);
      const currentCount = Number.isFinite(parsedCount) ? parsedCount : 0;
      const maxCount = Math.max(1, Number(team.team_size) || 1);

      if (currentCount >= maxCount) {
        console.log(
          `[Ultron Food] Team ${normalizedTeamId} already at limit: ${currentCount}/${maxCount}`
        );
        return res.json({
          status: 'already',
          message: `Food already collected for entire team (${currentCount}/${maxCount})`,
          food_time: team.food_time,
          team: {
            team_id: team.team_id,
            team_name: team.team_name,
            team_size: maxCount,
            food_count: currentCount
          }
        });
      }

      const newCount = Math.min(currentCount + 1, maxCount);

      console.log(
        `[Ultron Food] Incrementing food_count for team ${normalizedTeamId}: ${currentCount} -> ${newCount} (max ${maxCount})`
      );

      const { error: updateError } = await supabaseAdmin
        .from('ultron_teams')
        .update({
          food_collected: newCount >= maxCount,
          food_time: new Date().toISOString(),
          food_count: newCount
        })
        .eq('team_id', normalizedTeamId);

      if (updateError) {
        console.error(`[Ultron Food] Error updating food collection with count:`, updateError);
        throw updateError;
      }

      console.log(
        `[Ultron Food] Successfully updated food_count for team ${normalizedTeamId}: ${newCount}/${maxCount}`
      );

      return res.json({
        status: 'success',
        message: `Food Given (${newCount}/${maxCount})`,
        food_time: new Date().toISOString(),
        team: {
          team_id: team.team_id,
          team_name: team.team_name,
          team_size: maxCount,
          food_count: newCount
        }
      });
    }

    // Fallback behaviour when food_count column does not exist yet: single boolean flag
    if (team.food_collected) {
      console.log(`[Ultron Food] Team ${normalizedTeamId} already collected food (legacy boolean mode)`);
      return res.json({
        status: 'already',
        message: 'Food already collected',
        food_time: team.food_time,
        team: { team_id: team.team_id, team_name: team.team_name, team_size: team.team_size }
      });
    }

    // Legacy: mark food as collected once for the whole team
    console.log(
      `[Ultron Food] Marking food as collected for team ${normalizedTeamId} (legacy boolean mode, no food_count column)`
    );
    const { error: legacyUpdateError } = await supabaseAdmin
      .from('ultron_teams')
      .update({
        food_collected: true,
        food_time: new Date().toISOString()
      })
      .eq('team_id', normalizedTeamId);

    if (legacyUpdateError) {
      console.error(`[Ultron Food] Error updating food collection (legacy mode):`, legacyUpdateError);
      throw legacyUpdateError;
    }

    console.log(
      `[Ultron Food] Successfully marked food as collected for team ${normalizedTeamId} (legacy boolean mode)`
    );
    return res.json({
      status: 'success',
      message: 'Food Given',
      food_time: new Date().toISOString(),
      team: { team_id: team.team_id, team_name: team.team_name, team_size: team.team_size }
    });
  } catch (error) {
    console.error(`[Ultron Food] Error:`, error);
    return res.status(500).json({ error: error.message });
  }
}

// Review submission
async function handleReview(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { team_id, rating, feedback } = req.body;
  
  if (!team_id || !rating) {
    return res.status(400).json({ error: 'team_id and rating are required' });
  }

  // Normalize team_id to uppercase for case-insensitive matching
  const normalizedTeamId = team_id.toString().toUpperCase().trim();

  if (rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }

  try {
    const { error } = await supabaseAdmin
      .from('ultron_reviews')
      .insert({
        team_id: normalizedTeamId,
        rating,
        feedback: feedback || null
      });

    if (error) throw error;

    return res.json({ success: true, message: 'Review submitted successfully' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

// Get team data
// - qr_payload (10-digit): resolve via team_name_encrypted, then fetch. Use for links, QR, manual entry.
// - team_id only: fetch directly (no resolve). Use for login-by-name after teams list.
async function handleGetTeam(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { team_id, qr_payload } = req.query;
  const rawCode = (qr_payload || '').toString().trim();
  const rawTeamId = (team_id || '').toString().trim();
  let normalizedTeamId;

  if (rawCode) {
    try {
      normalizedTeamId = await resolveTeamIdFromPayload({ qr_payload: rawCode });
    } catch (e) {
      return res.status(400).json({ error: e.message || 'Invalid code' });
    }
    if (!normalizedTeamId) {
      return res.status(400).json({ error: 'Team not found. Use 10-digit code, ULTRON ID, or exact team name.' });
    }
  } else if (rawTeamId) {
    normalizedTeamId = rawTeamId.toUpperCase().trim();
  } else {
    return res.status(400).json({ error: 'qr_payload or team_id is required' });
  }

  try {
    const { data: team, error: teamError } = await supabaseAdmin
      .from('ultron_teams')
      .select('*')
      .eq('team_id', normalizedTeamId)
      .single();

    if (teamError || !team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const { data: members, error: membersError } = await supabaseAdmin
      .from('ultron_members')
      .select('*')
      .eq('team_id', normalizedTeamId);

    if (membersError) throw membersError;

    return res.json({
      team,
      members: members || []
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

// Get stats
async function handleGetStats(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { data: teams, error } = await supabaseAdmin
      .from('ultron_teams')
      .select('checked_in, food_collected, food_count, team_size');

    if (error) throw error;

    const foodComplete = (t) => {
      const fc = Number(t.food_count);
      const ts = Math.max(1, Number(t.team_size) || 1);
      if (Number.isFinite(fc)) return fc >= ts;
      return !!t.food_collected;
    };

    const pendingTeams = teams.filter(t => t.checked_in && !foodComplete(t));
    const pendingFoodMembers = pendingTeams.reduce((sum, t) => {
      const fc = Number(t.food_count) || 0;
      const ts = Math.max(1, Number(t.team_size) || 1);
      return sum + Math.max(0, ts - fc);
    }, 0);

    const stats = {
      total_teams: teams.length,
      checked_in: teams.filter(t => t.checked_in).length,
      food_distributed: teams.filter(t => foodComplete(t)).length,
      pending_entry: teams.filter(t => !t.checked_in).length,
      pending_food: pendingFoodMembers
    };

    return res.json(stats);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

// Get all teams
async function handleGetTeams(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { data: teams, error } = await supabaseAdmin
      .from('ultron_teams')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.json(teams || []);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

// Get all reviews
async function handleGetReviews(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { data: reviews, error } = await supabaseAdmin
      .from('ultron_reviews')
      .select(`
        *,
        ultron_teams (
          team_name,
          team_id
        )
      `)
      .order('submitted_at', { ascending: false });

    if (error) throw error;

    return res.json(reviews || []);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

// Reset food for all teams (new food round). Requires confirm: "RESET FOOD".
async function handleResetFood(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const body = req.body || {};
  const confirm = (body.confirm || '').toString().trim();
  console.log('[Ultron] Reset food request - body:', JSON.stringify(body));
  console.log('[Ultron] Reset food request - confirm value:', confirm);
  console.log('[Ultron] Reset food request - confirm uppercase:', confirm.toUpperCase());
  console.log('[Ultron] Reset food request - match result:', confirm.toUpperCase() === 'RESET FOOD');
  if (confirm.toUpperCase() !== 'RESET FOOD') {
    console.log('[Ultron] Reset food - confirmation failed');
    return res.status(400).json({ error: 'Confirmation required. Send { "confirm": "RESET FOOD" } to proceed.' });
  }
  try {
    const { data: teamList, error: listErr } = await supabaseAdmin
      .from('ultron_teams')
      .select('team_id');
    if (listErr) throw listErr;
    const ids = (teamList || []).map((t) => t.team_id).filter(Boolean);
    if (ids.length === 0) {
      return res.json({ success: true, message: 'No teams to update.', teams_updated: 0 });
    }
    const { error } = await supabaseAdmin
      .from('ultron_teams')
      .update({ food_count: 0, food_collected: false, food_time: null })
      .in('team_id', ids);
    if (error) throw error;
    return res.json({
      success: true,
      message: 'Food reset for all teams.',
      teams_updated: ids.length
    });
  } catch (e) {
    console.error('[Ultron] Reset food error:', e);
    return res.status(500).json({ error: e.message || 'Failed to reset food' });
  }
}

// Update team manually
async function handleUpdateTeam(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Ensure body is parsed (should be done by Express middleware, but check anyway)
    let body = req.body;
    if (!body && typeof req.body === 'string') {
      try {
        body = JSON.parse(req.body);
      } catch (e) {
        console.error('[Ultron] Failed to parse request body:', e);
        return res.status(400).json({ error: 'Invalid JSON in request body' });
      }
    }

    console.log('[Ultron] Update team request body:', JSON.stringify(body));
    console.log('[Ultron] Update team request method:', req.method);
    console.log('[Ultron] Update team request headers:', req.headers?.['content-type']);

    const { team_id, leader_name, leader_email } = body || {};
    
    // Normalize team_id to uppercase for case-insensitive matching
    const normalizedTeamId = team_id ? team_id.toString().toUpperCase().trim() : null;
    
    console.log('[Ultron] Extracted values:', { team_id: normalizedTeamId, leader_name, leader_email });
    
    if (!normalizedTeamId) {
      console.error('[Ultron] Missing team_id in request. Body keys:', Object.keys(body || {}));
      return res.status(400).json({ error: 'team_id is required' });
    }

    if (!leader_email || typeof leader_email !== 'string' || !leader_email.trim()) {
      console.error('[Ultron] Missing or empty leader_email in request');
      return res.status(400).json({ error: 'leader_email is required and must be a non-empty string' });
    }

    const { data, error } = await supabaseAdmin
      .from('ultron_teams')
      .update({
        leader_name: (leader_name || '').trim(),
        leader_email: leader_email.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('team_id', normalizedTeamId)
      .select()
      .single();

    if (error) throw error;

    console.log(`[Ultron] Manually updated team ${normalizedTeamId}:`, {
      leader_name: data.leader_name,
      leader_email: data.leader_email
    });

    return res.json({
      success: true,
      team: data
    });
  } catch (error) {
    console.error('[Ultron] Error updating team:', error);
    if (error.message) {
      return res.status(500).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Update team size
async function handleUpdateTeamSize(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const body = req.body || {};
    const { team_id, team_size } = body;
    
    if (!team_id || typeof team_id !== 'string') {
      return res.status(400).json({ error: 'team_id is required' });
    }
    
    const size = parseInt(team_size, 10);
    if (!Number.isFinite(size) || size < 1 || size > 10) {
      return res.status(400).json({ error: 'team_size must be between 1 and 10' });
    }
    
    const { data, error } = await supabaseAdmin
      .from('ultron_teams')
      .update({ team_size: size, updated_at: new Date().toISOString() })
      .eq('team_id', team_id.toUpperCase().trim())
      .select()
      .single();
    
    if (error) throw error;
    
    console.log(`[Ultron] Updated team size for ${team_id}: ${size}`);
    return res.json({ success: true, team: data });
  } catch (e) {
    console.error('[Ultron] Update team size error:', e);
    return res.status(500).json({ error: e.message || 'Failed to update team size' });
  }
}

// Add team members
async function handleAddMembers(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const body = req.body || {};
    const { team_id, members } = body;
    
    if (!team_id || typeof team_id !== 'string') {
      return res.status(400).json({ error: 'team_id is required' });
    }
    
    if (!Array.isArray(members) || members.length === 0) {
      return res.status(400).json({ error: 'members array is required' });
    }
    
    const normalizedTeamId = team_id.toUpperCase().trim();
    
    // Verify team exists
    const { data: team, error: teamError } = await supabaseAdmin
      .from('ultron_teams')
      .select('team_id, team_size')
      .eq('team_id', normalizedTeamId)
      .single();
    
    if (teamError || !team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    // Get existing members count
    const { data: existingMembers, error: countError } = await supabaseAdmin
      .from('ultron_members')
      .select('id')
      .eq('team_id', normalizedTeamId);
    
    if (countError) throw countError;
    
    const existingCount = (existingMembers || []).length;
    const availableSlots = team.team_size - existingCount;
    
    if (availableSlots <= 0) {
      return res.status(400).json({ error: 'Team is already full' });
    }
    
    // Limit to available slots
    const membersToAdd = members.slice(0, availableSlots).map((m) => ({
      team_id: normalizedTeamId,
      name: (m.name || '').trim(),
      email: (m.email || '').trim(),
      role: 'Member'
    })).filter((m) => m.name && m.email);
    
    if (membersToAdd.length === 0) {
      return res.status(400).json({ error: 'No valid members to add' });
    }
    
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('ultron_members')
      .insert(membersToAdd)
      .select();
    
    if (insertError) throw insertError;
    
    console.log(`[Ultron] Added ${inserted.length} members to team ${normalizedTeamId}`);
    return res.json({ success: true, added: inserted.length, members: inserted });
  } catch (e) {
    console.error('[Ultron] Add members error:', e);
    return res.status(500).json({ error: e.message || 'Failed to add members' });
  }
}
