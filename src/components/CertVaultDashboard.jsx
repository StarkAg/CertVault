import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { compressTemplateImage } from '../utils/certvaultCompress';
import { pdfDownloadUrl } from '../utils/certvaultPdfUrl';
import VentarcSceneBackground from './VentarcSceneBackground';
import VentarcHeader from './VentarcHeader';

const API_BASE = '/api/certvault';
const STEP_ORDER = ['event', 'participants', 'template', 'generate', 'send'];
const CERTIFICATE_FONTS = [
  { name: 'Georgia', value: 'Georgia, serif' },
  { name: 'Playfair Display', value: "'Playfair Display', serif" },
  { name: 'Source Serif 4', value: "'Source Serif 4', serif" },
  { name: 'EB Garamond', value: "'EB Garamond', serif" },
  { name: 'Inter', value: "'Inter', sans-serif" },
  { name: 'Manrope', value: "'Manrope', sans-serif" },
  { name: 'Montserrat', value: "'Montserrat', sans-serif" },
];

function defaultVerifyLine() {
  if (typeof window === 'undefined') {
    return 'Verify this certificate at /certvault/verify?id={certificate_id}';
  }
  return `Verify this certificate at ${window.location.origin}/certvault/verify?id={certificate_id}`;
}

function defaultTemplateSettings() {
  return {
    text_x: 0.5,
    text_y: 0.45,
    font_size: 60,
    font_color: '#000000',
    font_family: 'Georgia, serif',
    show_cert_id: false,
    cert_id_x: 0.5,
    cert_id_y: 0.85,
    cert_id_size: 24,
    verify_line_text: defaultVerifyLine(),
    verify_line_x: 0.5,
    verify_line_y: 0.92,
    verify_line_size: 12,

    verify_line_color: '#666666',
    verify_line_font: "'Inter', sans-serif",
  };
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function parseParticipantCsv(text) {
  const rows = String(text || '').split(/\r?\n/);
  const participants = [];
  const errors = [];
  const seenEmails = new Set();

  rows.forEach((rowText, index) => {
    const line = rowText.replace(/^\uFEFF/, '').trim();
    if (!line) return;
    const parts = line.split(',').map((part) => part.trim());
    const [name = '', email = '', category = 'Participant'] = parts;
    const normalizedName = name.toLowerCase();
    const normalizedEmail = email.toLowerCase();

    if (
      index === 0 &&
      (normalizedName === 'name' || normalizedName === 'participant name') &&
      normalizedEmail === 'email'
    ) {
      return;
    }

    if (!name) {
      errors.push({ row: index + 1, message: 'Name is required' });
      return;
    }
    if (!email) {
      errors.push({ row: index + 1, message: 'Email is required' });
      return;
    }
    if (!isValidEmail(email)) {
      errors.push({ row: index + 1, message: 'Email format is invalid' });
      return;
    }
    const loweredEmail = email.toLowerCase();
    if (seenEmails.has(loweredEmail)) {
      errors.push({ row: index + 1, message: 'Duplicate email in CSV' });
      return;
    }

    seenEmails.add(loweredEmail);
    participants.push({
      row: index + 1,
      name,
      email: loweredEmail,
      category: category || 'Participant',
    });
  });

  return { participants, errors };
}

function rowsToParticipantCsv(rows) {
  return rows
    .map(({ name = '', email = '', category = 'Participant' }) => `${name},${email},${category || 'Participant'}`)
    .join('\n');
}

function normalizeSpreadsheetRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const [firstRow] = rows;
  const normalizedHeader = Array.isArray(firstRow)
    ? firstRow.map((cell) => String(cell || '').trim().toLowerCase())
    : [];
  const hasHeaderRow = normalizedHeader.some((cell) => ['name', 'participant name', 'email', 'category'].includes(cell));

  const findHeaderIndex = (candidates) => normalizedHeader.findIndex((cell) => candidates.includes(cell));
  const nameIndex = hasHeaderRow ? findHeaderIndex(['name', 'participant name']) : 0;
  const emailIndex = hasHeaderRow ? findHeaderIndex(['email', 'email id', 'mail']) : 1;
  const categoryIndex = hasHeaderRow ? findHeaderIndex(['category', 'role', 'type']) : 2;

  return rows
    .slice(hasHeaderRow ? 1 : 0)
    .map((row) => Array.isArray(row) ? row : [])
    .filter((row) => row.some((cell) => String(cell || '').trim()))
    .map((row) => ({
      name: String(row[nameIndex] ?? '').trim(),
      email: String(row[emailIndex] ?? '').trim(),
      category: String(row[categoryIndex] ?? 'Participant').trim() || 'Participant',
    }));
}

function computeSendSummary(certificates) {
  const list = certificates || [];
  return {
    total: list.length,
    sent: list.filter((cert) => cert.email_send_status === 'sent').length,
    failed: list.filter((cert) => cert.email_send_status === 'failed').length,
    eligible: list.filter((cert) =>
      cert.status === 'valid' &&
      cert.pdf_url &&
      isValidEmail(cert.recipient_email) &&
      cert.email_send_status !== 'sent'
    ).length,
  };
}

