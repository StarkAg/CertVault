/**
 * Push Ultron/All Details - Selected Only.csv to Supabase.
 * - Upserts ultron_teams (team_id, team_name, leader_name, leader_email, team_size = member count).
 * - Replaces ultron_members per team (all members with full details).
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/push-ultron-selected-to-supabase.cjs
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { createClient } = require('@supabase/supabase-js');
const { teamIdToEncryptedCode } = require('../lib/ultron-team-code.cjs');

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
const SUPABASE_URL = env.SUPABASE_URL || 'https://phlggcheaajkupppozho.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY. Set it in .env.local or env.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const inputPath = path.join(projectRoot, 'Ultron', 'All Details - Selected Only.csv');

function normRole(r) {
  const s = (r || '').toString().toLowerCase().trim();
  return s === 'leader' || s === 'team leader' || s.includes('leader') ? 'Leader' : 'Member';
}

async function main() {
  console.log('Reading', inputPath, '...');
  const raw = fs.readFileSync(inputPath, 'utf8');
  const records = parse(raw, { columns: true, skip_empty_lines: true, trim: true });

  // CSV teams are upserted only; seed teams (ULTRON001..ULTRON104) not in the sheet are kept.
  const teamsMap = new Map();

  for (const r of records) {
    const teamId = (r['Team ID'] || '').toString().toUpperCase().trim();
    if (!teamId) continue;

    if (!teamsMap.has(teamId)) {
      teamsMap.set(teamId, {
        team_id: teamId,
        team_name: (r['Team Name'] || `Team ${teamId}`).trim(),
        members: []
      });
    }

    const name = (r["Candidate's Name"] || r['Name'] || '').trim();
    const email = (r["Candidate's Email"] || r['Email'] || '').trim();
    const phone = (r["Candidate's Mobile"] || r['Phone'] || '').trim();
    const role = normRole(r['Candidate role'] || r['Role']);

    teamsMap.get(teamId).members.push({ name, email, phone, role });
  }

  const teams = Array.from(teamsMap.values());
  console.log('Teams:', teams.length, '| Total members:', teams.reduce((a, t) => a + t.members.length, 0));

  for (const t of teams) {
    let leader = t.members.find((m) => m.role === 'Leader') || t.members[0];
    const leader_name = (leader && leader.name) || '';
    const leader_email = (leader && leader.email) || '';
    const team_size = t.members.length;

    const team_name_encrypted = teamIdToEncryptedCode(t.team_id);
    const teamRow = {
      team_id: t.team_id,
      team_name: t.team_name,
      leader_name,
      leader_email,
      team_size,
      team_name_encrypted: team_name_encrypted || null,
      updated_at: new Date().toISOString()
    };

    const { error: teamErr } = await supabase
      .from('ultron_teams')
      .upsert(teamRow, { onConflict: 'team_id' });

    if (teamErr) {
      console.error('Team upsert error', t.team_id, teamErr.message);
      continue;
    }

    await supabase.from('ultron_members').delete().eq('team_id', t.team_id);

    const members = t.members.map((m) => ({
      team_id: t.team_id,
      name: m.name,
      email: m.email || null,
      phone: m.phone || null,
      role: m.role
    }));

    if (members.length) {
      const { error: memErr } = await supabase.from('ultron_members').insert(members);
      if (memErr) console.error('Members insert error', t.team_id, memErr.message);
    }

    console.log('Upserted', t.team_id, t.team_name, '| code:', team_name_encrypted, '| members:', team_size);
  }

  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
