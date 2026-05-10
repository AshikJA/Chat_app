import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Avatar from '../components/Avatar';

function getInitialColor(name) {
  const colors = ['#8A6EFF', '#FF6B8A', '#4ADE80', '#FBBF24', '#60A5FA', '#F472B6', '#34D399', '#A78BFA'];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef(null);

  const token = localStorage.getItem('wc_token');

  useEffect(() => {
    if (!token) return;
    axios.get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setUser(res.data.user))
      .catch(() => navigate('/'));
  }, []);

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await axios.post('/api/upload', form, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      setUser(prev => ({ ...prev, avatar: res.data.url }));
    } catch {}
  };

  const handleCopyId = () => {
    if (user?.userId) {
      navigator.clipboard.writeText(user.userId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('wc_token');
    localStorage.removeItem('wc_user');
    navigate('/');
  };

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
        <span style={{ fontSize: 18, fontWeight: 600, color: '#F0F0F5' }}>Profile</span>
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 20px', gap: 20, scrollbarWidth: 'none' }}>
        {/* AVATAR */}
        <div
          onClick={() => fileRef.current?.click()}
          style={{ position: 'relative', cursor: 'pointer' }}
        >
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt=""
              style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', border: '2px solid #252535' }}
            />
          ) : (
            <Avatar
              initials={user?.name ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'}
              color={getInitialColor(user?.name)}
              size={88}
            />
          )}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: '#8A6EFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              border: '2px solid #0B0B10',
            }}
          >
            📷
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
        </div>

        {/* NAME & USERNAME */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#F0F0F5' }}>{user?.name || 'User'}</div>
          <div style={{ fontSize: 14, color: '#5A5A6E', marginTop: 2 }}>@{user?.username || 'username'}</div>
        </div>

        {/* USER ID CARD */}
        <div
          style={{
            width: '100%',
            maxWidth: 320,
            background: '#13131A',
            borderRadius: 16,
            border: '1px solid #1E1E2A',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: '#5A5A6E', textTransform: 'uppercase', letterSpacing: 1 }}>Your ID</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#8A6EFF', marginTop: 2, letterSpacing: 1 }}>{user?.userId || 'WC#0000'}</div>
          </div>
          <button
            onClick={handleCopyId}
            style={{
              background: copied ? '#4ADE8020' : '#8A6EFF20',
              border: copied ? '1px solid #4ADE80' : '1px solid #8A6EFF',
              borderRadius: 10,
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>{copied ? '✅' : '📋'}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: copied ? '#4ADE80' : '#8A6EFF' }}>
              {copied ? 'Copied!' : 'Copy'}
            </span>
          </button>
        </div>

        <span style={{ fontSize: 12, color: '#5A5A6E', marginTop: -12 }}>Share your ID to add friends</span>

        {/* EDIT PROFILE */}
        <button
          style={{
            width: '100%',
            maxWidth: 320,
            padding: '14px 0',
            borderRadius: 14,
            background: '#8A6EFF',
            border: 'none',
            cursor: 'pointer',
            fontSize: 15,
            fontWeight: 600,
            color: '#fff',
            marginTop: 8,
          }}
        >
          Edit Profile
        </button>

        {/* LOGOUT */}
        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            maxWidth: 320,
            padding: '14px 0',
            borderRadius: 14,
            background: 'transparent',
            border: '1px solid #FF4D4D',
            cursor: 'pointer',
            fontSize: 15,
            fontWeight: 600,
            color: '#FF4D4D',
            marginTop: 8,
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}
