/**
 * Export Ultron teams and members to CSV
 * Generates a detailed report with team info and all members
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnvLocal(projectRoot) {
  const envPath = path.join(projectRoot, '.env.local');
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  });
  return env;
}

const projectRoot = path.resolve(__dirname, '..');
const env = { ...loadEnvLocal(projectRoot), ...process.env };

const supabaseUrl = env.SUPABASE_URL || 'https://phlggcheaajkupppozho.supabase.co';
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function escapeCSV(val) {
  if (val == null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function main() {
  console.log('Fetching teams and members from Supabase...\n');

  // Fetch all teams
  const { data: teams, error: teamsError } = await supabase
    .from('ultron_teams')
    .select('*')
    .order('team_id', { ascending: true });

  if (teamsError) {
    console.error('Error fetching teams:', teamsError.message);
    process.exit(1);
  }

  // Fetch all members with team info
  const { data: members, error: membersError } = await supabase
    .from('ultron_members')
    .select('*, ultron_teams(team_id, team_name, leader_email)')
    .order('team_id', { ascending: true });

  if (membersError) {
    console.error('Error fetching members:', membersError.message);
    process.exit(1);
  }

  console.log(`✓ Total Teams: ${teams.length}`);
  console.log(`✓ Total Members: ${members.length}\n`);

  // Generate CSV with team and member details
  const csvLines = [];
  csvLines.push('Team ID,Team Name,Leader Name,Leader Email,Team Size,Checked In,Food Count,Member Name,Member Email,Member Role');

  // Group members by team
  const membersByTeam = {};
  members.forEach((m) => {
    const tid = m.team_id;
    if (!membersByTeam[tid]) membersByTeam[tid] = [];
    membersByTeam[tid].push(m);
  });

  teams.forEach((team) => {
    const teamMembers = membersByTeam[team.team_id] || [];
    
    if (teamMembers.length === 0) {
      // Team with no members
      csvLines.push([
        escapeCSV(team.team_id),
        escapeCSV(team.team_name),
        escapeCSV(team.leader_name),
        escapeCSV(team.leader_email),
        escapeCSV(team.team_size || 0),
        escapeCSV(team.checked_in ? 'Yes' : 'No'),
        escapeCSV(team.food_count || 0),
        '',
        '',
        ''
      ].join(','));
    } else {
      // Team with members
      teamMembers.forEach((member, idx) => {
        csvLines.push([
          idx === 0 ? escapeCSV(team.team_id) : '',
          idx === 0 ? escapeCSV(team.team_name) : '',
          idx === 0 ? escapeCSV(team.leader_name) : '',
          idx === 0 ? escapeCSV(team.leader_email) : '',
          idx === 0 ? escapeCSV(team.team_size || 0) : '',
          idx === 0 ? escapeCSV(team.checked_in ? 'Yes' : 'No') : '',
          idx === 0 ? escapeCSV(team.food_count || 0) : '',
          escapeCSV(member.name),
          escapeCSV(member.email),
          escapeCSV(member.role || 'Member')
        ].join(','));
      });
    }
  });

  const outputDir = path.join(projectRoot, 'downloads');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'ultron-teams-members-export.csv');
  fs.writeFileSync(outputPath, csvLines.join('\n'), 'utf-8');

  console.log(`✓ CSV exported to: ${outputPath}`);
  console.log(`\n--- Summary ---`);
  console.log(`Total Teams: ${teams.length}`);
  console.log(`Total People: ${members.length}`);
  console.log(`Teams with members: ${Object.keys(membersByTeam).length}`);
  console.log(`Teams without members: ${teams.length - Object.keys(membersByTeam).length}`);
  
  // Count checked-in and food stats
  const checkedIn = teams.filter(t => t.checked_in).length;
  const foodCollected = teams.filter(t => {
    const fc = typeof t.food_count === 'number' ? t.food_count : 0;
    const ts = Math.max(1, typeof t.team_size === 'number' ? t.team_size : 1);
    return fc >= ts;
  }).length;
  
  console.log(`Checked-in teams: ${checkedIn}`);
  console.log(`Food complete teams: ${foodCollected}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
