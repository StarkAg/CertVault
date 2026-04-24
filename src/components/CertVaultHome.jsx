/**
 * Ventarc Home – exact Stitch export.
 * Structure and classes match stitch-ventarc-hero.html from Stitch (projects/4726697925696762711).
 */
import React from 'react';
import { Link } from 'react-router-dom';

const STITCH_PRIMARY = '#0d20f2';
const STITCH_BG_DARK = '#101122';

export default function CertVaultHome() {
  return (
    <div
      className="relative min-h-screen flex flex-col overflow-x-hidden antialiased"
      style={{ background: STITCH_BG_DARK, fontFamily: 'Inter, sans-serif', color: '#f1f5f9' }}
    >
      {/* Animated Background – exact Stitch */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute bottom-0 left-[-50%] right-[-50%] h-[614px] stitch-perspective-grid opacity-30"
          aria-hidden
        />
        <div
          className="stitch-orb w-96 h-96 top-[-10%] left-[-5%]"
          style={{ background: `rgba(13, 32, 242, 0.3)` }}
          aria-hidden
        />
        <div
          className="stitch-orb w-[500px] h-[500px] bottom-[10%] right-[-10%]"
          style={{ background: 'rgba(147, 51, 234, 0.2)', filter: 'blur(120px)' }}
          aria-hidden
        />
        <div
          className="stitch-orb w-64 h-64 top-[40%] right-[20%]"
          style={{ background: 'rgba(96, 165, 250, 0.1)', filter: 'blur(80px)' }}
          aria-hidden
        />
        <div
          className="absolute top-0 left-1/4 w-[1px] h-screen rotate-12"
          style={{
            background: `linear-gradient(to bottom, ${STITCH_PRIMARY}00, ${STITCH_PRIMARY}33, ${STITCH_PRIMARY}00)`,
          }}
          aria-hidden
        />
        <div
          className="absolute top-0 right-1/3 w-[1px] h-screen -rotate-6"
          style={{
            background: 'linear-gradient(to bottom, rgba(168,85,247,0), rgba(168,85,247,0.1), rgba(168,85,247,0))',
          }}
          aria-hidden
        />
      </div>

      {/* Header – exact Stitch */}
      <header className="relative z-50 flex items-center justify-between px-6 py-6 lg:px-20 border-b border-white/10 stitch-glass">
        <Link to="/" className="flex items-center gap-3 no-underline">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shadow-lg"
            style={{ background: STITCH_PRIMARY, boxShadow: `0 10px 40px ${STITCH_PRIMARY}33` }}
          >
            <span className="material-symbols-outlined text-white text-2xl">change_history</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">Ventarc</h2>
        </Link>
        <nav className="hidden md:flex items-center gap-10">
          <a href="/features" className="text-sm font-medium text-slate-300 hover:text-white transition-colors no-underline">
            Features
          </a>
          <a href="/solutions" className="text-sm font-medium text-slate-300 hover:text-white transition-colors no-underline">
            Solutions
          </a>
          <a href="/pricing" className="text-sm font-medium text-slate-300 hover:text-white transition-colors no-underline">
            Pricing
          </a>
          <a href="/resources" className="text-sm font-medium text-slate-300 hover:text-white transition-colors no-underline">
            Resources
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="hidden sm:flex px-5 py-2 text-sm font-bold text-white stitch-glass hover:bg-white/10 rounded-lg transition-all no-underline"
          >
            Sign In
          </Link>
          <Link
            to="/login"
            className="px-5 py-2 text-sm font-bold text-white rounded-lg transition-all no-underline hover:brightness-110"
            style={{ background: STITCH_PRIMARY, boxShadow: `0 10px 40px ${STITCH_PRIMARY}4D` }}
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero – exact Stitch two-column + glass card */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 lg:px-20 py-20">
        <div className="max-w-[1200px] w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left column */}
          <div className="flex flex-col gap-8 text-left">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full w-fit border"
              style={{ background: `${STITCH_PRIMARY}1A`, borderColor: `${STITCH_PRIMARY}33` }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: STITCH_PRIMARY }} />
              <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: STITCH_PRIMARY }}>
                v2.0 Now Live
              </span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black leading-[1.1] tracking-tight text-white">
              Run Events. <br />
              <span className="stitch-text-gradient">Without the Chaos.</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-400 leading-relaxed max-w-xl">
              Ventarc is your all-in-one platform to manage events — from registrations and QR check-ins to automated
              emails and verified certificates.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <Link
                to="/login"
                className="px-8 py-4 text-white font-bold rounded-lg flex items-center gap-2 hover:scale-[1.02] active:scale-95 transition-all no-underline"
                style={{ background: STITCH_PRIMARY, boxShadow: `0 25px 50px -12px ${STITCH_PRIMARY}66` }}
              >
                Get Started
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </Link>
              <Link
                to="/for-clubs"
                className="px-8 py-4 stitch-glass text-white font-bold rounded-lg hover:bg-white/5 transition-all no-underline"
              >
                Host an Event
              </Link>
            </div>
            <div className="flex items-center gap-6 mt-4">
              <div className="flex -space-x-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="w-10 h-10 rounded-full border-2 flex items-center justify-center overflow-hidden bg-slate-800"
                    style={{ borderColor: STITCH_BG_DARK }}
                  >
                    <div className="w-full h-full bg-slate-600 rounded-full" />
                  </div>
                ))}
              </div>
              <p className="text-sm text-slate-500">
                <span className="text-white font-bold">1,200+</span> organizers joined this week
              </p>
            </div>
          </div>

          {/* Right column – glass event pass card */}
          <div className="relative h-[500px] flex items-center justify-center">
            <div className="stitch-glass-card w-80 h-[450px] rounded-2xl p-8 flex flex-col justify-between relative z-20 overflow-hidden transform rotate-6 hover:rotate-0 transition-transform duration-700">
              <div
                className="absolute top-0 right-0 w-32 h-32 blur-3xl rounded-full"
                style={{ background: `${STITCH_PRIMARY}33` }}
              />
              <div className="flex justify-between items-start">
                <div className="w-12 h-12 stitch-glass rounded-xl flex items-center justify-center">
                  <span className="material-symbols-outlined" style={{ color: STITCH_PRIMARY }}>
                    verified
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Pass ID</p>
                  <p className="text-xs font-mono text-white">#VTC-2024-882</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <h3 className="text-2xl font-black text-white leading-tight">GLOBAL TECH SUMMIT</h3>
                  <p className="text-xs font-bold mt-1" style={{ color: STITCH_PRIMARY }}>
                    NEW YORK CITY • 2024
                  </p>
                </div>
                <div className="py-4 border-y border-white/10 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Attendee</span>
                    <span className="text-xs text-white">Sarah Jenkins</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Access</span>
                    <span className="text-xs text-white">VIP All-Access</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-center gap-4">
                <div className="w-full h-12 bg-white flex items-center justify-center rounded-lg p-1">
                  <div className="w-full h-full bg-slate-900 rounded flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-3xl">qr_code_2</span>
                  </div>
                </div>
                <p className="text-[8px] text-slate-500 tracking-tighter uppercase font-bold">
                  Encrypted via Ventarc Protocol
                </p>
              </div>
            </div>
            <div className="absolute top-10 right-[-20px] w-24 h-24 stitch-glass rounded-full flex items-center justify-center z-10 blur-[1px]">
              <span className="material-symbols-outlined text-white text-3xl opacity-50">calendar_today</span>
            </div>
            <div className="absolute bottom-10 left-[-20px] w-32 h-32 stitch-glass rounded-2xl flex items-center justify-center z-30 blur-[2px] -rotate-12">
              <span className="material-symbols-outlined text-white text-5xl opacity-40">mail</span>
            </div>
          </div>
        </div>
      </main>

      {/* Stats – exact Stitch */}
      <section className="relative z-10 px-6 lg:px-20 pb-20">
        <div className="max-w-[1200px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Events Hosted', value: '10k+', extra: '15%', green: true },
            { label: 'Satisfaction', value: '99.9%', extra: '5%', green: true },
            { label: 'Check-in', value: '< 2s', extra: '40%', green: true },
            { label: 'Success Rate', value: '100%', extra: 'Verified', green: false },
          ].map((stat, i) => (
            <div key={i} className="p-8 stitch-glass rounded-2xl border-white/5 flex flex-col gap-2">
              <p className="text-slate-400 text-sm font-medium">{stat.label}</p>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-black text-white">{stat.value}</p>
                <p
                  className={`text-xs font-bold pb-1 flex items-center ${
                    stat.green ? 'text-green-400' : ''
                  }`}
                  style={!stat.green ? { color: STITCH_PRIMARY } : {}}
                >
                  {stat.green && <span className="material-symbols-outlined text-xs">trending_up</span>}
                  {stat.extra}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bokeh dots – exact Stitch */}
      <div className="absolute top-[30%] left-[10%] w-4 h-4 rounded-full bg-white opacity-20 blur-sm pointer-events-none" />
      <div
        className="absolute top-[60%] right-[15%] w-6 h-6 rounded-full opacity-30 blur-md pointer-events-none"
        style={{ background: STITCH_PRIMARY }}
      />
      <div className="absolute bottom-[20%] left-[40%] w-3 h-3 rounded-full bg-purple-500 opacity-20 blur-sm pointer-events-none" />

      {/* Minimal footer – link to rest of site */}
      <footer className="relative z-10 border-t border-white/10 py-8 px-6 lg:px-20">
        <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 text-sm">Event Management, Reimagined.</p>
          <div className="flex items-center gap-6">
            <Link to="/how-it-works" className="text-sm text-slate-400 hover:text-white transition-colors no-underline">
              How It Works
            </Link>
            <Link to="/verify" className="text-sm text-slate-400 hover:text-white transition-colors no-underline">
              Verify
            </Link>
            <Link to="/login" className="text-sm font-medium no-underline" style={{ color: STITCH_PRIMARY }}>
              Login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
