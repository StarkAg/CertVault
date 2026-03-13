/**
 * Mirror app.certifier.io using the saved session (cookies).
 * Converts .certifier-session.json to Netscape cookie format and runs wget.
 *
 * Run: npm run certifier:wget
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const SESSION_FILE = join(ROOT, '.certifier-session.json');
const COOKIES_FILE = join(ROOT, '.certifier-cookies.txt');
const OUT_DIR = join(ROOT, 'certifier-mirror-authed');
const BASE = 'https://app.certifier.io';

// Netscape cookie format: domain \t includeSubdomains \t path \t secure \t expiry \t name \t value
function toNetscapeCookie(c) {
  const domain = c.domain.startsWith('.') ? c.domain : '.' + c.domain;
  const includeSubdomains = 'TRUE';
  const path = c.path || '/';
  const secure = c.secure ? 'TRUE' : 'FALSE';
  const expiry = Math.floor((c.expires || Date.now() / 1000 + 86400 * 365));
  return [domain, includeSubdomains, path, secure, expiry, c.name, c.value].join('\t');
}

function main() {
  if (!existsSync(SESSION_FILE)) {
    console.error('No saved session. Run first: npm run certifier:login');
    process.exit(1);
  }

  const { cookies } = JSON.parse(readFileSync(SESSION_FILE, 'utf8'));
  const netscape = [
    '# Netscape HTTP Cookie File (for wget)',
    '# https://app.certifier.io',
    ...cookies.map(toNetscapeCookie),
  ].join('\n');

  writeFileSync(COOKIES_FILE, netscape, 'utf8');
  console.log('Cookies written to', COOKIES_FILE);

  mkdirSync(OUT_DIR, { recursive: true });

  const args = [
    '--load-cookies', COOKIES_FILE,
    '--save-cookies', COOKIES_FILE,
    '--keep-session-cookies',
    '--mirror',
    '--convert-links',
    '--adjust-extension',
    '--page-requisites',
    '--no-parent',
    '--wait=1',
    '--random-wait',
    '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    '-e', 'robots=off',
    '--no-check-certificate',
    '-P', OUT_DIR,
    BASE + '/',
  ];

  console.log('Running wget (authenticated)...');
  const proc = spawn('wget', args, {
    stdio: 'inherit',
    cwd: ROOT,
  });

  proc.on('close', (code) => {
    if (code !== 0) process.exit(code || 1);
    console.log('\nDone. Output in:', OUT_DIR);
  });
}

main();
