import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

function Avatar({ name }) {
  const colors = ['from-violet-600 to-indigo-600', 'from-pink-600 to-rose-600', 'from-emerald-600 to-teal-600', 'from-amber-600 to-orange-600', 'from-cyan-600 to-blue-600']
  const idx = (name?.charCodeAt(0) || 0) % colors.length
  return (
    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${colors[idx]} flex items-center justify-center font-bold text-white flex-shrink-0 text-lg`}>
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  )
}

export default function AddFriend({ user, token }) {
  const navigate = useNavigate()
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
    setLoading(true); setError(''); setResults(null)
    try {
      const r = await fetch(`/api/friends/search?query=${encodeURIComponent(trimmed)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await r.json()
      if (!r.ok) { setError(data.message || 'Search failed'); return }
      if (!data.users || data.users.length === 0) { setError('No user found'); return }
      setResults(data.users)
    } catch { setError('Network error') }
    finally { setLoading(false) }
  }

  const handleSendRequest = async (targetUserId) => {
    try {
      const r = await fetch(`/api/friends/request/${encodeURIComponent(targetUserId)}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      })
      const data = await r.json()
      if (!r.ok) {
        setSentStates((prev) => ({ ...prev, [targetUserId]: data.message === 'Already friends' ? 'friends' : 'error' }))
        return
      }
      setSentStates((prev) => ({ ...prev, [targetUserId]: 'sent' }))
    } catch { setSentStates((prev) => ({ ...prev, [targetUserId]: 'error' })) }
  }

  const isFriend = (userId) =>
    user.friends?.some((f) =>
      typeof f === 'object' && f !== null ? f.userId === userId || f._id === userId : f === userId
    )

  return (
    <div className="min-h-screen" style={{ background: '#0a0a12' }}>
      <div className="sticky top-0 z-10 px-4 py-4 flex items-center gap-3" style={{ background: 'rgba(10,10,18,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={() => navigate('/chat')} className="icon-btn w-9 h-9">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <h1 className="text-white font-bold text-lg">Add Friend</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        <p className="text-slate-500 text-sm mb-4">Search by User ID like <span className="text-violet-400 font-mono">WC#4829</span> or @username</p>
        <form onSubmit={handleSearch} className="flex gap-2 mb-6">
          <div className="relative flex-1">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input ref={inputRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="WC#XXXX or @username" className="input-field pl-10" />
          </div>
          <button type="submit" disabled={loading || !query.trim()} className="px-5 py-3 rounded-xl text-sm font-semibold text-white flex-shrink-0 border-0"
            style={{ background: loading || !query.trim() ? 'rgba(124,58,237,0.4)' : 'linear-gradient(135deg,#7c3aed,#6366f1)', cursor: loading || !query.trim() ? 'not-allowed' : 'pointer' }}>
            {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full inline-block" style={{ animation: 'spin 0.7s linear infinite' }} /> : 'Search'}
          </button>
        </form>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm text-red-300 flex items-center gap-2 animate-fade-in" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {error}
          </div>
        )}

        {results && results.length > 0 && (
          <div className="space-y-2 animate-fade-in">
            {results.map((u) => {
              const alreadyFriend = isFriend(u.userId) || isFriend(u._id)
              const state = sentStates[u.userId]
              return (
                <div key={u._id} className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <Avatar name={u.name} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{u.name}</p>
                    <p className="text-xs font-mono text-violet-400">{u.userId}</p>
                    {u.username && <p className="text-xs text-slate-600">@{u.username}</p>}
                  </div>
                  <div className="flex-shrink-0">
                    {state === 'sent' ? (
                      <span className="px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-400" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>Sent ✓</span>
                    ) : state === 'friends' || alreadyFriend ? (
                      <span className="px-3 py-1.5 rounded-xl text-xs font-semibold text-violet-400" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>Friends</span>
                    ) : state === 'error' ? (
                      <span className="px-3 py-1.5 rounded-xl text-xs font-semibold text-red-400" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>Failed</span>
                    ) : (
                      <button onClick={() => handleSendRequest(u.userId)} className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white border-0" style={{ background: 'linear-gradient(135deg,#7c3aed,#6366f1)', cursor: 'pointer' }}>Add</button>
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
