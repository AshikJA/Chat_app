import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import axios from 'axios'
import useSocket from '../hooks/useSocket'
import useEncryption from '../hooks/useEncryption'
import useMediaQuery from '../hooks/useMediaQuery'
import VideoCall from '../components/VideoCall'
import VoiceRecorder from '../components/VoiceRecorder'
import VoiceMessage from '../components/VoiceMessage'
import EmojiPicker from '../components/EmojiPicker'
import FilePreview from '../components/FilePreview'

export default function Chat({ user, token, onLogout }) {
  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = useMediaQuery('(max-width: 768px)')
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
    fetch('/api/friends/requests', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setPendingRequests(data.requests?.length || 0))
      .catch(() => {})
  }, [token])

  useEffect(() => {
    if (!socket) return
    const refresh = () => {
      fetch('/api/friends/requests', {
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
    fetch('/api/friends/list', {
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
          await fetch('/api/auth/public-key', {
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
    fetch(`/api/messages?userId=${selectedUser._id}`, {
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
      const res = await axios.post(endpoint, formData, {
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
    <div style={styles.container}>
      {showSidebar && (
        <div style={{ ...styles.sidebar, ...(isMobile ? styles.sidebarMobile : {}) }}>
          <div style={styles.sidebarHeader}>
            <h2 style={{ ...styles.sidebarTitle, cursor: 'pointer' }} onClick={() => navigate('/chat-list')}>Chats</h2>
            <div style={styles.sidebarRight}>
            <button onClick={() => navigate('/add-friend')} style={styles.profileBtn} title="Add Friend">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
            </button>
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <button onClick={() => navigate('/friend-requests')} style={styles.profileBtn} title="Friend Requests">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 16v-4a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v4" />
                  <circle cx="7" cy="8" r="3" />
                  <path d="M21 16v-2a3 3 0 0 0-3-3h-1" />
                  <circle cx="16" cy="6" r="2" />
                </svg>
              </button>
              {pendingRequests > 0 && (
                <span style={styles.badge}>{pendingRequests > 9 ? '9+' : pendingRequests}</span>
              )}
            </div>
            <button onClick={() => navigate('/profile')} style={styles.profileBtn} title="Profile">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </button>
              <span
                style={{
                  ...styles.statusDot,
                  background: isConnected ? '#4caf50' : '#e53935',
                }}
              />
              <button onClick={onLogout} style={styles.logoutBtn}>
                Logout
              </button>
            </div>
          </div>
          {!user.isVerified && (
            <div style={styles.verifyBanner}>
              <span>Email not verified.</span>
              <button
                onClick={async () => {
                  setResending(true)
                  setResendMsg('')
                  try {
                    const r = await fetch('/api/auth/resend-verification', {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${token}` },
                    })
                    const d = await r.json()
                    setResendMsg(d.message || 'Sent!')
                  } catch {
                    setResendMsg('Failed to send')
                  } finally {
                    setResending(false)
                  }
                }}
                disabled={resending}
                style={styles.resendBtn}
              >
                {resending ? 'Sending...' : 'Resend'}
              </button>
              {resendMsg && <span style={{ fontSize: '11px', color: '#4caf50' }}>{resendMsg}</span>}
            </div>
          )}
          <div style={styles.userList}>
            {users.length === 0 && (
              <div style={styles.noUsers}>No friends yet — add some!</div>
            )}
            {users.map((u) => (
              <div
                key={u._id}
                onClick={() => setSelectedUser(u)}
                style={{
                  ...styles.userItem,
                  ...(selectedUser?._id === u._id ? styles.userItemActive : {}),
                }}
              >
                <div style={styles.avatar}>
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div style={styles.userInfo}>
                  <span style={styles.userName}>{u.name}</span>
                  <span style={styles.userEmail}>{u.email}</span>
                </div>
                <span
                  style={{
                    ...styles.onlineDot,
                    background: onlineUsers.has(u._id) ? '#4caf50' : '#555',
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {showChat && (
        <div style={{ ...styles.chatArea, ...(isMobile ? { display: 'flex' } : {}) }}>
          {!selectedUser ? (
            <div style={styles.noChat}>
              <p>Select a user to start chatting</p>
            </div>
          ) : (
            <>
              <div style={styles.chatHeader}>
                {isMobile && (
                  <button onClick={() => setSelectedUser(null)} style={styles.backBtn}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="19" y1="12" x2="5" y2="12" />
                      <polyline points="12 19 5 12 12 5" />
                    </svg>
                  </button>
                )}
                <div style={styles.avatarSm}>
                  {selectedUser.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.chatHeaderName}>{selectedUser.name}</div>
                  {typingUsers[selectedUser._id] && (
                    <div style={styles.typingText}>typing...</div>
                  )}
                </div>
                <button onClick={handleStartCall} style={styles.callBtn}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </button>
              </div>

              <div style={styles.messages}>
                {messages.map((msg, i) => {
                  const isMine = msg.sender._id === user._id
                  return (
                    <div
                      key={msg._id || i}
                      style={{
                        ...styles.messageRow,
                        justifyContent: isMine ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <div
                        style={{
                          ...styles.messageBubble,
                          background: isMine ? '#4f46e5' : '#2a2a2a',
                          borderBottomRightRadius: isMine ? '4px' : '12px',
                          borderBottomLeftRadius: isMine ? '12px' : '4px',
                          maxWidth: isMobile ? '85%' : '70%',
                        }}
                      >
                        {msg.type === 'text' && <span>{msg.content}</span>}
                        {msg.type === 'voice' && (
                          <VoiceMessage url={msg.content} />
                        )}
                        {msg.type === 'image' && (
                          <img src={msg.content} alt="" style={{ maxWidth: isMobile ? '220px' : '200px', borderRadius: '8px', display: 'block' }} />
                        )}
                        {msg.type === 'video' && (
                          <video controls src={msg.content} style={{ maxWidth: isMobile ? '260px' : '260px', maxHeight: isMobile ? '200px' : '200px', borderRadius: '8px', display: 'block' }} />
                        )}
                        <div style={styles.messageTime}>
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {isMine && (
                            <span style={{ marginLeft: '4px', fontSize: '11px', lineHeight: 1 }}>
                              {msg.status === 'seen' ? (
                                <span style={{ color: '#53b8ff' }}>✓✓</span>
                              ) : msg.status === 'delivered' ? (
                                <span style={{ color: '#999' }}>✓✓</span>
                              ) : (
                                <span style={{ color: '#666' }}>✓</span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              <div style={styles.inputArea}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile}
                  style={styles.attachBtn}
                  title="Send image or video"
                >
                  {uploadingFile ? (
                    <span style={styles.spinner} />
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  )}
                </button>
                <EmojiPicker onSelect={handleEmojiSelect} />
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={handleInputChange}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type a message..."
                  style={styles.textInput}
                />
                <VoiceRecorder
                  receiverId={selectedUser._id}
                  token={token}
                  onSent={handleVoiceSent}
                />
                <button onClick={handleSendMessage} style={styles.sendBtn}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {incomingCaller && (
        <div style={styles.incomingOverlay}>
          <div style={{ ...styles.incomingCard, ...(isMobile ? { padding: '24px', margin: '16px' } : {}) }}>
            <div style={styles.incomingAvatar}>
              {incomingCaller.userName.charAt(0).toUpperCase()}
            </div>
            <p style={styles.incomingText}>
              Incoming call from {incomingCaller.userName}
            </p>
            <div style={styles.incomingActions}>
              <button onClick={handleRejectCall} style={styles.rejectBtn}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              <button onClick={handleAcceptCall} style={styles.acceptBtn}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
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

const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    background: '#0f0f0f',
    color: '#fff',
  },
  sidebar: {
    width: '320px',
    borderRight: '1px solid #222',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  sidebarMobile: {
    width: '100%',
    borderRight: 'none',
  },
  verifyBanner: {
    padding: '10px 16px',
    background: 'rgba(255,193,7,0.1)',
    borderBottom: '1px solid rgba(255,193,7,0.2)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: '#ffc107',
    flexWrap: 'wrap',
  },
  resendBtn: {
    padding: '4px 10px',
    borderRadius: '4px',
    border: '1px solid rgba(255,193,7,0.4)',
    background: 'transparent',
    color: '#ffc107',
    fontSize: '11px',
    cursor: 'pointer',
  },
  sidebarHeader: {
    padding: '16px',
    borderBottom: '1px solid #222',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sidebarTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
  },
  sidebarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    display: 'inline-block',
  },
  profileBtn: {
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
  },
  badge: {
    position: 'absolute',
    top: '-4px',
    right: '-4px',
    background: '#8a6eff',
    color: '#fff',
    fontSize: '10px',
    fontWeight: 700,
    minWidth: '16px',
    height: '16px',
    lineHeight: '16px',
    borderRadius: '8px',
    textAlign: 'center',
    padding: '0 4px',
    boxSizing: 'border-box',
  },
  logoutBtn: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid #333',
    background: 'transparent',
    color: '#888',
    fontSize: '12px',
    cursor: 'pointer',
  },
  userList: {
    flex: 1,
    overflowY: 'auto',
  },
  userItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  userItemActive: {
    background: '#1a1a2e',
  },
  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: '#4f46e5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    fontSize: '16px',
    flexShrink: 0,
  },
  userInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  userName: {
    fontSize: '14px',
    fontWeight: 500,
  },
  userEmail: {
    fontSize: '12px',
    color: '#666',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  onlineDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  chatArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  noChat: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#555',
    fontSize: '16px',
  },
  chatHeader: {
    padding: '12px 16px',
    borderBottom: '1px solid #222',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  backBtn: {
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
  noUsers: {
    padding: '32px 16px',
    textAlign: 'center',
    color: '#555',
    fontSize: '14px',
  },
  avatarSm: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: '#4f46e5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    fontSize: '14px',
    flexShrink: 0,
  },
  chatHeaderName: {
    fontSize: '15px',
    fontWeight: 500,
    lineHeight: 1.3,
  },
  typingText: {
    fontSize: '12px',
    color: '#4caf50',
    fontStyle: 'italic',
    lineHeight: 1.3,
  },
  callBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: 'none',
    background: '#4caf50',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  messageRow: {
    display: 'flex',
  },
  messageBubble: {
    maxWidth: '70%',
    padding: '8px 12px',
    borderRadius: '12px',
    fontSize: '14px',
    lineHeight: 1.4,
    wordBreak: 'break-word',
  },
  messageTime: {
    fontSize: '11px',
    opacity: 0.6,
    marginTop: '4px',
    textAlign: 'right',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  inputArea: {
    padding: '12px 16px',
    borderTop: '1px solid #222',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  textInput: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #333',
    background: '#1a1a1a',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
  },
  attachBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: 'none',
    background: 'transparent',
    color: '#888',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  spinner: {
    width: '16px',
    height: '16px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.6s linear infinite',
    display: 'block',
  },
  sendBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: 'none',
    background: '#4f46e5',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  incomingOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.7)',
    zIndex: 9998,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  incomingCard: {
    background: '#1a1a1a',
    borderRadius: '16px',
    padding: '32px 40px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
  },
  incomingAvatar: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: '#4f46e5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
    fontWeight: 600,
  },
  incomingText: {
    margin: 0,
    fontSize: '16px',
    color: '#fff',
  },
  incomingActions: {
    display: 'flex',
    gap: '24px',
  },
  rejectBtn: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    border: 'none',
    background: '#e53935',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtn: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    border: 'none',
    background: '#4caf50',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
}
