/**
 * Universal fixed header matching Stitch Features page (ventarc-features-dark).
 * Dark #131313, VENTARC logo, Features / Solutions / Pricing / Resources, Login, Create Event.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const NAV_LINKS = [
  { path: '/features', label: 'Features' },
  { path: '/solutions', label: 'Solutions' },
  { path: '/pricing', label: 'Pricing' },
  { path: '/resources', label: 'Resources' },
];

export default function VentarcHeader({
  dashboardOrganization = null,
  onDashboardLogout = null,
  minimal = false,
}) {
  const location = useLocation();
  const dashboardMenuRef = useRef(null);
  const [dashboardMenuOpen, setDashboardMenuOpen] = useState(false);
  const isDashboard = location.pathname === '/dashboard';
  const isVerify = location.pathname === '/certvault/verify' || location.pathname === '/verify';
  const showMarketingHeaderItems = !minimal && !isDashboard && !isVerify;
  const brandLabel = isDashboard ? 'CERTVAULT' : 'VENTARC';
  const showCenteredBrand = !isDashboard && !showMarketingHeaderItems;
  const showDashboardTagline = isDashboard;

  useEffect(() => {
    if (!dashboardMenuOpen) return undefined;

    function handlePointerDown(event) {
      if (!dashboardMenuRef.current?.contains(event.target)) {
        setDashboardMenuOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [dashboardMenuOpen]);

  return (
    <nav className="fixed top-0 left-0 right-0 z-[100]">
      <div className="absolute inset-x-0 top-0 h-20 border-b border-white/[0.08] bg-[linear-gradient(180deg,rgba(7,11,18,0.78)_0%,rgba(7,11,18,0.58)_100%)] backdrop-blur-xl" />
      <div
        className="relative flex h-20 w-full items-center justify-between gap-6 px-4 md:px-6 xl:px-8"
        style={{ fontFamily: 'Inter, sans-serif' }}
      >
        {showCenteredBrand ? (
          <div className="pointer-events-none absolute inset-x-0 hidden justify-center md:flex">
            <div className="flex flex-col items-center text-center">
              <div
                className="text-lg font-black tracking-[-0.08em] text-white"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                VENTARC
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/55">
                A GradeX Product
              </div>
            </div>
          </div>
        ) : null}

        {showDashboardTagline ? (
          <div className="pointer-events-none absolute inset-x-0 hidden justify-center md:flex">
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/60">
              A GradeX Product
            </div>
          </div>
        ) : null}

        <Link to="/" className="flex min-w-0 items-center no-underline">
          <div
            className="text-3xl md:text-[2.15rem] font-black tracking-[-0.08em] text-white transition-opacity hover:opacity-90"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            {brandLabel}
          </div>
        </Link>

        {showMarketingHeaderItems ? (
          <div className="hidden items-center gap-2 rounded-full border border-white/[0.1] bg-[#0a0f16]/70 p-1 md:flex backdrop-blur-md">
            {NAV_LINKS.map(({ path, label }) => {
              const isActive = location.pathname === path;
              return (
                <Link
                  key={path}
                  to={path}
                  className={`rounded-full px-4 py-2 text-sm font-medium tracking-tight no-underline transition-all duration-300 ${
                    isActive
                      ? 'bg-[#1a2230] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
                      : 'hover:bg-white/[0.05]'
                  }`}
                  style={{
                    color: '#ffffff',
                    textShadow: '0 1px 8px rgba(0,0,0,0.35)',
                  }}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="hidden md:block" />
        )}

        {isDashboard ? (
          <div ref={dashboardMenuRef} className="relative flex items-center">
            <button
              type="button"
              onClick={() => setDashboardMenuOpen((open) => !open)}
              className="rounded border border-white/[0.1] bg-[#0a0f16]/70 px-4 py-2 text-right text-sm text-white/90 backdrop-blur-md transition hover:bg-[#111a26]"
              aria-expanded={dashboardMenuOpen}
              aria-haspopup="menu"
            >
              <div className="font-semibold leading-tight text-white">
                {dashboardOrganization?.name || 'Organizer'}
              </div>
              <div className="text-xs leading-tight text-white/65">
                {dashboardOrganization?.email || 'Signed in'}
              </div>
            </button>

            {dashboardMenuOpen && (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] min-w-[180px] rounded-2xl border border-white/[0.1] bg-[#0a0f16]/95 p-2 shadow-2xl backdrop-blur-xl">
                <button
                  type="button"
                  onClick={() => {
                    setDashboardMenuOpen(false);
                    onDashboardLogout?.();
                  }}
                  className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-white transition hover:bg-white/[0.08]"
                  role="menuitem"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        ) : showMarketingHeaderItems ? (
          <div className="flex items-center gap-3">
            <Link to="/login" className="ventarc-btn-secondary hidden sm:inline-flex">
              Login
            </Link>
            <Link to="/dashboard" className="ventarc-btn-primary">
              Create Event
            </Link>
          </div>
        ) : (
          <div className="hidden md:block" />
        )}
      </div>
    </nav>
  );
}
