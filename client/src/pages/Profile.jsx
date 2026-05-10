import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../utils/api'

function Avatar({ name, src, size = 96 }) {
  const colors = ['from-violet-600 to-indigo-600', 'from-pink-600 to-rose-600', 'from-emerald-600 to-teal-600', 'from-amber-600 to-orange-600', 'from-cyan-600 to-blue-600']
  const idx = (name?.charCodeAt(0) || 0) % colors.length
  if (src) return <img src={src} alt="" className="w-full h-full object-cover rounded-2xl" />
  return (
    <div className={`w-full h-full rounded-2xl bg-gradient-to-br ${colors[idx]} flex items-center justify-center font-bold text-white`} style={{ fontSize: size * 0.35 }}>
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  )
}

export default function Profile({ user, token, onUpdateUser, onLogout }) {
  const navigate = useNavigate()
  const fileRef = useRef(null)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(user.name)
  const [username, setUsername] = useState(user.username || '')
  const [avatar, setAvatar] = useState(user.avatar)
  const [uploading, setUploading] = useState(false)
  const [showOverlay, setShowOverlay] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('')

  const showMsg = (text, type = 'success') => {
    setMsg(text); setMsgType(type)
    setTimeout(() => { setMsg(''); setMsgType('') }, 3000)
  }

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { showMsg('Please select an image file', 'error'); return }
    if (file.size > 5 * 1024 * 1024) { showMsg('Image must be under 5MB', 'error'); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('avatar', file)
      const r = await apiFetch('/api/auth/upload-avatar', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      })
      const data = await r.json()
      if (!r.ok) { showMsg(data.message || 'Upload failed', 'error'); return }
      setAvatar(data.avatar)
      onUpdateUser({ ...user, avatar: data.avatar })
      showMsg('Avatar updated!')
    } catch { showMsg('Upload failed', 'error') }
    finally { setUploading(false) }
  }

  const handleSave = async () => {
    const updates = {}
    if (name.trim() && name.trim() !== user.name) updates.name = name.trim()
    if (username.trim() && username.trim() !== (user.username || '')) updates.username = username.trim()
    if (Object.keys(updates).length === 0) { setEditing(false); return }
    setSaving(true)
    try {
      if (updates.name) {
        const r = await apiFetch('/api/auth/update-profile', {
          method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: updates.name }),
        })
        const data = await r.json()
        if (!r.ok) { showMsg(data.message, 'error'); setSaving(false); return }
        onUpdateUser({ ...user, name: data.user.name })
      }
      if (updates.username) {
        const r = await apiFetch('/api/auth/update-profile', {
          method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ username: updates.username }),
        })
        const data = await r.json()
        if (!r.ok) { showMsg(data.message || 'Failed to update username', 'error'); setSaving(false); return }
        onUpdateUser({ ...user, name: data.user.name, username: updates.username })
      }
      setEditing(false); showMsg('Profile updated!')
    } catch { showMsg('Failed to save', 'error') }
    finally { setSaving(false) }
  }

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(user.userId)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch { showMsg('Failed to copy', 'error') }
  }

  return (
    <div className="min-h-[100dvh] py-8 px-4" style={{ background: '#0a0a12' }}>
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/chat-list')} className="icon-btn w-9 h-9">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <h1 className="text-white font-bold text-lg flex-1">Profile</h1>
          {!editing && (
            <button onClick={() => { setName(user.name); setUsername(user.username || ''); setEditing(true) }} className="icon-btn w-9 h-9">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          )}
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          {/* Avatar */}
          <div className="flex flex-col items-center mb-6">
            <div
              className="relative w-24 h-24 cursor-pointer group"
              onClick={() => fileRef.current?.click()}
              onMouseEnter={() => setShowOverlay(true)}
              onMouseLeave={() => setShowOverlay(false)}
            >
              <Avatar name={user.name} src={avatar} size={96} />
              <div className={`absolute inset-0 rounded-2xl flex items-center justify-center transition-opacity duration-200 ${showOverlay || uploading ? 'opacity-100' : 'opacity-0'}`} style={{ background: 'rgba(0,0,0,0.55)' }}>
                {uploading
                  ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" style={{ animation: 'spin 0.7s linear infinite' }} />
                  : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                }
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            <p className="text-slate-600 text-xs mt-2">Click to change photo</p>
          </div>

          {/* Toast */}
          {msg && (
            <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm text-center animate-fade-in ${msgType === 'error' ? 'text-red-300' : 'text-emerald-300'}`}
              style={{ background: msgType === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', border: `1px solid ${msgType === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}` }}>
              {msg}
            </div>
          )}

          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Username</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@username" className="input-field" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 py-2.5">
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button onClick={() => setEditing(false)} disabled={saving} className="btn-ghost flex-1 py-2.5">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Name + username */}
              <div className="text-center">
                <h2 className="text-xl font-bold text-white">{user.name}</h2>
                {user.username && <p className="text-slate-500 text-sm mt-0.5">@{user.username}</p>}
              </div>

              {/* User ID card */}
              <div className="rounded-xl p-4" style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)' }}>
                <p className="text-xs font-medium text-slate-600 uppercase tracking-wider mb-2">Your User ID</p>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono font-bold text-violet-400 text-lg tracking-wide">{user.userId}</span>
                  <button onClick={handleCopyId} className="icon-btn w-8 h-8 flex-shrink-0" title="Copy ID">
                    {copied
                      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    }
                  </button>
                </div>
                <p className="text-xs text-slate-700 mt-2">Share this ID so friends can find you</p>
              </div>

              {/* Meta */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span className="text-xs text-slate-600 uppercase tracking-wider">Email</span>
                  <span className="text-sm text-slate-300">{user.email}</span>
                </div>
                {user.isVerified !== undefined && (
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-xs text-slate-600 uppercase tracking-wider">Verified</span>
                    <span className={`text-sm font-semibold flex items-center gap-1.5 ${user.isVerified ? 'text-emerald-400' : 'text-red-400'}`}>
                      {user.isVerified
                        ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> Verified</>
                        : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Not verified</>
                      }
                    </span>
                  </div>
                )}
              </div>

              {/* Logout */}
              <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-red-400 transition-all"
                style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
