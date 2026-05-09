import { useState } from 'react';
import useAudioRecorder from '../hooks/useAudioRecorder';
import useMediaQuery from '../hooks/useMediaQuery';
import axios from 'axios';

export default function VoiceRecorder({ receiverId, token, onSent }) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { isRecording, duration, audioBlob, error, startRecording, stopRecording, clearRecording } = useAudioRecorder();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handleMouseDown = () => {
    setUploadError('');
    startRecording();
  };

  const handleMouseUp = () => {
    stopRecording();
  };

  const handleSend = async () => {
    if (!audioBlob || uploading) return;

    setUploading(true);
    setUploadError('');
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'voice.webm');
      formData.append('receiverId', receiverId);

      const res = await axios.post('/api/upload/voice', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      clearRecording();
      onSent?.(res.data.message);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Upload failed';
      setUploadError(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={styles.container}>
      {error && <div style={styles.error}>{error}</div>}
      {uploadError && <div style={styles.error}>{uploadError}</div>}

      <button
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={isRecording ? handleMouseUp : undefined}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
        disabled={uploading}
        style={{
          ...styles.micBtn,
          ...(isRecording ? styles.micBtnActive : {}),
          ...(uploading ? styles.micBtnDisabled : {}),
        }}
      >
        {uploading ? (
          <span style={styles.spinner} />
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="2" width="6" height="11" rx="3" />
            <path d="M5 10a7 7 0 0 0 14 0" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </svg>
        )}
      </button>

      {isRecording && (
        <div style={{ ...styles.recordingIndicator, gap: isMobile ? '4px' : '6px' }}>
          <span style={{ ...styles.recordingDot, width: isMobile ? '6px' : '8px', height: isMobile ? '6px' : '8px' }} />
          <span style={{ ...styles.timer, fontSize: isMobile ? '12px' : '14px' }}>
            {String(Math.floor(duration / 60)).padStart(2, '0')}:{String(duration % 60).padStart(2, '0')}
          </span>
          <div style={{ ...styles.recordingWaveform, gap: isMobile ? '1px' : '2px' }}>
            {Array.from({ length: isMobile ? 3 : 5 }).map((_, i) => (
              <span key={i} style={{ ...styles.recBar, animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      )}

      {audioBlob && !isRecording && (
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={handleSend} disabled={uploading} style={styles.sendBtn}>
            {uploading ? 'Sending...' : '\u27A4'}
          </button>
          <button onClick={clearRecording} disabled={uploading} style={styles.deleteBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  micBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: 'none',
    background: '#555',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
  },
  micBtnActive: {
    background: '#e53935',
    transform: 'scale(1.15)',
    boxShadow: '0 0 12px rgba(229,57,53,0.5)',
  },
  micBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  error: {
    color: '#e53935',
    fontSize: '12px',
  },
  recordingIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#e53935',
    fontSize: '14px',
  },
  recordingDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#e53935',
    animation: 'pulse 1s ease-in-out infinite',
  },
  timer: {
    fontVariantNumeric: 'tabular-nums',
    minWidth: '36px',
  },
  recordingWaveform: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    height: '20px',
  },
  recBar: {
    width: '3px',
    background: '#e53935',
    borderRadius: '2px',
    animation: 'waveform 0.5s ease-in-out infinite alternate',
  },
  sendBtn: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    color: '#4caf50',
    padding: '4px',
  },
  deleteBtn: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(229,57,53,0.2)',
    color: '#e53935',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px',
  },
  spinner: {
    width: '16px',
    height: '16px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.6s linear infinite',
    display: 'block',
  },
};
