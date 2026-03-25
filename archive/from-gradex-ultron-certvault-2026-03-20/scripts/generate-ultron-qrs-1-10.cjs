/**
 * Generate QR PNGs for ULTRON001..ULTRON010 into a local folder.
 *
 * - Reads Supabase keys from `.env.local`
 * - Fetches teams from `public.ultron_teams`
 * - Uses the SAME QR payload format as backend: `{ t: "<encrypted team_name token>" }`
 * - Output: `downloads/ultron_qrs_1-10/*.png` + a zip `downloads/ultron_qrs_1-10.zip`
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { createClient } = require('@supabase/supabase-js');

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

function base64UrlEncode(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function getUltronQrKey(env) {
  // Must match backend fallback order
  const secret = env.ULTRON_QR_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || env.EMAIL_PASS;
  if (!secret) throw new Error('No secret found. Set ULTRON_QR_SECRET or ensure .env.local has SUPABASE_SERVICE_ROLE_KEY/EMAIL_PASS');
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

function encryptTeamName(teamName, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(teamName), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return base64UrlEncode(Buffer.concat([iv, tag, ciphertext]));
}

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const env = { ...loadEnvLocal(projectRoot), ...process.env };

  const SUPABASE_URL = env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const key = getUltronQrKey(env);

  const ids = Array.from({ length: 10 }, (_, i) => `ULTRON${String(i + 1).padStart(3, '0')}`);
  console.log('Fetching teams:', ids.join(', '));

  const { data: teams, error } = await supabase
    .from('ultron_teams')
    .select('team_id, team_name')
    .in('team_id', ids)
    .order('team_id', { ascending: true });

  if (error) throw error;
  if (!teams || teams.length === 0) throw new Error('No teams found for ULTRON001..ULTRON010');

  const outDir = path.join(projectRoot, 'downloads', 'ultron_qrs_1-10');
  fs.mkdirSync(outDir, { recursive: true });

  for (const team of teams) {
    const token = encryptTeamName(team.team_name, key);
    const payload = JSON.stringify({ t: token });
    const outPath = path.join(outDir, `${team.team_id}.png`);
    await QRCode.toFile(outPath, payload, { width: 320, margin: 2 });
    console.log('Wrote', outPath);
  }

  // Zip
  const zipPath = path.join(projectRoot, 'downloads', 'ultron_qrs_1-10.zip');
  try {
    // Prefer system zip
    const { execSync } = require('child_process');
    execSync(`cd "${path.join(projectRoot, 'downloads')}" && rm -f "ultron_qrs_1-10.zip" && zip -r "ultron_qrs_1-10.zip" "ultron_qrs_1-10"`, {
      stdio: 'inherit',
    });
    console.log('Zip created:', zipPath);
  } catch (e) {
    console.warn('Zip failed (you can still use the folder):', e.message);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

