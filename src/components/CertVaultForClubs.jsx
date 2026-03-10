/**
 * CertVault For Clubs / Organizations page.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import CertVaultLayout from './CertVaultLayout';
import { certVaultTheme as theme } from '../theme';

export default function CertVaultForClubs() {
  return (
    <CertVaultLayout>
      <style>{`
        @media (max-width: 768px) {
          .certvault-for-clubs-wrap {
            padding: 0 12px !important;
          }
          .certvault-for-clubs-title {
            font-size: 20px !important;
            white-space: nowrap !important;
          }
          .certvault-for-clubs-lead {
            font-size: 13px !important;
          }
          .certvault-for-clubs-features {
            padding-left: 18px !important;
            font-size: 13px !important;
          }
          .certvault-for-clubs-note {
            font-size: 12px !important;
            padding: 12px !important;
          }
          .certvault-for-clubs-cta {
            font-size: 13px !important;
            padding: 10px 20px !important;
            white-space: nowrap !important;
          }
        }
      `}</style>
      <div className="certvault-for-clubs-wrap" style={styles.wrap}>
        <h1 className="certvault-for-clubs-title" style={styles.title}>For Clubs & Organizations</h1>
        <p className="certvault-for-clubs-lead" style={styles.lead}>
          Issue certificates for your events. CertVault generates unique Certificate IDs, hosts records, and enables public verification.
        </p>

        <ul className="certvault-for-clubs-features" style={styles.features}>
          <li>Create events and add participants (CSV: Name, Email, Category)</li>
          <li>Generate certificates — Certificate IDs are assigned by CertVault</li>
          <li>View and manage issued certificates</li>
          <li>Revoke certificates if needed</li>
        </ul>

        <p className="certvault-for-clubs-note" style={styles.note}>
          Certificates are issued by your organization. CertVault does not certify skills or conduct events. Hosted & verified via CertVault.
        </p>

        <Link to="/login" className="certvault-for-clubs-cta" style={styles.cta}>Club Login</Link>
      </div>
    </CertVaultLayout>
  );
}

const styles = {
  wrap: { maxWidth: 640, margin: '0 auto', textAlign: 'center' },
  title: { fontFamily: "'AmericanCaptain', 'Bebas Neue', sans-serif", fontSize: 28, fontWeight: 400, letterSpacing: '0.03em', color: theme.text, margin: '0 0 16px' },
  lead: { fontFamily: '"Inter", "Space Grotesk", sans-serif', fontSize: 16, color: theme.textSecondary, margin: '0 0 24px', lineHeight: 1.6 },
  features: { paddingLeft: 24, margin: '0 auto 24px', color: theme.textSecondary, fontSize: 15, lineHeight: 1.8, textAlign: 'left' },
  note: { fontSize: 14, color: theme.textSecondary, margin: '0 0 32px', lineHeight: 1.6, padding: 16, backgroundColor: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 8, textAlign: 'left' },
  cta: { display: 'inline-block', padding: '12px 24px', backgroundColor: theme.accent, color: '#fff', fontSize: 15, fontWeight: 500, textDecoration: 'none', borderRadius: 8, transition: 'all 0.2s ease' },
};
