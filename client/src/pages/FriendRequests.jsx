import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useMediaQuery from '../hooks/useMediaQuery'
import useSocket from '../hooks/useSocket'

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(date).toLocaleDateString()
}

export default function FriendRequests({ user, token }) {
  const navigate = useNavigate()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const { socket } = useSocket(token)
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState({})

  const fetchRequests = async () => {
    try {
      const r = await fetch('/api/friends/requests', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await r.json()
      if (r.ok) setRequests(data.requests || [])
    } catch {} finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [token])

  useEffect(() => {
    if (!socket) return
    const refresh = () => fetchRequests()
    socket.on('friend:request', refresh)
    socket.on('friend:accepted', refresh)
    socket.on('friend:rejected', refresh)
    return () => {
      socket.off('friend:request', refresh)
      socket.off('friend:accepted', refresh)
      socket.off('friend:rejected', refresh)
    }
  }, [socket])

  const handleAccept = async (userId) => {
    setActionLoading((prev) => ({ ...prev, [userId]: 'accept' }))
    try {
      await fetch(`/api/friends/accept/${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      setRequests((prev) => prev.filter((r) => r.from.userId !== userId))
    } catch {} finally {
      setActionLoading((prev) => ({ ...prev, [userId]: undefined }))
    }
  }

  const handleReject = async (userId) => {
    setActionLoading((prev) => ({ ...prev, [userId]: 'reject' }))
    try {
      await fetch(`/api/friends/reject/${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      setRequests((prev) => prev.filter((r) => r.from.userId !== userId))
    } catch {} finally {
      setActionLoading((prev) => ({ ...prev, [userId]: undefined }))
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.inner}>
        <div style={styles.header}>
          <button onClick={() => navigate('/chat')} style={styles.backBtn}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <h2 style={styles.title}>Friend Requests</h2>
          {requests.length > 0 && <span style={styles.count}>{requests.length}</span>}
        </div>

        {loading ? (
          <p style={styles.loading}>Loading...</p>
        ) : requests.length === 0 ? (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
            </div>
            <p style={styles.emptyText}>No pending friend requests</p>
          </div>
        ) : (
          <div style={styles.list}>
            {requests.map((req) => {
              const userData = req.from
              const loading = actionLoading[userData.userId]
              return (
                <div key={userData.userId} style={styles.card}>
                  <div style={styles.avatar}>{userData.name?.charAt(0).toUpperCase() || '?'}</div>
                  <div style={styles.info}>
                    <span style={styles.name}>{userData.name}</span>
                    <span style={styles.userId}>{userData.userId}</span>
                    {userData.username && <span style={styles.username}>@{userData.username}</span>}
                    <span style={styles.time}>{timeAgo(req.createdAt)}</span>
                  </div>
                  <div style={styles.actions}>
                    <button
                      onClick={() => handleAccept(userData.userId)}
                      disabled={!!loading}
                      style={{ ...styles.acceptBtn, opacity: loading === 'accept' ? 0.6 : 1 }}
                    >
                      {loading === 'accept' ? '...' : 'Accept'}
                    </button>
                    <button
                      onClick={() => handleReject(userData.userId)}
                      disabled={!!loading}
                      style={{ ...styles.rejectBtn, opacity: loading === 'reject' ? 0.6 : 1 }}
                    >
                      {loading === 'reject' ? '...' : 'Reject'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#0f0f0f',
    color: '#fff',
  },
  inner: {
    maxWidth: '520px',
    margin: '0 auto',
    padding: '24px 16px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '24px',
  },
  backBtn: {
    width: '36px',
    height: '36px',
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
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 600,
  },
  count: {
    background: '#8a6eff',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: '10px',
    lineHeight: '18px',
  },
  loading: {
    textAlign: 'center',
    color: '#666',
    fontSize: '14px',
    marginTop: '40px',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    marginTop: '60px',
  },
  emptyIcon: {
    color: '#333',
  },
  emptyText: {
    color: '#555',
    fontSize: '15px',
    margin: 0,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    background: '#1a1a1a',
    borderRadius: '12px',
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
  info: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    gap: '1px',
  },
  name: {
    fontSize: '15px',
    fontWeight: 500,
  },
  userId: {
    fontSize: '12px',
    color: '#8a6eff',
    fontWeight: 600,
  },
  username: {
    fontSize: '12px',
    color: '#666',
  },
  time: {
    fontSize: '11px',
    color: '#444',
    marginTop: '2px',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    flexShrink: 0,
  },
  acceptBtn: {
    padding: '6px 14px',
    borderRadius: '6px',
    border: 'none',
    background: '#4caf50',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  rejectBtn: {
    padding: '6px 14px',
    borderRadius: '6px',
    border: 'none',
    background: '#e53935',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
}
