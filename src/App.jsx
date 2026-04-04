import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Orders from './pages/Orders';

function Layout({ children }) {
  const { user, logout } = useAuth();
  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <div style={styles.logo}>VendorNet</div>
        <p style={styles.portalLabel}>Wholesaler Portal</p>
        <nav>
          {[
            { to: '/', label: '📊 Dashboard' },
            { to: '/orders', label: '📦 Orders' },
            { to: '/inventory', label: '🏷️ Inventory' },
          ].map(({ to, label }) => (
            <NavLink key={to} to={to} end={to === '/'} style={({ isActive }) => ({
              ...styles.navLink, background: isActive ? '#085041' : 'transparent'
            })}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div style={styles.userBox}>
          <p style={styles.userName}>{user?.name}</p>
          <button style={styles.logoutBtn} onClick={logout}>Logout</button>
        </div>
      </div>
      <div style={styles.main}>{children}</div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  if (user.role !== 'wholesaler') return <Navigate to="/login" />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
          <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

const styles = {
  container: { display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' },
  sidebar: { width: 220, background: '#0F6E56', display: 'flex', flexDirection: 'column', padding: '24px 0' },
  logo: { fontSize: 22, fontWeight: 'bold', color: '#fff', padding: '0 20px', marginBottom: 4 },
  portalLabel: { fontSize: 11, color: '#9FE1CB', padding: '0 20px', marginBottom: 24 },
  navLink: { display: 'block', color: '#fff', textDecoration: 'none', padding: '10px 20px', fontSize: 14 },
  main: { flex: 1, background: '#f5f5f5', padding: 24, overflowY: 'auto' },
  userBox: { marginTop: 'auto', padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.1)' },
  userName: { color: '#9FE1CB', fontSize: 13, margin: '0 0 8px' },
  logoutBtn: { background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer', width: '100%' }
};