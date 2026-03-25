/**
 * Cleanup script for CertVault:
 * - Finds duplicate certificates per (event_id, recipient_email OR name, category)
 * - Keeps ONE best record (preferring those WITH pdf_url, then newest)
 * - Deletes the rest using service_role
 *
 * Usage (from project root):
 *   node scripts/cleanup-certvault-duplicates.cjs
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

function makeKey(row) {
  const emailOrName = (row.recipient_email || row.recipient_name || '')
    .trim()
    .toLowerCase();
  const category = (row.category || 'participant').trim().toLowerCase();
  return `${row.event_id}::${emailOrName}::${category}`;
}

async function main() {
  console.log('🔍 Loading all CertVault certificates...');

  const { data: rows, error } = await supabase
    .from('certvault_certificates')
    .select(
      'id, certificate_id, event_id, recipient_name, recipient_email, category, pdf_url, created_at'
    )
    .order('event_id', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌ Failed to load certificates:', error);
    process.exit(1);
  }

  console.log(`   Loaded ${rows.length} rows from certvault_certificates`);

  // Group by (event, email/name, category)
  const groups = new Map();
  for (const row of rows) {
    const key = makeKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  let duplicateGroups = 0;
  let deleteIds = [];

  for (const [key, list] of groups.entries()) {
    if (list.length <= 1) continue;
    duplicateGroups++;

    // Choose best to keep:
    // 1) with pdf_url (non-null), pick the newest created_at among them
    // 2) otherwise, pick newest by created_at
    const withPdf = list.filter((r) => r.pdf_url);
    let keep;
    if (withPdf.length > 0) {
      keep = withPdf.reduce((a, b) =>
        new Date(a.created_at) > new Date(b.created_at) ? a : b
      );
    } else {
      keep = list.reduce((a, b) =>
        new Date(a.created_at) > new Date(b.created_at) ? a : b
      );
    }

    const toDelete = list.filter((r) => r.id !== keep.id).map((r) => r.id);
    if (toDelete.length > 0) {
      deleteIds.push(...toDelete);
    }
  }

  console.log(`   Found ${duplicateGroups} duplicate groups`);
  console.log(`   Will delete ${deleteIds.length} extra rows`);

  if (deleteIds.length === 0) {
    console.log('✅ No duplicates to delete. Nothing to do.');
    return;
  }

  // Safety: delete in batches of 200
  const BATCH_SIZE = 200;
  for (let i = 0; i < deleteIds.length; i += BATCH_SIZE) {
    const batch = deleteIds.slice(i, i + BATCH_SIZE);
    console.log(
      `   Deleting batch ${i + 1}-${i + batch.length} of ${deleteIds.length}...`
    );
    const { error: delError } = await supabase
      .from('certvault_certificates')
      .delete()
      .in('id', batch);
    if (delError) {
      console.error('❌ Error deleting batch:', delError);
      process.exit(1);
    }
  }

  console.log('✅ Duplicate cleanup complete.');
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});

