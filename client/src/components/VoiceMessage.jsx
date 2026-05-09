import { useState, useRef } from 'react';

export default function VoiceMessage({ url }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
    setPlaying(!playing);
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
    setProgress((audio.currentTime / audio.duration) * 100);
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setDuration(audio.duration);
  };

  const handleEnded = () => {
    setPlaying(false);
    setProgress(0);
    setCurrentTime(0);
  };

  const formatTime = (s) => {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const seek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    const audio = audioRef.current;
    if (audio && audio.duration) {
      audio.currentTime = pct * audio.duration;
    }
  };

  return (
    <div className="flex items-center gap-3 py-1 px-1 min-w-[160px] max-w-full group">
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />
      
      <button 
        onClick={togglePlay} 
        className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all flex-shrink-0 active:scale-90"
      >
        {playing ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5"><polygon points="5 3 19 12 5 21 5 3" /></svg>
        )}
      </button>

      <div className="flex-1 flex flex-col gap-1.5">
        <div className="relative h-6 flex items-center cursor-pointer" onClick={seek}>
          {/* Track */}
          <div className="absolute inset-0 h-1 my-auto bg-white/10 rounded-full" />
          {/* Progress */}
          <div className="absolute left-0 h-1 my-auto bg-white/40 rounded-full transition-[width] duration-100 ease-linear" style={{ width: `${progress}%` }} />
          {/* Handle */}
          <div 
            className="absolute h-3 w-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" 
            style={{ left: `calc(${progress}% - 6px)`, top: '50%', transform: 'translateY(-50%)' }} 
          />
          
          {/* Animated Bars */}
          <div className="absolute inset-0 flex items-center justify-between pointer-events-none px-0.5 opacity-30">
            {Array.from({ length: 18 }).map((_, i) => (
              <span
                key={i}
                className={`w-[2px] bg-white rounded-full ${playing ? 'wave-bar' : 'h-1.5'}`}
                style={{ 
                  animationDelay: `${i * 0.08}s`,
                  height: playing ? undefined : '6px',
                  opacity: (i / 18) * 100 < progress ? 1 : 0.4
                }}
              />
            ))}
          </div>
        </div>
        
        <div className="flex justify-between items-center text-[10px] font-mono font-medium text-white/50 tabular-nums">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
