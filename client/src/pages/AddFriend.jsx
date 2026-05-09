import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import useMediaQuery from '../hooks/useMediaQuery'

export default function AddFriend({ user, token }) {
  const navigate = useNavigate()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sentStates, setSentStates] = useState({})
  const inputRef = useRef(null)

  const handleSearch = async (e) => {
    e?.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return

    setLoading(true)
    setError('')
    setResults(null)
    try {
      const r = await fetch(`/api/friends/search?query=${encodeURIComponent(trimmed)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await r.json()
      if (!r.ok) {
        setError(data.message || 'Search failed')
        return
      }
      if (!data.users || data.users.length === 0) {
        setError('No user found')
        return
      }
      setResults(data.users)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  const handleSendRequest = async (targetUserId) => {
    try {
      const r = await fetch(`/api/friends/request/${encodeURIComponent(targetUserId)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await r.json()
      if (!r.ok) {
        if (data.message === 'Already friends') {
          setSentStates((prev) => ({ ...prev, [targetUserId]: 'friends' }))
        } else {
          setSentStates((prev) => ({ ...prev, [targetUserId]: 'error' }))
        }
        return
      }
      setSentStates((prev) => ({ ...prev, [targetUserId]: 'sent' }))
    } catch {
      setSentStates((prev) => ({ ...prev, [targetUserId]: 'error' }))
    }
  }

  const isFriend = (userId) => {
    return user.friends?.some((f) => {
      if (typeof f === 'object' && f !== null) return f.userId === userId || f._id === userId
      return f === userId
    })
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
          <h2 style={styles.title}>Add Friend</h2>
        </div>

        <form onSubmit={handleSearch} style={styles.searchForm}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter User ID like WC#4829 or @username"
            style={styles.input}
          />
          <button type="submit" disabled={loading || !query.trim()} style={{ ...styles.searchBtn, opacity: loading || !query.trim() ? 0.6 : 1 }}>
            {loading ? '...' : 'Search'}
          </button>
        </form>

        {error && <p style={styles.error}>{error}</p>}

        {results && results.length > 0 && (
          <div style={styles.results}>
            {results.map((u) => {
              const alreadyFriend = isFriend(u.userId) || isFriend(u._id)
              const state = sentStates[u.userId]

              return (
                <div key={u._id} style={styles.card}>
                  <div style={styles.avatar}>
                    {u.name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div style={styles.info}>
                    <span style={styles.name}>{u.name}</span>
                    <span style={styles.userId}>{u.userId}</span>
                    {u.username && <span style={styles.username}>@{u.username}</span>}
                  </div>
                  <div style={styles.action}>
                    {state === 'sent' ? (
                      <span style={styles.sentBadge}>Sent &#10003;</span>
                    ) : state === 'friends' || alreadyFriend ? (
                      <span style={styles.friendsBadge}>Friends</span>
                    ) : state === 'error' ? (
                      <span style={styles.errorText}>Failed</span>
                    ) : (
                      <button onClick={() => handleSendRequest(u.userId)} style={styles.addBtn}>
                        Add Friend
                      </button>
                    )}
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
  searchForm: {
    display: 'flex',
    gap: '8px',
    marginBottom: '20px',
  },
  input: {
    flex: 1,
    padding: '12px 14px',
    borderRadius: '8px',
    border: '1px solid #333',
    background: '#1a1a1a',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  searchBtn: {
    padding: '12px 20px',
    borderRadius: '8px',
    border: 'none',
    background: '#8a6eff',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  error: {
    color: '#e53935',
    fontSize: '13px',
    textAlign: 'center',
    margin: '0 0 16px',
    padding: '10px',
    background: 'rgba(229,57,53,0.1)',
    borderRadius: '8px',
  },
  results: {
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
    gap: '2px',
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
  action: {
    flexShrink: 0,
  },
  addBtn: {
    padding: '8px 16px',
    borderRadius: '8px',
    border: 'none',
    background: '#8a6eff',
    color: '#fff',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  sentBadge: {
    padding: '8px 12px',
    borderRadius: '8px',
    background: 'rgba(76,175,80,0.15)',
    color: '#4caf50',
    fontSize: '13px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  friendsBadge: {
    padding: '8px 12px',
    borderRadius: '8px',
    background: 'rgba(138,110,255,0.15)',
    color: '#8a6eff',
    fontSize: '13px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  errorText: {
    padding: '8px 12px',
    borderRadius: '8px',
    background: 'rgba(229,57,53,0.15)',
    color: '#e53935',
    fontSize: '13px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
}
