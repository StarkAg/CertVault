import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import UltronParticles from './UltronParticles';

const STAT_KEYS = ['total_teams', 'checked_in', 'food_distributed', 'pending_entry', 'pending_food'];

function UltronAdminContent() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [teams, setTeams] = useState([]);
  const [teamSearch, setTeamSearch] = useState('');
  const [reviews, setReviews] = useState([]);
  const [csvText, setCsvText] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [resetFoodModalOpen, setResetFoodModalOpen] = useState(false);
  const [resetFoodConfirm, setResetFoodConfirm] = useState('');
  const [resetFoodLoading, setResetFoodLoading] = useState(false);
  const [bumpKeys, setBumpKeys] = useState([]);
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [editTeamSize, setEditTeamSize] = useState('');
  const prevStatsRef = useRef(null);
  const navigate = useNavigate();

  const RESET_FOOD_CONFIRM = 'RESET FOOD';
  const resetFoodMatch = (resetFoodConfirm || '').trim().toUpperCase() === RESET_FOOD_CONFIRM;

  const filteredTeams = useMemo(() => {
    const q = (teamSearch || '').trim().toLowerCase();
    if (!q) return teams;
    return teams.filter((t) => {
      const tid = (t.team_id || '').toLowerCase();
      const tname = (t.team_name || '').toLowerCase();
      const lname = (t.leader_name || '').toLowerCase();
      const lemail = (t.leader_email || '').toLowerCase();
      return tid.includes(q) || tname.includes(q) || lname.includes(q) || lemail.includes(q);
    });
  }, [teams, teamSearch]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchStats();
      const interval = setInterval(() => { fetchStats(); }, 3000);
      return () => clearInterval(interval);
    } else if (activeTab === 'teams') {
      fetchTeams();
      const interval = setInterval(() => { fetchTeams(); }, 4000);
      return () => clearInterval(interval);
    } else if (activeTab === 'feedback') {
      fetchReviews();
      const interval = setInterval(() => { fetchReviews(); }, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // Fetch reviews on mount to check if tab should be shown
  useEffect(() => {
    const loadReviews = async () => {
      try {
        const token = localStorage.getItem('gradex_token');
        const res = await fetch('/api/ultron?action=reviews', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        setReviews(data);
      } catch (error) {
        console.error('Error fetching reviews:', error);
      }
    };
    loadReviews();
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('gradex_token');
      const res = await fetch('/api/ultron?action=stats', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      const prev = prevStatsRef.current;
      const changed = prev ? STAT_KEYS.filter((k) => String(data[k] ?? '') !== String(prev[k] ?? '')) : [];
      prevStatsRef.current = data;
      setStats(data);
      if (changed.length) {
        setBumpKeys(changed);
        setTimeout(() => setBumpKeys([]), 550);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchTeams = async () => {
    try {
      const token = localStorage.getItem('gradex_token');
      const res = await fetch('/api/ultron?action=teams', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setTeams(data);
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  };

  const fetchReviews = async () => {
    try {
      const token = localStorage.getItem('gradex_token');
      const res = await fetch('/api/ultron?action=reviews', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setReviews(data);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    }
  };

  const handleUploadCSV = async () => {
    if (!csvText.trim()) {
      setMessage({ type: 'error', text: 'Please paste CSV data' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('gradex_token');
      const res = await fetch('/api/ultron?action=upload-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ csv: csvText })
      });

      const data = await res.json();
      
      if (data.success) {
        setMessage({ 
          type: 'success', 
          text: `Successfully processed ${data.processed} teams` 
        });
        setCsvText('');
        fetchTeams();
      } else {
        setMessage({ type: 'error', text: data.error || 'Upload failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSendQRs = async () => {
    // Prevent multiple clicks
    if (loading) {
      return;
    }
    
    // Ask for confirmation before sending to all teams
    const confirmMessage = 'Send QR codes + team codes to team leaders. Type "CONFIRM" to send to ALL teams (2s delay between emails, Gmail-friendly), or enter an email to send only to that leader.';
    const userInput = prompt(confirmMessage);
    
    if (!userInput) {
      return; // User cancelled
    }
    
    setLoading(true);
    setMessage(null);

    try {
      // Check if user entered an email or CONFIRM
      const isEmail = userInput.includes('@');
      const requestBody = isEmail 
        ? { email: userInput.trim() }
        : userInput.trim().toUpperCase() === 'CONFIRM'
          ? { confirm_send_all: true }
          : null;
      
      if (!requestBody) {
        setMessage({ type: 'error', text: 'Send cancelled. You must enter an email or type CONFIRM.' });
        setLoading(false);
        return;
      }
      
      const token = localStorage.getItem('gradex_token');
      const res = await fetch('/api/ultron?action=send-qrs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(requestBody)
      });

      const data = await res.json();
      
      if (data.success) {
        setMessage({ 
          type: 'success', 
          text: `QR codes sent to ${data.sent} teams${data.skipped > 0 ? ` (${data.skipped} skipped)` : ''}` 
        });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to send QR codes' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleResetFoodSubmit = async () => {
    if (!resetFoodMatch || resetFoodLoading) return;
    setResetFoodLoading(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('gradex_token');
      const res = await fetch('/api/ultron?action=reset-food', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ confirm: RESET_FOOD_CONFIRM })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: data.message + (data.teams_updated != null ? ` (${data.teams_updated} teams)` : '') });
        setResetFoodModalOpen(false);
        setResetFoodConfirm('');
        fetchStats();
        if (activeTab === 'teams') fetchTeams();
      } else {
        setMessage({ type: 'error', text: data.error || 'Reset failed' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: e.message || 'Reset failed' });
    } finally {
      setResetFoodLoading(false);
    }
  };

  const foodComplete = (team) => {
    const fc = Number(team?.food_count);
    const ts = Math.max(1, Number(team?.team_size) || 1);
    if (Number.isFinite(fc)) return fc >= ts;
    return !!team?.food_collected;
  };

  const foodDisplay = (team) => {
    const fc = Number(team?.food_count);
    const ts = Math.max(1, Number(team?.team_size) || 1);
    if (Number.isFinite(fc)) return `${fc}/${ts}`;
    return team?.food_collected ? `1/${ts}` : `0/${ts}`;
  };

  const getStatusBadge = (checkedIn, foodCollected) => {
    if (checkedIn && foodCollected) {
      return <span style={{ 
        padding: isMobile ? '2px 6px' : '6px 12px', 
        background: 'var(--success-bg)', 
        color: 'var(--success-color)', 
        borderRadius: '4px', 
        fontSize: isMobile ? '9px' : '12px',
        fontWeight: 600,
        fontFamily: "'Space Grotesk', sans-serif",
        letterSpacing: isMobile ? '0.04em' : '0.08em',
        textTransform: 'uppercase',
        border: '1px solid var(--success-border)',
        whiteSpace: 'nowrap'
      }}>Complete</span>;
    } else if (checkedIn) {
      return <span style={{ 
        padding: isMobile ? '2px 6px' : '6px 12px', 
        background: 'rgba(245, 158, 11, 0.12)', 
        color: '#f59e0b', 
        borderRadius: '4px', 
        fontSize: isMobile ? '9px' : '12px',
        fontWeight: 600,
        fontFamily: "'Space Grotesk', sans-serif",
        letterSpacing: isMobile ? '0.04em' : '0.08em',
        textTransform: 'uppercase',
        border: '1px solid rgba(245, 158, 11, 0.3)',
        whiteSpace: 'nowrap'
      }}>Checked In</span>;
    } else {
      return <span style={{ 
        padding: isMobile ? '2px 6px' : '6px 12px', 
        background: 'var(--error-bg)', 
        color: 'var(--error-color)', 
        borderRadius: '4px', 
        fontSize: isMobile ? '9px' : '12px',
        fontWeight: 600,
        fontFamily: "'Space Grotesk', sans-serif",
        letterSpacing: isMobile ? '0.04em' : '0.08em',
        textTransform: 'uppercase',
        border: '1px solid var(--error-border)',
        whiteSpace: 'nowrap'
      }}>Pending</span>;
    }
  };

  const handleEditTeamSize = (team) => {
    setEditingTeamId(team.id);
    setEditTeamSize(String(team.team_size || 1));
  };

  const handleCancelEditSize = () => {
    setEditingTeamId(null);
    setEditTeamSize('');
  };

  const handleSaveTeamSize = async (team) => {
    const newSize = parseInt(editTeamSize, 10);
    if (!Number.isFinite(newSize) || newSize < 1 || newSize > 10) {
      setMessage({ type: 'error', text: 'Team size must be between 1 and 10' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('gradex_token');
      const res = await fetch('/api/ultron?action=update-team-size', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ team_id: team.team_id, team_size: newSize })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `Team size updated to ${newSize}` });
        setEditingTeamId(null);
        setEditTeamSize('');
        fetchTeams();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update team size' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      padding: isMobile ? '12px' : 'clamp(16px, 3vw, 28px)',
      background: 'radial-gradient(circle at top, #1b0b12 0, #050109 45%, #000000 100%)',
      color: 'var(--text-primary)',
      maxWidth: isMobile ? '100%' : '1400px',
      width: '100%',
      margin: '0 auto',
      fontFamily: "'Space Grotesk', system-ui, -apple-system, 'Segoe UI', sans-serif",
      boxSizing: 'border-box',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background grid + glow layers to match team gate theme */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(148,27,51,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(148,27,51,0.06) 1px, transparent 1px)',
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
            'radial-gradient(circle at top, rgba(220,38,38,0.24) 0, transparent 60%), radial-gradient(circle at bottom, rgba(15,23,42,0.9) 0, transparent 55%)',
          pointerEvents: 'none'
        }}
      />
      <UltronParticles count={26} />
      <style>{`
        @keyframes ultronAdminCardPulse {
          0%, 100% { box-shadow: 0 0 16px rgba(248, 113, 113, 0.12); border-color: rgba(148, 163, 184, 0.4); }
          50% { box-shadow: 0 0 26px rgba(248, 113, 113, 0.26); border-color: rgba(248, 113, 113, 0.7); }
        }
        @keyframes statBump {
          0%, 100% { transform: scale(1); opacity: 1; }
          40% { transform: scale(1.12); opacity: 1; }
          70% { transform: scale(0.96); opacity: 0.95; }
        }
      `}</style>
      {/* Header - Centered */}
      <div style={{ 
        marginBottom: 'clamp(24px, 4vw, 40px)',
        textAlign: 'center'
      }}>
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'clamp(12px, 2vw, 20px)',
          marginBottom: 'clamp(16px, 3vw, 24px)'
        }}>
          <img 
            src="/IEEEXULTRON.png" 
            alt="Ultron 9.0"
            style={{
              maxWidth: isMobile ? '180px' : '280px',
              width: 'auto',
              height: 'auto',
              maxHeight: isMobile ? '50px' : '70px',
              objectFit: 'contain',
              margin: '0 auto'
            }}
          />
          <h1 style={{ 
            fontSize: isMobile ? 'clamp(20px, 5vw, 28px)' : 'clamp(28px, 4vw, 40px)', 
            fontWeight: 700, 
            margin: 0,
            fontFamily: "'AmericanCaptain', 'Bebas Neue', sans-serif",
            letterSpacing: '0.1em',
            textAlign: 'center'
          }}>
            Admin Dashboard
          </h1>
        </div>
        <button
          onClick={() => navigate('/ultron/checkin')}
          style={{
            padding: isMobile ? '10px 20px' : '12px 24px',
            background: 'var(--text-primary)',
            color: 'var(--bg-primary)',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 600,
            fontFamily: "'Space Grotesk', sans-serif",
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontSize: isMobile ? '12px' : '13px',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
            display: 'inline-block',
            minWidth: isMobile ? '200px' : 'auto'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
          }}
        >
          Open QR Scanner
        </button>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: isMobile ? '4px' : '8px',
        marginBottom: 'clamp(20px, 3vw, 32px)',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '8px',
        flexWrap: 'wrap',
        justifyContent: isMobile ? 'center' : 'flex-start',
        overflowX: isMobile ? 'auto' : 'visible',
        WebkitOverflowScrolling: 'touch'
      }}>
        {['dashboard', 'teams', 'feedback', 'upload'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: isMobile ? '8px 12px' : '10px 18px',
              background: activeTab === tab ? 'var(--text-primary)' : 'transparent',
              color: activeTab === tab ? 'var(--bg-primary)' : 'var(--text-primary)',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
              textTransform: 'uppercase',
              fontSize: isMobile ? '11px' : '13px',
              letterSpacing: '0.14em',
              fontFamily: "'Space Grotesk', sans-serif",
              transition: 'all 0.2s ease',
              position: 'relative',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
            onMouseEnter={(e) => {
              if (activeTab !== tab) {
                e.currentTarget.style.background = 'var(--hover-bg)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab) {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            {tab === 'dashboard'
              ? 'Dashboard'
              : tab === 'teams'
                ? 'Teams'
                : tab === 'feedback'
                  ? 'Feedback'
                  : 'Upload'}
          </button>
        ))}
      </div>

      {/* Message */}
      {message && (
        <div style={{
          padding: isMobile ? '12px' : '16px',
          marginBottom: isMobile ? '16px' : '20px',
          background: message.type === 'success' ? 'var(--success-bg)' : 'var(--error-bg)',
          color: message.type === 'success' ? 'var(--success-color)' : 'var(--error-color)',
          borderRadius: '4px',
          border: `1px solid ${message.type === 'success' ? 'var(--success-border)' : 'var(--error-border)'}`,
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: isMobile ? '14px' : '15px',
          fontWeight: 500,
          animation: 'slideInFade 0.3s ease-out',
          textAlign: isMobile ? 'center' : 'left'
        }}>
          {message.text}
        </div>
      )}

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && stats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: isMobile ? '12px' : 'clamp(12px, 3vw, 20px)',
          marginBottom: 'clamp(20px, 3vw, 32px)'
        }}>
          <div style={{
            padding: isMobile ? '16px' : 'clamp(16px, 3vw, 28px)',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 8px var(--shadow-color)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-hover)';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px var(--shadow-color)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-color)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px var(--shadow-color)';
          }}
          >
            <div style={{ 
              fontSize: isMobile ? '11px' : '13px', 
              color: 'var(--text-secondary)', 
              marginBottom: isMobile ? '8px' : '12px',
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontWeight: 600
            }}>
              Total Teams
            </div>
            <div style={{ 
              fontSize: isMobile ? 'clamp(24px, 6vw, 32px)' : 'clamp(28px, 4vw, 40px)', 
              fontWeight: 700,
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: '0.02em',
              animation: bumpKeys.includes('total_teams') ? 'statBump 0.45s ease-out' : 'none'
            }}>
              {stats.total_teams}
            </div>
          </div>
          <div style={{
            padding: isMobile ? '16px' : 'clamp(16px, 3vw, 28px)',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 8px var(--shadow-color)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-hover)';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px var(--shadow-color)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-color)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px var(--shadow-color)';
          }}
          >
            <div style={{ 
              fontSize: isMobile ? '11px' : '13px', 
              color: 'var(--text-secondary)', 
              marginBottom: isMobile ? '8px' : '12px',
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontWeight: 600
            }}>
              Checked In
            </div>
            <div style={{ 
              fontSize: isMobile ? 'clamp(24px, 6vw, 32px)' : 'clamp(28px, 4vw, 40px)', 
              fontWeight: 700, 
              color: 'var(--success-color)',
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: '0.02em',
              animation: bumpKeys.includes('checked_in') ? 'statBump 0.45s ease-out' : 'none'
            }}>
              {stats.checked_in}
            </div>
          </div>
          <div style={{
            padding: isMobile ? '16px' : 'clamp(16px, 3vw, 28px)',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 8px var(--shadow-color)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-hover)';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px var(--shadow-color)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-color)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px var(--shadow-color)';
          }}
          >
            <div style={{ 
              fontSize: isMobile ? '11px' : '13px', 
              color: 'var(--text-secondary)', 
              marginBottom: isMobile ? '8px' : '12px',
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontWeight: 600
            }}>
              Food Distributed
            </div>
            <div style={{ 
              fontSize: isMobile ? 'clamp(24px, 6vw, 32px)' : 'clamp(28px, 4vw, 40px)', 
              fontWeight: 700, 
              color: 'var(--success-color)',
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: '0.02em',
              animation: bumpKeys.includes('food_distributed') ? 'statBump 0.45s ease-out' : 'none'
            }}>
              {stats.food_distributed}
            </div>
          </div>
          <div style={{
            padding: isMobile ? '16px' : 'clamp(16px, 3vw, 28px)',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 8px var(--shadow-color)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-hover)';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px var(--shadow-color)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-color)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px var(--shadow-color)';
          }}
          >
            <div style={{ 
              fontSize: isMobile ? '11px' : '13px', 
              color: 'var(--text-secondary)', 
              marginBottom: isMobile ? '8px' : '12px',
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontWeight: 600
            }}>
              Pending Entry
            </div>
            <div style={{ 
              fontSize: isMobile ? 'clamp(24px, 6vw, 32px)' : 'clamp(28px, 4vw, 40px)', 
              fontWeight: 700, 
              color: 'var(--error-color)',
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: '0.02em',
              animation: bumpKeys.includes('pending_entry') ? 'statBump 0.45s ease-out' : 'none'
            }}>
              {stats.pending_entry}
            </div>
          </div>
          <div style={{
            padding: isMobile ? '16px' : 'clamp(16px, 3vw, 28px)',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 8px var(--shadow-color)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-hover)';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px var(--shadow-color)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-color)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px var(--shadow-color)';
          }}
          >
            <div style={{ 
              fontSize: isMobile ? '11px' : '13px', 
              color: 'var(--text-secondary)', 
              marginBottom: isMobile ? '8px' : '12px',
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontWeight: 600
            }}>
              Pending Food
            </div>
            <div style={{ 
              fontSize: isMobile ? 'clamp(24px, 6vw, 32px)' : 'clamp(28px, 4vw, 40px)', 
              fontWeight: 700, 
              color: '#f59e0b',
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: '0.02em',
              animation: bumpKeys.includes('pending_food') ? 'statBump 0.45s ease-out' : 'none'
            }}>
              {stats.pending_food}
            </div>
          </div>
        </div>
        )}
        {activeTab === 'dashboard' && stats && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
            <button
              type="button"
              onClick={() => setResetFoodModalOpen(true)}
              style={{
                padding: '10px 18px',
                background: 'transparent',
                color: '#f59e0b',
                border: '1px solid rgba(245,158,11,0.5)',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '13px',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                fontFamily: "'Space Grotesk', sans-serif",
                transition: 'all 0.2s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(245,158,11,0.12)';
                e.currentTarget.style.borderColor = '#f59e0b';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'rgba(245,158,11,0.5)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              Reset Food
            </button>
          </div>
        )}

      {/* Reset Food modal */}
      {resetFoodModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)'
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setResetFoodModalOpen(false); }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '400px',
              padding: '24px',
              background: 'var(--card-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
              Reset Food
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
              All teams will be set to 0 portions (e.g. 0/4). Use this when introducing a new food round.
            </p>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Type <code style={{ background: 'var(--input-bg)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>RESET FOOD</code> to confirm
            </label>
            <input
              type="text"
              value={resetFoodConfirm}
              onChange={(e) => setResetFoodConfirm(e.target.value)}
              placeholder="RESET FOOD"
              autoComplete="off"
              style={{
                width: '100%',
                padding: '10px 12px',
                marginBottom: '16px',
                background: 'var(--input-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                fontFamily: "'Space Grotesk', sans-serif",
                boxSizing: 'border-box'
              }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--border-hover)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--border-color)'; }}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => { setResetFoodModalOpen(false); setResetFoodConfirm(''); }}
                style={{
                  padding: '10px 16px',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '13px'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetFoodSubmit}
                disabled={!resetFoodMatch || resetFoodLoading}
                style={{
                  padding: '10px 18px',
                  background: (!resetFoodMatch || resetFoodLoading) ? 'var(--hover-bg)' : '#ef4444',
                  color: (!resetFoodMatch || resetFoodLoading) ? 'var(--text-secondary)' : '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: (!resetFoodMatch || resetFoodLoading) ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: '13px',
                  opacity: (!resetFoodMatch || resetFoodLoading) ? 0.7 : 1
                }}
              >
                {resetFoodLoading ? 'Resetting…' : 'Reset Food'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Teams Tab */}
      {activeTab === 'teams' && (
        <div style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '4px',
          boxShadow: '0 2px 8px var(--shadow-color)',
          maxWidth: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '8px' : '12px',
            padding: isMobile ? '10px 12px' : '14px 16px',
            borderBottom: '1px solid var(--border-color)',
            flexShrink: 0
          }}>
            <input
              type="text"
              placeholder="Search by team name, ID, leader..."
              value={teamSearch}
              onChange={(e) => setTeamSearch(e.target.value)}
              style={{
                flex: 1,
                minWidth: 0,
                padding: isMobile ? '8px 10px' : '10px 14px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                fontSize: isMobile ? '13px' : '14px',
                fontFamily: "'Space Grotesk', sans-serif",
                transition: 'border-color 0.2s ease'
              }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--border-hover)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--border-color)'; }}
            />
            {teamSearch.trim() && (
              <span style={{
                fontSize: isMobile ? '11px' : '12px',
                color: 'var(--text-secondary)',
                whiteSpace: 'nowrap'
              }}>
                {filteredTeams.length} / {teams.length}
              </span>
            )}
          </div>
          <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            fontFamily: "'Space Grotesk', sans-serif",
            tableLayout: isMobile ? 'auto' : 'fixed',
            minWidth: isMobile ? '600px' : 0,
            fontSize: isMobile ? '9px' : 'inherit'
          }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ 
                  padding: isMobile ? '8px 4px' : '16px', 
                  textAlign: 'left',
                  fontSize: isMobile ? '9px' : '12px',
                  fontWeight: 600,
                  letterSpacing: isMobile ? '0.04em' : '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap'
                }}>Team Name</th>
                <th style={{ 
                  padding: isMobile ? '8px 4px' : '16px', 
                  textAlign: 'left',
                  fontSize: isMobile ? '9px' : '12px',
                  fontWeight: 600,
                  letterSpacing: isMobile ? '0.04em' : '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap'
                }}>Leader Name</th>
                <th style={{ 
                  padding: isMobile ? '8px 4px' : '16px', 
                  textAlign: 'left',
                  fontSize: isMobile ? '9px' : '12px',
                  fontWeight: 600,
                  letterSpacing: isMobile ? '0.04em' : '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap'
                }}>Leader Email</th>
                <th style={{ 
                  padding: isMobile ? '8px 4px' : '16px', 
                  textAlign: 'center',
                  fontSize: isMobile ? '9px' : '12px',
                  fontWeight: 600,
                  letterSpacing: isMobile ? '0.04em' : '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap'
                }}>Size</th>
                <th style={{ 
                  padding: isMobile ? '8px 4px' : '16px', 
                  textAlign: 'center',
                  fontSize: isMobile ? '9px' : '12px',
                  fontWeight: 600,
                  letterSpacing: isMobile ? '0.04em' : '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap'
                }}>Check-in</th>
                <th style={{ 
                  padding: isMobile ? '8px 4px' : '16px', 
                  textAlign: 'center',
                  fontSize: isMobile ? '9px' : '12px',
                  fontWeight: 600,
                  letterSpacing: isMobile ? '0.04em' : '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap'
                }}>Food</th>
                <th style={{ 
                  padding: isMobile ? '8px 4px' : '16px', 
                  textAlign: 'center',
                  fontSize: isMobile ? '9px' : '12px',
                  fontWeight: 600,
                  letterSpacing: isMobile ? '0.04em' : '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap'
                }}>Food (X/Y)</th>
                <th style={{ 
                  padding: isMobile ? '8px 4px' : '16px', 
                  textAlign: 'left',
                  fontSize: isMobile ? '9px' : '12px',
                  fontWeight: 600,
                  letterSpacing: isMobile ? '0.04em' : '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap'
                }}>Status</th>
                <th style={{ 
                  padding: isMobile ? '8px 4px' : '16px', 
                  textAlign: 'center',
                  fontSize: isMobile ? '9px' : '12px',
                  fontWeight: 600,
                  letterSpacing: isMobile ? '0.04em' : '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap'
                }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTeams.map(team => (
                <tr 
                  key={team.id} 
                  style={{ 
                    borderBottom: '1px solid var(--border-color)',
                    transition: 'background 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--hover-bg)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <td style={{ 
                    padding: isMobile ? '8px 4px' : '16px',
                    fontSize: isMobile ? '10px' : '13px',
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: isMobile ? '100px' : '200px'
                  }}>{team.team_name}</td>
                  <td style={{ 
                    padding: isMobile ? '8px 4px' : '16px',
                    fontSize: isMobile ? '10px' : '13px',
                    fontFamily: "'Space Grotesk', sans-serif",
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: isMobile ? '80px' : '150px'
                  }}>{team.leader_name || '-'}</td>
                  <td style={{ 
                    padding: isMobile ? '8px 4px' : '16px',
                    fontSize: isMobile ? '10px' : '13px',
                    fontFamily: "'Space Grotesk', sans-serif",
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: isMobile ? '100px' : '180px'
                  }}>
                    {team.leader_email || (
                      <span style={{ 
                        color: 'var(--error-color)', 
                        fontSize: isMobile ? '9px' : '11px',
                        fontFamily: "'Space Grotesk', sans-serif"
                      }}>No email</span>
                    )}
                  </td>
                  <td style={{ 
                    padding: isMobile ? '8px 4px' : '16px',
                    fontSize: isMobile ? '10px' : '13px',
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    textAlign: 'center'
                  }}>{team.team_size}</td>
                  <td style={{ 
                    padding: isMobile ? '8px 4px' : '16px',
                    textAlign: 'center',
                    whiteSpace: 'nowrap'
                  }}>
                    {team.checked_in ? (
                      <svg width={isMobile ? "16" : "20"} height={isMobile ? "16" : "20"} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" title="Checked In">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    ) : (
                      <svg width={isMobile ? "16" : "20"} height={isMobile ? "16" : "20"} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.3" title="Not Checked In">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                    )}
                  </td>
                  <td style={{ 
                    padding: isMobile ? '8px 4px' : '16px',
                    textAlign: 'center',
                    whiteSpace: 'nowrap'
                  }}>
                    {foodComplete(team) ? (
                      <svg width={isMobile ? "16" : "20"} height={isMobile ? "16" : "20"} viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" title="Food Collected">
                        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <path d="M16 10a4 4 0 0 1-8 0"></path>
                      </svg>
                    ) : (
                      <svg width={isMobile ? "16" : "20"} height={isMobile ? "16" : "20"} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.3" title="Food Not Collected">
                        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <path d="M16 10a4 4 0 0 1-8 0"></path>
                      </svg>
                    )}
                  </td>
                  <td style={{ 
                    padding: isMobile ? '8px 4px' : '16px',
                    fontSize: isMobile ? '10px' : '13px',
                    fontFamily: "'Space Grotesk', sans-serif",
                    textAlign: 'center',
                    whiteSpace: 'nowrap'
                  }}>
                    {foodDisplay(team)}
                  </td>
                  <td style={{ 
                    padding: isMobile ? '8px 4px' : '16px',
                    whiteSpace: 'nowrap'
                  }}>
                    {getStatusBadge(team.checked_in, foodComplete(team))}
                  </td>
                  <td style={{ 
                    padding: isMobile ? '8px 4px' : '16px',
                    textAlign: 'center',
                    whiteSpace: 'nowrap'
                  }}>
                    {editingTeamId === team.id ? (
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center' }}>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={editTeamSize}
                          onChange={(e) => setEditTeamSize(e.target.value)}
                          style={{
                            width: '50px',
                            padding: '4px 6px',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            color: 'var(--text-primary)',
                            fontSize: isMobile ? '10px' : '12px',
                            fontFamily: "'Space Grotesk', sans-serif"
                          }}
                        />
                        <button
                          onClick={() => handleSaveTeamSize(team)}
                          style={{
                            padding: '4px 8px',
                            background: '#10b981',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: isMobile ? '9px' : '11px',
                            fontWeight: 600
                          }}
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEditSize}
                          style={{
                            padding: '4px 8px',
                            background: 'var(--hover-bg)',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: isMobile ? '9px' : '11px',
                            fontWeight: 600
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEditTeamSize(team)}
                        style={{
                          padding: '4px 8px',
                          background: 'var(--hover-bg)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: isMobile ? '9px' : '11px',
                          fontWeight: 600,
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--bg-primary)';
                          e.currentTarget.style.borderColor = 'var(--border-hover)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'var(--hover-bg)';
                          e.currentTarget.style.borderColor = 'var(--border-color)';
                        }}
                      >
                        Edit Size
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Feedback Tab */}
      {activeTab === 'feedback' && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'clamp(12px, 3vw, 20px)'
        }}>
          {reviews.length === 0 ? (
            <div style={{
              padding: isMobile ? '16px' : '24px',
              background: 'var(--card-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              boxShadow: '0 2px 8px var(--shadow-color)',
              fontFamily: "'Space Grotesk', sans-serif",
              color: 'var(--text-secondary)',
              textAlign: 'center'
            }}>
              No feedback submitted yet.
            </div>
          ) : (
            reviews.map(review => (
              <div
                key={review.id}
                style={{
                  padding: isMobile ? '16px' : 'clamp(16px, 3vw, 24px)',
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px var(--shadow-color)',
                  fontFamily: "'Space Grotesk', sans-serif"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-hover)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px var(--shadow-color)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px var(--shadow-color)';
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: isMobile ? '8px' : '12px',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}>
                  <div style={{ 
                    fontWeight: 600,
                    fontSize: isMobile ? '16px' : '18px',
                    fontFamily: "'Space Grotesk', sans-serif"
                  }}>
                    {review.ultron_teams?.team_name || review.team_id}
                  </div>
                  <div style={{ 
                    display: 'flex',
                    gap: '4px',
                    alignItems: 'center',
                    lineHeight: 1
                  }}>
                    {Array.from({ length: review.rating }).map((_, i) => (
                      <svg key={i} width={isMobile ? '20' : '24'} height={isMobile ? '20' : '24'} viewBox="0 0 24 24" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                      </svg>
                    ))}
                  </div>
                </div>
                <div style={{ 
                  color: 'var(--text-secondary)', 
                  marginTop: isMobile ? '8px' : '12px',
                  fontSize: isMobile ? '14px' : '15px',
                  lineHeight: '1.6',
                  fontFamily: "'Space Grotesk', sans-serif",
                  whiteSpace: 'pre-wrap'
                }}>
                  {review.feedback ? review.feedback : '—'}
                </div>
                <div style={{ 
                  fontSize: isMobile ? '11px' : '12px', 
                  color: 'var(--text-tertiary)', 
                  marginTop: isMobile ? '8px' : '12px',
                  fontFamily: "'Space Grotesk', sans-serif",
                  letterSpacing: '0.05em'
                }}>
                  {new Date(review.submitted_at).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'clamp(16px, 3vw, 24px)'
        }}>
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: isMobile ? '8px' : '12px', 
              fontWeight: 600,
              fontSize: isMobile ? '13px' : '15px',
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-primary)'
            }}>
              Paste CSV Data
            </label>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder=""
              style={{
                width: '100%',
                minHeight: isMobile ? '150px' : '200px',
                padding: isMobile ? '12px' : '16px',
                background: 'var(--input-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                fontFamily: "'JetBrains Mono', 'SFMono-Regular', monospace",
                fontSize: isMobile ? '12px' : '14px',
                resize: 'vertical',
                transition: 'border-color 0.2s ease',
                lineHeight: '1.6'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-hover)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
              }}
            />
          </div>
          <div style={{ 
            display: 'flex', 
            gap: isMobile ? '8px' : '12px', 
            flexWrap: 'wrap',
            flexDirection: isMobile ? 'column' : 'row'
          }}>
            <button
              onClick={handleUploadCSV}
              disabled={loading}
              style={{
                padding: isMobile ? '10px 20px' : '12px 24px',
                background: 'var(--text-primary)',
                color: 'var(--bg-primary)',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                opacity: loading ? 0.6 : 1,
                fontFamily: "'Space Grotesk', sans-serif",
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontSize: isMobile ? '12px' : '13px',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                width: isMobile ? '100%' : 'auto'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
              }}
            >
              {loading ? 'Adding Teams...' : 'Add Teams'}
            </button>
            <button
              onClick={handleSendQRs}
              disabled={loading}
              style={{
                padding: isMobile ? '10px 20px' : '12px 24px',
                background: 'transparent',
                color: 'var(--text-primary)',
                border: '2px solid var(--text-primary)',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                opacity: loading ? 0.6 : 1,
                fontFamily: "'Space Grotesk', sans-serif",
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontSize: isMobile ? '12px' : '13px',
                transition: 'all 0.2s ease',
                width: isMobile ? '100%' : 'auto'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.background = 'var(--hover-bg)';
                  e.currentTarget.style.borderColor = 'var(--border-hover)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'var(--text-primary)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {loading ? 'Sending...' : 'Send QR Codes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function sha256Hex(s) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then((b) =>
    Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('')
  );
}

const _v = ['73f5f21bef6133d85b710576224f1a24', '53c9eb03e4c0a0276b920c2c43ef69af'].join('');

export default function UltronAdmin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const v = localStorage.getItem('ultron_admin_authenticated');
    if (v === 'true') setIsAuthenticated(true);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setChecking(true);
    setError('');
    try {
      const h = await sha256Hex((password || '').trim());
      if (h === _v) {
        localStorage.setItem('ultron_admin_authenticated', 'true');
        setIsAuthenticated(true);
        setPassword('');
      } else {
        setError('Incorrect password');
        setPassword('');
      }
    } catch {
      setError('Verification failed');
      setPassword('');
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('ultron_admin_authenticated');
    setIsAuthenticated(false);
    setPassword('');
  };

  if (!isAuthenticated) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        padding: '20px'
      }}>
        <div style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '4px',
          padding: '32px',
          maxWidth: '400px',
          width: '100%',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
        }}>
          <h2 style={{
            margin: '0 0 24px 0',
            color: 'var(--text-primary)',
            textAlign: 'center',
            fontSize: '24px',
            fontWeight: 700
          }}>
            Ultron Admin Login
          </h2>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: 'var(--text-secondary)',
                fontSize: '14px',
                fontWeight: 500
              }}>
                Admin Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: `1px solid ${error ? '#ef4444' : 'var(--border-color)'}`,
                  borderRadius: '4px',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '16px',
                  boxSizing: 'border-box'
                }}
                placeholder="Enter admin password"
                autoFocus
              />
              {error && (
                <div style={{
                  marginTop: '8px',
                  color: '#ef4444',
                  fontSize: '14px'
                }}>
                  {error}
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={checking}
              style={{
                width: '100%',
                padding: '12px',
                background: 'var(--text-primary)',
                color: 'var(--bg-primary)',
                border: 'none',
                borderRadius: '4px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: checking ? 'not-allowed' : 'pointer',
                opacity: checking ? 0.7 : 1,
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={(e) => { if (!checking) e.currentTarget.style.opacity = '0.9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = checking ? '0.7' : '1'; }}
            >
              {checking ? 'Checking…' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 1000
      }}>
        <button
          onClick={handleLogout}
          style={{
            padding: '8px 16px',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500
          }}
        >
          Logout
        </button>
      </div>
      <UltronAdminContent />
    </div>
  );
}
