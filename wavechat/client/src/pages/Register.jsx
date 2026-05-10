import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/register', form);
      navigate('/verify-otp', { state: { email: res.data.email } });
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const topInset = 'env(safe-area-inset-top, 44px)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0B0B10', paddingTop: topInset }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '40px 24px', scrollbarWidth: 'none' }}>
        {/* LOGO */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: -1, margin: 0 }}>
            <span style={{ color: '#8A6EFF' }}>Wave</span>
            <span style={{ color: '#fff' }}>Chat</span>
          </h1>
          <p style={{ fontSize: 13, color: '#5A5A6E', margin: '6px 0 0' }}>Create your account</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { name: 'name', placeholder: 'Full Name', type: 'text' },
            { name: 'email', placeholder: 'Email', type: 'email' },
            { name: 'username', placeholder: 'Username', type: 'text' },
            { name: 'password', placeholder: 'Password', type: 'password' },
          ].map(field => (
            <input
              key={field.name}
              name={field.name}
              type={field.type}
              placeholder={field.placeholder}
              value={form[field.name]}
              onChange={handleChange}
              required
              style={{
                width: '100%',
                padding: '14px 16px',
                background: '#1A1A26',
                border: '1px solid #252535',
                borderRadius: 14,
                fontSize: 15,
                color: '#F0F0F5',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          ))}

          {error && <div style={{ fontSize: 13, color: '#FF4D4D', textAlign: 'center' }}>{error}</div>}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px 0',
              borderRadius: 14,
              background: 'linear-gradient(135deg, #8A6EFF, #6C4FE8)',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 16,
              fontWeight: 600,
              color: '#fff',
              opacity: loading ? 0.6 : 1,
              marginTop: 6,
            }}
          >
            {loading ? 'Creating account...' : 'Register'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: '#5A5A6E' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#8A6EFF', textDecoration: 'none', fontWeight: 600 }}>Login</Link>
        </div>
      </div>
    </div>
  );
}
