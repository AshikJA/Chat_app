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
    setResending(true); setMsg('')
    try {
      const r = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await r.json()
      setMsg(data.message || 'Verification email sent!')
    } catch { setMsg('Failed to send') }
    finally { setResending(false) }
  }

  const handleCheckStatus = async () => {
    setChecking(true); setMsg('')
    try {
      const r = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      const data = await r.json()
      if (data.user?.isVerified) window.location.reload()
      else setMsg('Email not verified yet. Check your inbox.')
    } catch { setMsg('Failed to check status') }
    finally { setChecking(false) }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'radial-gradient(ellipse at 60% 20%, rgba(234,179,8,0.08) 0%, transparent 60%), #0a0a12' }}
    >
      <div className="w-full max-w-md animate-slide-up">
        <div className="rounded-2xl p-8 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">Verify Your Email</h1>
          <p className="text-slate-400 text-sm mb-1">A verification link was sent to</p>
          <p className="text-amber-400 font-semibold text-sm mb-6">{user.email}</p>

          {msg && (
            <div className="mb-5 px-4 py-2.5 rounded-xl text-sm text-emerald-300 animate-fade-in" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
              {msg}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button onClick={handleResend} disabled={resending} className="btn-primary">
              {resending
                ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" style={{ animation: 'spin 0.7s linear infinite' }} />Sending…</span>
                : 'Resend Verification Email'
              }
            </button>

            <button
              onClick={handleCheckStatus}
              disabled={checking}
              className="btn-ghost w-full py-3 text-sm font-medium"
            >
              {checking ? 'Checking…' : "I've Verified — Check Status"}
            </button>

            <button
              onClick={onLogout}
              className="text-slate-600 hover:text-slate-400 text-sm transition-colors py-2"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [user, setUser] = useState(null)

  useEffect(() => {
    if (!token) { setUser(null); return }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (data.user) setUser(data.user)
        else { localStorage.removeItem('token'); setToken(null) }
      })
      .catch(() => { localStorage.removeItem('token'); setToken(null) })
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

  const handleUpdateUser = useCallback((updatedUser) => setUser(updatedUser), [])

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
