import React from 'react';
import { Navigate, Routes, Route, useLocation } from 'react-router-dom';
import {
  CertVaultHowItWorks,
  CertVaultForClubs,
  CertVaultVerify,
  CertVaultLogin,
  CertVaultDashboard,
  CertVaultDownload,
} from './index';
import VentarcLayout from './components/VentarcLayout';
import VentarcFrame from './components/VentarcFrame';
import Ultron from './components/Ultron';
import UltronAdmin from './components/UltronAdmin';
import UltronTeam from './components/UltronTeam';
import UltronCheckin from './components/UltronCheckin';

export default function App() {
  return (
    <Routes>
      <Route element={<VentarcLayout />}>
        <Route path="/" element={<VentarcFrame page="home" />} />
        <Route path="/features" element={<VentarcFrame page="features" />} />
        <Route path="/solutions" element={<VentarcFrame page="solutions" />} />
        <Route path="/pricing" element={<VentarcFrame page="pricing" />} />
        <Route path="/resources" element={<VentarcFrame page="resources" />} />
        <Route path="/how-it-works" element={<CertVaultHowItWorks />} />
        <Route path="/for-clubs" element={<CertVaultForClubs />} />
        <Route path="/ultron" element={<Ultron />} />
        <Route path="/ultron/admin" element={<UltronAdmin />} />
        <Route path="/ultron/team/:teamCode" element={<UltronTeam />} />
        <Route path="/ultron/team" element={<UltronTeam />} />
        <Route path="/ultron/checkin" element={<UltronCheckin />} />
      </Route>
      <Route path="/login" element={<CertVaultLogin />} />
      <Route path="/dashboard" element={<CertVaultDashboard />} />
      <Route path="/verify" element={<CertVaultVerify />} />
      <Route path="/certvault/vemy" element={<LegacyVerifyRedirect />} />
      <Route path="/certvault/verify" element={<CertVaultVerify />} />
      <Route path="/design" element={<Navigate to="/dashboard?step=template" replace />} />
      <Route path="/:eventSlug" element={<CertVaultDownload />} />
    </Routes>
  );
}

function LegacyVerifyRedirect() {
  const location = useLocation();
  return <Navigate to={`/certvault/verify${location.search || ''}`} replace />;
}
