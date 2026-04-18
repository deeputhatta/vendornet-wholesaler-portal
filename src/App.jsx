import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Logo from './components/Logo';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Inventory from './pages/Inventory';
import BulkUpload from './pages/BulkUpload';
import Invoices from './pages/Invoices';
import Staff from './pages/Staff';
import Reports from './pages/Reports';
import RequestProduct from './pages/RequestProduct';
import { useState, useEffect } from 'react';

// Each nav item has a required permission.
// null = always visible. For admin all items shown regardless.
const NAV_ITEMS = [
  { to: '/',                label: 'Dashboard',       icon: '📊', bg: '#185FA5', section: 'main',      perm: null },
  { to: '/orders',          label: 'Orders',           icon: '📦', bg: '#FF9500', section: 'main',      perm: 'view_orders' },
  { to: '/inventory',       label: 'Inventory',        icon: '🏷', bg: '#34C759', section: 'main',      perm: 'manage_listings' },
  { to: '/bulk-upload',     label: 'Bulk Upload',      icon: '📤', bg: '#5856D6', section: 'main',      perm: 'manage_listings' },
  { to: '/request-product', label: 'Request Product',  icon: '🆕', bg: '#BF5AF2', section: 'main',      perm: 'manage_listings' },
  { to: '/invoices',        label: 'Invoices',         icon: '🧾', bg: '#FF2D55', section: 'main',      perm: 'upload_invoice' },
  { to: '/staff',           label: 'Staff',            icon: '👥', bg: '#30B0C7', section: 'main',      perm: 'manage_staff' },
  { to: '/reports',         label: 'Reports',          icon: '📈', bg: '#64D2FF', section: 'analytics', perm: 'view_orders' },
];

function usePermissions() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'wholesaler_admin';
  const can = (perm) => {
    if (!perm) return true;
    if (isAdmin) return true;
    return user?.permissions?.[perm] === true;
  };
  return { isAdmin, can };
}

function Layout({ children }) {
  const { user, logout } = useAuth();
  const { isAdmin, can } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'WS';
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const NAV_MAIN = NAV_ITEMS.filter(n => n.section === 'main' && can(n.perm));
  const NAV_ANALYTICS = NAV_ITEMS.filter(n => n.section === 'analytics' && can(n.perm));

  const SidebarContent = () => (
    <>
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #1C1C1E' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Logo size={36} textSize={16} />
          {isMobile && (
            <button onClick={() => setSidebarOpen(false)}
              style={{ background: 'none', border: 'none', color: '#8E8E93', fontSize: 20, cursor: 'pointer' }}>✕</button>
          )}
        </div>
        <div style={{ fontSize: 8, color: '#636366', letterSpacing: 2, marginTop: 6 }}>WHOLESALER PORTAL</div>
        {!isAdmin && (
          <div style={{ fontSize: 9, color: '#F2C94C', marginTop: 4, background: '#2A1F00', borderRadius: 4, padding: '2px 6px', display: 'inline-block' }}>
            Staff Account
          </div>
        )}
      </div>

      <div style={{ padding: '8px 8px', flex: 1, overflowY: 'auto' }}>
        <div style={{ fontSize: 9, color: '#636366', padding: '4px 8px', marginBottom: 4, letterSpacing: 1 }}>MAIN</div>
        {NAV_MAIN.map(item => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <div className="icon-badge" style={{ background: item.bg }}>{item.icon}</div>
            <span className="label">{item.label}</span>
          </NavLink>
        ))}

        {NAV_ANALYTICS.length > 0 && (
          <>
            <div style={{ fontSize: 9, color: '#636366', padding: '8px 8px 4px', letterSpacing: 1 }}>ANALYTICS</div>
            {NAV_ANALYTICS.map(item => (
              <NavLink key={item.to} to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                <div className="icon-badge" style={{ background: item.bg }}>{item.icon}</div>
                <span className="label">{item.label}</span>
              </NavLink>
            ))}
          </>
        )}
      </div>

      <div style={{ padding: '10px 16px 14px', borderTop: '1px solid #1C1C1E' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#185FA5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', fontWeight: 700, flexShrink: 0 }}>
            {initials}
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#fff', fontWeight: 500 }}>{user?.name}</div>
            <div style={{ fontSize: 9, color: '#8E8E93' }}>{isAdmin ? 'Admin' : 'Staff'}</div>
          </div>
        </div>
        <div className="nav-link" onClick={() => { logout(); setSidebarOpen(false); }} style={{ cursor: 'pointer' }}>
          <div className="icon-badge" style={{ background: '#3A3A3C' }}>⚙️</div>
          <span className="label">Settings & Logout</span>
        </div>
      </div>
    </>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: '#000' }}>
      {!isMobile && (
        <div style={{ width: 210, background: '#000', display: 'flex', flexDirection: 'column', borderRight: '1px solid #1C1C1E', flexShrink: 0 }}>
          <SidebarContent />
        </div>
      )}

      {isMobile && sidebarOpen && (
        <>
          <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50 }} />
          <div style={{ position: 'fixed', left: 0, top: 0, bottom: 0, width: 260, background: '#000', display: 'flex', flexDirection: 'column', zIndex: 51, borderRight: '1px solid #1C1C1E' }}>
            <SidebarContent />
          </div>
        </>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#1C1C1E' }}>
        {isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #2C2C2E', background: '#000', flexShrink: 0 }}>
            <button onClick={() => setSidebarOpen(true)} style={{ background: '#2C2C2E', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 10px', fontSize: 16, cursor: 'pointer' }}>☰</button>
            <Logo size={28} textSize={14} />
            <div style={{ width: 36 }} />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

// Guards a route — redirects if staff lacks required permission
function ProtectedRoute({ children, perm }) {
  const { user, loading } = useAuth();
  const { isAdmin, can } = usePermissions();
  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  if (!user.role?.includes('wholesaler')) return <Navigate to="/login" />;
  if (perm && !can(perm)) return <Navigate to="/" />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/"                element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/orders"          element={<ProtectedRoute perm="view_orders"><Orders /></ProtectedRoute>} />
          <Route path="/inventory"       element={<ProtectedRoute perm="manage_listings"><Inventory /></ProtectedRoute>} />
          <Route path="/bulk-upload"     element={<ProtectedRoute perm="manage_listings"><BulkUpload /></ProtectedRoute>} />
          <Route path="/request-product" element={<ProtectedRoute perm="manage_listings"><RequestProduct /></ProtectedRoute>} />
          <Route path="/invoices"        element={<ProtectedRoute perm="upload_invoice"><Invoices /></ProtectedRoute>} />
          <Route path="/staff"           element={<ProtectedRoute perm="manage_staff"><Staff /></ProtectedRoute>} />
          <Route path="/reports"         element={<ProtectedRoute perm="view_orders"><Reports /></ProtectedRoute>} />
          <Route path="*"                element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
