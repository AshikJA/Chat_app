import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../utils/api'
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

function Avatar({ name }) {
  const colors = ['from-violet-600 to-indigo-600', 'from-pink-600 to-rose-600', 'from-emerald-600 to-teal-600', 'from-amber-600 to-orange-600', 'from-cyan-600 to-blue-600']
  const idx = (name?.charCodeAt(0) || 0) % colors.length
  return (
    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${colors[idx]} flex items-center justify-center font-bold text-white flex-shrink-0 text-lg`}>
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  )
}

export default function FriendRequests({ user, token }) {
  const navigate = useNavigate()
  const { socket } = useSocket(token)
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState({})

  const fetchRequests = async () => {
    try {
      const r = await apiFetch('/api/friends/requests', { headers: { Authorization: `Bearer ${token}` } })
      const data = await r.json()
      if (r.ok) setRequests(data.requests || [])
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { fetchRequests() }, [token])

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
      await apiFetch(`/api/friends/accept/${encodeURIComponent(userId)}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      })
      setRequests((prev) => prev.filter((r) => r.from.userId !== userId))
    } catch {} finally { setActionLoading((prev) => ({ ...prev, [userId]: undefined })) }
  }

  const handleReject = async (userId) => {
    setActionLoading((prev) => ({ ...prev, [userId]: 'reject' }))
    try {
      await apiFetch(`/api/friends/reject/${encodeURIComponent(userId)}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      })
      setRequests((prev) => prev.filter((r) => r.from.userId !== userId))
    } catch {} finally { setActionLoading((prev) => ({ ...prev, [userId]: undefined })) }
  }

  return (
    <div className="min-h-[100dvh]" style={{ background: '#0a0a12' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-4 flex items-center gap-3" style={{ background: 'rgba(10,10,18,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={() => navigate('/chat')} className="icon-btn w-9 h-9">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <h1 className="text-white font-bold text-lg flex-1">Friend Requests</h1>
        {requests.length > 0 && (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg,#7c3aed,#6366f1)' }}>
            {requests.length}
          </span>
        )}
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-violet-500/30 border-t-violet-500" style={{ animation: 'spin 0.9s linear infinite' }} />
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.12)' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <p className="text-slate-500 font-medium text-sm">No pending friend requests</p>
            <p className="text-slate-600 text-xs">When someone adds you, it'll show here</p>
          </div>
        ) : (
          <div className="space-y-3 animate-fade-in">
            {requests.map((req) => {
              const ud = req.from
              const act = actionLoading[ud.userId]
              return (
                <div key={ud.userId} className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <Avatar name={ud.name} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{ud.name}</p>
                    <p className="text-xs font-mono text-violet-400">{ud.userId}</p>
                    {ud.username && <p className="text-xs text-slate-600">@{ud.username}</p>}
                    <p className="text-xs text-slate-700 mt-0.5">{timeAgo(req.createdAt)}</p>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleAccept(ud.userId)}
                      disabled={!!act}
                      className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white border-0 transition-all"
                      style={{ background: act === 'accept' ? 'rgba(16,185,129,0.5)' : 'linear-gradient(135deg,#10b981,#059669)', cursor: act ? 'not-allowed' : 'pointer', opacity: act && act !== 'accept' ? 0.5 : 1 }}
                    >
                      {act === 'accept' ? '…' : 'Accept'}
                    </button>
                    <button
                      onClick={() => handleReject(ud.userId)}
                      disabled={!!act}
                      className="px-4 py-1.5 rounded-xl text-xs font-semibold border-0 transition-all"
                      style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', cursor: act ? 'not-allowed' : 'pointer', opacity: act && act !== 'reject' ? 0.5 : 1 }}
                    >
                      {act === 'reject' ? '…' : 'Decline'}
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
