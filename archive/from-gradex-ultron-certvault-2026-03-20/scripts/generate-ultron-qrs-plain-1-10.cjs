/**
 * Generate QR PNGs for ULTRON001..ULTRON010 containing PLAIN team_ids.
 *
 * - No Supabase needed; just encodes the string "ULTRON00X" directly.
 * - Output folder: downloads/ultron_qrs_plain_1-10/
 * - Also creates: downloads/ultron_qrs_plain_1-10.zip
 */

const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

async function main() {
  const projectRoot = path.resolve(__dirname, '..');

  const ids = Array.from({ length: 10 }, (_, i) => `ULTRON${String(i + 1).padStart(3, '0')}`);
  const outDir = path.join(projectRoot, 'downloads', 'ultron_qrs_plain_1-10');
  fs.mkdirSync(outDir, { recursive: true });

  console.log('Generating plain-id QRs for:', ids.join(', '));

  for (const teamId of ids) {
    const outPath = path.join(outDir, `${teamId}.png`);
    await QRCode.toFile(outPath, teamId, { width: 320, margin: 2 });
    console.log('Wrote', outPath);
  }

  // Try to zip the folder for easy download
  const zipPath = path.join(projectRoot, 'downloads', 'ultron_qrs_plain_1-10.zip');
  try {
    const { execSync } = require('child_process');
    execSync(
      `cd "${path.join(
        projectRoot,
        'downloads'
      )}" && rm -f "ultron_qrs_plain_1-10.zip" && zip -r "ultron_qrs_plain_1-10.zip" "ultron_qrs_plain_1-10"`,
      { stdio: 'inherit' }
    );
    console.log('Zip created:', zipPath);
  } catch (e) {
    console.warn('Zip failed (you can still use the folder):', e.message);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

