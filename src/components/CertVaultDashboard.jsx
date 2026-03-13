/**
 * CertVault Club Dashboard — Events, Certificates, Settings.
 * Auth: Supabase session (magic link) or legacy certvault_club_token.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import JSZip from 'jszip';
import CertVaultLayout from './CertVaultLayout';
import { compressTemplateImage } from '../utils/certvaultCompress';
import { pdfDownloadUrl } from '../utils/certvaultPdfUrl';
import { certVaultTheme as theme } from '../theme';
import { supabase } from '../lib/supabase';

const API_BASE = '/api/certvault';
const DESIGN_STORAGE_KEY = 'certvault_design';
const PENDING_ORG_NAME_KEY = 'certvault_pending_org_name';

/** First word of event name, slugified (lowercase, a-z0-9). E.g. "HackFest 444" → "hackfest". */
function firstWordSlug(name) {
  if (!name || typeof name !== 'string') return '';
  const first = name.trim().split(/\s+/)[0] || '';
  return first.toLowerCase().replace(/[^a-z0-9-]/g, '');
}

const DASHBOARD_SECTIONS = [
  { id: 'events', label: 'Events' },
  { id: 'certificates', label: 'Certificates' },
  { id: 'settings', label: 'Settings' },
];

export default function CertVaultDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [section, setSection] = useState('events');
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authToken, setAuthToken] = useState(null);
  const [needSignup, setNeedSignup] = useState(false);
  const [completeSignupName, setCompleteSignupName] = useState('');
  const [completeSignupLoading, setCompleteSignupLoading] = useState(false);
  const [completeSignupError, setCompleteSignupError] = useState('');

  // Events state
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showFirstEventModal, setShowFirstEventModal] = useState(true);
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventDownloadSlug, setNewEventDownloadSlug] = useState('');
  const [createEventLoading, setCreateEventLoading] = useState(false);

  // Certificates state
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [certificates, setCertificates] = useState([]);
  const [certificatesLoading, setCertificatesLoading] = useState(false);
  const [selectedEventInfo, setSelectedEventInfo] = useState(null);

  // Generate certificates state
  const [showGenerate, setShowGenerate] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateResult, setGenerateResult] = useState(null);
  const [generateProgress, setGenerateProgress] = useState({ total: 0, current: 0, message: '', startTime: null });

  // Download by names state
  const [showDownloadByNames, setShowDownloadByNames] = useState(false);
  const [downloadNamesText, setDownloadNamesText] = useState('');
  const [downloadResult, setDownloadResult] = useState(null);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [downloadZipLoading, setDownloadZipLoading] = useState(false);

  // Student download page (public link)
  const [downloadSlugInput, setDownloadSlugInput] = useState('');
  const [downloadSlugSaving, setDownloadSlugSaving] = useState(false);

  // Generate PDFs for certificates without one
  const [generateMissingPdfsLoading, setGenerateMissingPdfsLoading] = useState(false);
  const [regenerateAllPdfsLoading, setRegenerateAllPdfsLoading] = useState(false);
  
  // PDF generation state (loaded from design page via localStorage)
  const [templateImage, setTemplateImage] = useState(null);
  const [pdfSettings, setPdfSettings] = useState({
    text_x: 0.5,
    text_y: 0.45,
    font_size: 60,
    font_color: '#000000',
    font_family: 'Georgia, serif',
    show_cert_id: false,
    cert_id_x: 0.5,
    cert_id_y: 0.85,
    cert_id_size: 24,
    verify_line_text: 'Verify the certificate here - gradex.bond/certvault/verify?id={certificate_id}',
    verify_line_x: 0.5,
    verify_line_y: 0.92,
    verify_line_size: 12,
    verify_line_color: '#666666',
    verify_line_font: "'Inter', sans-serif",
  });

  const token = authToken || (typeof window !== 'undefined' ? localStorage.getItem('certvault_club_token') : null);

  const fetchWithAuth = useCallback(async (url, options = {}) => {
    const t = authToken || (typeof window !== 'undefined' ? localStorage.getItem('certvault_club_token') : null);
    if (!t) return fetch(url, options);
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${t}`,
        ...options.headers,
      },
    });
  }, [authToken]);

  // Resolve auth: Supabase session first, else legacy token
  useEffect(() => {
    if (!supabase) {
      const legacy = typeof window !== 'undefined' ? localStorage.getItem('certvault_club_token') : null;
      if (legacy) setAuthToken(legacy);
      else setAuthToken('');
      return;
    }
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session?.access_token) {
        setAuthToken(session.access_token);
      } else {
        const legacy = typeof window !== 'undefined' ? localStorage.getItem('certvault_club_token') : null;
        setAuthToken(legacy || '');
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setAuthToken(session?.access_token || (typeof window !== 'undefined' ? localStorage.getItem('certvault_club_token') : null) || '');
    });
    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, []);

  // Load organization info
  useEffect(() => {
    if (token === null) return;
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    const storedOrg = localStorage.getItem('certvault_club_org');
    if (storedOrg) {
      try {
        setOrganization(JSON.parse(storedOrg));
      } catch {}
    }
    setCompleteSignupName(typeof window !== 'undefined' ? localStorage.getItem(PENDING_ORG_NAME_KEY) || '' : '');

    fetchWithAuth(`${API_BASE}?action=me`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.organization) {
          setOrganization(data.organization);
          setNeedSignup(false);
          localStorage.setItem('certvault_club_org', JSON.stringify(data.organization));
          if (typeof window !== 'undefined') localStorage.removeItem(PENDING_ORG_NAME_KEY);
        } else if (data.needSignup && data.email) {
          setNeedSignup(true);
        } else {
          handleLogout();
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, navigate, fetchWithAuth]);

  async function handleCompleteSignup(e) {
    e.preventDefault();
    const name = completeSignupName.trim();
    if (!name) {
      setCompleteSignupError('Organisation name is required');
      return;
    }
    setCompleteSignupError('');
    setCompleteSignupLoading(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}?action=ensure-org`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (data.success && data.organization) {
        setOrganization(data.organization);
        setNeedSignup(false);
        localStorage.setItem('certvault_club_org', JSON.stringify(data.organization));
        if (typeof window !== 'undefined') localStorage.removeItem(PENDING_ORG_NAME_KEY);
      } else {
        setCompleteSignupError(data.error || 'Could not create organization');
      }
    } catch (err) {
      setCompleteSignupError(err.message || 'Something went wrong');
    } finally {
      setCompleteSignupLoading(false);
    }
  }

  // Load events
  const loadEvents = useCallback(async () => {
    if (!token) return;
    setEventsLoading(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}?action=list-events`);
      const data = await res.json();
      if (data.success) {
        setEvents(data.events || []);
      }
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setEventsLoading(false);
    }
  }, [token, fetchWithAuth]);

  useEffect(() => {
    if (section === 'events' && token) {
      loadEvents();
    }
  }, [section, token, loadEvents]);

  // Load saved design from design page (on mount and when switching to certificates)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DESIGN_STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.template) setTemplateImage(data.template);
        if (data.settings) setPdfSettings(prev => ({ ...prev, ...data.settings }));
      }
    } catch {}
  }, []);

  // Progress estimation timer (12 seconds per certificate on average)
  useEffect(() => {
    if (!generateProgress.startTime || generateProgress.total === 0) return;
    
    const interval = setInterval(() => {
      const elapsed = (Date.now() - generateProgress.startTime) / 1000; // seconds
      const estimated = Math.min(
        Math.floor(elapsed / 12), // ~12 seconds per certificate
        generateProgress.total
      );
      
      if (estimated < generateProgress.total) {
        setGenerateProgress(prev => ({ ...prev, current: estimated }));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [generateProgress.startTime, generateProgress.total]);

  // Load certificates for event
  const loadCertificates = useCallback(async (eventId) => {
    if (!token || !eventId) return;
    setCertificatesLoading(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}?action=list-certificates&eventId=${eventId}`);
      const data = await res.json();
      if (data.success) {
        setCertificates(data.certificates || []);
        setSelectedEventInfo(data.event);
      }
    } catch (err) {
      console.error('Failed to load certificates:', err);
    } finally {
      setCertificatesLoading(false);
    }
  }, [token, fetchWithAuth]);

  useEffect(() => {
    if (section === 'certificates' && selectedEventId) {
      loadCertificates(selectedEventId);
    }
  }, [section, selectedEventId, loadCertificates]);

  useEffect(() => {
    const ev = events.find(e => e.id === selectedEventId);
    setDownloadSlugInput(ev?.download_slug || firstWordSlug(ev?.name) || '');
  }, [selectedEventId, events]);

  // Restore state when returning from Design page (Back button)
  useEffect(() => {
    const s = location.state;
    if (!s || (!s.section && !s.selectedEventId && !s.showGenerate)) return;
    if (s.section) setSection(s.section);
    if (s.selectedEventId) setSelectedEventId(s.selectedEventId);
    if (s.showGenerate) setShowGenerate(true);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate]);

  function handleLogout() {
    if (supabase) supabase.auth.signOut();
    localStorage.removeItem('certvault_club_token');
    localStorage.removeItem('certvault_club_org');
    localStorage.removeItem(PENDING_ORG_NAME_KEY);
    setAuthToken('');
    navigate('/login');
  }

  async function handleCreateEvent(e) {
    e.preventDefault();
    if (!newEventName.trim()) return;

    setCreateEventLoading(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}?action=create-event`, {
        method: 'POST',
        body: JSON.stringify({
          name: newEventName.trim(),
          event_date: newEventDate || null,
          download_slug: newEventDownloadSlug.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNewEventName('');
        setNewEventDate('');
        setNewEventDownloadSlug('');
        setShowCreateEvent(false);
        loadEvents();
        // Guided flow: go to Certificates, select new event, open Generate
        const newEventId = data.event?.id;
        if (newEventId) {
          setSection('certificates');
          setSelectedEventId(newEventId);
          setShowGenerate(true);
        }
      } else {
        alert(data.error || 'Failed to create event');
      }
    } catch (err) {
      alert('Failed to create event');
    } finally {
      setCreateEventLoading(false);
    }
  }

  async function handleDeleteEvent(eventId, eventName) {
    if (!confirm(`Delete "${eventName}"? This will also delete all certificates for this event.`)) {
      return;
    }

    try {
      const res = await fetchWithAuth(`${API_BASE}?action=delete-event`, {
        method: 'POST',
        body: JSON.stringify({ eventId }),
      });
      const data = await res.json();
      if (data.success) {
        loadEvents();
        if (selectedEventId === eventId) {
          setSelectedEventId(null);
          setCertificates([]);
        }
      } else {
        alert(data.error || 'Failed to delete event');
      }
    } catch (err) {
      alert('Failed to delete event');
    }
  }

  async function handleGenerateCertificates(e) {
    e.preventDefault();
    if (!selectedEventId || !csvText.trim()) return;

    // Parse CSV (simple: name,email,category per line)
    const lines = csvText.trim().split('\n').filter(l => l.trim());
    const recipients = [];

    for (const line of lines) {
      const parts = line.split(',').map(p => p.trim());
      if (parts[0]) {
        recipients.push({
          name: parts[0],
          email: parts[1] || null,
          category: parts[2] || 'Participant',
        });
      }
    }

    if (recipients.length === 0) {
      alert('No valid recipients found. Format: name,email,category (one per line)');
      return;
    }

    setGenerateLoading(true);
    setGenerateResult(null);
    setGenerateProgress({
      total: recipients.length,
      current: 0,
      message: `Preparing to generate ${recipients.length} certificate${recipients.length > 1 ? 's' : ''}...`,
      startTime: Date.now(),
    });

    try {
      const generatePdf = !!templateImage;
      const basePayload = {
        eventId: selectedEventId,
        generatePdf,
      };

      let preparedPayload = { ...basePayload };

      if (generatePdf) {
        // Compress template once, reuse for all chunks
        setGenerateProgress(prev => ({
          ...prev,
          current: 0,
          message: 'Compressing template image...',
        }));
        const template = await compressTemplateImage(templateImage);
        preparedPayload = {
          ...preparedPayload,
          template,
          settings: { ...pdfSettings, show_cert_id: false },
        };
        setGenerateProgress(prev => ({
          ...prev,
          current: 0,
          message: `Generating ${recipients.length} certificate${recipients.length > 1 ? 's' : ''} with PDFs... This may take several minutes.`,
        }));
      } else {
        setGenerateProgress(prev => ({
          ...prev,
          current: 0,
          message: `Creating ${recipients.length} certificate${recipients.length > 1 ? 's' : ''} (no PDFs)...`,
        }));
      }

      // Client-side chunking to avoid Cloudflare 100s timeout
      const CLIENT_CHUNK_SIZE = 100;
      let totalGenerated = 0;
      let totalFailed = 0;
      const allErrors = [];

      for (let i = 0; i < recipients.length; i += CLIENT_CHUNK_SIZE) {
        const chunkRecipients = recipients.slice(i, i + CLIENT_CHUNK_SIZE);
        const from = i + 1;
        const to = i + chunkRecipients.length;

        setGenerateProgress(prev => ({
          ...prev,
          current: i,
          message: `Generating certificates ${from}-${to} of ${recipients.length}...`,
        }));

        const res = await fetchWithAuth(`${API_BASE}?action=generate`, {
          method: 'POST',
          body: JSON.stringify({
            ...preparedPayload,
            recipients: chunkRecipients,
          }),
        });

        const text = await res.text();
        if (res.status === 413) {
          setGenerateResult({
            success: false,
            error: 'Request too large. Try a smaller template image or fewer recipients.',
          });
          return;
        }

        let data;
        try {
          data = JSON.parse(text);
        } catch {
          setGenerateResult({
            success: false,
            error: 'Server returned an error. If using a large template, try a smaller image.',
          });
          return;
        }

        if (!data.success) {
          setGenerateResult(data);
          // Stop on first hard failure
          return;
        }

        totalGenerated += data.generated || 0;
        totalFailed += data.failed || 0;
        if (Array.isArray(data.errors)) {
          allErrors.push(...data.errors);
        }
      }

      const summary = {
        success: totalFailed === 0,
        generated: totalGenerated,
        failed: totalFailed,
      };
      if (allErrors.length > 0) {
        summary.errors = allErrors;
      }

      setGenerateResult(summary);
      // Reload certificates even if some failed, so Supabase entries appear
      loadCertificates(selectedEventId);
      if (summary.success) {
        setCsvText('');
      }
    } catch (err) {
      setGenerateResult({ success: false, error: 'Failed to generate certificates' });
    } finally {
      setGenerateLoading(false);
      setGenerateProgress({ total: 0, current: 0, message: '', startTime: null });
    }
  }

  async function handleRevokeCertificate(certId, certName) {
    if (!confirm(`Revoke certificate for "${certName}"?`)) return;

    try {
      const res = await fetchWithAuth(`${API_BASE}?action=revoke`, {
        method: 'POST',
        body: JSON.stringify({ certificateId: certId }),
      });
      const data = await res.json();
      if (data.success) {
        loadCertificates(selectedEventId);
      } else {
        alert(data.error || 'Failed to revoke');
      }
    } catch (err) {
      alert('Failed to revoke certificate');
    }
  }

  async function handleMatchAndDownload(e) {
    e.preventDefault();
    if (!selectedEventId || !downloadNamesText.trim()) return;
    const names = downloadNamesText.trim().split(/\n/).map(n => n.trim()).filter(Boolean);
    if (names.length === 0) {
      alert('Enter at least one name or email (one per line)');
      return;
    }
    setDownloadLoading(true);
    setDownloadResult(null);
    try {
      const res = await fetchWithAuth(`${API_BASE}?action=match-certificates`, {
        method: 'POST',
        body: JSON.stringify({ eventId: selectedEventId, names }),
      });
      const data = await res.json();
      if (data.success) {
        setDownloadResult(data);
      } else {
        alert(data.error || 'Failed to match');
      }
    } catch (err) {
      alert('Failed to match certificates');
    } finally {
      setDownloadLoading(false);
    }
  }

  async function handleGenerateMissingPdfs() {
    if (!selectedEventId || !templateImage || !token) {
      alert('Load a template from the Design page first, then generate certificates with PDFs. Or use "Generate" with a template to create PDFs.');
      return;
    }
    const missingCount = certificates.filter(c => !c.pdf_url).length;
    setGenerateMissingPdfsLoading(true);
    setGenerateProgress({ total: missingCount, current: 0, message: `Compressing template image...`, startTime: null });
    try {
      const template = await compressTemplateImage(templateImage);
      setGenerateProgress({ total: missingCount, current: 0, message: `Generating ${missingCount} PDF${missingCount > 1 ? 's' : ''}... This may take several minutes.`, startTime: Date.now() });
      const res = await fetchWithAuth(`${API_BASE}?action=generate-missing-pdfs`, {
        method: 'POST',
        body: JSON.stringify({
          eventId: selectedEventId,
          template,
          settings: { ...pdfSettings, show_cert_id: false },
        }),
      });
      const data = await res.json();
      if (data.success) {
        loadCertificates(selectedEventId);
        const errMsg = data.failed > 0 && data.errors?.length
          ? `\n\nFirst error: ${data.errors[0].error}`
          : '';
        alert(`Generated ${data.generated} PDF(s).${data.failed > 0 ? ` ${data.failed} failed.` : ''}${errMsg}`);
      } else {
        alert(data.error || 'Failed');
      }
    } catch (err) {
      alert('Failed to generate PDFs');
    } finally {
      setGenerateMissingPdfsLoading(false);
      setGenerateProgress({ total: 0, current: 0, message: '', startTime: null });
    }
  }

  async function handleRegenerateAllPdfs() {
    if (!selectedEventId || !templateImage || !token) {
      alert('Load a template from the Design page first.');
      return;
    }
    if (!confirm('Regenerate PDFs for ALL certificates in this event? This will replace existing PDFs.')) return;
    setRegenerateAllPdfsLoading(true);
    setGenerateProgress({ total: certificates.length, current: 0, message: `Compressing template image...`, startTime: null });
    try {
      const template = await compressTemplateImage(templateImage);
      setGenerateProgress({ total: certificates.length, current: 0, message: `Regenerating ${certificates.length} PDF${certificates.length > 1 ? 's' : ''}... This may take several minutes.`, startTime: Date.now() });
      const res = await fetchWithAuth(`${API_BASE}?action=regenerate-all-pdfs`, {
        method: 'POST',
        body: JSON.stringify({
          eventId: selectedEventId,
          template,
          settings: { ...pdfSettings, show_cert_id: false },
        }),
      });
      const data = await res.json();
      if (data.success) {
        loadCertificates(selectedEventId);
        const errMsg = data.failed > 0 && data.errors?.length
          ? `\n\nFirst error: ${data.errors[0].error}`
          : '';
        alert(`Regenerated ${data.generated} PDF(s).${data.failed > 0 ? ` ${data.failed} failed.` : ''}${errMsg}`);
      } else {
        alert(data.error || 'Failed');
      }
    } catch (err) {
      alert('Failed to regenerate PDFs');
    } finally {
      setRegenerateAllPdfsLoading(false);
      setGenerateProgress({ total: 0, current: 0, message: '', startTime: null });
    }
  }

  async function handleSetDownloadSlug(e) {
    e.preventDefault();
    if (!selectedEventId || !token) return;
    const slug = downloadSlugInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    setDownloadSlugSaving(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}?action=set-download-slug`, {
        method: 'POST',
        body: JSON.stringify({ eventId: selectedEventId, download_slug: slug || null }),
      });
      const data = await res.json();
      if (data.success) {
        loadEvents();
      } else {
        alert(data.error || 'Failed to set link');
      }
    } catch (err) {
      alert('Failed to save');
    } finally {
      setDownloadSlugSaving(false);
    }
  }

  async function handleDownloadAllAsZip() {
    if (!downloadResult?.matched?.length) return;
    const withPdf = downloadResult.matched.filter(c => c.pdf_url);
    if (withPdf.length === 0) {
      alert('No PDFs available for download');
      return;
    }
    setDownloadZipLoading(true);
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
      a.download = `${downloadResult.event?.name || 'certificates'}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to create ZIP');
    } finally {
      setDownloadZipLoading(false);
    }
  }

  if (loading || !token) {
    return (
      <CertVaultLayout>
        <div style={{ textAlign: 'center', padding: 48 }}>Loading...</div>
      </CertVaultLayout>
    );
  }

  if (needSignup) {
    return (
      <CertVaultLayout>
        <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--apple-bg)]">
          <div className="w-full max-w-[400px]">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <h1 className="text-[24px] font-semibold text-[var(--apple-text-primary)] mb-2">Complete your profile</h1>
              <p className="text-[var(--apple-text-secondary)] text-sm mb-6">Enter your club or organization name to finish signing up.</p>
              <form onSubmit={handleCompleteSignup} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--apple-text-primary)] mb-1.5" htmlFor="complete-org-name">Organisation name</label>
                  <input
                    id="complete-org-name"
                    type="text"
                    value={completeSignupName}
                    onChange={(e) => setCompleteSignupName(e.target.value)}
                    placeholder=""
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-[var(--apple-accent)]/20 focus:border-[var(--apple-accent)] outline-none text-sm"
                    required
                    disabled={completeSignupLoading}
                  />
                </div>
                {completeSignupError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm">{completeSignupError}</div>
                )}
                <button
                  type="submit"
                  disabled={completeSignupLoading}
                  className="w-full bg-[var(--apple-accent)] text-white font-semibold py-3 rounded-[12px] hover:opacity-95 disabled:opacity-60"
                >
                  {completeSignupLoading ? 'Creating…' : 'Continue'}
                </button>
              </form>
            </div>
            <p className="mt-6 text-center">
              <button type="button" onClick={handleLogout} className="text-[var(--apple-text-secondary)] text-sm hover:text-[var(--apple-accent)]">Sign out</button>
            </p>
          </div>
        </div>
      </CertVaultLayout>
    );
  }

  return (
    <CertVaultLayout>
      <style>{`
        @media (max-width: 1024px) {
          .certvault-dashboard-grid {
            grid-template-columns: 1fr !important;
          }
          .certvault-dashboard-sidebar {
            order: 2 !important;
          }
          .certvault-dashboard-content {
            order: 1 !important;
          }
        }
        @media (max-width: 768px) {
          .certvault-dashboard-wrap {
            padding: 0 12px !important;
          }
          .certvault-dashboard-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 10px !important;
            padding-bottom: 12px !important;
          }
          .certvault-dashboard-title {
            font-size: 18px !important;
          }
          .certvault-dashboard-org-name {
            font-size: 11px !important;
          }
          .certvault-dashboard-tabs {
            flex-wrap: wrap !important;
            gap: 4px !important;
            margin-bottom: 16px !important;
          }
          .certvault-dashboard-tab {
            font-size: 11px !important;
            padding: 5px 10px !important;
            white-space: nowrap !important;
          }
          .certvault-dashboard-h2 {
            font-size: 13px !important;
            white-space: nowrap !important;
          }
          .certvault-dashboard-event-card {
            padding: 12px !important;
          }
          .certvault-dashboard-event-name {
            font-size: 15px !important;
            word-break: break-word !important;
          }
          .certvault-dashboard-event-meta {
            font-size: 11px !important;
          }
          .certvault-dashboard-event-row {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 10px !important;
          }
          .certvault-dashboard-event-actions {
            width: 100% !important;
            flex-wrap: wrap !important;
            gap: 6px !important;
          }
          .certvault-dashboard-event-actions button {
            font-size: 11px !important;
            padding: 6px 10px !important;
            white-space: nowrap !important;
          }
          .certvault-dashboard-cert-row {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 10px !important;
            padding: 10px !important;
          }
          .certvault-dashboard-cert-row span {
            font-size: 13px !important;
            word-break: break-word !important;
          }
          .certvault-dashboard-cert-actions {
            width: 100% !important;
            flex-wrap: wrap !important;
            gap: 6px !important;
          }
          .certvault-dashboard-cert-actions a,
          .certvault-dashboard-cert-actions button {
            font-size: 11px !important;
            padding: 5px 10px !important;
            white-space: nowrap !important;
          }
          .certvault-dashboard-preview-container {
            max-width: 100% !important;
          }
          .certvault-dashboard-section-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 12px !important;
          }
          .certvault-dashboard-form-row {
            flex-direction: column !important;
          }
          .certvault-dashboard-form-input {
            width: 100% !important;
          }
          .certvault-dashboard-label {
            font-size: 12px !important;
          }
          .certvault-dashboard-input,
          .certvault-dashboard-textarea,
          .certvault-dashboard-select {
            font-size: 13px !important;
            padding: 10px 12px !important;
          }
          .certvault-dashboard-primary-btn,
          .certvault-dashboard-secondary-btn {
            font-size: 12px !important;
            padding: 8px 14px !important;
            white-space: nowrap !important;
          }
          .certvault-dashboard-summary {
            font-size: 12px !important;
          }
          .certvault-dashboard-cert-id {
            font-size: 11px !important;
          }
          .certvault-dashboard-email {
            font-size: 11px !important;
          }
        }
        @media (max-width: 900px) {
          .certvault-dashboard-certificates {
            grid-template-columns: 1fr !important;
          }
          .certvault-dashboard-certificates-left {
            position: static !important;
            top: auto !important;
            margin-bottom: 16px !important;
          }
          .certvault-dashboard-certificates-right {
            overflow: visible !important;
            max-height: none !important;
          }
        }
      `}</style>
      <div className="certvault-dashboard-wrap" style={styles.dashboardWrap}>
      <div className="certvault-dashboard-header" style={styles.header}>
        <div>
          <h1 className="certvault-dashboard-title" style={styles.title}>Dashboard</h1>
          {organization && (
            <span className="certvault-dashboard-org-name" style={styles.orgName}>{organization.name}</span>
          )}
        </div>
        <button type="button" onClick={handleLogout} style={styles.logout}>Logout</button>
      </div>

      <nav className="certvault-dashboard-tabs" style={styles.tabs}>
        {DASHBOARD_SECTIONS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSection(id)}
            className="certvault-dashboard-tab"
            style={{ ...styles.tab, ...(section === id ? styles.tabActive : {}) }}
          >
            {label}
          </button>
        ))}
      </nav>

      <div style={styles.contentWrap}>
        {/* EVENTS TAB */}
        {section === 'events' && (
          <div>
            <div className="certvault-dashboard-section-header" style={styles.sectionHeader}>
              <h2 className="certvault-dashboard-h2" style={styles.h2}>Events</h2>
              <button 
                type="button" 
                onClick={() => setShowCreateEvent(!showCreateEvent)}
                className="certvault-dashboard-primary-btn"
                style={styles.primaryBtn}
              >
                {showCreateEvent ? 'Cancel' : 'New Event'}
              </button>
            </div>

            {showCreateEvent && (
              <form onSubmit={handleCreateEvent} style={styles.createForm}>
                <input
                  type="text"
                  placeholder="Event name"
                  value={newEventName}
                  onChange={(e) => {
                    const v = e.target.value;
                    setNewEventName(v);
                    setNewEventDownloadSlug(firstWordSlug(v));
                  }}
                  className="certvault-dashboard-input"
                  style={styles.input}
                  required
                />
                <input
                  type="date"
                  value={newEventDate}
                  onChange={(e) => setNewEventDate(e.target.value)}
                  className="certvault-dashboard-input"
                  style={styles.input}
                />
                <input
                  type="text"
                  placeholder="Student download link (e.g. hize) — optional"
                  value={newEventDownloadSlug}
                  onChange={(e) => setNewEventDownloadSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="certvault-dashboard-input"
                  style={styles.input}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" className="certvault-dashboard-primary-btn" style={styles.primaryBtn} disabled={createEventLoading}>
                    {createEventLoading ? 'Creating…' : 'Create'}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setShowCreateEvent(false)}
                    className="certvault-dashboard-secondary-btn"
                    style={styles.secondaryBtn}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {eventsLoading ? (
              <p style={styles.placeholder}>Loading events...</p>
            ) : events.length === 0 && showFirstEventModal ? (
              <>
                <div style={styles.firstEventOverlay} onClick={() => setShowFirstEventModal(false)} />
                <div style={styles.firstEventModal} onClick={() => setShowFirstEventModal(false)}>
                  <style>{`
                    @keyframes firstEventShimmer {
                      0%, 100% { background-position: 200% center; }
                      50% { background-position: -200% center; }
                    }
                    @keyframes firstEventPulse {
                      0%, 100% { transform: scale(1); box-shadow: 0 0 40px rgba(234, 179, 8, 0.3); }
                      50% { transform: scale(1.02); box-shadow: 0 0 60px rgba(234, 179, 8, 0.4); }
                    }
                    .first-event-modal-inner {
                      background: linear-gradient(135deg, rgba(234, 179, 8, 0.15) 0%, rgba(251, 191, 36, 0.08) 50%, rgba(234, 179, 8, 0.15) 100%);
                      background-size: 200% 200%;
                      animation: firstEventShimmer 4s ease-in-out infinite;
                    }
                    .first-event-modal-outer {
                      animation: firstEventPulse 3s ease-in-out infinite;
                    }
                  `}</style>
                  <div className="first-event-modal-outer" style={styles.firstEventModalOuter} onClick={(e) => e.stopPropagation()}>
                    <div className="first-event-modal-inner" style={styles.firstEventModalInner}>
                      <h3 style={styles.firstEventTitle}>Create your First Event!!</h3>
                      <p style={styles.firstEventSub}>Start issuing certificates for your workshops, hackathons, and more.</p>
                      <button
                        type="button"
                        onClick={() => { setShowFirstEventModal(false); setShowCreateEvent(true); }}
                        style={styles.firstEventBtn}
                      >
                        Create Event
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : events.length === 0 ? (
              <p style={styles.placeholder}>
                No events yet.{' '}
                <button type="button" onClick={() => setShowCreateEvent(true)} style={styles.linkBtn}>
                  Create your first event
                </button>
              </p>
            ) : (
              <div style={styles.eventsList}>
                {events.map((event) => (
                  <div key={event.id} className="certvault-dashboard-event-card" style={styles.eventCard}>
                    <div className="certvault-dashboard-event-row" style={styles.eventInfo}>
                      <h3 className="certvault-dashboard-event-name" style={styles.eventName}>{event.name}</h3>
                      <p className="certvault-dashboard-event-meta" style={styles.eventMeta}>
                        {event.event_date && `${new Date(event.event_date).toLocaleDateString()} · `}
                        {event.certificate_count} certificate{event.certificate_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="certvault-dashboard-event-actions" style={styles.eventActions}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEventId(event.id);
                          setSection('certificates');
                        }}
                        style={styles.smallBtn}
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteEvent(event.id, event.name)}
                        style={styles.dangerBtn}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CERTIFICATES TAB */}
        {section === 'certificates' && (
          <div className="certvault-dashboard-certificates" style={styles.certificatesLayout}>
            {/* Left panel: controls */}
            <div className="certvault-dashboard-certificates-left" style={styles.certificatesLeft}>
            <div className="certvault-dashboard-section-header" style={styles.sectionHeader}>
              <h2 className="certvault-dashboard-h2" style={styles.h2}>
                Certificates
                {selectedEventInfo && <span style={styles.eventLabel}> — {selectedEventInfo.name}</span>}
              </h2>
            </div>

            <div style={styles.eventSelector}>
              <select
                value={selectedEventId || ''}
                onChange={(e) => setSelectedEventId(e.target.value || null)}
                className="certvault-dashboard-select"
                style={styles.select}
              >
                <option value="">Select event</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name} ({event.certificate_count} certs)
                  </option>
                ))}
              </select>
              {selectedEventId && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowGenerate(!showGenerate)}
                    className="certvault-dashboard-primary-btn"
                    style={styles.primaryBtn}
                  >
                    {showGenerate ? 'Cancel' : 'Generate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowDownloadByNames(!showDownloadByNames); setDownloadResult(null); }}
                    className="certvault-dashboard-secondary-btn"
                    style={styles.secondaryBtn}
                  >
                    {showDownloadByNames ? 'Cancel' : 'Download by names'}
                  </button>
                  {certificates.some(c => !c.pdf_url) && templateImage && (
                    <button
                      type="button"
                      onClick={handleGenerateMissingPdfs}
                      className="certvault-dashboard-secondary-btn"
                      style={styles.secondaryBtn}
                      disabled={generateMissingPdfsLoading}
                      title="Generate PDFs for certificates that don't have one"
                    >
                      {generateMissingPdfsLoading ? 'Generating…' : 'Generate missing PDFs'}
                    </button>
                  )}
                  {certificates.length > 0 && templateImage && (
                    <button
                      type="button"
                      onClick={handleRegenerateAllPdfs}
                      className="certvault-dashboard-secondary-btn"
                      style={styles.secondaryBtn}
                      disabled={regenerateAllPdfsLoading}
                      title="Regenerate PDFs for all certificates in this event"
                    >
                      {regenerateAllPdfsLoading ? 'Regenerating…' : 'Regenerate all PDFs'}
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Student download page link */}
            {selectedEventId && (
              <div style={styles.downloadLinkCard}>
                <span style={styles.downloadLinkLabel}>Student download page</span>
                <p style={styles.downloadLinkHint}>Share this link so students can enter their names and download certificates.</p>
                <form onSubmit={handleSetDownloadSlug} style={styles.downloadLinkForm}>
                  <span style={styles.downloadLinkPrefix}>{typeof window !== 'undefined' ? window.location.origin + '/' : 'https://gradex.bond/certvault/'}</span>
                  <input
                    type="text"
                    value={downloadSlugInput}
                    onChange={(e) => setDownloadSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="hize"
                    style={styles.downloadLinkInput}
                    disabled={downloadSlugSaving}
                  />
                  <button type="submit" style={styles.smallBtn} disabled={downloadSlugSaving}>
                    {downloadSlugSaving ? 'Saving…' : 'Save'}
                  </button>
                </form>
                {events.find(e => e.id === selectedEventId)?.download_slug && (
                  <a
                    href={`${typeof window !== 'undefined' ? window.location.origin : ''}/${events.find(e => e.id === selectedEventId)?.download_slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.downloadLinkUrl}
                  >
                    Open student page →
                  </a>
                )}
              </div>
            )}

            {/* Generate form */}
            {showGenerate && selectedEventId && (
              <form onSubmit={handleGenerateCertificates} style={styles.generateForm}>
                <p style={{ marginBottom: 12, fontSize: 13, color: 'var(--apple-text-secondary)' }}>
                  Step 1: Design your certificate template (optional). Step 2: Add recipients below and generate.
                </p>
                <label style={styles.label}>Recipients (name, email, category — one per line)</label>
                <textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder={`John Doe,john@email.com,Winner\nJane Smith,jane@email.com,Participant\nBob Johnson,,Organizer`}
                  style={styles.textarea}
                  rows={6}
                  required
                />

                <Link
                  to="/design"
                  state={{ fromEventId: selectedEventId }}
                  style={{ ...styles.secondaryBtn, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                >
                  Design Certificate layout
                </Link>
                {templateImage && (
                  <span style={styles.templateHint}>Template loaded from design. <Link to="/design" state={{ fromEventId: selectedEventId }} style={styles.linkBtn}>Edit</Link></span>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button type="submit" className="certvault-dashboard-primary-btn" style={styles.primaryBtn} disabled={generateLoading}>
                    {generateLoading 
                      ? (templateImage ? 'Generating PDFs…' : 'Generating…') 
                      : (templateImage ? 'Generate Certificates + PDFs' : 'Generate Certificates')}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => { setShowGenerate(false); setGenerateResult(null); }}
                    className="certvault-dashboard-secondary-btn"
                    style={styles.secondaryBtn}
                  >
                    Cancel
                  </button>
                </div>
                {generateResult && (
                  <div style={{
                    ...(generateResult.success ? styles.successBox : styles.errorBox),
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    {generateResult.success ? (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        <span>Generated {generateResult.generated} certificate(s){generateResult.pdfsGenerated ? ` with ${generateResult.pdfsGenerated} PDFs` : ''}{generateResult.failed > 0 ? `, ${generateResult.failed} failed` : ''}</span>
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="15" y1="9" x2="9" y2="15"></line>
                          <line x1="9" y1="9" x2="15" y2="15"></line>
                        </svg>
                        <span>{generateResult.error}</span>
                      </>
                    )}
                  </div>
                )}
              </form>
            )}

            {/* Download by names / email form */}
            {showDownloadByNames && selectedEventId && (
              <form onSubmit={handleMatchAndDownload} style={styles.generateForm}>
                <label className="certvault-dashboard-label" style={styles.label}>Names or email IDs to match (one per line)</label>
                <textarea
                  value={downloadNamesText}
                  onChange={(e) => setDownloadNamesText(e.target.value)}
                  placeholder={'rahul@example.com\nRahul Kumar Sharma\npriya@example.com'}
                  className="certvault-dashboard-textarea"
                  style={styles.textarea}
                  rows={5}
                />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="submit" className="certvault-dashboard-primary-btn" style={styles.primaryBtn} disabled={downloadLoading}>
                    {downloadLoading ? 'Matching…' : 'Find certificates'}
                  </button>
                  {downloadResult?.matched?.length > 0 && (
                    <button
                      type="button"
                      onClick={handleDownloadAllAsZip}
                      className="certvault-dashboard-secondary-btn"
                      style={styles.secondaryBtn}
                      disabled={downloadZipLoading}
                    >
                      {downloadZipLoading ? 'Creating ZIP…' : 'Download all as ZIP'}
                    </button>
                  )}
                </div>
                {downloadResult && (
                  <div style={styles.downloadResult}>
                    <p className="certvault-dashboard-summary" style={styles.downloadSummary}>
                      Found {downloadResult.matched.length} of {downloadResult.matched.length + downloadResult.notFound.length} entries.
                      {downloadResult.notFound?.length > 0 && (
                        <span style={styles.notFound}> {downloadResult.notFound.length} not found in database.</span>
                      )}
                    </p>
                    {downloadResult.matched.length > 0 && (
                      <div style={styles.matchedList}>
                        {downloadResult.matched.map((c) => (
                          <div key={c.certificate_id} className="certvault-dashboard-cert-row" style={styles.matchedRow}>
                            <span>{c.recipient_name}</span>
                            <div className="certvault-dashboard-cert-actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              {c.pdf_url ? (
                                <a
                                  href={pdfDownloadUrl(c.pdf_url, true)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={styles.linkBtn}
                                  download
                                >
                                  Download PDF
                                </a>
                              ) : (
                                <span style={styles.noPdf}>No PDF</span>
                              )}
                              <a
                                href={`/verify?id=${encodeURIComponent(c.certificate_id)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={styles.linkBtn}
                              >
                                Verify
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </form>
            )}
            </div>

            {/* Right panel: certificates list */}
            <div className="certvault-dashboard-certificates-right" style={styles.certificatesRight}>
            {!selectedEventId ? (
              <div style={styles.emptyState}>
                <p style={styles.placeholder}>Select an event to view its certificates.</p>
              </div>
            ) : certificatesLoading ? (
              <div style={styles.emptyState}>
                <p style={styles.placeholder}>Loading certificates...</p>
              </div>
            ) : certificates.length === 0 ? (
              <div style={styles.emptyState}>
                <p style={styles.placeholder}>No certificates for this event yet.</p>
              </div>
            ) : (
              <div style={styles.certificatesTable}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Certificate ID</th>
                      <th style={styles.th}>Recipient</th>
                      <th style={styles.th}>Category</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {certificates.map((cert) => (
                      <tr key={cert.id} className="certvault-dashboard-cert-row" style={styles.tr}>
                        <td style={styles.td}>
                          <code className="certvault-dashboard-cert-id" style={styles.certId}>{cert.certificate_id}</code>
                        </td>
                        <td style={styles.td}>
                          <div>{cert.recipient_name}</div>
                          {cert.recipient_email && (
                            <div className="certvault-dashboard-email" style={styles.email}>{cert.recipient_email}</div>
                          )}
                        </td>
                        <td style={styles.td}>{cert.category}</td>
                        <td style={styles.td}>
                          <span style={cert.status === 'valid' ? styles.statusValid : styles.statusRevoked}>
                            {cert.status}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <div style={styles.certActions}>
                            <Link 
                              to={`/verify?id=${cert.certificate_id}`}
                              style={styles.linkBtn}
                              target="_blank"
                            >
                              Verify
                            </Link>
                            {cert.status === 'valid' && (
                              <button
                                type="button"
                                onClick={() => handleRevokeCertificate(cert.certificate_id, cert.recipient_name)}
                                style={styles.revokeBtn}
                              >
                                Revoke
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {section === 'settings' && (
          <div>
            <h2 style={{ ...styles.h2, marginBottom: 20 }}>Organization</h2>
            {organization && (
              <div style={styles.settingsCard}>
                <div style={styles.settingRow}>
                  <span style={styles.settingLabel}>Name:</span>
                  <span style={styles.settingValue}>{organization.name}</span>
                </div>
                <div style={styles.settingRow}>
                  <span style={styles.settingLabel}>Email:</span>
                  <span style={styles.settingValue}>{organization.email}</span>
                </div>
                <div style={styles.settingRow}>
                  <span style={styles.settingLabel}>Slug:</span>
                  <span style={styles.settingValue}>{organization.slug}</span>
                </div>
                <div style={styles.settingRow}>
                  <span style={styles.settingLabel}>Member since:</span>
                  <span style={styles.settingValue}>
                    {new Date(organization.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      </div>

      {/* Progress Modal */}
      {(generateLoading || generateMissingPdfsLoading || regenerateAllPdfsLoading) && generateProgress.total > 0 && (
        <>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
            @keyframes indeterminate {
              0% { transform: translateX(-100%); width: 30%; }
              50% { transform: translateX(200%); width: 30%; }
              100% { transform: translateX(-100%); width: 30%; }
            }
          `}</style>
          <div style={styles.progressModalOverlay} onClick={(e) => e.stopPropagation()}>
            <div style={styles.progressModal}>
              <div style={styles.progressSpinner}></div>
              <h3 style={styles.progressTitle}>
                {generateLoading && 'Generating Certificates'}
                {generateMissingPdfsLoading && 'Generating Missing PDFs'}
                {regenerateAllPdfsLoading && 'Regenerating All PDFs'}
              </h3>
              <p style={styles.progressMessage}>
                {generateProgress.startTime && generateProgress.current > 0 ? (
                  <>Processing ~{generateProgress.current} of {generateProgress.total} certificates (estimated)</>
                ) : (
                  generateProgress.message
                )}
              </p>
              <div style={styles.progressBar}>
                <div style={{
                  ...styles.progressBarInner,
                  ...(generateProgress.startTime && generateProgress.current > 0 ? {
                    width: `${Math.min((generateProgress.current / generateProgress.total) * 100, 100)}%`,
                    animation: 'none',
                  } : {})
                }}></div>
              </div>
              <p style={styles.progressHint}>
                Please wait... Do not close this window.
                {generateProgress.total > 100 && <><br/>This may take 10-20 minutes for large batches.</>}
              </p>
            </div>
          </div>
        </>
      )}
    </CertVaultLayout>
  );
}

const styles = {
  dashboardWrap: {
    width: '100%',
    maxWidth: 1100,
    margin: '0 auto',
    padding: '0 24px',
    boxSizing: 'border-box',
    flex: 1,
    minHeight: 0,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottom: `1px solid ${theme.border}`,
  },
  title: {
    fontFamily: "'Space Grotesk', Inter, sans-serif",
    fontSize: 20,
    fontWeight: 600,
    letterSpacing: '-0.02em',
    color: theme.text,
    margin: 0,
  },
  orgName: {
    display: 'block',
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 4,
    fontWeight: 400,
  },
  logout: {
    padding: '6px 12px',
    fontSize: 13,
    color: theme.textSecondary,
    backgroundColor: 'transparent',
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  tabs: {
    display: 'flex',
    gap: 6,
    marginBottom: 24,
  },
  tab: {
    padding: '8px 16px',
    fontSize: 13,
    color: theme.textSecondary,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  tabActive: {
    color: theme.text,
    backgroundColor: theme.accentLight,
    fontWeight: 500,
  },
  contentWrap: { flex: 1, minHeight: 0, padding: '8px 0', display: 'flex', flexDirection: 'column' },
  content: { padding: 0 },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  h2: {
    fontFamily: "'Space Grotesk', Inter, sans-serif",
    fontSize: 15,
    whiteSpace: 'nowrap',
    fontWeight: 600,
    color: theme.textSecondary,
    margin: 0,
  },
  eventLabel: { fontWeight: 400, color: theme.textMuted },
  placeholder: { fontSize: 13, color: theme.textMuted, lineHeight: 1.6 },
  link: { color: theme.textSecondary, fontWeight: 500 },

  // First Event modal (0 events)
  firstEventOverlay: {
    position: 'fixed',
    inset: 0,
    background: theme.overlay,
    backdropFilter: 'blur(6px)',
    zIndex: 999,
  },
  firstEventModal: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 24,
  },
  firstEventModalOuter: {
    padding: 2,
    borderRadius: 16,
    background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.6) 0%, rgba(251, 191, 36, 0.4) 50%, rgba(234, 179, 8, 0.6) 100%)',
    boxShadow: '0 0 40px rgba(234, 179, 8, 0.3)',
  },
  firstEventModalInner: {
    padding: '40px 48px',
    borderRadius: 14,
    background: theme.bgCard,
    border: '1px solid rgba(234, 179, 8, 0.25)',
    textAlign: 'center',
    maxWidth: 400,
  },
  firstEventTitle: {
    fontFamily: "'AmericanCaptain', 'Bebas Neue', sans-serif",
    fontSize: 28,
    fontWeight: 400,
    letterSpacing: '0.04em',
    color: '#fbbf24',
    margin: '0 0 12px',
  },
  firstEventSub: {
    fontSize: 14,
    color: theme.textSecondary,
    margin: '0 0 28px',
    lineHeight: 1.5,
  },
  firstEventBtn: {
    padding: '14px 32px',
    fontSize: 16,
    fontWeight: 600,
    color: theme.text,
    background: 'linear-gradient(135deg, #fbbf24 0%, #eab308 100%)',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(234, 179, 8, 0.4)',
  },

  // Buttons
  primaryBtn: {
    padding: '8px 14px',
    backgroundColor: theme.bgCard,
    whiteSpace: 'nowrap',
    color: theme.text,
    fontSize: 13,
    fontWeight: 500,
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  secondaryBtn: {
    padding: '8px 14px',
    backgroundColor: 'transparent',
    whiteSpace: 'nowrap',
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: 500,
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  smallBtn: {
    padding: '5px 10px',
    backgroundColor: 'transparent',
    whiteSpace: 'nowrap',
    color: theme.textSecondary,
    fontSize: 12,
    border: `1px solid ${theme.border}`,
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  dangerBtn: {
    padding: '5px 10px',
    backgroundColor: 'transparent',
    color: theme.error,
    fontSize: 12,
    border: '1px solid rgba(255, 107, 107, 0.2)',
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  linkBtn: {
    padding: 0,
    backgroundColor: 'transparent',
    color: theme.accent,
    fontSize: 12,
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  templateHint: { fontSize: 12, color: theme.textMuted, marginTop: 4 },
  downloadResult: { marginTop: 16 },
  downloadSummary: { fontSize: 13, color: theme.textSecondary, margin: '0 0 12px' },
  notFound: { color: theme.error },
  matchedList: { display: 'flex', flexDirection: 'column', gap: 6 },
  matchedRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: theme.bgInput, borderRadius: 6 },
  noPdf: { fontSize: 12, color: theme.textMuted },
  revokeBtn: {
    padding: 0,
    backgroundColor: 'transparent',
    color: theme.error,
    fontSize: 12,
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'none',
  },

  // Forms
  createForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginBottom: 24,
    padding: 20,
    backgroundColor: theme.bgInput,
    border: `1px solid ${theme.border}`,
    borderRadius: 12,
  },
  generateForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    padding: 18,
    backgroundColor: theme.bgInput,
    border: `1px solid ${theme.border}`,
    borderRadius: 12,
  },
  input: {
    padding: '10px 14px',
    fontSize: 14,
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    backgroundColor: theme.bgInput,
    color: theme.text,
    outline: 'none',
  },
  select: {
    padding: '10px 14px',
    fontSize: 14,
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    minWidth: 200,
    backgroundColor: theme.bgInput,
    color: theme.text,
    outline: 'none',
  },
  textarea: {
    padding: '12px 14px',
    fontSize: 13,
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    fontFamily: 'inherit',
    resize: 'vertical',
    backgroundColor: theme.bgInput,
    color: theme.text,
    outline: 'none',
  },
  label: { fontSize: 13, fontWeight: 500, color: theme.textSecondary },

  // Certificates two-column layout
  certificatesLayout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(320px, 380px) 1fr',
    gap: 24,
    flex: 1,
    minHeight: 0,
    alignItems: 'start',
  },
  certificatesLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    position: 'sticky',
    top: 0,
  },
  certificatesRight: {
    minHeight: 200,
    overflow: 'auto',
  },
  emptyState: {
    padding: 40,
    textAlign: 'center',
    backgroundColor: theme.bgInput,
    borderRadius: 12,
    border: `1px dashed ${theme.border}`,
  },

  downloadLinkCard: {
    padding: 16,
    backgroundColor: 'rgba(74, 222, 128, 0.06)',
    border: '1px solid rgba(74, 222, 128, 0.2)',
    borderRadius: 10,
  },
  downloadLinkLabel: { fontSize: 13, fontWeight: 600, color: theme.text, display: 'block', marginBottom: 4 },
  downloadLinkHint: { fontSize: 12, color: theme.textMuted, margin: '0 0 12px' },
  downloadLinkForm: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  downloadLinkPrefix: { fontSize: 13, color: theme.textMuted },
  downloadLinkInput: {
    width: 120,
    minWidth: 80,
    padding: '8px 12px',
    fontSize: 14,
    border: `1px solid ${theme.border}`,
    borderRadius: 6,
    backgroundColor: theme.bgInput,
    color: theme.text,
    outline: 'none',
  },
  downloadLinkUrl: { display: 'inline-block', marginTop: 10, fontSize: 13, color: '#4ade80', textDecoration: 'none', whiteSpace: 'nowrap' },

  // Events
  eventsList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 12,
  },
  eventCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    backgroundColor: theme.bgInput,
    border: `1px solid ${theme.border}`,
    borderRadius: 12,
    transition: 'all 0.2s',
  },
  eventInfo: { flex: 1 },
  eventName: { fontSize: 14, fontWeight: 500, color: theme.text, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  eventMeta: { fontSize: 12, color: theme.textMuted, margin: '4px 0 0', whiteSpace: 'nowrap' },
  eventActions: { display: 'flex', gap: 6 },
  eventSelector: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' },

  // Certificates table
  certificatesTable: {
    overflowX: 'auto',
    borderRadius: 12,
    border: `1px solid ${theme.border}`,
    backgroundColor: theme.bgCard,
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left',
    padding: '10px 16px',
    backgroundColor: theme.bgInput,
    borderBottom: `1px solid ${theme.border}`,
    fontWeight: 500,
    fontSize: 12,
    color: theme.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    whiteSpace: 'nowrap',
  },
  tr: { borderBottom: `1px solid ${theme.borderLight}` },
  td: { padding: '12px 16px', verticalAlign: 'top', color: theme.textSecondary, whiteSpace: 'nowrap' },
  certId: { fontSize: 12, backgroundColor: theme.bgInput, padding: '3px 8px', borderRadius: 6, color: theme.text, whiteSpace: 'nowrap' },
  email: { fontSize: 12, color: theme.textMuted },
  certActions: { display: 'flex', gap: 8 },
  statusValid: { fontSize: 12, padding: '2px 8px', backgroundColor: 'rgba(74, 222, 128, 0.15)', color: '#4ade80', borderRadius: 4, whiteSpace: 'nowrap' },
  statusRevoked: { fontSize: 12, padding: '2px 8px', backgroundColor: 'rgba(255, 107, 107, 0.15)', color: '#ff6b6b', borderRadius: 4, whiteSpace: 'nowrap' },

  // Settings
  settingsCard: {
    padding: 20,
    backgroundColor: theme.bgInput,
    border: `1px solid ${theme.border}`,
    borderRadius: 12,
  },
  settingRow: {
    display: 'flex',
    padding: '14px 0',
    borderBottom: `1px solid ${theme.border}`,
  },
  settingLabel: { width: 120, fontSize: 13, fontWeight: 500, color: theme.textMuted },
  settingValue: { fontSize: 13, color: theme.textSecondary },

  // Alerts
  successBox: {
    padding: 12,
    backgroundColor: 'rgba(74, 222, 128, 0.08)',
    color: 'rgba(74, 222, 128, 0.95)',
    border: '1px solid rgba(74, 222, 128, 0.2)',
    borderRadius: 8,
    fontSize: 13,
    whiteSpace: 'nowrap',
  },
  errorBox: {
    padding: 12,
    backgroundColor: 'rgba(255, 107, 107, 0.08)',
    color: 'rgba(255, 107, 107, 0.95)',
    border: '1px solid rgba(255, 107, 107, 0.2)',
    borderRadius: 8,
    fontSize: 13,
    whiteSpace: 'nowrap',
  },

  // PDF Generation
  checkboxRow: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 },
  checkbox: { width: 18, height: 18, cursor: 'pointer' },
  checkboxLabel: { fontSize: 14, color: theme.textSecondary, cursor: 'pointer' },
  pdfSettings: { marginTop: 16, padding: 20, backgroundColor: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 12 },
  templateSection: { marginBottom: 16 },
  catalogueGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: 12,
    marginTop: 10,
  },
  catalogueCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: 0,
    backgroundColor: theme.bgInput,
    border: `1px solid ${theme.border}`,
    borderRadius: 10,
    cursor: 'pointer',
    overflow: 'hidden',
    transition: 'all 0.2s',
  },
  cataloguePreview: {
    width: '100%',
    aspectRatio: '4/3',
    overflow: 'hidden',
    backgroundColor: theme.bgInput,
  },
  catalogueImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  catalogueName: {
    padding: '8px 0 2px',
    fontSize: 13,
    fontWeight: 500,
    color: theme.textSecondary,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  catalogueDesc: {
    padding: '0 8px 10px',
    fontSize: 11,
    color: theme.textMuted,
  },
  uploadRow: { display: 'flex', alignItems: 'center', gap: 12 },
  fileInput: { display: 'none' },
  uploadBtn: { 
    display: 'inline-block', 
    padding: '10px 20px', 
    backgroundColor: theme.accentLight, 
    color: theme.text, 
    fontSize: 14, 
    fontWeight: 500, 
    border: `1px solid ${theme.border}`, 
    borderRadius: 8, 
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  
  // Visual Preview
  previewSection: { marginBottom: 20 },
  hint: { fontSize: 12, color: theme.textMuted, fontWeight: 400 },
  previewContainer: { 
    position: 'relative', 
    width: '100%', 
    maxWidth: 600, 
    margin: '12px 0', 
    borderRadius: 8, 
    overflow: 'hidden', 
    border: `2px solid ${theme.border}`,
    backgroundColor: theme.bgInput,
  },
  previewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.overlay,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  spinner: {
    width: 32,
    height: 32,
    border: `3px solid ${theme.border}`,
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  previewImg: { width: '100%', height: 'auto', display: 'block', userSelect: 'none' },
  positionMarker: {
    position: 'absolute',
    transform: 'translate(-50%, -50%)',
    zIndex: 20,
    padding: 8,
    userSelect: 'none',
  },
  markerCrosshair: {
    width: 24,
    height: 24,
    border: '3px solid #3b82f6',
    borderRadius: '50%',
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
  },
  markerLabel: {
    position: 'absolute',
    top: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginTop: 4,
    padding: '4px 8px',
    backgroundColor: '#3b82f6',
    color: '#fff',
    fontSize: 11,
    fontWeight: 500,
    borderRadius: 4,
    whiteSpace: 'nowrap',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
  },
  positionDisplay: {
    fontSize: 13,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  
  // Settings Sliders
  slidersSection: { marginTop: 20, paddingTop: 20, borderTop: `1px solid ${theme.border}` },
  sliderRow: { marginBottom: 16 },
  sliderLabel: { display: 'block', fontSize: 14, color: theme.textSecondary, marginBottom: 8 },
  slider: { 
    width: '100%', 
    height: 8, 
    appearance: 'none',
    backgroundColor: theme.accentLight,
    borderRadius: 4,
    cursor: 'pointer',
  },
  colorRow: { display: 'flex', alignItems: 'center', gap: 12 },
  colorPicker: { 
    width: 48, 
    height: 36, 
    padding: 2, 
    border: `1px solid ${theme.border}`, 
    borderRadius: 6, 
    cursor: 'pointer',
    backgroundColor: 'transparent',
  },
  colorHex: { fontSize: 14, color: theme.textMuted, fontFamily: 'monospace' },

  // Progress Modal
  progressModalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: theme.bgCard,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    backdropFilter: 'blur(8px)',
  },
  progressModal: {
    backgroundColor: 'rgba(20, 20, 20, 0.98)',
    padding: 40,
    borderRadius: 16,
    maxWidth: 480,
    width: '90%',
    textAlign: 'center',
    border: `1px solid ${theme.border}`,
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
  },
  progressSpinner: {
    width: 60,
    height: 60,
    border: `4px solid ${theme.border}`,
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 24px',
  },
  progressTitle: {
    fontSize: 20,
    fontWeight: 600,
    color: theme.text,
    marginBottom: 12,
  },
  progressMessage: {
    fontSize: 15,
    color: theme.textSecondary,
    marginBottom: 20,
    lineHeight: 1.5,
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: theme.accentLight,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBarInner: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 3,
    animation: 'indeterminate 1.5s ease-in-out infinite',
    transition: 'width 0.5s ease-out',
  },
  progressHint: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 8,
  },
};
