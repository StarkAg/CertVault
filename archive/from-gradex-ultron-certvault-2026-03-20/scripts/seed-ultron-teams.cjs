/**
 * Seed Ultron teams into Supabase from a hardcoded list.
 * Exactly 104 teams (ULTRON001..ULTRON104). Members from CSV when matched by team name;
 * otherwise team_size = 4 and no member rows.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-ultron-teams.cjs
 *   Or set them in .env.local (loaded automatically).
 *
 * Notes:
 * - Uses service-role key, so ONLY run this locally / securely.
 * - Reads Ultron/All Details.csv for members (match by Team Name). Not mandatory to have all in CSV.
 * - Removes any non-ULTRON teams so total is exactly 104.
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { createClient } = require('@supabase/supabase-js');
const { teamIdToEncryptedCode } = require('../lib/ultron-team-code.cjs');

const DEFAULT_TEAM_SIZE = 4;
const CSV_PATH = path.join(path.resolve(__dirname, '..'), 'Ultron', 'All Details.csv');

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

// [index, team_name, leader_name, leader_email]
const RAW_TEAMS = [
  [1, 'SUDARSHAN', 'Yash Srivastava', 'yashsrivastava1408@gmail.com'],
  [2, '5', 'Tanav Jain', 'tanavjain5713@gmail.com'],
  [3, 'PerryThePlatypus', 'Somireddypalle Sri Harsha', 'sriharsha.s.p1@gmail.com'],
  [4, 'Team Pixel', 'Punit Joshi', 'jpunit2005@gmail.com'],
  [5, 'Logic Lords', 'Nanda Gopal Malladi', 'nm2312@srmist.edu.in'],
  [6, 'Mystery Inc.', 'Santhosh Kumar B', 'bsanthoshkumar063@gmail.com'],
  [7, 'Visionauts', 'Garvit Singh Rathore', 'gamezonegarvit111@gmail.com'],
  [8, 'VisionX', 'Partha Sarathi Mistri', 'parthasarathimistri22@gmail.com'],
  [9, 'Output Vandha Podhum', 'Avinash Doniparthi', 'ad9107@srmist.edu.in'],
  [10, 'Team Name', 'Nandhini Velmurugan', 'nandhini.mvsv@gmail.com'],
  [11, 'Debug Devils', 'Aahaan Sethi', 'aahaansethi1001@gmail.com'],
  [12, 'BridgeBytes', 'Varun Gopalan', 'varungopalan47@gmail.com'],
  [13, 'Prometheus', 'Chinmay Mishra', 'chinmay060606@gmail.com'],
  [14, 'Cyber-Shield', 'Vishal Yadav', 'ydvishal04@gmail.com'],
  [15, 'Destiny', 'Vaishnavi Murugesan', 'vaishnavi12136@gmail.com'],
  [16, 'ColdBloodX', 'Gautam Prasad Upadhyay', 'gp4820@srmist.edu.in'],
  [17, 'Team Synth', 'Aseem Ahamed', 'aseemnajeer@gmail.com'],
  [18, 'KernelZero', 'Priyan', 'priyan123xyz@gmail.com'],
  [19, 'Error 404', 'Hemish Jain', 'hemishjain22@gmail.com'],
  [20, 'The Hive Mind', 'Kavin G', 'gkavin446@gmail.com'],
  [21, 'Err0r101', 'Neelansh Goyal', 'ng4284@srmist.edu.in'],
  [22, 'Code Warriors', 'Joshua Lorenzo', 'lorenzo.pj2007@gmail.com'],
  [23, 'ChakraView', 'Shashwat Chaturvedi', 'sc3651@srmist.edu.in'],
  [24, 'TECHRO', 'Rishik Naragani', 'rn8312@srmist.edu.in'],
  [25, 'Cosmic codex', 'Ratandeep Singh', 'ratandeep.singh.0601@gmail.com'],
  [26, 'INNOVIX', 'Adarsh Singh', 'as9038@srmist.edu.in'],
  [27, 'TrustIssues', 'Mayank Thawani', 'mayankthawani13@gmail.com'],
  [28, 'Short_Circuit', 'Abhishek Roy', 'royabhi3231@gmail.com'],
  [29, 'Code Catalyst', 'Pranav Mundhra', 'pranavmundhra0807@gmail.com'],
  [30, 'Byteforce', 'Shakeel S J', 'shakeelsj30@gmail.com'],
  [31, 'CodeCrafters', 'Kaanya', 'kaanya3006@gmail.com'],
  [32, 'Stranger Strings', 'Nipun Thakuria', 'nt8486@srmist.edu.in'],
  [33, 'iota', 'Sourashis Sabud', 'sourashis7ps7sabud@gmail.com'],
  [34, 'ReviveTech', 'Aryan Mishra', 'am4aryanmishra@gmail.com'],
  [35, 'ModalMinds', 'Pavithra V G', 'pavithra020906@gmail.com'],
  [36, 'code citrus', 'Keshav Krishan Sharma', 'reach.keshavks@gmail.com'],
  [37, 'AFK', 'Kushagra Tripathi', 'kt6977@srmist.edu.in'],
  [38, 'NEXUS', 'Suhaas Chandramouli', 'suhaastadikonda1902@gmail.com'],
  [39, 'Elixa', 'Stuti Kumari', 'stutisingh394@gmail.com'],
  [40, 'Aurbi', 'S N Rathnadevi', 'snrathnadevi@gmail.com'],
  [41, 'Neon Nexus', 'Navdeep Rathee', 'nr8188@srmist.edu.in'],
  [42, 'Goated quadra', 'Sreesweta Roy', 'sr5966@srmist.edu.in'],
  [43, 'Hivemind', 'Divjot Singh Uppal', 'ds0725@srmist.edu.in'],
  [44, 'Think Tankers', 'Rahul Bharathi Karthickeyan', 'rahul07karthick@gmail.com'],
  [45, 'Jinsei', 'Tejeshwar Senthilkumar', 'tejeshwarsenthilkumar11@gmail.com'],
  [46, 'Codeflayer', 'Arjun R', 'ar8893@srmist.edu.in'],
  [47, 'Medsprint', 'Kshitij Mishra', 'mishrakshitij161@gmail.com'],
  [48, 'Stellaria', 'Ankush Wadehra', 'wadehraankush@gmail.com'],
  [49, 'Centillium', 'Sam Daniel L', 'sd5915@srmist.edu.in'],
  [50, 'Innova8ers', 'Archita Agarwal', 'architaagarwal307@gmail.com'],
  [51, 'Hellfire Club', 'Ranvir Singh', 'rs7185@srmist.edu.in'],
  [52, 'Pink pluto', 'Rishanya Shamganth', 'rs9135@srmist.edu.in'],
  [53, 'TechForge', 'Rohidh M', 'rm5688@srmist.edu.in'],
  [54, 'Reboot Rebels', 'Kavya Singh', 'ks8906@srmist.edu.in'],
  [55, 'The Penguin Squad', 'Mohammed Ayaan', 'mohammedayaan8240@gmail.com'],
  [56, 'Code Crew', 'Shivam Chitlangia', 'shivamchitlangia1@gmail.com'],
  [57, 'MindForge', 'Tanmay Matta', 'tm4301@srmist.edu.in'],
  [58, 'Cognexia', 'Harsh Singh Tomar', 'ht3322@srmist.edu.in'],
  [59, 'SheCodez', 'Vedhashree T N', 'vedha122007@gmail.com'],
  [60, 'UpSurge', 'Arunkannaa S', 'mail2sarunkannaa@gmail.com'],
  [61, 'SmartMinions', 'Ritika Tiwari', 'ritikatiwari078@gmail.com'],
  [62, 'Team Catalyst', 'Arman Panigrahi', '11309arman@gmail.com'],
  [63, 'IntoTheUnKnown', 'Solomon K', 'solomon17705@gmail.com'],
  [64, 'Brain_Lag', 'Shivansh Anand Thakur', 'st8020@srmist.edu.in'],
  [65, 'ImperialX', 'Pallav Shrivastava', '1006pallavshrivastava@gmail.com'],
  [66, 'team jade', 'Jenisha V', 'jenishaagnes@gmail.com'],
  [67, 'SheForHealth', 'Rupkannya Mazumder', 'rupkannyamazumder@gmail.com'],
  [68, 'Bug Smashers', 'Dennis Das Guptha', 'dennisdasgupthae@gmail.com'],
  [69, 'The Merry Thieves', 'Gandlapalli Monesha', 'thegandlapallimonesha@gmail.com'],
  [70, 'Hackhustlers', 'Angelina Sharon', 'nathalaangelina@gmail.com'],
  [71, 'SYNDICATE', 'Sainath Rajendran', 'ssainath657@gmail.com'],
  [72, 'CODE SAAT', 'Arnav Saxena', 'in.arnavsaxena@outlook.com'],
  [73, 'COREMIND', 'Pearl', 'workpearl7369@gmail.com'],
  [74, 'BigO(1)', 'Nikita Deb', 'nikitadeb.0707@gmail.com'],
  [75, 'Pixel Forge', 'Swoyam Siddhi Pattanayak', 'sp2130@srmist.edu.in'],
  [76, 'Five mortals', 'Aayush Gautam', 'ag8694@srmist.edu.in'],
  [77, 'Greeninja', 'Pragati Kumari', 'pk8791@srmist.edu.in'],
  [78, 'GIT PUSHERS', 'Ulaganathan P', 'ulagan2007@gmail.com'],
  [79, 'TechNova', 'Deinol Mascarenhas', 'dm3592@srmist.edu.in'],
  [80, 'INCIDIOUS', 'Kovardhini C', 'kovardhini06@gmail.com'],
  [81, 'EduRyse', 'Aalind Mukati', 'aalindmukati09@gmail.com'],
  [82, 'Intrusive Innovators', 'Aditi Singh', 'aditisinghad9450@gmail.com'],
  [83, 'AventumX', 'Jaisal Rathi', 'jr6379@srmist.edu.in'],
  [84, 'Mind Matrix', 'Tharun KV', 'tharunkv07@gmail.com'],
  [85, 'SIDE QUEST', 'Rakshitha G V', 'gvrakshithaofficial@gmail.com'],
  [86, 'VetriVerse', 'K Guru Prakash', 'sit24am049@sairamtap.edu.in'],
  [87, 'HELLFIRE', 'Varun Agarwal', 'agarwalvarun2403@gmail.com'],
  [88, 'Mind Hackers', 'Devanshi Agarwal', 'da4770@srmist.edu.in'],
  [89, 'Cyber Sentinels', 'Vigneshwaran B', 'vickeybalu2006@gmail.com'],
  [90, 'ULTRON WINNERS', 'Piyush Kumar', 'piyushkr194177@gmail.com'],
  [91, 'Runtime terror', 'Pashayanti Tandulkar', 'pr3910@srmist.edu.in'],
  [92, 'Coder Royale', 'Aditya Jha', 'aj2236@srmist.edu.in'],
  [93, 'Hellfire coders', 'Jash Ajmera', 'jashajmera008@gmail.com'],
  [94, 'VitalVault', 'Kritika', 'kritikakri04@gmail.com'],
  [95, 'The Clinical Compass', 'Aaditya Srivastava', 'srivastavaaaditya3112@gmail.com'],
  [96, 'Aether', 'Ruchitha Vatambeti', 'ruchitha.vatambeti@gmail.com'],
  [97, 'Deam Team', 'Shibraj Das', 'cyb.shibrajdas@gmail.com'],
  [98, 'Optivue', 'Pratham Pal', 'pp0716@srmist.edu.in'],
  [99, 'Syncoder', 'Priyanshu Vasudev', 'priyanshuvasudev2005@gmail.com'],
  [100, 'Heal Hives', 'Sheffali Srivastava', 'sa0896@srmist.edu.in'],
  [101, 'Neural Labs', 'Neural Labs', 'utsavopal@gmail.com'],
  [102, 'CODE FOR INDIA (INSIDERS)', 'INSIDERS', 'krishna.keshab.banik@gmail.com'],
  [103, 'PowerHouse', 'Sachin Ramachandran', 'sachin.ramachandran2006@gmail.com'],
  [104, 'CodeHazard', 'Yash Goel', 'yashvardhan664@gmail.com']
];

function normalizeTeamName(s) {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normRole(r) {
  const s = (r || '').toString().toLowerCase().trim();
  return s === 'leader' || s === 'team leader' || (s && s.includes('leader')) ? 'Leader' : 'Member';
}

/** Map normalized team name -> [{ name, email, phone, role }] */
function loadMembersByTeamName() {
  const out = new Map();
  if (!fs.existsSync(CSV_PATH)) return out;
  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parse(raw, { columns: true, skip_empty_lines: true, trim: true });
  for (const r of rows) {
    const teamName = (r['Team Name'] || '').trim();
    if (!teamName) continue;
    const key = normalizeTeamName(teamName);
    if (!out.has(key)) out.set(key, []);
    const name = (r["Candidate's Name"] || r['Name'] || '').trim();
    const email = (r["Candidate's Email"] || r['Email'] || '').trim();
    const phone = (r["Candidate's Mobile"] || r['Phone'] || '').trim();
    const role = normRole(r['Candidate role'] || r['Role']);
    out.get(key).push({ name: name || 'Member', email, phone, role });
  }
  return out;
}

