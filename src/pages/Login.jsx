import { useState } from 'react';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('mobile');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const sendOTP = async () => {
    setError('');
    setLoading(true);
    try {
      await authAPI.sendOTP(mobile);
      setStep('otp');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.verifyOTP(mobile, otp);
      if (res.data.user.role !== 'wholesaler') {
        setError('Access denied — wholesalers only');
        return;
      }
      login(
        { token: res.data.token, refresh_token: res.data.refresh_token },
        res.data.user
      );
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.logo}>VendorNet</h1>
        <p style={styles.subtitle}>Wholesaler Portal</p>

        {error && <div style={styles.error}>{error}</div>}

        {step === 'mobile' ? (
          <>
            <label style={styles.label}>Mobile Number</label>
            <div style={styles.inputRow}>
              <span style={styles.prefix}>+91</span>
              <input
                style={styles.input}
                type="tel"
                placeholder="Enter mobile number"
                maxLength={10}
                value={mobile}
                onChange={e => setMobile(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendOTP()}
              />
            </div>
            <button style={styles.btn} onClick={sendOTP} disabled={loading}>
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </>
        ) : (
          <>
            <label style={styles.label}>OTP sent to +91 {mobile}</label>
            <input
              style={{ ...styles.input, width: '100%', letterSpacing: 8, fontSize: 22, marginBottom: 16 }}
              type="tel"
              placeholder="Enter OTP"
              maxLength={6}
              value={otp}
              onChange={e => setOtp(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && verifyOTP()}
            />
            <button style={styles.btn} onClick={verifyOTP} disabled={loading}>
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
            <button style={styles.linkBtn} onClick={() => setStep('mobile')}>
              Change number
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' },
  card: { background: '#fff', borderRadius: 16, padding: 40, width: 380, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' },
  logo: { fontSize: 32, fontWeight: 'bold', color: '#0F6E56', textAlign: 'center', margin: '0 0 4px' },
  subtitle: { textAlign: 'center', color: '#888', marginBottom: 32, fontSize: 14 },
  label: { display: 'block', fontSize: 14, fontWeight: 500, color: '#333', marginBottom: 8 },
  inputRow: { display: 'flex', alignItems: 'center', border: '1px solid #ddd', borderRadius: 8, padding: '0 12px', marginBottom: 16 },
  prefix: { color: '#333', marginRight: 8, fontSize: 15 },
  input: { border: 'none', outline: 'none', flex: 1, height: 44, fontSize: 15 },
  btn: { width: '100%', background: '#0F6E56', color: '#fff', border: 'none', borderRadius: 8, height: 46, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginBottom: 8 },
  linkBtn: { width: '100%', background: 'none', border: 'none', color: '#0F6E56', fontSize: 14, cursor: 'pointer' },
  error: { background: '#FCEBEB', color: '#791F1F', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13 }
};