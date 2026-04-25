/**
 * CertVault Verify Certificate.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { pdfDownloadUrl } from '../utils/certvaultPdfUrl';
import VentarcHeader from './VentarcHeader';
import VentarcSceneBackground from './VentarcSceneBackground';

const API_VERIFY = '/api/certvault?action=verify';

export default function CertVaultVerify() {
  const [searchParams] = useSearchParams();
  const [certId, setCertId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [visibleStepCount, setVisibleStepCount] = useState(0);
  const [showVerificationResult, setShowVerificationResult] = useState(false);

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
      setTimeout(() => setVisibleStepCount(5), 1900),
      setTimeout(() => setShowVerificationResult(true), 2450),
    ];
    return () => timeouts.forEach((t) => clearTimeout(t));
  }, [showVerifyModal]);

  const showInvalid = result && !result.valid;
  const showValid = result && result.valid;
  const formattedIssueDate = result?.date_issued
    ? new Date(result.date_issued).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05070b] text-white">
      <VentarcHeader />
      <VentarcSceneBackground page="features" />
      <div className="relative z-10 min-h-screen w-full flex flex-col">
        <main className="flex-1 flex flex-col items-center px-6 pb-6 pt-24 md:pt-24">
          <div className="max-w-[720px] w-full flex flex-col items-center">
            {/* Title */}
            <div className="text-center mb-5">
              <div className="mb-3 inline-flex rounded border border-[#8fb8ff]/20 bg-[#09111c]/80 px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-[#8fb8ff]">
                Public Verification
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Verify Certificate
              </h1>
              <p className="text-[#bcc8da] text-sm md:text-base">
                Enter the unique certificate ID to validate authenticity.
              </p>
            </div>

            {/* Form */}
            <div className="w-full relative mb-5">
              <form onSubmit={handleSubmit} className="group relative flex items-center rounded-[20px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.02)_100%),rgba(7,11,18,0.82)] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_40px_120px_-48px_rgba(0,0,0,0.8)] backdrop-blur-[18px] transition-all focus-within:border-[#8fb8ff]/45">
                <span className="material-symbols-outlined absolute left-6 text-[#8fb8ff]">qr_code_scanner</span>
                <input
                  type="text"
                  value={certId}
                  onChange={(e) => setCertId(e.target.value)}
                  placeholder="Certificate ID (e.g. CV-8293-4921)"
                  className="w-full bg-transparent border-none focus:ring-0 pl-14 pr-32 py-3 text-base font-medium placeholder:text-white/35 text-white outline-none"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="absolute right-3 rounded-xl bg-[var(--apple-accent)] px-6 py-2.5 font-bold text-white shadow-lg shadow-blue-500/25 transition-all hover:opacity-90 disabled:opacity-60"
                >
                  {loading ? 'Verifying…' : 'Verify'}
                </button>
              </form>
            </div>

            {error && (
              <div className="w-full max-w-[640px] mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-100 text-sm">
                <span className="material-symbols-outlined">error</span>
                <span>{error}</span>
              </div>
            )}

            {showInvalid && (
              <div className="w-full max-w-[640px] rounded-[28px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.02)_100%),rgba(7,11,18,0.82)] p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_40px_120px_-48px_rgba(0,0,0,0.8)] backdrop-blur-[18px]">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-600 text-xs font-bold tracking-wide uppercase mb-4">
                  <span className="material-symbols-outlined text-sm">cancel</span>
                  {result.revoked ? 'Revoked' : 'Not found'}
                </div>
                <p className="text-white font-semibold text-lg">
                  {result.revoked ? 'This certificate has been revoked.' : 'Certificate not found'}
                </p>
                <p className="text-[#9fb0c7] text-sm mt-1">
                  The Certificate ID may be incorrect or the certificate may have been revoked.
                </p>
              </div>
            )}

            {showValid && (
              <div className="w-full max-w-[640px] rounded-[24px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.02)_100%),rgba(7,11,18,0.82)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_40px_120px_-48px_rgba(0,0,0,0.8)] backdrop-blur-[18px] md:p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5 border-b border-white/[0.08] pb-5">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-bold tracking-wide uppercase mb-2">
                      <span className="material-symbols-outlined text-sm">verified</span>
                      Verified
                    </div>
                    <h3 className="text-xl md:text-2xl font-bold text-white">{result.recipient_name}</h3>
                    <p className="text-[#9fb0c7] text-sm mt-1">Recipient Name</p>
                  </div>
                  <div className="flex flex-col items-start md:items-end">
                    <span className="material-symbols-outlined text-3xl text-[var(--apple-accent)]/20 mb-1">workspace_premium</span>
                    <p className="text-sm font-semibold text-white">{result.certificate_id || certId}</p>
                    <p className="text-[#9fb0c7] text-xs">Certificate ID</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#7994b8] mb-2">Event / Achievement</p>
                    <p className="text-base font-semibold text-white leading-tight">{result.event_name || '—'}</p>
                  </div>
                  <div className="flex flex-col md:items-end">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#7994b8] mb-2">Issue Date</p>
                    <p className="text-base font-semibold text-white leading-tight">
                      {result.date_issued ? new Date(result.date_issued).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={handleShare} className="px-3.5 py-2 rounded-lg border border-white/[0.14] text-sm font-medium text-white hover:bg-white/[0.08] transition-colors">
                    Share Your Award
                  </button>
                  <button type="button" onClick={handleLinkedIn} className="px-3.5 py-2 rounded-lg border border-[#8fb8ff]/45 text-sm font-medium text-[#8fb8ff] hover:bg-[#8fb8ff]/10 transition-colors">
                    Add to LinkedIn
                  </button>
                  <button type="button" onClick={handleCopyLink} className="px-3.5 py-2 rounded-lg border border-white/[0.14] text-sm font-medium text-white hover:bg-white/[0.08] transition-colors" title="Copy link">
                    Copy link
                  </button>
                </div>

                <div className="mt-5 pt-5 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="size-12 bg-white/[0.06] rounded-xl flex items-center justify-center">
                      <span className="material-symbols-outlined text-2xl text-[var(--apple-accent)]">verified_user</span>
                    </div>
                    <div>
                      <p className="text-sm md:text-base font-bold text-white">Issued by {result.issuing_organization || 'CertVault'}</p>
                      <p className="mt-1 text-xs font-semibold text-[#9fb0c7] uppercase tracking-[0.16em]">Cryptographic Proof Verified</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {result.pdf_url && (
                      <a
                        href={pdfDownloadUrl(result.pdf_url, true)}
                        download
                        className="inline-flex items-center gap-2 rounded-xl bg-[var(--apple-accent)] px-4 py-2.5 text-sm font-bold text-white no-underline shadow-lg shadow-blue-500/20 transition hover:opacity-90"
                      >
                        <span className="material-symbols-outlined text-lg">download</span>
                        Download Certificate
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowVerifyModal(true)}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/[0.14] bg-white/[0.08] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/[0.12]"
                    >
                      <span className="material-symbols-outlined text-lg">verified_user</span>
                      Verify Credential
                    </button>
                  </div>
                </div>
              </div>
            )}

            <p className={`${result ? 'hidden' : 'flex'} mt-6 text-[#9fb0c7] text-sm items-center gap-2 justify-center`}>
              <span className="material-symbols-outlined text-base">info</span>
              Need help? <Link to="/" className="text-[#8fb8ff] hover:underline font-medium">Contact our support team</Link>
            </p>
          </div>
        </main>
      </div>

      {showVerifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setShowVerifyModal(false)}>
          <div className="rounded-2xl border border-white/[0.1] bg-[#0a0f16]/95 shadow-xl max-w-md w-full max-h-[90vh] overflow-auto p-6 text-white backdrop-blur-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Credential Verification</h3>
              <button type="button" onClick={() => setShowVerifyModal(false)} className="p-2 rounded-lg hover:bg-white/[0.08] text-white/70" aria-label="Close">×</button>
            </div>
            <div className="space-y-4">
              {visibleStepCount >= 1 && (
                <div className="flex gap-3">
                  <div className="size-8 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-emerald-600 text-sm">check</span>
                  </div>
                  <div>
                    <div className="font-semibold text-white text-sm">Verifying the recipient</div>
                    <div className="text-white/65 text-sm">
                      This credential was issued to {result?.recipient_name}.
                    </div>
                  </div>
                </div>
              )}
              {visibleStepCount >= 2 && (
                <div className="flex gap-3">
                  <div className="size-8 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-emerald-600 text-sm">check</span>
                  </div>
                  <div>
                    <div className="font-semibold text-white text-sm">Verifying the issuer</div>
                    <div className="text-white/65 text-sm">
                      The issuing organization is {result?.issuing_organization || 'the organization'}.
                    </div>
                  </div>
                </div>
              )}
              {visibleStepCount >= 3 && (
                <div className="flex gap-3">
                  <div className="size-8 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-emerald-600 text-sm">check</span>
                  </div>
                  <div>
                    <div className="font-semibold text-white text-sm">Verifying the issuer's status</div>
                    <div className="text-white/65 text-sm">
                      {(result?.issuing_organization || 'The organization')} is recognized as a verified issuer on CertVault.
                    </div>
                  </div>
                </div>
              )}
              {visibleStepCount >= 4 && (
                <div className="flex gap-3">
                  <div className="size-8 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-emerald-600 text-sm">check</span>
                  </div>
                  <div>
                    <div className="font-semibold text-white text-sm">Verifying the credential's ID</div>
                    <div className="text-white/65 text-sm">
                      Credential ID {result?.certificate_id || certId} is unique in the registry and matches this issued record.
                    </div>
                  </div>
                </div>
              )}
              {visibleStepCount >= 5 && formattedIssueDate && (
                <div className="flex gap-3">
                  <div className="size-8 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-emerald-600 text-sm">check</span>
                  </div>
                  <div>
                    <div className="font-semibold text-white text-sm">Verifying the issue date</div>
                    <div className="text-white/65 text-sm">
                      This credential was issued on {formattedIssueDate}.
                    </div>
                  </div>
                </div>
              )}
            </div>
            {showVerificationResult && (
              <div className="mt-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-400/20 flex items-start gap-3">
                <span className="material-symbols-outlined text-emerald-600">verified</span>
                <div>
                  <div className="font-semibold text-white">This credential is authentic and valid.</div>
                  <div className="text-white/65 text-sm mt-1">
                    The recipient, issuer, credential ID{formattedIssueDate ? ', and issue date ' : ' '}
                    have been verified against the CertVault record.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
