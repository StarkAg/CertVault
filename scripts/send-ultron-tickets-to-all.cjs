/**
 * Send Ultron hackathon ticket-style emails to ALL team leaders (104 teams).
 * Same format as the test ticket: Stranger Things theme, QR (10-digit code),
 * "Manage ur team!", "Event Platform by GradeX". Gmail-friendly: 2s delay between emails.
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EMAIL_USER, EMAIL_PASS (or IEEE_*)
 *   in .env.local or env.
 *
 * Usage:
 *   node scripts/send-ultron-tickets-to-all.cjs
 *
 * Optional:
 *   DRY_RUN=1  - Log only, do not send.
 *   SKIP_COUNTDOWN=1 - Skip 5s countdown before sending.
 *   START_FROM=N - Start at 1-based index N (resume after partial run).
 *   STOP_AT=N   - Stop at 1-based index N (inclusive).
 */

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
const { createClient } = require('@supabase/supabase-js');
const { teamIdToEncryptedCode } = require('../lib/ultron-team-code.cjs');

const DELAY_MS = 2000;
const COUNTDOWN_SEC = 5;

function loadEnvLocal(projectRoot) {
  const envPath = path.join(projectRoot, '.env.local');
  const out = {};
  if (!fs.existsSync(envPath)) return out;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    out[key] = value;
  }
  return out;
}

const projectRoot = path.resolve(__dirname, '..');
const env = { ...loadEnvLocal(projectRoot), ...process.env };

const emailUser = env.IEEE_EMAIL_USER || env.EMAIL_USER;
const emailPass = (env.IEEE_EMAIL_PASS || env.EMAIL_PASS || '').replace(/\s+/g, '');
const supabaseUrl = env.SUPABASE_URL || 'https://phlggcheaajkupppozho.supabase.co';
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
const dryRun = env.DRY_RUN === '1' || env.DRY_RUN === 'true';
const skipCountdown = env.SKIP_COUNTDOWN === '1' || env.SKIP_COUNTDOWN === 'true';
const startFrom = Math.max(1, parseInt(env.START_FROM || '1', 10));
const stopAt = env.STOP_AT ? Math.max(1, parseInt(env.STOP_AT, 10)) : null;

if (!emailUser || !emailPass) {
  console.error('Set IEEE_EMAIL_USER / IEEE_EMAIL_PASS or EMAIL_USER / EMAIL_PASS in .env.local');
  process.exit(1);
}
if (!supabaseKey) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const ultronBaseUrl = (env.PUBLIC_URL || env.ULTRON_BASE_URL || 'https://certvault.app').replace(/\/$/, '');

