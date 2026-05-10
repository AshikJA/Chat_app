import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

export default function AddFriend() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('idle');
  const [requestState, setRequestState] = useState(null);

  const token = localStorage.getItem('wc_token');

  const handleSearch = async () => {
    if (!query.trim()) return;
    setStatus('loading');
    setRequestState(null);
    try {
      const res = await axios.get('/api/friends/search', {
        params: { query: query.trim() },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.users.length === 0) {
        setStatus('notfound');
        setResult(null);
      } else {
        setStatus('found');
        setResult(res.data.users[0]);
      }
    } catch {
      setStatus('notfound');
      setResult(null);
    }
  };

  const handleAdd = async () => {
    if (!result) return;
    try {
      await axios.post(`/api/friends/request/${result._id}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRequestState('sent');
    } catch (err) {
      if (err.response?.data?.error === 'Already friends') {
        setRequestState('friends');
      } else if (err.response?.data?.error === 'Friend request already sent') {
        setRequestState('sent');
      }
    }
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
        <span style={{ fontSize: 18, fontWeight: 600, color: '#F0F0F5' }}>Add Friend</span>
      </div>

      {/* SEARCH */}
      <div style={{ padding: '16px 20px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: '#1A1A26',
            borderRadius: 14,
            border: '1px solid #252535',
            padding: '10px 14px',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            placeholder="Enter ID like WC#4829 or @username"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#F0F0F5',
              fontSize: 14,
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={handleSearch}
            style={{
              background: '#8A6EFF',
              border: 'none',
              borderRadius: 10,
              padding: '6px 14px',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
            }}
          >
            Search
          </button>
        </div>
      </div>

      {/* RESULTS */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px', scrollbarWidth: 'none' }}>
        {status === 'loading' && (
          <div style={{ textAlign: 'center', padding: 40, color: '#5A5A6E', fontSize: 14 }}>Searching...</div>
        )}
        {status === 'notfound' && (
          <div style={{ textAlign: 'center', padding: 40, color: '#5A5A6E' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 14 }}>No user found</div>
            <div style={{ fontSize: 12, color: '#3A3A4A', marginTop: 4 }}>Try searching by ID (WC#XXXX) or @username</div>
          </div>
        )}
        {status === 'found' && result && (
          <div
            style={{
              background: '#13131A',
              borderRadius: 16,
              border: '1px solid #1E1E2A',
              padding: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Avatar
              initials={getInitials(result.name || result.username)}
              color={getInitialColor(result.name || result.username)}
              size={52}
              online={result.status}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#F0F0F5' }}>{result.name || result.username}</div>
              <div style={{ fontSize: 12, color: '#5A5A6E', marginTop: 2 }}>
                @{result.username || 'username'} · {result.userId || 'WC#0000'}
              </div>
            </div>
            {requestState === 'sent' ? (
              <div style={{ fontSize: 12, fontWeight: 600, color: '#4ADE80', whiteSpace: 'nowrap' }}>✅ Sent</div>
            ) : requestState === 'friends' ? (
              <div style={{ fontSize: 12, fontWeight: 600, color: '#60A5FA', whiteSpace: 'nowrap' }}>Friends</div>
            ) : (
              <button
                onClick={handleAdd}
                style={{
                  background: '#8A6EFF',
                  border: 'none',
                  borderRadius: 10,
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#fff',
                  whiteSpace: 'nowrap',
                }}
              >
                Add Friend
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
