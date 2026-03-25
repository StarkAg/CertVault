/**
 * Universal fixed header matching Stitch Features page (ventarc-features-dark).
 * Dark #131313, VENTARC logo, Features / Solutions / Pricing / Resources, Login, Create Event.
 */
import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const NAV_LINKS = [
  { path: '/features', label: 'Features' },
  { path: '/solutions', label: 'Solutions' },
  // { path: '/pricing', label: 'Pricing' }, // hidden for now
  { path: '/resources', label: 'Resources' },
];

export default function VentarcHeader() {
  const location = useLocation();

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-[100] flex justify-between items-center px-6 md:px-8 h-20 bg-[#131313] border-b border-white/5"
      style={{ fontFamily: 'Inter, sans-serif' }}
    >
      <Link
        to="/"
        className="text-2xl font-black tracking-tighter text-white uppercase no-underline hover:opacity-90 transition-opacity"
      >
        VENTARC
      </Link>
      <div className="hidden md:flex items-center space-x-8 font-medium tracking-tight text-sm">
        {NAV_LINKS.map(({ path, label }) => {
          const isActive = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={`no-underline transition-colors duration-300 scale-95 active:scale-100 ${
                isActive
                  ? 'text-white border-b-2 border-white pb-1'
                  : 'text-[#c6c6c6] hover:text-white'
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
      <div className="flex items-center space-x-6">
        <Link
          to="/login"
          className="font-medium tracking-tight text-sm text-[#c6c6c6] hover:text-white transition-colors duration-300 no-underline"
        >
          Login
        </Link>
        <Link
          to="/dashboard"
          className="bg-white text-[#1a1c1c] px-6 py-2 text-sm font-bold uppercase tracking-widest rounded-sm transition-transform active:scale-95 shadow-lg no-underline inline-block hover:bg-[#e4e4e4]"
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #d4d4d4 100%)',
            boxShadow: '0 40px 80px -20px rgba(226, 226, 226, 0.12)',
          }}
        >
          Create Event
        </Link>
      </div>
    </nav>
  );
}
