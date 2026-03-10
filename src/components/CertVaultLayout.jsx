/**
 * CertVault layout: Professional light theme.
 * Clean background with subtle grid; dot animation uses theme colors.
 */
import React, { useMemo, useState, useEffect, createContext, useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { certVaultTheme as theme } from '../theme';

// Context for verify page to override logo (e.g. icon-192 for HIZE event)
export const CertVaultLogoContext = createContext(null);

const GRID_COLS = 12;
const GRID_ROWS = 8;

function CertVaultDots() {
  const [isScrollIdle, setIsScrollIdle] = useState(true);

  const dots = useMemo(() => {
    const directions = [
      { dx: 1, dy: 1 },
      { dx: -1, dy: 1 },
      { dx: 1, dy: -1 },
      { dx: -1, dy: -1 },
    ];
    const list = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const dir = directions[(r * GRID_COLS + c) % directions.length];
        list.push({
          id: `${r}-${c}`,
          delay: Math.random() * 8,
          duration: 2.5 + Math.random() * 2,
          x: (c / Math.max(1, GRID_COLS - 1)) * 100,
          y: (r / Math.max(1, GRID_ROWS - 1)) * 100,
          size: 1.5 + Math.random() * 1.5,
          opacity: 0.25 + Math.random() * 0.2,
          ...dir,
        });
      }
    }
    return list;
  }, []);

  useEffect(() => {
    let timeout;
    const handleScroll = () => {
      setIsScrollIdle(false);
      clearTimeout(timeout);
      timeout = setTimeout(() => setIsScrollIdle(true), 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(timeout);
    };
  }, []);

  return (
    <div className={`certvault-dots ${isScrollIdle ? 'scroll-idle' : ''}`} style={dotsWrap}>
      <style>{`
        @keyframes certvault-shooting {
          0% {
            transform: translate(var(--from-x), var(--from-y)) scale(0.3);
            opacity: 0;
          }
          5% {
            opacity: var(--op);
          }
          95% {
            opacity: var(--op);
          }
          100% {
            transform: translate(var(--to-x), var(--to-y)) scale(1);
            opacity: 0;
          }
        }
        @keyframes certvault-shooting-idle {
          0% {
            transform: translate(var(--from-x), var(--from-y)) scale(0.4);
            opacity: 0;
          }
          8% {
            opacity: calc(var(--op) * 0.7);
          }
          92% {
            opacity: calc(var(--op) * 0.7);
          }
          100% {
            transform: translate(var(--to-x), var(--to-y)) scale(0.8);
            opacity: 0;
          }
        }
        .certvault-dots .dot {
          position: absolute;
          left: var(--x);
          top: var(--y);
          width: var(--size, 2px);
          height: var(--size, 2px);
          margin-left: calc(var(--size) / -2);
          margin-top: calc(var(--size) / -2);
          background: ${theme.dotColor};
          border-radius: 50%;
          box-shadow: var(--trail);
          --op: var(--opacity, 0.35);
          opacity: 0;
          pointer-events: none;
        }
        .certvault-dots:not(.scroll-idle) .dot {
          animation: certvault-shooting var(--dur) linear infinite;
          animation-delay: var(--delay);
        }
        .certvault-dots.scroll-idle .dot {
          animation: certvault-shooting-idle var(--dur-idle) linear infinite;
          animation-delay: var(--delay);
        }
      `}</style>
      {dots.map((d) => {
        const dist = 120;
        const fromX = (d.dx > 0 ? -dist : dist) + '%';
        const fromY = (d.dy > 0 ? -dist : dist) + '%';
        const toX = (d.dx > 0 ? dist : -dist) + '%';
        const toY = (d.dy > 0 ? dist : -dist) + '%';
        const trailLen = 5;
        const trailShadows = Array.from({ length: trailLen }, (_, i) => {
          const o = (0.15 - (i / trailLen) * 0.12).toFixed(2);
          const x = -d.dx * (i + 1) * 5;
          const y = -d.dy * (i + 1) * 5;
          return `${x}px ${y}px 0 0 rgba(15,23,42,${o})`;
        }).join(', ');
        return (
          <div
            key={d.id}
            className="dot"
            style={{
              '--x': `${d.x}%`,
              '--y': `${d.y}%`,
              '--size': `${d.size}px`,
              '--opacity': String(d.opacity),
              '--delay': `${d.delay}s`,
              '--dur': `${d.duration}s`,
              '--dur-idle': `${d.duration * 2.5}s`,
              '--from-x': fromX,
              '--from-y': fromY,
              '--to-x': toX,
              '--to-y': toY,
              '--trail': trailShadows || 'none',
            }}
          />
        );
      })}
    </div>
  );
}

const dotsWrap = {
  position: 'fixed',
  inset: 0,
  overflow: 'hidden',
  zIndex: 0,
  pointerEvents: 'none',
};

const CERTVAULT_NAV = [
  { path: '/', label: 'Home' },
  { path: '/how-it-works', label: 'How It Works' },
  { path: '/for-clubs', label: 'For Clubs' },
  { path: '/verify', label: 'Verify Certificate' },
  { path: '/login', label: 'Login' },
];

const DEFAULT_LOGO = '/image.png';

