/**
 * CertVault layout: Stitch design with interactive dot grid and header.
 * - Interactive dot-grid background: dots react to cursor (glow + subtle movement).
 * - Cursor-following soft blue glow for premium feel.
 * - Header from Stitch screen-1: icon + CertVault, A GradeX Product, nav, Login pill.
 */
import React, { useMemo, useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { certVaultTheme as theme } from '../theme';

export const CertVaultLogoContext = createContext(null);

const DOT_COLS = 24;
const DOT_ROWS = 14;
const GLOW_RADIUS_PCT = 18;
const GLOW_INFLUENCE = 0.7;

function InteractiveDotGrid() {
  const containerRef = useRef(null);
  const [mousePct, setMousePct] = useState(null);
  const rafRef = useRef(null);

  const dots = useMemo(() => {
    const list = [];
    for (let r = 0; r < DOT_ROWS; r++) {
      for (let c = 0; c < DOT_COLS; c++) {
        const x = (c / Math.max(1, DOT_COLS - 1)) * 100;
        const y = (r / Math.max(1, DOT_ROWS - 1)) * 100;
        list.push({
          id: `${r}-${c}`,
          x,
          y,
          size: 2 + Math.random() * 1.5,
          baseOpacity: 0.08 + Math.random() * 0.1,
        });
      }
    }
    return list;
  }, []);

  const handleMove = useCallback((e) => {
    if (!containerRef.current) return;
    rafRef.current && cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setMousePct({ x, y });
      rafRef.current = null;
    });
  }, []);

  const handleLeave = useCallback(() => setMousePct(null), []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMove, { passive: true });
    window.addEventListener('mouseleave', handleLeave);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseleave', handleLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [handleMove, handleLeave]);

  return (
    <div
      ref={containerRef}
      className="certvault-dot-grid"
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    >
      {dots.map((d) => {
        let opacity = d.baseOpacity;
        let scale = 1;
        let blur = 0;
        let color = theme.dotColor;
        if (mousePct) {
          const dist = Math.hypot(d.x - mousePct.x, d.y - mousePct.y);
          const t = Math.max(0, 1 - dist / GLOW_RADIUS_PCT);
          const smooth = t * t;
          opacity = Math.min(1, d.baseOpacity + smooth * GLOW_INFLUENCE);
          scale = 1 + smooth * 0.6;
          if (smooth > 0.3) {
            blur = smooth * 2;
            color = 'var(--ventarc-accent, #7c3aed)';
          }
        }
        return (
          <div
            key={d.id}
            className="certvault-dot"
            style={{
              position: 'absolute',
              left: `${d.x}%`,
              top: `${d.y}%`,
              width: d.size,
              height: d.size,
              marginLeft: -d.size / 2,
              marginTop: -d.size / 2,
              borderRadius: '50%',
              background: color,
              opacity,
              transform: `scale(${scale})`,
              boxShadow: blur > 0 ? `0 0 ${blur * 4}px rgba(124, 58, 237, 0.4)` : 'none',
              transition: 'opacity 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease',
            }}
          />
        );
      })}
    </div>
  );
}

function CursorGlowSimple() {
  const [pos, setPos] = useState(null);
  const raf = useRef(null);

  useEffect(() => {
    const onMove = (e) => {
      raf.current && cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => {
        setPos({ x: e.clientX, y: e.clientY });
        raf.current = null;
      });
    };
    const onLeave = () => setPos(null);
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  if (!pos) return null;
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: 360,
        height: 360,
        marginLeft: -180,
        marginTop: -180,
        background: 'radial-gradient(circle, rgba(124,58,237,0.14) 0%, rgba(124,58,237,0.05) 35%, transparent 65%)',
        borderRadius: '50%',
        pointerEvents: 'none',
        zIndex: 0,
        transition: 'left 0.1s ease-out, top 0.1s ease-out',
      }}
    />
  );
}

const VENTARC_NAV = [
  { path: '/', label: 'Home' },
  { path: '/how-it-works', label: 'How It Works' },
  { path: '/for-clubs', label: 'For Clubs' },
  { path: '/verify', label: 'Verify' },
  { path: '/login', label: 'Login', pill: true },
];

