export const CERTVAULT_VERIFY_ID_PLACEHOLDER = '{certificate_id}';
export const CERTVAULT_VERIFY_PATH = '/certvault/verify';

function trimTrailingSlash(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function normalizeCertificateIdToken(value) {
  const token = String(value || CERTVAULT_VERIFY_ID_PLACEHOLDER).trim();
  if (!token || token === '{id}' || token === CERTVAULT_VERIFY_ID_PLACEHOLDER) {
    return CERTVAULT_VERIFY_ID_PLACEHOLDER;
  }
  return encodeURIComponent(token);
}

function extractVerifyIdToken(line) {
  const text = String(line || '');
  const match = text.match(/\/(?:certvault\/)?verify\?id=([^)\s]+)/i);
  if (!match?.[1]) return CERTVAULT_VERIFY_ID_PLACEHOLDER;

  const rawToken = match[1].replace(/[.,;:]+$/, '');
  try {
    return decodeURIComponent(rawToken);
  } catch {
    return rawToken;
  }
}

export function buildCertVaultVerifyUrl(baseUrl, certificateId = CERTVAULT_VERIFY_ID_PLACEHOLDER) {
  const base = trimTrailingSlash(baseUrl);
  const id = normalizeCertificateIdToken(certificateId);
  const path = `${CERTVAULT_VERIFY_PATH}?id=${id}`;
  return base ? `${base}${path}` : path;
}

export function buildCertVaultVerifyLine(baseUrl, certificateId = CERTVAULT_VERIFY_ID_PLACEHOLDER) {
  return `Verify this certificate at ${buildCertVaultVerifyUrl(baseUrl, certificateId)}`;
}

export function normalizeCertVaultVerifyLine(line, baseUrl) {
  const text = String(line || '').trim();
  if (!text) return buildCertVaultVerifyLine(baseUrl);

  const hasKnownBadHost = /certvaultgradex\.bond/i.test(text);
  const hasVerifyPath = /\/(?:certvault\/)?verify\?id=/i.test(text);

  if (!hasKnownBadHost && !hasVerifyPath) {
    return text;
  }

  return buildCertVaultVerifyLine(baseUrl, extractVerifyIdToken(text));
}