export default function CertVaultLayout({ children }) {
  const location = useLocation();
  const [logoUrl, setLogoUrl] = useState(DEFAULT_LOGO);

  const isDesignPage = location.pathname === '/design';
  const isVerifyPage = location.pathname === '/verify';

  // Reset logo when leaving verify page or on mount
  useEffect(() => {
    if (!isVerifyPage) {
      setLogoUrl(DEFAULT_LOGO);
    }
  }, [isVerifyPage]);
  
  // Ensure logo is set on mount
  useEffect(() => {
    setLogoUrl(DEFAULT_LOGO);
  }, []);

  return (
    <div
      className="certvault-app"
      style={{
        ...styles.app,
        ...((isDesignPage || isVerifyPage) ? { height: '100vh', maxHeight: '100vh', overflow: 'hidden' } : {}),
      }}
    >
      <CertVaultDots />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Merriweather:wght@400;700&family=Lora:wght@400;600;700&family=Source+Serif+4:wght@400;600;700&family=Crimson+Text:wght@400;600;700&family=Libre+Baskerville:wght@400;700&family=EB+Garamond:wght@400;600&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Open+Sans:wght@400;600;700&family=Source+Sans+3:wght@400;600;700&family=Work+Sans:wght@400;600&family=DM+Sans:wght@400;600&family=Plus+Jakarta+Sans:wght@400;600;700&family=Outfit:wght@400;600&family=Manrope:wght@400;600&family=Sora:wght@400;600&family=Lexend:wght@400;600&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Fira+Code:wght@400;600&family=Source+Code+Pro:wght@400;600&family=IBM+Plex+Mono:wght@400;600&family=Inconsolata:wght@400;700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;600&family=Raleway:wght@400;600;700&family=Montserrat:wght@400;600;700&family=Poppins:wght@400;600&family=Quicksand:wght@400;600&family=Archivo:wght@400;600&family=Nunito:wght@400;600;700&display=swap');
        
        @media (max-width: 768px) {
          .certvault-header-inner {
            grid-template-columns: 1fr !important;
            gap: 6px !important;
          }
          .certvault-center-branding {
            display: none !important;
          }
          .certvault-nav {
            justify-content: center !important;
            width: 100% !important;
            gap: 2px !important;
            flex-wrap: nowrap !important;
          }
          .certvault-nav-link {
            font-size: 10px !important;
            padding: 4px 6px !important;
            white-space: nowrap !important;
          }
          .certvault-header {
            padding: 8px 10px !important;
          }
          .certvault-main {
            padding: 16px 10px !important;
          }
          .certvault-logo-img {
            height: 32px !important;
          }
        }
      `}</style>
      <header className="certvault-header" style={styles.header}>
        <div className="certvault-header-inner" style={styles.headerInner}>
          <div style={styles.logoBlock}>
            <Link to="/" style={styles.logo}>
              <img src={logoUrl} alt="CertVault" style={styles.logoImg} />
            </Link>
          </div>
          <div className="certvault-center-branding" style={styles.centerBranding}>
            <p style={styles.headerBrand}>
              Distributed by: CertVault - GradeX <img src="/arc-reactor1.png" alt="GradeX" style={styles.headerBrandLogo} />
            </p>
          </div>
          <nav className="certvault-nav" style={styles.nav}>
            {CERTVAULT_NAV.map(({ path, label }) => (
              <Link
                key={path}
                to={path}
                className="certvault-nav-link"
                style={{
                  ...styles.navLink,
                  ...(location.pathname === path || (path === '/' && location.pathname === '/') ? styles.navLinkActive : {}),
                }}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="certvault-main" style={{ ...styles.main, ...((isDesignPage || isVerifyPage) ? { padding: '12px 20px', overflow: 'hidden' } : {}) }}>
        <CertVaultLogoContext.Provider value={setLogoUrl}>{children}</CertVaultLogoContext.Provider>
      </main>
    </div>
  );
}

const styles = {
  app: {
    position: 'relative',
    width: '100%',
    minHeight: '100vh',
    boxSizing: 'border-box',
    background: `
      linear-gradient(${theme.gridLine} 1px, transparent 1px),
      linear-gradient(90deg, ${theme.gridLine} 1px, transparent 1px),
      ${theme.bg}
    `,
    backgroundSize: '40px 40px, 40px 40px, 100% 100%',
    backgroundAttachment: 'fixed',
    color: theme.text,
    fontFamily: '"Space Grotesk", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    backgroundColor: theme.headerBg,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderBottom: `1px solid ${theme.border}`,
    padding: '16px 24px',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    '@media (max-width: 768px)': {
      padding: '12px 16px',
    },
  },
  headerInner: {
    width: '100%',
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    alignItems: 'center',
    gap: 16,
  },
  logoBlock: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  centerBranding: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    fontSize: 20,
    fontWeight: 600,
    color: theme.text,
    textDecoration: 'none',
    letterSpacing: '-0.02em',
  },
  logoImg: {
    height: 44,
    width: 'auto',
    objectFit: 'contain',
  },
  headerBrand: {
    fontSize: 14,
    fontFamily: "'Bebas Neue', sans-serif",
    letterSpacing: '0.05em',
    color: theme.textSecondary,
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  headerBrandLogo: {
    height: 20,
    width: 'auto',
    verticalAlign: 'middle',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
  navLink: {
    fontSize: 14,
    fontFamily: '"Space Grotesk", Inter, sans-serif',
    color: theme.textSecondary,
    whiteSpace: 'nowrap',
    textDecoration: 'none',
    padding: '8px 12px',
    borderRadius: 6,
    transition: 'all 0.2s ease',
  },
  navLinkActive: {
    color: theme.accent,
    fontWeight: 500,
    backgroundColor: theme.accentLight,
  },
  main: {
    flex: 1,
    width: '100%',
    padding: '48px 24px',
    boxSizing: 'border-box',
    position: 'relative',
    zIndex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
};
