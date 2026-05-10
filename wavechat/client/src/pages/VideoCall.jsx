import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import axios from 'axios';
import Peer from 'simple-peer';

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function getInitialColor(name) {
  const colors = ['#8A6EFF', '#FF6B8A', '#4ADE80', '#FBBF24', '#60A5FA', '#F472B6', '#34D399', '#A78BFA'];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function VideoCall() {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [facing, setFacing] = useState('user');
  const [timer, setTimer] = useState(0);
  const [partner, setPartner] = useState(null);
  const [callActive, setCallActive] = useState(false);

  const myVideoRef = useRef(null);
  const peerVideoRef = useRef(null);
  const peerRef = useRef(null);
  const myStreamRef = useRef(null);
  const socketRef = useRef(null);
  const initiatorRef = useRef(false);

  const token = localStorage.getItem('wc_token');
  const storedUser = localStorage.getItem('wc_user');
  const user = storedUser ? JSON.parse(storedUser) : null;

  useEffect(() => {
    if (!token) return;
    axios
      .get('/api/friends/list', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        const found = res.data.friends.find(f => f._id === userId);
        if (found) setPartner(found);
      })
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    if (!token || !user) return;

    socketRef.current = io('/', { auth: { token } });
    const socket = socketRef.current;

    socket.on('connect', () => {
      socket.emit('user:join', user.id);
    });

    const isInitiator = window.location.hash === '#initiate';
    initiatorRef.current = isInitiator;

    // Start local stream
    navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: true })
      .then(stream => {
        myStreamRef.current = stream;
        if (myVideoRef.current) myVideoRef.current.srcObject = stream;

        if (isInitiator) {
          const peer = new Peer({ initiator: true, trickle: false, stream });
          peerRef.current = peer;

          peer.on('signal', data => {
            socket.emit('call:offer', { receiverId: userId, offer: data });
          });

          peer.on('stream', remoteStream => {
            if (peerVideoRef.current) peerVideoRef.current.srcObject = remoteStream;
          });

          socket.emit('call:initiate', { receiverId: userId });
          setCallActive(true);
        }
      })
      .catch(() => {});

    // Handle incoming offer
    socket.on('call:offer', ({ offer }) => {
      if (initiatorRef.current) return;
      const peer = new Peer({ initiator: false, trickle: false, stream: myStreamRef.current });
      peerRef.current = peer;
      peer.signal(offer);

      peer.on('signal', data => {
        socket.emit('call:answer', { receiverId: userId, answer: data });
      });

      peer.on('stream', remoteStream => {
        if (peerVideoRef.current) peerVideoRef.current.srcObject = remoteStream;
      });

      setCallActive(true);
    });

    socket.on('call:answer', ({ answer }) => {
      peerRef.current?.signal(answer);
    });

    socket.on('call:ice-candidate', ({ candidate }) => {
      peerRef.current?.signal(candidate);
    });

    socket.on('call:end', () => {
      cleanup();
      navigate(-1);
    });

    return () => {
      socket.disconnect();
      cleanup();
    };
  }, [userId, user]);

  useEffect(() => {
    if (!callActive) return;
    const interval = setInterval(() => setTimer(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [callActive]);

  const cleanup = useCallback(() => {
    peerRef.current?.destroy();
    myStreamRef.current?.getTracks().forEach(t => t.stop());
    setCallActive(false);
  }, []);

  const endCall = () => {
    socketRef.current?.emit('call:end', { receiverId: userId });
    cleanup();
    navigate(-1);
  };

  const toggleCam = () => {
    setCamOff(prev => {
      myStreamRef.current?.getVideoTracks().forEach(t => (t.enabled = prev));
      return !prev;
    });
  };

  const toggleMute = () => {
    setMuted(prev => {
      myStreamRef.current?.getAudioTracks().forEach(t => (t.enabled = prev));
      return !prev;
    });
  };

  const toggleSpeaker = () => {
    setSpeakerOn(prev => !prev);
  };

  const toggleFlip = async () => {
    setFacing(prev => (prev === 'user' ? 'environment' : 'user'));
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing === 'user' ? 'environment' : 'user' }, audio: true });
    myStreamRef.current = stream;
    if (myVideoRef.current) myVideoRef.current.srcObject = stream;
  };

  const topInset = 'env(safe-area-inset-top, 44px)';
  const bottomInset = 'env(safe-area-inset-bottom, 24px)';
  const callerColor = getInitialColor(partner?.name || partner?.username);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'linear-gradient(170deg, #0B0B10, #130D24, #0B0B10)',
        paddingTop: topInset,
        paddingBottom: bottomInset,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* RADIAL GLOW */}
      <div
        style={{
          position: 'absolute',
          top: '25%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 320,
          height: 320,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${callerColor}30 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      {/* PEER VIDEO (full screen behind) */}
      <video
        ref={peerVideoRef}
        autoPlay
        playsInline
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: callActive ? 1 : 0,
          transition: 'opacity 0.3s',
        }}
      />

      {/* SELF PREVIEW */}
      <div
        style={{
          position: 'absolute',
          top: topInset,
          right: 14,
          width: 88,
          height: 124,
          borderRadius: 20,
          overflow: 'hidden',
          background: '#1A1A26',
          zIndex: 10,
          border: '2px solid rgba(255,255,255,.1)',
        }}
      >
        <video ref={myVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>

      {/* CALLER INFO */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, zIndex: 5 }}>
        {!callActive && (
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: '50%',
              background: callerColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              fontWeight: 600,
              color: '#fff',
              boxShadow: `0 0 40px ${callerColor}50`,
            }}
          >
            {getInitials(partner?.name || partner?.username)}
          </div>
        )}
        <div style={{ fontSize: 20, fontWeight: 600, color: '#F0F0F5' }}>
          {partner?.name || partner?.username || 'Connecting...'}
        </div>
        <div style={{ fontSize: 13, color: '#8A8A9E', fontVariantNumeric: 'tabular-nums' }}>
          {String(Math.floor(timer / 60)).padStart(2, '0')}:{String(timer % 60).padStart(2, '0')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#5A5A6E' }}>
          <span>HD</span>
          <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#5A5A6E' }} />
          <span>End-to-End Encrypted 🔒</span>
        </div>
      </div>

      {/* CONTROLS */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 20, padding: '20px 0', zIndex: 5 }}>
        {[
          { icon: muted ? '🔇' : '🎤', active: muted, onClick: toggleMute },
          { icon: camOff ? '🚫' : '📹', active: camOff, onClick: toggleCam },
          { icon: speakerOn ? '🔊' : '🔈', active: !speakerOn, onClick: toggleSpeaker },
          { icon: '🔄', active: false, onClick: toggleFlip },
        ].map((btn, i) => (
          <button
            key={i}
            onClick={btn.onClick}
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              border: btn.active ? '2px solid #8A6EFF' : '2px solid transparent',
              background: btn.active ? 'rgba(138,110,255,.25)' : 'rgba(255,255,255,.06)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              transition: 'all 0.2s',
            }}
          />
        ))}
      </div>

      {/* END CALL */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0', zIndex: 5 }}>
        <button
          onClick={endCall}
          style={{
            width: 68,
            height: 68,
            borderRadius: '50%',
            background: '#FF3232',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            animation: 'callGlow 2s infinite',
            transition: 'transform 0.15s',
          }}
          onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.92)')}
          onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          📵
        </button>
      </div>
    </div>
  );
}
