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
  console.error(
    '[CertVault build] Missing Supabase env. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before building.\n' +
    '  Local: add them to .env\n' +
    '  Railway: add them in Service → Variables, then redeploy (build runs with those vars).'
  );
  process.exit(1);
}

console.log('[CertVault build] Supabase env OK');
