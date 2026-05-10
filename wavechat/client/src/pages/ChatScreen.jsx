import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import axios from 'axios';
import Avatar from '../components/Avatar';
import { encryptMessage, decryptMessage } from '../utils/encryption';

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

function formatMsgTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const bars = [8, 12, 18, 24, 30, 24, 18, 12, 8, 12, 18, 24, 30, 24, 18, 12, 8, 12, 18, 24];

export default function ChatScreen() {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [showAttach, setShowAttach] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [recordBlob, setRecordBlob] = useState(null);
  const [playingVoice, setPlayingVoice] = useState(null);
  const [partner, setPartner] = useState(null);
  const [user, setUser] = useState(null);
  const [myKeys, setMyKeys] = useState(null);
  const recordTimerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  const token = localStorage.getItem('wc_token');
  const storedUser = localStorage.getItem('wc_user');
  const storedKeys = localStorage.getItem('wc_private_key');

  useEffect(() => {
    if (storedUser) setUser(JSON.parse(storedUser));
  }, []);

  useEffect(() => {
    if (!token) return;
    axios
      .get(`/api/friends/list`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        const found = res.data.friends.find(f => f._id === userId);
        if (found) setPartner(found);
      })
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    if (!token) return;
    axios
      .get(`/api/messages/${userId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setMessages(res.data.messages))
      .catch(() => {});

    axios
      .put(`/api/messages/read/${userId}`, {}, { headers: { Authorization: `Bearer ${token}` } })
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    if (!token) return;
    socketRef.current = io('/', { auth: { token } });
    socketRef.current.on('connect', () => {
      if (user) socketRef.current.emit('user:join', user.id);
    });
    socketRef.current.on('message:receive', async (msg) => {
      if (msg.sender === userId || msg.receiver === userId) {
        if (msg.encrypted && msg.nonce && partner?.publicKey && storedKeys) {
          try {
            msg.content = await decryptMessage(msg.encrypted, msg.nonce, partner.publicKey, storedKeys);
          } catch {}
        }
        setMessages(prev => [...prev, msg]);
      }
    });
    return () => { socketRef.current?.disconnect(); };
  }, [userId, user, partner, storedKeys]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (recording) {
      recordTimerRef.current = setInterval(() => {
        setRecordTime(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(recordTimerRef.current);
    }
    return () => clearInterval(recordTimerRef.current);
  }, [recording]);

  const sendMessage = useCallback(async (payload) => {
    if (!socketRef.current || !user || !partner) return;
    const msg = {
      sender: user.id,
      receiver: userId,
      type: payload.type || 'text',
      content: payload.content || '',
      duration: payload.duration || '',
      createdAt: new Date().toISOString(),
    };
    if (payload.type === 'text' && partner.publicKey && storedKeys) {
      const myKeysData = JSON.parse(localStorage.getItem('wc_keypair') || '{}');
      const priv = myKeysData.privateKey || storedKeys;
      try {
        const enc = await encryptMessage(payload.content, partner.publicKey, priv);
        msg.encrypted = enc.encrypted;
        msg.nonce = enc.nonce;
      } catch {}
    }
    socketRef.current.emit('message:send', { receiverId: userId, message: msg });
    setMessages(prev => [...prev, msg]);
  }, [user, partner, userId, storedKeys]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage({ type: 'text', content: input.trim() });
    setInput('');
  };

  const handleSendVoice = async () => {
    if (!recordBlob) return;
    const form = new FormData();
    form.append('file', recordBlob, 'voice.webm');
    try {
      const res = await axios.post('/api/upload', form, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      sendMessage({ type: 'voice', content: res.data.url, duration: `${recordTime}s` });
    } catch {}
    setRecording(false);
    setRecordTime(0);
    setRecordBlob(null);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      const chunks = [];
      mr.ondataavailable = e => chunks.push(e.data);
      mr.onstop = () => {
        setRecordBlob(new Blob(chunks, { type: 'audio/webm' }));
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      setRecording(true);
      setRecordTime(0);
    } catch {}
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const cancelRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    setRecordTime(0);
    setRecordBlob(null);
  };

  const handleAttachImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await axios.post('/api/upload', form, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      sendMessage({ type: 'image', content: res.data.url });
    } catch {}
    setShowAttach(false);
  };

  const handleAttachVideo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await axios.post('/api/upload', form, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      sendMessage({ type: 'video', content: res.data.url });
    } catch {}
    setShowAttach(false);
  };

  const handlePlayVoice = (idx) => {
    setPlayingVoice(prev => prev === idx ? null : idx);
  };

  const topInset = 'env(safe-area-inset-top, 44px)';
  const bottomInset = 'env(safe-area-inset-bottom, 0px)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0B0B10' }}>
      {/* HEADER */}
      <div
        style={{
          paddingTop: topInset,
          paddingLeft: 8,
          paddingRight: 14,
          paddingBottom: 10,
          background: '#111118',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <button onClick={() => navigate(-1)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, fontSize: 30, lineHeight: 1, color: '#8A6EFF' }}>
          ‹
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <Avatar
            initials={getInitials(partner?.name || partner?.username)}
            color={getInitialColor(partner?.name || partner?.username)}
            size={38}
            online={partner?.status}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#F0F0F5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {partner?.name || partner?.username || 'Chat'}
            </div>
            <div style={{ fontSize: 11, color: partner?.status === 'online' ? '#4ADE80' : '#5A5A6E' }}>
              {partner?.status === 'online' ? 'Online' : 'Offline'}
            </div>
          </div>
        </div>
        <button style={{ ...iconBtn, background: '#8A6EFF20', borderRadius: 12, padding: 8 }}>
          <span style={{ fontSize: 18 }}>📹</span>
        </button>
        <button style={{ ...iconBtn, background: '#8A6EFF20', borderRadius: 12, padding: 8 }}>
          <span style={{ fontSize: 18 }}>📞</span>
        </button>
      </div>

      {/* MESSAGES */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6, scrollbarWidth: 'none' }}>
        {messages.map((msg, i) => {
          const isMe = msg.sender === user?.id;
          return (
            <div
              key={i}
              style={{
                alignSelf: isMe ? 'flex-end' : 'flex-start',
                maxWidth: '78%',
                animation: 'fadeUp 0.25s ease-out',
              }}
            >
              {msg.type === 'text' && (
                <div
                  style={{
                    padding: '10px 14px',
                    background: isMe ? 'linear-gradient(135deg, #8A6EFF, #6C4FE8)' : '#1A1A26',
                    borderRadius: isMe ? '18px 18px 5px 18px' : '18px 18px 18px 5px',
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: '#F0F0F5',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.content}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: isMe ? 'rgba(255,255,255,.6)' : '#5A5A6E' }}>{formatMsgTime(msg.createdAt)}</span>
                    {isMe && (
                      <svg width="14" height="10" viewBox="0 0 14 10" fill="none" style={{ opacity: 0.8 }}>
                        <path d="M1 5l3 3 5-5" stroke="#8A6EFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M7 5l3 3 3-3" stroke="#8A6EFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>
              )}
              {msg.type === 'image' && (
                <div
                  style={{
                    width: 190,
                    height: 140,
                    borderRadius: 16,
                    background: '#1A1A26',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    overflow: 'hidden',
                  }}
                >
                  {msg.content ? (
                    <img src={msg.content} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <>
                      <span style={{ fontSize: 28 }}>🖼️</span>
                      <span style={{ fontSize: 11, color: '#5A5A6E' }}>Image</span>
                    </>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4, padding: '4px 8px', width: '100%' }}>
                    <span style={{ fontSize: 10, color: isMe ? 'rgba(255,255,255,.6)' : '#5A5A6E' }}>{formatMsgTime(msg.createdAt)}</span>
                    {isMe && (
                      <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
                        <path d="M1 5l3 3 5-5" stroke="#8A6EFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M7 5l3 3 3-3" stroke="#8A6EFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>
              )}
              {msg.type === 'video' && (
                <div
                  style={{
                    width: 210,
                    height: 130,
                    borderRadius: 16,
                    background: '#1A1A26',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {msg.content ? (
                    <video src={msg.content} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : null}
                  <div style={{ position: 'absolute', width: 40, height: 40, borderRadius: '50%', background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
                      <polygon points="8,5 19,12 8,19" />
                    </svg>
                  </div>
                  <div style={{ position: 'absolute', bottom: 4, right: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 10, color: '#fff' }}>{formatMsgTime(msg.createdAt)}</span>
                    {isMe && (
                      <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
                        <path d="M1 5l3 3 5-5" stroke="#8A6EFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M7 5l3 3 3-3" stroke="#8A6EFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>
              )}
              {msg.type === 'voice' && (
                <div
                  style={{
                    padding: '10px 14px',
                    background: isMe ? 'linear-gradient(135deg, #8A6EFF, #6C4FE8)' : '#1A1A26',
                    borderRadius: isMe ? '18px 18px 5px 18px' : '18px 18px 18px 5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    minWidth: 140,
                  }}
                >
                  <button
                    onClick={() => handlePlayVoice(i)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,.15)',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {playingVoice === i ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff"><polygon points="8,5 19,12 8,19"/></svg>
                    )}
                  </button>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 24, flex: 1 }}>
                    {bars.slice(0, 12).map((h, j) => (
                      <div
                        key={j}
                        style={{
                          width: 3,
                          borderRadius: 2,
                          background: isMe ? 'rgba(255,255,255,.7)' : '#8A6EFF',
                          height: playingVoice === i ? h : 6,
                          animation: playingVoice === i ? `wave ${0.4 + (j % 3) * 0.15}s ease-in-out infinite` : 'none',
                          animationDelay: playingVoice === i ? `${j * 0.08}s` : '0s',
                          transition: 'height 0.2s',
                        }}
                      />
                    ))}
                  </div>
                  <span style={{ fontSize: 10, color: isMe ? 'rgba(255,255,255,.7)' : '#5A5A6E', flexShrink: 0 }}>
                    {msg.duration || '0s'}
                  </span>
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* ATTACH BOTTOM SHEET */}
      {showAttach && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            background: '#111118',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: '20px 20px 30px',
            paddingBottom: `max(${bottomInset}, 10px)`,
            animation: 'slideUp 0.3s ease-out',
            boxShadow: '0 -10px 40px rgba(0,0,0,.5)',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { icon: '🖼️', label: 'Image', onClick: () => document.getElementById('attachImage').click() },
              { icon: '🎥', label: 'Video', onClick: () => document.getElementById('attachVideo').click() },
              { icon: '📄', label: 'File', onClick: () => {} },
              { icon: '📍', label: 'Location', onClick: () => {} },
            ].map((item, i) => (
              <button key={i} onClick={item.onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px 0' }}>
                <div style={{ width: 48, height: 48, borderRadius: 16, background: '#1A1A26', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                  {item.icon}
                </div>
                <span style={{ fontSize: 11, color: '#8A8A9E' }}>{item.label}</span>
              </button>
            ))}
          </div>
          <input id="attachImage" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAttachImage} />
          <input id="attachVideo" type="file" accept="video/*" style={{ display: 'none' }} onChange={handleAttachVideo} />
        </div>
      )}
      {showAttach && (
        <div onClick={() => setShowAttach(false)} style={{ position: 'absolute', inset: 0, zIndex: 99, background: 'rgba(0,0,0,.4)' }} />
      )}

      {/* INPUT BAR */}
      <div
        style={{
          paddingTop: 8,
          paddingLeft: 8,
          paddingRight: 8,
          paddingBottom: `max(${bottomInset}, 10px)`,
          background: '#0B0B10',
          borderTop: '1px solid #1C1C28',
          display: 'flex',
          alignItems: 'flex-end',
          gap: 6,
        }}
      >
        {!recording ? (
          <>
            <button onClick={() => setShowAttach(prev => !prev)} style={{ ...iconBtn, padding: 8 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8A8A9E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </button>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#1A1A26', borderRadius: 22, padding: '6px 14px' }}>
              <input
                placeholder="Message..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#F0F0F5',
                  fontSize: 15,
                  fontFamily: 'inherit',
                  padding: '4px 0',
                }}
              />
              {!input.trim() ? (
                <button
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onTouchStart={startRecording}
                  onTouchEnd={stopRecording}
                  style={{ ...iconBtn, padding: 6 }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8A8A9E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                  </svg>
                </button>
              ) : (
                <button onClick={handleSend} style={{ ...iconBtn, width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #8A6EFF, #6C4FE8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff">
                    <path d="M22 2L11 13" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M22 2L15 22l-4-9-9-4 20-7z" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </div>
          </>
        ) : (
          /* RECORDING STATE */
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
            <button onClick={cancelRecording} style={{ ...iconBtn, padding: 6 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF4D4D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF4D4D', animation: 'pulse 1s infinite' }} />
              <span style={{ fontSize: 14, color: '#F0F0F5', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {String(Math.floor(recordTime / 60)).padStart(2, '0')}:{String(recordTime % 60).padStart(2, '0')}
              </span>
            </div>
            <button onClick={handleSendVoice} style={{ ...iconBtn, width: 32, height: 32, borderRadius: '50%', background: '#4ADE80', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const iconBtn = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  borderRadius: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
