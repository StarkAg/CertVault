/**
 * Universal layout: fixed Ventarc header + main content below.
 * Use for all routes so the Features-style header is always visible.
 */
import React from 'react';
import { Outlet } from 'react-router-dom';
import VentarcHeader from './VentarcHeader';

const HEADER_HEIGHT = 80; // h-20 = 5rem = 80px

export default function VentarcLayout() {
  return (
    <>
      <VentarcHeader />
      <main
        className="relative"
        style={{
          paddingTop: HEADER_HEIGHT,
          minHeight: '100vh',
        }}
      >
        <Outlet />
      </main>
    </>
  );
}
