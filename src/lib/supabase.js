/**
 * Supabase client for CertVault auth (magic link / email link).
 * Uses Vite env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY.
 */
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn('[CertVault] Supabase env missing (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY). Magic link login will be disabled.');
}

export const supabase = url && anonKey
  ? createClient(url, anonKey, { auth: { detectSessionInUrl: true } })
  : null;

/** Redirect URL for magic link (must be allowlisted in Supabase Dashboard) */
export function getAuthRedirectUrl() {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/auth/callback`;
}
