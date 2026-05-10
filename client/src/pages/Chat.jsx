import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { apiFetch, apiAxios } from '../utils/api'
import useSocket from '../hooks/useSocket'
import useEncryption from '../hooks/useEncryption'
import useMediaQuery from '../hooks/useMediaQuery'
import VideoCall from '../components/VideoCall'
import VoiceRecorder from '../components/VoiceRecorder'
import VoiceMessage from '../components/VoiceMessage'
import EmojiPicker from '../components/EmojiPicker'
import FilePreview from '../components/FilePreview'

function ChatAvatar({ name, src, size = 'md' }) {
  const colors = ['from-violet-600 to-indigo-600', 'from-pink-600 to-rose-600', 'from-emerald-600 to-teal-600', 'from-amber-600 to-orange-600', 'from-cyan-600 to-blue-600']
  const idx = (name?.charCodeAt(0) || 0) % colors.length
  const sizeClass = size === 'lg' ? 'w-12 h-12 text-lg' : 'w-10 h-10 text-sm'
  
  if (src) return <img src={src} alt="" className={`${sizeClass} rounded-2xl object-cover flex-shrink-0`} />
  
  return (
    <div className={`${sizeClass} rounded-2xl bg-gradient-to-br ${colors[idx]} flex items-center justify-center font-bold text-white flex-shrink-0`}>
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  )
}

