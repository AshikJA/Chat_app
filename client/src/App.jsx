import { useState, useEffect, useCallback } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import VerifyEmail from './pages/VerifyEmail'
import Chat from './pages/Chat'
import ChatList from './pages/ChatList'
import Profile from './pages/Profile'
import AddFriend from './pages/AddFriend'
import FriendRequests from './pages/FriendRequests'

function VerifyPrompt({ user, token, onLogout }) {
  const [resending, setResending] = useState(false)
  const [msg, setMsg] = useState('')
  const [checking, setChecking] = useState(false)


  const handleResend = async () => {
    setResending(true)
    setMsg('')
    try {
      const r = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await r.json()
      setMsg(data.message || 'Verification email sent!')
    } catch {
      setMsg('Failed to send')
    } finally {
      setResending(false)
    }
  }

  const handleCheckStatus = async () => {
    setChecking(true)
    setMsg('')
    try {
      const r = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await r.json()
      if (data.user?.isVerified) {
        window.location.reload()
      } else {
        setMsg('Email not verified yet. Check your inbox.')
      }
    } catch {
      setMsg('Failed to check status')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f0f0f',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        background: '#1a1a1a',
        borderRadius: '12px',
        padding: '40px',
        maxWidth: '420px',
        width: '100%',
        textAlign: 'center',
        boxSizing: 'border-box',
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: '#ffc107',
          color: '#000',
          fontSize: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
        }}>!</div>
        <h1 style={{ color: '#fff', fontSize: '22px', margin: '0 0 8px' }}>Verify Your Email</h1>
        <p style={{ color: '#888', fontSize: '14px', margin: '0 0 4px' }}>
          You need to verify your email before using the chat.
        </p>
        <p style={{ color: '#666', fontSize: '13px', margin: '0 0 24px' }}>
          A verification email was sent to <strong style={{ color: '#fff' }}>{user.email}</strong>
        </p>
        {msg && (
          <p style={{ color: '#4caf50', fontSize: '13px', margin: '0 0 16px' }}>{msg}</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={handleResend}
            disabled={resending}
            style={{
              padding: '12px 24px',
              borderRadius: '8px',
              border: 'none',
              background: '#4f46e5',
              color: '#fff',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {resending ? 'Sending...' : 'Resend Verification Email'}
          </button>
          <button
            onClick={handleCheckStatus}
            disabled={checking}
            style={{
              padding: '12px 24px',
              borderRadius: '8px',
              border: '1px solid #333',
              background: 'transparent',
              color: '#888',
              fontSize: '15px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {checking ? 'Checking...' : 'I\'ve Verified, Check Status'}
          </button>
          <button
            onClick={onLogout}
            style={{
              padding: '12px 24px',
              borderRadius: '8px',
              border: 'none',
              background: 'transparent',
              color: '#555',
              fontSize: '14px',
              cursor: 'pointer',
              marginTop: '8px',
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [user, setUser] = useState(null)

  useEffect(() => {
    if (!token) {
      setUser(null)
      return
    }
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.user) setUser(data.user)
        else {
          localStorage.removeItem('token')
          setToken(null)
        }
      })
      .catch(() => {
        localStorage.removeItem('token')
        setToken(null)
      })
  }, [token])

  const handleLogin = (newToken, newUser) => {
    localStorage.setItem('token', newToken)
    setToken(newToken)
    setUser(newUser)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }

  const handleUpdateUser = useCallback((updatedUser) => {
    setUser(updatedUser)
  }, [])

  if (!token || !user) {
    return (
      <Routes>
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="/register" element={<Register onRegister={handleLogin} />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  if (!user.isVerified) {
    return <VerifyPrompt user={user} token={token} onLogout={handleLogout} />
  }

  return (
    <Routes>
      <Route path="/chat" element={<Chat user={user} token={token} onLogout={handleLogout} />} />
      <Route path="/chat-list" element={<ChatList user={user} token={token} onLogout={handleLogout} />} />
      <Route path="/profile" element={<Profile user={user} token={token} onUpdateUser={handleUpdateUser} onLogout={handleLogout} />} />
      <Route path="/add-friend" element={<AddFriend user={user} token={token} />} />
      <Route path="/friend-requests" element={<FriendRequests user={user} token={token} />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="*" element={<Navigate to="/chat" replace />} />
    </Routes>
  )
}
