import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import useMediaQuery from '../hooks/useMediaQuery'

export default function Profile({ user, token, onUpdateUser, onLogout }) {
  const navigate = useNavigate()
  const isMobile = useMediaQuery('(max-width: 768px)')
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
    if (!file.type.startsWith('image/')) {
      showMsg('Please select an image file', 'error'); return
    }
    if (file.size > 5 * 1024 * 1024) {
      showMsg('Image must be under 5MB', 'error'); return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('avatar', file)
      const r = await fetch('/api/auth/upload-avatar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      const data = await r.json()
      if (!r.ok) { showMsg(data.message || 'Upload failed', 'error'); return }
      setAvatar(data.avatar)
      onUpdateUser({ ...user, avatar: data.avatar })
      showMsg('Avatar updated')
    } catch { showMsg('Upload failed', 'error') }
    finally { setUploading(false) }
  }

  const handleSave = async () => {
    const updates = {}
    if (name.trim() && name.trim() !== user.name) updates.name = name.trim()
    if (username.trim() && username.trim() !== (user.username || '')) updates.username = username.trim()

    if (Object.keys(updates).length === 0) {
      setEditing(false); return
    }

    setSaving(true)
    try {
      if (updates.name) {
        const r = await fetch('/api/auth/update-profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: updates.name }),
        })
        const data = await r.json()
        if (!r.ok) { showMsg(data.message, 'error'); setSaving(false); return }
        onUpdateUser({ ...user, name: data.user.name })
      }
      if (updates.username) {
        const r = await fetch('/api/auth/update-profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ username: updates.username }),
        })
        const data = await r.json()
        if (!r.ok) { showMsg(data.message || 'Failed to update username', 'error'); setSaving(false); return }
        onUpdateUser({ ...user, name: data.user.name, username: updates.username })
      }
      setEditing(false)
      showMsg('Profile updated')
    } catch { showMsg('Failed to save', 'error') }
    finally { setSaving(false) }
  }

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(user.userId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { showMsg('Failed to copy', 'error') }
  }

  return (
    <div style={styles.container}>
      <div style={{ ...styles.card, padding: isMobile ? '20px' : '28px' }}>
        <div style={styles.header}>
          <button onClick={() => navigate('/chat-list')} style={styles.backBtn}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <h2 style={styles.title}>Profile</h2>
          {!editing && (
            <button onClick={() => { setName(user.name); setUsername(user.username || ''); setEditing(true) }} style={styles.editBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          )}
        </div>

        <div style={styles.avatarSection}>
          <div
            style={styles.avatarWrap}
            onClick={() => fileRef.current?.click()}
            onMouseEnter={() => setShowOverlay(true)}
            onMouseLeave={() => setShowOverlay(false)}
          >
            {avatar ? (
              <img src={avatar} alt="" style={styles.avatarImg} />
            ) : (
              <div style={styles.avatarFallback}>
                {(user.name || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <div style={{ ...styles.avatarOverlay, opacity: showOverlay || uploading ? 1 : 0 }}>
              {uploading ? (
                <span style={styles.uploadingText}>...</span>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              )}
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
        </div>

        {msg && (
          <div style={{ ...styles.msg, color: msgType === 'error' ? '#e53935' : '#4caf50', background: msgType === 'error' ? 'rgba(229,57,53,0.1)' : 'rgba(76,175,80,0.1)' }}>
            {msg}
          </div>
        )}

        {editing ? (
          <div style={styles.editSection}>
            <div style={styles.field}>
              <label style={styles.label}>Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={styles.input} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@username" style={styles.input} />
            </div>
            <div style={styles.editActions}>
              <button onClick={handleSave} disabled={saving} style={{ ...styles.saveBtn, opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setEditing(false)} disabled={saving} style={styles.cancelBtn}>Cancel</button>
            </div>
          </div>
        ) : (
          <div style={styles.infoSection}>
            <div style={styles.nameRow}>
              <span style={styles.name}>{user.name}</span>
              {user.username && <span style={styles.username}>@{user.username}</span>}
            </div>

            <div style={styles.idCard}>
              <div style={styles.idLabel}>Your User ID</div>
              <div style={styles.idRow}>
                <span style={styles.idValue}>{user.userId}</span>
                <button onClick={handleCopyId} style={styles.copyBtn}>
                  {copied ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4caf50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              </div>
              <div style={styles.hint}>Share your ID to add friends</div>
            </div>

            <div style={styles.metaSection}>
              <div style={styles.metaRow}>
                <span style={styles.metaLabel}>Email</span>
                <span style={styles.metaValue}>{user.email}</span>
              </div>
              {user.isVerified !== undefined && (
                <div style={styles.metaRow}>
                  <span style={styles.metaLabel}>Verified</span>
                  <span style={{ color: user.isVerified ? '#4caf50' : '#e53935', fontSize: '13px' }}>
                    {user.isVerified ? 'Yes' : 'No'}
                  </span>
                </div>
              )}
            </div>

            <button onClick={onLogout} style={styles.logoutBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Logout
            </button>
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
    display: 'flex',
    justifyContent: 'center',
    padding: '32px 16px',
  },
  card: {
    width: '100%',
    maxWidth: '480px',
    background: '#1a1a1a',
    borderRadius: '16px',
    alignSelf: 'flex-start',
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
    color: '#fff',
    flex: 1,
  },
  editBtn: {
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
  avatarSection: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '24px',
  },
  avatarWrap: {
    position: 'relative',
    width: '88px',
    height: '88px',
    borderRadius: '50%',
    cursor: 'pointer',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    objectFit: 'cover',
    display: 'block',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    background: '#8a6eff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '32px',
    fontWeight: 600,
    color: '#fff',
  },
  avatarOverlay: {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0,
    transition: 'opacity 0.2s',
  },
  uploadingText: {
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
  },
  msg: {
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '16px',
    textAlign: 'center',
  },
  infoSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  nameRow: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  name: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#fff',
  },
  username: {
    fontSize: '14px',
    color: '#666',
  },
  idCard: {
    background: '#0f0f0f',
    borderRadius: '12px',
    padding: '16px',
    textAlign: 'center',
  },
  idLabel: {
    fontSize: '11px',
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '8px',
  },
  idRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  idValue: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#8a6eff',
    letterSpacing: '1px',
  },
  copyBtn: {
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
  hint: {
    fontSize: '12px',
    color: '#444',
    marginTop: '10px',
  },
  metaSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '0 4px',
  },
  metaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: '13px',
    color: '#666',
  },
  metaValue: {
    fontSize: '13px',
    color: '#aaa',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px',
    borderRadius: '10px',
    border: '1px solid rgba(229,57,53,0.3)',
    background: 'rgba(229,57,53,0.1)',
    color: '#e53935',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
    marginTop: '4px',
  },
  editSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    color: '#888',
    fontWeight: 500,
  },
  input: {
    padding: '12px 14px',
    borderRadius: '8px',
    border: '1px solid #333',
    background: '#0f0f0f',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  editActions: {
    display: 'flex',
    gap: '8px',
    marginTop: '4px',
  },
  saveBtn: {
    flex: 1,
    padding: '12px',
    borderRadius: '8px',
    border: 'none',
    background: '#8a6eff',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  cancelBtn: {
    flex: 1,
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #333',
    background: 'transparent',
    color: '#888',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
  },
}