export default function Chat({ user, token, onLogout }) {
  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = useMediaQuery('(max-width: 480px)')
  const { socket, isConnected, onlineUsers } = useSocket(token)
  const [users, setUsers] = useState([])
  const { ensureKeyPair, preloadKeys, encrypt, decrypt } = useEncryption(users)
  const [selectedUser, setSelectedUser] = useState(null)
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [incomingCaller, setIncomingCaller] = useState(null)
  const [pendingOffer, setPendingOffer] = useState(null)
  const [activeCall, setActiveCall] = useState(null)
  const fileInputRef = useRef(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const [typingUsers, setTypingUsers] = useState({})
  const [pendingFile, setPendingFile] = useState(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendMsg, setResendMsg] = useState('')
  const [pendingRequests, setPendingRequests] = useState(0)

  useEffect(() => {
    apiFetch('/api/friends/requests', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setPendingRequests(data.requests?.length || 0))
      .catch(() => {})
  }, [token])

  useEffect(() => {
    if (!socket) return
    const refresh = () => {
      apiFetch('/api/friends/requests', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((data) => setPendingRequests(data.requests?.length || 0))
        .catch(() => {})
    }
    socket.on('friend:request', refresh)
    socket.on('friend:accepted', refresh)
    socket.on('friend:rejected', refresh)
    return () => {
      socket.off('friend:request', refresh)
      socket.off('friend:accepted', refresh)
      socket.off('friend:rejected', refresh)
    }
  }, [socket, token])

  useEffect(() => {
    apiFetch('/api/friends/list', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setUsers(data.friends || []))
  }, [token])

  useEffect(() => {
    const friend = location.state?.selectedFriend
    if (friend && users.length > 0) {
      const match = users.find((u) => u._id === friend._id)
      if (match) setSelectedUser(match)
    }
  }, [location.state, users])

  useEffect(() => {
    const init = async () => {
      const publicKey = await ensureKeyPair()
      if (publicKey) {
        try {
          await apiFetch('/api/auth/public-key', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ publicKey }),
          })
        } catch {}
      }
    }
    init()
  }, [token, ensureKeyPair])

  useEffect(() => {
    users.forEach(async (u) => {
      if (u.publicKey) {
        await preloadKeys(u._id, u.publicKey)
      }
    })
  }, [users, preloadKeys])

  useEffect(() => {
    if (!selectedUser) return
    setMessages([])
    setTypingUsers({})
    apiFetch(`/api/messages?userId=${selectedUser._id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const decrypted = (data.messages || []).map((msg) => ({
          ...msg,
          content: msg.type === 'text' ? decrypt(msg.content, selectedUser._id) : msg.content,
        }))
        setMessages(decrypted)
      })
    socket?.emit('message:read', { senderId: selectedUser._id })
  }, [selectedUser, token, decrypt, socket])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!socket) return

    const handleTyping = ({ userId, isTyping }) => {
      setTypingUsers((prev) => ({ ...prev, [userId]: isTyping }))
    }
    socket.on('user:typing', handleTyping)
    return () => socket.off('user:typing', handleTyping)
  }, [socket])

  useEffect(() => {
    if (!socket) return
    const handleReceive = ({ message }) => {
      if (
        selectedUser &&
        (message.sender._id === selectedUser._id ||
          message.sender._id === user._id)
      ) {
        const msg = { ...message }
        msg.content = msg.type === 'text' ? decrypt(msg.content, msg.sender._id === user._id ? selectedUser._id : msg.sender._id) : msg.content
        setMessages((prev) => [...prev, msg])
        if (message.sender._id === selectedUser._id) {
          socket.emit('message:read', { senderId: message.sender._id })
        }
      }
    }
    const handleDelivered = ({ messageId }) => {
      setMessages((prev) => prev.map((m) => (m._id === messageId ? { ...m, status: 'delivered' } : m)))
    }
    const handleSeen = ({ by }) => {
      setMessages((prev) => prev.map((m) => (m.sender._id === user._id && m.receiver === by ? { ...m, status: 'seen' } : m)))
    }
    socket.on('message:receive', handleReceive)
    socket.on('message:delivered', handleDelivered)
    socket.on('message:seen', handleSeen)
    return () => {
      socket.off('message:receive', handleReceive)
      socket.off('message:delivered', handleDelivered)
      socket.off('message:seen', handleSeen)
    }
  }, [socket, selectedUser, user._id, decrypt])

  useEffect(() => {
    if (!socket) return

    const handleIncoming = ({ from }) => {
      const caller = users.find((u) => u._id === from)
      setIncomingCaller({ userId: from, userName: caller?.name || 'User' })
    }

    const handleOffer = ({ from, offer }) => {
      setPendingOffer({ from, offer })
    }

    const handleEnded = ({ from }) => {
      if (activeCall && activeCall.remoteUserId === from) {
        setActiveCall(null)
      }
      setIncomingCaller(null)
      setPendingOffer(null)
    }

    socket.on('call:incoming', handleIncoming)
    socket.on('call:offer', handleOffer)
    socket.on('call:ended', handleEnded)

    return () => {
      socket.off('call:incoming', handleIncoming)
      socket.off('call:offer', handleOffer)
      socket.off('call:ended', handleEnded)
    }
  }, [socket, users, activeCall])

  const handleSendMessage = () => {
    if (!inputText.trim() || !selectedUser || !socket) return
    const encrypted = encrypt(inputText.trim(), selectedUser._id)
    socket.emit(
      'message:send',
      {
        receiverId: selectedUser._id,
        content: encrypted,
      },
      (response) => {
        if (response?.message) {
          const msg = { ...response.message }
          msg.content = decrypt(msg.content, selectedUser._id)
          setMessages((prev) => [...prev, msg])
        }
      }
    )
    setInputText('')
    clearTimeout(typingTimeoutRef.current)
    emitTyping(false)
  }

  const handleStartCall = () => {
    if (!selectedUser) return
    setActiveCall({
      mode: 'outgoing',
      remoteUserId: selectedUser._id,
      remoteUserName: selectedUser.name,
    })
  }

  const handleAcceptCall = () => {
    if (!incomingCaller) return
    setActiveCall({
      mode: 'incoming',
      remoteUserId: incomingCaller.userId,
      remoteUserName: incomingCaller.userName,
      incomingSignal:
        pendingOffer?.from === incomingCaller.userId
          ? pendingOffer.offer
          : null,
    })
    setIncomingCaller(null)
    setPendingOffer(null)
  }

  const handleRejectCall = () => {
    if (incomingCaller) {
      socket?.emit('call:end', { receiverId: incomingCaller.userId })
    }
    setIncomingCaller(null)
    setPendingOffer(null)
  }

  const emitTyping = useCallback((isTyping) => {
    if (!selectedUser || !socket) return
    socket.emit('user:typing', { receiverId: selectedUser._id, isTyping })
  }, [selectedUser, socket])

  const handleInputChange = (e) => {
    setInputText(e.target.value)
    if (!socket || !selectedUser) return
    emitTyping(true)
    clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => emitTyping(false), 1500)
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file || !selectedUser) return
    e.target.value = ''
    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')
    if (!isImage && !isVideo) return
    setPendingFile(file)
  }

  const handleSendFile = async (file) => {
    setPendingFile(null)
    setUploadingFile(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('receiverId', selectedUser._id)

      const endpoint = file.type.startsWith('video/') ? '/api/upload/video' : '/api/upload/image'
      const res = await apiAxios.post(endpoint, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      })

      if (res.data?.message) {
        setMessages((prev) => [...prev, res.data.message])
      }
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploadingFile(false)
    }
  }

  const handleEmojiSelect = (emoji) => {
    const input = inputRef.current
    if (!input) {
      setInputText((prev) => prev + emoji)
      return
    }
    const start = input.selectionStart
    const end = input.selectionEnd
    const text = inputText
    const newText = text.slice(0, start) + emoji + text.slice(end)
    setInputText(newText)
    requestAnimationFrame(() => {
      input.selectionStart = input.selectionEnd = start + emoji.length
      input.focus()
    })
  }

  const handleVoiceSent = useCallback(
    (message) => {
      setMessages((prev) => [...prev, message])
    },
    []
  )

  const handleDownload = async (url, filename) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename || 'as-chat-media'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error('Download failed:', error)
    }
  }

  if (activeCall) {
    return (
      <VideoCall
        socket={socket}
        localUserId={user._id}
        remoteUserId={activeCall.remoteUserId}
        remoteUserName={activeCall.remoteUserName}
        mode={activeCall.mode}
        incomingSignal={activeCall.incomingSignal}
        onEnd={() => setActiveCall(null)}
      />
    )
  }

  const showSidebar = !isMobile || !selectedUser
  const showChat = !isMobile || selectedUser

  return (
    <div className="h-[100dvh] flex text-white overflow-hidden bg-[#0a0a12] select-none">
      {/* Sidebar */}
      {showSidebar && (
        <div className={`flex flex-col flex-shrink-0 transition-all duration-300 border-r border-white/5 ${isMobile ? 'w-full' : 'w-64 sm:w-72 lg:w-80'}`}>
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight cursor-pointer" onClick={() => navigate('/chat-list')}>AS Chat</h2>
            <div className="flex items-center gap-2">
              <button onClick={() => navigate('/add-friend')} className="icon-btn w-9 h-9" title="Add Friend">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" />
                  <line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
                </svg>
              </button>
              <div className="relative">
                <button onClick={() => navigate('/friend-requests')} className="icon-btn w-9 h-9" title="Friend Requests">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </button>
                {pendingRequests > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-violet-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-[#0a0a12]">
                    {pendingRequests > 9 ? '9+' : pendingRequests}
                  </span>
                )}
              </div>
              <button onClick={() => navigate('/profile')} className="icon-btn w-9 h-9" title="Profile">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                </svg>
              </button>
              <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`} />
              <button onClick={onLogout} className="text-xs font-semibold text-slate-500 hover:text-rose-400 transition-colors ml-1">Logout</button>
            </div>
          </div>

          {!user.isVerified && (
            <div className="px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between text-[11px] text-amber-400 font-medium">
              <span>Email verification required</span>
              <div className="flex items-center gap-3">
                <button 
                  onClick={async () => {
                    setResending(true); setResendMsg('')
                    try {
                      const r = await apiFetch('/api/auth/resend-verification', { method: 'POST', headers: { Authorization: `Bearer ${token}` }})
                      const d = await r.json()
                      setResendMsg(d.message || 'Sent!')
                    } catch { setResendMsg('Error') }
                    finally { setResending(false) }
                  }}
                  disabled={resending}
                  className="underline hover:text-amber-300 disabled:opacity-50"
                >
                  {resending ? 'Sending...' : 'Resend link'}
                </button>
                {resendMsg && <span className="text-emerald-400 animate-fade-in">{resendMsg}</span>}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {users.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-10">
                <div className="w-16 h-16 rounded-2xl bg-violet-600/10 border border-violet-600/20 flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.5"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /></svg>
                </div>
                <p className="text-slate-500 text-sm font-medium">No friends yet</p>
                <button onClick={() => navigate('/add-friend')} className="text-xs font-semibold text-violet-400 hover:text-violet-300 px-4 py-2 bg-violet-600/10 rounded-xl transition-all">Add Someone</button>
              </div>
            ) : (
              users.map((u) => (
                <div
                  key={u._id}
                  onClick={() => setSelectedUser(u)}
                  className={`flex items-center gap-3 px-3 py-3.5 rounded-2xl cursor-pointer transition-all duration-200 group ${selectedUser?._id === u._id ? 'bg-violet-600/10 ring-1 ring-violet-600/20' : 'hover:bg-white/5'}`}
                >
                  <div className="relative">
                    <ChatAvatar name={u.name} src={u.avatar} />
                    <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#0a0a12] ${onlineUsers.has(u._id) ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h3 className="text-sm font-semibold truncate">{u.name}</h3>
                      {onlineUsers.has(u._id) && <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Live</span>}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{u.email}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Chat Area */}
      {showChat && (
        <div className="flex-1 flex flex-col min-w-0 bg-[#0a0a12] relative">
          {!selectedUser ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
              <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              </div>
              <div>
                <h3 className="text-lg font-bold">Pick a conversation</h3>
                <p className="text-slate-500 text-sm">Select a friend to start chatting</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="h-16 px-4 flex items-center justify-between border-b border-white/5 bg-[#0a0a12]/80 backdrop-blur-xl z-10">
                <div className="flex items-center gap-3 min-w-0">
                  {isMobile && (
                    <button onClick={() => setSelectedUser(null)} className="icon-btn w-9 h-9 mr-1">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
                    </button>
                  )}
                  <div className="relative">
                    <ChatAvatar name={selectedUser.name} src={selectedUser.avatar} />
                    {onlineUsers.has(selectedUser._id) && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#0a0a12]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold truncate leading-tight">{selectedUser.name}</h2>
                    {typingUsers[selectedUser._id] ? (
                      <span className="text-[11px] text-violet-400 font-medium animate-pulse">typing...</span>
                    ) : (
                      <span className="text-[11px] text-slate-500">{onlineUsers.has(selectedUser._id) ? 'Active now' : 'Offline'}</span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button onClick={handleStartCall} className="w-10 h-10 rounded-xl bg-violet-600 hover:bg-violet-500 transition-all flex items-center justify-center shadow-lg shadow-violet-600/20 active:scale-95">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                  </button>
                </div>
              </div>

              {/* Messages Container */}
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
                <div className="flex flex-col gap-4">
                  {messages.map((msg, i) => {
                    const isMine = msg.sender._id === user._id
                    const nextMsg = messages[i + 1]
                    const sameSender = nextMsg && (nextMsg.sender._id === msg.sender._id)
                    
                    return (
                      <div key={msg._id || i} className={`flex w-full ${isMine ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                        <div className={`flex flex-col max-w-[92%] sm:max-w-[85%] md:max-w-[75%] ${isMine ? 'items-end' : 'items-start'}`}>
                          <div className={`px-4 py-2.5 rounded-2xl relative shadow-lg group/bubble ${isMine ? 'bg-violet-600 text-white rounded-tr-none' : 'bg-white/10 text-slate-100 rounded-tl-none'}`}>
                            {msg.type === 'text' && <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>}
                            {msg.type === 'voice' && <VoiceMessage url={msg.content} />}
                            
                            {(msg.type === 'image' || msg.type === 'video') && (
                              <div className="relative group/media mt-1 mb-1">
                                {msg.type === 'image' && (
                                  <img 
                                    src={msg.content} 
                                    alt="" 
                                    className="max-w-full max-h-[400px] rounded-xl object-contain border border-white/5 cursor-pointer hover:opacity-90 transition-opacity" 
                                    onClick={() => window.open(msg.content, '_blank')}
                                  />
                                )}
                                {msg.type === 'video' && (
                                  <video 
                                    controls 
                                    src={msg.content} 
                                    className="max-w-full max-h-[400px] rounded-xl border border-white/5" 
                                  />
                                )}
                                
                                {/* Download Overlay */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDownload(msg.content, `as-chat-${msg.type}-${Date.now()}`)
                                  }}
                                  className="absolute top-2 right-2 p-2 bg-black/60 backdrop-blur-md rounded-lg text-white opacity-0 group-hover/media:opacity-100 transition-all hover:bg-black/80 z-20"
                                  title="Download"
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                </button>
                              </div>
                            )}
                            
                            <div className={`flex items-center gap-1.5 mt-1 text-[10px] ${isMine ? 'text-violet-200/70' : 'text-slate-500'}`}>
                              <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              {isMine && (
                                <span>
                                  {msg.status === 'seen' ? <span className="text-emerald-400 font-bold">✓✓</span> : msg.status === 'delivered' ? <span>✓✓</span> : <span>✓</span>}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Input Area */}
              <div className="p-4 border-t border-white/5 bg-[#0a0a12]">
                <div className="relative flex items-end gap-1.5 bg-white/5 rounded-[22px] p-1.5 pr-2 focus-within:bg-white/10 focus-within:ring-1 focus-within:ring-violet-600/30 transition-all">
                  <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFileSelect} className="hidden" />
                  
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploadingFile} className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                    {uploadingFile ? (
                      <div className="w-5 h-5 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                    ) : (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                    )}
                  </button>

                  <EmojiPicker onSelect={handleEmojiSelect} />
                  
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={inputText}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage()
                      }
                    }}
                    placeholder="Type a message..."
                    className="flex-1 py-2.5 px-0 bg-transparent border-0 outline-none resize-none max-h-32 text-sm custom-scrollbar w-0"
                    style={{ height: 'auto' }}
                    onInput={(e) => {
                      e.target.style.height = 'auto'
                      e.target.style.height = e.target.scrollHeight + 'px'
                    }}
                  />
                  
                  <div className="flex items-center gap-0.5 pb-1 flex-shrink-0">
                    <VoiceRecorder receiverId={selectedUser._id} token={token} onSent={handleVoiceSent} />
                    <button onClick={handleSendMessage} className="w-9 h-9 bg-violet-600 hover:bg-violet-500 rounded-full flex items-center justify-center transition-all shadow-lg shadow-violet-600/20 active:scale-90 flex-shrink-0">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="ml-0.5"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Overlays */}
      {incomingCaller && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#0a0a12]/90 backdrop-blur-xl animate-fade-in">
          <div className="w-full max-w-xs glass rounded-[32px] p-8 text-center flex flex-col items-center">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-violet-600/20 rounded-full animate-ping" />
              <div className="relative">
                <ChatAvatar name={incomingCaller.userName} size="lg" />
              </div>
            </div>
            <h3 className="text-xl font-bold mb-1">{incomingCaller.userName}</h3>
            <p className="text-slate-500 text-sm mb-8 animate-pulse italic">Incoming voice call...</p>
            
            <div className="flex gap-6">
              <button onClick={handleRejectCall} className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 flex items-center justify-center transition-all shadow-xl shadow-rose-600/20 active:scale-90">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
              <button onClick={handleAcceptCall} className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center transition-all shadow-xl shadow-emerald-600/20 active:scale-90">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingFile && (
        <FilePreview
          file={pendingFile}
          onSend={handleSendFile}
          onCancel={() => setPendingFile(null)}
        />
      )}
    </div>
  )
}
