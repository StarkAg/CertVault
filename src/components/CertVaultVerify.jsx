/**
 * CertVault Verify Certificate — redesigned to match credsverse.com style
 * Supports URL parameter: /certvault/verify?id=CV-XXXX-XXXX
 * Uses icon-192 for HIZE event certificates.
 */
import React, { useState, useEffect, useCallback, useContext } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import CertVaultLayout, { CertVaultLogoContext } from './CertVaultLayout';
import { pdfDownloadUrl } from '../utils/certvaultPdfUrl';
import { certVaultTheme as theme } from '../theme';

const API_VERIFY = '/api/certvault?action=verify';
const HIZE_LOGO = '/icon-192.png';

export default function CertVaultVerify() {
  const [searchParams] = useSearchParams();
  const [certId, setCertId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [visibleStepCount, setVisibleStepCount] = useState(0);
  const [showVerificationResult, setShowVerificationResult] = useState(false);
  const setLogoUrl = useContext(CertVaultLogoContext);

  const verify = useCallback(async (id) => {
    if (!id) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(`${API_VERIFY}&certificate_id=${encodeURIComponent(id)}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.valid) {
        setResult(data);
      } else if (data.revoked) {
        setResult({ valid: false, revoked: true });
        setError('This certificate has been revoked');
      } else {
        setResult({ valid: false });
      }
    } catch (err) {
      setError('Verification failed. Please try again.');
      setResult({ valid: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const urlId = searchParams.get('id');
    if (urlId) {
      setCertId(urlId);
      verify(urlId);
    }
  }, [searchParams, verify]);

  useEffect(() => {
    if (!setLogoUrl) return;
    const isHize = result?.valid && result?.event_name && /hize/i.test(result.event_name);
    setLogoUrl(isHize ? HIZE_LOGO : '/CertVault_Logo-2-removebg-preview.png');
  }, [result, setLogoUrl]);

  async function handleSubmit(e) {
    e.preventDefault();
    const id = certId.trim();
    verify(id);
  }

  function handleShare() {
    if (navigator.share) {
      navigator.share({
        title: `Certificate - ${result?.recipient_name}`,
        text: `Check out ${result?.recipient_name}'s certificate for ${result?.event_name}`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  }

  function handleLinkedIn() {
    const url = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(result?.event_name || 'Certificate')}&organizationName=${encodeURIComponent(result?.issuing_organization || 'CertVault')}&issueYear=${new Date(result?.date_issued || Date.now()).getFullYear()}&certUrl=${encodeURIComponent(window.location.href)}&certId=${encodeURIComponent(result?.certificate_id || certId)}`;
    window.open(url, '_blank');
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href);
    alert('Link copied to clipboard!');
  }

  // Animate verification steps when modal opens
  useEffect(() => {
    if (!showVerifyModal) {
      setVisibleStepCount(0);
      setShowVerificationResult(false);
      return;
    }
    setVisibleStepCount(0);
    setShowVerificationResult(false);
    const timeouts = [
      setTimeout(() => setVisibleStepCount(1), 300),
      setTimeout(() => setVisibleStepCount(2), 700),
      setTimeout(() => setVisibleStepCount(3), 1100),
      setTimeout(() => setVisibleStepCount(4), 1500),
      setTimeout(() => setShowVerificationResult(true), 2100),
    ];
    return () => {
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, [showVerifyModal]);

  const showInvalid = result && !result.valid;
  const showValid = result && result.valid;
  const isHize = result?.valid && result?.event_name && /hize/i.test(result.event_name);

  return (
    <CertVaultLayout>
      <style>{`
        .certvault-verify-left::-webkit-scrollbar {
          width: 8px;
        }
        .certvault-verify-left::-webkit-scrollbar-track {
          background: transparent;
        }
        .certvault-verify-left::-webkit-scrollbar-thumb {
          background: ${theme.border};
          border-radius: 4px;
        }
        .certvault-verify-left::-webkit-scrollbar-thumb:hover {
          background: ${theme.textMuted};
        }
        .certvault-pdf-container {
          background: transparent !important;
        }
        .certvault-pdf-container object,
        .certvault-pdf-container iframe {
          pointer-events: none;
          user-select: none;
          -webkit-user-select: none;
          touch-action: none;
          -webkit-touch-callout: none;
          background: transparent !important;
        }
        .certvault-pdf-container object embed {
          background: transparent !important;
        }
        
        @media (max-width: 1024px) {
          .certvault-verify-main-container {
            flex-direction: column !important;
            height: auto !important;
            overflow: visible !important;
            gap: 24px !important;
            padding: 16px !important;
          }
          .certvault-verify-left-column,
          .certvault-verify-left {
            flex: 1 1 100% !important;
            width: 100% !important;
            padding-right: 0 !important;
            max-height: none !important;
            overflow-y: visible !important;
            overflow-x: visible !important;
            overflow: visible !important;
          }
          .certvault-verify-right-column {
            flex: 1 1 100% !important;
            width: 100% !important;
            padding: 16px !important;
            order: -1 !important;
          }
          .certvault-verify-pdf-preview {
            height: 400px !important;
            max-height: 50vh !important;
          }
        }
        
        @media (max-width: 768px) {
          .certvault-verify-main-container {
            height: auto !important;
            overflow: visible !important;
            min-height: auto !important;
          }
          .certvault-verify-left-column,
          .certvault-verify-left {
            overflow-y: visible !important;
            overflow-x: visible !important;
            overflow: visible !important;
            max-height: none !important;
            height: auto !important;
          }
          .certvault-verify-search-section {
            margin: 32px auto !important;
            padding: 0 12px !important;
          }
          .certvault-verify-search-title {
            font-size: 20px !important;
            margin-bottom: 16px !important;
            white-space: nowrap !important;
          }
          .certvault-verify-recipient-name {
            font-size: 20px !important;
            line-height: 1.1 !important;
            word-break: break-word !important;
          }
          .certvault-verify-issuer-name {
            font-size: 18px !important;
            line-height: 1.1 !important;
            word-break: break-word !important;
          }
          .certvault-verify-action-buttons {
            gap: 6px !important;
          }
          .certvault-verify-share-btn,
          .certvault-verify-linkedin-btn,
          .certvault-verify-download-btn,
          .certvault-verify-link-btn {
            padding: 7px 12px !important;
            font-size: 11px !important;
            flex: 1 1 calc(50% - 3px) !important;
            justify-content: center !important;
            white-space: nowrap !important;
            min-width: 0 !important;
          }
          .certvault-verify-pdf-preview {
            height: 280px !important;
            max-height: 35vh !important;
          }
          .certvault-verify-section-header {
            font-size: 10px !important;
          }
          .certvault-verify-contact-text {
            font-size: 12px !important;
          }
          .certvault-verify-description-title {
            font-size: 14px !important;
          }
          .certvault-verify-description-text {
            font-size: 12px !important;
          }
          .certvault-verify-issue-date {
            font-size: 12px !important;
          }
          .certvault-verify-credential-btn {
            padding: 10px 16px !important;
            font-size: 13px !important;
          }
          .certvault-verify-credential-id-small {
            font-size: 11px !important;
          }
        }
      `}</style>
      <div style={{ ...styles.wrap, backgroundColor: theme.bg }}>
        {/* Search Form */}
        {!showValid && (
          <div className="certvault-verify-search-section" style={styles.searchSection}>
            <h1 className="certvault-verify-search-title" style={styles.searchTitle}>Verify Certificate</h1>
            <form onSubmit={handleSubmit} style={styles.form}>
              <input
                type="text"
                value={certId}
                onChange={(e) => setCertId(e.target.value)}
                placeholder="Enter Certificate ID"
                style={styles.input}
                autoFocus
                disabled={loading}
              />
              <button type="submit" style={styles.verifyBtn} disabled={loading}>
                {loading ? 'Verifying…' : 'Verify'}
              </button>
            </form>
            {error && <p style={styles.error}>{error}</p>}
            {showInvalid && (
              <div style={styles.invalidCard}>
                <span style={styles.invalidStatus}>Certificate not found</span>
                <p style={styles.invalidText}>The Certificate ID may be incorrect or the certificate may have been revoked.</p>
              </div>
            )}
          </div>
        )}

        {/* Valid Certificate Display */}
        {showValid && (
          <div className="certvault-verify-main-container" style={styles.mainContainer}>
            {/* Left Column: PDF Preview */}
            <div className="certvault-verify-right-column" style={styles.rightColumn}>
              <div className="certvault-pdf-container" style={styles.certificateCard}>
                {result.pdf_url ? (
                  <object
                    data={pdfDownloadUrl(result.pdf_url) + '#toolbar=0&navpanes=0&scrollbar=0&zoom=page-fit&view=FitH'}
                    type="application/pdf"
                    style={styles.pdfPreview}
                    title="Certificate Preview"
                    aria-label="Certificate Preview"
                  >
                  <iframe
                    src={pdfDownloadUrl(result.pdf_url) + '#toolbar=0&navpanes=0&scrollbar=0&zoom=page-fit&view=FitH'}
                    type="application/pdf"
                    className="certvault-verify-pdf-preview"
                    style={styles.pdfPreview}
                    title="Certificate Preview"
                    scrolling="no"
                    allow="fullscreen"
                    onError={() => {
                      console.error('PDF failed to load');
                    }}
                  />
                  </object>
                ) : (
                  <div style={styles.certificatePlaceholder}>
                    <div style={styles.certificateContent}>
                      <h2 style={styles.certTitle}>CERTIFICATE OF PARTICIPATION</h2>
                      <p style={styles.certPreamble}>This is to certify that</p>
                      <h3 style={styles.certName}>{result.recipient_name}</h3>
                      <p style={styles.certDescription}>
                        Has actively participated in {result.event_name || 'the event'} organized by {result.issuing_organization || 'the organization'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: All Content */}
            <div className="certvault-verify-left certvault-verify-left-column" style={styles.leftColumn}>
              {/* Credential Info Bar */}
              <div style={styles.credentialBar}>
                <div style={styles.credentialIdSection}>
                  <span style={styles.checkIcon}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </span>
                  <span style={styles.credentialIdLabel}>Credential ID:</span>
                  <span style={styles.credentialIdValue}>{result.certificate_id || certId}</span>
                  <button onClick={handleCopyLink} style={styles.copyLinkBtn} title="Copy link">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                    </svg>
                  </button>
                </div>
                <div style={styles.distributedBy}>
                  <span style={styles.distributedLabel}>Distributed by:</span>
                  <span style={styles.distributedValue}>CertVault - GradeX</span>
                </div>
              </div>

              {/* ISSUED TO Section */}
              <div style={styles.section}>
                <div className="certvault-verify-section-header" style={styles.sectionHeader}>ISSUED TO</div>
                <h2 className="certvault-verify-recipient-name" style={styles.recipientName}>{result.recipient_name}</h2>

                {/* Action Buttons */}
                <div className="certvault-verify-action-buttons" style={styles.actionButtons}>
                  <button onClick={handleShare} className="certvault-verify-share-btn" style={styles.shareBtn}>
                    Share Your Award
                  </button>
                  <button onClick={handleLinkedIn} className="certvault-verify-linkedin-btn" style={styles.linkedInBtn}>
                    Add to LinkedIn Profile
                  </button>
                  {result.pdf_url && (
                    <a href={pdfDownloadUrl(result.pdf_url, true)} download className="certvault-verify-download-btn" style={styles.downloadBtn}>
                      Download
                    </a>
                  )}
                  <button onClick={handleCopyLink} className="certvault-verify-link-btn" style={styles.linkBtn} title="Copy link">
                    Copy link
                  </button>
                </div>

                <p className="certvault-verify-contact-text" style={styles.contactText}>
                  Want to report a typo or a mistake?{' '}
                  <a href={`mailto:${result.recipient_email || 'support@certvault.com'}`} style={styles.contactLink}>
                    Contact Issuer
                  </a>
                </p>
              </div>

              {/* ISSUED BY Section */}
              <div style={styles.section}>
                <div style={styles.sectionHeader}>ISSUED BY</div>
                <div style={styles.issuerRow}>
                  {isHize && <img src="/IEEEXULTRON.png" alt="IEEE SRM" style={styles.ieeeLogo} />}
                  <h2 className="certvault-verify-issuer-name" style={styles.issuerName}>{result.issuing_organization || 'Organization'}</h2>
                </div>

                <div style={styles.descriptionSection}>
                  <h3 className="certvault-verify-description-title" style={styles.descriptionTitle}>Description</h3>
                  <p className="certvault-verify-description-text" style={styles.descriptionText}>
                    {result.event_name || 'No information provided for this award.'}
                  </p>
                </div>
              </div>

              {/* Verification Section */}
              <div style={styles.verificationSection}>
                <div style={styles.verificationHeader}>
                  <span style={styles.verifyCheckIcon}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </span>
                  <span style={styles.verificationTitle}>CREDENTIAL VERIFICATION</span>
                </div>
                <p className="certvault-verify-issue-date" style={styles.issueDate}>
                  Issue date: {result.date_issued ? new Date(result.date_issued).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                </p>
                <button
                  onClick={() => setShowVerifyModal(true)}
                  className="certvault-verify-credential-btn"
                  style={styles.verifyCredentialBtn}
                >
                  Verify Credential
                </button>
                <p className="certvault-verify-credential-id-small" style={styles.credentialIdSmall}>
                  ID: {result.certificate_id || certId}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Verification Modal */}
        {showVerifyModal && (
          <div style={styles.modalOverlay} onClick={() => setShowVerifyModal(false)}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <h3 style={styles.modalTitle}>Credential Verification</h3>
                <button onClick={() => setShowVerifyModal(false)} style={styles.modalClose}>×</button>
              </div>
              <div style={styles.verificationSteps}>
                {visibleStepCount >= 1 && (
                  <div style={styles.step}>
                    <div style={styles.stepIcon}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                    <div style={styles.stepContent}>
                      <div style={styles.stepTitle}>Verifying the recipient</div>
                      <div style={styles.stepText}>
                        The owner of this credential is {result.recipient_name}.
                      </div>
                    </div>
                  </div>
                )}
                {visibleStepCount >= 2 && (
                  <div style={styles.step}>
                    <div style={styles.stepIcon}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                    <div style={styles.stepContent}>
                      <div style={styles.stepTitle}>Verifying the issuer</div>
                      <div style={styles.stepText}>
                        The issuer of this credential is{' '}
                        {result.issuing_organization || 'the organization'}.
                      </div>
                    </div>
                  </div>
                )}
                {visibleStepCount >= 3 && (
                  <div style={styles.step}>
                    <div style={styles.stepIcon}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                    <div style={styles.stepContent}>
                      <div style={styles.stepTitle}>Verifying the issuer's status</div>
                      <div style={styles.stepText}>
                        {(result.issuing_organization || 'The organization')}{' '}
                        organization has been verified by CertVault.
                      </div>
                    </div>
                  </div>
                )}
                {visibleStepCount >= 4 && (
                  <div style={styles.step}>
                    <div style={styles.stepIcon}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                    <div style={styles.stepContent}>
                      <div style={styles.stepTitle}>Verifying the credential's ID</div>
                      <div style={styles.stepText}>
                        The ID of this credential is unique and valid.
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {showVerificationResult && (
                <div style={styles.modalResult}>
                  <div style={styles.resultIcon}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                  <div style={styles.resultContent}>
                    <div style={styles.resultTitle}>This is the valid credential.</div>
                    <div style={styles.resultText}>
                      This credential was securely issued via CertVault. All the displayed
                      information is valid.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </CertVaultLayout>
  );
}

const styles = {
  wrap: {
    width: '100%',
    minHeight: '100vh',
    padding: 0,
    color: theme.text,
    display: 'flex',
    flexDirection: 'column',
  },
  mainContainer: {
    display: 'flex',
    flex: 1,
    gap: 28,
    padding: '20px 32px',
    maxWidth: 1600,
    margin: '0 auto',
    width: '100%',
    height: 'calc(100vh - 80px)',
    overflow: 'hidden',
    minHeight: 0,
    boxSizing: 'border-box',
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  searchSection: {
    maxWidth: 600,
    margin: '80px auto',
    padding: '0 24px',
    textAlign: 'center',
  },
  searchTitle: {
    fontSize: 32,
    fontWeight: 600,
    color: theme.text,
    marginBottom: 24,
  },
  form: {
    display: 'flex',
    gap: 12,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    padding: '14px 16px',
    fontSize: 15,
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    backgroundColor: theme.bgInput,
    color: theme.text,
    outline: 'none',
  },
  verifyBtn: {
    padding: '14px 32px',
    fontSize: 15,
    fontWeight: 600,
    backgroundColor: theme.accent,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
  },
  error: {
    fontSize: 14,
    color: theme.error,
    marginTop: 16,
  },
  invalidCard: {
    marginTop: 24,
    padding: 24,
    backgroundColor: theme.errorLight,
    border: `1px solid ${theme.error}`,
    borderRadius: 12,
  },
  invalidStatus: {
    display: 'block',
    fontSize: 16,
    fontWeight: 600,
    color: theme.error,
    marginBottom: 8,
  },
  invalidText: {
    fontSize: 14,
    color: theme.textSecondary,
    margin: 0,
  },
  leftColumn: {
    flex: '0 0 50%',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
    overflowY: 'auto',
    overflowX: 'hidden',
    paddingRight: 12,
    minHeight: 0,
    scrollbarWidth: 'thin',
    scrollbarColor: `${theme.border} transparent`,
  },
  rightColumn: {
    flex: '0 0 50%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflow: 'hidden',
    minHeight: 0,
    padding: '20px',
    backgroundColor: 'transparent',
  },
  certificateCard: {
    width: '100%',
    maxWidth: '100%',
    maxHeight: '80%',
    height: 'auto',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    border: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
  },
  pdfPreview: {
    width: '100%',
    height: '450px',
    maxHeight: '60vh',
    border: 'none',
    display: 'block',
    backgroundColor: 'transparent',
    objectFit: 'contain',
  },
  certificatePlaceholder: {
    padding: '40px 30px',
    background: 'linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%)',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  certificateContent: {
    textAlign: 'center',
    color: '#fff',
  },
  certTitle: {
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 20,
    letterSpacing: '0.1em',
  },
  certPreamble: {
    fontSize: 14,
    marginBottom: 12,
  },
  certName: {
    fontSize: 36,
    fontWeight: 700,
    marginBottom: 20,
    textDecoration: 'underline',
  },
  certDescription: {
    fontSize: 16,
    lineHeight: 1.5,
  },
  credentialBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 18px',
    backgroundColor: theme.bgInput,
    borderRadius: 8,
    flexWrap: 'wrap',
    gap: 12,
    flexShrink: 0,
  },
  credentialIdSection: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  checkIcon: {
    color: theme.success,
    fontSize: 18,
  },
  credentialIdLabel: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  credentialIdValue: {
    fontSize: 14,
    color: theme.accent,
    fontFamily: 'monospace',
    fontWeight: 500,
  },
  copyLinkBtn: {
    background: 'none',
    border: 'none',
    color: theme.textMuted,
    cursor: 'pointer',
    fontSize: 16,
    padding: '4px 8px',
  },
  distributedBy: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  distributedLabel: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  distributedValue: {
    fontSize: 14,
    color: theme.text,
    fontWeight: 500,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    flexShrink: 0,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: 600,
    color: theme.accent,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: 8,
  },
  recipientName: {
    fontSize: 30,
    fontWeight: 700,
    color: theme.text,
    margin: 0,
    lineHeight: 1.2,
  },
  actionButtons: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  shareBtn: {
    padding: '10px 18px',
    backgroundColor: theme.accent,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    whiteSpace: 'nowrap',
  },
  linkedInBtn: {
    padding: '10px 18px',
    backgroundColor: theme.bgInput,
    color: theme.text,
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    whiteSpace: 'nowrap',
  },
  downloadBtn: {
    padding: '10px 18px',
    backgroundColor: theme.bgInput,
    color: theme.text,
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    whiteSpace: 'nowrap',
  },
  linkBtn: {
    padding: '10px 14px',
    backgroundColor: theme.bgInput,
    color: theme.text,
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    fontSize: 14,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    whiteSpace: 'nowrap',
  },
  btnIcon: {
    fontSize: 16,
  },
  contactText: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 8,
  },
  contactLink: {
    color: theme.accent,
    textDecoration: 'none',
  },
  issuerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  ieeeLogo: {
    width: 64,
    height: 64,
    objectFit: 'contain',
  },
  issuerName: {
    fontSize: 26,
    fontWeight: 700,
    color: theme.text,
    margin: 0,
    lineHeight: 1.2,
  },
  descriptionSection: {
    marginTop: 8,
  },
  descriptionTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: theme.text,
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 1.6,
  },
  verificationSection: {
    padding: '18px',
    backgroundColor: theme.bgInput,
    borderRadius: 8,
    flexShrink: 0,
  },
  verificationHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  verifyCheckIcon: {
    color: theme.success,
    fontSize: 18,
  },
  verificationTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: theme.success,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  issueDate: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 16,
  },
  verifyCredentialBtn: {
    width: '100%',
    padding: '14px 20px',
    backgroundColor: theme.success,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  credentialIdSmall: {
    fontSize: 13,
    color: theme.accent,
    fontFamily: 'monospace',
    margin: 0,
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: theme.overlay,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: '20px',
  },
  modalContent: {
    backgroundColor: theme.bgCard,
    borderRadius: 12,
    padding: '32px',
    maxWidth: 600,
    width: '100%',
    maxHeight: '90vh',
    overflowY: 'auto',
    border: `1px solid ${theme.border}`,
    color: theme.text,
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 600,
    color: theme.text,
    margin: 0,
  },
  modalClose: {
    background: 'none',
    border: 'none',
    color: theme.text,
    fontSize: 32,
    cursor: 'pointer',
    padding: 0,
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verificationSteps: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
    marginBottom: 24,
    position: 'relative',
    paddingLeft: 24,
  },
  step: {
    display: 'flex',
    gap: 16,
    position: 'relative',
  },
  stepIcon: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    backgroundColor: theme.accent,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    fontWeight: 600,
    flexShrink: 0,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: theme.text,
    marginBottom: 4,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  stepText: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 1.5,
  },
  modalResult: {
    padding: '20px',
    backgroundColor: theme.successLight,
    border: `1px solid ${theme.success}`,
    borderRadius: 8,
    display: 'flex',
    gap: 16,
  },
  resultIcon: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    backgroundColor: theme.success,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 24,
    fontWeight: 600,
    flexShrink: 0,
  },
  resultContent: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: theme.text,
    marginBottom: 4,
  },
  resultText: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 1.5,
  },
};
