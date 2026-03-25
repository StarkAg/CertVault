import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import CertVaultLayout from './CertVaultLayout';
import { supabase } from '../lib/supabase';
import { compressTemplateImage } from '../utils/certvaultCompress';
import { pdfDownloadUrl } from '../utils/certvaultPdfUrl';
import { certVaultTheme as theme } from '../theme';

const API_BASE = '/api/certvault';
const PENDING_ORG_NAME_KEY = 'certvault_pending_org_name';
const STEP_ORDER = ['event', 'participants', 'template', 'generate', 'send'];
const CERTIFICATE_FONTS = [
  { name: 'Georgia', value: 'Georgia, serif' },
  { name: 'Times New Roman', value: "'Times New Roman', Times, serif" },
  { name: 'Arial', value: 'Arial, sans-serif' },
  { name: 'Helvetica', value: 'Helvetica, sans-serif' },
  { name: 'Courier New', value: "'Courier New', monospace" },
  { name: 'Playfair Display', value: "'Playfair Display', serif" },
  { name: 'Merriweather', value: "'Merriweather', serif" },
  { name: 'Lora', value: "'Lora', serif" },
  { name: 'Source Serif 4', value: "'Source Serif 4', serif" },
  { name: 'Crimson Text', value: "'Crimson Text', serif" },
  { name: 'Libre Baskerville', value: "'Libre Baskerville', serif" },
  { name: 'EB Garamond', value: "'EB Garamond', serif" },
  { name: 'Inter', value: "'Inter', sans-serif" },
  { name: 'Roboto', value: "'Roboto', sans-serif" },
  { name: 'Open Sans', value: "'Open Sans', sans-serif" },
  { name: 'Source Sans 3', value: "'Source Sans 3', sans-serif" },
  { name: 'Work Sans', value: "'Work Sans', sans-serif" },
  { name: 'DM Sans', value: "'DM Sans', sans-serif" },
  { name: 'Plus Jakarta Sans', value: "'Plus Jakarta Sans', sans-serif" },
  { name: 'Outfit', value: "'Outfit', sans-serif" },
  { name: 'Manrope', value: "'Manrope', sans-serif" },
  { name: 'Sora', value: "'Sora', sans-serif" },
  { name: 'Lexend', value: "'Lexend', sans-serif" },
  { name: 'JetBrains Mono', value: "'JetBrains Mono', monospace" },
  { name: 'Fira Code', value: "'Fira Code', monospace" },
  { name: 'Source Code Pro', value: "'Source Code Pro', monospace" },
  { name: 'IBM Plex Mono', value: "'IBM Plex Mono', monospace" },
  { name: 'Inconsolata', value: "'Inconsolata', monospace" },
  { name: 'Bebas Neue', value: "'Bebas Neue', sans-serif" },
  { name: 'Oswald', value: "'Oswald', sans-serif" },
  { name: 'Raleway', value: "'Raleway', sans-serif" },
  { name: 'Montserrat', value: "'Montserrat', sans-serif" },
  { name: 'Poppins', value: "'Poppins', sans-serif" },
  { name: 'Quicksand', value: "'Quicksand', sans-serif" },
  { name: 'Archivo', value: "'Archivo', sans-serif" },
  { name: 'Nunito', value: "'Nunito', sans-serif" },
  { name: 'Space Grotesk', value: "'Space Grotesk', sans-serif" },
];

