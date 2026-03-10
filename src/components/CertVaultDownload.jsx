/**
 * CertVault Public Download — students enter names to download their certificates.
 * Route: /certvault/:eventSlug (e.g. /certvault/hize)
 * No login required.
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import CertVaultLayout from './CertVaultLayout';
import JSZip from 'jszip';
import { pdfDownloadUrl } from '../utils/certvaultPdfUrl';
import { certVaultTheme as theme } from '../theme';

const API_PUBLIC_DOWNLOAD = '/api/certvault?action=public-download';

export default function CertVaultDownload() {
  const { eventSlug } = useParams();
  const [namesText, setNamesText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [zipLoading, setZipLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!eventSlug || !namesText.trim()) return;
    const names = namesText.trim().split(/\n/).map(n => n.trim()).filter(Boolean);
    if (names.length === 0) return;

    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(API_PUBLIC_DOWNLOAD, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventSlug, names }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || 'Something went wrong');
      }
    } catch (err) {
      setError('Failed to find certificates. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadAllZip() {
    if (!result?.matched?.length) return;
    const withPdf = result.matched.filter(c => c.pdf_url);
    if (withPdf.length === 0) {
      alert('No PDFs available for download');
      return;
    }
    setZipLoading(true);
    try {
      const zip = new JSZip();
      for (const cert of withPdf) {
        const res = await fetch(pdfDownloadUrl(cert.pdf_url));
        const blob = await res.blob();
        const safeName = (cert.recipient_name || cert.certificate_id).replace(/[^a-z0-9-_]/gi, '_');
        zip.file(`${safeName}.pdf`, blob);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${result.event?.name || 'certificates'}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to create ZIP');
    } finally {
      setZipLoading(false);
    }
  }

  const eventName = eventSlug ? eventSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '';
  const notFoundCount = result?.notFound?.length || 0;
  const matchedCount = result?.matched?.length || 0;
  const hasValidSlug = eventSlug && String(eventSlug).trim().length > 0;

  if (!hasValidSlug) {
    return (
      <CertVaultLayout>
        <div style={styles.wrap}>
          <h1 style={styles.title}>Download Certificate</h1>
          <div style={styles.invalidLinkCard}>
            <p style={styles.invalidLinkText}>Invalid download link.</p>
            <p style={styles.invalidLinkHint}>Please use the link shared by your organizer.</p>
          </div>
        </div>
      </CertVaultLayout>
    );
  }

  return (
    <CertVaultLayout>
      <style>{`
        @media (max-width: 768px) {
          .certvault-download-wrap {
            padding: 0 12px !important;
          }
          .certvault-download-title {
            font-size: 20px !important;
            white-space: normal !important;
          }
          .certvault-download-subtitle {
            font-size: 12px !important;
          }
          .certvault-download-textarea {
            font-size: 13px !important;
            padding: 10px 12px !important;
          }
          .certvault-download-btn {
            font-size: 13px !important;
            padding: 10px 18px !important;
            white-space: nowrap !important;
          }
          .certvault-download-row {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 10px !important;
            padding: 10px 12px !important;
          }
          .certvault-download-name {
            font-size: 13px !important;
            white-space: normal !important;
            word-break: break-word !important;
          }
          .certvault-download-actions {
            width: 100% !important;
            justify-content: flex-start !important;
            flex-wrap: wrap !important;
            gap: 6px !important;
          }
          .certvault-download-link,
          .certvault-download-verify-link {
            font-size: 11px !important;
            padding: 5px 10px !important;
            white-space: nowrap !important;
          }
          .certvault-download-summary {
            font-size: 12px !important;
            white-space: normal !important;
          }
          .certvault-download-zip-btn {
            font-size: 12px !important;
            padding: 8px 14px !important;
            white-space: nowrap !important;
          }
        }
      `}</style>
      <div className="certvault-download-wrap" style={styles.wrap}>
        <h1 className="certvault-download-title" style={styles.title}>
          Download Certificate
          {eventName && <span style={styles.eventName}> — {eventName}</span>}
        </h1>
        <p className="certvault-download-subtitle" style={styles.subtitle}>Enter your <strong>name or email ID</strong> (one per line) to find and download your certificate.</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <textarea
            value={namesText}
            onChange={(e) => setNamesText(e.target.value)}
            placeholder="rahul@example.com&#10;Rahul Kumar Sharma&#10;priya@example.com"
            className="certvault-download-textarea"
            style={styles.textarea}
            rows={4}
            disabled={loading}
          />
          <button type="submit" className="certvault-download-btn" style={styles.btn} disabled={loading}>
            {loading ? 'Searching…' : 'Find my certificate'}
          </button>
        </form>

        {error && (
          <div style={styles.errorCard}>
            <p style={styles.error}>{error}</p>
            {error.includes('not found') && (
              <p style={styles.errorHint}>The download link may be incorrect. Please check with the organizer.</p>
            )}
          </div>
        )}

        {result && (
          <div style={styles.resultCard}>
            <p className="certvault-download-summary" style={styles.summary}>
              Found {matchedCount} of {matchedCount + notFoundCount} name{matchedCount + notFoundCount !== 1 ? 's' : ''}.
              {notFoundCount > 0 && (
                <span style={styles.notFound}> {notFoundCount} not found.</span>
              )}
            </p>

            {matchedCount > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleDownloadAllZip}
                  className="certvault-download-zip-btn"
                  style={styles.zipBtn}
                  disabled={zipLoading}
                >
                  {zipLoading ? 'Creating ZIP…' : 'Download all as ZIP'}
                </button>
                <div style={styles.list}>
                  {result.matched.map((c) => (
                    <div key={c.certificate_id} className="certvault-download-row" style={styles.row}>
                      <span className="certvault-download-name" style={styles.name}>{c.recipient_name}</span>
                      <div className="certvault-download-actions" style={styles.actions}>
                        {c.pdf_url ? (
                          <a
                            href={pdfDownloadUrl(c.pdf_url, true)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="certvault-download-link"
                            style={styles.downloadLink}
                            download
                          >
                            Download PDF
                          </a>
                        ) : (
                          <span style={styles.noPdf}>No PDF available</span>
                        )}
                        <a
                          href={`/verify?id=${encodeURIComponent(c.certificate_id)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="certvault-download-verify-link"
                          style={styles.verifyLink}
                        >
                          Verify
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {notFoundCount > 0 && (
              <div style={styles.notFoundList}>
                <span style={styles.notFoundLabel}>Not found:</span>{' '}
                {result.notFound.join(', ')}
              </div>
            )}
          </div>
        )}
      </div>
    </CertVaultLayout>
  );
}

const styles = {
  wrap: {
    maxWidth: 560,
    margin: '0 auto',
    padding: '0 24px',
    boxSizing: 'border-box',
  },
  title: {
    fontFamily: "'Space Grotesk', Inter, sans-serif",
    fontSize: 26,
    fontWeight: 600,
    color: theme.text,
    margin: '0 0 8px',
    whiteSpace: 'nowrap',
  },
  eventName: { fontWeight: 400, color: theme.textSecondary, whiteSpace: 'nowrap' },
  subtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    margin: '0 0 24px',
    lineHeight: 1.5,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    marginBottom: 24,
  },
  textarea: {
    padding: '14px 16px',
    fontSize: 15,
    border: `1px solid ${theme.border}`,
    borderRadius: 10,
    backgroundColor: theme.bgInput,
    color: theme.text,
    fontFamily: 'inherit',
    resize: 'vertical',
    outline: 'none',
  },
  btn: {
    padding: '14px 24px',
    fontSize: 16,
    fontWeight: 600,
    color: '#fff',
    backgroundColor: theme.accent,
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap',
  },
  invalidLinkCard: {
    marginTop: 24,
    padding: 24,
    backgroundColor: theme.errorLight,
    borderRadius: 12,
    border: `1px solid ${theme.error}`,
  },
  invalidLinkText: { fontSize: 16, color: theme.error, margin: '0 0 8px', fontWeight: 500 },
  invalidLinkHint: { fontSize: 14, color: theme.textSecondary, margin: 0 },
  errorCard: { marginBottom: 16, padding: 16, backgroundColor: theme.errorLight, borderRadius: 10, border: `1px solid ${theme.error}` },
  error: { fontSize: 14, color: theme.error, margin: 0 },
  errorHint: { fontSize: 13, color: theme.textSecondary, margin: '8px 0 0' },
  resultCard: {
    padding: 24,
    backgroundColor: theme.bgCard,
    border: `1px solid ${theme.success}`,
    borderRadius: 12,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  summary: {
    fontSize: 14,
    color: theme.text,
    margin: '0 0 16px',
    whiteSpace: 'nowrap',
  },
  notFound: { color: theme.error },
  zipBtn: {
    padding: '10px 20px',
    marginBottom: 20,
    fontSize: 14,
    fontWeight: 500,
    color: theme.success,
    backgroundColor: theme.successLight,
    border: `1px solid ${theme.success}`,
    borderRadius: 8,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: theme.bgInput,
    borderRadius: 8,
    whiteSpace: 'nowrap',
  },
  name: { fontSize: 15, color: theme.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  actions: { display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 },
  downloadLink: {
    fontSize: 14,
    color: theme.success,
    textDecoration: 'none',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  verifyLink: {
    fontSize: 13,
    color: theme.accent,
    textDecoration: 'none',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  noPdf: { fontSize: 13, color: theme.textMuted, whiteSpace: 'nowrap', flexShrink: 0 },
  notFoundList: {
    marginTop: 16,
    paddingTop: 16,
    borderTop: `1px solid ${theme.border}`,
    fontSize: 13,
    color: theme.textSecondary,
    whiteSpace: 'nowrap',
    overflowX: 'auto',
  },
  notFoundLabel: { color: theme.error },
};
