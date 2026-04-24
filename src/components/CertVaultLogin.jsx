import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import VentarcSceneBackground from './VentarcSceneBackground';
import VentarcHeader from './VentarcHeader';

const API_BASE = '/api/certvault';

export default function CertVaultLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextPath = useMemo(() => searchParams.get('next') || '/dashboard', [searchParams]);

  const [mode, setMode] = useState('signin');
  const [organizationName, setOrganizationName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [openingWorkspace, setOpeningWorkspace] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const legacy = typeof window !== 'undefined' ? localStorage.getItem('certvault_club_token') : null;
    if (legacy) {
      navigate(nextPath, { replace: true });
    }
  }, [navigate, nextPath]);

  function switchMode(nextMode) {
    setMode(nextMode);
    setError('');
  }

  async function maybeStorePasswordCredential({ email: username, password: secret, name }) {
    if (
      typeof window === 'undefined'
      || typeof window.PasswordCredential === 'undefined'
      || !navigator.credentials?.store
    ) {
      return;
    }

    try {
      const credential = new window.PasswordCredential({
        id: username,
        password: secret,
        name,
      });
      await navigator.credentials.store(credential);
    } catch (err) {
      console.warn('[CertVault] Could not store password credential:', err);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const trimmedEmail = email.trim().toLowerCase();

      if (!trimmedEmail || !password) {
        setError('Email and password are required');
        return;
      }

      if (mode === 'signup') {
        if (!organizationName.trim()) {
          setError('Organization name is required');
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters');
          return;
        }
        if (password !== confirmPassword) {
          setError('Password and confirm password must match');
          return;
        }
      }

      const action = mode === 'signup' ? 'signup' : 'login';
      const payload = mode === 'signup'
        ? {
            name: organizationName.trim(),
            email: trimmedEmail,
            password,
          }
        : {
            email: trimmedEmail,
            password,
          };

      const res = await fetch(`${API_BASE}?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!data.success || !data.token) {
        setError(data.error || (mode === 'signup' ? 'Could not create account' : 'Invalid email or password'));
        return;
      }

      await maybeStorePasswordCredential({
        email: trimmedEmail,
        password,
        name: mode === 'signup' ? organizationName.trim() : data.organization?.name,
      });

      setOpeningWorkspace(true);
      const meRes = await fetch(`${API_BASE}?action=me`, {
        headers: { Authorization: `Bearer ${data.token}` },
      });
      const meData = await meRes.json();
      if (!meData.success || !meData.organization) {
        setOpeningWorkspace(false);
        setError(meData.error || 'Could not open workspace');
        return;
      }

      localStorage.setItem('certvault_club_token', data.token);
      navigate(nextPath, { replace: true });
    } catch (err) {
      setOpeningWorkspace(false);
      setError(err.message || (mode === 'signup' ? 'Could not create account' : 'Could not sign in'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05070b] text-white">
      <VentarcHeader />
      <VentarcSceneBackground page="home" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl items-center px-6 py-24 md:px-8 xl:px-12">
        <div className="grid w-full gap-8 xl:grid-cols-[minmax(0,1fr)_460px] xl:items-center">
          <section className="max-w-3xl">
            <div className="inline-flex rounded-full border border-[#8fb8ff]/20 bg-[#09111c]/80 px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-[#8fb8ff]">
              Organizer Access
            </div>

            <h1
              className="mt-6 max-w-3xl text-5xl font-black leading-[0.94] tracking-[-0.08em] text-white md:text-7xl"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              {mode === 'signup' ? 'Create your organization account.' : 'Sign in to your event workspace.'}
            </h1>

          </section>

          <section className="ventarc-panel w-full p-6 md:p-8">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.28em] text-[#8aa9d2]" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                  {mode === 'signup' ? 'Sign Up' : 'Sign In'}
                </div>
                <div className="mt-2 text-3xl font-bold tracking-tight text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  {mode === 'signup' ? 'Create account' : 'Organizer login'}
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-full border border-white/[0.1] bg-[#0a0f16]/70 p-1 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all ${
                    mode === 'signin' ? 'bg-[#1a2230] text-white' : 'text-white/85'
                  }`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all ${
                    mode === 'signup' ? 'bg-[#1a2230] text-white' : 'text-white/85'
                  }`}
                >
                  Sign up
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" autoComplete="on">
              {mode === 'signup' && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#dbe8f7]" htmlFor="organizationName">
                    Organization Name
                  </label>
                  <input
                    id="organizationName"
                    name="organization"
                    type="text"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3.5 text-sm text-white outline-none transition-all placeholder:text-white/35 focus:border-[#8fb8ff]/45"
                    placeholder="IEEE Student Branch"
                    autoComplete="organization"
                    disabled={loading || openingWorkspace}
                  />
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#dbe8f7]" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  name="username"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3.5 text-sm text-white outline-none transition-all placeholder:text-white/35 focus:border-[#8fb8ff]/45"
                  placeholder="organizer@example.com"
                  autoComplete={mode === 'signin' ? 'username webauthn' : 'username'}
                  disabled={loading || openingWorkspace}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#dbe8f7]" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3.5 text-sm text-white outline-none transition-all placeholder:text-white/35 focus:border-[#8fb8ff]/45"
                  placeholder="Minimum 6 characters"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  disabled={loading}
                />
              </div>

              {mode === 'signup' && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#dbe8f7]" htmlFor="confirmPassword">
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3.5 text-sm text-white outline-none transition-all placeholder:text-white/35 focus:border-[#8fb8ff]/45"
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                    disabled={loading || openingWorkspace}
                  />
                </div>
              )}

              {error && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading || openingWorkspace} className="ventarc-btn-primary w-full">
                {openingWorkspace
                  ? 'Opening workspace...'
                  : loading
                    ? mode === 'signup' ? 'Creating account...' : 'Signing in...'
                    : mode === 'signup' ? 'Create Account' : 'Sign In'}
              </button>

            </form>

          </section>
        </div>
      </div>
    </div>
  );
}
