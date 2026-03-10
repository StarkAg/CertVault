/**
 * CertVault Home: Certifier.io-style landing page.
 * Professional certificate issuance, verification, and bulk generation.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import CertVaultLayout from './CertVaultLayout';
import { certVaultTheme as theme } from '../theme';

const WORKFLOW = [
  { label: 'Design', desc: 'Upload templates, position text, customize fonts & colors.' },
  { label: 'Generate', desc: 'Create certificates in bulk from CSV—unique IDs assigned automatically.' },
  { label: 'Send', desc: 'Share PDFs via Cloudinary CDN. Recipients get instant access.' },
  { label: 'Verify', desc: 'Public verification by Certificate ID. No login required.' },
];

const FEATURES = [
  { title: 'Digital Certificates', desc: 'Issue digital certificates with unique IDs. Upload templates, generate PDFs in bulk, host online.', link: '/for-clubs', cta: 'Start for free' },
  { title: 'Public Verification', desc: 'Anyone can verify a certificate instantly using the Certificate ID. Trusted, transparent, and secure.', link: '/verify', cta: 'Verify now' },
  { title: 'Bulk Generator', desc: 'Generate multiple certificates from CSV. Upload template, set positions, export PDFs to Cloudinary.', link: '/for-clubs', cta: 'Learn more' },
];

const BULK_FEATURES = [
  'Generate certificates in bulk from CSV (name, email, category)',
  'Visual drag-and-drop text positioning on template',
  'PDF export and Cloudinary hosting',
  'Unique Certificate ID per credential',
  'Instant public verification by ID',
];

const BENEFITS = [
  { title: 'Save time', desc: 'No manual PDF creation. Bulk generate, bulk upload. Focus on your event, not paperwork.' },
  { title: 'Verifiable', desc: 'Every certificate has a unique ID. Recipients and employers can verify authenticity instantly.' },
  { title: 'Professional', desc: 'Upload your branded template. Position text visually. Output polished PDFs.' },
];

const FAQ = [
  { q: 'Can I generate certificates in bulk?', a: 'Yes. Add recipients via CSV (name, email, category), upload your template, position the name text visually, and generate. All certificates get unique IDs and optional PDF export to Cloudinary.' },
  { q: 'How do recipients verify certificates?', a: 'Share the Certificate ID (e.g. CV-2025-XXXXXX). Anyone can verify at /verify—no login required.' },
  { q: 'Who issues the certificates?', a: 'Clubs and organizations create accounts and issue certificates. CertVault hosts records and provides verification. Certificates are issued by the named organization.' },
];

export default function CertVaultHome() {
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <CertVaultLayout>
      <style>{`
        @media (max-width: 900px) {
          .certvault-feature-grid { grid-template-columns: 1fr !important; }
          .certvault-benefits-grid { grid-template-columns: 1fr !important; }
          .certvault-workflow { flex-direction: column !important; }
          .certvault-cta-row { flex-direction: column !important; gap: 10px !important; }
          .certvault-cta-row a { width: 100% !important; text-align: center !important; font-size: 13px !important; padding: 10px 18px !important; white-space: nowrap !important; }
        }
        @media (max-width: 768px) {
          .certvault-hero-title { font-size: 22px !important; line-height: 1.2 !important; }
          .certvault-hero-subtext { font-size: 13px !important; line-height: 1.4 !important; }
          .certvault-section-title { font-size: 18px !important; white-space: nowrap !important; }
          .certvault-trusted-logos { flex-wrap: wrap !important; justify-content: center !important; gap: 8px !important; }
          .certvault-trusted-logo { font-size: 12px !important; white-space: nowrap !important; }
          .certvault-feature-title { font-size: 16px !important; }
          .certvault-feature-desc { font-size: 13px !important; }
          .certvault-workflow-label { font-size: 14px !important; white-space: nowrap !important; }
          .certvault-workflow-desc { font-size: 12px !important; }
          .certvault-bulk-item { font-size: 13px !important; }
          .certvault-benefit-title { font-size: 15px !important; white-space: nowrap !important; }
          .certvault-benefit-desc { font-size: 12px !important; }
        }
      `}</style>
      {/* Hero */}
      <section style={styles.hero}>
        <h1 className="certvault-hero-title" style={styles.heroTitle}>
          Professional Certificate Maker: Create & Verify Digital Certificates
        </h1>
        <p className="certvault-hero-subtext" style={styles.heroSubtext}>
          Issue branded certificates, generate in bulk from CSV, and let anyone verify authenticity. 
          Hosted and verified via CertVault—by GradeX.
        </p>
        <div className="certvault-cta-row" style={styles.ctaRow}>
          <Link to="/for-clubs" style={styles.ctaPrimary}>
            Start for free
          </Link>
          <Link to="/verify" style={styles.ctaSecondary}>
            Verify Certificate
          </Link>
        </div>
      </section>

      {/* Trusted by */}
      <section style={styles.trusted}>
        <p style={styles.trustedLabel}>Trusted by clubs & organizations</p>
        <div className="certvault-trusted-logos" style={styles.trustedLogos}>
          <span className="certvault-trusted-logo" style={styles.trustedLogo}>IEEE SRM</span>
          <span className="certvault-trusted-logo" style={styles.trustedLogo}>GradeX</span>
          <span className="certvault-trusted-logo" style={styles.trustedLogo}>Student Clubs</span>
        </div>
      </section>

      {/* Feature cards - Certifier style, 3 side by side */}
      <section style={styles.section}>
        <h2 className="certvault-section-title" style={styles.sectionTitle}>The complete certificate platform</h2>
        <p style={styles.sectionSub}>CertVault helps you design, generate, send, and verify digital credentials.</p>
        <div className="certvault-feature-grid" style={styles.featureGrid}>
          {FEATURES.map((f, i) => (
            <div key={i} style={styles.featureCard}>
              <h3 className="certvault-feature-title" style={styles.featureTitle}>{f.title}</h3>
              <p className="certvault-feature-desc" style={styles.featureDesc}>{f.desc}</p>
              <Link to={f.link} style={styles.featureLink}>{f.cta} →</Link>
            </div>
          ))}
        </div>
      </section>

      {/* Workflow: Design → Generate → Send → Verify */}
      <section style={styles.section}>
        <h2 className="certvault-section-title" style={styles.sectionTitle}>How it works</h2>
        <div className="certvault-workflow" style={styles.workflow}>
          {WORKFLOW.map((w, i) => (
            <div key={i} style={styles.workflowStep}>
              <span style={styles.workflowNum}>{i + 1}</span>
              <h4 className="certvault-workflow-label" style={styles.workflowLabel}>{w.label}</h4>
              <p className="certvault-workflow-desc" style={styles.workflowDesc}>{w.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bulk generator features */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Bulk certificate generator</h2>
        <p style={styles.sectionSub}>Generate, issue, and verify certificates in bulk.</p>
        <div style={styles.bulkList}>
          {BULK_FEATURES.map((item, i) => (
            <div key={i} className="certvault-bulk-item" style={styles.bulkItem}>
              <span style={styles.check}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </span>
              <span>{item}</span>
            </div>
          ))}
        </div>
        <div style={styles.ctaRow}>
          <Link to="/login" style={styles.ctaPrimary}>Club Login</Link>
        </div>
      </section>

      {/* Benefits */}
      <section style={styles.section}>
        <h2 className="certvault-section-title" style={styles.sectionTitle}>Benefits of CertVault</h2>
        <div className="certvault-benefits-grid" style={styles.benefitsGrid}>
          {BENEFITS.map((b, i) => (
            <div key={i} style={styles.benefitCard}>
              <h4 className="certvault-benefit-title" style={styles.benefitTitle}>{b.title}</h4>
              <p className="certvault-benefit-desc" style={styles.benefitDesc}>{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>FAQ</h2>
        <div style={styles.faqList}>
          {FAQ.map((item, i) => (
            <div
              key={i}
              style={styles.faqItem}
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
            >
              <div style={styles.faqQuestion}>
                <span>{item.q}</span>
                <span style={styles.faqIcon}>{openFaq === i ? '−' : '+'}</span>
              </div>
              {openFaq === i && <p style={styles.faqAnswer}>{item.a}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section style={styles.finalCta}>
        <h2 style={styles.finalTitle}>Ready to issue certificates?</h2>
        <p style={styles.finalSub}>Join clubs and organizations using CertVault.</p>
        <div style={styles.ctaRow}>
          <Link to="/for-clubs" style={styles.ctaPrimary}>Start for free</Link>
          <Link to="/verify" style={styles.ctaSecondary}>Verify Certificate</Link>
        </div>
      </section>
    </CertVaultLayout>
  );
}

const styles = {
  hero: {
    textAlign: 'center',
    padding: '64px 24px 80px',
  },
  heroTitle: {
    fontFamily: "'AmericanCaptain', 'Bebas Neue', sans-serif",
    fontSize: 'clamp(28px, 4.5vw, 44px)',
    fontWeight: 400,
    letterSpacing: '0.04em',
    color: theme.text,
    margin: '0 0 20px',
    lineHeight: 1.15,
    maxWidth: 800,
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  heroSubtext: {
    fontFamily: '"Inter", "Space Grotesk", sans-serif',
    fontSize: 'clamp(16px, 2vw, 19px)',
    color: theme.textSecondary,
    margin: '0 auto 36px',
    maxWidth: 640,
    lineHeight: 1.6,
  },
  ctaRow: {
    display: 'flex',
    gap: 16,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  ctaPrimary: {
    display: 'inline-block',
    padding: '14px 28px',
    backgroundColor: theme.accent,
    color: '#fff',
    fontSize: 16,
    fontWeight: 600,
    textDecoration: 'none',
    borderRadius: 8,
    transition: 'all 0.2s ease',
  },
  ctaSecondary: {
    display: 'inline-block',
    padding: '14px 28px',
    backgroundColor: 'transparent',
    color: theme.accent,
    fontSize: 16,
    fontWeight: 600,
    textDecoration: 'none',
    borderRadius: 8,
    border: `1px solid ${theme.border}`,
    transition: 'all 0.2s ease',
  },
  trusted: {
    textAlign: 'center',
    padding: '32px 24px 48px',
  },
  trustedLabel: {
    fontSize: 14,
    color: theme.textMuted,
    margin: '0 0 24px',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  trustedLogos: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trustedLogo: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 18,
    fontWeight: 600,
    letterSpacing: '0.05em',
    color: theme.textSecondary,
  },
  section: {
    padding: '56px 24px',
    borderTop: `1px solid ${theme.border}`,
    maxWidth: 1100,
    margin: '0 auto',
  },
  sectionTitle: {
    fontFamily: "'AmericanCaptain', 'Bebas Neue', sans-serif",
    fontSize: 'clamp(22px, 3vw, 28px)',
    fontWeight: 400,
    letterSpacing: '0.03em',
    color: theme.text,
    margin: '0 0 12px',
    textAlign: 'center',
  },
  sectionSub: {
    fontSize: 16,
    color: theme.textSecondary,
    margin: '0 0 40px',
    textAlign: 'center',
    lineHeight: 1.5,
  },
  featureGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 24,
  },
  featureCard: {
    padding: 28,
    backgroundColor: theme.bgCard,
    borderRadius: 12,
    border: `1px solid ${theme.border}`,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  featureTitle: {
    fontFamily: "'Space Grotesk', Inter, sans-serif",
    fontSize: 18,
    fontWeight: 600,
    color: theme.text,
    margin: '0 0 12px',
  },
  featureDesc: {
    fontSize: 14,
    color: theme.textSecondary,
    margin: '0 0 20px',
    lineHeight: 1.6,
  },
  featureLink: {
    fontSize: 14,
    fontWeight: 600,
    color: theme.accent,
    textDecoration: 'none',
  },
  workflow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 24,
  },
  workflowStep: {
    padding: 24,
    textAlign: 'center',
  },
  workflowNum: {
    display: 'inline-block',
    width: 40,
    height: 40,
    lineHeight: '40px',
    textAlign: 'center',
    backgroundColor: theme.accentLight,
    borderRadius: 10,
    fontSize: 16,
    fontWeight: 600,
    color: theme.accent,
    marginBottom: 16,
  },
  workflowLabel: {
    fontSize: 16,
    fontWeight: 600,
    color: theme.text,
    margin: '0 0 8px',
  },
  workflowDesc: {
    fontSize: 13,
    color: theme.textSecondary,
    margin: 0,
    lineHeight: 1.5,
  },
  bulkList: {
    maxWidth: 560,
    margin: '0 auto 32px',
  },
  bulkItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
    fontSize: 15,
    color: theme.textSecondary,
  },
  check: {
    color: theme.success,
    fontWeight: 700,
    fontSize: 18,
  },
  benefitsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 24,
  },
  benefitCard: {
    padding: 24,
    backgroundColor: theme.bgCard,
    borderRadius: 10,
    border: `1px solid ${theme.border}`,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  benefitTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: theme.text,
    margin: '0 0 8px',
    textTransform: 'capitalize',
  },
  benefitDesc: {
    fontSize: 14,
    color: theme.textSecondary,
    margin: 0,
    lineHeight: 1.5,
  },
  faqList: {
    maxWidth: 640,
    margin: '0 auto',
  },
  faqItem: {
    borderBottom: `1px solid ${theme.border}`,
    padding: '20px 0',
    cursor: 'pointer',
  },
  faqQuestion: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 15,
    fontWeight: 500,
    color: theme.text,
  },
  faqIcon: {
    fontSize: 20,
    color: theme.textMuted,
  },
  faqAnswer: {
    fontSize: 14,
    color: theme.textSecondary,
    margin: '16px 0 0',
    lineHeight: 1.6,
  },
  finalCta: {
    textAlign: 'center',
    padding: '80px 24px 100px',
    borderTop: `1px solid ${theme.border}`,
  },
  finalTitle: {
    fontFamily: "'AmericanCaptain', 'Bebas Neue', sans-serif",
    fontSize: 'clamp(24px, 3.5vw, 32px)',
    fontWeight: 400,
    letterSpacing: '0.04em',
    color: theme.text,
    margin: '0 0 12px',
  },
  finalSub: {
    fontSize: 16,
    color: theme.textSecondary,
    margin: '0 0 32px',
  },
};
