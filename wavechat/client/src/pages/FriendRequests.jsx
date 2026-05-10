import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import axios from 'axios';
import Avatar from '../components/Avatar';

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

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function FriendRequests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [socketReqs, setSocketReqs] = useState([]);

  const token = localStorage.getItem('wc_token');
  const storedUser = localStorage.getItem('wc_user');
  const user = storedUser ? JSON.parse(storedUser) : null;

  useEffect(() => {
    if (!token) return;
    axios.get('/api/friends/requests', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setRequests(res.data.requests))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!token || !user) return;
    const socket = io('/', { auth: { token } });
    socket.on('connect', () => socket.emit('user:join', user.id));
    socket.on('friend:request', (req) => {
      setSocketReqs(prev => [...prev, req]);
    });
    return () => socket.disconnect();
  }, [user]);

  const handleAccept = async (fromId) => {
    try {
      await axios.post(`/api/friends/accept/${fromId}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRequests(prev => prev.filter(r => r.from?._id !== fromId && r.from !== fromId));
      setSocketReqs(prev => prev.filter(r => r.from?.id !== fromId));
    } catch {}
  };

  const handleReject = async (fromId) => {
    try {
      await axios.post(`/api/friends/reject/${fromId}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRequests(prev => prev.filter(r => r.from?._id !== fromId && r.from !== fromId));
      setSocketReqs(prev => prev.filter(r => r.from?.id !== fromId));
    } catch {}
  };

  const allRequests = [
    ...requests.map(r => ({ ...r, _key: r._id || r.from?._id })),
    ...socketReqs.map((r, i) => ({ ...r, _key: `socket-${i}`, from: r.from })),
  ];

  const topInset = 'env(safe-area-inset-top, 44px)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0B0B10' }}>
      {/* HEADER */}
      <div
        style={{
          paddingTop: topInset,
          paddingLeft: 20,
          paddingRight: 20,
          paddingBottom: 12,
          background: '#111118',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button onClick={() => navigate(-1)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, fontSize: 28, lineHeight: 1, color: '#8A6EFF' }}>
          ‹
        </button>
        <span style={{ fontSize: 18, fontWeight: 600, color: '#F0F0F5' }}>Friend Requests</span>
        {allRequests.length > 0 && (
          <span
            style={{
              background: '#8A6EFF',
              borderRadius: 10,
              padding: '1px 8px',
              fontSize: 12,
              fontWeight: 700,
              color: '#fff',
              marginLeft: 4,
            }}
          >
            {allRequests.length}
          </span>
        )}
      </div>

      {/* LIST */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', scrollbarWidth: 'none' }}>
        {allRequests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#5A5A6E' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#8A8A9E' }}>All clear!</div>
            <div style={{ fontSize: 13, color: '#3A3A4A', marginTop: 4 }}>No pending friend requests</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {allRequests.map((req, i) => {
              const sender = req.from;
              const senderId = sender?._id || sender?.id;
              return (
                <div
                  key={req._key || i}
                  style={{
                    background: '#13131A',
                    borderRadius: 16,
                    border: '1px solid #1E1E2A',
                    padding: 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    animation: 'fadeUp 0.3s ease-out',
                  }}
                >
                  <Avatar
                    initials={getInitials(sender?.name || sender?.username)}
                    color={getInitialColor(sender?.name || sender?.username)}
                    size={48}
                    online={sender?.status}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#F0F0F5' }}>{sender?.name || sender?.username || 'Unknown'}</div>
                    <div style={{ fontSize: 12, color: '#5A5A6E', marginTop: 1 }}>
                      {sender?.userId || ''} · {timeAgo(req.createdAt)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => handleAccept(senderId)}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: '#4ADE8020',
                        border: '1px solid #4ADE80',
                        cursor: 'pointer',
                        fontSize: 16,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => handleReject(senderId)}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: '#FF4D4D20',
                        border: '1px solid #FF4D4D',
                        cursor: 'pointer',
                        fontSize: 16,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      ✗
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