function buildTeamsPayload(membersByNormName) {
  return RAW_TEAMS.map(([index, team_name, leader_name, leader_email]) => {
    const padded = String(index).padStart(3, '0');
    const team_id = `ULTRON${padded}`;
    const team_name_encrypted = teamIdToEncryptedCode(team_id);
    const key = normalizeTeamName(team_name);
    const members = membersByNormName.get(key) || [];
    const team_size = members.length > 0 ? members.length : DEFAULT_TEAM_SIZE;

    return {
      team_id,
      team_name,
      leader_name,
      leader_email,
      team_size,
      team_name_encrypted: team_name_encrypted || null,
      updated_at: new Date().toISOString(),
      members
    };
  });
}

async function main() {
  console.log('Seeding Ultron teams (104 total). Members from CSV when matched, else team_size = 4.\n');

  const membersByNormName = loadMembersByTeamName();
  const teams = buildTeamsPayload(membersByNormName);
  const withMembers = teams.filter((t) => t.members.length > 0);
  const withoutMembers = teams.filter((t) => t.members.length === 0);
  console.log(`Members map: ${membersByNormName.size} CSV team names.`);
  console.log(`Seed: ${withMembers.length} teams with CSV members, ${withoutMembers.length} with team_size = ${DEFAULT_TEAM_SIZE} (no members).\n`);

  const { data: allTeams } = await supabase.from('ultron_teams').select('team_id');
  const toRemove = (allTeams || []).filter((t) => !/^ULTRON\d{3}$/.test(t.team_id));
  if (toRemove.length) {
    for (const row of toRemove) {
      const { error: delErr } = await supabase.from('ultron_teams').delete().eq('team_id', row.team_id);
      if (delErr) console.warn('Delete non-ULTRON team', row.team_id, delErr.message);
    }
    console.log(`Removed ${toRemove.length} non-ULTRON teams.\n`);
  }

  for (const t of teams) {
    const { members, ...teamRow } = t;
    const { error: teamErr } = await supabase
      .from('ultron_teams')
      .upsert(teamRow, { onConflict: 'team_id' });
    if (teamErr) {
      console.error('Team upsert', t.team_id, teamErr.message);
      continue;
    }
    await supabase.from('ultron_members').delete().eq('team_id', t.team_id);
    if (members.length) {
      const rows = members.map((m) => ({
        team_id: t.team_id,
        name: m.name,
        email: m.email || null,
        phone: m.phone || null,
        role: m.role
      }));
      const { error: memErr } = await supabase.from('ultron_members').insert(rows);
      if (memErr) console.error('Members insert', t.team_id, memErr.message);
    }
  }

  console.log(`Upserted ${teams.length} teams (ULTRON001..ULTRON104).`);
  console.log('Sample:');
  teams.slice(0, 5).forEach((t) => {
    const sz = t.members.length ? `${t.members.length} members` : `team_size ${t.team_size} (no members)`;
    console.log(`- ${t.team_id}: ${t.team_name} | ${sz}`);
  });
  console.log('\nDone.');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Unexpected error:', err);
  process.exit(1);
});

