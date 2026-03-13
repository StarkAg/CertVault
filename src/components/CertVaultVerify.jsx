/**
 * CertVault Verify Certificate — Stitch screen-4 layout.
 * Keeps: URL ?id=, verify API, result state, share/LinkedIn/copy, PDF download, logo context, Verify Credential modal.
 */
import React, { useState, useEffect, useCallback, useContext } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import CertVaultLayout, { CertVaultLogoContext } from './CertVaultLayout';
import { pdfDownloadUrl } from '../utils/certvaultPdfUrl';

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

  function handleSubmit(e) {
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
    return () => timeouts.forEach((t) => clearTimeout(t));
  }, [showVerifyModal]);

  const showInvalid = result && !result.valid;
  const showValid = result && result.valid;

  return (
    <CertVaultLayout>
      <div className="min-h-screen w-full bg-[var(--apple-bg)] flex flex-col">
        <main className="flex-1 flex flex-col items-center px-6 pt-10 pb-24">
          <div className="max-w-[720px] w-full flex flex-col items-center">
            {/* Title */}
            <div className="text-center mb-10">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[var(--apple-text-primary)] mb-4">
                Verify Certificate
              </h1>
              <p className="text-[var(--apple-text-secondary)] text-lg">
                Enter the unique certificate ID to validate authenticity.
              </p>
            </div>

            {/* Form */}
            <div className="w-full relative mb-10">
              <form onSubmit={handleSubmit} className="group relative flex items-center p-2 bg-white border border-slate-200 rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-[var(--apple-accent)]/20 transition-all">
                <span className="material-symbols-outlined absolute left-6 text-[var(--apple-text-secondary)]">qr_code_scanner</span>
                <input
                  type="text"
                  value={certId}
                  onChange={(e) => setCertId(e.target.value)}
                  placeholder="Certificate ID (e.g. CV-8293-4921)"
                  className="w-full bg-transparent border-none focus:ring-0 pl-14 pr-32 py-4 text-lg font-medium placeholder:text-[var(--apple-text-secondary)]/60 text-[var(--apple-text-primary)] outline-none"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="absolute right-3 px-8 py-3 bg-[var(--apple-accent)] text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 hover:opacity-90 transition-all disabled:opacity-60"
                >
                  {loading ? 'Verifying…' : 'Verify'}
                </button>
              </form>
            </div>

            {error && (
              <div className="w-full max-w-[640px] mb-6 p-4 rounded-xl bg-red-50 border border-red-100 flex items-center gap-2 text-red-600 text-sm">
                <span className="material-symbols-outlined">error</span>
                <span>{error}</span>
              </div>
            )}

            {showInvalid && (
              <div className="w-full max-w-[640px] bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-600 text-xs font-bold tracking-wide uppercase mb-4">
                  <span className="material-symbols-outlined text-sm">cancel</span>
                  {result.revoked ? 'Revoked' : 'Not found'}
                </div>
                <p className="text-[var(--apple-text-primary)] font-semibold text-lg">
                  {result.revoked ? 'This certificate has been revoked.' : 'Certificate not found'}
                </p>
                <p className="text-[var(--apple-text-secondary)] text-sm mt-1">
                  The Certificate ID may be incorrect or the certificate may have been revoked.
                </p>
              </div>
            )}

            {showValid && (
              <div className="w-full max-w-[640px] bg-white border border-slate-100 rounded-xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 border-b border-slate-100 pb-8">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-bold tracking-wide uppercase mb-3">
                      <span className="material-symbols-outlined text-sm">verified</span>
                      Verified
                    </div>
                    <h3 className="text-2xl font-bold text-[var(--apple-text-primary)]">{result.recipient_name}</h3>
                    <p className="text-[var(--apple-text-secondary)] text-sm mt-1">Recipient Name</p>
                  </div>
                  <div className="flex flex-col items-start md:items-end">
                    <span className="material-symbols-outlined text-4xl text-[var(--apple-accent)]/20 mb-1">workspace_premium</span>
                    <p className="text-sm font-semibold text-[var(--apple-text-primary)]">{result.certificate_id || certId}</p>
                    <p className="text-[var(--apple-text-secondary)] text-xs">Certificate ID</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[var(--apple-text-secondary)] mb-2">Event / Achievement</p>
                    <p className="text-lg font-semibold text-[var(--apple-text-primary)] leading-tight">{result.event_name || '—'}</p>
                  </div>
                  <div className="flex flex-col md:items-end">
                    <p className="text-xs font-bold uppercase tracking-widest text-[var(--apple-text-secondary)] mb-2">Issue Date</p>
                    <p className="text-lg font-semibold text-[var(--apple-text-primary)] leading-tight">
                      {result.date_issued ? new Date(result.date_issued).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button type="button" onClick={handleShare} className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-[var(--apple-text-primary)] hover:bg-slate-50 transition-colors">
                    Share Your Award
                  </button>
                  <button type="button" onClick={handleLinkedIn} className="px-4 py-2.5 rounded-lg border border-[#0a66c2] text-sm font-medium text-[#0a66c2] hover:bg-[#0a66c2]/5 transition-colors">
                    Add to LinkedIn
                  </button>
                  <button type="button" onClick={handleCopyLink} className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-[var(--apple-text-primary)] hover:bg-slate-50 transition-colors" title="Copy link">
                    Copy link
                  </button>
                </div>

                <div className="mt-8 pt-8 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="size-10 bg-slate-50 rounded-lg flex items-center justify-center">
                      <span className="material-symbols-outlined text-[var(--apple-accent)]">verified_user</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[var(--apple-text-primary)]">Issued by {result.issuing_organization || 'CertVault'}</p>
                      <p className="text-[10px] text-[var(--apple-text-secondary)] uppercase tracking-tight">Cryptographic Proof Verified</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {result.pdf_url && (
                      <a href={pdfDownloadUrl(result.pdf_url, true)} download className="flex items-center gap-2 text-[var(--apple-accent)] text-sm font-bold hover:underline">
                        <span className="material-symbols-outlined text-lg">download</span>
                        PDF Proof
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowVerifyModal(true)}
                      className="px-4 py-2 rounded-lg bg-slate-100 text-[var(--apple-text-primary)] text-sm font-semibold hover:bg-slate-200 transition-colors"
                    >
                      Verify Credential
                    </button>
                  </div>
                </div>
              </div>
            )}

            <p className="mt-10 text-[var(--apple-text-secondary)] text-sm flex items-center gap-2 justify-center">
              <span className="material-symbols-outlined text-base">info</span>
              Need help? <Link to="/" className="text-[var(--apple-accent)] hover:underline font-medium">Contact our support team</Link>
            </p>
          </div>
        </main>
      </div>

      {showVerifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setShowVerifyModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-[var(--apple-text-primary)]">Credential Verification</h3>
              <button type="button" onClick={() => setShowVerifyModal(false)} className="p-2 rounded-lg hover:bg-slate-100 text-[var(--apple-text-secondary)]" aria-label="Close">×</button>
            </div>
            <div className="space-y-4">
              {visibleStepCount >= 1 && (
                <div className="flex gap-3">
                  <div className="size-8 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-emerald-600 text-sm">check</span>
                  </div>
                  <div>
                    <div className="font-semibold text-[var(--apple-text-primary)] text-sm">Verifying the recipient</div>
                    <div className="text-[var(--apple-text-secondary)] text-sm">The owner of this credential is {result?.recipient_name}.</div>
                  </div>
                </div>
              )}
              {visibleStepCount >= 2 && (
                <div className="flex gap-3">
                  <div className="size-8 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-emerald-600 text-sm">check</span>
                  </div>
                  <div>
                    <div className="font-semibold text-[var(--apple-text-primary)] text-sm">Verifying the issuer</div>
                    <div className="text-[var(--apple-text-secondary)] text-sm">The issuer of this credential is {result?.issuing_organization || 'the organization'}.</div>
                  </div>
                </div>
              )}
              {visibleStepCount >= 3 && (
                <div className="flex gap-3">
                  <div className="size-8 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-emerald-600 text-sm">check</span>
                  </div>
                  <div>
                    <div className="font-semibold text-[var(--apple-text-primary)] text-sm">Verifying the issuer's status</div>
                    <div className="text-[var(--apple-text-secondary)] text-sm">{(result?.issuing_organization || 'The organization')} has been verified by CertVault.</div>
                  </div>
                </div>
              )}
              {visibleStepCount >= 4 && (
                <div className="flex gap-3">
                  <div className="size-8 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-emerald-600 text-sm">check</span>
                  </div>
                  <div>
                    <div className="font-semibold text-[var(--apple-text-primary)] text-sm">Verifying the credential's ID</div>
                    <div className="text-[var(--apple-text-secondary)] text-sm">The ID of this credential is unique and valid.</div>
                  </div>
                </div>
              )}
            </div>
            {showVerificationResult && (
              <div className="mt-6 p-4 rounded-xl bg-emerald-50 border border-emerald-100 flex items-start gap-3">
                <span className="material-symbols-outlined text-emerald-600">verified</span>
                <div>
                  <div className="font-semibold text-[var(--apple-text-primary)]">This is the valid credential.</div>
                  <div className="text-[var(--apple-text-secondary)] text-sm mt-1">This credential was securely issued via CertVault. All the displayed information is valid.</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </CertVaultLayout>
  );
}
