import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('verifying')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) { setStatus('error'); setMessage('No verification token provided'); return }

    fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.message && !data.message.toLowerCase().includes('invalid')) {
          setStatus('success'); setMessage(data.message)
        } else {
          setStatus('error'); setMessage(data.message || 'Verification failed')
        }
      })
      .catch(() => { setStatus('error'); setMessage('Network error') })
  }, [searchParams])

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'radial-gradient(ellipse at 60% 20%, rgba(124,58,237,0.15) 0%, transparent 60%), #0a0a12' }}
    >
      <div className="w-full max-w-md animate-slide-up">
        <div className="rounded-2xl p-10 flex flex-col items-center text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}>

          {status === 'verifying' && (
            <>
              <div className="w-16 h-16 rounded-full border-4 border-violet-500/30 border-t-violet-500 mb-6" style={{ animation: 'spin 0.9s linear infinite' }} />
              <h1 className="text-2xl font-bold text-white mb-2">Verifying…</h1>
              <p className="text-slate-500 text-sm">Please wait while we verify your email.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Email Verified!</h1>
              <p className="text-slate-400 text-sm mb-6">{message}</p>
              <Link to="/login" className="btn-primary inline-block text-center">Go to Login</Link>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Verification Failed</h1>
              <p className="text-slate-400 text-sm mb-6">{message}</p>
              <Link to="/login" className="btn-primary inline-block text-center">Back to Login</Link>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
