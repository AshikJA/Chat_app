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
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const seek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = pct * audio.duration;
    }
  };

  return (
    <div style={styles.container}>
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />
      <button onClick={togglePlay} style={styles.playBtn}>
        {playing ? '\u23F8' : '\u25B6'}
      </button>
      <div style={styles.waveform} onClick={seek}>
        <div style={{ ...styles.progressFill, width: `${progress}%` }} />
        <div style={styles.bars}>
          {Array.from({ length: 20 }).map((_, i) => (
            <span
              key={i}
              style={{
                ...styles.bar,
                animation: playing ? 'waveform 0.6s ease-in-out infinite alternate' : undefined,
                animationDelay: `${i * 0.1}s`,
                height: playing ? undefined : '16px',
                opacity: playing ? undefined : 0.4,
              }}
            />
          ))}
        </div>
      </div>
      <span style={styles.time}>{formatTime(playing ? currentTime : duration)}</span>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 8px',
    borderRadius: '8px',
    minWidth: '140px',
    maxWidth: '100%',
  },
  playBtn: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '2px',
    lineHeight: 1,
    flexShrink: 0,
  },
  waveform: {
    flex: 1,
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
    cursor: 'pointer',
    overflow: 'hidden',
    borderRadius: '4px',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    background: 'rgba(255,255,255,0.2)',
    borderRadius: '4px',
    transition: 'width 0.1s linear',
    pointerEvents: 'none',
  },
  bars: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    width: '100%',
    height: '100%',
    padding: '0 2px',
  },
  bar: {
    flex: 1,
    background: '#fff',
    borderRadius: '2px',
    minHeight: '4px',
  },
  time: {
    fontSize: '11px',
    fontVariantNumeric: 'tabular-nums',
    flexShrink: 0,
    minWidth: '28px',
    textAlign: 'right',
  },
};
