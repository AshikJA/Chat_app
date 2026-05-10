import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import Avatar from '../components/Avatar';

const tabs = [
  { key: 'chats', label: 'Chats', icon: '\uD83D\uDCAC' },
  { key: 'calls', label: 'Calls', icon: '\uD83D\uDCDE' },
  { key: 'groups', label: 'Groups', icon: '\uD83D\uDC65' },
  { key: 'profile', label: 'Profile', icon: '\uD83D\uDC64' },
];

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

function formatTime(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  const day = 86400000;
  if (diff < day && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diff < 7 * day) {
    return d.toLocaleDateString([], { weekday: 'short' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const storyFriends = [
  { name: 'Alex', initials: 'AL', color: '#FF6B8A' },
  { name: 'Jordan', initials: 'JR', color: '#60A5FA' },
  { name: 'Sam', initials: 'SM', color: '#34D399' },
  { name: 'Taylor', initials: 'TY', color: '#F472B6' },
  { name: 'Riley', initials: 'RL', color: '#A78BFA' },
];

const demoChats = [
  { name: 'Alex', initials: 'AL', color: '#FF6B8A', msg: 'Hey, how are you?', time: '2026-05-10T10:30:00', unread: 2, online: true },
  { name: 'Jordan', initials: 'JR', color: '#60A5FA', msg: 'See you tomorrow!', time: '2026-05-09T18:00:00', unread: 0, online: false },
  { name: 'Design Team', initials: 'DT', color: '#FBBF24', msg: 'Sarah: New mockups are ready', time: '2026-05-08T14:15:00', unread: 5, online: false },
  { name: 'Mom', initials: 'MM', color: '#4ADE80', msg: 'Don\'t forget dinner tonight', time: '2026-05-10T08:45:00', unread: 0, online: true },
  { name: 'Sam', initials: 'SM', color: '#34D399', msg: 'LOL that was hilarious', time: '2026-05-07T22:30:00', unread: 1, online: false },
  { name: 'Taylor', initials: 'TY', color: '#F472B6', msg: 'Can you send me that file?', time: '2026-05-10T06:20:00', unread: 0, online: true },
];

export default function ChatList() {
  const [activeTab, setActiveTab] = useState('chats');
  const [search, setSearch] = useState('');
  const [friends, setFriends] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const socketRef = useRef(null);
  const tokenRef = useRef('');

  useEffect(() => {
    const token = localStorage.getItem('wc_token');
    if (!token) return;
    tokenRef.current = token;

    socketRef.current = io('/', {
      auth: { token },
    });

    socketRef.current.on('connect', () => {
      const stored = localStorage.getItem('wc_user');
      if (stored) {
        const user = JSON.parse(stored);
        socketRef.current.emit('user:join', user.id);
      }
    });

    socketRef.current.on('user:online', (userId) => {
      setOnlineUsers((prev) => new Set(prev).add(userId));
    });

    socketRef.current.on('user:offline', (userId) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('wc_token');
    if (!token) return;

    axios
      .get('/api/friends/list', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setFriends(res.data.friends))
      .catch(() => {});
  }, []);

  const filtered = search.trim()
    ? friends.filter((f) => f.name?.toLowerCase().includes(search.toLowerCase()))
    : friends;

  const chatRows = filtered.length > 0 ? filtered : demoChats;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#0B0B10',
      }}
    >
      {/* HEADER */}
      <div
        style={{
          paddingTop: 'env(safe-area-inset-top, 44px)',
          paddingLeft: 20,
          paddingRight: 20,
          paddingBottom: 12,
          background: '#111118',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>
          <span style={{ color: '#8A6EFF' }}>Wave</span>
          <span style={{ color: '#fff' }}>Chat</span>
        </h1>
        <div style={{ display: 'flex', gap: 12 }}>
          <button style={iconBtnStyle}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8A8A9E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button style={iconBtnStyle}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8A8A9E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* SEARCH */}
      <div style={{ padding: '8px 20px 12px', background: '#111118' }}>
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
            placeholder="Search chats..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#F0F0F5',
              fontSize: 15,
              fontFamily: 'inherit',
            }}
          />
        </div>
      </div>

      {/* STORIES */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          padding: '12px 20px 16px',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          scrollbarWidth: 'none',
        }}
      >
        {/* MY STORY */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <div style={{ position: 'relative', width: 60, height: 60, minWidth: 60 }}>
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: '#1A1A26',
                border: '2px solid #252535',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8A6EFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <div
              style={{
                position: 'absolute',
                bottom: -2,
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#8A6EFF',
                borderRadius: 6,
                padding: '1px 6px',
                fontSize: 9,
                fontWeight: 600,
                color: '#fff',
                whiteSpace: 'nowrap',
              }}
            >
              Add
            </div>
          </div>
          <span style={{ fontSize: 11, color: '#8A8A9E' }}>Your Story</span>
        </div>

        {/* FRIEND STORIES */}
        {storyFriends.map((f, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <div
              style={{
                width: 60,
                height: 60,
                minWidth: 60,
                borderRadius: '50%',
                padding: 3,
                background: `conic-gradient(#8A6EFF, #FF6B8A, #FBBF24, #8A6EFF)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  background: '#0B0B10',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  fontWeight: 600,
                  color: f.color,
                }}
              >
                {f.initials}
              </div>
            </div>
            <span style={{ fontSize: 11, color: '#8A8A9E', maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {f.name}
            </span>
          </div>
        ))}
      </div>

      {/* CHAT LIST */}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' }}>
        {chatRows.map((chat, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 20px',
              borderBottom: '1px solid #0F0F18',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseDown={(e) => {
              const el = e.currentTarget;
              el.style.background = 'rgba(255,255,255,.05)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
            onTouchStart={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,.05)';
            }}
            onTouchEnd={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <Avatar
              initials={chat.initials || getInitials(chat.name || chat.username)}
              color={chat.color || getInitialColor(chat.name || chat.username)}
              size={48}
              online={onlineUsers.has(chat._id) || chat.online ? 'online' : undefined}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#F0F0F5' }}>
                  {chat.name || chat.username}
                </span>
                <span style={{ fontSize: 11, color: '#5A5A6E' }}>{formatTime(chat.time || chat.createdAt)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                <span
                  style={{
                    fontSize: 13,
                    color: '#5A5A6E',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '70%',
                  }}
                >
                  {chat.msg || 'No messages yet'}
                </span>
                {chat.unread > 0 && (
                  <span
                    style={{
                      background: '#8A6EFF',
                      borderRadius: 10,
                      padding: '1px 7px',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#fff',
                      minWidth: 20,
                      textAlign: 'center',
                    }}
                  >
                    {chat.unread}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* BOTTOM NAV */}
      <div
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          background: '#111118',
          borderTop: '1px solid #1C1C28',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          paddingTop: 8,
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 16px',
                position: 'relative',
              }}
            >
              <span style={{ fontSize: 20, color: isActive ? '#8A6EFF' : '#3A3A4A' }}>{tab.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: isActive ? '#8A6EFF' : '#3A3A4A' }}>{tab.label}</span>
              {isActive && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: -8,
                    width: 20,
                    height: 3,
                    borderRadius: 2,
                    background: '#8A6EFF',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const iconBtnStyle = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: 6,
  borderRadius: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
