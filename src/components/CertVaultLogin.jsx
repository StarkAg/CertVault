/**
 * CertVault Club Login — Supabase magic link (email link) auth.
 * Login: enter email → link sent. Signup: name + email → link sent; complete org on first visit.
 */
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import CertVaultLayout from './CertVaultLayout';
import { supabase, getAuthRedirectUrl } from '../lib/supabase';

const PENDING_ORG_NAME_KEY = 'certvault_pending_org_name';

export default function CertVaultLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    setSent(false);

    if (!supabase) {
      setError('Auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      setLoading(false);
      return;
    }

    const emailTrim = email.trim().toLowerCase();
    if (!emailTrim) {
      setError('Please enter your email.');
      setLoading(false);
      return;
    }

    if (mode === 'signup' && !name.trim()) {
      setError('Please enter your club name.');
      setLoading(false);
      return;
    }

    try {
      if (mode === 'signup') {
        localStorage.setItem(PENDING_ORG_NAME_KEY, name.trim());
      } else {
        localStorage.removeItem(PENDING_ORG_NAME_KEY);
      }

      const { error: signError } = await supabase.auth.signInWithOtp({
        email: emailTrim,
        options: {
          emailRedirectTo: getAuthRedirectUrl(),
        },
      });

      if (signError) {
        setError(signError.message || 'Could not send link');
        setLoading(false);
        return;
      }

      setSent(true);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <CertVaultLayout>
        <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--apple-bg)]">
          <div className="w-full max-w-[400px] text-center">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
              <div className="inline-flex items-center justify-center size-14 rounded-full bg-emerald-500/10 text-emerald-600 mb-6">
                <span className="material-symbols-outlined text-4xl">mail</span>
              </div>
              <h1 className="text-[24px] font-semibold text-[var(--apple-text-primary)] mb-2">Check your email</h1>
              <p className="text-[var(--apple-text-secondary)] text-sm mb-6">
                We sent a sign-in link to <strong className="text-[var(--apple-text-primary)]">{email.trim()}</strong>. Click the link in that email to sign in.
              </p>
              <p className="text-[var(--apple-text-secondary)] text-xs">
                The link expires in 1 hour. Didn’t get it? Check spam or{' '}
                <button type="button" onClick={() => setSent(false)} className="text-[var(--apple-accent)] font-medium hover:underline">
                  try again
                </button>.
              </p>
            </div>
            <footer className="mt-8">
              <Link to="/" className="text-[var(--apple-text-secondary)] text-xs hover:text-[var(--apple-accent)]">← Back to CertVault</Link>
            </footer>
          </div>
        </div>
      </CertVaultLayout>
    );
  }

  return (
    <CertVaultLayout>
      <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--apple-bg)]">
        <div className="w-full max-w-[400px]">
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="flex items-center justify-center size-8 bg-[var(--apple-accent)] rounded-lg text-white">
              <span className="material-symbols-outlined text-xl">shield_person</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-[var(--apple-text-primary)]">CertVault</h2>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
            <h1 className="text-[32px] font-semibold text-[var(--apple-text-primary)] mb-6 tracking-tight">
              {mode === 'signup' ? 'Create Club Account' : 'Club Login'}
            </h1>
            {mode === 'signup' && (
              <p className="text-[var(--apple-text-secondary)] text-sm mb-6">Enter your details. We’ll send a sign-in link to your email—no password needed.</p>
            )}
            {mode === 'login' && (
              <p className="text-[var(--apple-text-secondary)] text-sm mb-6">Sign in with a link sent to your email.</p>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {mode === 'signup' && (
                <div>
                  <label className="block text-sm font-medium text-[var(--apple-text-primary)] mb-1.5" htmlFor="club-name">Club Name</label>
                  <input
                    id="club-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. IEEE CS SRM"
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-[var(--apple-accent)]/20 focus:border-[var(--apple-accent)] transition-all outline-none text-sm"
                    required
                    disabled={loading}
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-[var(--apple-text-primary)] mb-1.5" htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-[var(--apple-accent)]/20 focus:border-[var(--apple-accent)] transition-all outline-none text-sm"
                  required
                  disabled={loading}
                />
              </div>
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-100 flex items-start gap-2 text-red-600 text-sm">
                  <span className="material-symbols-outlined text-sm mt-0.5">error</span>
                  <span>{error}</span>
                </div>
              )}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[var(--apple-accent)] text-white font-semibold py-3.5 rounded-[12px] shadow-lg shadow-blue-500/20 hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  {loading ? (mode === 'signup' ? 'Sending link…' : 'Sending link…') : (mode === 'signup' ? 'Send sign-in link' : 'Send sign-in link')}
                </button>
              </div>
            </form>
            <div className="mt-8 pt-6 border-t border-slate-50 text-center">
              {mode === 'login' ? (
                <button type="button" onClick={() => { setMode('signup'); setError(''); }} className="text-sm font-medium text-[var(--apple-accent)] hover:underline transition-all">
                  Need an account? Sign up
                </button>
              ) : (
                <button type="button" onClick={() => { setMode('login'); setError(''); }} className="text-sm font-medium text-[var(--apple-accent)] hover:underline transition-all">
                  Already have an account? Sign in
                </button>
              )}
            </div>
          </div>
          <footer className="mt-8 text-center">
            <Link to="/" className="text-[var(--apple-text-secondary)] text-xs hover:text-[var(--apple-accent)]">← Back to CertVault</Link>
          </footer>
        </div>
      </div>
    </CertVaultLayout>
  );
}
