import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Inventory from './pages/Inventory';
import BulkUpload from './pages/BulkUpload';
import Logo from './components/Logo';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: '📊', bg: '#185FA5', section: 'main' },
  { to: '/orders', label: 'Orders', icon: '📦', bg: '#FF9500', section: 'main', badge: 'orders' },
  { to: '/inventory', label: 'Inventory', icon: '🏷', bg: '#34C759', section: 'main', badge: 'lowstock' },
  { to: '/bulk-upload', label: 'Bulk Upload', icon: '📤', bg: '#5856D6', section: 'main' },
  { to: '/invoices', label: 'Invoices', icon: '🧾', bg: '#FF2D55', section: 'main' },
  { to: '/reports', label: 'Reports', icon: '📈', bg: '#64D2FF', section: 'analytics' },
  { to: '/commission', label: 'Commission', icon: '💰', bg: '#BF5AF2', section: 'analytics' },
  { to: '/customers', label: 'Customers', icon: '👥', bg: '#30B0C7', section: 'analytics' },
];

function Layout({ children }) {
  const { user, logout } = useAuth();
  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'WS';

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: '#000' }}>
      
      {/* SIDEBAR */}
      <div style={{ width: 210, background: '#000', display: 'flex', flexDirection: 'column', borderRight: '1px solid #1C1C1E', flexShrink: 0 }}>
        
        {/* Logo */}

        <div style={{ padding: '16px 16px 12px' }}>
          <Logo size={36} textSize={16} />
          <div style={{ fontSize: 8, color: '#3A3A3C', letterSpacing: 2, marginTop: 6 }}>WHOLESALER PORTAL</div>
        </div>
{/* 
        <div style={{ padding: '16px 16px 12px' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: -0.5 }}>
            Vendor<span style={{ color: '#F2C94C' }}>Net</span>
          </div>
          <div style={{ fontSize: 8, color: '#3A3A3C', letterSpacing: 2, marginTop: 1 }}>WHOLESALER PORTAL</div>
        </div> */}

        {/* Nav */}
        <div style={{ padding: '0 8px', flex: 1, overflowY: 'auto' }}>
          <div style={{ fontSize: 9, color: '#3A3A3C', padding: '0 8px', marginBottom: 4, letterSpacing: 1 }}>MAIN</div>
          {NAV_ITEMS.filter(n => n.section === 'main').map(item => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <div className="icon-badge" style={{ background: item.bg }}>{item.icon}</div>
              <span className="label">{item.label}</span>
            </NavLink>
          ))}

          <div style={{ fontSize: 9, color: '#3A3A3C', padding: '8px 8px 4px', letterSpacing: 1 }}>ANALYTICS</div>
          {NAV_ITEMS.filter(n => n.section === 'analytics').map(item => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <div className="icon-badge" style={{ background: item.bg }}>{item.icon}</div>
              <span className="label">{item.label}</span>
            </NavLink>
          ))}
        </div>

        {/* User */}
        <div style={{ padding: '10px 16px 14px', borderTop: '1px solid #1C1C1E' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#185FA5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', fontWeight: 700, flexShrink: 0 }}>
              {initials}
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#fff', fontWeight: 500 }}>{user?.name}</div>
              <div style={{ fontSize: 9, color: '#8E8E93' }}>Verified wholesaler</div>
            </div>
          </div>
          <div className="nav-link" onClick={logout} style={{ cursor: 'pointer' }}>
            <div className="icon-badge" style={{ background: '#3A3A3C' }}>⚙️</div>
            <span className="label">Settings & Logout</span>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#1C1C1E' }}>
        {children}
      </div>
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
          <Route path="/bulk-upload" element={<ProtectedRoute><BulkUpload /></ProtectedRoute>} />
          <Route path="/invoices" element={<ProtectedRoute><div style={{padding:24,color:'#8E8E93'}}>Invoices coming soon</div></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><div style={{padding:24,color:'#8E8E93'}}>Reports coming soon</div></ProtectedRoute>} />
          <Route path="/commission" element={<ProtectedRoute><div style={{padding:24,color:'#8E8E93'}}>Commission coming soon</div></ProtectedRoute>} />
          <Route path="/customers" element={<ProtectedRoute><div style={{padding:24,color:'#8E8E93'}}>Customers coming soon</div></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}