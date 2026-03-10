/**
 * CertVault How It Works page.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import CertVaultLayout from './CertVaultLayout';
import { certVaultTheme as theme } from '../theme';

export default function CertVaultHowItWorks() {
  return (
    <CertVaultLayout>
      <style>{`
        @media (max-width: 768px) {
          .certvault-how-it-works-wrap {
            padding: 0 12px !important;
          }
          .certvault-how-it-works-title {
            font-size: 20px !important;
            white-space: nowrap !important;
          }
          .certvault-how-it-works-lead {
            font-size: 13px !important;
          }
          .certvault-how-it-works-list {
            padding-left: 18px !important;
            max-width: 100% !important;
            font-size: 13px !important;
          }
          .certvault-how-it-works-list-item {
            font-size: 13px !important;
            margin-bottom: 12px !important;
          }
          .certvault-how-it-works-disclaimer {
            font-size: 12px !important;
            padding: 12px !important;
          }
          .certvault-how-it-works-actions {
            flex-direction: column !important;
            gap: 10px !important;
          }
          .certvault-how-it-works-actions a {
            width: 100% !important;
            font-size: 13px !important;
            padding: 10px 20px !important;
            white-space: nowrap !important;
          }
        }
      `}</style>
      <div className="certvault-how-it-works-wrap" style={styles.wrap}>
        <h1 className="certvault-how-it-works-title" style={styles.title}>How It Works</h1>
        <p className="certvault-how-it-works-lead" style={styles.lead}>
          CertVault provides certificate hosting and verification. Organizations issue certificates; CertVault generates IDs and hosts records.
        </p>

        <ol className="certvault-how-it-works-list" style={styles.list}>
          <li className="certvault-how-it-works-list-item" style={styles.listItem}>
            <strong>Organizations create events.</strong> Clubs sign in and create an event (e.g. workshop, hackathon).
          </li>
          <li className="certvault-how-it-works-list-item" style={styles.listItem}>
            <strong>Participants are added.</strong> Upload a CSV (Name, Email, Category) or add participants manually.
          </li>
          <li className="certvault-how-it-works-list-item" style={styles.listItem}>
            <strong>Certificates are generated.</strong> CertVault assigns a unique Certificate ID to each certificate. Organizations cannot edit IDs.
          </li>
          <li className="certvault-how-it-works-list-item" style={styles.listItem}>
            <strong>Anyone can verify.</strong> Use the Verify Certificate page with the Certificate ID. No login required.
          </li>
        </ol>

        <p className="certvault-how-it-works-disclaimer" style={styles.disclaimer}>
          CertVault does not conduct events or certify skills. Certificates are issued by respective organizations. Hosted & verified via CertVault.
        </p>

        <div className="certvault-how-it-works-actions" style={styles.actions}>
          <Link to="/verify" style={styles.btn}>Verify Certificate</Link>
          <Link to="/for-clubs" style={styles.btnSecondary}>For Clubs</Link>
        </div>
      </div>
    </CertVaultLayout>
  );
}

const styles = {
  wrap: { maxWidth: 640, margin: '0 auto', textAlign: 'center' },
  title: { fontFamily: "'AmericanCaptain', 'Bebas Neue', sans-serif", fontSize: 28, fontWeight: 400, letterSpacing: '0.03em', color: theme.text, margin: '0 0 16px' },
  lead: { fontFamily: '"Inter", "Space Grotesk", sans-serif', fontSize: 16, color: theme.textSecondary, margin: '0 0 32px', lineHeight: 1.6 },
  list: { paddingLeft: 24, margin: '0 auto 32px', textAlign: 'left', maxWidth: 560 },
  listItem: { fontSize: 15, color: theme.textSecondary, marginBottom: 16, lineHeight: 1.6 },
  disclaimer: { fontSize: 14, color: theme.textSecondary, margin: '0 0 32px', lineHeight: 1.6, padding: 16, backgroundColor: theme.bgCard, border: `1px solid ${theme.border}`, borderRadius: 8, textAlign: 'left' },
  actions: { display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' },
  btn: { display: 'inline-block', padding: '12px 24px', backgroundColor: theme.accent, color: '#fff', fontSize: 15, fontWeight: 500, textDecoration: 'none', borderRadius: 8, transition: 'all 0.2s ease' },
  btnSecondary: { display: 'inline-block', padding: '12px 24px', backgroundColor: 'transparent', color: theme.accent, fontSize: 15, fontWeight: 500, textDecoration: 'none', borderRadius: 8, border: `1px solid ${theme.border}`, transition: 'all 0.2s ease' },
};
