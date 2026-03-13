/**
 * CertVault Home – built from Stitch screen-1 HTML (stitch-assets/screens).
 * Uses Tailwind + Stitch CSS variables and .apple-card, .floating-cert, .bg-mesh.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import CertVaultLayout from './CertVaultLayout';

const FEATURES = [
  { icon: 'description', title: 'Digital Certificates', desc: 'High-fidelity digital credentials that are tamper-proof and visually stunning across all devices.', link: '/for-clubs' },
  { icon: 'workspace_premium', title: 'Public Verification', desc: 'Instant QR-based verification that anyone can use to validate the authenticity of a document.', link: '/verify' },
  { icon: 'dynamic_feed', title: 'Bulk Generator', desc: 'Issue thousands of personalized certificates in seconds with our high-speed automation engine.', link: '/for-clubs' },
];

const WORKFLOW = [
  { label: 'Design', desc: 'Create your unique template using our professional design tools.' },
  { label: 'Generate', desc: 'Populate data automatically from your existing records and CSVs.' },
  { label: 'Send', desc: 'Distribute securely via encrypted email or direct public links.' },
  { label: 'Verify', desc: 'Recipients and third-parties verify validity in one single click.' },
];

const BENEFITS = [
  { icon: 'speed', title: 'Save time', desc: 'Automated workflows reduce administrative overhead by up to 90% per batch.' },
  { icon: 'shield', title: 'Verifiable', desc: 'Cryptographically secure signatures ensure every certificate is authentic and immutable.' },
  { icon: 'stars', title: 'Professional', desc: 'Premium presentation that matches the prestige of your global organization.' },
];

const FAQ_ITEMS = [
  { q: 'How secure is the data storage?', a: 'CertVault uses industry-standard encryption and secure cloud storage. Your data and certificate records are protected.' },
  { q: 'Can we integrate with our existing CRM?', a: 'Yes. CertVault supports CSV import and can integrate with your existing participant data. Contact us for API options.' },
  { q: 'What happens if we stop using CertVault?', a: 'Existing certificates remain verifiable. You can export your data. Verification links continue to work.' },
];

export default function CertVaultHome() {
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <CertVaultLayout>
      <main className="w-full max-w-[2560px] mx-auto overflow-hidden">
        {/* Hero */}
        <section className="relative pt-32 pb-48 bg-mesh">
          <div className="max-w-[720px] mx-auto text-center relative z-10 px-6">
            <h1 className="text-4xl sm:text-5xl md:text-[56px] font-bold tracking-[-0.03em] leading-[1.05] mb-6 text-[var(--apple-text-primary)]">
              Your achievements, securely anchored.
            </h1>
            <p className="text-[19px] md:text-[21px] text-[var(--apple-text-secondary)] leading-relaxed mb-10 max-w-[580px] mx-auto">
              The definitive vault for professional certifications and credentials. Issue, manage, and verify with absolute confidence.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/for-clubs" className="bg-[var(--apple-accent)] text-white px-9 py-4 rounded-full font-medium text-[17px] hover:brightness-110 transition-all min-w-[180px] text-center">
                Get Started
              </Link>
              <Link to="/verify" className="border border-[var(--apple-accent)] text-[var(--apple-accent)] px-9 py-4 rounded-full font-medium text-[17px] hover:bg-blue-50/50 transition-all min-w-[180px] text-center">
                View Demo
              </Link>
            </div>
          </div>
          <div className="absolute inset-0 pointer-events-none overflow-hidden hidden xl:block">
            <div className="floating-cert absolute left-[15%] top-[20%] w-72 h-48 apple-card p-6 rotate-[-6deg] opacity-40">
              <div className="flex justify-between items-start mb-8">
                <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-[var(--apple-accent)]">
                  <span className="material-symbols-outlined text-sm">workspace_premium</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">ID: CV-8829-X</span>
              </div>
              <div className="h-2 w-32 bg-slate-100 rounded-full mb-2" />
              <div className="h-2 w-20 bg-slate-50 rounded-full" />
            </div>
            <div className="floating-cert absolute right-[12%] top-[15%] w-72 h-48 apple-card p-6 rotate-[8deg] opacity-40" style={{ animationDelay: '-2s' }}>
              <div className="flex justify-between items-start mb-8">
                <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
                  <span className="material-symbols-outlined text-sm">verified</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">ID: CV-4412-M</span>
              </div>
              <div className="h-2 w-24 bg-slate-100 rounded-full mb-2" />
              <div className="h-2 w-40 bg-slate-50 rounded-full" />
            </div>
          </div>
        </section>

        {/* Trusted by */}
        <section className="border-t border-[var(--apple-border)] bg-white">
          <div className="max-w-[980px] mx-auto py-16 px-6">
            <p className="text-center text-[12px] font-semibold text-[var(--apple-text-secondary)] uppercase tracking-[0.2em] mb-12">Trusted by global leading institutions</p>
            <div className="flex flex-wrap items-center justify-center gap-20 opacity-40 grayscale">
              <span className="text-2xl font-bold tracking-tighter">IEEE CS SRM</span>
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-3xl">groups</span>
                <span className="text-2xl font-bold">Student Clubs</span>
              </div>
            </div>
          </div>
        </section>

        {/* Mass mailing */}
        <section className="bg-white">
          <div className="max-w-[980px] mx-auto py-[120px] px-6 grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div className="apple-card p-12 bg-[#fbfbfd] border-none shadow-none relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8">
                <span className="material-symbols-outlined text-[var(--apple-accent)] text-6xl opacity-10 group-hover:scale-110 transition-transform duration-500">mail</span>
              </div>
              <div className="space-y-4 relative z-10">
                <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-[#e8e8ed] shadow-sm transform translate-x-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-[var(--apple-accent)]">
                    <span className="material-symbols-outlined text-sm">send</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold">Bulk Distribution</p>
                    <p className="text-[10px] text-[var(--apple-text-secondary)]">Sending 1,200 certificates...</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-[#e8e8ed] shadow-sm transform translate-x-12">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold">Template Applied</p>
                    <p className="text-[10px] text-[var(--apple-text-secondary)]">Custom branding active</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-[#e8e8ed] shadow-sm transform translate-x-4">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                    <span className="material-symbols-outlined text-sm">schedule</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold">Automatic Delivery</p>
                    <p className="text-[10px] text-[var(--apple-text-secondary)]">Scheduled for immediate release</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-8">
              <h2 className="text-[40px] font-bold tracking-tight leading-tight">Send certificates instantly to everyone.</h2>
              <p className="text-[18px] text-[var(--apple-text-secondary)] leading-relaxed">
                Streamline your entire certification workflow. Our mass mailing engine handles automatic delivery, custom email templates, and bulk processing with a single click.
              </p>
              <ul className="space-y-4">
                {['Automatic multi-recipient delivery', 'Fully customizable HTML templates', 'Bulk mailing tracking & analytics'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-blue-500">check_circle</span>
                    <span className="text-[17px] font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* The Complete Platform */}
        <section className="max-w-[980px] mx-auto py-[120px] px-6">
          <div className="text-center mb-20">
            <h2 className="text-[40px] font-bold tracking-tight mb-4">The Complete Platform</h2>
            <p className="text-[19px] text-[var(--apple-text-secondary)]">Everything you need to issue and manage credentials.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {FEATURES.map((f, i) => (
              <div key={i} className="apple-card p-12 flex flex-col h-full">
                <span className={`material-symbols-outlined text-[var(--apple-accent)] text-5xl mb-8`}>{f.icon}</span>
                <h3 className="text-2xl font-bold mb-4">{f.title}</h3>
                <p className="text-[var(--apple-text-secondary)] text-[17px] leading-relaxed mb-8">{f.desc}</p>
                <Link to={f.link} className="mt-auto text-[var(--apple-accent)] font-semibold inline-flex items-center group text-[17px]">
                  Learn more <span className="material-symbols-outlined text-sm ml-1 group-hover:translate-x-1 transition-transform">arrow_forward_ios</span>
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* How It Works */}
        <section className="bg-[#ffffff] border-y border-[var(--apple-border)]">
          <div className="max-w-[980px] mx-auto py-[120px] px-6">
            <div className="text-center mb-24">
              <h2 className="text-[40px] font-bold tracking-tight mb-4">How It Works</h2>
              <p className="text-[19px] text-[var(--apple-text-secondary)]">Four steps to absolute credential security.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-16">
              {WORKFLOW.map((w, i) => (
                <div key={i} className="text-center group">
                  <div className="w-16 h-16 bg-[#f5f5f7] rounded-full flex items-center justify-center mx-auto mb-8 text-2xl font-bold group-hover:bg-[var(--apple-accent)] group-hover:text-white transition-all duration-300">{i + 1}</div>
                  <h4 className="font-bold text-xl mb-3">{w.label}</h4>
                  <p className="text-[var(--apple-text-secondary)] text-[16px] leading-relaxed px-4">{w.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits + FAQ */}
        <section className="max-w-[980px] mx-auto py-[120px] px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-40">
            {BENEFITS.map((b, i) => (
              <div key={i} className="apple-card p-10">
                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-[var(--apple-accent)]">{b.icon}</span>
                </div>
                <h3 className="font-bold text-xl mb-4">{b.title}</h3>
                <p className="text-[var(--apple-text-secondary)] text-[17px] leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
          <div className="max-w-[720px] mx-auto">
            <h2 className="text-[32px] font-bold mb-12 text-center">Frequently Asked Questions</h2>
            <div className="space-y-2">
              {FAQ_ITEMS.map((item, i) => (
                <div key={i} className="border-b border-[var(--apple-border)] py-6 group cursor-pointer" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <div className="flex justify-between items-center text-left font-semibold text-lg group-hover:text-[var(--apple-accent)] transition-colors">
                    <span>{item.q}</span>
                    <span className="material-symbols-outlined text-[var(--apple-text-secondary)]">{openFaq === i ? 'expand_less' : 'expand_more'}</span>
                  </div>
                  {openFaq === i && <p className="text-[var(--apple-text-secondary)] text-[17px] mt-4 leading-relaxed">{item.a}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="max-w-[980px] mx-auto pb-32 px-6">
          <div className="apple-card bg-white p-24 text-center">
            <h2 className="text-[48px] font-bold tracking-tight mb-10 leading-none">Ready to issue certificates?</h2>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <Link to="/for-clubs" className="bg-[var(--apple-accent)] text-white px-10 py-4 rounded-full font-medium text-[19px] hover:brightness-110 transition-all shadow-lg shadow-blue-500/20">
                Start for Free
              </Link>
              <Link to="/verify" className="bg-white border border-[#e8e8ed] text-[var(--apple-text-primary)] px-10 py-4 rounded-full font-medium text-[19px] hover:bg-slate-50 transition-all inline-flex items-center">
                Verify Certificate
              </Link>
            </div>
            <p className="mt-8 text-[var(--apple-text-secondary)] text-sm">No credit card required for the free tier.</p>
          </div>
        </section>
      </main>
    </CertVaultLayout>
  );
}
