/**
 * Compare HIZE 2026 event certificates vs the CSV you provided.
 *
 * - Counts how many rows are in the CSV
 * - Counts how many unique recipients exist in certvault_certificates for that event
 * - Checks that every CSV recipient has a certificate
 * - Reports how many extra certificates exist that are NOT in the CSV
 *
 * Usage:
 *   node scripts/check-certvault-vs-csv.cjs
 */

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceRoleKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required. Set it in .env or environment.');
  process.exit(1);
}
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://phlggcheaajkupppozho.supabase.co',
  serviceRoleKey
);

// Hard-code the HIZE 2026 Participation event ID from summary
const HIZE_EVENT_ID = '7a35776d-6b9b-4e6b-bdfb-77ddafde5cbb';
const CSV_PATH = 'HIZE-2026-Attendees-03-02-2026-11-49-01.csv';

function normalizeKey(name, email, category) {
  const cat = (category || 'Participant').trim().toLowerCase();
  const idPart = (email || name || '').trim().toLowerCase();
  return `${idPart}::${cat}`;
}

async function main() {
  console.log('🔍 Comparing CSV vs Supabase for HIZE 2026 Participation\n');

  // 1) Load CSV
  const csv = fs.readFileSync(CSV_PATH, 'utf8').trim();
  const lines = csv.split(/\r?\n/);
  const dataLines = lines.slice(1).filter((l) => l.trim());

  const csvKeys = new Set();
  for (const line of dataLines) {
    const parts = line.split(',').map((p) => p.trim());
    const name = parts[0];
    const email = parts[1] || null;
    const category = parts[2] || 'Participant';
    if (!name) continue;
    csvKeys.add(normalizeKey(name, email, category));
  }

  console.log(`CSV rows (excluding header): ${dataLines.length}`);
  console.log(`CSV unique recipients (name/email + category): ${csvKeys.size}\n`);

  // 2) Load certs from Supabase for this event
  const { data: certs, error } = await supabase
    .from('certvault_certificates')
    .select('recipient_name, recipient_email, category')
    .eq('event_id', HIZE_EVENT_ID);

  if (error) {
    console.error('❌ Failed to load certificates:', error);
    process.exit(1);
  }

  const certKeys = new Set();
  certs.forEach((row) => {
    certKeys.add(
      normalizeKey(row.recipient_name, row.recipient_email, row.category)
    );
  });

  console.log(`Supabase certificates for this event: ${certs.length}`);
  console.log(`Supabase unique recipients (name/email + category): ${certKeys.size}\n`);

  // 3) Compare sets
  let missing = 0;
  for (const key of csvKeys) {
    if (!certKeys.has(key)) {
      missing++;
    }
  }

  let extras = 0;
  for (const key of certKeys) {
    if (!csvKeys.has(key)) {
      extras++;
    }
  }

  console.log('📊 Comparison:');
  console.log(`- CSV recipients missing in Supabase: ${missing}`);
  console.log(`- Supabase recipients not present in CSV: ${extras}`);
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});

