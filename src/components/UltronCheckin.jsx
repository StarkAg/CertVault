import React, { useState, useRef, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import UltronParticles from './UltronParticles';

const isTenDigit = (s) => typeof s === 'string' && /^\d{10}$/.test(s.trim());

export default function UltronCheckin() {
  const [mode, setMode] = useState('entry'); // 'entry' or 'food'
  const [result, setResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [teamInfo, setTeamInfo] = useState(null); // Team info to display briefly
  const [waitingForNextScan, setWaitingForNextScan] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const qrCodeScannerRef = useRef(null);
  const [hasCamera, setHasCamera] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(true);
  const audioContextRef = useRef(null);
  const modeRef = useRef(mode); // Keep a ref to the current mode for callbacks

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const px = (a, b) => (isMobile ? a : b);
  const clampPx = (min, pref, max) => `clamp(${min}px, ${pref}, ${max}px)`;

  // Keep modeRef in sync with mode state
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    // Initialize audio context for beep sound
    try {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    } catch (error) {
      console.warn('Audio context not supported:', error);
    }

    // Check for camera access
    setCameraLoading(true);
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(() => {
        setHasCamera(true);
        setCameraLoading(false);
      })
      .catch((error) => {
        console.error('Camera access denied:', error);
        setHasCamera(false);
        setCameraLoading(false);
      });

    return () => {
      stopQRScanner();
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Start QR scanner when camera is available and component is mounted
  useEffect(() => {
    if (hasCamera) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        startQRScanner();
      }, 100);
      
      return () => {
        clearTimeout(timer);
        stopQRScanner();
      };
    }
  }, [hasCamera]);

  const playBeep = () => {
    if (!audioContextRef.current) return;
    
    try {
      const oscillator = audioContextRef.current.createOscillator();
      const gainNode = audioContextRef.current.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);
      
      oscillator.frequency.value = 800; // Nice beep frequency
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContextRef.current.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + 0.2);
      
      oscillator.start(audioContextRef.current.currentTime);
      oscillator.stop(audioContextRef.current.currentTime + 0.2);
    } catch (error) {
      console.warn('Error playing beep:', error);
    }
  };

  const triggerFlash = () => {
    setShowFlash(true);
    setTimeout(() => {
      setShowFlash(false);
    }, 300);
  };

  const startQRScanner = async () => {
    // Check if element exists
    const element = document.getElementById('qr-reader');
    if (!element) {
      console.warn('QR reader element not found, retrying...');
      setTimeout(() => startQRScanner(), 200);
      return;
    }

    // Stop any existing scanner first
    await stopQRScanner();

    try {
      const qrCodeScanner = new Html5Qrcode('qr-reader');
      qrCodeScannerRef.current = qrCodeScanner;

      // Try to get the best camera for the device
      // On mobile, prefer back camera; on desktop, use default/user camera
      const checkMobile = isMobile || window.innerWidth <= 768;

      const config = {
        fps: 10,
        qrbox: function(viewfinderWidth, viewfinderHeight) {
          // Scan entire camera view - no box overlay
          return {
            width: viewfinderWidth,
            height: viewfinderHeight
          };
        },
        // Don't constrain aspect ratio - let camera use its natural ratio
        disableFlip: false,
        showTorchButtonIfSupported: false,
        supportedScanTypes: []
      };
      let cameraConfig = checkMobile 
        ? { facingMode: 'environment' } // Back camera on mobile
        : { facingMode: 'user' }; // Front/default camera on desktop

      try {
        console.log('Starting QR scanner with config:', cameraConfig);
        await qrCodeScanner.start(
          cameraConfig,
          config,
          (decodedText, decodedResult) => {
            // QR code detected - play beep and flash
            playBeep();
            triggerFlash();

            // Pass raw payload to backend (supports encrypted QR + legacy team_id)
            handleQRScan(decodedText);

            // Only pause scanner automatically in FOOD mode (single-scan flow)
            const currentMode = modeRef.current;
            if (currentMode === 'food') {
              qrCodeScanner.pause();
            }
          },
          (errorMessage) => {
            // Ignore scanning errors (just means no QR found yet)
            // Only log if it's not a common "not found" error
            if (!errorMessage.includes('NotFoundException') && !errorMessage.includes('No QR code')) {
              console.debug('QR scan error:', errorMessage);
            }
          }
        );
        console.log('QR scanner started successfully');
      } catch (cameraError) {
        // If the preferred camera fails, try without facingMode constraint
        console.warn('Preferred camera failed, trying default:', cameraError);
        try {
          await qrCodeScanner.start(
            {}, // Let browser choose default camera
            config,
            (decodedText, decodedResult) => {
              playBeep();
              triggerFlash();

              // Pass raw payload to backend (supports encrypted QR + legacy team_id)
              handleQRScan(decodedText);

              // Only pause scanner automatically in FOOD mode (single-scan flow)
              const currentMode = modeRef.current;
              if (currentMode === 'food') {
                qrCodeScanner.pause();
              }
            },
            (errorMessage) => {
              // Ignore scanning errors
            }
          );
          console.log('QR scanner started with default camera');
        } catch (fallbackError) {
          console.error('Failed to start QR scanner with fallback:', fallbackError);
          setHasCamera(false);
        }
      }
    } catch (error) {
      console.error('Error initializing QR scanner:', error);
      setHasCamera(false);
    }
  };

  const stopQRScanner = async () => {
    if (qrCodeScannerRef.current) {
      try {
        await qrCodeScannerRef.current.stop();
        await qrCodeScannerRef.current.clear();
      } catch (error) {
        console.error('Error stopping QR scanner:', error);
      }
      qrCodeScannerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const handleQRScan = async (qrPayloadOrTeamId) => {
    const currentMode = modeRef.current;
    if (!qrPayloadOrTeamId) return;
    if (scanning) return;
    if (currentMode === 'food' && waitingForNextScan) return;

    setScanning(true);
    setResult(null);
    setTeamInfo(null);

    const raw = qrPayloadOrTeamId.toString().trim();
    console.log(`[QR Scan] Mode: ${currentMode}, raw: "${raw}"`);

    try {
      const teamRes = await fetch(
        `/api/ultron?action=team&qr_payload=${encodeURIComponent(raw)}`
      );
      const teamData = await teamRes.json();
      console.log('[QR Scan] Team resolve response:', teamData);

      if (teamData?.error || !teamData?.team?.team_id) {
        setResult({
          status: 'invalid',
          message: teamData?.error || 'Invalid QR / Team not found'
        });
        setShowFlash(false);
        setScanning(false);
        return;
      }

      const resolvedTeamId = teamData.team.team_id.toString().toUpperCase().trim();
      setTeamInfo({
        team_id: resolvedTeamId,
        team_name: teamData.team.team_name || 'Unknown Team',
        team_size: teamData.team.team_size || 0,
        code: raw
      });

      const endpoint = currentMode === 'entry' ? 'checkin' : 'food';
      console.log(`[QR Scan] Mode: ${currentMode}, Endpoint: ${endpoint}, Code: ${raw}`);

      const token = localStorage.getItem('gradex_token');
      const res = await fetch(`/api/ultron?action=${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ qr_payload: raw })
      });

      const data = await res.json();
      console.log(`[QR Scan] Response:`, data);
      setResult(data);

      if (data.team && data.team.team_id) {
        setTeamInfo({
          team_id: data.team.team_id,
          team_name: data.team.team_name || 'Unknown Team',
          team_size: data.team.team_size || 0,
          code: raw
        });
        setTimeout(() => setTeamInfo(null), 3000);
      } else {
        try {
          const infoRes = await fetch(
            `/api/ultron?action=team&qr_payload=${encodeURIComponent(raw)}`
          );
          const infoData = await infoRes.json();
          if (infoData?.team) {
            setTeamInfo({
              team_id: infoData.team.team_id,
              team_name: infoData.team.team_name || 'Unknown Team',
              team_size: infoData.team.team_size || 0,
              code: raw
            });
            setTimeout(() => setTeamInfo(null), 3000);
          }
        } catch (e) {
          console.warn('Failed to fetch team info for overlay:', e);
        }
      }
      
      if (currentMode === 'food') {
        // In food mode, wait for explicit user action before scanning next QR
        setScanning(false);
        setWaitingForNextScan(true);
      } else {
        // Entry mode: auto-resume after a short delay
        setTimeout(() => {
          if (qrCodeScannerRef.current) {
            try {
              if (typeof qrCodeScannerRef.current.resume === 'function') {
                const resumeResult = qrCodeScannerRef.current.resume();
                if (resumeResult && typeof resumeResult.catch === 'function') {
                  resumeResult.catch(() => {});
                }
              }
            } catch (err) {
              console.warn('Error resuming scanner:', err);
            }
          }
          setScanning(false);
        }, 2000);
      }
    } catch (error) {
      setResult({ status: 'error', message: error.message });
      setTeamInfo(null);

      if (currentMode === 'food') {
        // In food mode, still keep single-at-a-time behavior
        setScanning(false);
        setWaitingForNextScan(true);
      } else {
        // Entry mode: resume on error
        setScanning(false);
        if (qrCodeScannerRef.current) {
          try {
            if (typeof qrCodeScannerRef.current.resume === 'function') {
              const resumeResult = qrCodeScannerRef.current.resume();
              if (resumeResult && typeof resumeResult.catch === 'function') {
                resumeResult.catch(() => {});
              }
            }
          } catch (err) {
            console.warn('Error resuming scanner:', err);
          }
        }
      }
    }
  };

  const [manualInput, setManualInput] = useState('');
  const handleManualSubmit = (e) => {
    e.preventDefault();
    const normalizedInput = manualInput.trim();
    if (!normalizedInput) return;
    if (!isTenDigit(normalizedInput)) {
      setResult({ status: 'invalid', message: 'Invalid code. Use 10-digit code only.' });
      triggerFlash();
      return;
    }
    playBeep();
    triggerFlash();
    handleQRScan(normalizedInput);
    setManualInput('');
  };

  const handleNextScan = () => {
    if (qrCodeScannerRef.current) {
      try {
        if (typeof qrCodeScannerRef.current.resume === 'function') {
          const resumeResult = qrCodeScannerRef.current.resume();
          if (resumeResult && typeof resumeResult.catch === 'function') {
            resumeResult.catch(() => {});
          }
        }
      } catch (err) {
        console.warn('Error resuming scanner on next scan:', err);
      }
    }
    setWaitingForNextScan(false);
    setResult(null);
    setTeamInfo(null);
  };

  const ordinal = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v) || v < 1) return '1st';
    const s = v % 100;
    if (s >= 11 && s <= 13) return `${v}th`;
    switch (v % 10) {
      case 1: return `${v}st`;
      case 2: return `${v}nd`;
      case 3: return `${v}rd`;
      default: return `${v}th`;
    }
  };

  const getResultStyle = () => {
    if (!result) return {};
    const isFoodAlready = mode === 'food' && result.status === 'already';
    if (isFoodAlready) {
      return {
        background: '#ef444420',
        color: '#ef4444',
        border: '2px solid #ef4444'
      };
    }
    if (result.status === 'success') {
      return {
        background: '#10b98120',
        color: '#10b981',
        border: '2px solid #10b981'
      };
    }
    if (result.status === 'already' || result.status === 'not_checked_in') {
      return {
        background: '#f59e0b20',
        color: '#f59e0b',
        border: '2px solid #f59e0b'
      };
    }
    return {
      background: '#ef444420',
      color: '#ef4444',
      border: '2px solid #ef4444'
    };
  };

  return (
    <div style={{
      minHeight: 'calc(100vh - 60px)',
      height: 'calc(100vh - 60px)',
      overflow: 'auto',
      padding: clampPx(6, '2vw', 14),
      paddingLeft: 'max(env(safe-area-inset-left), 6px)',
      paddingRight: 'max(env(safe-area-inset-right), 6px)',
      paddingBottom: 'max(env(safe-area-inset-bottom), 6px)',
      background: 'radial-gradient(circle at top, #1b0b12 0, #050109 45%, #000000 100%)',
      color: 'var(--text-primary)',
      maxWidth: '100%',
      width: '100%',
      margin: 0,
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      position: 'relative',
      WebkitOverflowScrolling: 'touch'
    }}>
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
      <UltronParticles count={18} />
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      {/* Mode Toggle */}
      <div style={{
        display: 'flex',
        gap: clampPx(6, '1.2vw', 10),
        marginBottom: clampPx(8, '2vw', 14),
        background: 'var(--card-bg)',
        padding: '4px',
        borderRadius: clampPx(8, '1.5vw', 12),
        border: '1px solid var(--border-color)',
        flexShrink: 0
      }}>
        <button
          onClick={() => {
            setMode('entry');
            modeRef.current = 'entry';
            setResult(null);
            setWaitingForNextScan(false);
          }}
          style={{
            flex: 1,
            minHeight: 44,
            padding: clampPx(10, '2vw', 14),
            background: mode === 'entry' ? 'var(--text-primary)' : 'transparent',
            color: mode === 'entry' ? 'var(--bg-primary)' : 'var(--text-primary)',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: clampPx(12, '2.5vw', 14),
            transition: 'background 0.25s ease, color 0.25s ease, transform 0.15s ease',
            WebkitTapHighlightColor: 'transparent'
          }}
          onTouchStart={(e) => { e.currentTarget.style.transform = 'scale(0.98)'; }}
          onTouchEnd={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          ENTRY MODE
        </button>
        <button
          onClick={() => {
            setMode('food');
            modeRef.current = 'food';
            setResult(null);
            setWaitingForNextScan(false);
          }}
          style={{
            flex: 1,
            minHeight: 44,
            padding: clampPx(10, '2vw', 14),
            background: mode === 'food' ? 'var(--text-primary)' : 'transparent',
            color: mode === 'food' ? 'var(--bg-primary)' : 'var(--text-primary)',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: clampPx(12, '2.5vw', 14),
            transition: 'background 0.25s ease, color 0.25s ease, transform 0.15s ease',
            WebkitTapHighlightColor: 'transparent'
          }}
          onTouchStart={(e) => { e.currentTarget.style.transform = 'scale(0.98)'; }}
          onTouchEnd={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          FOOD MODE
        </button>
      </div>

      {/* Camera View - Full Screen QR Scanner */}
      {cameraLoading && (
        <div style={{
          flex: 1,
          borderRadius: clampPx(8, '1.5vw', 12),
          overflow: 'hidden',
          border: '2px solid var(--border-color)',
          background: '#0a0a0a',
          position: 'relative',
          width: '100%',
          minHeight: 'min(40vh, 280px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.9)',
          fontSize: clampPx(14, '3vw', 18)
        }}>
          <div style={{ animation: 'loadingPulse 1.2s ease-in-out infinite' }}>Loading camera…</div>
        </div>
      )}
      {!cameraLoading && !hasCamera && (
        <div style={{
          flex: 1,
          borderRadius: clampPx(8, '1.5vw', 12),
          overflow: 'hidden',
          border: '2px solid var(--border-color)',
          background: 'var(--card-bg)',
          padding: clampPx(16, '4vw', 24),
          textAlign: 'center',
          color: 'var(--text-secondary)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 'min(40vh, 280px)'
        }}>
          <div style={{ fontSize: clampPx(40, '10vw', 56), marginBottom: clampPx(10, '2vw', 14), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width={clampPx(40, '10vw', 56)} height={clampPx(40, '10vw', 56)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
              <circle cx="12" cy="13" r="4"></circle>
            </svg>
          </div>
          <div style={{ fontSize: clampPx(14, '3.5vw', 18), fontWeight: 600, marginBottom: 6 }}>Camera Not Available</div>
          <div style={{ fontSize: clampPx(12, '2.5vw', 15) }}>Please allow camera permissions</div>
        </div>
      )}
      {hasCamera && !cameraLoading && (
        <div style={{
          flex: 1,
          borderRadius: clampPx(8, '1.5vw', 12),
          overflow: 'hidden',
          border: '2px solid var(--border-color)',
          background: '#000',
          position: 'relative',
          width: '100%',
          minHeight: 'min(35vh, 260px)',
          maxHeight: isMobile ? '50vh' : 'calc(100vh - 200px)',
          marginTop: clampPx(8, '1.5vw', 14),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'cameraFadeIn 0.4s ease-out'
        }}>
          <div id="qr-reader" style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}></div>
          
          {/* Green Flash Overlay */}
          {showFlash && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(16, 185, 129, 0.6)',
              zIndex: 1000,
              animation: 'flashFade 0.3s ease-out',
              pointerEvents: 'none'
            }} />
          )}
          
          {/* Team Info Display - Center Overlay */}
          {teamInfo && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'rgba(0, 0, 0, 0.88)',
              color: 'white',
              padding: clampPx(16, '4vw', 28),
              borderRadius: clampPx(10, '2vw', 14),
              zIndex: 2000,
              textAlign: 'center',
              minWidth: `min(90vw, ${px(220, 300)}px)`,
              maxWidth: '95vw',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
              animation: 'teamInfoFade 3s ease-out',
              pointerEvents: 'none',
              border: '2px solid rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(8px)'
            }}>
              <div style={{
                fontSize: clampPx(16, '4vw', 24),
                fontWeight: 700,
                marginBottom: clampPx(6, '1.5vw', 12),
                fontFamily: "'Space Grotesk', sans-serif"
              }}>
                {teamInfo.team_name}
              </div>
              <div style={{
                fontSize: clampPx(12, '2.8vw', 16),
                marginBottom: clampPx(4, '1vw', 8),
                opacity: 0.9,
                fontFamily: "'Space Grotesk', sans-serif"
              }}>
                Code: <strong>{teamInfo.code ?? teamInfo.team_id}</strong>
              </div>
              <div style={{
                fontSize: clampPx(12, '2.8vw', 16),
                opacity: 0.9,
                fontFamily: "'Space Grotesk', sans-serif"
              }}>
                Team Size: <strong>{teamInfo.team_size}</strong>
              </div>
            </div>
          )}
          
          <style>{`
            #qr-reader__dashboard_section_csr {
              display: none !important;
            }
            #qr-reader__camera_selection {
              display: none !important;
            }
            #qr-reader__scan_region {
              border: none !important;
              width: 100% !important;
              height: 100% !important;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
            }
            #qr-reader__scan_region video {
              width: 100% !important;
              height: auto !important;
              max-height: 100% !important;
              object-fit: contain !important;
              display: block !important;
            }
            #qr-reader__camera_permission_button {
              display: none !important;
            }
            #qr-reader__dashboard {
              display: none !important;
            }
            #qr-reader__status_span {
              display: none !important;
            }
            #qr-reader__header {
              display: none !important;
            }
            #qr-reader__header_message {
              display: none !important;
            }
            #qr-reader__close_button {
              display: none !important;
            }
            #qr-reader__camera_selection {
              display: none !important;
            }
            #qr-reader__file_selection {
              display: none !important;
            }
            #qr-reader__file_selection_label {
              display: none !important;
            }
            #qr-reader__file_selection_label_input {
              display: none !important;
            }
            #qr-reader__scan_region_scan_region {
              width: 100% !important;
              height: 100% !important;
            }
            @keyframes flashFade {
              0% {
                opacity: 0.8;
                background: rgba(16, 185, 129, 0.8);
              }
              50% {
                opacity: 0.6;
                background: rgba(16, 185, 129, 0.6);
              }
              100% {
                opacity: 0;
                background: rgba(16, 185, 129, 0);
              }
            }
            @keyframes loadingPulse {
              0%, 100% { opacity: 0.6; }
              50% { opacity: 1; }
            }
            @keyframes cameraFadeIn {
              0% { opacity: 0; transform: scale(0.98); }
              100% { opacity: 1; transform: scale(1); }
            }
            @keyframes resultSlideIn {
              0% { opacity: 0; transform: translateY(-12px); }
              100% { opacity: 1; transform: translateY(0); }
            }
            @keyframes crossShake {
              0%, 100% { transform: scale(1) rotate(0deg); }
              15% { transform: scale(1.08) rotate(-3deg); }
              30% { transform: scale(1.08) rotate(3deg); }
              45% { transform: scale(1.05) rotate(-2deg); }
              60% { transform: scale(1.05) rotate(2deg); }
              75% { transform: scale(1.02) rotate(-1deg); }
            }
            @keyframes teamInfoFade {
              0% {
                opacity: 0;
                transform: translate(-50%, -50%) scale(0.9);
              }
              10% {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
              }
              90% {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
              }
              100% {
                opacity: 0;
                transform: translate(-50%, -50%) scale(0.95);
              }
            }
            @keyframes foodSuccessPop {
              0% { transform: scale(0.85); opacity: 0.6; }
              50% { transform: scale(1.12); opacity: 1; }
              70% { transform: scale(0.97); opacity: 1; }
              100% { transform: scale(1); opacity: 1; }
            }
            @keyframes foodSuccessGlow {
              0%, 100% { filter: drop-shadow(0 0 8px rgba(16, 185, 129, 0.5)); }
              50% { filter: drop-shadow(0 0 16px rgba(16, 185, 129, 0.8)); }
            }
            @keyframes foodCompletePulse {
              0%, 100% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.05); opacity: 0.95; }
            }
          `}</style>
        </div>
      )}

      {/* Result Display - Compact */}
      {result && (
        <div style={{
          padding: `${clampPx(10, '2vw', 16)} ${clampPx(12, '3vw', 20)}`,
          borderRadius: clampPx(8, '1.5vw', 12),
          textAlign: 'center',
          fontSize: clampPx(13, '2.8vw', 17),
          fontWeight: 600,
          marginBottom: clampPx(6, '1.5vw', 10),
          flexShrink: 0,
          animation: 'resultSlideIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
          ...getResultStyle()
        }}>
          {result.status === 'success' && (
            <div>
              {mode === 'food' ? (
                <>
                  <div style={{
                    marginBottom: clampPx(6, '1.5vw', 10),
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: clampPx(6, '1.5vw', 10),
                    animation: 'foodSuccessPop 0.5s ease-out, foodSuccessGlow 1.2s ease-in-out 2'
                  }}>
                    <svg width={px(26, 36)} height={px(26, 36)} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                      <line x1="3" y1="6" x2="21" y2="6"></line>
                      <path d="M16 10a4 4 0 0 1-8 0"></path>
                    </svg>
                    <svg width={px(22, 30)} height={px(22, 30)} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                  <div style={{ marginBottom: 2 }}>
                    {ordinal(result.team?.food_count ?? 1)} member collected food
                  </div>
                  {(result.team?.food_count != null && result.team?.team_size != null) && (
                    <div style={{ fontSize: clampPx(11, '2.4vw', 14), fontWeight: 500, opacity: 0.9 }}>
                      ({result.team.food_count}/{result.team.team_size})
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ marginBottom: clampPx(6, '1.5vw', 10), display: 'flex', justifyContent: 'center' }}>
                    <svg width={px(30, 42)} height={px(30, 42)} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                  <div>{result.message}</div>
                </>
              )}
            </div>
          )}
          {result.status === 'already' && (
            <div>
              {mode === 'food' ? (
                <>
                  <div style={{
                    marginBottom: clampPx(8, '2vw', 12),
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}>
                    <svg width={px(56, 80)} height={px(56, 80)} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, animation: 'crossShake 0.6s ease-out' }}>
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: clampPx(13, '2.8vw', 17) }}>All members have collected</div>
                  {(result.team?.food_count != null && result.team?.team_size != null) && (
                    <div style={{ fontSize: clampPx(11, '2.4vw', 14), fontWeight: 500, opacity: 0.9, marginTop: clampPx(4, '1vw', 6) }}>
                      ({result.team.food_count}/{result.team.team_size})
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ marginBottom: clampPx(6, '1.5vw', 10), display: 'flex', justifyContent: 'center' }}>
                    <svg width={px(30, 42)} height={px(30, 42)} viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                      <line x1="12" y1="9" x2="12" y2="13"></line>
                      <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                  </div>
                  <div>{result.message}</div>
                </>
              )}
            </div>
          )}
          {result.status === 'not_checked_in' && mode === 'food' && (
            <div>
              <div style={{ marginBottom: clampPx(6, '1.5vw', 10), display: 'flex', justifyContent: 'center' }}>
                <svg width={px(30, 42)} height={px(30, 42)} viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              </div>
              <div>Team must check in first</div>
              <div style={{ fontSize: clampPx(11, '2.4vw', 14), fontWeight: 500, opacity: 0.9, marginTop: clampPx(4, '1vw', 6) }}>
                Use Entry mode to check in, then scan again for food.
              </div>
            </div>
          )}
          {((result.status === 'invalid' || result.status === 'error') || (result.status === 'not_checked_in' && mode !== 'food')) && (
            <div>
              <div style={{ marginBottom: clampPx(6, '1.5vw', 10), display: 'flex', justifyContent: 'center' }}>
                <svg width={px(30, 42)} height={px(30, 42)} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
              </div>
              <div>{result.message || 'Error processing request'}</div>
            </div>
          )}
        </div>
      )}

      {/* Food mode: explicit scan control */}
      {mode === 'food' && waitingForNextScan && (
        <div style={{
          marginTop: clampPx(6, '1.5vw', 10),
          marginBottom: clampPx(6, '1.5vw', 10),
          textAlign: 'center',
          animation: 'resultSlideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}>
          <button
            type="button"
            onClick={handleNextScan}
            style={{
              minHeight: 44,
              padding: `${clampPx(10, '2vw', 14)} ${clampPx(16, '4vw', 22)}`,
              background: 'var(--accent-color, #3b82f6)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 999,
              fontSize: clampPx(13, '2.8vw', 16),
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              WebkitTapHighlightColor: 'transparent',
              boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)'
            }}
            onTouchStart={(e) => { e.currentTarget.style.transform = 'scale(0.96)'; }}
            onTouchEnd={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            Scan Another
          </button>
        </div>
      )}

      {/* Manual Input - Compact */}
      <div style={{
        padding: clampPx(10, '2.5vw', 16),
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: clampPx(8, '1.5vw', 12),
        flexShrink: 0,
        marginTop: clampPx(8, '2vw', 14)
      }}>
        <form onSubmit={handleManualSubmit}>
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="Enter 10-digit code"
            style={{
              width: '100%',
              minHeight: 44,
              padding: `${clampPx(10, '2vw', 14)} ${clampPx(12, '2.5vw', 16)}`,
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 6,
              color: 'var(--text-primary)',
              fontSize: clampPx(14, '2.8vw', 16),
              boxSizing: 'border-box',
              marginBottom: clampPx(8, '1.5vw', 12)
            }}
          />
          <button
            type="submit"
            disabled={scanning || !manualInput.trim()}
            style={{
              width: '100%',
              minHeight: 44,
              padding: clampPx(10, '2vw', 14),
              background: 'var(--text-primary)',
              color: 'var(--bg-primary)',
              border: 'none',
              borderRadius: 6,
              fontSize: clampPx(14, '2.8vw', 16),
              fontWeight: 600,
              cursor: scanning || !manualInput.trim() ? 'not-allowed' : 'pointer',
              opacity: scanning || !manualInput.trim() ? 0.6 : 1,
              transition: 'transform 0.15s ease, opacity 0.2s ease',
              WebkitTapHighlightColor: 'transparent'
            }}
            onTouchStart={(e) => { if (!scanning && manualInput.trim()) e.currentTarget.style.transform = 'scale(0.98)'; }}
            onTouchEnd={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            {scanning ? 'Processing...' : 'Submit'}
          </button>
        </form>
      </div>
      </div>
    </div>
  );
}
