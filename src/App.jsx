import React from 'react';
import { Routes, Route } from 'react-router-dom';
import {
  CertVaultHome,
  CertVaultHowItWorks,
  CertVaultForClubs,
  CertVaultVerify,
  CertVaultLogin,
  CertVaultAuthCallback,
  CertVaultDashboard,
  CertVaultDesign,
  CertVaultDownload,
} from './index';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CertVaultHome />} />
      <Route path="/how-it-works" element={<CertVaultHowItWorks />} />
      <Route path="/for-clubs" element={<CertVaultForClubs />} />
      <Route path="/verify" element={<CertVaultVerify />} />
      <Route path="/login" element={<CertVaultLogin />} />
      <Route path="/auth/callback" element={<CertVaultAuthCallback />} />
      <Route path="/dashboard" element={<CertVaultDashboard />} />
      <Route path="/design" element={<CertVaultDesign />} />
      <Route path="/:eventSlug" element={<CertVaultDownload />} />
    </Routes>
  );
}