/** Same ticket HTML as test script (Stranger Things theme). */
function buildTicketHtml(opts) {
  const { userName, teamCode, qrCid } = opts;
  const link = `${ultronBaseUrl}/ultron/team/${teamCode}`;
  const codeDisplay = teamCode;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ultron 9.0 – Manage Your Team</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#050109;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background-color:#050109;">
    <tr>
      <td align="center" style="padding:28px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:440px;border-collapse:collapse;">
          <tr>
            <td style="padding:0 0 28px 0;text-align:center;">
              <a href="${link}" style="display:inline-block;padding:18px 32px;background:#f97373;color:#0f172a;font-size:20px;font-weight:700;text-decoration:none;letter-spacing:0.12em;text-transform:uppercase;border:2px solid rgba(248,113,113,0.9);border-radius:10px;box-shadow:0 0 24px rgba(220,38,38,0.5);">Manage ur team!</a>
              <p style="margin:14px 0 0 0;color:rgba(248,250,252,0.7);font-size:14px;">View food status, members &amp; reviews</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 16px 0;text-align:center;">
              <span style="display:inline-block;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(248,250,252,0.5);">Enter the Upside Down</span>
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 20px 0;text-align:center;">
              <h1 style="margin:0;color:#f97373;font-size:26px;font-weight:700;letter-spacing:0.08em;">Welcome, ${userName}!</h1>
              <p style="margin:8px 0 0 0;color:rgba(248,250,252,0.65);font-size:13px;">Show this ticket at check-in</p>
            </td>
          </tr>
          <tr>
            <td>
              <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:rgba(15,15,22,0.9);border:1px solid rgba(248,113,113,0.4);border-radius:14px;">
                <tr>
                  <td style="background:linear-gradient(180deg,rgba(220,38,38,0.25) 0%,rgba(139,0,0,0.15) 100%);padding:16px 20px;border-radius:14px 14px 0 0;border-bottom:1px solid rgba(248,113,113,0.3);">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
                      <tr>
                        <td style="width:36px;vertical-align:middle;">
                          <div style="width:32px;height:32px;background:rgba(248,113,113,0.3);border-radius:8px;border:1px solid rgba(248,113,113,0.5);"></div>
                        </td>
                        <td>
                          <div style="color:#f97373;font-size:15px;font-weight:600;letter-spacing:0.06em;">Hackathon Entry</div>
                          <div style="color:rgba(248,250,252,0.8);font-size:12px;">Valid for event entry</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px 20px;text-align:center;">
                    <img src="cid:${qrCid}" alt="QR Code" width="200" height="200" style="width:200px;height:200px;max-width:100%;display:block;margin:0 auto 16px auto;background:#111;border:1px solid rgba(248,113,113,0.3);border-radius:10px;padding:10px;box-sizing:border-box;" />
                    <p style="margin:0 0 4px 0;color:rgba(248,250,252,0.55);font-size:11px;letter-spacing:0.1em;text-transform:uppercase;">Your Code</p>
                    <p style="margin:0 0 16px 0;color:#f8fafc;font-size:18px;font-weight:700;font-family:'Courier New',monospace;letter-spacing:0.1em;">${codeDisplay}</p>
                    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border-top:1px dashed rgba(148,163,184,0.4);">
                      <tr>
                        <td style="padding-top:12px;color:rgba(248,250,252,0.55);font-size:12px;">Status</td>
                        <td style="padding-top:12px;text-align:right;color:#fbbf24;font-size:12px;font-weight:600;">Waiting for check-in</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 0 0 0;text-align:center;">
              <a href="${link}" style="color:#f97373;font-size:14px;font-weight:600;text-decoration:underline;word-break:break-all;">${link}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 0 0 0;text-align:center;">
              <span style="color:rgba(248,250,252,0.45);font-size:12px;letter-spacing:0.06em;">Event Platform by GradeX</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('Send Ultron ticket emails to ALL team leaders (same format as test).\n');

  const { data: rows, error } = await supabase
    .from('ultron_teams')
    .select('team_id, leader_email, leader_name, team_name')
    .order('team_id', { ascending: true });

  if (error) {
    console.error('Supabase error:', error.message);
    process.exit(1);
  }

  const teams = (rows || []).filter((t) => (t.leader_email || '').trim());
  const skipped = (rows || []).filter((t) => !(t.leader_email || '').trim());

  console.log(`Teams with leader email: ${teams.length}`);
  if (skipped.length) console.log(`Skipped (no email): ${skipped.length}`);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const valid = [];
  const invalid = [];
  for (const t of teams) {
    const e = (t.leader_email || '').trim();
    if (emailRegex.test(e)) valid.push(t);
    else invalid.push({ team_id: t.team_id, email: e });
  }
  if (invalid.length) {
    console.log(`Invalid email format: ${invalid.length}`);
    invalid.forEach((x) => console.log(`  ${x.team_id} -> ${x.email}`));
  }

  let toSend = valid;
  if (startFrom > 1 || stopAt) {
    const from = startFrom - 1;
    const to = stopAt != null ? Math.min(stopAt, toSend.length) : toSend.length;
    toSend = toSend.slice(from, to);
    console.log(`Range: indices ${startFrom}–${from + toSend.length} (${toSend.length} teams).`);
  }
  console.log(`Will send tickets to ${toSend.length} team leaders.`);
  if (dryRun) {
    console.log('DRY_RUN=1: no emails will be sent.\n');
    toSend.forEach((t, i) => {
      const code = teamIdToEncryptedCode((t.team_id || '').toString().toUpperCase().trim());
      const idx = startFrom + i;
      console.log(`  ${idx}. ${t.team_id} ${t.team_name} -> ${t.leader_email} (code: ${code || '?'})`);
    });
    return;
  }

  if (!skipCountdown) {
    console.log(`Starting in ${COUNTDOWN_SEC}s... (SKIP_COUNTDOWN=1 to skip)\n`);
    await sleep(COUNTDOWN_SEC * 1000);
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: emailUser, pass: emailPass },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    pool: false
  });

  const sent = [];
  const failed = [];

  for (let i = 0; i < toSend.length; i++) {
    const team = toSend[i];
    const teamId = (team.team_id || '').toString().toUpperCase().trim();
    const leaderEmail = (team.leader_email || '').trim();
    const leaderName = (team.leader_name || '').trim() || 'Team Leader';
    const teamName = team.team_name || `Team ${teamId}`;

    const teamCode = teamIdToEncryptedCode(teamId);
    if (!teamCode) {
      console.log(`[${i + 1}/${toSend.length}] Skip ${teamId}: no 10-digit code`);
      failed.push({ team_id: teamId, email: leaderEmail, error: 'No 10-digit code' });
      continue;
    }

    try {
      const qrBuffer = await QRCode.toBuffer(teamCode, { type: 'png', width: 280, margin: 2 });
      const cid = 'qrcode';
      const html = buildTicketHtml({
        userName: leaderName.split(/\s+/)[0] || leaderName,
        teamCode,
        qrCid: cid
      });

      const mailOptions = {
        from: `"Ultron 9.0" <${emailUser}>`,
        to: leaderEmail,
        subject: `Your Hackathon Entry Ticket – ${teamCode}`,
        html,
        attachments: [{
          filename: `ticket-${teamCode}.png`,
          content: qrBuffer,
          contentType: 'image/png',
          cid
        }]
      };

      await transporter.sendMail(mailOptions);
      sent.push({ team_id: teamId, team_name: teamName, email: leaderEmail });
      console.log(`[${i + 1}/${toSend.length}] Sent ${teamId} (${teamName}) -> ${leaderEmail}`);

      if (i < toSend.length - 1) await sleep(DELAY_MS);
    } catch (err) {
      console.error(`[${i + 1}/${toSend.length}] Failed ${teamId} -> ${leaderEmail}:`, err.message);
      failed.push({ team_id: teamId, email: leaderEmail, error: err.message });
    }
  }

  console.log('\n--- Done ---');
  console.log(`Sent: ${sent.length}`);
  console.log(`Failed: ${failed.length}`);
  if (failed.length) failed.forEach((f) => console.log(`  ${f.team_id} ${f.email}: ${f.error}`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
