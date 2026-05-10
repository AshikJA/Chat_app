import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function OTPVerify() {
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email;

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputsRef = useRef([]);

  useEffect(() => {
    if (!email) navigate('/register');
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
    setCanResend(true);
  }, [countdown]);

  const handleChange = (idx, value) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[idx] = value;
    setDigits(next);

    if (value && idx < 5) {
      inputsRef.current[idx + 1]?.focus();
    }

    if (next.every(d => d !== '')) {
      verifyOtp(next.join(''));
    }
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    }
  };

  const verifyOtp = async (otp) => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.post('/api/auth/verify-otp', { email, otp });
      localStorage.setItem('wc_token', res.data.token);
      localStorage.setItem('wc_user', JSON.stringify(res.data.user));
      navigate('/chats');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid code');
      setDigits(['', '', '', '', '', '']);
      inputsRef.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setCanResend(false);
    setCountdown(60);
    try {
      await axios.post('/api/auth/register', { email });
    } catch {}
  };

  const topInset = 'env(safe-area-inset-top, 44px)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0B0B10', paddingTop: topInset }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
        {/* LOGO */}
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5, marginBottom: 32 }}>
          <span style={{ color: '#8A6EFF' }}>Wave</span>
          <span style={{ color: '#fff' }}>Chat</span>
        </h1>

        <div style={{ fontSize: 14, color: '#8A8A9E', textAlign: 'center', marginBottom: 4 }}>Check your email</div>
        <div style={{ fontSize: 13, color: '#5A5A6E', textAlign: 'center', marginBottom: 28 }}>
          We sent a 6-digit code to{'\n'}{email || 'your email'}
        </div>

        {/* OTP BOXES */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => (inputsRef.current[i] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              style={{
                width: 46,
                height: 52,
                textAlign: 'center',
                fontSize: 22,
                fontWeight: 700,
                background: '#1A1A26',
                border: d ? '2px solid #8A6EFF' : '2px solid #252535',
                borderRadius: 12,
                color: '#F0F0F5',
                outline: 'none',
                fontFamily: 'inherit',
                transition: 'border 0.15s',
              }}
            />
          ))}
        </div>

        {error && <div style={{ fontSize: 13, color: '#FF4D4D', textAlign: 'center', marginBottom: 12 }}>{error}</div>}
        {loading && <div style={{ fontSize: 13, color: '#8A6EFF', textAlign: 'center', marginBottom: 12 }}>Verifying...</div>}

        {/* RESEND */}
        <button
          onClick={handleResend}
          disabled={!canResend}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: canResend ? 'pointer' : 'default',
            fontSize: 13,
            color: canResend ? '#8A6EFF' : '#3A3A4A',
            fontWeight: 600,
            fontFamily: 'inherit',
          }}
        >
          {canResend ? 'Resend code' : `Resend in ${countdown}s`}
        </button>
      </div>
    </div>
  );
}