function defaultVerifyLine() {
  if (typeof window === 'undefined') {
    return 'Verify this certificate at /verify?id={certificate_id}';
  }
  return `Verify this certificate at ${window.location.origin}/verify?id={certificate_id}`;
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

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
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

export default function CertVaultDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [authToken, setAuthToken] = useState(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState(null);
  const [needSignup, setNeedSignup] = useState(false);
  const [completeSignupName, setCompleteSignupName] = useState('');
  const [completeSignupLoading, setCompleteSignupLoading] = useState(false);
  const [completeSignupError, setCompleteSignupError] = useState('');
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [eventsLoading, setEventsLoading] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventSlug, setNewEventSlug] = useState('');
  const [createEventLoading, setCreateEventLoading] = useState(false);
  const [downloadSlugInput, setDownloadSlugInput] = useState('');
  const [savingSlug, setSavingSlug] = useState(false);
  const [participantCsv, setParticipantCsv] = useState('');
  const [templateSettings, setTemplateSettings] = useState(defaultTemplateSettings());
  const [templateAssetUrl, setTemplateAssetUrl] = useState('');
  const [templatePreviewUrl, setTemplatePreviewUrl] = useState('');
  const [selectedTemplateName, setSelectedTemplateName] = useState('');
  const [templateSaving, setTemplateSaving] = useState(false);
  const [isTemplateDropActive, setIsTemplateDropActive] = useState(false);
  const [previewMetrics, setPreviewMetrics] = useState({ naturalWidth: 0, renderedWidth: 0 });
  const [dragTarget, setDragTarget] = useState('');
  const [configLoaded, setConfigLoaded] = useState(false);
  const [certificates, setCertificates] = useState([]);
  const [certificatesLoading, setCertificatesLoading] = useState(false);
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
  const [sendSummary, setSendSummary] = useState({ total: 0, sent: 0, failed: 0, eligible: 0 });
  const autoSaveRef = useRef(false);
  const templateFileInputRef = useRef(null);
  const templatePreviewContainerRef = useRef(null);
  const templatePreviewImageRef = useRef(null);

  const token = authToken || (typeof window !== 'undefined' ? localStorage.getItem('certvault_club_token') : null);
  const selectedEvent = events.find((event) => event.id === selectedEventId) || null;
  const parsedCsv = useMemo(() => parseParticipantCsv(participantCsv), [participantCsv]);
  const currentStep = searchParams.get('step') || 'event';
  const csvReady = parsedCsv.participants.length > 0 && parsedCsv.errors.length === 0;
  const templateReady = Boolean(templateAssetUrl || templatePreviewUrl);
  const hasCertificates = certificates.length > 0;
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
    if (!eventId) {
      setParticipantCsv('');
      setTemplateAssetUrl('');
      setTemplatePreviewUrl('');
      setSelectedTemplateName('');
      setTemplateSettings(defaultTemplateSettings());
      setConfigLoaded(false);
      return;
    }

    const res = await fetchWithAuth(`${API_BASE}?action=template-config&eventId=${encodeURIComponent(eventId)}`);
    const data = await res.json();
    if (!data.success) return;

    autoSaveRef.current = false;
    const settings = {
      ...defaultTemplateSettings(),
      ...(data.config?.template_settings || {}),
    };
    setParticipantCsv(data.config?.participant_csv || '');
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

  async function saveTemplateConfig(payload = {}) {
    if (!selectedEventId) return null;
    setTemplateSaving(true);
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
          setTemplateSettings({
            ...defaultTemplateSettings(),
            ...data.config.template_settings,
          });
        }
      }
      return data;
    } finally {
      setTemplateSaving(false);
    }
  }

  useEffect(() => {
    if (!supabase) {
      const legacy = typeof window !== 'undefined' ? localStorage.getItem('certvault_club_token') : null;
      setAuthToken(legacy || '');
      setAuthResolved(true);
      return;
    }

    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      setAuthToken(session?.access_token || (typeof window !== 'undefined' ? localStorage.getItem('certvault_club_token') : null) || '');
      setAuthResolved(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setAuthToken(session?.access_token || (typeof window !== 'undefined' ? localStorage.getItem('certvault_club_token') : null) || '');
      setAuthResolved(true);
    });

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
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
          setNeedSignup(false);
          await Promise.all([loadEvents(), loadMailerConfig()]);
        } else if (data.needSignup && data.email) {
          setNeedSignup(true);
          setCompleteSignupName(typeof window !== 'undefined' ? localStorage.getItem(PENDING_ORG_NAME_KEY) || '' : '');
        } else {
          if (supabase) supabase.auth.signOut();
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

    const timeout = setTimeout(() => {
      saveTemplateConfig({
        participant_csv: participantCsv,
        template_settings: templateSettings,
      });
    }, 700);

    return () => clearTimeout(timeout);
  }, [participantCsv, templateSettings, configLoaded, selectedEventId]);

  async function handleCompleteSignup(e) {
    e.preventDefault();
    setCompleteSignupLoading(true);
    setCompleteSignupError('');

    try {
      const res = await fetchWithAuth(`${API_BASE}?action=ensure-org`, {
        method: 'POST',
        body: JSON.stringify({ name: completeSignupName.trim() }),
      });
      const data = await res.json();
      if (!data.success) {
        setCompleteSignupError(data.error || 'Could not create organization');
        return;
      }
      setOrganization(data.organization);
      setNeedSignup(false);
      localStorage.removeItem(PENDING_ORG_NAME_KEY);
      await Promise.all([loadEvents(), loadMailerConfig()]);
    } finally {
      setCompleteSignupLoading(false);
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
          download_slug: slugify(newEventSlug || newEventName),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNewEventName('');
        setNewEventDate('');
        setNewEventSlug('');
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
    if (!templatePreviewUrl) return;

    function handleResize() {
      handlePreviewImageLoad();
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [templatePreviewUrl]);

  useEffect(() => {
    if (!dragTarget) return undefined;

    function handlePointerMove(event) {
      updateDraggedPosition(event.clientX, event.clientY, dragTarget);
    }

    function handlePointerUp() {
      setDragTarget('');
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    document.body.style.cursor = 'grabbing';

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.style.cursor = '';
    };
  }, [dragTarget]);

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
      const inlineTemplate = typeof templatePreviewUrl === 'string' && templatePreviewUrl.startsWith('data:')
        ? templatePreviewUrl
        : '';

      await saveTemplateConfig(inlineTemplate && !templateAssetUrl ? { template_data_url: inlineTemplate } : {});
      const res = await fetchWithAuth(`${API_BASE}?action=generate`, {
        method: 'POST',
        body: JSON.stringify({
          eventId: selectedEventId,
          recipients: parsedCsv.participants,
          template: inlineTemplate || undefined,
          settings: templateSettings,
        }),
      });
      const data = await res.json();
      setGenerateResult(data);
      if (data.success) {
        await loadCertificates(selectedEventId);
        setStep('send');
      }
    } finally {
      setGenerateLoading(false);
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
          mailer_app_password: '',
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
    try {
      const res = await fetchWithAuth(`${API_BASE}?action=send-certificates`, {
        method: 'POST',
        body: JSON.stringify({ eventId: selectedEventId }),
      });
      const data = await res.json();
      setSendResult(data);
      await loadCertificates(selectedEventId);
    } finally {
      setSendLoading(false);
    }
  }

  function handleLogout() {
    if (supabase) supabase.auth.signOut();
    localStorage.removeItem('certvault_club_token');
    localStorage.removeItem(PENDING_ORG_NAME_KEY);
    navigate('/login', { replace: true });
  }

  if (loading || !authResolved || token === null) {
    return (
      <CertVaultLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-600 shadow-sm">
            Loading organizer workspace...
          </div>
        </div>
      </CertVaultLayout>
    );
  }

  if (needSignup) {
    return (
      <CertVaultLayout>
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-semibold text-[var(--apple-text-primary)]">Complete your organizer profile</h1>
            <p className="mt-2 text-sm text-[var(--apple-text-secondary)]">Set your organization name to unlock the certificate dashboard.</p>
            <form onSubmit={handleCompleteSignup} className="mt-6 space-y-4">
              <input
                value={completeSignupName}
                onChange={(e) => setCompleteSignupName(e.target.value)}
                placeholder="Organization name"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-[var(--apple-accent)]"
              />
              {completeSignupError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{completeSignupError}</div>
              )}
              <button
                type="submit"
                disabled={completeSignupLoading}
                className="w-full rounded-xl bg-[var(--apple-accent)] px-4 py-3 font-semibold text-white disabled:opacity-60"
              >
                {completeSignupLoading ? 'Saving...' : 'Continue'}
              </button>
            </form>
          </div>
        </div>
      </CertVaultLayout>
    );
  }

  return (
    <CertVaultLayout>
      <div className="min-h-screen bg-[var(--apple-bg)] px-4 py-6 sm:px-6 lg:px-10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
          <section className="rounded-[28px] border border-slate-200 bg-white/95 p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--apple-text-secondary)]">CertVault Organizer</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--apple-text-primary)]">Certificates that move from CSV to inbox</h1>
                <p className="mt-2 max-w-2xl text-sm text-[var(--apple-text-secondary)]">
                  Create an event, paste participants, save the certificate template, generate unique IDs and PDFs, then send the certificates when you are ready.
                </p>
              </div>
              <div className="flex flex-col gap-2 text-sm text-[var(--apple-text-secondary)] lg:items-end">
                <div className="rounded-full bg-slate-100 px-4 py-2 text-[var(--apple-text-primary)]">
                  {organization?.name} · {organization?.email}
                </div>
                <button type="button" onClick={handleLogout} className="font-medium text-[var(--apple-accent)] hover:underline">
                  Sign out
                </button>
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="space-y-3">
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
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        active
                          ? 'border-[var(--apple-accent)] bg-[var(--apple-accent)]/8'
                          : 'border-slate-200 hover:border-slate-300'
                      } ${status === 'locked' ? 'cursor-not-allowed opacity-50' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--apple-text-secondary)]">Step {index + 1}</span>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${
                          status === 'locked' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-600'
                        }`}>
                          {status === 'locked' ? 'Locked' : 'Ready'}
                        </span>
                      </div>
                      <div className="mt-2 text-base font-semibold capitalize text-[var(--apple-text-primary)]">{stepName}</div>
                    </button>
                  );
                })}
              </div>

              {selectedEvent && (
                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--apple-text-secondary)]">Selected Event</p>
                  <p className="mt-2 text-lg font-semibold text-[var(--apple-text-primary)]">{selectedEvent.name}</p>
                  <p className="mt-1 text-sm text-[var(--apple-text-secondary)]">{selectedEvent.event_date || 'Date not set yet'}</p>
                </div>
              )}
            </aside>

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
                        setNewEventName(e.target.value);
                        if (!newEventSlug) setNewEventSlug(slugify(e.target.value));
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
                      onChange={(e) => setNewEventSlug(slugify(e.target.value))}
                      placeholder="public slug"
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-[var(--apple-accent)]"
                    />
                    <button
                      type="submit"
                      disabled={createEventLoading}
                      className="rounded-xl bg-[var(--apple-accent)] px-5 py-3 font-semibold text-white disabled:opacity-60"
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
                        <button type="submit" disabled={savingSlug} className="rounded-xl bg-[var(--apple-accent)] px-5 py-3 font-semibold text-white disabled:opacity-60">
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

                  <textarea
                    value={participantCsv}
                    onChange={(e) => setParticipantCsv(e.target.value)}
                    rows={12}
                    className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 font-mono text-sm outline-none focus:border-[var(--apple-accent)]"
                    placeholder={`Aarav Sharma,aarav@example.com,Winner\nMaya Singh,maya@example.com,Participant`}
                  />

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className={`rounded-3xl border p-5 ${parsedCsv.errors.length ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>
                      <p className="text-sm font-semibold text-[var(--apple-text-primary)]">
                        {parsedCsv.errors.length ? 'Fix these CSV rows before generating' : 'CSV is ready for template + generation'}
                      </p>
                      <div className="mt-3 space-y-2 text-sm text-[var(--apple-text-secondary)]">
                        {parsedCsv.errors.length ? (
                          parsedCsv.errors.map((error) => (
                            <div key={`${error.row}-${error.message}`}>Row {error.row}: {error.message}</div>
                          ))
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
                        className="mt-4 w-full rounded-xl bg-[var(--apple-accent)] px-4 py-3 font-semibold text-white disabled:opacity-50"
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

                  <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
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
                            ? 'border-[var(--apple-accent)] bg-[var(--apple-accent)]/10'
                            : 'border-slate-300 bg-white hover:border-[var(--apple-accent)]/60 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex flex-col items-center text-center">
                          <div className="mb-3 rounded-full bg-[var(--apple-accent)]/10 p-3 text-[var(--apple-accent)]">
                            <span className="material-symbols-outlined text-[28px]">upload_file</span>
                          </div>
                          <p className="text-sm font-semibold text-[var(--apple-text-primary)]">
                            Drag and drop your template here
                          </p>
                          <p className="mt-1 text-sm text-[var(--apple-text-secondary)]">
                            or click to choose a PNG, JPG, or SVG
                          </p>
                          <p className="mt-3 text-xs text-[var(--apple-text-secondary)]">
                            {selectedTemplateName || 'No file selected'}
                          </p>
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-[var(--apple-text-secondary)]">PNG and JPEG work best. The uploaded template is saved to cloud storage and reused during generation.</p>

                      <div className="mt-6 space-y-4">
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-medium text-[var(--apple-text-secondary)]">
                          Drag the name and verify line directly on the preview to place them. The sliders below fine-tune exact position and size.
                        </div>
                        <label className="block text-sm font-semibold text-[var(--apple-text-primary)]">
                          Name font
                          <select
                            value={templateSettings.font_family}
                            onChange={(e) => setTemplateSettings((current) => ({ ...current, font_family: e.target.value }))}
                            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--apple-accent)]"
                          >
                            {CERTIFICATE_FONTS.map((font) => (
                              <option key={font.value} value={font.value}>{font.name}</option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-sm font-semibold text-[var(--apple-text-primary)]">
                          Name Position X
                          <input
                            type="range"
                            min="0.1"
                            max="0.9"
                            step="0.005"
                            value={templateSettings.text_x}
                            onChange={(e) => setTemplateSettings((current) => ({ ...current, text_x: Number(e.target.value) }))}
                            className="mt-2 w-full"
                          />
                          <span className="mt-1 block text-xs font-medium text-[var(--apple-text-secondary)]">
                            {Math.round(templateSettings.text_x * 100)}%
                          </span>
                        </label>
                        <label className="block text-sm font-semibold text-[var(--apple-text-primary)]">
                          Name Position Y
                          <input
                            type="range"
                            min="0.1"
                            max="0.9"
                            step="0.005"
                            value={templateSettings.text_y}
                            onChange={(e) => setTemplateSettings((current) => ({ ...current, text_y: Number(e.target.value) }))}
                            className="mt-2 w-full"
                          />
                          <span className="mt-1 block text-xs font-medium text-[var(--apple-text-secondary)]">
                            {Math.round(templateSettings.text_y * 100)}%
                          </span>
                        </label>
                        <label className="block text-sm font-semibold text-[var(--apple-text-primary)]">
                          Name size
                          <input
                            type="range"
                            min="24"
                            max="120"
                            step="1"
                            value={templateSettings.font_size}
                            onChange={(e) => setTemplateSettings((current) => ({ ...current, font_size: Number(e.target.value) }))}
                            className="mt-2 w-full"
                          />
                          <span className="mt-1 block text-xs font-medium text-[var(--apple-text-secondary)]">
                            {templateSettings.font_size}px
                          </span>
                        </label>
                        <label className="block text-sm font-semibold text-[var(--apple-text-primary)]">
                          Name color
                          <input
                            type="color"
                            value={templateSettings.font_color}
                            onChange={(e) => setTemplateSettings((current) => ({ ...current, font_color: e.target.value }))}
                            className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-2 py-1"
                          />
                        </label>
                        <label className="block text-sm font-semibold text-[var(--apple-text-primary)]">
                          Verify line
                          <input
                            value={templateSettings.verify_line_text}
                            onChange={(e) => setTemplateSettings((current) => ({ ...current, verify_line_text: e.target.value }))}
                            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--apple-accent)]"
                          />
                        </label>
                        <label className="block text-sm font-semibold text-[var(--apple-text-primary)]">
                          Verify line font
                          <select
                            value={templateSettings.verify_line_font}
                            onChange={(e) => setTemplateSettings((current) => ({ ...current, verify_line_font: e.target.value }))}
                            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--apple-accent)]"
                          >
                            {CERTIFICATE_FONTS.map((font) => (
                              <option key={`verify-${font.value}`} value={font.value}>{font.name}</option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-sm font-semibold text-[var(--apple-text-primary)]">
                          Verify line X
                          <input
                            type="range"
                            min="0.05"
                            max="0.95"
                            step="0.005"
                            value={templateSettings.verify_line_x}
                            onChange={(e) => setTemplateSettings((current) => ({ ...current, verify_line_x: Number(e.target.value) }))}
                            className="mt-2 w-full"
                          />
                          <span className="mt-1 block text-xs font-medium text-[var(--apple-text-secondary)]">
                            {Math.round(templateSettings.verify_line_x * 100)}%
                          </span>
                        </label>
                        <label className="block text-sm font-semibold text-[var(--apple-text-primary)]">
                          Verify line height
                          <input
                            type="range"
                            min="0.05"
                            max="0.98"
                            step="0.005"
                            value={templateSettings.verify_line_y}
                            onChange={(e) => setTemplateSettings((current) => ({ ...current, verify_line_y: Number(e.target.value) }))}
                            className="mt-2 w-full"
                          />
                          <span className="mt-1 block text-xs font-medium text-[var(--apple-text-secondary)]">
                            {Math.round(templateSettings.verify_line_y * 100)}%
                          </span>
                        </label>
                        <label className="block text-sm font-semibold text-[var(--apple-text-primary)]">
                          Verify line size
                          <input
                            type="range"
                            min="8"
                            max="48"
                            step="1"
                            value={templateSettings.verify_line_size}
                            onChange={(e) => setTemplateSettings((current) => ({ ...current, verify_line_size: Number(e.target.value) }))}
                            className="mt-2 w-full"
                          />
                          <span className="mt-1 block text-xs font-medium text-[var(--apple-text-secondary)]">
                            {templateSettings.verify_line_size}px
                          </span>
                        </label>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                      <div className="mb-4 flex items-center justify-between">
                        <p className="text-sm font-semibold text-[var(--apple-text-primary)]">Template preview</p>
                        <span className="text-xs text-[var(--apple-text-secondary)]">{templateSaving ? 'Saving...' : templateReady ? 'Saved to event' : 'No template yet'}</span>
                      </div>
                      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                        {templatePreviewUrl ? (
                          <div ref={templatePreviewContainerRef} className="relative select-none">
                            <img
                              ref={templatePreviewImageRef}
                              src={templatePreviewUrl}
                              alt="Certificate template"
                              className="w-full"
                              onLoad={handlePreviewImageLoad}
                              draggable={false}
                            />
                            <div
                              role="button"
                              tabIndex={0}
                              onPointerDown={(event) => {
                                event.preventDefault();
                                setDragTarget('name');
                                updateDraggedPosition(event.clientX, event.clientY, 'name');
                              }}
                              onKeyDown={(event) => {
                                const step = event.shiftKey ? 0.02 : 0.01;
                                if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
                                event.preventDefault();
                                setTemplateSettings((current) => ({
                                  ...current,
                                  text_x: clampUnit(current.text_x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0)),
                                  text_y: clampUnit(current.text_y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0)),
                                }));
                              }}
                              className={`absolute rounded-xl border border-dashed px-3 py-1 text-center font-semibold text-black shadow-sm transition ${
                                dragTarget === 'name'
                                  ? 'border-[var(--apple-accent)] bg-white/95'
                                  : 'border-slate-300/80 bg-white/85 hover:border-[var(--apple-accent)]/60'
                              }`}
                              style={{
                                left: `${templateSettings.text_x * 100}%`,
                                top: `${templateSettings.text_y * 100}%`,
                                transform: 'translate(-50%, -50%)',
                                cursor: dragTarget === 'name' ? 'grabbing' : 'grab',
                                fontSize: `${Math.max(templateSettings.font_size * previewScale, 10)}px`,
                                color: templateSettings.font_color,
                                fontFamily: templateSettings.font_family || 'Georgia, serif',
                                lineHeight: 1.1,
                                whiteSpace: 'nowrap',
                                touchAction: 'none',
                              }}
                            >
                              Participant Name
                            </div>
                            <div
                              role="button"
                              tabIndex={0}
                              onPointerDown={(event) => {
                                event.preventDefault();
                                setDragTarget('verify');
                                updateDraggedPosition(event.clientX, event.clientY, 'verify');
                              }}
                              onKeyDown={(event) => {
                                const step = event.shiftKey ? 0.02 : 0.01;
                                if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
                                event.preventDefault();
                                setTemplateSettings((current) => ({
                                  ...current,
                                  verify_line_x: clampUnit(current.verify_line_x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0)),
                                  verify_line_y: clampUnit(current.verify_line_y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0)),
                                }));
                              }}
                              className={`absolute rounded-xl border border-dashed px-3 py-1 text-center shadow-sm transition ${
                                dragTarget === 'verify'
                                  ? 'border-[var(--apple-accent)] bg-white/95'
                                  : 'border-slate-300/80 bg-white/85 hover:border-[var(--apple-accent)]/60'
                              }`}
                              style={{
                                left: `${templateSettings.verify_line_x * 100}%`,
                                top: `${templateSettings.verify_line_y * 100}%`,
                                transform: 'translate(-50%, -50%)',
                                cursor: dragTarget === 'verify' ? 'grabbing' : 'grab',
                                fontSize: `${Math.max(templateSettings.verify_line_size * previewScale, 8)}px`,
                                color: templateSettings.verify_line_color,
                                fontFamily: templateSettings.verify_line_font || "'Inter', sans-serif",
                                whiteSpace: 'nowrap',
                                lineHeight: 1.15,
                                touchAction: 'none',
                              }}
                            >
                              {templateSettings.verify_line_text.replace('{certificate_id}', 'CV-2026-SAMPLE')}
                            </div>
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
                        className="mt-4 rounded-xl bg-[var(--apple-accent)] px-5 py-3 font-semibold text-white disabled:opacity-50"
                      >
                        Continue to generate
                      </button>
                      {templateContinueReason && (
                        <p className="mt-3 text-sm text-[var(--apple-text-secondary)]">
                          {templateContinueReason}
                        </p>
                      )}
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
                    className="rounded-xl bg-[var(--apple-accent)] px-6 py-3 font-semibold text-white disabled:opacity-50"
                  >
                    {generateLoading ? 'Generating certificates...' : 'Generate certificates + PDFs'}
                  </button>

                  {generateResult && (
                    <div className={`rounded-3xl border p-5 ${generateResult.success ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                      <p className="text-sm font-semibold text-[var(--apple-text-primary)]">
                        {generateResult.success
                          ? `Generated ${generateResult.generated} certificates and ${generateResult.pdfsGenerated || 0} PDFs`
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
                </div>
              )}

              {currentStep === 'send' && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-2xl font-semibold text-[var(--apple-text-primary)]">5. Send certificate emails</h2>
                    <p className="mt-2 text-sm text-[var(--apple-text-secondary)]">Configure the sender, then send certificates only to valid recipients with PDFs that have not already been delivered.</p>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                    <form onSubmit={handleSaveMailerConfig} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                      <h3 className="text-lg font-semibold text-[var(--apple-text-primary)]">Gmail sender</h3>
                      <div className="mt-4 space-y-4">
                        <input
                          value={mailerConfig.mailer_email}
                          onChange={(e) => setMailerConfig((current) => ({ ...current, mailer_email: e.target.value }))}
                          placeholder="organizer@gmail.com"
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-[var(--apple-accent)]"
                        />
                        <input
                          value={mailerConfig.mailer_from_name}
                          onChange={(e) => setMailerConfig((current) => ({ ...current, mailer_from_name: e.target.value }))}
                          placeholder="Sender name"
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-[var(--apple-accent)]"
                        />
                        <input
                          type="password"
                          value={mailerConfig.mailer_app_password}
                          onChange={(e) => setMailerConfig((current) => ({ ...current, mailer_app_password: e.target.value }))}
                          placeholder={mailerConfig.has_mailer_app_password ? 'App password saved. Enter a new one to replace it.' : 'Gmail app password'}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-[var(--apple-accent)]"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={mailerLoading}
                        className="mt-4 w-full rounded-xl bg-[var(--apple-accent)] px-4 py-3 font-semibold text-white disabled:opacity-60"
                      >
                        {mailerLoading ? 'Saving sender...' : 'Save sender config'}
                      </button>
                    </form>

                    <div className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-4">
                        {[
                          ['Total', sendSummary.total],
                          ['Eligible', sendSummary.eligible],
                          ['Sent', sendSummary.sent],
                          ['Failed', sendSummary.failed],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--apple-text-secondary)]">{label}</div>
                            <div className="mt-3 text-3xl font-semibold text-[var(--apple-text-primary)]">{value}</div>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={handleSendCertificates}
                          disabled={sendLoading || sendSummary.eligible === 0}
                          className="rounded-xl bg-[var(--apple-accent)] px-6 py-3 font-semibold text-white disabled:opacity-50"
                        >
                          {sendLoading ? 'Sending certificates...' : 'Send all unsent certificates'}
                        </button>
                        {selectedEvent?.download_slug && (
                          <a href={`/${selectedEvent.download_slug}`} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-[var(--apple-text-primary)] hover:bg-slate-50">
                            Open student page
                          </a>
                        )}
                      </div>

                      {sendResult && (
                        <div className={`rounded-3xl border p-5 ${sendResult.failed ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
                          <p className="text-sm font-semibold text-[var(--apple-text-primary)]">
                            Attempted {sendResult.attempted || 0}. Sent {sendResult.sent || 0}. Failed {sendResult.failed || 0}.
                          </p>
                        </div>
                      )}

                      <div className="overflow-hidden rounded-3xl border border-slate-200">
                        <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)_140px_140px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--apple-text-secondary)]">
                          <div>Recipient</div>
                          <div>Certificate</div>
                          <div>Email</div>
                          <div>Status</div>
                        </div>
                        <div className="max-h-[520px] overflow-y-auto">
                          {certificatesLoading ? (
                            <div className="px-5 py-8 text-sm text-[var(--apple-text-secondary)]">Loading certificates...</div>
                          ) : certificates.length === 0 ? (
                            <div className="px-5 py-8 text-sm text-[var(--apple-text-secondary)]">No certificates have been generated for this event yet.</div>
                          ) : (
                            certificates.map((cert) => (
                              <div key={cert.certificate_id} className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)_140px_140px] gap-4 border-b border-slate-100 px-5 py-4 text-sm">
                                <div>
                                  <div className="font-semibold text-[var(--apple-text-primary)]">{cert.recipient_name}</div>
                                  <div className="text-[var(--apple-text-secondary)]">{cert.recipient_email || 'No email'}</div>
                                </div>
                                <div>
                                  <div className="font-medium text-[var(--apple-text-primary)]">{cert.certificate_id}</div>
                                  <div className="mt-2 flex flex-wrap gap-3 text-xs">
                                    {cert.pdf_url && (
                                      <a href={pdfDownloadUrl(cert.pdf_url, true)} target="_blank" rel="noreferrer" className="font-medium text-[var(--apple-accent)] hover:underline">
                                        PDF
                                      </a>
                                    )}
                                    <Link to={`/verify?id=${cert.certificate_id}`} target="_blank" className="font-medium text-[var(--apple-accent)] hover:underline">
                                      Verify
                                    </Link>
                                  </div>
                                </div>
                                <div className="flex items-center">
                                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                    cert.pdf_url && isValidEmail(cert.recipient_email)
                                      ? 'bg-emerald-50 text-emerald-600'
                                      : 'bg-amber-50 text-amber-600'
                                  }`}>
                                    {cert.pdf_url && isValidEmail(cert.recipient_email) ? 'Ready' : 'Blocked'}
                                  </span>
                                </div>
                                <div className="flex items-center">
                                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                    cert.email_send_status === 'sent'
                                      ? 'bg-emerald-50 text-emerald-600'
                                      : cert.email_send_status === 'failed'
                                        ? 'bg-red-50 text-red-600'
                                        : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {cert.email_send_status || 'pending'}
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </main>
          </section>
        </div>
      </div>
    </CertVaultLayout>
  );
}
