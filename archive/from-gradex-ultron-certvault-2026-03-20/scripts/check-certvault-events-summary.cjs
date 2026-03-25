/**
 * Summarize CertVault certificates per event.
 * Helps explain why total rows != latest CSV count.
 *
 * Usage:
 *   node scripts/check-certvault-events-summary.cjs
 */

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

async function main() {
  console.log('🔍 CertVault certificates per event:\n');

  const { data: certs, error } = await supabase
    .from('certvault_certificates')
    .select('id, event_id');

  if (error) {
    console.error('❌ Failed to load certificates:', error);
    process.exit(1);
  }

  const countsByEvent = {};
  for (const row of certs) {
    countsByEvent[row.event_id] = (countsByEvent[row.event_id] || 0) + 1;
  }

  const eventIds = Object.keys(countsByEvent);
  const { data: events, error: eventsError } = await supabase
    .from('certvault_events')
    .select('id, name')
    .in('id', eventIds);

  if (eventsError) {
    console.error('❌ Failed to load events:', eventsError);
    process.exit(1);
  }

  const nameById = {};
  for (const ev of events) {
    nameById[ev.id] = ev.name;
  }

  let total = 0;
  Object.entries(countsByEvent)
    .sort((a, b) => b[1] - a[1])
    .forEach(([eventId, count]) => {
      total += count;
      const name = nameById[eventId] || '(unknown event)';
      console.log(`- ${name} (${eventId}): ${count} certificates`);
    });

  console.log(`\n📊 Total certificates: ${total}`);
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});

