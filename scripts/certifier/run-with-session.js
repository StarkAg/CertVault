/**
 * Certifier – run with saved session
 *
 * Loads .certifier-session.json and opens a browser already logged in.
 * Use this after running npm run certifier:login once.
 *
 * Run: npm run certifier:run
 */

import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSION_FILE = join(__dirname, '..', '..', '.certifier-session.json');
const CERTIFIER_ORIGIN = 'https://app.certifier.io';

async function main() {
  if (!existsSync(SESSION_FILE)) {
    console.error('No saved session found. Run first: npm run certifier:login');
    process.exit(1);
  }

  const raw = readFileSync(SESSION_FILE, 'utf8');
  const { cookies, origin } = JSON.parse(raw);

  console.log('Launching browser with saved session…');
  const browser = await chromium.launch({
    headless: false,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  await context.addCookies(cookies);

  const page = await context.newPage();
  await page.goto(origin || CERTIFIER_ORIGIN, { waitUntil: 'domcontentloaded' });

  console.log('Browser open. Close the window or press Ctrl+C here when done.');
  await new Promise(() => {}); // run until Ctrl+C or browser closed
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
