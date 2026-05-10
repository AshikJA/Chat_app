import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useSocket from '../hooks/useSocket'
import { apiFetch } from '../utils/api'

function timeAgo(date) {
  if (!date) return ''
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

function Avatar({ name, size = 'md' }) {
  const colors = ['from-violet-600 to-indigo-600', 'from-pink-600 to-rose-600', 'from-emerald-600 to-teal-600', 'from-amber-600 to-orange-600', 'from-cyan-600 to-blue-600']
  const idx = (name?.charCodeAt(0) || 0) % colors.length
  const sizeClass = size === 'lg' ? 'w-12 h-12 text-lg' : 'w-10 h-10 text-sm'
  return (
    <div className={`${sizeClass} rounded-2xl bg-gradient-to-br ${colors[idx]} flex items-center justify-center font-bold text-white flex-shrink-0`}>
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  )
}

export default function ChatList({ user, token, onLogout }) {
  const navigate = useNavigate()
  const { socket, isConnected, onlineUsers } = useSocket(token)
  const [friends, setFriends] = useState([])
  const [lastMessages, setLastMessages] = useState({})
  const [unreadCounts, setUnreadCounts] = useState({})
  const [pendingRequests, setPendingRequests] = useState(0)

  useEffect(() => {
    apiFetch('/api/friends/list', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setFriends(data.friends || []))
  }, [token])

  useEffect(() => {
    apiFetch('/api/friends/requests', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setPendingRequests(data.requests?.length || 0))
      .catch(() => {})
  }, [token])

  useEffect(() => {
    if (friends.length === 0) return
    
    // Initialize counts to 0 so we don't have undefined/lingering states
    const initialCounts = {}
    friends.forEach(f => initialCounts[f._id] = 0)
    setUnreadCounts(prev => ({ ...initialCounts, ...prev }))

    friends.forEach((friend) => {
      apiFetch(`/api/messages?userId=${friend._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((data) => {
          const msgs = data.messages || []
          if (msgs.length > 0) {
            setLastMessages((prev) => ({ ...prev, [friend._id]: msgs[msgs.length - 1] }))
            const unread = msgs.filter((m) => {
              const mSenderId = m.sender._id || m.sender
              return mSenderId === friend._id && m.status !== 'seen'
            }).length
            setUnreadCounts((prev) => ({ ...prev, [friend._id]: unread }))
          }
        })
        .catch(() => {})
    })
  }, [friends, token])

  useEffect(() => {
    if (!socket) return
    const handleReceive = ({ message }) => {
      const senderId = message.sender._id || message.sender
      const receiverId = message.receiver._id || message.receiver
      
      // The "chat partner" ID is either the sender (if we received it) 
      // or the receiver (if we sent it from another tab)
      const partnerId = senderId === user._id ? receiverId : senderId
      
      setLastMessages((prev) => ({ ...prev, [partnerId]: message }))
      
      // Only increment unread count if we are the receiver
      if (receiverId === user._id) {
        setUnreadCounts((prev) => ({ ...prev, [senderId]: (prev[senderId] || 0) + 1 }))
      }
    }
    const handleSyncRead = ({ senderId }) => {
      setUnreadCounts((prev) => ({ ...prev, [senderId]: 0 }))
    }
    socket.on('message:receive', handleReceive)
    socket.on('message:sync_read', handleSyncRead)
    return () => {
      socket.off('message:receive', handleReceive)
      socket.off('message:sync_read', handleSyncRead)
    }
  }, [socket, user._id])

  const handleSelect = (friend) => {
    setUnreadCounts((prev) => ({ ...prev, [friend._id]: 0 }))
    navigate('/chat', { state: { selectedFriend: friend } })
  }

  const getPreview = (msg) => {
    if (!msg) return ''
    if (msg.type === 'text') return msg.content
    if (msg.type === 'image') return '📷 Photo'
    if (msg.type === 'video') return '🎥 Video'
    if (msg.type === 'voice') return '🎵 Voice message'
    return ''
  }

  return (
    <div className="h-[100dvh] flex overflow-hidden select-none" style={{ background: '#0a0a12' }}>
      {/* Sidebar */}
      <div className="w-full max-w-sm flex flex-col flex-shrink-0" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h1 className="text-white font-bold text-lg tracking-tight">Messages</h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Add friend */}
            <button onClick={() => navigate('/add-friend')} className="icon-btn w-8 h-8" title="Add Friend">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
              </svg>
            </button>

            {/* Friend requests */}
            <div className="relative">
              <button onClick={() => navigate('/friend-requests')} className="icon-btn w-8 h-8" title="Friend Requests">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </button>
              {pendingRequests > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-[10px] font-bold flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}>
                  {pendingRequests > 9 ? '9+' : pendingRequests}
                </span>
              )}
            </div>

            {/* Profile */}
            <button onClick={() => navigate('/profile')} className="icon-btn w-8 h-8" title="Profile">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
            </button>

            {/* Connection dot */}
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isConnected ? 'bg-emerald-400' : 'bg-red-500'}`} style={{ animation: isConnected ? 'pulse-dot 2s ease-in-out infinite' : 'none' }} />
          </div>
        </div>

        {/* Search bar */}
        <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search conversations…"
              className="w-full pl-9 pr-4 py-2 rounded-xl text-sm text-white placeholder-slate-600 outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
              readOnly
            />
          </div>
        </div>

        {/* Friend list */}
        <div className="flex-1 overflow-y-auto">
          {friends.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <p className="text-slate-500 text-sm font-medium">No friends yet</p>
              <p className="text-slate-600 text-xs">Add friends using their User ID</p>
              <button onClick={() => navigate('/add-friend')} className="mt-2 px-4 py-2 rounded-xl text-xs font-semibold text-violet-400 transition-all" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
                Add Friend
              </button>
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
                  className="flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all duration-150"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div className="relative flex-shrink-0">
                    <Avatar name={friend.name} size="lg" />
                    {isOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 rounded-full border-2" style={{ borderColor: '#0a0a12' }} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`text-sm font-semibold truncate ${unread > 0 ? 'text-white' : 'text-slate-300'}`}>{friend.name}</span>
                      {lastMsg && <span className="text-xs text-slate-600 flex-shrink-0 ml-2">{timeAgo(lastMsg.createdAt)}</span>}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs truncate ${unread > 0 ? 'text-slate-300' : 'text-slate-600'}`}>{lastMsg ? getPreview(lastMsg) : <span className="text-slate-700">Start chatting</span>}</span>
                      {unread > 0 && (
                        <span className="ml-2 w-5 h-5 rounded-full text-[10px] font-bold text-white flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}>
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

        {/* Footer */}
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2.5">
            <Avatar name={user.name} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user.name}</p>
              <p className="text-xs text-slate-600 truncate">{user.userId}</p>
            </div>
          </div>
          <button onClick={onLogout} className="icon-btn w-8 h-8 text-red-500 hover:text-red-400" style={{ borderColor: 'rgba(239,68,68,0.2)' }} title="Logout">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Right placeholder */}
      <div className="flex-1 hidden min-[481px]:flex flex-col items-center justify-center gap-4 border-l border-white/5">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <p className="text-slate-500 font-medium text-sm">Select a conversation to start chatting</p>
      </div>
    </div>
  )
}