const DEFAULT_LOGO = '/image.png';

const HIDE_HEADER_PATHS = ['/dashboard', '/design', '/auth/callback'];

export default function CertVaultLayout({ children }) {
  const location = useLocation();
  const [logoUrl, setLogoUrl] = useState(DEFAULT_LOGO);
  const isDesignPage = location.pathname === '/design';
  const isVerifyPage = location.pathname === '/verify';
  const showHeader = !HIDE_HEADER_PATHS.includes(location.pathname);

  useEffect(() => {
    if (!isVerifyPage) setLogoUrl(DEFAULT_LOGO);
  }, [isVerifyPage]);

  return (
    <div
      className="certvault-app"
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        boxSizing: 'border-box',
        background: theme.bg,
        color: theme.text,
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", "Helvetica Neue", sans-serif',
        display: 'flex',
        flexDirection: 'column',
        ...((isDesignPage || isVerifyPage) ? { height: '100vh', maxHeight: '100vh', overflow: 'hidden' } : {}),
      }}
    >
      <InteractiveDotGrid />
      <CursorGlowSimple />
      <div
        className="certvault-bg-glow"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background: 'radial-gradient(ellipse 100% 80% at 50% -20%, rgba(124,58,237,0.06) 0%, transparent 50%)',
        }}
      />
      <style>{`
        @media (max-width: 768px) {
          .certvault-stitch-header .certvault-center { display: none; }
          .certvault-stitch-header .certvault-nav-wrap { gap: 0.5rem; }
          .certvault-stitch-header .certvault-nav-wrap a { font-size: 11px; padding: 0.25rem 0.5rem; }
        }
      `}</style>

      {showHeader && (
        <header className="certvault-stitch-header sticky top-0 z-[100] w-full bg-white/80 backdrop-blur-xl border-b border-[#e8e8ed]">
          <div className="max-w-[2560px] mx-auto px-6 sm:px-12 py-2.5 flex items-center justify-between">
            <Link to="/" className="flex flex-col gap-0.5 group cursor-pointer text-[var(--apple-text-primary)] no-underline">
              <div className="flex items-center gap-2">
                {logoUrl && logoUrl !== DEFAULT_LOGO ? (
                  <img src={logoUrl} alt="Ventarc" className="h-8 w-auto object-contain" />
                ) : (
                  <span className="material-symbols-outlined text-[var(--ventarc-accent)] text-[28px]">event</span>
                )}
                <span className="text-[21px] font-semibold tracking-tight">Ventarc</span>
              </div>
              <span className="text-[10px] font-medium text-[var(--apple-text-secondary)] uppercase tracking-widest opacity-70">Event Management, Reimagined.</span>
            </Link>
            <div className="certvault-center hidden lg:block flex-1" aria-hidden />
            <nav className="certvault-nav-wrap flex items-center gap-6 lg:gap-8">
              {VENTARC_NAV.map(({ path, label, pill }) => {
                const isActive = location.pathname === path || (path === '/' && location.pathname === '/');
                if (pill) {
                  return (
                    <Link
                      key={path}
                      to={path}
                      className="ml-2 sm:ml-4 bg-[var(--ventarc-accent)] text-white px-4 py-1.5 rounded-full text-[12px] font-medium hover:opacity-95 hover:brightness-110 transition-all no-underline"
                    >
                      {label}
                    </Link>
                  );
                }
                return (
                  <Link
                    key={path}
                    to={path}
                    className={`text-[12px] font-medium uppercase tracking-widest no-underline transition-colors ${
                      isActive ? 'text-[var(--ventarc-accent)]' : 'text-[var(--apple-text-secondary)] hover:text-[var(--ventarc-accent)]'
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>
      )}

      <main
        className="certvault-main"
        style={{
          flex: 1,
          width: '100%',
          padding: isDesignPage || isVerifyPage ? '12px 20px' : '48px 24px',
          boxSizing: 'border-box',
          position: 'relative',
          zIndex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: isDesignPage || isVerifyPage ? 'hidden' : undefined,
        }}
      >
        <CertVaultLogoContext.Provider value={setLogoUrl}>{children}</CertVaultLogoContext.Provider>
      </main>
    </div>
  );
}
