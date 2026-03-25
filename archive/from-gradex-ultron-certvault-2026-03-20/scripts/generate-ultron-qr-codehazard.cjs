/**
 * Generate QR PNG for team CodeHazard (ULTRON104).
 * QR encodes 10-digit code only. Output folder: downloads/codehazard_qr/
 */

const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { teamIdToEncryptedCode } = require('../lib/ultron-team-code.cjs');

const TEAM_ID = 'ULTRON104';
const TEAM_NAME = 'CodeHazard';

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const outDir = path.join(projectRoot, 'downloads', 'codehazard_qr');
  fs.mkdirSync(outDir, { recursive: true });

  const code = teamIdToEncryptedCode(TEAM_ID);
  if (!code) throw new Error('Could not derive 10-digit code');

  const outPath = path.join(outDir, `${TEAM_NAME}_${code}.png`);
  await QRCode.toFile(outPath, code, { width: 320, margin: 2 });
  console.log('Wrote', outPath);
  console.log('Folder:', outDir);
  console.log('10-digit code:', code);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
