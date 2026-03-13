/**
 * CertVault How It Works – from Stitch screen-3 (stitch-assets/screens/screen-3-*.html).
 */
import React from 'react';
import { Link } from 'react-router-dom';
import CertVaultLayout from './CertVaultLayout';

const STEPS = [
  { icon: 'upload_file', title: '1. Upload Credentials', desc: 'Securely upload your professional certificates in any standard format.' },
  { icon: 'verified_user', title: '2. Secure Verification', desc: 'Our system validates the authenticity of your documents via encrypted anchors.' },
  { icon: 'lock', title: '3. Encrypted Storage', desc: 'Your data is stored in a private vault with enterprise-grade protection.' },
  { icon: 'share', title: '4. Instant Sharing', desc: 'Share verified links with employers or organizations in a single click.' },
];

export default function CertVaultHowItWorks() {
  return (
    <CertVaultLayout>
      <main className="flex flex-1 flex-col items-center px-6 py-20 md:py-32 min-h-screen">
        <div className="max-w-[720px] w-full flex flex-col items-center">
          <div className="text-center mb-20">
            <h1 className="text-[var(--apple-text-primary)] text-4xl md:text-5xl font-extrabold tracking-tight mb-6">
              How it works
            </h1>
            <p className="text-[var(--apple-text-secondary)] text-lg md:text-xl font-medium leading-relaxed">
              A seamless, secure workflow for managing your digital credentials.
            </p>
          </div>
          <div className="w-full space-y-16">
            {STEPS.map((step, i) => (
              <div key={i} className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-8 text-center md:text-left">
                <div className="flex-shrink-0 flex items-center justify-center size-12 rounded-xl bg-slate-100 text-[var(--apple-accent)]">
                  <span className="material-symbols-outlined text-2xl">{step.icon}</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-[var(--apple-text-primary)] text-xl font-bold mb-2">{step.title}</h3>
                  <p className="text-[var(--apple-text-secondary)] text-base">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-24 w-full">
            <Link to="/verify" className="w-full sm:w-auto flex min-w-[200px] items-center justify-center rounded-xl bg-[var(--apple-accent)] h-14 px-8 text-white text-base font-bold shadow-lg shadow-blue-500/20 hover:opacity-90 transition-all">
              Verify Certificate
            </Link>
            <Link to="/for-clubs" className="w-full sm:w-auto flex min-w-[200px] items-center justify-center rounded-xl border-2 border-slate-200 h-14 px-8 text-[var(--apple-text-primary)] text-base font-bold hover:bg-slate-50 transition-colors">
              For Clubs
            </Link>
          </div>
        </div>
      </main>
    </CertVaultLayout>
  );
}
