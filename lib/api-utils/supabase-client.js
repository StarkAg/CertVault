/**
 * Supabase client for Ultron 9.0 (hackathon management).
 * Uses SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from env.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseAdmin = null;
let supabase = null;

if (supabaseUrl && serviceRoleKey) {
  supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  supabase = supabaseAdmin;
}

export { supabaseAdmin, supabase };

export function isSupabaseConfigured() {
  return !!(supabaseUrl && serviceRoleKey);
}
