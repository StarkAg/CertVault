/**
 * Filter Ultron/All Details.csv to only selected teams.
 * "Selected" = team names from scripts/seed-ultron-teams.cjs (RAW_TEAMS).
 * Keeps all columns and all team members for those teams.
 * Output: Ultron/All Details - Selected Only.csv
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

// Same team names as seed-ultron-teams.cjs (index 1 of each RAW_TEAMS entry)
const SELECTED_NAMES = [
  'SUDARSHAN', '5', 'PerryThePlatypus', 'Team Pixel', 'Logic Lords', 'Mystery Inc.',
  'Visionauts', 'VisionX', 'Output Vandha Podhum', 'Team Name', 'Debug Devils', 'BridgeBytes',
  'Prometheus', 'Cyber-Shield', 'Destiny', 'ColdBloodX', 'Team Synth', 'KernelZero', 'Error 404',
  'The Hive Mind', 'Err0r101', 'Code Warriors', 'ChakraView', 'TECHRO', 'Cosmic codex', 'INNOVIX',
  'TrustIssues', 'Short_Circuit', 'Code Catalyst', 'Byteforce', 'CodeCrafters', 'Stranger Strings',
  'iota', 'ReviveTech', 'ModalMinds', 'code citrus', 'AFK', 'NEXUS', 'Elixa', 'Aurbi', 'Neon Nexus',
  'Goated quadra', 'Hivemind', 'Think Tankers', 'Jinsei', 'Codeflayer', 'Medsprint', 'Stellaria',
  'Centillium', 'Innova8ers', 'Hellfire Club', 'Pink pluto', 'TechForge', 'Reboot Rebels',
  'The Penguin Squad', 'Code Crew', 'MindForge', 'Cognexia', 'SheCodez', 'UpSurge', 'SmartMinions',
  'Team Catalyst', 'IntoTheUnKnown', 'Brain_Lag', 'ImperialX', 'team jade', 'SheForHealth',
  'Bug Smashers', 'The Merry Thieves', 'Hackhustlers', 'SYNDICATE', 'CODE SAAT', 'COREMIND',
  'BigO(1)', 'Pixel Forge', 'Five mortals', 'Greeninja', 'GIT PUSHERS', 'TechNova', 'INCIDIOUS',
  'EduRyse', 'Intrusive Innovators', 'AventumX', 'Mind Matrix', 'SIDE QUEST', 'VetriVerse',
  'HELLFIRE', 'Mind Hackers', 'Cyber Sentinels', 'ULTRON WINNERS', 'Runtime terror', 'Coder Royale',
  'Hellfire coders', 'VitalVault', 'The Clinical Compass', 'Aether', 'Deam Team', 'Optivue',
  'Syncoder', 'Heal Hives', 'Neural Labs', 'CODE FOR INDIA (INSIDERS)', 'PowerHouse', 'CodeHazard'
];

const selectedSet = new Set(SELECTED_NAMES.map((n) => String(n).trim().toLowerCase()));

function escapeCsvField(s) {
  const t = String(s == null ? '' : s);
  if (/[,"\r\n]/.test(t)) return '"' + t.replace(/"/g, '""') + '"';
  return t;
}

function toCsvRow(headers, record) {
  return headers.map((h) => escapeCsvField(record[h])).join(',');
}

const projectRoot = path.resolve(__dirname, '..');
const inputPath = path.join(projectRoot, 'Ultron', 'All Details.csv');
const outputPath = path.join(projectRoot, 'Ultron', 'All Details - Selected Only.csv');

const raw = fs.readFileSync(inputPath, 'utf8');
const records = parse(raw, { columns: true, skip_empty_lines: true, trim: true });
const headers = records.length ? Object.keys(records[0]) : [];

const filtered = records.filter((r) => {
  const name = (r['Team Name'] || '').trim().toLowerCase();
  return name && selectedSet.has(name);
});

const headerLine = headers.join(',');
const bodyLines = filtered.map((r) => toCsvRow(headers, r));
const out = [headerLine, ...bodyLines].join('\n');

fs.writeFileSync(outputPath, out, 'utf8');

console.log(`Filtered ${records.length} rows -> ${filtered.length} rows (${selectedSet.size} selected teams).`);
console.log(`Written: ${outputPath}`);
