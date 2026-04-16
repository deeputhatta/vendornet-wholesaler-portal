import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [ordersRes, listingsRes] = await Promise.all([
        api.get('/orders/pending'),
        api.get('/listings/my')
      ]);
      const orders = ordersRes.data.sub_orders || [];
      const allListings = listingsRes.data.listings || [];
      setPendingOrders(orders);
      setListings(allListings);
      setStats({
        pending: orders.length,
        totalListings: allListings.length,
        lowStock: allListings.filter(l => l.stock_qty < 10).length,
        totalRevenue: orders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0)
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const acceptOrder = async (subOrderId) => {
    try {
      await api.put(`/orders/${subOrderId}/accept`);
      loadData();
    } catch (err) {
      alert('Failed to accept order');
    }
  };

  const rejectOrder = async (subOrderId) => {
    if (!confirm('Reject this order?')) return;
    try {
      await api.put(`/orders/${subOrderId}/reject`, { reason: 'Out of stock' });
      loadData();
    } catch (err) {
      alert('Failed to reject order');
    }
  };

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#8E8E93', fontSize: 14 }}>Loading...</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* TOP BAR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #2C2C2E', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Good morning, {user?.name?.split(' ')[0]} 👋</div>
          <div style={{ fontSize: 10, color: '#8E8E93', marginTop: 1 }}>{today}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ background: '#2C2C2E', borderRadius: 8, padding: '6px 10px', fontSize: 10, color: '#8E8E93', cursor: 'pointer' }}>🔔 {stats?.pending || 0}</div>
          <button className="btn-primary" onClick={() => window.location.href = '/bulk-upload'}>+ Upload listing</button>
        </div>
      </div>

      {/* SCROLLABLE CONTENT */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>

        {/* OFFER BANNER */}
        <div className="offer-banner" style={{ marginBottom: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ background: '#F2C94C', color: '#000', fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 6 }}>OFFER</span>
              <span style={{ fontSize: 9, color: '#378ADD' }}>Limited time</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2 }}>Zero commission this week on Cement listings!</div>
            <div style={{ fontSize: 10, color: '#7094B8' }}>Upload your price list now and get 0% platform fee on all cement orders.</div>
          </div>
          <button className="btn-primary" style={{ flexShrink: 0, marginLeft: 12 }}>Claim →</button>
        </div>

        {/* STAT CARDS */}
        <div className="stats-grid" style={{ marginBottom: 12 }}>
          <div className="card">
            <div className="stat-icon" style={{ background: '#0A1F35' }}>📦</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#0A84FF' }}>{stats?.pending || 0}</div>
            <div style={{ fontSize: 9, color: '#8E8E93', marginTop: 2 }}>Pending orders</div>
            <div style={{ fontSize: 9, color: '#30D158', marginTop: 2 }}>Action required</div>
          </div>
          <div className="card">
            <div className="stat-icon" style={{ background: '#0A2510' }}>🏷</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#30D158' }}>{stats?.totalListings || 0}</div>
            <div style={{ fontSize: 9, color: '#8E8E93', marginTop: 2 }}>Active listings</div>
            <div style={{ fontSize: 9, color: stats?.lowStock > 0 ? '#FF9500' : '#30D158', marginTop: 2 }}>
              {stats?.lowStock > 0 ? `${stats.lowStock} low stock` : 'All stocked'}
            </div>
          </div>
          <div className="card">
            <div className="stat-icon" style={{ background: '#2A1F00' }}>💰</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#F2C94C' }}>
              ₹{(stats?.totalRevenue || 0).toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: 9, color: '#8E8E93', marginTop: 2 }}>Pending revenue</div>
            <div style={{ fontSize: 9, color: '#30D158', marginTop: 2 }}>From active orders</div>
          </div>
          <div className="card">
            <div className="stat-icon" style={{ background: '#2A0A0A' }}>📋</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#FF453A' }}>1%</div>
            <div style={{ fontSize: 9, color: '#8E8E93', marginTop: 2 }}>Platform commission</div>
            <div style={{ fontSize: 9, color: '#FF9500', marginTop: 2 }}>Per invoice</div>
          </div>
        </div>

        {/* CHARTS ROW */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 8, marginBottom: 12 }}>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div className="section-title" style={{ marginBottom: 0 }}>Revenue trend</div>
              <button className="btn-ghost">View all</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
              {['Jan','Feb','Mar','Apr','May','Jun'].map((m, i) => {
                const heights = [38,52,44,68,78,100];
                const colors = ['#3A3A3C','#3A3A3C','#3A3A3C','#0A84FF','#F2C94C','#30D158'];
                const labelColors = ['#3A3A3C','#3A3A3C','#3A3A3C','#0A84FF','#F2C94C','#30D158'];
                return (
                  <div key={m} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                    <div style={{ width: '100%', height: heights[i] + '%', background: colors[i], borderRadius: '3px 3px 0 0' }}></div>
                    <div style={{ fontSize: 8, color: labelColors[i], marginTop: 3 }}>{m}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="card">
            <div className="section-title">Category split</div>
            {[
              { label: 'Cement', pct: 45, color: '#0A84FF' },
              { label: 'Steel / TMT', pct: 28, color: '#30D158' },
              { label: 'Paint', pct: 15, color: '#F2C94C' },
              { label: 'Others', pct: 12, color: '#5856D6' }
            ].map(c => (
              <div key={c.label} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
                  <span style={{ color: '#8E8E93' }}>{c.label}</span>
                  <span style={{ color: c.color, fontWeight: 600 }}>{c.pct}%</span>
                </div>
                <div className="bar-track"><div className="bar-fill" style={{ width: c.pct + '%', background: c.color }}></div></div>
              </div>
            ))}
          </div>
        </div>

        {/* PENDING ORDERS + TOP LISTINGS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 8, marginBottom: 12 }}>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div className="section-title" style={{ marginBottom: 0 }}>Pending orders</div>
              {pendingOrders.length > 0 && (
                <span style={{ background: '#FF3B30', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 8 }}>
                  {pendingOrders.length} urgent
                </span>
              )}
            </div>
            {pendingOrders.length === 0 ? (
              <div style={{ color: '#8E8E93', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>No pending orders</div>
            ) : (
              pendingOrders.slice(0, 3).map((order, i) => (
                <div key={order.sub_order_id} style={{ borderBottom: i < 2 ? '1px solid #3A3A3C' : 'none', paddingBottom: 8, marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <div style={{ fontSize: 11, color: '#fff', fontWeight: 500 }}>{order.retailer_name}</div>
                    <span className="chip chip-pending">Pending</span>
                  </div>
                  <div style={{ fontSize: 9, color: '#8E8E93' }}>₹{parseFloat(order.total_amount).toLocaleString('en-IN')}</div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                    <button onClick={() => acceptOrder(order.sub_order_id)} style={{ flex: 1, background: '#003A10', color: '#30D158', border: 'none', borderRadius: 6, padding: '4px 0', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Accept</button>
                    <button onClick={() => rejectOrder(order.sub_order_id)} style={{ background: '#2A0A0A', color: '#FF453A', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Reject</button>
                  </div>
                </div>
              ))
            )}
            <button className="btn-secondary" style={{ width: '100%', marginTop: 4 }} onClick={() => window.location.href = '/orders'}>View all orders →</button>
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div className="section-title" style={{ marginBottom: 0 }}>Top listings</div>
              <button className="btn-ghost" onClick={() => window.location.href = '/inventory'}>Manage</button>
            </div>
            {listings.length === 0 ? (
              <div style={{ color: '#8E8E93', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>No listings yet</div>
            ) : (
              listings.slice(0, 3).map((l, i) => (
                <div key={l.listing_id} style={{ borderBottom: i < 2 ? '1px solid #3A3A3C' : 'none', paddingBottom: 8, marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <div style={{ fontSize: 11, color: '#fff', fontWeight: 500 }}>{l.brand_name} {l.generic_name}</div>
                    <div style={{ fontSize: 11, color: '#0A84FF', fontWeight: 600 }}>₹{l.price}</div>
                  </div>
                  <div className="bar-track" style={{ marginBottom: 3 }}>
                    <div className="bar-fill" style={{ width: Math.min(100, (l.stock_qty / 500) * 100) + '%', background: l.stock_qty < 10 ? '#FF9500' : '#30D158' }}></div>
                  </div>
                  <div style={{ fontSize: 9, color: l.stock_qty < 10 ? '#FF9500' : '#8E8E93' }}>Stock: {l.stock_qty} · MOQ: {l.min_order_qty}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* QUICK ACTIONS */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="section-title">Quick actions</div>
          <div className="quick-grid">
            <button onClick={() => window.location.href='/bulk-upload'} style={{ background: '#0A1F35', border: '1px solid #185FA5', color: '#0A84FF', borderRadius: 10, padding: 10, fontSize: 10, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>📤</div>Bulk upload price list
            </button>
            <button onClick={() => window.location.href='/orders'} style={{ background: '#0A2510', border: '1px solid #1D9E75', color: '#30D158', borderRadius: 10, padding: 10, fontSize: 10, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>✓</div>Accept pending orders
            </button>
            <button onClick={() => window.location.href='/inventory'} style={{ background: '#2A1F00', border: '1px solid #BA7517', color: '#F2C94C', borderRadius: 10, padding: 10, fontSize: 10, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>🏷</div>Update stock levels
            </button>
            <button onClick={() => window.location.href='/invoices'} style={{ background: '#2A0A1A', border: '1px solid #993556', color: '#FF2D55', borderRadius: 10, padding: 10, fontSize: 10, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>🧾</div>Upload invoice
            </button>
          </div>
        </div>

        {/* LOW STOCK BANNER */}
        {stats?.lowStock > 0 && (
          <div className="alert-banner alert-warning">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 20 }}>⚠️</div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#FF9500' }}>Low stock warning — {stats.lowStock} products</div>
                <div style={{ fontSize: 9, color: '#854F0B', marginTop: 1 }}>Update your stock levels to avoid missing orders</div>
              </div>
            </div>
            <button onClick={() => window.location.href='/inventory'} style={{ background: '#FF9500', color: '#000', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 10, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>Update stock</button>
          </div>
        )}

      </div>
    </div>
  );
}