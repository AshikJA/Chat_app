import { useState } from 'react';
import useAudioRecorder from '../hooks/useAudioRecorder';
import useMediaQuery from '../hooks/useMediaQuery';
import axios from 'axios';

export default function VoiceRecorder({ receiverId, token, onSent }) {
  const isMobile = useMediaQuery('(max-width: 480px)');
  const { isRecording, duration, audioBlob, error, startRecording, stopRecording, clearRecording } = useAudioRecorder();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handleMouseDown = (e) => {
    e.preventDefault();
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
    <div className="flex items-center gap-2">
      {(error || uploadError) && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 bg-rose-600 text-white text-xs rounded-xl shadow-xl animate-fade-in z-50">
          {error || uploadError}
        </div>
      )}

      {isRecording && (
        <div className="absolute inset-0 bg-[#0a0a12]/80 backdrop-blur-md rounded-[24px] flex items-center justify-between px-6 z-10 animate-fade-in border border-rose-500/30">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
            <span className="text-sm font-mono font-bold text-rose-500 tabular-nums">
              {String(Math.floor(duration / 60)).padStart(2, '0')}:{String(duration % 60).padStart(2, '0')}
            </span>
            <div className="flex items-center gap-1 h-5 ml-1">
              {Array.from({ length: 8 }).map((_, i) => (
                <span key={i} className="w-[3px] bg-rose-500 rounded-full wave-bar" style={{ animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
          </div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest animate-pulse">Recording...</span>
        </div>
      )}

      <button
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={isRecording ? handleMouseUp : undefined}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
        disabled={uploading}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
          isRecording 
            ? 'bg-rose-600 scale-125 shadow-lg shadow-rose-600/30 z-20' 
            : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
        } disabled:opacity-50 flex-shrink-0`}
        title="Hold to record"
      >
        {uploading ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="9" y="2" width="6" height="11" rx="3" />
            <path d="M5 10a7 7 0 0 0 14 0" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </svg>
        )}
      </button>

      {audioBlob && !isRecording && (
        <div className="flex items-center gap-1 animate-fade-in">
          <button 
            onClick={handleSend} 
            disabled={uploading} 
            className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20 transition-all active:scale-90"
          >
            {uploading ? '…' : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>}
          </button>
          <button 
            onClick={clearRecording} 
            disabled={uploading} 
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-rose-600/20 text-slate-500 hover:text-rose-400 flex items-center justify-center transition-all active:scale-90"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}
