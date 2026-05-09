import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('verifying')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setStatus('error')
      setMessage('No verification token provided')
      return
    }

    fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.message) {
          setStatus('success')
          setMessage(data.message)
        } else {
          setStatus('error')
          setMessage(data.message || 'Verification failed')
        }
      })
      .catch(() => {
        setStatus('error')
        setMessage('Network error')
      })
  }, [searchParams])

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {status === 'verifying' && (
          <>
            <h1 style={styles.title}>Verifying...</h1>
            <p style={styles.text}>Please wait while we verify your email.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div style={styles.icon}>✓</div>
            <h1 style={styles.title}>Email Verified!</h1>
            <p style={styles.text}>{message}</p>
            <Link to="/login" style={styles.button}>Go to Login</Link>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{ ...styles.icon, background: '#e53935' }}>✕</div>
            <h1 style={styles.title}>Verification Failed</h1>
            <p style={styles.text}>{message}</p>
            <Link to="/login" style={styles.button}>Back to Login</Link>
          </>
        )}
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0f0f0f',
  },
  card: {
    background: '#1a1a1a',
    padding: '40px',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    boxSizing: 'border-box',
  },
  icon: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: '#4caf50',
    color: '#fff',
    fontSize: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontSize: '24px',
    textAlign: 'center',
    margin: 0,
  },
  text: {
    color: '#888',
    fontSize: '14px',
    textAlign: 'center',
    margin: 0,
  },
  button: {
    padding: '12px 24px',
    borderRadius: '8px',
    border: 'none',
    background: '#4f46e5',
    color: '#fff',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'none',
  },
}
