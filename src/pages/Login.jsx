import { useState } from 'react';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';

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
    if (mobile.length !== 10) { setError('Enter valid 10 digit mobile number'); return; }
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
      const res = await authAPI.verifyOTP(mobile, otp, 'wholesaler', 'Wholesaler User');
      if (res.data.user.role !== 'wholesaler') {
        setError('Access denied — wholesalers only');
        return;
      }
      login({ token: res.data.token, refresh_token: res.data.refresh_token }, res.data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', width: '100vw',
      background: '#000',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: '#1C1C1E',
        border: '1px solid #2C2C2E',
        borderRadius: 20,
        padding: 40,
        width: 380,
      }}>
        {/* Logo */}

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <Logo size={72} showText={false} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: -1 }}>
            Vendor<span style={{ color: '#F2C94C' }}>Net</span>
          </div>
          <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 4 }}>Wholesaler Portal</div>
        </div>
        
        {/* <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#fff', letterSpacing: -1 }}>
            Vendor<span style={{ color: '#F2C94C' }}>Net</span>
          </div>
          <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 4 }}>Wholesaler Portal</div>
        </div> */}

        {/* Error */}
        {error && (
          <div style={{ background: '#2A0A0A', border: '1px solid #FF453A', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#FF453A' }}>
            {error}
          </div>
        )}

        {step === 'mobile' ? (
          <>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#8E8E93', marginBottom: 8 }}>Mobile Number</div>
            <div style={{ display: 'flex', alignItems: 'center', background: '#2C2C2E', border: '1px solid #3A3A3C', borderRadius: 10, marginBottom: 16, paddingLeft: 14, overflow: 'hidden' }}>
              <span style={{ color: '#8E8E93', fontSize: 14, marginRight: 8, whiteSpace: 'nowrap' }}>+91</span>
              <input
                type="tel" maxLength={10} value={mobile}
                onChange={e => setMobile(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendOTP()}
                placeholder="Enter mobile number"
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 15, padding: '12px 14px 12px 0' }}
              />
            </div>
            <button onClick={sendOTP} disabled={loading} style={{ width: '100%', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 10, padding: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 12, color: '#8E8E93', marginBottom: 8 }}>OTP sent to +91 {mobile}</div>
            <input
              type="tel" maxLength={6} value={otp}
              onChange={e => setOtp(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && verifyOTP()}
              placeholder="Enter 6 digit OTP"
              style={{ width: '100%', background: '#2C2C2E', border: '1px solid #3A3A3C', borderRadius: 10, color: '#fff', padding: '12px 14px', fontSize: 22, letterSpacing: 10, marginBottom: 16, outline: 'none', textAlign: 'center' }}
            />
            <button onClick={verifyOTP} disabled={loading} style={{ width: '100%', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 10, padding: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 12 }}>
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
            <button onClick={() => setStep('mobile')} style={{ width: '100%', background: 'transparent', border: 'none', color: '#0A84FF', fontSize: 13, cursor: 'pointer' }}>
              Change number
            </button>
          </>
        )}

        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 11, color: '#3A3A3C' }}>
          VendorNet · B2B Wholesale Platform
        </div>
      </div>
    </div>
  );
}