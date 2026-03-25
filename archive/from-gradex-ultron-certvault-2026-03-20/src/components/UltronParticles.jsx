import React, { useMemo } from 'react';

/**
 * Subtle floating "Upside Down" embers/particles layer.
 * Pure CSS animations, no canvas.
 */
export default function UltronParticles({ count = 26 }) {
  const particles = useMemo(() => {
    const rand = (min, max) => min + Math.random() * (max - min);
    return Array.from({ length: count }, (_, idx) => {
      const size = rand(2, 7);
      const left = rand(0, 100);
      const top = rand(0, 100);
      const opacity = rand(0.12, 0.55);
      const blur = rand(0.2, 1.6);
      const duration = rand(10, 22);
      const delay = rand(0, 8);
      const drift = rand(-40, 40);
      return { idx, size, left, top, opacity, blur, duration, delay, drift };
    });
  }, [count]);

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0
      }}
    >
      <style>{`
        @keyframes ultronParticleFloat {
          0%   { transform: translate3d(0, 0, 0); opacity: 0; }
          10%  { opacity: 1; }
          60%  { opacity: 0.85; }
          100% { transform: translate3d(var(--drift), -130vh, 0); opacity: 0; }
        }
        @keyframes ultronParticleFlicker {
          0%, 100% { filter: blur(var(--blur)) drop-shadow(0 0 10px rgba(248,113,113,0.2)); }
          50% { filter: blur(calc(var(--blur) * 1.4)) drop-shadow(0 0 16px rgba(248,113,113,0.35)); }
        }
      `}</style>

      {particles.map((p) => (
        <span
          key={p.idx}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            borderRadius: '4px',
            opacity: p.opacity,
            background:
              'radial-gradient(circle, rgba(248,113,113,0.95) 0%, rgba(248,113,113,0.25) 55%, rgba(248,113,113,0) 72%)',
            mixBlendMode: 'screen',
            transform: 'translate3d(0, 0, 0)',
            willChange: 'transform, opacity, filter',
            ['--blur']: `${p.blur}px`,
            ['--drift']: `${p.drift}px`,
            animation: `ultronParticleFloat ${p.duration}s linear ${p.delay}s infinite, ultronParticleFlicker 2.8s ease-in-out ${p.delay}s infinite`
          }}
        />
      ))}
    </div>
  );
}

