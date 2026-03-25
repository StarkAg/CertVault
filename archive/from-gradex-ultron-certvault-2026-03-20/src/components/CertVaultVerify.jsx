import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { findVerifiedByExactName } from '../data/certvaultVerifiedAttendees';

export default function CertVaultVerify() {
  const [searchParams] = useSearchParams();
  const certId = searchParams.get('id') || '';
  const [name, setName] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [error, setError] = useState(null);

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  useEffect(() => {
    document.title = certId ? `Verify ${certId} - CertVault` : 'Certificate Verification - CertVault';
  }, [certId]);

  const handleVerify = () => {
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    setVerifying(true);
    setError(null);
    setVerificationResult(null);

    const found = findVerifiedByExactName(name.trim());
    setVerifying(false);
    if (found) {
      setVerificationResult({
        verified: true,
        certificateData: {
          name: found.name,
          event: 'IEEE CS SRM Hize',
          organization: 'IEEE CS SRM',
        },
        attendeeEmail: found.email,
      });
    } else {
      setVerificationResult({ verified: false });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !verifying && name.trim()) {
      e.preventDefault();
      handleVerify();
    }
  };

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '600px',
        margin: '0 auto',
        padding: isMobile ? '20px 16px 80px' : '40px 24px',
        fontFamily: 'system-ui, sans-serif',
        minHeight: '100vh',
        boxSizing: 'border-box',
      }}
    >
      {/* GradeX wordmark + arc (arc smaller, centred to text) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '24px',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontFamily: "'AmericanCaptain', 'Bebas Neue', sans-serif",
            fontSize: isMobile ? '28px' : '34px',
            letterSpacing: '0.12em',
            color: 'var(--text-primary)',
            lineHeight: 1,
          }}
        >
          GradeX
        </span>
        <img
          src="/arc-reactor1.png"
          alt=""
          style={{
            width: isMobile ? '32px' : '42px',
            height: isMobile ? '32px' : '42px',
            objectFit: 'contain',
            flexShrink: 0,
            marginTop: isMobile ? '-8px' : '-10px',
          }}
        />
      </div>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div
          style={{
            fontFamily: "'AmericanCaptain', 'Bebas Neue', sans-serif",
            fontSize: isMobile ? '18px' : 'clamp(22px, 4vw, 28px)',
            fontWeight: 300,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-primary)',
            lineHeight: isMobile ? '1.1' : '1.2',
            margin: '0 0 8px',
          }}
        >
          CERTVAULT
        </div>
        <h1
          style={{
            fontSize: isMobile ? '24px' : '32px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: '0 0 8px',
          }}
        >
          Certificate Verification
        </h1>
        <p
          style={{
            fontSize: '14px',
            color: 'var(--text-secondary)',
            margin: 0,
          }}
        >
          IEEE CS SRM Hize
        </p>
      </div>

      {/* Certificate ID Display */}
      {certId && (
        <div
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            padding: '16px 20px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '6px',
            }}
          >
            Certificate ID
          </div>
          <div
            style={{
              fontSize: isMobile ? '16px' : '18px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              fontFamily: 'monospace',
            }}
          >
            {certId}
          </div>
        </div>
      )}

      {/* Verification Form */}
      <div
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '4px',
          padding: isMobile ? '20px' : '24px',
          marginBottom: '16px',
        }}
      >
        <label
          htmlFor="name-input"
          style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '8px',
          }}
        >
          Enter your name to verify
        </label>
        <input
          id="name-input"
          type="text"
          placeholder="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={verifying}
          style={{
            width: '100%',
            padding: '12px 16px',
            fontSize: '15px',
            fontWeight: 500,
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            color: 'var(--text-primary)',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = 'var(--text-primary)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'var(--border-color)';
          }}
        />

        <button
          type="button"
          onClick={handleVerify}
          disabled={verifying || !name.trim()}
          style={{
            width: '100%',
            marginTop: '16px',
            padding: '12px 24px',
            fontSize: '15px',
            fontWeight: 600,
            background: verifying || !name.trim() ? 'var(--border-color)' : 'var(--text-primary)',
            color: verifying || !name.trim() ? 'var(--text-secondary)' : 'var(--bg-primary)',
            border: 'none',
            borderRadius: '4px',
            cursor: verifying || !name.trim() ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            opacity: verifying || !name.trim() ? 0.6 : 1,
          }}
        >
          {verifying ? 'Verifying...' : 'Verify Certificate'}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '4px',
            color: '#ef4444',
            fontSize: '14px',
            fontWeight: 500,
            marginBottom: '16px',
          }}
        >
          {error}
        </div>
      )}

      {/* Verification Result */}
      {verificationResult && verificationResult.verified && (
        <div
          className="certvault-verified-tick-card"
          style={{
            padding: '20px 24px',
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '4px',
            marginBottom: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="certvault-tick-wrap" style={{ flexShrink: 0 }}>
              <svg
                className="certvault-tick-svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#22c55e"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <span
              style={{
                fontSize: '18px',
                fontWeight: 700,
                color: '#22c55e',
              }}
            >
              Certificate Verified
            </span>
          </div>

          <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
            <div style={{ marginBottom: '8px' }}>
              <strong>Name:</strong> {verificationResult.certificateData?.name || name}
            </div>
            {verificationResult.attendeeEmail && (
              <div style={{ marginBottom: '8px' }}>
                <strong>Email:</strong> {verificationResult.attendeeEmail}
              </div>
            )}
            {verificationResult.certificateData?.event && (
              <div style={{ marginBottom: '8px' }}>
                <strong>Event:</strong> {verificationResult.certificateData.event}
              </div>
            )}
            {verificationResult.certificateData?.date && (
              <div style={{ marginBottom: '8px' }}>
                <strong>Date:</strong> {verificationResult.certificateData.date}
              </div>
            )}
            {verificationResult.certificateData?.organization && (
              <div>
                <strong>Issued by:</strong> {verificationResult.certificateData.organization}
              </div>
            )}
          </div>
        </div>
      )}

      {verificationResult && !verificationResult.verified && (
        <div
          style={{
            padding: '20px 24px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '4px',
            color: '#ef4444',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px',
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ef4444"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <span style={{ fontSize: '18px', fontWeight: 700 }}>
              Verification Failed
            </span>
          </div>
          <p style={{ margin: 0 }}>
            The provided name does not match our records for this certificate ID.
          </p>
        </div>
      )}

      {/* Info Footer */}
      <div
        style={{
          marginTop: '32px',
          padding: '16px',
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '4px',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          textAlign: 'center',
        }}
      >
        <p style={{ margin: '0 0 8px' }}>
          This verification system is provided by CertVault - GradeX For IEEE CS SRM Hize event.
        </p>
        <p style={{ margin: 0 }}>
          For support, contact: <strong>info@ieeecssrm.in</strong>
        </p>
      </div>

      <style>{`
        .certvault-tick-wrap {
          animation: certvault-tick-pop 0.5s ease-out;
        }
        .certvault-tick-svg {
          animation: certvault-tick-draw 0.6s ease-out 0.2s both;
        }
        @keyframes certvault-tick-pop {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.15); }
          70% { transform: scale(0.95); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes certvault-tick-draw {
          0% { stroke-dasharray: 0 100; opacity: 0; }
          100% { stroke-dasharray: 100 0; opacity: 1; }
        }
      `}</style>
    </div>
  );
}
