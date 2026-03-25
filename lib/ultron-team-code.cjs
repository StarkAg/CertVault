/**
 * Deterministic 10-digit encrypted code for a team (from team_id).
 * Same team_id -> same code. Stored in ultron_teams.team_name_encrypted.
 */

const crypto = require('crypto');

function teamIdToEncryptedCode(teamId) {
  const input = String(teamId || '').trim();
  if (!input) return null;
  const h = crypto.createHash('sha256').update(input, 'utf8').digest('hex');
  const n = (parseInt(h.slice(0, 10), 16) % 9000000000) + 1000000000;
  return String(n);
}

function isTenDigitCode(str) {
  if (typeof str !== 'string') return false;
  return /^\d{10}$/.test(str.trim());
}

module.exports = { teamIdToEncryptedCode, isTenDigitCode };
