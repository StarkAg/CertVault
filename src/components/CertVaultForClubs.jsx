/**
 * CertVault For Clubs – from Stitch screen-7 (stitch-assets/screens/screen-7-*.html).
 */
import React from 'react';
import { Link } from 'react-router-dom';
import CertVaultLayout from './CertVaultLayout';

const FEATURES = [
  { icon: 'event_available', title: 'Event Management', desc: 'Organize and issue certificates for workshops and seminars.' },
  { icon: 'upload_file', title: 'CSV Smart Upload', desc: 'Bulk import member data and issue hundreds of credentials instantly.' },
  { icon: 'fingerprint', title: 'Unique IDs', desc: 'Every certificate features a cryptographically secure unique identifier.' },
  { icon: 'alternate_email', title: 'Mass Email Delivery', desc: 'Automated delivery system with customizable email templates.' },
  { icon: 'clinical_notes', title: 'Centralized Management', desc: "A unified dashboard to oversee your entire organization's records." },
  { icon: 'do_not_disturb_on', title: 'Instant Revocation', desc: 'Maintain data integrity by revoking invalid or expired credentials.' },
];

export default function CertVaultForClubs() {
  return (
    <CertVaultLayout>
      <main className="flex flex-1 flex-col items-center pt-20 pb-24 px-6 min-h-screen">
        <div className="max-w-[640px] w-full flex flex-col items-center text-center">
          <h1 className="text-3xl sm:text-[40px] font-bold tracking-tight leading-[1.1] text-[var(--apple-text-primary)] mb-6">
            For Clubs & Organizations
          </h1>
          <p className="text-lg sm:text-[21px] text-[var(--apple-text-secondary)] font-normal leading-relaxed mb-12">
            Streamline your credentialing process with enterprise-grade tools built for student clubs, non-profits, and professional associations.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-8 text-left w-full mb-16">
            {FEATURES.map((f, i) => (
              <div key={i} className="flex items-start gap-4">
                <span className="material-symbols-outlined text-[var(--apple-accent)] mt-0.5"> {f.icon}</span>
                <div>
                  <h3 className="font-semibold text-[var(--apple-text-primary)]">{f.title}</h3>
                  <p className="text-sm text-[var(--apple-text-secondary)]">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-20 w-full sm:w-auto">
            <Link to="/login" className="w-full sm:w-auto min-w-[200px] rounded-full bg-[var(--apple-accent)] px-8 py-4 text-white text-base font-semibold shadow-lg shadow-blue-500/20 hover:opacity-90 transition-all text-center">
              Club Login
            </Link>
            <Link to="/" className="w-full sm:w-auto min-w-[200px] rounded-full bg-white border border-gray-200 px-8 py-4 text-[var(--apple-text-primary)] text-base font-semibold hover:bg-gray-50 transition-all text-center">
              Contact Sales
            </Link>
          </div>
        </div>

        {/* Dashboard preview mockup */}
        <div className="w-full max-w-5xl px-4 mb-24">
          <div className="relative bg-white rounded-3xl border border-gray-200/60 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] overflow-hidden">
            <div className="h-12 border-b border-gray-100 flex items-center px-6 bg-gray-50/50">
              <div className="flex gap-1.5">
                <div className="size-3 rounded-full bg-red-400/20 border border-red-400/40" />
                <div className="size-3 rounded-full bg-amber-400/20 border border-amber-400/40" />
                <div className="size-3 rounded-full bg-emerald-400/20 border border-emerald-400/40" />
              </div>
              <div className="mx-auto text-[11px] font-medium text-[var(--apple-text-secondary)] tracking-wide">
                certvault.io/admin/dashboard
              </div>
            </div>
            <div className="p-8 aspect-[16/9] flex flex-col gap-8">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <div className="h-4 w-32 bg-gray-100 rounded" />
                  <div className="h-8 w-48 bg-gray-200 rounded" />
                </div>
                <div className="flex gap-2">
                  <div className="h-10 w-24 bg-[var(--apple-accent)]/10 rounded-lg" />
                  <div className="h-10 w-10 bg-gray-100 rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-6">
                <div className="h-24 bg-gray-50 rounded-2xl border border-gray-100" />
                <div className="h-24 bg-gray-50 rounded-2xl border border-gray-100" />
                <div className="h-24 bg-gray-50 rounded-2xl border border-gray-100" />
              </div>
              <div className="flex-1 bg-white border border-gray-100 rounded-2xl p-6 shadow-sm overflow-hidden flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-gray-50 pb-4">
                  <div className="h-4 w-40 bg-gray-100 rounded" />
                  <div className="h-4 w-20 bg-gray-100 rounded" />
                </div>
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="size-8 rounded-full bg-gray-100" />
                      <div className="flex-1 h-3 bg-gray-50 rounded" />
                      <div className="w-16 h-3 bg-gray-50 rounded" />
                    </div>
                  ))}
                </div>
                <div className="mt-auto flex justify-center">
                  <span className="text-[12px] font-semibold text-[var(--apple-accent)] uppercase tracking-widest">Dashboard Preview Mockup</span>
                </div>
              </div>
            </div>
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-white via-transparent to-transparent opacity-20" />
          </div>
        </div>

        {/* Disclaimer */}
        <div className="max-w-[640px] w-full">
          <div className="bg-gray-100/50 rounded-2xl p-8 border border-gray-200/40">
            <div className="flex gap-4">
              <span className="material-symbols-outlined text-[var(--apple-text-secondary)]">info</span>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-[var(--apple-text-primary)]">Important Information for Organizations</h4>
                <p className="text-xs text-[var(--apple-text-secondary)] leading-relaxed">
                  CertVault for Clubs is subject to our Organization Data Protection Agreement. Standard accounts are limited to 500 active credentials per event. For higher volume requirements or white-labeling solutions, please contact our enterprise relations team. Security audits are performed quarterly to ensure compliance with global digital credential standards.
                </p>
              </div>
            </div>
          </div>
      </div>
      </main>
    </CertVaultLayout>
  );
}
