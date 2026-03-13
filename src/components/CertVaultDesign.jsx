/**
 * CertVault Design Page — Full-page certificate layout designer.
 * Drag & drop template, preview, verify line, save to localStorage for use in dashboard.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import CertVaultLayout from './CertVaultLayout';
import { certVaultTheme as theme } from '../theme';
import { supabase } from '../lib/supabase';

const DESIGN_STORAGE_KEY = 'certvault_design';
const CLUB_TEMPLATES_KEY = 'certvault_club_templates';

const DEFAULT_VERIFY_LINE = 'Verify the certificate here - gradex.bond/certvault/verify?id={certificate_id}';

const SNAP_THRESHOLD = 0.025;
const ALIGN_THRESHOLD = 0.008;
const GUIDE_POSITIONS = [0.25, 0.5, 0.75];

function snapToGuides(raw, other, isDragging) {
  if (!isDragging) return { value: raw, guide: null };
  const points = [...GUIDE_POSITIONS];
  if (other != null) points.push(other);
  for (const p of points) {
    if (Math.abs(raw - p) < SNAP_THRESHOLD) return { value: p, guide: p };
  }
  return { value: raw, guide: null };
}

function getAlignmentGuides(textX, textY, verifyX, verifyY, dragging) {
  const v = new Set();
  const h = new Set();
  const th = dragging ? SNAP_THRESHOLD : ALIGN_THRESHOLD;
  for (const p of GUIDE_POSITIONS) {
    if (Math.abs(textX - p) < th || Math.abs(verifyX - p) < th) v.add(p);
    if (Math.abs(textY - p) < th || Math.abs(verifyY - p) < th) h.add(p);
  }
  if (Math.abs(textX - verifyX) < th && textX > 0.02) v.add(textX);
  if (Math.abs(textY - verifyY) < th && textY > 0.02) h.add(textY);
  return { v: [...v], h: [...h] };
}

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

import { compressTemplateImage } from '../utils/certvaultCompress';

// Convert SVG data URL to PNG data URL (certgen expects raster)
async function svgToPngDataUrl(svgDataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      try {
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        resolve(svgDataUrl);
      }
    };
    img.onerror = () => resolve(svgDataUrl);
    img.src = svgDataUrl;
  });
}

export default function CertVaultDesign() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromEventId = location.state?.fromEventId ?? null;
  const [templateImage, setTemplateImage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingVerify, setIsDraggingVerify] = useState(false);
  const [isDropActive, setIsDropActive] = useState(false);
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
    verify_line_text: DEFAULT_VERIFY_LINE,
    verify_line_x: 0.5,
    verify_line_y: 0.92,
    verify_line_size: 12,
    verify_line_color: '#666666',
    verify_line_font: "'Inter', sans-serif",
  });
  const [verifyLineText, setVerifyLineText] = useState(DEFAULT_VERIFY_LINE);
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const previewContainerRef = useRef(null);
  const [authToken, setAuthToken] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const token = authToken || (typeof window !== 'undefined' ? localStorage.getItem('certvault_club_token') : null);

  // Resolve auth: Supabase session or legacy certvault_club_token (same as Dashboard)
  useEffect(() => {
    if (!supabase) {
      setAuthToken(typeof window !== 'undefined' ? localStorage.getItem('certvault_club_token') : null);
      setAuthChecked(true);
      return;
    }
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session?.access_token) {
        setAuthToken(session.access_token);
      } else {
        setAuthToken(typeof window !== 'undefined' ? localStorage.getItem('certvault_club_token') : null);
      }
      setAuthChecked(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setAuthToken(session?.access_token || (typeof window !== 'undefined' ? localStorage.getItem('certvault_club_token') : null));
    });
    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, []);

  // Redirect to login only after we've checked Supabase (so magic-link users aren’t sent to login)
  useEffect(() => {
    if (!authChecked) return;
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    try {
      const saved = localStorage.getItem(DESIGN_STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.template) setTemplateImage(data.template);
        if (data.settings) {
          setPdfSettings(prev => ({ ...prev, ...data.settings }));
          if (data.settings.verify_line_text) setVerifyLineText(data.settings.verify_line_text);
        }
      }
      const stored = localStorage.getItem(CLUB_TEMPLATES_KEY);
      if (stored) setSavedTemplates(JSON.parse(stored));
    } catch {}
  }, [authChecked, token, navigate]);

  const persistSavedTemplates = useCallback((templates) => {
    setSavedTemplates(templates);
    try {
      localStorage.setItem(CLUB_TEMPLATES_KEY, JSON.stringify(templates));
    } catch (e) {
      console.warn('Could not save templates');
    }
  }, []);

  const saveDesign = useCallback(() => {
    const data = {
      template: templateImage,
      settings: { ...pdfSettings, verify_line_text: verifyLineText },
    };
    try {
      localStorage.setItem(DESIGN_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Design too large to save to localStorage');
    }
  }, [templateImage, pdfSettings, verifyLineText]);

  // Debounced save
  useEffect(() => {
    if (!templateImage) return;
    const t = setTimeout(saveDesign, 500);
    return () => clearTimeout(t);
  }, [templateImage, pdfSettings, verifyLineText, saveDesign]);

  const handleFile = useCallback(async (file) => {
    if (!file?.type?.startsWith('image/')) return;
    const base64 = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    let final = base64;
    if (base64.startsWith('data:image/svg')) {
      final = await svgToPngDataUrl(base64);
    }
    final = await compressTemplateImage(final);
    setTemplateImage(final);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDropActive(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDropActive(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDropActive(false);
  }, []);

  const handleTemplateUpload = useCallback((e) => {
    const file = e.target?.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleUseSavedTemplate = useCallback((t) => {
    setTemplateImage(t.template);
  }, []);

  const handleSaveCurrentTemplate = useCallback(() => {
    if (!templateImage || !saveTemplateName.trim()) return;
    const name = saveTemplateName.trim();
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const updated = [...savedTemplates, { id, name, template: templateImage }];
    persistSavedTemplates(updated);
    setSaveTemplateName('');
    setShowSaveTemplate(false);
  }, [templateImage, saveTemplateName, savedTemplates, persistSavedTemplates]);

  const handleDeleteSavedTemplate = useCallback((id, e) => {
    e.stopPropagation();
    const updated = savedTemplates.filter(t => t.id !== id);
    persistSavedTemplates(updated);
  }, [savedTemplates, persistSavedTemplates]);

  const handleMarkerMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if ((!isDragging && !isDraggingVerify) || !previewContainerRef.current) return;
    const rect = previewContainerRef.current.getBoundingClientRect();
    const rawX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const rawY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    const otherX = isDragging ? pdfSettings.verify_line_x : pdfSettings.text_x;
    const otherY = isDragging ? pdfSettings.verify_line_y : pdfSettings.text_y;

    const snapX = snapToGuides(rawX, otherX, isDragging || isDraggingVerify);
    const snapY = snapToGuides(rawY, otherY, isDragging || isDraggingVerify);

    if (isDragging) {
      setPdfSettings(prev => ({ ...prev, text_x: snapX.value, text_y: snapY.value }));
    }
    if (isDraggingVerify) {
      setPdfSettings(prev => ({ ...prev, verify_line_x: snapX.value, verify_line_y: snapY.value }));
    }
  };

  const handleMouseUp = () => {
    if (isDragging) setIsDragging(false);
    if (isDraggingVerify) setIsDraggingVerify(false);
  };

  const alignmentGuides = getAlignmentGuides(
    pdfSettings.text_x,
    pdfSettings.text_y,
    pdfSettings.verify_line_x,
    pdfSettings.verify_line_y,
    isDragging || isDraggingVerify
  );

  useEffect(() => {
    if (isDragging || isDraggingVerify) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isDraggingVerify]);


  if (!authChecked) {
    return (
      <CertVaultLayout>
        <div style={{ textAlign: 'center', padding: 48 }}>Loading...</div>
      </CertVaultLayout>
    );
  }
  if (!token) return null;

  return (
    <CertVaultLayout>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 1024px) {
          .certvault-design-content {
            flex-direction: column !important;
          }
          .certvault-design-sidebar {
            width: 100% !important;
            max-width: 100% !important;
          }
          .certvault-design-preview {
            width: 100% !important;
          }
        }
        @media (max-width: 768px) {
          .certvault-design-wrap {
            padding: 12px 16px !important;
          }
          .certvault-design-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 12px !important;
          }
          .certvault-design-controls {
            font-size: 13px !important;
          }
          .certvault-design-preview-container {
            max-width: 100% !important;
          }
        }
      `}</style>
      <div className="certvault-design-wrap" style={styles.wrap}>
        <div className="certvault-design-header" style={styles.header}>
          <button
            type="button"
            onClick={() => navigate('/dashboard', { state: { section: 'certificates', selectedEventId: fromEventId, showGenerate: true } })}
            style={{ ...styles.backLink, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            ← Back to certificates
          </button>
          <h1 style={styles.title}>Design Certificate</h1>
        </div>

        <div className="certvault-design-content" style={styles.content}>
          <div className="certvault-design-sidebar" style={styles.sidebar}>
            {/* Drag & drop zone */}
            <div
            style={{
              ...styles.dropZone,
              ...(isDropActive ? styles.dropZoneActive : {}),
              ...(templateImage ? styles.dropZoneCompact : {}),
            }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <input
              type="file"
              accept="image/*"
              onChange={handleTemplateUpload}
              style={styles.fileInput}
              id="designTemplateUpload"
            />
            {!templateImage ? (
              <>
                <p style={styles.dropText}>Drop certificate template here</p>
                <p style={styles.dropSub}>or</p>
                <label htmlFor="designTemplateUpload" style={styles.uploadLabel}>Choose file</label>
                {savedTemplates.length > 0 && (
                  <div style={styles.catalogue}>
                    <span style={styles.catalogueLabel}>My saved templates</span>
                    {savedTemplates.map((t) => (
                      <div key={t.id} style={styles.catalogueItem}>
                        <button
                          type="button"
                          onClick={() => handleUseSavedTemplate(t)}
                          style={styles.catalogueBtn}
                        >
                          <img src={t.template} alt={t.name} style={styles.catalogueThumb} />
                          <span>{t.name}</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSavedTemplate(t.id, e)}
                          style={styles.deleteTemplateBtn}
                          title="Delete"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div style={styles.changeRow}>
                <label htmlFor="designTemplateUpload" style={styles.changeLabel}>Change template</label>
                <button
                  type="button"
                  onClick={() => setShowSaveTemplate(!showSaveTemplate)}
                  style={styles.saveTemplateBtn}
                >
                  {showSaveTemplate ? 'Cancel' : 'Save to my templates'}
                </button>
                {showSaveTemplate && (
                  <div style={styles.saveTemplateRow}>
                    <input
                      type="text"
                      value={saveTemplateName}
                      onChange={(e) => setSaveTemplateName(e.target.value)}
                      placeholder="Template name"
                      style={styles.saveTemplateInput}
                    />
                    <button type="button" onClick={handleSaveCurrentTemplate} style={styles.saveTemplateConfirm} disabled={!saveTemplateName.trim()}>
                      Save
                    </button>
                  </div>
                )}
                {savedTemplates.length > 0 && (
                  <div style={styles.catalogue}>
                    {savedTemplates.map((t) => (
                      <div key={t.id} style={styles.catalogueItem}>
                        <button type="button" onClick={() => handleUseSavedTemplate(t)} style={styles.catalogueBtn}>
                          <img src={t.template} alt={t.name} style={styles.catalogueThumb} />
                          <span>{t.name}</span>
                        </button>
                        <button type="button" onClick={(e) => handleDeleteSavedTemplate(t.id, e)} style={styles.deleteTemplateBtn} title="Delete">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

            {/* Verify line */}
            <div style={styles.verifySection}>
              <label style={styles.label}>Verify line</label>
              <input
                type="text"
                value={verifyLineText}
                onChange={(e) => setVerifyLineText(e.target.value)}
                placeholder="Verify the certificate here - gradex.bond/certvault/verify?id={certificate_id}"
                style={styles.verifyInput}
              />
            </div>

            {/* Controls - only when template loaded */}
            {templateImage && (
              <div className="certvault-design-controls" style={styles.controls}>
                <div style={styles.sliderRow}>
                  <span style={styles.sliderLabel}>Size</span>
                  <input type="range" min="20" max="100" value={pdfSettings.font_size}
                    onChange={(e) => setPdfSettings(p => ({ ...p, font_size: parseInt(e.target.value) }))}
                    style={styles.slider} />
                  <span style={styles.sliderVal}>{pdfSettings.font_size}</span>
                </div>
                <div style={styles.sliderRow}>
                  <span style={styles.sliderLabel}>Color</span>
                  <input type="color" value={pdfSettings.font_color}
                    onChange={(e) => setPdfSettings(p => ({ ...p, font_color: e.target.value }))}
                    style={styles.colorPicker} />
                </div>
                <div style={styles.sliderRow}>
                  <span style={styles.sliderLabel}>Font</span>
                  <select value={pdfSettings.font_family || 'Georgia, serif'}
                    onChange={(e) => setPdfSettings(p => ({ ...p, font_family: e.target.value }))}
                    style={styles.fontSelect}>
                    {CERTIFICATE_FONTS.map((f) => (
                      <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={styles.controlDivider}>Verify line</div>
                <div style={styles.sliderRow}>
                  <span style={styles.sliderLabel}>V. size</span>
                  <input type="range" min="8" max="36" value={pdfSettings.verify_line_size}
                    onChange={(e) => setPdfSettings(p => ({ ...p, verify_line_size: parseInt(e.target.value) }))}
                    style={styles.slider} />
                  <span style={styles.sliderVal}>{pdfSettings.verify_line_size}</span>
                </div>
                <div style={styles.sliderRow}>
                  <span style={styles.sliderLabel}>V. color</span>
                  <input type="color" value={pdfSettings.verify_line_color}
                    onChange={(e) => setPdfSettings(p => ({ ...p, verify_line_color: e.target.value }))}
                    style={styles.colorPicker} />
                </div>
                <div style={styles.sliderRow}>
                  <span style={styles.sliderLabel}>V. font</span>
                  <select value={pdfSettings.verify_line_font || "'Inter', sans-serif"}
                    onChange={(e) => setPdfSettings(p => ({ ...p, verify_line_font: e.target.value }))}
                    style={styles.fontSelect}>
                    {CERTIFICATE_FONTS.map((f) => (
                      <option key={`v-${f.value}`} value={f.value}>{f.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Preview */}
          {templateImage && (
            <div className="certvault-design-preview" style={styles.previewSection}>
              <div ref={previewContainerRef} className="certvault-design-preview-container" style={styles.previewContainer}>
                <img
                  src={templateImage}
                  alt="Certificate preview"
                  style={styles.previewImg}
                  draggable={false}
                />
                {/* Alignment guides — Canva-style */}
                {alignmentGuides.v.map((x) => (
                  <div
                    key={`v-${x}`}
                    style={{
                      ...styles.alignGuide,
                      ...styles.alignGuideV,
                      left: `${x * 100}%`,
                    }}
                  />
                ))}
                {alignmentGuides.h.map((y) => (
                  <div
                    key={`h-${y}`}
                    style={{
                      ...styles.alignGuide,
                      ...styles.alignGuideH,
                      top: `${y * 100}%`,
                    }}
                  />
                ))}
                {/* Live name overlay — always visible with current font settings */}
                <div
                  style={{
                    ...styles.nameOverlay,
                    left: `${pdfSettings.text_x * 100}%`,
                    top: `${pdfSettings.text_y * 100}%`,
                    fontSize: pdfSettings.font_size,
                    color: pdfSettings.font_color,
                    fontFamily: pdfSettings.font_family || 'Georgia, serif',
                  }}
                >
                  Rahul Kumar Sharma
                </div>
                <div
                  style={{
                    ...styles.positionMarker,
                    left: `${pdfSettings.text_x * 100}%`,
                    top: `${pdfSettings.text_y * 100}%`,
                    cursor: isDragging ? 'grabbing' : 'grab',
                  }}
                  onMouseDown={handleMarkerMouseDown}
                  title="Drag to position name"
                >
                  <div style={styles.markerRing} />
                </div>
                {/* Verify line overlay — draggable */}
                <div
                  style={{
                    ...styles.verifyLineOverlay,
                    left: `${pdfSettings.verify_line_x * 100}%`,
                    top: `${pdfSettings.verify_line_y * 100}%`,
                    fontSize: pdfSettings.verify_line_size,
                    color: pdfSettings.verify_line_color,
                    fontFamily: pdfSettings.verify_line_font || "'Inter', sans-serif",
                  }}
                >
                  {(verifyLineText || DEFAULT_VERIFY_LINE).replace(/\{certificate_id\}|\{id\}/g, 'CV-2025-A1B2C3')}
                </div>
                <div
                  style={{
                    ...styles.positionMarker,
                    left: `${pdfSettings.verify_line_x * 100}%`,
                    top: `${pdfSettings.verify_line_y * 100}%`,
                    cursor: isDraggingVerify ? 'grabbing' : 'grab',
                  }}
                  onMouseDown={(e) => { e.preventDefault(); setIsDraggingVerify(true); }}
                  title="Drag to position verify line"
                >
                  <div style={styles.markerRingVerify} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </CertVaultLayout>
  );
}

const styles = {
  wrap: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    padding: '12px 20px',
    boxSizing: 'border-box',
  },
  header: { display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20, flexShrink: 0 },
  backLink: { fontSize: 14, color: theme.accent, textDecoration: 'none', whiteSpace: 'nowrap', fontWeight: 500 },
  title: { fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif', fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text, margin: 0, whiteSpace: 'nowrap' },
  content: { flex: 1, minHeight: 0, display: 'flex', gap: 20 },
  sidebar: {
    width: 260,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    minHeight: 0,
    overflowY: 'auto',
  },
  dropZone: {
    border: `2px dashed ${theme.borderLight}`,
    borderRadius: 18,
    padding: 20,
    textAlign: 'center',
    backgroundColor: theme.bgCard,
    borderColor: theme.borderLight,
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    transition: 'all 0.2s',
    flexShrink: 0,
  },
  dropZoneActive: { borderColor: theme.accent, backgroundColor: theme.accentLight },
  dropZoneCompact: { padding: 14 },
  dropText: { fontSize: 13, color: theme.text, margin: '0 0 4px' },
  dropSub: { fontSize: 11, color: theme.textMuted, margin: '0 0 8px' },
  uploadLabel: {
    display: 'inline-block',
    padding: '6px 12px',
    backgroundColor: theme.accentLight,
    color: theme.accent,
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
  },
  fileInput: { display: 'none' },
  catalogue: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 },
  catalogueLabel: { display: 'block', width: '100%', fontSize: 11, color: theme.textMuted, marginBottom: 2 },
  catalogueItem: { position: 'relative', display: 'inline-flex' },
  deleteTemplateBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: theme.error,
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveTemplateBtn: { fontSize: 12, color: theme.accent, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' },
  saveTemplateRow: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 },
  saveTemplateInput: {
    padding: '6px 10px',
    fontSize: 13,
    border: `1px solid ${theme.border}`,
    borderRadius: 6,
    background: theme.bgInput,
    color: theme.text,
    width: 140,
  },
  saveTemplateConfirm: { padding: '6px 12px', fontSize: 12, background: theme.accentLight, color: theme.accent, border: 'none', borderRadius: 6, cursor: 'pointer' },
  catalogueBtn: {
    padding: 0,
    background: theme.bgInput,
    border: `1px solid ${theme.border}`,
    borderRadius: 6,
    cursor: 'pointer',
    overflow: 'hidden',
    width: 56,
  },
  catalogueThumb: { width: '100%', height: 40, objectFit: 'cover', display: 'block' },
  changeRow: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  changeLabel: { fontSize: 13, color: theme.textSecondary, cursor: 'pointer', textDecoration: 'underline' },
  verifySection: { flexShrink: 0 },
  label: { fontSize: 11, fontWeight: 500, color: theme.textSecondary, marginBottom: 4, display: 'block' },
  verifyInput: {
    width: '100%',
    padding: '8px 10px',
    fontSize: 11,
    border: `1px solid ${theme.border}`,
    borderRadius: 6,
    backgroundColor: theme.bgInput,
    color: theme.text,
    outline: 'none',
    boxSizing: 'border-box',
  },
  previewSection: { flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' },
  previewContainer: {
    position: 'relative',
    flex: 1,
    minHeight: 0,
    borderRadius: 18,
    overflow: 'hidden',
    border: `1px solid ${theme.borderLight}`,
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  },
  previewLoading: {
    position: 'absolute',
    inset: 0,
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
    borderTopColor: theme.accent,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  previewImg: { width: '100%', height: '100%', objectFit: 'contain', display: 'block' },
  nameOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    transform: 'translate(-50%, -50%)',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    zIndex: 15,
  },
  positionMarker: {
    position: 'absolute',
    transform: 'translate(-50%, -50%)',
    zIndex: 25,
    padding: 16,
  },
  markerRing: { width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(234,179,8,0.8)', background: 'transparent', boxShadow: '0 0 0 2px rgba(0,0,0,0.3)' },
  alignGuide: {
    position: 'absolute',
    pointerEvents: 'none',
    zIndex: 12,
    backgroundColor: theme.accent,
  },
  alignGuideV: {
    left: 0,
    top: 0,
    bottom: 0,
    width: 1,
    transform: 'translateX(-50%)',
  },
  alignGuideH: {
    left: 0,
    right: 0,
    top: 0,
    height: 1,
    transform: 'translateY(-50%)',
  },
  verifyLineOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    transform: 'translate(-50%, -50%)',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    zIndex: 14,
  },
  markerRingVerify: { width: 10, height: 10, borderRadius: '50%', border: `2px solid ${theme.accent}`, background: 'transparent', boxShadow: '0 0 0 2px rgba(0,0,0,0.2)' },
  controlDivider: { fontSize: 11, color: theme.textMuted, marginTop: 12, marginBottom: 4 },
  fontSelect: {
    padding: '4px 8px',
    fontSize: 11,
    border: `1px solid ${theme.border}`,
    borderRadius: 4,
    background: theme.bgInput,
    color: theme.text,
    flex: 1,
    minWidth: 0,
  },
  controls: { display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 },
  sliderRow: { display: 'flex', alignItems: 'center', gap: 8 },
  sliderLabel: { fontSize: 11, color: theme.textMuted, width: 36, whiteSpace: 'nowrap' },
  slider: { flex: 1, minWidth: 0 },
  sliderVal: { fontSize: 11, color: theme.textMuted, width: 20, textAlign: 'right' },
  colorPicker: { width: 28, height: 24, padding: 1, cursor: 'pointer', borderRadius: 4 },
};
