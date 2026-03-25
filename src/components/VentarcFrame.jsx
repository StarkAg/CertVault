/**
 * Renders a Stitch Ventarc dark-theme page in a full-screen iframe.
 * Used for / (home), /features, /solutions, /pricing, /resources — all black theme.
 */
import React from 'react';

const PAGES = ['home', 'features', 'solutions', 'pricing', 'resources'];

export function VentarcFrame({ page }) {
  const slug = PAGES.includes(page) ? page : 'home';
  const src = `/ventarc/ventarc-${slug}-dark.html`;
  return (
    <iframe
      src={src}
      title={`Ventarc ${slug}`}
      className="w-full border-0 block"
      style={{ minHeight: 'calc(100vh - 80px)', height: 'calc(100vh - 80px)' }}
    />
  );
}

export default VentarcFrame;
