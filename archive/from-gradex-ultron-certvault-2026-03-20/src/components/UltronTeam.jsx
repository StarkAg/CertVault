import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import UltronParticles from './UltronParticles';

const isTenDigit = (s) => typeof s === 'string' && /^\d{10}$/.test(s.trim());

export default function UltronTeam() {
  const { teamCode } = useParams();
  const [teamNameInput, setTeamNameInput] = useState('');
  const [teamData, setTeamData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [reviewError, setReviewError] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showTeamQR, setShowTeamQR] = useState(false);
  const [teamQrDataUrl, setTeamQrDataUrl] = useState('');
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [newMembers, setNewMembers] = useState([]);
  const [addingMembers, setAddingMembers] = useState(false);
  const [addMembersError, setAddMembersError] = useState(null);
  const [addMembersSuccess, setAddMembersSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const teamCode10 = teamData?.team?.team_name_encrypted || '';
  useEffect(() => {
    if (!showTeamQR || !teamCode10) return;
    QRCode.toDataURL(teamCode10, { width: 256, margin: 2 })
      .then(setTeamQrDataUrl)
      .catch(() => setTeamQrDataUrl(''));
  }, [showTeamQR, teamCode10]);

  // Direct link: /ultron/team/:teamCode — 10-digit code only
  useEffect(() => {
    if (!teamCode || !teamCode.trim()) return;
    const code = teamCode.trim();
    if (!isTenDigit(code)) {
      setError('Invalid link. Use 10-digit code only.');
      return;
    }
    setLinkLoading(true);
    setError(null);
    fetch(`/api/ultron?action=team&qr_payload=${encodeURIComponent(code)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError('Team not found.');
          return;
        }
        setTeamData(data);
        if (data.team?.team_id) {
          localStorage.setItem('ultron_team_id', data.team.team_id.toString().toUpperCase().trim());
          if (code) localStorage.setItem('ultron_team_code', code);
        }
      })
      .catch(() => setError('Could not load team.'))
      .finally(() => setLinkLoading(false));
  }, [teamCode]);

  // No teamCode: check localStorage and load saved team
  useEffect(() => {
    if (teamCode) return;
    const savedTeamId = localStorage.getItem('ultron_team_id');
    if (savedTeamId) fetchTeamData(savedTeamId);
  }, [teamCode]);

  const handleLogin = async (e) => {
    e.preventDefault();

    const rawName = (teamNameInput || '').trim();
    if (!rawName) {
      setError('Please enter your Team Name');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const normalizedName = rawName.toLowerCase();
      const token = localStorage.getItem('gradex_token');
      const res = await fetch('/api/ultron?action=teams', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();

      if (!Array.isArray(data)) {
        setError('Unable to load teams. Please try again.');
        return;
      }

      const matches = data.filter(
        (t) => (t.team_name || '').trim().toLowerCase() === normalizedName
      );

      if (matches.length === 0) {
        setError('Team not found. Please check the spelling and try again.');
        return;
      }

      if (matches.length > 1) {
        setError('Multiple teams share this name. Please contact an organizer.');
        return;
      }

      const chosen = matches[0];
      const normalizedTeamId = (chosen.team_id || '').toString().toUpperCase().trim();
      if (!normalizedTeamId) {
        setError('Selected team has no valid ID. Contact an organizer.');
        return;
      }
      await fetchTeamData(normalizedTeamId);
    } catch (err) {
      console.error('Team login error:', err);
      setError('Something went wrong while logging in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamData = async (id) => {
    const normalizedId = id.toString().toUpperCase().trim();
    try {
      const res = await fetch(`/api/ultron?action=team&team_id=${encodeURIComponent(normalizedId)}`);
      const data = await res.json();
      if (!data.error && data.team) {
        setTeamData(data);
        localStorage.setItem('ultron_team_id', normalizedId);
        if (data.team.team_name_encrypted) localStorage.setItem('ultron_team_code', data.team.team_name_encrypted);
      }
    } catch (error) {
      console.error('Error fetching team data:', error);
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!teamData) return;
    setSubmittingReview(true);
    setReviewSuccess(false);
    setReviewError(null);
    try {
      const token = localStorage.getItem('gradex_token');
      const res = await fetch('/api/ultron?action=review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          team_id: teamData.team.team_id.toUpperCase().trim(),
          rating,
          feedback
        })
      });
      const data = await res.json();
      if (data.success) {
        setReviewSuccess(true);
        setFeedback('');
        setRating(5);
        setTimeout(() => setReviewSuccess(false), 4000);
      } else {
        setReviewError(data.error || 'Unknown error');
      }
    } catch (err) {
      setReviewError(err.message);
    } finally {
      setSubmittingReview(false);
    }
  };

  const getAvailableSlots = () => {
    if (!teamData) return 0;
    const teamSize = teamData.team.team_size || 1;
    const currentMembers = (teamData.members || []).length;
    return Math.max(0, teamSize - currentMembers);
  };

  const handleShowAddMembers = () => {
    const slots = getAvailableSlots();
    if (slots <= 0) return;
    const initialMembers = Array.from({ length: slots }, () => ({ name: '', email: '' }));
    setNewMembers(initialMembers);
    setShowAddMembers(true);
    setAddMembersError(null);
    setAddMembersSuccess(false);
  };

  const handleMemberChange = (index, field, value) => {
    const updated = [...newMembers];
    updated[index][field] = value;
    setNewMembers(updated);
  };

  const handleAddMembers = async () => {
    const validMembers = newMembers.filter((m) => m.name.trim() && m.email.trim());
    if (validMembers.length === 0) {
      setAddMembersError('Please fill in at least one member');
      return;
    }
    setAddingMembers(true);
    setAddMembersError(null);
    setAddMembersSuccess(false);
    try {
      const token = localStorage.getItem('gradex_token');
      const res = await fetch('/api/ultron?action=add-members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          team_id: teamData.team.team_id,
          members: validMembers
        })
      });
      const data = await res.json();
      if (data.success) {
        setAddMembersSuccess(true);
        setShowAddMembers(false);
        setNewMembers([]);
        // Reload team data
        const code = teamData.team.team_name_encrypted;
        if (code) {
          const refreshRes = await fetch(`/api/ultron?action=team&qr_payload=${encodeURIComponent(code)}`);
          const refreshData = await refreshRes.json();
          if (refreshData.team) {
            setTeamData(refreshData);
          }
        }
        setTimeout(() => setAddMembersSuccess(false), 3000);
      } else {
        setAddMembersError(data.error || 'Failed to add members');
      }
    } catch (err) {
      setAddMembersError(err.message);
    } finally {
      setAddingMembers(false);
    }
  };

  if (linkLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        background: 'radial-gradient(circle at top, #1b0b12 0, #050109 45%, #000000 100%)',
        color: '#f97373',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'AmericanCaptain', 'Bebas Neue', system-ui, sans-serif"
      }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(148,27,51,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,27,51,0.08) 1px, transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none', opacity: 0.9 }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at top, rgba(220,38,38,0.28) 0, transparent 60%), radial-gradient(circle at bottom, rgba(15,23,42,0.85) 0, transparent 55%)', pointerEvents: 'none' }} />
        <UltronParticles count={28} />
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 'clamp(24px, 5vw, 32px)', letterSpacing: '0.2em', textTransform: 'uppercase', animation: 'ultronTitleGlow 2s ease-in-out infinite' }}>Entering the Upside Down</div>
          <div style={{ marginTop: '16px', fontSize: '14px', color: 'rgba(248,250,252,0.7)' }}>Loading your team...</div>
        </div>
        <style>{`@keyframes ultronTitleGlow { 0%,100%{text-shadow:0 0 8px rgba(248,113,113,0.6),0 0 18px rgba(220,38,38,0.85)} 50%{text-shadow:0 0 3px rgba(248,113,113,0.4),0 0 10px rgba(220,38,38,0.65)} }`}</style>
      </div>
    );
  }

  if (teamCode && error && !teamData) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'radial-gradient(circle at top, #1b0b12 0, #050109 45%, #000000 100%)', color: '#f8fafc', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(220,38,38,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(220,38,38,0.04) 1px, transparent 1px)', backgroundSize: '32px 32px', pointerEvents: 'none', opacity: 0.9 }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at top, rgba(220,38,38,0.2) 0, transparent 55%)', pointerEvents: 'none' }} />
        <UltronParticles count={22} />
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ fontFamily: "'AmericanCaptain', 'Bebas Neue', system-ui", fontSize: 'clamp(22px, 4vw, 28px)', letterSpacing: '0.15em', color: '#f97373', marginBottom: '12px' }}>Team not found</div>
          <p style={{ color: 'rgba(248,250,252,0.7)', fontSize: '14px', marginBottom: '20px' }}>{error}</p>
          <button
            onClick={() => { setError(null); navigate('/ultron/team', { replace: true }); }}
            style={{ padding: '12px 24px', background: '#f97373', color: '#0f172a', border: 'none', borderRadius: '4px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', letterSpacing: '0.1em', textTransform: 'uppercase', boxShadow: '0 0 16px rgba(248,113,113,0.4)' }}
          >
            Log in by team name
          </button>
        </div>
      </div>
    );
  }

  if (!teamData) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        background: 'radial-gradient(circle at top, #1b0b12 0, #050109 45%, #000000 100%)',
        color: 'var(--text-primary)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(148,27,51,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,27,51,0.08) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            pointerEvents: 'none',
            opacity: 0.9
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at top, rgba(220,38,38,0.28) 0, transparent 60%), radial-gradient(circle at bottom, rgba(15,23,42,0.85) 0, transparent 55%)',
            pointerEvents: 'none'
          }}
        />
        <UltronParticles count={28} />
        <style>{`
          @keyframes ultronTitleGlow {
            0%, 100% { text-shadow: 0 0 8px rgba(248, 113, 113, 0.6), 0 0 18px rgba(220, 38, 38, 0.85); }
            50% { text-shadow: 0 0 3px rgba(248, 113, 113, 0.4), 0 0 10px rgba(220, 38, 38, 0.65); }
          }
          @keyframes ultronCardPulse {
            0%, 100% { box-shadow: 0 0 18px rgba(248, 113, 113, 0.15); border-color: rgba(248, 113, 113, 0.4); }
            50% { box-shadow: 0 0 28px rgba(248, 113, 113, 0.3); border-color: rgba(248, 113, 113, 0.7); }
          }
        `}</style>
        <div style={{
          maxWidth: isMobile ? '420px' : '520px',
          width: '100%',
          padding: isMobile ? '24px' : '32px',
          background: 'rgba(7, 7, 11, 0.92)',
          borderRadius: '4px',
          border: '1px solid rgba(248,113,113,0.5)',
          position: 'relative',
          boxShadow: '0 0 22px rgba(248,113,113,0.35)',
          animation: 'ultronCardPulse 3s ease-in-out infinite',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: isMobile ? '18px' : '24px' }}>
            <div
              style={{
                fontFamily: "'AmericanCaptain', 'Bebas Neue', system-ui, sans-serif",
                fontSize: isMobile ? '30px' : '40px',
                letterSpacing: isMobile ? '0.18em' : '0.24em',
                textTransform: 'uppercase',
                color: '#f97373',
                animation: 'ultronTitleGlow 3s ease-in-out infinite'
              }}
            >
              Ultron Team Gate
            </div>
            <div
              style={{
                marginTop: '6px',
                fontSize: isMobile ? '12px' : '13px',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'rgba(248,250,252,0.65)'
              }}
            >
              Enter the Upside Down
            </div>
          </div>

          <div
            style={{
              marginBottom: isMobile ? '18px' : '22px',
              padding: isMobile ? '8px 10px' : '10px 12px',
              borderRadius: '4px',
              border: '1px solid rgba(148,163,184,0.35)',
              background: 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(15,23,42,0.4))',
              fontSize: isMobile ? '11px' : '12px',
              color: 'rgba(226,232,240,0.9)',
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
              lineHeight: 1.6
            }}
          >
            Login using your <span style={{ color: '#f97373', fontWeight: 600 }}>exact team name</span> as registered
            for Ultron 9.0. Keep your email open for QR and event updates.
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                Team Name
              </label>
              <input
                type="text"
                value={teamNameInput}
                onChange={(e) => setTeamNameInput(e.target.value)}
                placeholder="Enter your Team Name"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: 'rgba(15,23,42,0.9)',
                  border: '1px solid rgba(148,163,184,0.65)',
                  borderRadius: '4px',
                  color: '#e5e7eb',
                  fontSize: '15px',
                  boxSizing: 'border-box',
                  fontFamily: "'Space Grotesk', system-ui, sans-serif",
                  outline: 'none',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#f97373';
                  e.currentTarget.style.boxShadow = '0 0 12px rgba(248,113,113,0.35)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(148,163,184,0.65)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                autoFocus
              />
            </div>
            {error && (
              <div style={{
                padding: '12px',
                marginBottom: '16px',
                background: 'rgba(239,68,68,0.14)',
                color: '#fca5a5',
                borderRadius: '4px',
                border: '1px solid rgba(248,113,113,0.6)',
                fontSize: '13px',
                fontFamily: "'Space Grotesk', system-ui, sans-serif"
              }}>
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 14px',
                background: loading ? 'rgba(248,113,113,0.35)' : '#f97373',
                color: '#020617',
                border: 'none',
                borderRadius: '4px',
                fontSize: '15px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                fontFamily: "'Space Grotesk', system-ui, sans-serif",
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                boxShadow: loading ? 'none' : '0 0 18px rgba(248,113,113,0.45)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 0 26px rgba(248,113,113,0.6)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 0 18px rgba(248,113,113,0.45)';
              }}
            >
              {loading ? 'Summoning Team...' : 'Enter Team Realm'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const foodComplete = () => {
    const t = teamData.team;
    const fc = typeof t.food_count === 'number' ? t.food_count : 0;
    const ts = Math.max(1, typeof t.team_size === 'number' ? t.team_size : 1);
    return fc >= ts;
  };
  const foodDisplay = () => {
    const t = teamData.team;
    const fc = typeof t.food_count === 'number' ? t.food_count : 0;
    const ts = Math.max(1, typeof t.team_size === 'number' ? t.team_size : 1);
    return `${Math.min(fc, ts)}/${ts}`;
  };

  return (
    <div className="ultron-team-dashboard" style={{
      minHeight: '100vh',
      padding: isMobile ? '16px' : '24px',
      background: 'radial-gradient(circle at top, #0d0a0f 0, #050109 40%, #000000 100%)',
      color: '#f8fafc',
      maxWidth: isMobile ? '100%' : '720px',
      width: '100%',
      margin: '0 auto',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: "'Space Grotesk', system-ui, sans-serif"
    }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(220,38,38,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(220,38,38,0.04) 1px, transparent 1px)', backgroundSize: '32px 32px', pointerEvents: 'none', opacity: 0.9 }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(220,38,38,0.18) 0, transparent 55%), radial-gradient(ellipse at 50% 100%, rgba(15,23,42,0.95) 0, transparent 50%)', pointerEvents: 'none' }} />
      <UltronParticles count={22} />
      <style>{`
        @keyframes stGlow { 0%,100%{box-shadow:0 0 12px rgba(220,38,38,0.25);border-color:rgba(248,113,113,0.45)} 50%{box-shadow:0 0 20px rgba(220,38,38,0.4);border-color:rgba(248,113,113,0.7)} }
        @keyframes stTitleGlow { 0%,100%{text-shadow:0 0 10px rgba(248,113,113,0.5),0 0 20px rgba(220,38,38,0.6)} 50%{text-shadow:0 0 4px rgba(248,113,113,0.35),0 0 12px rgba(220,38,38,0.45)} }
        @keyframes reviewStarPop { 0%{transform:scale(1)} 50%{transform:scale(1.15)} 100%{transform:scale(1)} }
        @keyframes reviewSuccessIn { 0%{opacity:0;transform:scale(0.9)} 100%{opacity:1;transform:scale(1)} }
        @keyframes qrFadeIn { 0%{opacity:0;transform:scale(0.95)} 100%{opacity:1;transform:scale(1)} }
      `}</style>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h1 style={{ fontFamily: "'AmericanCaptain', 'Bebas Neue', system-ui", fontSize: isMobile ? '24px' : '28px', letterSpacing: '0.12em', color: '#f97373', margin: 0, animation: 'stTitleGlow 3s ease-in-out infinite' }}>
            {teamData.team.team_name}
          </h1>
        </div>

        {/* Team Info + Food Status */}
        <div style={{
          padding: isMobile ? '20px' : '24px',
          background: 'rgba(15,15,22,0.85)',
          border: '1px solid rgba(248,113,113,0.4)',
          borderRadius: '4px',
          marginBottom: '20px',
          animation: 'stGlow 4s ease-in-out infinite',
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{ fontSize: '12px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(248,250,252,0.6)', marginBottom: '14px' }}>Status</div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{
              padding: '10px 14px',
              background: teamData.team.checked_in ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
              color: teamData.team.checked_in ? '#34d399' : '#f87171',
              borderRadius: '4px',
              border: `1px solid ${teamData.team.checked_in ? '#10b981' : '#ef4444'}`,
              fontWeight: 600,
              fontSize: '14px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              {teamData.team.checked_in ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              )}
              {teamData.team.checked_in ? 'Checked In' : 'Pending'}
            </div>
            <div style={{
              padding: '10px 14px',
              background: foodComplete() ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
              color: foodComplete() ? '#34d399' : '#fbbf24',
              borderRadius: '4px',
              border: `1px solid ${foodComplete() ? '#10b981' : '#f59e0b'}`,
              fontWeight: 600,
              fontSize: '14px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              {foodComplete() ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
              )}
              Food {foodDisplay()}
            </div>
          </div>
        </div>

        {/* Members */}
        <div style={{
          padding: isMobile ? '20px' : '24px',
          background: 'rgba(15,15,22,0.85)',
          border: '1px solid rgba(248,113,113,0.35)',
          borderRadius: '4px',
          marginBottom: '20px',
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{ fontSize: '12px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(248,250,252,0.6)', marginBottom: '14px' }}>Team Members</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {teamData.members.map((member, idx) => (
              <div
                key={idx}
                style={{
                  padding: '14px 16px',
                  background: 'rgba(30,27,45,0.6)',
                  border: '1px solid rgba(148,163,184,0.2)',
                  borderRadius: '4px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '15px' }}>{member.name}</div>
                  {member.email && <div style={{ fontSize: '13px', color: 'rgba(248,250,252,0.65)', marginTop: '2px' }}>{member.email}</div>}
                </div>
                <span style={{
                  padding: '4px 10px',
                  background: member.role === 'Leader' ? 'rgba(16,185,129,0.2)' : 'rgba(148,163,184,0.15)',
                  color: member.role === 'Leader' ? '#34d399' : 'rgba(248,250,252,0.8)',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  letterSpacing: '0.05em'
                }}>
                  {member.role}
                </span>
              </div>
            ))}
          </div>

          {/* Add Members Button */}
          {getAvailableSlots() > 0 && !showAddMembers && (
            <div style={{ marginTop: '16px' }}>
              <button
                type="button"
                onClick={handleShowAddMembers}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'rgba(16,185,129,0.15)',
                  color: '#34d399',
                  border: '1px solid rgba(16,185,129,0.4)',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'background 0.2s, box-shadow 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(16,185,129,0.25)';
                  e.currentTarget.style.boxShadow = '0 0 16px rgba(16,185,129,0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(16,185,129,0.15)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <line x1="19" y1="8" x2="19" y2="14"/>
                  <line x1="22" y1="11" x2="16" y2="11"/>
                </svg>
                Add Team Members ({getAvailableSlots()} slot{getAvailableSlots() > 1 ? 's' : ''} available)
              </button>
            </div>
          )}

          {/* Add Members Form */}
          {showAddMembers && (
            <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(30,27,45,0.5)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '4px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#34d399', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <line x1="19" y1="8" x2="19" y2="14"/>
                  <line x1="22" y1="11" x2="16" y2="11"/>
                </svg>
                Add New Members
              </div>
              {addMembersError && (
                <div style={{ padding: '10px 12px', marginBottom: '12px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '4px', color: '#f87171', fontSize: '13px' }}>
                  {addMembersError}
                </div>
              )}
              {addMembersSuccess && (
                <div style={{ padding: '10px 12px', marginBottom: '12px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.5)', borderRadius: '4px', color: '#34d399', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Members added successfully!
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {newMembers.map((member, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: 'rgba(15,15,22,0.6)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: '4px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(248,250,252,0.7)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      Member {idx + 1}
                    </div>
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={member.name}
                      onChange={(e) => handleMemberChange(idx, 'name', e.target.value)}
                      style={{
                        padding: '10px 12px',
                        background: 'rgba(30,27,45,0.8)',
                        border: '1px solid rgba(148,163,184,0.2)',
                        borderRadius: '4px',
                        color: '#f8fafc',
                        fontSize: '14px',
                        fontFamily: "'Space Grotesk', sans-serif"
                      }}
                    />
                    <input
                      type="email"
                      placeholder="Email Address"
                      value={member.email}
                      onChange={(e) => handleMemberChange(idx, 'email', e.target.value)}
                      style={{
                        padding: '10px 12px',
                        background: 'rgba(30,27,45,0.8)',
                        border: '1px solid rgba(148,163,184,0.2)',
                        borderRadius: '4px',
                        color: '#f8fafc',
                        fontSize: '14px',
                        fontFamily: "'Space Grotesk', sans-serif"
                      }}
                    />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={handleAddMembers}
                  disabled={addingMembers}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    background: addingMembers ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.25)',
                    color: '#34d399',
                    border: '1px solid rgba(16,185,129,0.5)',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: addingMembers ? 'not-allowed' : 'pointer',
                    opacity: addingMembers ? 0.6 : 1
                  }}
                >
                  {addingMembers ? 'Adding...' : 'Add Members'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMembers(false);
                    setNewMembers([]);
                    setAddMembersError(null);
                  }}
                  disabled={addingMembers}
                  style={{
                    padding: '12px 16px',
                    background: 'rgba(30,27,45,0.6)',
                    color: 'rgba(248,250,252,0.7)',
                    border: '1px solid rgba(148,163,184,0.3)',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: addingMembers ? 'not-allowed' : 'pointer',
                    opacity: addingMembers ? 0.6 : 1
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* View Team QR */}
        {teamCode10 && (
          <div style={{
            padding: isMobile ? '20px' : '24px',
            background: 'rgba(15,15,22,0.85)',
            border: '1px solid rgba(248,113,113,0.35)',
            borderRadius: '4px',
            marginBottom: '20px',
            backdropFilter: 'blur(8px)'
          }}>
            <div style={{ fontSize: '12px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(248,250,252,0.6)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              Team QR
            </div>
            {!showTeamQR ? (
              <button
                type="button"
                onClick={() => setShowTeamQR(true)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'rgba(248,113,113,0.12)',
                  color: '#f97373',
                  border: '1px solid rgba(248,113,113,0.4)',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'background 0.2s, box-shadow 0.2s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(248,113,113,0.2)'; e.currentTarget.style.boxShadow = '0 0 16px rgba(248,113,113,0.25)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(248,113,113,0.12)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                View team QR (10-digit code)
              </button>
            ) : (
              <div style={{ animation: 'qrFadeIn 0.3s ease-out' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontSize: '11px', letterSpacing: '0.1em', color: 'rgba(248,250,252,0.5)', textTransform: 'uppercase' }}>Your code</span>
                  <button
                    type="button"
                    onClick={() => setShowTeamQR(false)}
                    style={{ background: 'none', border: 'none', color: 'rgba(248,250,252,0.6)', cursor: 'pointer', fontSize: '12px', padding: '4px 8px' }}
                  >
                    Close
                  </button>
                </div>
                <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(30,27,45,0.5)', borderRadius: '4px', border: '1px solid rgba(148,163,184,0.2)' }}>
                  {teamQrDataUrl && <img src={teamQrDataUrl} alt="Team QR" style={{ width: 200, height: 200, display: 'block', margin: '0 auto 12px', background: '#fff', borderRadius: '4px', padding: '10px', boxSizing: 'border-box' }} />}
                  <p style={{ margin: 0, fontFamily: "'Courier New', monospace", fontSize: '18px', fontWeight: 700, color: '#f8fafc', letterSpacing: '0.08em' }}>{teamCode10}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Review – premium hackathon */}
        <div style={{
          padding: isMobile ? '20px' : '24px',
          background: 'linear-gradient(145deg, rgba(15,15,22,0.95) 0%, rgba(30,27,45,0.6) 100%)',
          border: '1px solid rgba(248,113,113,0.35)',
          borderRadius: '4px',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.2), 0 0 0 1px rgba(248,113,113,0.08)'
        }}>
          <div style={{ fontSize: '12px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(248,250,252,0.6)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
            Rate your experience
          </div>
          {reviewSuccess && (
            <div style={{
              padding: '16px',
              marginBottom: '16px',
              background: 'rgba(16,185,129,0.15)',
              border: '1px solid rgba(16,185,129,0.5)',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              animation: 'reviewSuccessIn 0.35s ease-out'
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span style={{ color: '#34d399', fontWeight: 600 }}>Thanks! Your review was submitted.</span>
            </div>
          )}
          {reviewError && (
            <div style={{ padding: '12px', marginBottom: '16px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '4px', color: '#f87171', fontSize: '14px' }}>
              {reviewError}
            </div>
          )}
          <form onSubmit={handleSubmitReview}>
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontWeight: 600, color: 'rgba(248,250,252,0.9)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                Rating
              </label>
              <div style={{ display: 'flex', gap: isMobile ? '2px' : '8px', alignItems: 'center', flexWrap: 'nowrap' }}>
                {[1, 2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setRating(num)}
                    style={{
                      padding: isMobile ? '4px 6px' : '10px 14px',
                      flexShrink: 0,
                      background: rating >= num ? 'rgba(251,191,36,0.25)' : 'rgba(30,27,45,0.6)',
                      color: rating >= num ? '#fbbf24' : 'rgba(248,250,252,0.7)',
                      border: `1px solid ${rating >= num ? '#f59e0b' : 'rgba(148,163,184,0.3)'}`,
                      borderRadius: isMobile ? '8px' : '10px',
                      cursor: 'pointer',
                      fontSize: '20px',
                      transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.08)';
                      e.currentTarget.style.boxShadow = '0 0 16px rgba(251,191,36,0.35)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <svg width={isMobile ? 14 : 20} height={isMobile ? 14 : 20} viewBox="0 0 24 24" fill={rating >= num ? '#fbbf24' : 'none'} stroke="#f59e0b" strokeWidth="1.5">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  </button>
                ))}
                <span style={{ marginLeft: isMobile ? '2px' : '6px', flexShrink: 0, fontWeight: 700, color: '#fbbf24', fontSize: isMobile ? '12px' : '15px' }}>{rating}/5</span>
              </div>
            </div>
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontWeight: 600, color: 'rgba(248,250,252,0.9)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Feedback (optional)
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Share your hackathon experience..."
                style={{
                  width: '100%',
                  minHeight: '100px',
                  padding: '14px',
                  background: 'rgba(30,27,45,0.6)',
                  border: '1px solid rgba(148,163,184,0.3)',
                  borderRadius: '4px',
                  color: '#f8fafc',
                  fontSize: '14px',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  transition: 'border-color 0.2s, box-shadow 0.2s'
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(248,113,113,0.5)'; e.currentTarget.style.boxShadow = '0 0 12px rgba(248,113,113,0.2)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(148,163,184,0.3)'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>
            <button
              type="submit"
              disabled={submittingReview}
              style={{
                width: '100%',
                padding: '16px',
                background: submittingReview ? 'rgba(248,113,113,0.3)' : 'linear-gradient(135deg, #f97373 0%, #dc2626 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '15px',
                fontWeight: 700,
                cursor: submittingReview ? 'not-allowed' : 'pointer',
                opacity: submittingReview ? 0.7 : 1,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                boxShadow: submittingReview ? 'none' : '0 4px 20px rgba(248,113,113,0.4)',
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}
              onMouseEnter={(e) => { if (!submittingReview) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(248,113,113,0.5)'; } }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(248,113,113,0.4)'; }}
            >
              {submittingReview ? 'Submitting…' : 'Submit Review'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
