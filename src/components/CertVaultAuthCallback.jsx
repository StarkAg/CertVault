/**
 * Handles redirect after Supabase magic link click.
 * Supabase adds tokens to the URL hash; we let the client recover the session and redirect.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import CertVaultLayout from './CertVaultLayout';

export default function CertVaultAuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Signing you in…');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!supabase) {
      setError('Auth is not configured.');
      return;
    }

    let cancelled = false;

    async function handleCallback() {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        if (code) {
          const { data: { session }, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (cancelled) return;
          if (exchangeError) {
            setError(exchangeError.message || 'Could not sign in');
            return;
          }
          if (session) {
            setStatus('Redirecting…');
            navigate('/dashboard', { replace: true });
          } else {
            setError('No session found. The link may have expired.');
          }
          return;
        }
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (cancelled) return;
        if (sessionError) {
          setError(sessionError.message || 'Could not sign in');
          return;
        }
        if (session) {
          setStatus('Redirecting…');
          navigate('/dashboard', { replace: true });
        } else {
          setError('No session found. The link may have expired.');
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Something went wrong');
      }
    }

    handleCallback();
    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <CertVaultLayout>
      <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--apple-bg)]">
        <div className="w-full max-w-[400px] text-center">
          {error ? (
            <>
              <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm mb-6">
                {error}
              </div>
              <a href="/login" className="text-[var(--apple-accent)] font-medium hover:underline">
                Back to login
              </a>
            </>
          ) : (
            <>
              <div className="inline-flex items-center justify-center size-12 rounded-full bg-[var(--apple-accent)]/10 text-[var(--apple-accent)] mb-4">
                <span className="material-symbols-outlined text-3xl">link</span>
              </div>
              <p className="text-[var(--apple-text-primary)] font-medium">{status}</p>
            </>
          )}
        </div>
      </div>
    </CertVaultLayout>
  );
}
