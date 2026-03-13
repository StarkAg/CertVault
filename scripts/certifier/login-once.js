/**
 * Certifier – log in once and save session
 *
 * 1. Opens a browser window to https://app.certifier.io
 * 2. You log in manually in that window
 * 3. When done, press Enter in this terminal
 * 4. Saves cookies to .certifier-session.json (gitignored) for reuse
 *
 * Run: npm run certifier:login
 * (First time: npx playwright install chromium)
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSION_FILE = join(__dirname, '..', '..', '.certifier-session.json');
const CERTIFIER_ORIGIN = 'https://app.certifier.io';

async function main() {
  console.log('Launching browser…');
  const browser = await chromium.launch({
    headless: false,
    channel: undefined, // use bundled Chromium; or 'chrome' to use installed Chrome
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();
  await page.goto(CERTIFIER_ORIGIN, { waitUntil: 'domcontentloaded' });

  console.log('\n► Log in to Certifier in the browser window.');
  console.log('► When you are fully logged in, come back here and press Enter.\n');

  await new Promise((resolve) => {
    process.stdin.once('data', resolve);
  });

  const cookies = await context.cookies();
  const storage = {
    cookies,
    origin: CERTIFIER_ORIGIN,
    savedAt: new Date().toISOString(),
  };

  mkdirSync(dirname(SESSION_FILE), { recursive: true });
  writeFileSync(SESSION_FILE, JSON.stringify(storage, null, 2), 'utf8');

  console.log(`Session saved to ${SESSION_FILE}`);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
