import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import UltronParticles from './UltronParticles';

export default function Ultron() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      padding: isMobile ? '40px 20px' : '60px 20px',
      paddingTop: isMobile ? '60px' : '100px',
      background: 'radial-gradient(circle at top, #1b0b12 0, #050109 45%, #000000 100%)',
      color: 'var(--text-primary)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background grid + glow layers to match Ultron theme */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(148,27,51,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,27,51,0.08) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          pointerEvents: 'none',
          opacity: 0.9
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at top, rgba(220,38,38,0.28) 0, transparent 60%), radial-gradient(circle at bottom, rgba(15,23,42,0.85) 0, transparent 55%)',
          pointerEvents: 'none'
        }}
      />
      <UltronParticles count={30} />
      <style>{`
        @keyframes ultronLandingGlow {
          0%, 100% { text-shadow: 0 0 8px rgba(248, 113, 113, 0.55), 0 0 18px rgba(220, 38, 38, 0.8); }
          50% { text-shadow: 0 0 3px rgba(248, 113, 113, 0.35), 0 0 10px rgba(220, 38, 38, 0.6); }
        }
        @keyframes ultronLandingCardPulse {
          0%, 100% { box-shadow: 0 0 18px rgba(248, 113, 113, 0.15); border-color: rgba(248, 113, 113, 0.4); }
          50% { box-shadow: 0 0 28px rgba(248, 113, 113, 0.28); border-color: rgba(248, 113, 113, 0.7); }
        }
      `}</style>
      <div style={{
        textAlign: 'center',
        maxWidth: isMobile ? '500px' : '600px',
        width: '100%',
        position: 'relative',
        zIndex: 1,
        padding: isMobile ? '22px' : '28px',
        background: 'rgba(7, 7, 11, 0.90)',
        borderRadius: '18px',
        border: '1px solid rgba(248,113,113,0.5)',
        boxShadow: '0 0 22px rgba(248,113,113,0.35)',
        animation: 'ultronLandingCardPulse 3s ease-in-out infinite',
        backdropFilter: 'blur(10px)'
      }}>
        <img 
          src="/IEEEXULTRON.png" 
          alt="Ultron 9.0"
          style={{
            maxWidth: isMobile ? '300px' : '500px',
            width: '100%',
            height: 'auto',
            marginBottom: '8px',
            objectFit: 'contain'
          }}
        />
        <p style={{
          fontSize: isMobile ? '13px' : '14px',
          color: 'rgba(248,250,252,0.65)',
          marginBottom: isMobile ? '24px' : '32px',
          textTransform: 'uppercase',
          letterSpacing: '0.18em',
          fontFamily: "'Space Grotesk', system-ui, sans-serif"
        }}>
          Hackathon Management System
        </p>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          marginTop: '40px',
          alignItems: 'center'
        }}>
          <Link
            to="/ultron/admin"
            style={{
              display: 'inline-block',
              padding: '16px 32px',
              background: '#f97373',
              color: '#020617',
              textDecoration: 'none',
              borderRadius: '999px',
              fontSize: '16px',
              fontWeight: 600,
              textAlign: 'center',
              transition: 'all 0.2s ease',
              border: '1px solid rgba(248,113,113,0.75)',
              width: 'auto',
              minWidth: '220px',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
              boxShadow: '0 0 18px rgba(248,113,113,0.45)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 0 26px rgba(248,113,113,0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 0 18px rgba(248,113,113,0.45)';
            }}
          >
            Admin Login
          </Link>

          <Link
            to="/ultron/team"
            style={{
              display: 'inline-block',
              padding: '16px 32px',
              background: 'rgba(15,23,42,0.12)',
              color: '#e5e7eb',
              textDecoration: 'none',
              borderRadius: '999px',
              fontSize: '16px',
              fontWeight: 600,
              textAlign: 'center',
              transition: 'all 0.2s ease',
              border: '1px solid rgba(148,163,184,0.55)',
              width: 'auto',
              minWidth: '220px',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              fontFamily: "'Space Grotesk', system-ui, sans-serif"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(248,113,113,0.14)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.borderColor = 'rgba(248,113,113,0.7)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(15,23,42,0.12)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'rgba(148,163,184,0.55)';
            }}
          >
            Team Login
          </Link>
        </div>
      </div>
    </div>
  );
}