async function fileToDataUrl(file) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function svgToPngDataUrl(dataUrl) {
  return await new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

function clampUnit(value) {
  return Math.max(0, Math.min(1, value));
}

function snapPosition(raw, targets, threshold = 0.025) {
  for (const target of targets) {
    if (Math.abs(raw - target) < threshold) return target;
  }
  return raw;
}

function getCertificateReadiness(cert) {
  const ready = Boolean(cert?.pdf_url) && isValidEmail(cert?.recipient_email);
  return ready
    ? { label: 'Ready to send', className: 'bg-emerald-500/14 text-emerald-200 ring-emerald-400/30' }
    : { label: 'Needs attention', className: 'bg-amber-500/14 text-amber-200 ring-amber-400/30' };
}

function getDeliveryStatusAppearance(status) {
  switch (status) {
    case 'sent':
      return { label: 'Sent', className: 'bg-emerald-500/14 text-emerald-200 ring-emerald-400/30' };
    case 'failed':
      return { label: 'Failed', className: 'bg-red-500/14 text-red-200 ring-red-400/30' };
    case 'not_ready':
      return { label: 'Blocked', className: 'bg-amber-500/14 text-amber-200 ring-amber-400/30' };
    default:
      return { label: 'Pending', className: 'bg-white/8 text-[var(--apple-text-secondary)] ring-white/12' };
  }
}

function stepStatus(step, selectedEventId, csvReady, templateReady, hasCertificates) {
  if (step === 'event') return 'current';
  if (!selectedEventId) return 'locked';
  if (step === 'participants') return 'current';
  if (step === 'template' && !csvReady) return 'locked';
  if (step === 'template') return 'current';
  if (step === 'generate' && (!csvReady || !templateReady)) return 'locked';
  if (step === 'generate') return 'current';
  if (step === 'send' && !hasCertificates) return 'locked';
  return 'current';
}

function areTemplateSettingsEqual(a, b) {
  return JSON.stringify(a || {}) === JSON.stringify(b || {});
}

export default function CertVaultDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [authToken, setAuthToken] = useState(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState(null);
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [eventsLoading, setEventsLoading] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventSlug, setNewEventSlug] = useState('');
  const [newEventSlugEdited, setNewEventSlugEdited] = useState(false);
  const [createEventLoading, setCreateEventLoading] = useState(false);
  const [downloadSlugInput, setDownloadSlugInput] = useState('');
  const [savingSlug, setSavingSlug] = useState(false);
  const [participantCsv, setParticipantCsv] = useState('');
  const [participantCsvSaving, setParticipantCsvSaving] = useState(false);
  const [participantCsvSaveError, setParticipantCsvSaveError] = useState('');
  const [participantCsvSavedAt, setParticipantCsvSavedAt] = useState(null);
  const [templateSettings, setTemplateSettings] = useState(defaultTemplateSettings());
  const [templateAssetUrl, setTemplateAssetUrl] = useState('');
  const [templatePreviewUrl, setTemplatePreviewUrl] = useState('');
  const [renderedTemplatePreviewUrl, setRenderedTemplatePreviewUrl] = useState('');
  const [renderedTemplatePreviewLoading, setRenderedTemplatePreviewLoading] = useState(false);
  const [renderedTemplatePreviewError, setRenderedTemplatePreviewError] = useState('');
  const [selectedTemplateName, setSelectedTemplateName] = useState('');
  const [templateSaving, setTemplateSaving] = useState(false);
  const [isTemplateDropActive, setIsTemplateDropActive] = useState(false);
  const [previewMetrics, setPreviewMetrics] = useState({ naturalWidth: 0, renderedWidth: 0 });
  const [pendingTemplateDrag, setPendingTemplateDrag] = useState(null);
  const [dragTarget, setDragTarget] = useState('');
  const [liveTemplatePreviewActive, setLiveTemplatePreviewActive] = useState(false);
  const [selectedTemplateLayer, setSelectedTemplateLayer] = useState('name');
  const [showTemplateOverlay, setShowTemplateOverlay] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [certificates, setCertificates] = useState([]);
  const [certificatesLoading, setCertificatesLoading] = useState(false);
  const [deletingCertificateId, setDeletingCertificateId] = useState('');
  const [regenerateAllPdfsLoading, setRegenerateAllPdfsLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateResult, setGenerateResult] = useState(null);
  const [mailerConfig, setMailerConfig] = useState({
    mailer_email: '',
    mailer_from_name: '',
    mailer_app_password: '',
    has_mailer_app_password: false,
  });
  const [mailerLoading, setMailerLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [sendProgress, setSendProgress] = useState({
    total: 0,
    current: 0,
    sent: 0,
    failed: 0,
    phase: '',
    provider: '',
    delayMs: 0,
    limitReached: false,
  });
  const [sendSummary, setSendSummary] = useState({ total: 0, sent: 0, failed: 0, eligible: 0 });
  const autoSaveRef = useRef(false);
  const skipNextParticipantAutosaveRef = useRef(false);
  const participantFileInputRef = useRef(null);
  const templateFileInputRef = useRef(null);
  const templatePreviewContainerRef = useRef(null);
  const templatePreviewImageRef = useRef(null);

  const token = authToken || (typeof window !== 'undefined' ? localStorage.getItem('certvault_club_token') : null);
  const selectedEvent = events.find((event) => event.id === selectedEventId) || null;
  const parsedCsv = useMemo(() => parseParticipantCsv(participantCsv), [participantCsv]);
  const requestedStep = searchParams.get('step') || 'event';
  const currentStep = STEP_ORDER.includes(requestedStep) ? requestedStep : 'event';
  const csvReady = parsedCsv.participants.length > 0 && parsedCsv.errors.length === 0;
  const csvStatusAppearance = parsedCsv.errors.length
    ? {
        panelClassName: 'border-red-200 bg-red-50',
        title: 'Fix these CSV rows before generating',
      }
    : !parsedCsv.participants.length
      ? {
          panelClassName: 'border-slate-200 bg-white',
          title: 'Paste participant rows to continue',
        }
      : {
          panelClassName: 'border-slate-200 bg-white',
          title: 'CSV is ready for template + generation',
        };
  const templateReady = Boolean(templateAssetUrl || templatePreviewUrl);
  const hasCertificates = certificates.length > 0;
  const sendResultSentCount = Array.isArray(sendResult?.sent)
    ? sendResult.sent.length
    : Number(sendResult?.sent || sendResult?.results?.sent?.length || 0);
  const sendResultFailedCount = Array.isArray(sendResult?.failed)
    ? sendResult.failed.length
    : Number(sendResult?.failed || sendResult?.results?.failed?.length || 0);
  const sendProgressPercent = sendProgress.total
    ? Math.min(100, Math.round((sendProgress.current / sendProgress.total) * 100))
    : 0;
  const templateContinueReason = !templateReady
    ? 'Upload and save a certificate template first.'
    : !parsedCsv.participants.length
      ? 'Add at least one participant row in the CSV step.'
      : parsedCsv.errors.length
        ? `Fix ${parsedCsv.errors.length} CSV ${parsedCsv.errors.length === 1 ? 'issue' : 'issues'} in the participants step.`
        : '';
  const previewScale = previewMetrics.naturalWidth && previewMetrics.renderedWidth
    ? previewMetrics.renderedWidth / previewMetrics.naturalWidth
    : 1;
  const activeTemplateSource = typeof templatePreviewUrl === 'string' && templatePreviewUrl.trim()
    ? templatePreviewUrl.trim()
    : (typeof templateAssetUrl === 'string' ? templateAssetUrl.trim() : '');
  const usingRenderedTemplatePreview = Boolean(renderedTemplatePreviewUrl);
  const showLiveTemplateText = liveTemplatePreviewActive || !usingRenderedTemplatePreview;
  const templatePreviewImageUrl = showLiveTemplateText
    ? activeTemplateSource
    : renderedTemplatePreviewUrl || activeTemplateSource;
  const templatePreviewStatus = templateSaving
    ? 'Saving...'
    : renderedTemplatePreviewLoading
      ? 'Rendering PDF-accurate preview...'
      : renderedTemplatePreviewError
        ? 'Preview render failed'
        : liveTemplatePreviewActive
          ? 'Live adjustment preview'
          : usingRenderedTemplatePreview
          ? 'PDF-accurate preview'
          : templateReady
            ? 'Saved to event'
            : 'No template yet';
  const overlayWidth = 280;
  const selectedOverlayX = selectedTemplateLayer === 'verify'
    ? templateSettings.verify_line_x
    : templateSettings.text_x;
  const selectedOverlayY = selectedTemplateLayer === 'verify'
    ? templateSettings.verify_line_y
    : templateSettings.text_y;
  const overlayLeft = Math.max(overlayWidth / 2 + 16, Math.min(previewMetrics.renderedWidth - overlayWidth / 2 - 16, selectedOverlayX * previewMetrics.renderedWidth || 0));
  const overlayTop = Math.max(18, (selectedOverlayY * 100) + 8);

  function revealTemplateOverlay(layer = selectedTemplateLayer) {
    setSelectedTemplateLayer(layer);
    setShowTemplateOverlay(true);
  }

  function selectTemplateLayer(layer) {
    revealTemplateOverlay(layer);
  }

  function nudgeTemplateLayer(layer = selectedTemplateLayer, deltaX = 0, deltaY = 0, amount = 0.004) {
    revealTemplateOverlay(layer);
    setLiveTemplatePreviewActive(true);
    setTemplateSettings((current) => {
      if (layer === 'verify') {
        return {
          ...current,
          verify_line_x: clampUnit(current.verify_line_x + deltaX * amount),
          verify_line_y: clampUnit(current.verify_line_y + deltaY * amount),
        };
      }

      return {
        ...current,
        text_x: clampUnit(current.text_x + deltaX * amount),
        text_y: clampUnit(current.text_y + deltaY * amount),
      };
    });
  }

  function setStep(step) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('step', step);
    setSearchParams(nextParams, { replace: true });
  }

  async function fetchWithAuth(url, options = {}) {
    const currentToken = authToken || (typeof window !== 'undefined' ? localStorage.getItem('certvault_club_token') : null);
    return await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
        ...(options.headers || {}),
      },
    });
  }

  function handleLogout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('certvault_club_token');
    }
    setAuthToken('');
    setOrganization(null);
    navigate('/login', { replace: true });
  }

  async function loadCertificates(eventId) {
    if (!eventId) {
      setCertificates([]);
      setSendSummary({ total: 0, sent: 0, failed: 0, eligible: 0 });
      return;
    }
    setCertificatesLoading(true);
    try {
      const [certRes, summaryRes] = await Promise.all([
        fetchWithAuth(`${API_BASE}?action=list-certificates&eventId=${encodeURIComponent(eventId)}`),
        fetchWithAuth(`${API_BASE}?action=send-status&eventId=${encodeURIComponent(eventId)}`),
      ]);
      const certData = await certRes.json();
      const summaryData = await summaryRes.json().catch(() => ({}));
      if (certData.success) {
        setCertificates(certData.certificates || []);
      }
      if (summaryData.success) {
        setSendSummary(summaryData.summary || computeSendSummary(certData.certificates || []));
      } else if (certData.success) {
        setSendSummary(computeSendSummary(certData.certificates || []));
      }
    } finally {
      setCertificatesLoading(false);
    }
  }

  async function loadEvents(preferredEventId = '') {
    setEventsLoading(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}?action=list-events`);
      const data = await res.json();
      if (data.success) {
        const list = data.events || [];
        setEvents(list);
        const activeId =
          preferredEventId ||
          selectedEventId ||
          searchParams.get('eventId') ||
          list[0]?.id ||
          '';
        setSelectedEventId(activeId);
      }
    } finally {
      setEventsLoading(false);
    }
  }

  async function loadTemplateConfig(eventId) {
    setConfigLoaded(false);
    setRenderedTemplatePreviewUrl('');
    setRenderedTemplatePreviewLoading(false);
    setRenderedTemplatePreviewError('');
    setLiveTemplatePreviewActive(false);
    if (!eventId) {
      setParticipantCsv('');
      setParticipantCsvSaveError('');
      setParticipantCsvSavedAt(null);
      setTemplateAssetUrl('');
      setTemplatePreviewUrl('');
      setSelectedTemplateName('');
      setTemplateSettings(defaultTemplateSettings());
      return;
    }

    const res = await fetchWithAuth(`${API_BASE}?action=template-config&eventId=${encodeURIComponent(eventId)}`);
    const data = await res.json();
    if (!data.success) return;

    autoSaveRef.current = false;
    skipNextParticipantAutosaveRef.current = false;
    const settings = {
      ...defaultTemplateSettings(),
      ...(data.config?.template_settings || {}),
    };
    setParticipantCsv(data.config?.participant_csv || '');
    setParticipantCsvSaveError('');
    setParticipantCsvSavedAt(data.config?.participant_csv ? Date.now() : null);
    setTemplateAssetUrl(data.config?.template_asset_url || '');
    setTemplatePreviewUrl(data.config?.template_asset_url || '');
    setSelectedTemplateName(data.config?.template_asset_url ? 'Saved event template' : '');
    setTemplateSettings(settings);
    setConfigLoaded(true);
  }

  async function loadMailerConfig() {
    const res = await fetchWithAuth(`${API_BASE}?action=mailer-config`);
    const data = await res.json();
    if (data.success) {
      setMailerConfig((current) => ({
        ...current,
        mailer_email: data.config?.mailer_email || '',
        mailer_from_name: data.config?.mailer_from_name || '',
        mailer_app_password: '',
        has_mailer_app_password: Boolean(data.config?.has_mailer_app_password),
      }));
    }
  }

  async function saveTemplateConfig(payload = {}, options = {}) {
    if (!selectedEventId) return null;
    const { suppressTemplateSaving = false } = options;
    if (!suppressTemplateSaving) {
      setTemplateSaving(true);
    }
    try {
      const res = await fetchWithAuth(`${API_BASE}?action=template-config`, {
        method: 'POST',
        body: JSON.stringify({
          eventId: selectedEventId,
          participant_csv: payload.participant_csv !== undefined ? payload.participant_csv : participantCsv,
          template_settings: payload.template_settings !== undefined ? payload.template_settings : templateSettings,
          ...(payload.template_data_url ? { template_data_url: payload.template_data_url } : {}),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTemplateAssetUrl(data.config?.template_asset_url || '');
        setTemplatePreviewUrl(data.config?.template_asset_url || templatePreviewUrl);
        if (data.config?.template_settings) {
          const nextSettings = {
            ...defaultTemplateSettings(),
            ...data.config.template_settings,
          };
          setTemplateSettings((current) => (
            areTemplateSettingsEqual(current, nextSettings) ? current : nextSettings
          ));
        }
      }
      return data;
    } finally {
      if (!suppressTemplateSaving) {
        setTemplateSaving(false);
      }
    }
  }

  async function saveParticipantCsv(nextCsv) {
    if (!selectedEventId) return null;

    setParticipantCsvSaving(true);
    setParticipantCsvSaveError('');

    try {
      const data = await saveTemplateConfig(
        { participant_csv: nextCsv },
        { suppressTemplateSaving: true }
      );

      if (data?.success) {
        setParticipantCsvSavedAt(Date.now());
      } else {
        setParticipantCsvSaveError(data?.error || 'Could not auto-save participant CSV');
      }

      return data;
    } catch (error) {
      setParticipantCsvSaveError(error.message || 'Could not auto-save participant CSV');
      return null;
    } finally {
      setParticipantCsvSaving(false);
    }
  }

  useEffect(() => {
    const localToken = typeof window !== 'undefined' ? localStorage.getItem('certvault_club_token') : null;
    setAuthToken(localToken || '');
    setAuthResolved(true);
  }, []);

  useEffect(() => {
    if (!authResolved) return;
    if (!token) {
      navigate('/login?next=/dashboard', { replace: true });
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchWithAuth(`${API_BASE}?action=me`)
      .then((res) => res.json())
      .then(async (data) => {
        if (cancelled) return;
        if (data.success && data.organization) {
          setOrganization(data.organization);
          await Promise.all([loadEvents(), loadMailerConfig()]);
        } else {
          localStorage.removeItem('certvault_club_token');
          navigate('/login?next=/dashboard', { replace: true });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authResolved, token, navigate]);

  useEffect(() => {
    if (!selectedEventId) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('eventId', selectedEventId);
    if (!nextParams.get('step')) nextParams.set('step', 'participants');
    setSearchParams(nextParams, { replace: true });
    setDownloadSlugInput(selectedEvent?.download_slug || '');
    loadTemplateConfig(selectedEventId);
    loadCertificates(selectedEventId);
  }, [selectedEventId]);

  useEffect(() => {
    if (!configLoaded || !selectedEventId) return;
    if (!autoSaveRef.current) {
      autoSaveRef.current = true;
      return;
    }
    if (skipNextParticipantAutosaveRef.current) {
      skipNextParticipantAutosaveRef.current = false;
      return;
    }

    const timeout = setTimeout(() => {
      saveTemplateConfig({
        participant_csv: participantCsv,
        template_settings: templateSettings,
      });
    }, 700);

    return () => clearTimeout(timeout);
  }, [participantCsv, templateSettings, configLoaded, selectedEventId]);

  useEffect(() => {
    if (!configLoaded || !selectedEventId || !activeTemplateSource) {
      setRenderedTemplatePreviewUrl('');
      setRenderedTemplatePreviewLoading(false);
      setRenderedTemplatePreviewError('');
      setLiveTemplatePreviewActive(false);
      return undefined;
    }

    if (dragTarget) return undefined;

    let cancelled = false;
    setRenderedTemplatePreviewLoading(true);
    setRenderedTemplatePreviewError('');

    const timeout = setTimeout(async () => {
      try {
        const res = await fetchWithAuth(`${API_BASE}?action=template-preview`, {
          method: 'POST',
          body: JSON.stringify({
            eventId: selectedEventId,
            template: activeTemplateSource,
            settings: templateSettings,
            name: 'Elon Musk',
            certificateId: 'CV-2026-SAMPLE',
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Could not render certificate preview');
        }
        if (!cancelled) {
          setRenderedTemplatePreviewUrl(data.preview || '');
          setLiveTemplatePreviewActive(false);
        }
      } catch (error) {
        if (!cancelled) {
          setRenderedTemplatePreviewUrl('');
          setRenderedTemplatePreviewError(error.message || 'Could not render certificate preview');
        }
      } finally {
        if (!cancelled) {
          setRenderedTemplatePreviewLoading(false);
        }
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [configLoaded, selectedEventId, activeTemplateSource, templateSettings, dragTarget]);

  function handleParticipantCsvChange(e) {
    setParticipantCsv(e.target.value);
    setParticipantCsvSaveError('');
  }

  function handleParticipantCsvPaste(event) {
    if (!selectedEventId) return;

    const pastedText = event.clipboardData?.getData('text');
    if (typeof pastedText !== 'string') return;

    const start = event.currentTarget.selectionStart ?? participantCsv.length;
    const end = event.currentTarget.selectionEnd ?? participantCsv.length;
    const nextCsv = `${participantCsv.slice(0, start)}${pastedText}${participantCsv.slice(end)}`;

    event.preventDefault();
    skipNextParticipantAutosaveRef.current = true;
    setParticipantCsv(nextCsv);
    setParticipantCsvSaveError('');
    void saveParticipantCsv(nextCsv);
  }

  async function handleParticipantSpreadsheetChange(event) {
    const file = event.target.files?.[0];
    if (!file || !selectedEventId) return;

    try {
      const fileName = file.name.toLowerCase();
      let nextCsv = '';

      if (fileName.endsWith('.csv')) {
        nextCsv = await file.text();
      } else {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false });
        nextCsv = rowsToParticipantCsv(normalizeSpreadsheetRows(rows));
      }

      skipNextParticipantAutosaveRef.current = true;
      setParticipantCsv(nextCsv);
      setParticipantCsvSaveError('');
      await saveParticipantCsv(nextCsv);
    } catch (error) {
      setParticipantCsvSaveError(error.message || 'Could not read spreadsheet');
    } finally {
      if (event.target) event.target.value = '';
    }
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
          download_slug: slugify(newEventSlug || suggestedSlugFromEventName(newEventName) || newEventName),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNewEventName('');
        setNewEventDate('');
        setNewEventSlug('');
        setNewEventSlugEdited(false);
        await loadEvents(data.event?.id);
        setStep('participants');
      }
    } finally {
      setCreateEventLoading(false);
    }
  }

  async function handleSaveSlug(e) {
    e.preventDefault();
    if (!selectedEventId) return;
    setSavingSlug(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}?action=set-download-slug`, {
        method: 'POST',
        body: JSON.stringify({
          eventId: selectedEventId,
          download_slug: slugify(downloadSlugInput),
        }),
      });
      const data = await res.json();
      if (data.success) {
        await loadEvents(selectedEventId);
      }
    } finally {
      setSavingSlug(false);
    }
  }

  async function handleTemplateFile(file) {
    if (!file || !selectedEventId) return;
    setSelectedTemplateName(file.name);
    setRenderedTemplatePreviewUrl('');
    setRenderedTemplatePreviewError('');
    setLiveTemplatePreviewActive(false);
    let dataUrl = await fileToDataUrl(file);
    if (dataUrl.startsWith('data:image/svg')) {
      dataUrl = await svgToPngDataUrl(dataUrl);
    }
    dataUrl = await compressTemplateImage(dataUrl);
    setTemplatePreviewUrl(dataUrl);
    await saveTemplateConfig({ template_data_url: dataUrl });
  }

  async function handleTemplateFileChange(event) {
    const file = event.target.files?.[0];
    await handleTemplateFile(file);
    if (event.target) event.target.value = '';
  }

  function handleTemplateDragOver(event) {
    event.preventDefault();
    setIsTemplateDropActive(true);
  }

  function handleTemplateDragLeave(event) {
    event.preventDefault();
    setIsTemplateDropActive(false);
  }

  async function handleTemplateDrop(event) {
    event.preventDefault();
    setIsTemplateDropActive(false);
    const file = event.dataTransfer?.files?.[0];
    await handleTemplateFile(file);
  }

  function handlePreviewImageLoad() {
    const image = templatePreviewImageRef.current;
    if (!image) return;
    setPreviewMetrics({
      naturalWidth: image.naturalWidth || 0,
      renderedWidth: image.clientWidth || 0,
    });
  }

  function beginTemplateDrag(event, target) {
    event.preventDefault();
    selectTemplateLayer(target);
    event.currentTarget.focus({ preventScroll: true });
    setPendingTemplateDrag({
      target,
      startX: event.clientX,
      startY: event.clientY,
    });
  }

  function updateDraggedPosition(clientX, clientY, target) {
    const container = templatePreviewContainerRef.current;
    if (!container || !target) return;

    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const x = snapPosition(clampUnit((clientX - rect.left) / rect.width), [0.2, 0.35, 0.5, 0.65, 0.8]);
    const y = snapPosition(clampUnit((clientY - rect.top) / rect.height), [0.15, 0.3, 0.45, 0.6, 0.75, 0.9]);

    setTemplateSettings((current) => {
      if (target === 'name') {
        return {
          ...current,
          text_x: snapPosition(x, [0.25, 0.5, 0.75, current.verify_line_x]),
          text_y: snapPosition(y, [0.2, 0.35, 0.5, 0.65, 0.8, current.verify_line_y]),
        };
      }

      return {
        ...current,
        verify_line_x: snapPosition(x, [0.25, 0.5, 0.75, current.text_x]),
        verify_line_y: snapPosition(y, [0.2, 0.35, 0.5, 0.65, 0.8, current.text_y]),
      };
    });
  }

  useEffect(() => {
    if (!templatePreviewImageUrl) return;

    function handleResize() {
      handlePreviewImageLoad();
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [templatePreviewImageUrl]);

  useEffect(() => {
    if (!pendingTemplateDrag && !dragTarget) return undefined;

    function handlePointerMove(event) {
      const activeTarget = dragTarget || pendingTemplateDrag?.target;
      if (!activeTarget) return;

      if (!dragTarget && pendingTemplateDrag) {
        const distance = Math.hypot(
          event.clientX - pendingTemplateDrag.startX,
          event.clientY - pendingTemplateDrag.startY
        );
        if (distance < 4) return;
        setDragTarget(activeTarget);
        setLiveTemplatePreviewActive(true);
      }

      updateDraggedPosition(event.clientX, event.clientY, activeTarget);
    }

    function handlePointerUp() {
      setPendingTemplateDrag(null);
      setDragTarget('');
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    if (dragTarget) {
      document.body.style.cursor = 'grabbing';
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.style.cursor = '';
    };
  }, [pendingTemplateDrag, dragTarget]);

  useEffect(() => {
    if (!showTemplateOverlay || dragTarget) return undefined;

    const timeout = setTimeout(() => {
      setShowTemplateOverlay(false);
    }, 3000);

    return () => clearTimeout(timeout);
  }, [showTemplateOverlay, dragTarget, selectedTemplateLayer, templateSettings]);

  async function handleGenerate() {
    if (!selectedEventId) {
      setGenerateResult({ success: false, error: 'Choose an event first' });
      return;
    }
    if (!csvReady) {
      setGenerateResult({ success: false, error: 'Fix CSV errors before generating certificates' });
      return;
    }
    if (!templateReady) {
      setGenerateResult({ success: false, error: 'Upload a certificate template before generating certificates' });
      return;
    }

    setGenerateLoading(true);
    setGenerateResult(null);

    try {
      const activeTemplate = typeof templatePreviewUrl === 'string' && templatePreviewUrl.trim()
        ? templatePreviewUrl.trim()
        : typeof templateAssetUrl === 'string' && templateAssetUrl.trim()
          ? templateAssetUrl.trim()
          : '';

      const inlineTemplate = activeTemplate.startsWith('data:')
        ? activeTemplate
        : '';

      await saveTemplateConfig(inlineTemplate && !templateAssetUrl ? { template_data_url: inlineTemplate } : {});
      const res = await fetchWithAuth(`${API_BASE}?action=generate`, {
        method: 'POST',
        body: JSON.stringify({
          eventId: selectedEventId,
          recipients: parsedCsv.participants,
          template: activeTemplate || undefined,
          settings: templateSettings,
        }),
      });
      const data = await res.json().catch(() => ({
        success: false,
        error: `Generation failed with HTTP ${res.status}`,
      }));
      setGenerateResult(data);
      if (data.success) {
        await loadCertificates(selectedEventId);
        setStep('send');
      }
    } catch (error) {
      setGenerateResult({
        success: false,
        error: error.message || 'Could not generate certificates',
      });
    } finally {
      setGenerateLoading(false);
    }
  }

  async function handleRegenerateAllPdfs() {
    if (!selectedEventId) return;
    if (!templateReady) {
      setGenerateResult({ success: false, error: 'Upload or save a certificate template before regenerating PDFs' });
      return;
    }

    const activeTemplate = typeof templatePreviewUrl === 'string' && templatePreviewUrl.trim()
      ? templatePreviewUrl.trim()
      : typeof templateAssetUrl === 'string' && templateAssetUrl.trim()
        ? templateAssetUrl.trim()
        : '';

    if (!activeTemplate) {
      setGenerateResult({ success: false, error: 'No template available for PDF regeneration' });
      return;
    }

    setRegenerateAllPdfsLoading(true);
    setGenerateResult(null);

    try {
      const inlineTemplate = activeTemplate.startsWith('data:') ? activeTemplate : '';
      await saveTemplateConfig(inlineTemplate && !templateAssetUrl ? { template_data_url: inlineTemplate } : {});

      const res = await fetchWithAuth(`${API_BASE}?action=regenerate-all-pdfs`, {
        method: 'POST',
        body: JSON.stringify({
          eventId: selectedEventId,
          template: activeTemplate,
          settings: templateSettings,
        }),
      });
      const data = await res.json().catch(() => ({
        success: false,
        error: `Regeneration failed with HTTP ${res.status}`,
      }));

      setGenerateResult(
        data.success
          ? {
              ...data,
              message: data.message || `Regenerated ${data.generated || 0} PDFs${data.failed ? `, ${data.failed} failed` : ''}`,
            }
          : data
      );

      if (data.success) {
        await loadCertificates(selectedEventId);
        await loadEvents(selectedEventId);
      }
    } catch (error) {
      setGenerateResult({
        success: false,
        error: error.message || 'Could not regenerate PDFs',
      });
    } finally {
      setRegenerateAllPdfsLoading(false);
    }
  }

  async function handleDeleteCertificate(certificateId) {
    if (!selectedEventId || !certificateId) return;
    if (typeof window !== 'undefined' && !window.confirm(`Delete certificate ${certificateId}? This cannot be undone.`)) {
      return;
    }

    setDeletingCertificateId(certificateId);
    try {
      const res = await fetchWithAuth(`${API_BASE}?action=delete`, {
        method: 'POST',
        body: JSON.stringify({ certificateId }),
      });
      const data = await res.json().catch(() => ({
        success: false,
        error: `Delete failed with HTTP ${res.status}`,
      }));

      if (!data.success) {
        setGenerateResult({
          success: false,
          error: data.error || 'Could not delete certificate',
        });
        return;
      }

      setGenerateResult({
        success: true,
        generated: certificates.length - 1,
        pdfsGenerated: certificates.filter((cert) => cert.certificate_id !== certificateId && cert.pdf_url).length,
        message: `Certificate ${certificateId} deleted successfully`,
      });
      await Promise.all([loadCertificates(selectedEventId), loadEvents(selectedEventId)]);
    } catch (error) {
      setGenerateResult({
        success: false,
        error: error.message || 'Could not delete certificate',
      });
    } finally {
      setDeletingCertificateId('');
    }
  }

  async function handleSaveMailerConfig(e) {
    e.preventDefault();
    setMailerLoading(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}?action=mailer-config`, {
        method: 'POST',
        body: JSON.stringify({
          mailer_email: mailerConfig.mailer_email,
          mailer_from_name: mailerConfig.mailer_from_name,
          ...(mailerConfig.mailer_app_password ? { mailer_app_password: mailerConfig.mailer_app_password } : {}),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMailerConfig((current) => ({
          ...current,
          mailer_app_password: data.persisted ? '' : current.mailer_app_password,
          has_mailer_app_password: Boolean(data.config?.has_mailer_app_password),
        }));
      }
    } finally {
      setMailerLoading(false);
    }
  }

  async function handleSendCertificates() {
    if (!selectedEventId) return;
    setSendLoading(true);
    setSendResult(null);
    setSendProgress({
      total: sendSummary.eligible,
      current: 0,
      sent: 0,
      failed: 0,
      phase: 'Starting send...',
      provider: '',
      delayMs: 0,
      limitReached: false,
    });
    try {
      const res = await fetchWithAuth(`${API_BASE}?action=send-certificates`, {
        method: 'POST',
        headers: { Accept: 'application/x-ndjson' },
        body: JSON.stringify({
          eventId: selectedEventId,
          mailer_email: mailerConfig.mailer_email,
          mailer_from_name: mailerConfig.mailer_from_name,
          ...(mailerConfig.mailer_app_password ? { mailer_app_password: mailerConfig.mailer_app_password } : {}),
          stream: true,
        }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({ success: false, error: `Send failed with HTTP ${res.status}` }));
        setSendResult(data);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalResult = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === 'start' || event.type === 'progress') {
            setSendProgress({
              total: event.total || 0,
              current: event.current || 0,
              sent: event.sent || 0,
              failed: event.failed || 0,
              provider: event.provider || '',
              delayMs: Number(event.delay_ms || 0),
              limitReached: Boolean(event.rate_limited),
              phase: event.phase === 'sent'
                ? `Sent to ${event.email}`
                : event.phase === 'failed'
                  ? `Failed for ${event.email}`
                  : event.phase === 'cooldown'
                    ? `Waiting ${Math.ceil(Number(event.delay_ms || 0) / 1000)}s to respect Gmail limits`
                    : event.rate_limited
                      ? `Gmail sending limit reached${event.error ? `: ${event.error}` : ''}`
                      : event.email
                        ? `Sending to ${event.email}`
                        : 'Preparing certificates...',
            });
          }
          if (event.type === 'done') {
            finalResult = event;
          }
        }
      }

      if (finalResult) {
        setSendProgress((current) => ({
          ...current,
          current: finalResult.attempted || current.total,
          sent: finalResult.sent || 0,
          failed: finalResult.failed || 0,
          provider: finalResult.provider || current.provider,
          delayMs: Number(finalResult.delay_ms || current.delayMs || 0),
          limitReached: Boolean(finalResult.limit_reached),
          phase: finalResult.limit_reached ? 'Stopped after Gmail sending limit was reached' : 'Send complete',
        }));
        setSendResult(finalResult);
      }
      await loadCertificates(selectedEventId);
    } catch (error) {
      setSendResult({ success: false, error: error.message || 'Could not send certificates' });
    } finally {
      setSendLoading(false);
    }
  }

  if (loading || !authResolved || token === null) {
    return null;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05070b] text-white">
      <VentarcHeader dashboardOrganization={organization} onDashboardLogout={handleLogout} />
      <VentarcSceneBackground page="features" />
      <div className="relative z-10 px-4 pb-8 pt-28 sm:px-6 lg:px-10">
        <div className="ventarc-dashboard-page mx-auto flex w-full max-w-7xl flex-col gap-6">
          <section className="space-y-6">
            <div className="rounded-[28px] border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.02)_100%),rgba(7,11,18,0.82)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_40px_120px_-48px_rgba(0,0,0,0.8)] backdrop-blur-[18px]">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="grid gap-3 sm:grid-cols-2 xl:flex xl:flex-1 xl:flex-nowrap">
                  {STEP_ORDER.map((stepName, index) => {
                    const status = stepStatus(stepName, selectedEventId, csvReady, templateReady, hasCertificates);
                    const active = currentStep === stepName;
                    return (
                      <button
                        key={stepName}
                        type="button"
                        onClick={() => {
                          if (status !== 'locked') setStep(stepName);
                        }}
                        disabled={status === 'locked'}
                        className={`min-w-0 rounded-2xl border px-4 py-3 text-left transition xl:flex-1 ${
                          active
                            ? 'border-[var(--apple-accent)] bg-[linear-gradient(180deg,rgba(143,184,255,0.10)_0%,rgba(255,255,255,0.03)_100%),rgba(10,16,27,0.94)]'
                            : 'border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.035)_0%,rgba(255,255,255,0.015)_100%),rgba(9,15,24,0.92)] hover:border-[rgba(143,184,255,0.30)] hover:bg-[linear-gradient(180deg,rgba(143,184,255,0.08)_0%,rgba(255,255,255,0.02)_100%),rgba(10,16,27,0.94)]'
                        } ${status === 'locked' ? 'cursor-not-allowed opacity-50' : ''}`}
                      >
                        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--apple-text-secondary)]">
                          Step {index + 1}
                        </div>
                        <div className={`mt-2 inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase ${
                          status === 'locked'
                            ? 'border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] text-[var(--apple-text-secondary)]'
                            : 'border-[rgba(94,234,212,0.18)] bg-[rgba(16,185,129,0.12)] text-[#7ef0bf]'
                        }`}>
                          {status === 'locked' ? 'Locked' : 'Ready'}
                        </div>
                        <div className="mt-3 text-base font-semibold capitalize text-[var(--apple-text-primary)]">{stepName}</div>
                      </button>
                    );
                  })}
                </div>

                {selectedEvent && (
                  <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.035)_0%,rgba(255,255,255,0.015)_100%),rgba(9,15,24,0.92)] p-4 xl:min-w-[220px]">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--apple-text-secondary)]">Selected Event</p>
                    <p className="mt-2 text-lg font-semibold text-[var(--apple-text-primary)]">{selectedEvent.name}</p>
                    <p className="mt-1 text-sm text-[var(--apple-text-secondary)]">{selectedEvent.event_date || 'Date not set yet'}</p>
                  </div>
                )}
              </div>
            </div>

            <main className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              {currentStep === 'event' && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-2xl font-semibold text-[var(--apple-text-primary)]">1. Choose or create an event</h2>
                    <p className="mt-2 text-sm text-[var(--apple-text-secondary)]">The event anchors your public download page, template, generated certificates, and send history.</p>
                  </div>

                  <form onSubmit={handleCreateEvent} className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-5 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
                    <input
                      value={newEventName}
                      onChange={(e) => {
                        const value = e.target.value;
                        setNewEventName(value);
                        if (!newEventSlugEdited) setNewEventSlug(suggestedSlugFromEventName(value));
                      }}
                      placeholder="Event name"
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-[var(--apple-accent)]"
                    />
                    <input
                      type="date"
                      value={newEventDate}
                      onChange={(e) => setNewEventDate(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-[var(--apple-accent)]"
                    />
                    <input
                      value={newEventSlug}
                      onChange={(e) => {
                        const value = slugify(e.target.value);
                        setNewEventSlug(value);
                        setNewEventSlugEdited(Boolean(value));
                      }}
                      placeholder="Event Code"
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-[var(--apple-accent)]"
                    />
                    <button
                      type="submit"
                      disabled={createEventLoading}
                      className="ventarc-dashboard-primary rounded-xl bg-[var(--apple-accent)] px-5 py-3 font-semibold text-white disabled:opacity-60"
                    >
                      {createEventLoading ? 'Creating...' : 'Create'}
                    </button>
                  </form>

                  <div className="grid gap-4 md:grid-cols-2">
                    {(events || []).map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => {
                          setSelectedEventId(event.id);
                          setDownloadSlugInput(event.download_slug || '');
                          setStep('participants');
                        }}
                        className={`rounded-3xl border p-5 text-left transition ${
                          selectedEventId === event.id
                            ? 'border-[var(--apple-accent)] bg-[var(--apple-accent)]/5'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-lg font-semibold text-[var(--apple-text-primary)]">{event.name}</p>
                            <p className="mt-1 text-sm text-[var(--apple-text-secondary)]">{event.event_date || 'No event date set'}</p>
                          </div>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-[var(--apple-text-secondary)]">
                            {event.certificate_count || 0} certs
                          </span>
                        </div>
                        <p className="mt-4 text-xs uppercase tracking-[0.18em] text-[var(--apple-text-secondary)]">
                          Public page: {event.download_slug ? `/${event.download_slug}` : 'not set'}
                        </p>
                      </button>
                    ))}
                  </div>

                  {selectedEvent && (
                    <form onSubmit={handleSaveSlug} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                      <h3 className="text-lg font-semibold text-[var(--apple-text-primary)]">Public student page</h3>
                      <p className="mt-2 text-sm text-[var(--apple-text-secondary)]">Set the link students will use to find their certificate by name or email.</p>
                      <div className="mt-4 flex flex-col gap-3 md:flex-row">
                        <input
                          value={downloadSlugInput}
                          onChange={(e) => setDownloadSlugInput(slugify(e.target.value))}
                          className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-[var(--apple-accent)]"
                        />
                        <button type="submit" disabled={savingSlug} className="ventarc-dashboard-primary rounded-xl bg-[var(--apple-accent)] px-5 py-3 font-semibold text-white disabled:opacity-60">
                          {savingSlug ? 'Saving...' : 'Save link'}
                        </button>
                      </div>
                      {selectedEvent.download_slug && (
                        <a
                          href={`/${selectedEvent.download_slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 inline-flex text-sm font-medium text-[var(--apple-accent)] hover:underline"
                        >
                          Open student download page
                        </a>
                      )}
                    </form>
                  )}
                </div>
              )}

              {currentStep === 'participants' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-semibold text-[var(--apple-text-primary)]">2. Paste participant CSV</h2>
                    <p className="mt-2 text-sm text-[var(--apple-text-secondary)]">Use one participant per line in the format <code>name,email,category</code>. Email is required because delivery is email-first.</p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-[var(--apple-text-secondary)]">
                      Paste rows directly, or upload a spreadsheet and we will convert the first sheet into the same CSV format.
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        ref={participantFileInputRef}
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        onChange={handleParticipantSpreadsheetChange}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => participantFileInputRef.current?.click()}
                        className="rounded-xl border border-white/[0.10] bg-[linear-gradient(180deg,rgba(255,255,255,0.045)_0%,rgba(255,255,255,0.02)_100%),rgba(10,16,27,0.94)] px-4 py-2.5 text-sm font-semibold text-white transition hover:border-[rgba(143,184,255,0.30)] hover:text-[#8fb8ff]"
                      >
                        Upload Excel / CSV
                      </button>
                    </div>
                  </div>

                  <textarea
                    value={participantCsv}
                    onChange={handleParticipantCsvChange}
                    onPaste={handleParticipantCsvPaste}
                    rows={12}
                    className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 font-mono text-sm outline-none focus:border-[var(--apple-accent)]"
                    placeholder={`Aarav Sharma,aarav@example.com,Winner\nMaya Singh,maya@example.com,Participant`}
                  />

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--apple-text-secondary)]">
                    <div>
                      Auto-saves to <span className="font-semibold text-[var(--apple-text-primary)]">{selectedEvent?.name || 'selected event'}</span>
                      {' '}under <span className="font-semibold text-[var(--apple-text-primary)]">{organization?.name || 'your organization'}</span>.
                    </div>
                    <div className="text-xs">
                      {participantCsvSaving
                        ? 'Saving pasted participants to Convex...'
                        : participantCsvSaveError
                          ? participantCsvSaveError
                          : participantCsvSavedAt
                            ? `Saved to Convex for ${selectedEvent?.name || 'this event'}`
                            : 'Not saved yet'}
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className={`rounded-3xl border p-5 ${csvStatusAppearance.panelClassName}`}>
                      <p className="text-sm font-semibold text-slate-900">
                        {csvStatusAppearance.title}
                      </p>
                      <div className="mt-3 space-y-2 text-sm text-[var(--apple-text-secondary)]">
                        {parsedCsv.errors.length ? (
                          parsedCsv.errors.map((error) => (
                            <div key={`${error.row}-${error.message}`}>Row {error.row}: {error.message}</div>
                          ))
                        ) : !parsedCsv.participants.length ? (
                          <div>No valid participant rows yet.</div>
                        ) : (
                          <div>{parsedCsv.participants.length} valid participant rows.</div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                      <p className="text-sm font-semibold text-[var(--apple-text-primary)]">Step status</p>
                      <div className="mt-3 space-y-2 text-sm text-[var(--apple-text-secondary)]">
                        <div>Selected event: {selectedEvent ? selectedEvent.name : 'None'}</div>
                        <div>Valid rows: {parsedCsv.participants.length}</div>
                        <div>CSV errors: {parsedCsv.errors.length}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStep('template')}
                        disabled={!selectedEventId || !csvReady}
                        className="ventarc-dashboard-primary mt-4 w-full rounded-xl bg-[var(--apple-accent)] px-4 py-3 font-semibold text-white disabled:opacity-50"
                      >
                        Continue to template
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 'template' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-semibold text-[var(--apple-text-primary)]">3. Save the certificate template</h2>
                    <p className="mt-2 text-sm text-[var(--apple-text-secondary)]">The template image and text settings are stored against this event so refreshes and later sends stay in sync.</p>
                  </div>

                  <div className="space-y-6">
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                      <div className="mb-4 flex items-center justify-between">
                        <p className="text-sm font-semibold text-[var(--apple-text-primary)]">Template preview</p>
                        <span className={`text-xs ${renderedTemplatePreviewError ? 'text-red-500' : 'text-[var(--apple-text-secondary)]'}`}>
                          {templatePreviewStatus}
                        </span>
                      </div>
                      {templatePreviewImageUrl && (
                        <div className="mb-4 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(10,16,27,0.96)_0%,rgba(9,15,24,0.92)_100%)] p-3 text-white shadow-[0_18px_55px_-36px_rgba(0,0,0,0.85)]">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                              <p className="text-sm font-semibold">Adjust {selectedTemplateLayer === 'verify' ? 'verify line' : 'recipient name'}</p>
                              <p className="mt-1 text-xs text-white/60">Drag the text directly. Use nudges for tiny mouse-only moves.</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => selectTemplateLayer('name')}
                                className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                                  selectedTemplateLayer === 'name'
                                    ? 'bg-[#8fb8ff] text-[#07101d]'
                                    : 'border border-white/10 bg-white/5 text-white hover:bg-white/10'
                                }`}
                              >
                                Name
                              </button>
                              <button
                                type="button"
                                onClick={() => selectTemplateLayer('verify')}
                                className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                                  selectedTemplateLayer === 'verify'
                                    ? 'bg-[#8fb8ff] text-[#07101d]'
                                    : 'border border-white/10 bg-white/5 text-white hover:bg-white/10'
                                }`}
                              >
                                Verify line
                              </button>
                              <div className="mx-1 hidden h-7 w-px bg-white/10 sm:block" />
                              <button
                                type="button"
                                onClick={() => nudgeTemplateLayer(selectedTemplateLayer, 0, -1)}
                                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
                              >
                                Up
                              </button>
                              <button
                                type="button"
                                onClick={() => nudgeTemplateLayer(selectedTemplateLayer, -1, 0)}
                                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
                              >
                                Left
                              </button>
                              <button
                                type="button"
                                onClick={() => nudgeTemplateLayer(selectedTemplateLayer, 1, 0)}
                                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
                              >
                                Right
                              </button>
                              <button
                                type="button"
                                onClick={() => nudgeTemplateLayer(selectedTemplateLayer, 0, 1)}
                                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
                              >
                                Down
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                        {templatePreviewImageUrl ? (
                          <div ref={templatePreviewContainerRef} className="relative select-none">
                            <img
                              ref={templatePreviewImageRef}
                              src={templatePreviewImageUrl}
                              alt="Certificate template"
                              className="w-full"
                              onLoad={handlePreviewImageLoad}
                              draggable={false}
                            />
                            <div
                              role="button"
                              aria-label="Adjust recipient name placement"
                              tabIndex={0}
                              onPointerDown={(event) => {
                                beginTemplateDrag(event, 'name');
                              }}
                              onClick={() => selectTemplateLayer('name')}
                              onKeyDown={(event) => {
                                const step = event.shiftKey ? 0.02 : 0.01;
                                if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
                                event.preventDefault();
                                selectTemplateLayer('name');
                                setLiveTemplatePreviewActive(true);
                                setTemplateSettings((current) => ({
                                  ...current,
                                  text_x: clampUnit(current.text_x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0)),
                                  text_y: clampUnit(current.text_y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0)),
                                }));
                              }}
                              className={`absolute text-center font-semibold transition ${
                                dragTarget === 'name'
                                  ? 'opacity-100'
                                  : 'opacity-95 hover:opacity-100'
                              } ${selectedTemplateLayer === 'name' ? 'drop-shadow-[0_0_14px_rgba(143,184,255,0.45)]' : ''}`}
                              style={{
                                left: `${templateSettings.text_x * 100}%`,
                                top: `${templateSettings.text_y * 100}%`,
                                transform: 'translate(-50%, -50%)',
                                cursor: dragTarget === 'name' ? 'grabbing' : 'grab',
                                touchAction: 'none',
                                ...(!showLiveTemplateText
                                  ? {
                                      width: `${Math.max(templateSettings.font_size * previewScale * 6.2, 150)}px`,
                                      height: `${Math.max(templateSettings.font_size * previewScale * 1.55, 44)}px`,
                                    }
                                  : {
                                      fontSize: `${Math.max(templateSettings.font_size * previewScale, 10)}px`,
                                      color: templateSettings.font_color,
                                      fontFamily: templateSettings.font_family || 'Georgia, serif',
                                      fontWeight: 700,
                                      lineHeight: 1.1,
                                      whiteSpace: 'nowrap',
                                    }),
                              }}
                            >
                              {showLiveTemplateText ? 'Elon Musk' : null}
                            </div>
                            <div
                              role="button"
                              aria-label="Adjust verify line placement"
                              tabIndex={0}
                              onPointerDown={(event) => {
                                beginTemplateDrag(event, 'verify');
                              }}
                              onClick={() => selectTemplateLayer('verify')}
                              onKeyDown={(event) => {
                                const step = event.shiftKey ? 0.02 : 0.01;
                                if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
                                event.preventDefault();
                                selectTemplateLayer('verify');
                                setLiveTemplatePreviewActive(true);
                                setTemplateSettings((current) => ({
                                  ...current,
                                  verify_line_x: clampUnit(current.verify_line_x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0)),
                                  verify_line_y: clampUnit(current.verify_line_y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0)),
                                }));
                              }}
                              className={`absolute text-center transition ${
                                dragTarget === 'verify'
                                  ? 'opacity-100'
                                  : 'opacity-92 hover:opacity-100'
                              } ${selectedTemplateLayer === 'verify' ? 'drop-shadow-[0_0_12px_rgba(143,184,255,0.4)]' : ''}`}
                              style={{
                                left: `${templateSettings.verify_line_x * 100}%`,
                                top: `${templateSettings.verify_line_y * 100}%`,
                                transform: 'translate(-50%, -50%)',
                                cursor: dragTarget === 'verify' ? 'grabbing' : 'grab',
                                touchAction: 'none',
                                ...(!showLiveTemplateText
                                  ? {
                                      width: `${Math.max(templateSettings.verify_line_size * previewScale * 64, 240)}px`,
                                      height: `${Math.max(templateSettings.verify_line_size * previewScale * 2.8, 32)}px`,
                                    }
                                  : {
                                      fontSize: `${Math.max(templateSettings.verify_line_size * previewScale, 8)}px`,
                                      color: templateSettings.verify_line_color,
                                      fontFamily: templateSettings.verify_line_font || "'Inter', sans-serif",
                                      fontWeight: 400,
                                      whiteSpace: 'nowrap',
                                      lineHeight: 1.15,
                                    }),
                              }}
                            >
                              {showLiveTemplateText ? templateSettings.verify_line_text.replace('{certificate_id}', 'CV-2026-SAMPLE') : null}
                            </div>
                            {showTemplateOverlay && (
                              <div
                                className="absolute z-20 w-[280px] rounded-2xl border border-[rgba(143,184,255,0.30)] bg-[linear-gradient(180deg,rgba(10,16,27,0.96)_0%,rgba(9,15,24,0.92)_100%)] p-4 text-white shadow-[0_24px_80px_-30px_rgba(0,0,0,0.85)] backdrop-blur-xl"
                                style={{
                                  left: `${overlayLeft}px`,
                                  top: `${overlayTop}%`,
                                  transform: 'translate(-50%, 0)',
                                }}
                                onPointerDown={() => setShowTemplateOverlay(true)}
                                onMouseMove={() => setShowTemplateOverlay(true)}
                              >
                                <div className="mb-3 flex items-center justify-between gap-3">
                                  <div>
                                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8fb8ff]">
                                      On-template controls
                                    </div>
                                    <div className="mt-1 text-sm font-semibold text-white">
                                      {selectedTemplateLayer === 'verify' ? 'Verify line' : 'Recipient name'}
                                    </div>
                                  </div>
                                  <div className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">
                                    Auto-hides in 3s
                                  </div>
                                </div>

                                {selectedTemplateLayer === 'name' ? (
                                  <div className="space-y-3">
                                    <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-white/75">
                                      Font
                                      <select
                                        value={templateSettings.font_family}
                                        onChange={(e) => {
                                          setShowTemplateOverlay(true);
                                          setTemplateSettings((current) => ({ ...current, font_family: e.target.value }));
                                        }}
                                        className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[var(--apple-accent)]"
                                      >
                                        {CERTIFICATE_FONTS.map((font) => (
                                          <option key={font.value} value={font.value}>{font.name}</option>
                                        ))}
                                      </select>
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                      <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-white/75">
                                        X
                                        <input
                                          type="range"
                                          min="0.1"
                                          max="0.9"
                                          step="0.005"
                                          value={templateSettings.text_x}
                                          onChange={(e) => {
                                            setShowTemplateOverlay(true);
                                            setTemplateSettings((current) => ({ ...current, text_x: Number(e.target.value) }));
                                          }}
                                          className="mt-2 w-full"
                                        />
                                        <span className="mt-1 block text-[11px] text-white/60">{Math.round(templateSettings.text_x * 100)}%</span>
                                      </label>
                                      <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-white/75">
                                        Y
                                        <input
                                          type="range"
                                          min="0.1"
                                          max="0.9"
                                          step="0.005"
                                          value={templateSettings.text_y}
                                          onChange={(e) => {
                                            setShowTemplateOverlay(true);
                                            setTemplateSettings((current) => ({ ...current, text_y: Number(e.target.value) }));
                                          }}
                                          className="mt-2 w-full"
                                        />
                                        <span className="mt-1 block text-[11px] text-white/60">{Math.round(templateSettings.text_y * 100)}%</span>
                                      </label>
                                    </div>
                                    <div className="grid grid-cols-[1fr_auto] gap-3">
                                      <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-white/75">
                                        Size
                                        <input
                                          type="range"
                                          min="24"
                                          max="120"
                                          step="1"
                                          value={templateSettings.font_size}
                                          onChange={(e) => {
                                            setShowTemplateOverlay(true);
                                            setTemplateSettings((current) => ({ ...current, font_size: Number(e.target.value) }));
                                          }}
                                          className="mt-2 w-full"
                                        />
                                        <span className="mt-1 block text-[11px] text-white/60">{templateSettings.font_size}px</span>
                                      </label>
                                      <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-white/75">
                                        Color
                                        <input
                                          type="color"
                                          value={templateSettings.font_color}
                                          onChange={(e) => {
                                            setShowTemplateOverlay(true);
                                            setTemplateSettings((current) => ({ ...current, font_color: e.target.value }));
                                          }}
                                          className="mt-2 h-11 w-16 rounded-xl border border-white/10 bg-white/5 px-2 py-1"
                                        />
                                      </label>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-white/75">
                                      Verify text
                                      <input
                                        value={templateSettings.verify_line_text}
                                        onChange={(e) => {
                                          setShowTemplateOverlay(true);
                                          setTemplateSettings((current) => ({ ...current, verify_line_text: e.target.value }));
                                        }}
                                        className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-[var(--apple-accent)]"
                                      />
                                    </label>
                                    <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-white/75">
                                      Font
                                      <select
                                        value={templateSettings.verify_line_font}
                                        onChange={(e) => {
                                          setShowTemplateOverlay(true);
                                          setTemplateSettings((current) => ({ ...current, verify_line_font: e.target.value }));
                                        }}
                                        className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[var(--apple-accent)]"
                                      >
                                        {CERTIFICATE_FONTS.map((font) => (
                                          <option key={`verify-${font.value}`} value={font.value}>{font.name}</option>
                                        ))}
                                      </select>
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                      <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-white/75">
                                        X
                                        <input
                                          type="range"
                                          min="0.05"
                                          max="0.95"
                                          step="0.005"
                                          value={templateSettings.verify_line_x}
                                          onChange={(e) => {
                                            setShowTemplateOverlay(true);
                                            setTemplateSettings((current) => ({ ...current, verify_line_x: Number(e.target.value) }));
                                          }}
                                          className="mt-2 w-full"
                                        />
                                        <span className="mt-1 block text-[11px] text-white/60">{Math.round(templateSettings.verify_line_x * 100)}%</span>
                                      </label>
                                      <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-white/75">
                                        Y
                                        <input
                                          type="range"
                                          min="0.05"
                                          max="0.98"
                                          step="0.005"
                                          value={templateSettings.verify_line_y}
                                          onChange={(e) => {
                                            setShowTemplateOverlay(true);
                                            setTemplateSettings((current) => ({ ...current, verify_line_y: Number(e.target.value) }));
                                          }}
                                          className="mt-2 w-full"
                                        />
                                        <span className="mt-1 block text-[11px] text-white/60">{Math.round(templateSettings.verify_line_y * 100)}%</span>
                                      </label>
                                    </div>
                                    <div className="grid grid-cols-[1fr_auto] gap-3">
                                      <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-white/75">
                                        Size
                                        <input
                                          type="range"
                                          min="8"
                                          max="48"
                                          step="1"
                                          value={templateSettings.verify_line_size}
                                          onChange={(e) => {
                                            setShowTemplateOverlay(true);
                                            setTemplateSettings((current) => ({ ...current, verify_line_size: Number(e.target.value) }));
                                          }}
                                          className="mt-2 w-full"
                                        />
                                        <span className="mt-1 block text-[11px] text-white/60">{templateSettings.verify_line_size}px</span>
                                      </label>
                                      <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-white/75">
                                        Color
                                        <input
                                          type="color"
                                          value={templateSettings.verify_line_color}
                                          onChange={(e) => {
                                            setShowTemplateOverlay(true);
                                            setTemplateSettings((current) => ({ ...current, verify_line_color: e.target.value }));
                                          }}
                                          className="mt-2 h-11 w-16 rounded-xl border border-white/10 bg-white/5 px-2 py-1"
                                        />
                                      </label>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex h-[420px] items-center justify-center text-sm text-[var(--apple-text-secondary)]">
                            Upload a template to preview it here.
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setStep('generate')}
                        disabled={!templateReady || !csvReady}
                        className="ventarc-dashboard-primary mt-4 rounded-xl bg-[var(--apple-accent)] px-5 py-3 font-semibold text-white disabled:opacity-50"
                      >
                        Continue to generate
                      </button>
                      {templateContinueReason && (
                        <p className="mt-3 text-sm text-[var(--apple-text-secondary)]">
                          {templateContinueReason}
                        </p>
                      )}
                    </div>

                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                        <label className="block text-sm font-semibold text-[var(--apple-text-primary)]">Template image</label>
                        <input
                          ref={templateFileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleTemplateFileChange}
                          className="hidden"
                        />
                        <div
                          onDragOver={handleTemplateDragOver}
                          onDragEnter={handleTemplateDragOver}
                          onDragLeave={handleTemplateDragLeave}
                          onDrop={handleTemplateDrop}
                          onClick={() => templateFileInputRef.current?.click()}
                          className={`mt-3 cursor-pointer rounded-2xl border-2 border-dashed px-5 py-6 transition ${
                            isTemplateDropActive
                              ? 'border-[var(--apple-accent)] bg-[linear-gradient(180deg,rgba(143,184,255,0.10)_0%,rgba(255,255,255,0.03)_100%),rgba(10,16,27,0.94)]'
                              : 'border-[rgba(255,255,255,0.10)] bg-[linear-gradient(180deg,rgba(255,255,255,0.045)_0%,rgba(255,255,255,0.02)_100%),rgba(10,16,27,0.94)] hover:border-[rgba(143,184,255,0.30)] hover:bg-[linear-gradient(180deg,rgba(143,184,255,0.08)_0%,rgba(255,255,255,0.03)_100%),rgba(10,16,27,0.96)]'
                          }`}
                        >
                          {templatePreviewUrl ? (
                            <div className="flex items-center justify-between gap-4">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-[var(--apple-text-primary)]">
                                  {selectedTemplateName || 'Saved event template'}
                                </p>
                                <p className="mt-1 text-xs text-[var(--apple-text-secondary)]">
                                  Template saved. Click to replace it.
                                </p>
                              </div>
                              <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] text-[var(--apple-accent)]">
                                <span className="material-symbols-outlined text-[22px]">edit</span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center text-center">
                              <div className="mb-3 rounded-full border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] p-3 text-[var(--apple-accent)]">
                                <span className="material-symbols-outlined text-[28px]">upload_file</span>
                              </div>
                              <p className="text-sm font-semibold text-[var(--apple-text-primary)]">
                                Drag and drop your template here
                              </p>
                              <p className="mt-1 text-sm text-[var(--apple-text-secondary)]">
                                or click to choose a PNG, JPG, or SVG
                              </p>
                              <p className="mt-3 text-xs text-[var(--apple-text-secondary)]">
                                No file selected
                              </p>
                            </div>
                          )}
                        </div>
                        <p className="mt-3 text-xs text-[var(--apple-text-secondary)]">PNG and JPEG work best. The uploaded template is saved to cloud storage and reused during generation.</p>
                      </div>

                      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                        <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.035)_0%,rgba(255,255,255,0.015)_100%),rgba(9,15,24,0.92)] px-4 py-3 text-xs font-medium text-[var(--apple-text-secondary)]">
                          Click the name or verify line on the preview to open an on-template settings overlay right where you are editing.
                        </div>
                        <div className="mt-4 space-y-3 text-sm text-[var(--apple-text-secondary)]">
                          <div>1. Click the large recipient name to edit its font, color, size, and position.</div>
                          <div>2. Click the verify line to edit its text, font, color, size, and position.</div>
                          <div>3. Drag either text element directly on the preview to reposition it.</div>
                          <div>4. Use arrow keys after selecting a text layer for fine movement.</div>
                          <div>5. The selected layer glows so you can see which overlay controls are active.</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 'generate' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-semibold text-[var(--apple-text-primary)]">4. Generate IDs and PDFs</h2>
                    <p className="mt-2 text-sm text-[var(--apple-text-secondary)]">This creates the certificate records, generates unique IDs, and uploads the PDFs for later email delivery.</p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--apple-text-secondary)]">Participants</div>
                      <div className="mt-3 text-3xl font-semibold text-[var(--apple-text-primary)]">{parsedCsv.participants.length}</div>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--apple-text-secondary)]">Template</div>
                      <div className="mt-3 text-sm font-semibold text-[var(--apple-text-primary)]">{templateReady ? 'Saved to event' : 'Missing'}</div>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--apple-text-secondary)]">Public verify link</div>
                      <div className="mt-3 break-all text-sm font-medium text-[var(--apple-text-primary)]">{defaultVerifyLine()}</div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={generateLoading || !csvReady || !templateReady}
                    className="ventarc-dashboard-primary rounded-xl bg-[var(--apple-accent)] px-6 py-3 font-semibold text-white disabled:opacity-50"
                  >
                    {generateLoading ? 'Generating certificates...' : 'Generate certificates + PDFs'}
                  </button>

                  {generateResult && (
                    <div className={`rounded-3xl border p-5 ${generateResult.success ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                      <p className="text-sm font-semibold text-[var(--apple-text-primary)]">
                        {generateResult.success
                          ? generateResult.message || `Generated ${generateResult.generated} certificates and ${generateResult.pdfsGenerated || 0} PDFs`
                          : generateResult.error}
                      </p>
                      {generateResult.errors?.length > 0 && (
                        <div className="mt-3 space-y-1 text-sm text-[var(--apple-text-secondary)]">
                          {generateResult.errors.map((error, index) => (
                            <div key={`${error.row || index}-${error.error}`}>Row {error.row || index + 1}: {error.error}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-[var(--apple-text-primary)]">Certificates for this event</h3>
                        <p className="mt-1 text-sm text-[var(--apple-text-secondary)]">
                          {certificatesLoading
                            ? 'Loading certificates...'
                            : `${certificates.length} certificate${certificates.length === 1 ? '' : 's'} generated`}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleRegenerateAllPdfs}
                          disabled={regenerateAllPdfsLoading || !templateReady || certificates.length === 0}
                          className="rounded-xl border border-white/[0.10] bg-[linear-gradient(180deg,rgba(255,255,255,0.045)_0%,rgba(255,255,255,0.02)_100%),rgba(10,16,27,0.94)] px-4 py-2 text-sm font-semibold text-white transition hover:border-[rgba(143,184,255,0.30)] hover:text-[#8fb8ff] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {regenerateAllPdfsLoading ? 'Regenerating PDFs...' : 'Regenerate all PDFs'}
                        </button>
                        {selectedEvent?.download_slug && (
                          <a
                            href={`/${selectedEvent.download_slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl border border-white/[0.10] bg-[linear-gradient(180deg,rgba(255,255,255,0.045)_0%,rgba(255,255,255,0.02)_100%),rgba(10,16,27,0.94)] px-4 py-2 text-sm font-semibold text-white no-underline transition hover:border-[rgba(143,184,255,0.30)] hover:text-[#8fb8ff]"
                          >
                            Open public page
                          </a>
                        )}
                      </div>
                    </div>

                    {certificates.length > 0 ? (
                      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                        <div className="grid grid-cols-[minmax(180px,1.3fr)_minmax(160px,1fr)_minmax(150px,1fr)_auto] gap-3 border-b border-slate-200 bg-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                          <div>Recipient</div>
                          <div>Certificate ID</div>
                          <div>Status</div>
                          <div className="text-right">Actions</div>
                        </div>
                        <div className="divide-y divide-slate-200">
                          {certificates.map((cert) => {
                            const readiness = getCertificateReadiness(cert);
                            return (
                              <div
                                key={cert.id || cert.certificate_id}
                                className="grid grid-cols-[minmax(180px,1.3fr)_minmax(160px,1fr)_minmax(150px,1fr)_auto] gap-3 px-4 py-3 text-sm"
                              >
                                <div className="min-w-0">
                                  <div className="truncate font-semibold text-[var(--apple-text-primary)]">{cert.recipient_name}</div>
                                  <div className="truncate text-xs text-[var(--apple-text-secondary)]">{cert.recipient_email}</div>
                                </div>
                                <div className="break-all font-medium text-[var(--apple-text-primary)]">{cert.certificate_id}</div>
                                <div>
                                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${readiness.className}`}>
                                    {readiness.label}
                                  </span>
                                </div>
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCertificate(cert.certificate_id)}
                                    disabled={deletingCertificateId === cert.certificate_id}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                                    aria-label={`Delete certificate ${cert.certificate_id}`}
                                    title="Delete certificate"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">
                                      {deletingCertificateId === cert.certificate_id ? 'hourglass_top' : 'delete'}
                                    </span>
                                  </button>
                                  <a
                                    href={`/certvault/verify?id=${encodeURIComponent(cert.certificate_id)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-[var(--apple-text-primary)] no-underline"
                                  >
                                    Verify
                                  </a>
                                  {cert.pdf_url && (
                                    <a
                                      href={pdfDownloadUrl(cert.pdf_url, true)}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="rounded-lg bg-[var(--apple-accent)] px-3 py-2 text-xs font-semibold text-white no-underline"
                                    >
                                      PDF
                                    </a>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-dashed border-white/[0.14] bg-[#0a0f16]/80 px-4 py-8 text-center text-sm text-white/70">
                        Generated certificates will appear here.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {currentStep === 'send' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-semibold text-[var(--apple-text-primary)]">5. Send certificates</h2>
                    <p className="mt-2 text-sm text-[var(--apple-text-secondary)]">
                      Configure the sender account and email generated PDFs to eligible recipients.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-3xl border border-white/[0.10] bg-[#0a0f16]/85 p-5">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8aa9d2]">Total</div>
                      <div className="mt-3 text-3xl font-semibold text-white">{sendSummary.total}</div>
                    </div>
                    <div className="rounded-3xl border border-white/[0.10] bg-[#0a0f16]/85 p-5">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8aa9d2]">Sent</div>
                      <div className="mt-3 text-3xl font-semibold text-white">{sendSummary.sent}</div>
                    </div>
                    <div className="rounded-3xl border border-white/[0.10] bg-[#0a0f16]/85 p-5">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8aa9d2]">Failed</div>
                      <div className="mt-3 text-3xl font-semibold text-white">{sendSummary.failed}</div>
                    </div>
                  </div>

                  <form onSubmit={handleSaveMailerConfig} className="rounded-3xl border border-white/[0.10] bg-[#0a0f16]/85 p-5">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                      <label className="block text-sm font-semibold text-white">
                        Sender email
                        <input
                          type="email"
                          value={mailerConfig.mailer_email}
                          onChange={(event) => setMailerConfig((current) => ({ ...current, mailer_email: event.target.value }))}
                          className="mt-2 w-full rounded-xl border border-white/[0.12] bg-white/[0.06] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[var(--apple-accent)]"
                          placeholder="info@example.com"
                        />
                      </label>
                      <label className="block text-sm font-semibold text-white">
                        Sender name
                        <input
                          value={mailerConfig.mailer_from_name}
                          onChange={(event) => setMailerConfig((current) => ({ ...current, mailer_from_name: event.target.value }))}
                          className="mt-2 w-full rounded-xl border border-white/[0.12] bg-white/[0.06] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[var(--apple-accent)]"
                          placeholder={organization?.name || 'CertVault'}
                        />
                      </label>
                      <label className="block text-sm font-semibold text-white">
                        Gmail app password
                        <input
                          type="password"
                          value={mailerConfig.mailer_app_password}
                          onChange={(event) => setMailerConfig((current) => ({ ...current, mailer_app_password: event.target.value }))}
                          className="mt-2 w-full rounded-xl border border-white/[0.12] bg-white/[0.06] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[var(--apple-accent)]"
                          placeholder={mailerConfig.has_mailer_app_password ? 'Saved' : 'App password'}
                        />
                      </label>
                      <div className="flex items-end">
                        <button
                          type="submit"
                          disabled={mailerLoading}
                          className="w-full rounded-xl border border-white/[0.14] bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:opacity-60"
                        >
                          {mailerLoading ? 'Saving...' : 'Save sender'}
                        </button>
                      </div>
                    </div>
                  </form>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={handleSendCertificates}
                      disabled={sendLoading || sendSummary.eligible === 0 || !mailerConfig.mailer_email || !mailerConfig.has_mailer_app_password}
                      className="ventarc-dashboard-primary rounded-xl bg-[var(--apple-accent)] px-6 py-3 font-semibold text-white disabled:opacity-50"
                    >
                      {sendLoading ? 'Sending certificates...' : 'Send certificates'}
                    </button>
                    <p className="text-sm text-[var(--apple-text-secondary)]">
                      {mailerConfig.has_mailer_app_password ? 'Sender password saved.' : 'Save a Gmail app password before sending.'}
                    </p>
                  </div>

                  {(sendLoading || sendProgress.current > 0 || sendResult) && (
                    <div className="rounded-3xl border border-white/[0.10] bg-[#0a0f16]/85 p-5">
                      <div className="mb-3 flex items-center justify-between gap-4 text-sm">
                        <span className="font-semibold text-white">{sendProgress.phase || 'Ready to send'}</span>
                        <span className="font-semibold text-[#8aa9d2]">
                          {sendProgress.current}/{sendProgress.total || sendSummary.eligible}
                        </span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-white/[0.08]">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,#3b82f6,#8fb8ff)] transition-all duration-300"
                          style={{ width: `${sendProgressPercent}%` }}
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-[#8aa9d2]">
                        <span>Sent {sendProgress.sent}</span>
                        <span>Failed {sendProgress.failed}</span>
                      </div>
                      {sendProgress.provider === 'gmail' && sendProgress.delayMs > 0 && (
                        <div className="mt-3 text-xs text-[#9fb0c7]">
                          Gmail pacing is enabled: waiting about {Math.ceil(sendProgress.delayMs / 1000)}s between emails to stay under provider limits.
                        </div>
                      )}
                      {sendProgress.limitReached && (
                        <div className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                          Gmail sending limit reached. Wait before retrying, or switch to Brevo for higher-volume sends.
                        </div>
                      )}
                    </div>
                  )}

                  {sendResult && (
                    <div className={`rounded-3xl border p-5 ${sendResult.success ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                      <p className="text-sm font-semibold text-slate-900">
                        {sendResult.success
                          ? sendResult.limit_reached
                            ? `Gmail sending limit reached after ${sendResultSentCount} successful send${sendResultSentCount === 1 ? '' : 's'}${sendResultFailedCount ? `, ${sendResultFailedCount} failed` : ''}`
                            : `Sent ${sendResultSentCount} certificates${sendResultFailedCount ? `, ${sendResultFailedCount} failed` : ''}`
                          : sendResult.error || 'Could not send certificates'}
                      </p>
                    </div>
                  )}

                  <div className="rounded-3xl border border-white/[0.10] bg-[#0a0f16]/85 p-5">
                    <h3 className="text-lg font-semibold text-white">Delivery status</h3>
                    {certificates.length > 0 ? (
                      <div className="mt-4 overflow-hidden rounded-2xl border border-white/[0.10] bg-[#070b12]">
                        <div className="grid grid-cols-[minmax(180px,1.3fr)_minmax(160px,1fr)_minmax(150px,1fr)_auto] gap-3 border-b border-white/[0.10] bg-white/[0.06] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#8aa9d2]">
                          <div>Recipient</div>
                          <div>Certificate ID</div>
                          <div>Delivery</div>
                          <div className="text-right">PDF</div>
                        </div>
                        <div className="divide-y divide-white/[0.08]">
                          {certificates.map((cert) => {
                            const delivery = getDeliveryStatusAppearance(cert.email_send_status);
                            return (
                              <div
                                key={`send-${cert.id || cert.certificate_id}`}
                                className="grid grid-cols-[minmax(180px,1.3fr)_minmax(160px,1fr)_minmax(150px,1fr)_auto] gap-3 px-4 py-3 text-sm"
                              >
                                <div className="min-w-0">
                                  <div className="truncate font-semibold text-white">{cert.recipient_name}</div>
                                  <div className="truncate text-xs text-[#9fb0c7]">{cert.recipient_email}</div>
                                </div>
                                <div className="break-all font-medium text-white">{cert.certificate_id}</div>
                                <div>
                                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${delivery.className}`}>
                                    {delivery.label}
                                  </span>
                                </div>
                                <div className="flex justify-end">
                                  {cert.pdf_url ? (
                                    <a
                                      href={pdfDownloadUrl(cert.pdf_url, true)}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="rounded-lg bg-[var(--apple-accent)] px-3 py-2 text-xs font-semibold text-white no-underline"
                                    >
                                      PDF
                                    </a>
                                  ) : (
                                    <span className="text-xs font-semibold text-slate-400">Missing</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-dashed border-white/[0.14] bg-[#0a0f16]/80 px-4 py-8 text-center text-sm text-white/70">
                        Generate certificates before sending.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </main>
          </section>
        </div>
      </div>
    </div>
  );
}
