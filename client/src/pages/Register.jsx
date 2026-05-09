import { useState } from 'react'
import { Link } from 'react-router-dom'
import useMediaQuery from '../hooks/useMediaQuery'

export default function Register({ onRegister }) {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [registeredData, setRegisteredData] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || 'Registration failed')
        return
      }
      setEmail(email)
      setRegistered(true)
      setRegisteredData(data)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  const handleContinue = () => {
    if (registeredData) {
      onRegister(registeredData.token, registeredData.user)
    }
  }

  if (registered) {
    return (
      <div style={styles.container}>
        <div style={{ ...styles.form, padding: isMobile ? '24px' : '40px' }}>
          <h1 style={styles.title}>Check Your Email</h1>
          <p style={styles.text}>
            A verification email has been sent to <strong>{email}</strong>.
            Please check your inbox and click the link to verify your account.
          </p>
          <p style={styles.text}>
            You can still use the app while waiting for verification.
          </p>
          <button onClick={handleContinue} style={styles.button}>Continue to Chat</button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <form onSubmit={handleSubmit} style={{ ...styles.form, padding: isMobile ? '24px' : '40px' }}>
        <h1 style={styles.title}>Create Account</h1>
        {error && <p style={styles.error}>{error}</p>}
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={styles.input}
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={styles.input}
          required
        />
        <input
          type="password"
          placeholder="Password (min 6 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={styles.input}
          required
          minLength={6}
        />
        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? 'Creating...' : 'Create Account'}
        </button>
        <p style={styles.text}>
          Already have an account? <Link to="/login" style={styles.link}>Sign In</Link>
        </p>
      </form>
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
  form: {
    background: '#1a1a1a',
    padding: '40px',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    boxSizing: 'border-box',
  },
  title: {
    color: '#fff',
    fontSize: '24px',
    textAlign: 'center',
    margin: 0,
  },
  input: {
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid #333',
    background: '#222',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
  },
  button: {
    padding: '12px',
    borderRadius: '8px',
    border: 'none',
    background: '#4f46e5',
    color: '#fff',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'center',
    textDecoration: 'none',
    display: 'block',
  },
  error: {
    color: '#e53935',
    fontSize: '14px',
    textAlign: 'center',
    margin: 0,
  },
  text: {
    color: '#888',
    fontSize: '14px',
    textAlign: 'center',
    margin: 0,
    lineHeight: 1.5,
  },
  link: {
    color: '#818cf8',
    textDecoration: 'none',
  },
}
