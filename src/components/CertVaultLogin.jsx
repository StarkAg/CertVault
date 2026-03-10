/**
 * CertVault Club Login/Signup — clubs only.
 */
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import CertVaultLayout from './CertVaultLayout';
import { certVaultTheme as theme } from '../theme';

const API_BASE = '/api/certvault';

export default function CertVaultLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const action = mode === 'signup' ? 'signup' : 'login';
      const body = mode === 'signup' 
        ? { name, email, password }
        : { email, password };

      const res = await fetch(`${API_BASE}?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        localStorage.setItem('certvault_club_token', data.token || '');
        localStorage.setItem('certvault_club_org', JSON.stringify(data.organization || {}));
        navigate('/dashboard');
        return;
      }

      setError(data.error || `${mode === 'signup' ? 'Signup' : 'Login'} failed.`);
    } catch (err) {
      setError('Connection failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <CertVaultLayout>
      <style>{`
        @media (max-width: 768px) {
          .certvault-login-wrap {
            padding: 0 12px !important;
          }
          .certvault-login-title {
            font-size: 18px !important;
            white-space: nowrap !important;
          }
          .certvault-login-subtitle {
            font-size: 12px !important;
          }
          .certvault-login-label {
            font-size: 12px !important;
          }
          .certvault-login-input {
            font-size: 14px !important;
            padding: 10px 12px !important;
          }
          .certvault-login-btn {
            font-size: 13px !important;
            padding: 10px 20px !important;
            white-space: nowrap !important;
          }
        }
      `}</style>
      <div className="certvault-login-wrap" style={styles.wrap}>
        <h1 className="certvault-login-title" style={styles.title}>{mode === 'signup' ? 'Create Club Account' : 'Club Login'}</h1>
        <p className="certvault-login-subtitle" style={styles.subtitle}>
          {mode === 'signup' 
            ? 'Register your club to start issuing certificates.'
            : 'Sign in to manage events and certificates.'}
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          {mode === 'signup' && (
            <>
              <label className="certvault-login-label" style={styles.label}>Club/Organization Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. IEEE SRM"
                className="certvault-login-input"
                style={styles.input}
                required
                disabled={loading}
              />
            </>
          )}

          <label className="certvault-login-label" style={styles.label}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="certvault-login-input"
            style={styles.input}
            required
            disabled={loading}
          />

          <label className="certvault-login-label" style={styles.label}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="certvault-login-input"
            style={styles.input}
            required
            disabled={loading}
            minLength={mode === 'signup' ? 6 : undefined}
          />

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" className="certvault-login-btn" style={styles.btn} disabled={loading}>
            {loading 
              ? (mode === 'signup' ? 'Creating account…' : 'Signing in…')
              : (mode === 'signup' ? 'Create Account' : 'Sign in')}
          </button>
        </form>

        <div style={styles.switchMode}>
          {mode === 'login' ? (
            <p>
              Don't have an account?{' '}
              <button 
                type="button" 
                onClick={() => { setMode('signup'); setError(''); }}
                style={styles.linkBtn}
              >
                Sign up
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button 
                type="button" 
                onClick={() => { setMode('login'); setError(''); }}
                style={styles.linkBtn}
              >
                Sign in
              </button>
            </p>
          )}
        </div>

        <Link to="/" style={styles.backLink}>← Back to CertVault</Link>
      </div>
    </CertVaultLayout>
  );
}

const styles = {
  wrap: { maxWidth: 400, margin: '0 auto', textAlign: 'center' },
  title: { fontFamily: "'AmericanCaptain', 'Bebas Neue', sans-serif", fontSize: 24, fontWeight: 400, letterSpacing: '0.03em', color: theme.text, margin: '0 0 8px' },
  subtitle: { fontSize: 14, color: theme.textSecondary, margin: '0 0 24px' },
  form: { display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'left' },
  label: { fontSize: 14, fontWeight: 500, color: theme.textSecondary, marginBottom: -8 },
  input: {
    padding: '12px 16px',
    fontSize: 15,
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    outline: 'none',
    transition: 'border-color 0.2s',
    backgroundColor: theme.bgInput,
    color: theme.text,
  },
  error: {
    fontSize: 14,
    color: theme.error,
    margin: 0,
    padding: '8px 12px',
    backgroundColor: theme.errorLight,
    border: `1px solid ${theme.error}`,
    borderRadius: 6,
  },
  btn: {
    padding: '12px 24px',
    backgroundColor: theme.accent,
    color: '#fff',
    fontSize: 15,
    fontWeight: 500,
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    marginTop: 8,
    transition: 'all 0.2s ease',
  },
  switchMode: { textAlign: 'center', marginTop: 24, fontSize: 14, color: theme.textSecondary },
  linkBtn: { background: 'none', border: 'none', color: theme.accent, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', padding: 0 },
  backLink: { display: 'block', textAlign: 'center', marginTop: 32, fontSize: 14, color: theme.textSecondary, textDecoration: 'none' },
};
