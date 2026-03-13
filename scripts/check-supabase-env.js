#!/usr/bin/env node
/**
 * Build-time check: ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set
 * so the frontend bundle gets them. Run before `vite build` (e.g. on Railway).
 */
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    '[CertVault build] Missing Supabase env (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY). Magic link login will be disabled in this build.\n' +
    '  Local: add them to .env\n' +
    '  Railway: set them in Service → Variables. With Dockerfile they must be passed as build args; if build still fails, try Nixpacks (rename Dockerfile) so vars are injected at build time.'
  );
} else {
  console.log('[CertVault build] Supabase env OK');
}
