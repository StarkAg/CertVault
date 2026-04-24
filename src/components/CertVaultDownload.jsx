/**
 * CertVault Public Download — students enter names to download their certificates.
 * Route: /:eventSlug (e.g. /ideatron)
 * No login required.
 */
import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import JSZip from 'jszip';
import { pdfDownloadUrl } from '../utils/certvaultPdfUrl';
import VentarcHeader from './VentarcHeader';
import VentarcSceneBackground from './VentarcSceneBackground';

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
    const names = namesText.trim().split(/\n/).map((name) => name.trim()).filter(Boolean);
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
    const withPdf = result.matched.filter((cert) => cert.pdf_url);
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
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${result.event?.name || 'certificates'}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to create ZIP');
    } finally {
      setZipLoading(false);
    }
  }

  const eventName = eventSlug
    ? eventSlug.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
    : '';
  const matchedCount = result?.matched?.length || 0;
  const notFoundCount = result?.notFound?.length || 0;
  const hasValidSlug = Boolean(eventSlug && String(eventSlug).trim());
  const searched = Boolean(result || error);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05070b] text-white">
      <VentarcHeader minimal />
      <VentarcSceneBackground page="features" />
      <div className="relative z-10 h-screen w-full overflow-hidden">
        <main className="mx-auto flex h-full w-full max-w-[1400px] flex-col px-4 pb-6 pt-24 sm:px-6 lg:px-8">
          {!hasValidSlug ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="w-full max-w-2xl rounded-[28px] border border-red-500/20 bg-[linear-gradient(180deg,rgba(127,29,29,0.18)_0%,rgba(255,255,255,0.02)_100%),rgba(7,11,18,0.82)] p-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_40px_120px_-48px_rgba(0,0,0,0.8)] backdrop-blur-[18px]">
                <div className="mx-auto mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-red-500/12 text-red-300">
                  <span className="material-symbols-outlined text-[28px]">link_off</span>
                </div>
                <p className="text-lg font-semibold text-white">Invalid download link</p>
                <p className="mt-2 text-sm text-[#bcc8da]">Please use the link shared by your organizer.</p>
              </div>
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[420px_minmax(0,1fr)]">
              <section className="flex min-h-0 flex-col rounded-[28px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.02)_100%),rgba(7,11,18,0.82)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_40px_120px_-48px_rgba(0,0,0,0.8)] backdrop-blur-[18px] md:p-6">
                <div className="mb-5">
                  <div className="mb-3 inline-flex rounded border border-[#8fb8ff]/20 bg-[#09111c]/80 px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-[#8fb8ff]">
                    Public Download
                  </div>
                  <h1
                    className="text-3xl font-bold tracking-tight text-white"
                    style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                  >
                    Download Certificate
                  </h1>
                  {eventName ? (
                    <p className="mt-2 text-base font-medium text-[#bcc8da]">for {eventName}</p>
                  ) : null}
                  <p className="mt-3 text-sm text-[#9fb0c7]">
                    Enter your name or email, one per line, to find your certificate and open the verified PDF.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-[#8fb8ff]/10 text-[#8fb8ff]">
                      <span className="material-symbols-outlined text-[24px]">folder_shared</span>
                    </div>
                    <div>
                      <p className="text-base font-semibold text-white">Find your issued certificates</p>
                      <p className="text-sm text-[#9fb0c7]">Paste one name or email per line.</p>
                    </div>
                  </div>

                  <textarea
                    value={namesText}
                    onChange={(e) => setNamesText(e.target.value)}
                    placeholder={'rahul@example.com\nRahul Kumar Sharma\npriya@example.com'}
                    disabled={loading}
                    className="min-h-[220px] flex-1 rounded-[20px] border border-white/[0.08] bg-[#09111c]/85 px-4 py-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#8fb8ff]/45 md:text-base"
                  />

                  <div className="mt-4 space-y-3">
                    <p className="text-xs uppercase tracking-[0.22em] text-[#7994b8]">
                      Search by recipient name or email
                    </p>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-xl bg-[var(--apple-accent)] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/25 transition hover:opacity-90 disabled:opacity-60"
                    >
                      {loading ? 'Searching…' : 'Find my certificate'}
                    </button>
                  </div>
                </form>

                {!searched ? (
                  <p className="mt-5 flex items-center gap-2 text-sm text-[#9fb0c7]">
                    <span className="material-symbols-outlined text-base">info</span>
                    Need help? <Link to="/" className="font-medium text-[#8fb8ff] hover:underline">Contact our support team</Link>
                  </p>
                ) : null}
              </section>

              <section className="min-h-0 rounded-[28px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.02)_100%),rgba(7,11,18,0.82)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_40px_120px_-48px_rgba(0,0,0,0.8)] backdrop-blur-[18px]">
                <div className="flex h-full min-h-[420px] flex-col p-5 md:p-6">
                  {error ? (
                    <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100">
                      <div className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-base">error</span>
                        <div>
                          <p>{error}</p>
                          {error.includes('not found') ? (
                            <p className="mt-1 text-red-100/80">The download link may be incorrect. Please check with the organizer.</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : result ? (
                    <>
                      <div className="flex flex-col gap-4 border-b border-white/[0.08] pb-5 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-300">
                            <span className="material-symbols-outlined text-sm">verified</span>
                            Search Complete
                          </div>
                          <p className="mt-3 text-xl font-semibold text-white">
                            Found {matchedCount} of {matchedCount + notFoundCount} entr{matchedCount + notFoundCount === 1 ? 'y' : 'ies'}
                          </p>
                          {notFoundCount > 0 ? (
                            <p className="mt-1 text-sm text-[#f9a8a8]">{notFoundCount} could not be matched.</p>
                          ) : (
                            <p className="mt-1 text-sm text-[#9fb0c7]">All provided names or emails matched successfully.</p>
                          )}
                        </div>

                        {matchedCount > 0 ? (
                          <button
                            type="button"
                            onClick={handleDownloadAllZip}
                            disabled={zipLoading}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#8fb8ff]/30 bg-[#8fb8ff]/10 px-4 py-3 text-sm font-semibold text-[#8fb8ff] transition hover:bg-[#8fb8ff]/15 disabled:opacity-60"
                          >
                            <span className="material-symbols-outlined text-[18px]">folder_zip</span>
                            {zipLoading ? 'Creating ZIP…' : 'Download all as ZIP'}
                          </button>
                        ) : null}
                      </div>

                      <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
                        {matchedCount > 0 ? (
                          <div className="space-y-3">
                            {result.matched.map((cert) => (
                              <div
                                key={cert.certificate_id}
                                className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-[#09111c]/78 px-4 py-4 xl:flex-row xl:items-center xl:justify-between"
                              >
                                <div className="min-w-0">
                                  <div className="truncate text-base font-semibold text-white">{cert.recipient_name}</div>
                                  <div className="mt-1 break-all text-xs uppercase tracking-[0.18em] text-[#7994b8]">
                                    {cert.certificate_id}
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  {cert.pdf_url ? (
                                    <a
                                      href={pdfDownloadUrl(cert.pdf_url, true)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      download
                                      className="inline-flex items-center gap-2 rounded-xl bg-[var(--apple-accent)] px-4 py-2.5 text-sm font-bold text-white no-underline shadow-lg shadow-blue-500/20 transition hover:opacity-90"
                                    >
                                      <span className="material-symbols-outlined text-[18px]">download</span>
                                      Download PDF
                                    </a>
                                  ) : (
                                    <span className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-[#9fb0c7]">
                                      No PDF available
                                    </span>
                                  )}
                                  <a
                                    href={`/certvault/verify?id=${encodeURIComponent(cert.certificate_id)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 rounded-xl border border-white/[0.14] bg-white/[0.08] px-4 py-2.5 text-sm font-bold text-white no-underline transition hover:bg-white/[0.12]"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">verified_user</span>
                                    Verify
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/[0.12] bg-[#09111c]/45 px-6 text-center text-sm text-[#9fb0c7]">
                            No matching certificates were found for the submitted entries.
                          </div>
                        )}

                        {notFoundCount > 0 ? (
                          <div className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-4 text-sm text-[#bcc8da]">
                            <span className="font-semibold text-white">Not found:</span> {result.notFound.join(', ')}
                          </div>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.12] bg-[#09111c]/45 px-6 text-center">
                      <div className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-[#8fb8ff]/10 text-[#8fb8ff]">
                        <span className="material-symbols-outlined text-[28px]">travel_explore</span>
                      </div>
                      <p className="text-lg font-semibold text-white">Results will appear here</p>
                      <p className="mt-2 max-w-md text-sm text-[#9fb0c7]">
                        Search from the left panel and matched certificates will open in this view without leaving the page.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
