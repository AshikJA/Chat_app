import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useSocket from '../hooks/useSocket'
import useMediaQuery from '../hooks/useMediaQuery'

function timeAgo(date) {
  if (!date) return ''
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}

export default function ChatList({ user, token, onLogout }) {
  const navigate = useNavigate()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const { socket, isConnected, onlineUsers } = useSocket(token)
  const [friends, setFriends] = useState([])
  const [lastMessages, setLastMessages] = useState({})
  const [unreadCounts, setUnreadCounts] = useState({})

  useEffect(() => {
    fetch('/api/friends/list', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setFriends(data.friends || []))
  }, [token])

  useEffect(() => {
    if (friends.length === 0) return
    friends.forEach((friend) => {
      fetch(`/api/messages?userId=${friend._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((data) => {
          const msgs = data.messages || []
          if (msgs.length > 0) {
            const last = msgs[msgs.length - 1]
            setLastMessages((prev) => ({ ...prev, [friend._id]: last }))
            const unread = msgs.filter(
              (m) => m.sender._id === friend._id && !m.read
            ).length
            setUnreadCounts((prev) => ({ ...prev, [friend._id]: unread }))
          }
        })
    })
  }, [friends, token])

  useEffect(() => {
    if (!socket) return
    const handleReceive = ({ message }) => {
      const senderId = message.sender._id || message.sender
      setLastMessages((prev) => ({ ...prev, [senderId]: message }))
      setUnreadCounts((prev) => ({
        ...prev,
        [senderId]: (prev[senderId] || 0) + 1,
      }))
    }
    socket.on('message:receive', handleReceive)
    return () => socket.off('message:receive', handleReceive)
  }, [socket])

  const handleSelect = (friend) => {
    setUnreadCounts((prev) => ({ ...prev, [friend._id]: 0 }))
    navigate('/chat', { state: { selectedFriend: friend } })
  }

  const getPreview = (msg) => {
    if (!msg) return ''
    if (msg.type === 'text') return msg.content
    if (msg.type === 'image') return 'Photo'
    if (msg.type === 'video') return 'Video'
    if (msg.type === 'voice') return 'Voice message'
    return ''
  }

  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <h2 style={styles.sidebarTitle}>Chats</h2>
          <div style={styles.sidebarRight}>
            <button onClick={() => navigate('/add-friend')} style={styles.iconBtn} title="Add Friend">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
            </button>
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <button onClick={() => navigate('/friend-requests')} style={styles.iconBtn} title="Friend Requests">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 16v-4a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v4" />
                  <circle cx="7" cy="8" r="3" />
                  <path d="M21 16v-2a3 3 0 0 0-3-3h-1" />
                  <circle cx="16" cy="6" r="2" />
                </svg>
              </button>
            </div>
            <button onClick={() => navigate('/profile')} style={styles.iconBtn} title="Profile">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </button>
            <span style={{ ...styles.statusDot, background: isConnected ? '#4caf50' : '#e53935' }} />
            <button onClick={onLogout} style={styles.logoutBtn}>Logout</button>
          </div>
        </div>

        <div style={styles.list}>
          {friends.length === 0 ? (
            <div style={styles.empty}>
              <p style={styles.emptyText}>No friends yet</p>
              <p style={styles.emptySub}>Add friends using their User ID</p>
            </div>
          ) : (
            friends.map((friend) => {
              const lastMsg = lastMessages[friend._id]
              const unread = unreadCounts[friend._id] || 0
              const isOnline = onlineUsers.has(friend._id)
              return (
                <div
                  key={friend._id}
                  onClick={() => handleSelect(friend)}
                  style={styles.friendItem}
                >
                  <div style={styles.avatarWrap}>
                    <div style={styles.avatar}>
                      {(friend.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <span style={{ ...styles.onlineDotSm, background: isOnline ? '#4caf50' : '#333' }} />
                  </div>
                  <div style={styles.friendInfo}>
                    <div style={styles.friendTop}>
                      <span style={styles.friendName}>{friend.name}</span>
                      {lastMsg && (
                        <span style={styles.timeText}>{timeAgo(lastMsg.createdAt)}</span>
                      )}
                    </div>
                    <div style={styles.friendBottom}>
                      <span style={styles.preview}>
                        {lastMsg ? getPreview(lastMsg) : 'Start chatting'}
                      </span>
                      {unread > 0 && (
                        <span style={styles.unreadBadge}>
                          {unread > 9 ? '9+' : unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: {
    height: '100vh',
    background: '#0f0f0f',
    color: '#fff',
    display: 'flex',
  },
  sidebar: {
    width: '100%',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid #222',
  },
  sidebarHeader: {
    padding: '16px',
    borderBottom: '1px solid #222',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  sidebarTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  sidebarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexShrink: 0,
  },
  iconBtn: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: '1px solid #333',
    background: 'transparent',
    color: '#888',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    display: 'inline-block',
    flexShrink: 0,
  },
  logoutBtn: {
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1px solid #333',
    background: 'transparent',
    color: '#888',
    fontSize: '11px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
  },
  empty: {
    padding: '60px 16px',
    textAlign: 'center',
  },
  emptyText: {
    color: '#555',
    fontSize: '16px',
    margin: '0 0 6px',
  },
  emptySub: {
    color: '#444',
    fontSize: '13px',
    margin: 0,
  },
  friendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    cursor: 'pointer',
    borderBottom: '1px solid #181818',
    transition: 'background 0.15s',
  },
  avatarWrap: {
    position: 'relative',
    flexShrink: 0,
  },
  avatar: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    background: '#8a6eff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    fontSize: '18px',
    flexShrink: 0,
  },
  onlineDotSm: {
    position: 'absolute',
    bottom: '1px',
    right: '1px',
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    border: '2px solid #0f0f0f',
  },
  friendInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: 0,
  },
  friendTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  friendName: {
    fontSize: '15px',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  timeText: {
    fontSize: '11px',
    color: '#555',
    flexShrink: 0,
    marginLeft: '8px',
  },
  friendBottom: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  preview: {
    fontSize: '13px',
    color: '#555',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
  unreadBadge: {
    background: '#8a6eff',
    color: '#fff',
    fontSize: '11px',
    fontWeight: 700,
    minWidth: '18px',
    height: '18px',
    lineHeight: '18px',
    borderRadius: '9px',
    textAlign: 'center',
    padding: '0 5px',
    marginLeft: '8px',
    flexShrink: 0,
    boxSizing: 'border-box',
  },
}
