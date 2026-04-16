import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Reports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Check permission
  const canView = user?.role === 'wholesaler_admin' || user?.permissions?.view_analytics;

  useEffect(() => {
    if (!canView) { setLoading(false); return; }
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersRes, listingsRes] = await Promise.all([
        api.get('/orders/wholesaler/all'),
        api.get('/listings/my').catch(() => ({ data: { listings: [] } })),
      ]);
      const orders = ordersRes.data.sub_orders || [];
      const listings = listingsRes.data.listings || [];

      // Revenue by status
      const delivered = orders.filter(o => ['delivered', 'completed', 'invoice_uploaded'].includes(o.status));
      const totalRevenue = delivered.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0);
      const pendingRevenue = orders
        .filter(o => ['pending', 'accepted', 'packing', 'dispatched'].includes(o.status))
        .reduce((s, o) => s + parseFloat(o.total_amount || 0), 0);

      // Orders by status count
      const statusCount = orders.reduce((acc, o) => {
        acc[o.status] = (acc[o.status] || 0) + 1;
        return acc;
      }, {});

      // Orders last 7 days
      const dayMap = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        dayMap[key] = 0;
      }
      orders.forEach(o => {
        const key = new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        if (dayMap[key] !== undefined) dayMap[key]++;
      });

      // Top listings by stock value
      const topListings = [...listings]
        .filter(l => l.stock_qty > 0 && l.price)
        .sort((a, b) => (b.stock_qty * parseFloat(b.price)) - (a.stock_qty * parseFloat(a.price)))
        .slice(0, 5);

      setData({ orders, listings, totalRevenue, pendingRevenue, statusCount, dayMap, topListings, delivered });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (!canView) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <div style={{ fontSize: 36 }}>🔒</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Access Restricted</div>
      <div style={{ fontSize: 12, color: '#8E8E93' }}>You don't have permission to view analytics</div>
    </div>
  );

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#8E8E93' }}>Loading...</div>
    </div>
  );

  const maxDay = Math.max(...Object.values(data.dayMap), 1);

  const STATUS_LABELS = {
    pending: 'Pending', accepted: 'Accepted', packing: 'Packing',
    dispatched: 'Dispatched', delivered: 'Delivered', completed: 'Completed',
    invoice_uploaded: 'Invoiced', rejected: 'Rejected', auto_cancelled: 'Cancelled',
  };
  const STATUS_COLORS = {
    pending: '#FF9500', accepted: '#30D158', packing: '#0A84FF',
    dispatched: '#F2C94C', delivered: '#30D158', completed: '#30D158',
    invoice_uploaded: '#30D158', rejected: '#FF453A', auto_cancelled: '#FF453A',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #2C2C2E', flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Reports</div>
        <div style={{ fontSize: 10, color: '#8E8E93', marginTop: 1 }}>Business overview</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>

        {/* Revenue cards */}
        <div className="stats-grid" style={{ marginBottom: 12 }}>
          <div className="card">
            <div className="stat-icon" style={{ background: '#003A10' }}>💰</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#30D158' }}>₹{data.totalRevenue.toLocaleString('en-IN')}</div>
            <div style={{ fontSize: 9, color: '#8E8E93', marginTop: 2 }}>Total revenue</div>
          </div>
          <div className="card">
            <div className="stat-icon" style={{ background: '#2A1F00' }}>⏳</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#F2C94C' }}>₹{data.pendingRevenue.toLocaleString('en-IN')}</div>
            <div style={{ fontSize: 9, color: '#8E8E93', marginTop: 2 }}>Pending revenue</div>
          </div>
          <div className="card">
            <div className="stat-icon" style={{ background: '#0A1F35' }}>📦</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0A84FF' }}>{data.orders.length}</div>
            <div style={{ fontSize: 9, color: '#8E8E93', marginTop: 2 }}>Total orders</div>
          </div>
          <div className="card">
            <div className="stat-icon" style={{ background: '#0A2510' }}>🏷</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#30D158' }}>{data.listings.length}</div>
            <div style={{ fontSize: 9, color: '#8E8E93', marginTop: 2 }}>Active listings</div>
          </div>
        </div>

        {/* Orders last 7 days */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="section-title">Orders — last 7 days</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
            {Object.entries(data.dayMap).map(([day, count]) => (
              <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: 9, color: '#0A84FF', marginBottom: 2, fontWeight: 600 }}>{count > 0 ? count : ''}</div>
                <div style={{ width: '100%', height: Math.max(4, (count / maxDay) * 64), background: count > 0 ? '#185FA5' : '#3A3A3C', borderRadius: '3px 3px 0 0', transition: 'height 0.3s' }} />
                <div style={{ fontSize: 8, color: '#636366', marginTop: 4 }}>{day}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Order status breakdown */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="section-title">Orders by status</div>
          {Object.entries(data.statusCount).map(([status, count]) => {
            const pct = Math.round((count / data.orders.length) * 100);
            return (
              <div key={status} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                  <span style={{ color: '#8E8E93' }}>{STATUS_LABELS[status] || status}</span>
                  <span style={{ color: STATUS_COLORS[status] || '#fff', fontWeight: 600 }}>{count} ({pct}%)</span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: pct + '%', background: STATUS_COLORS[status] || '#185FA5' }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Top listings by inventory value */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="section-title">Top listings by inventory value</div>
          {data.topListings.map((l, i) => {
            const value = l.stock_qty * parseFloat(l.price);
            const maxValue = data.topListings.length > 0 
              ? data.topListings[0].stock_qty * parseFloat(data.topListings[0].price) 
              : 1;
            return (
              <div key={l.listing_id} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                  <span style={{ color: '#fff' }}>{l.brand_name} {l.generic_name}</span>
                  <span style={{ color: '#F2C94C', fontWeight: 600 }}>₹{value.toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="bar-track" style={{ flex: 1 }}>
                    <div className="bar-fill" style={{ width: (value / maxValue * 100) + '%', background: ['#0A84FF','#30D158','#F2C94C','#FF9500','#BF5AF2'][i] }} />
                  </div>
                  <span style={{ fontSize: 9, color: '#8E8E93', flexShrink: 0 }}>Stock: {l.stock_qty}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent delivered orders */}
        <div className="card">
          <div className="section-title">Recent completed orders</div>
          {data.delivered.length === 0 ? (
            <div style={{ color: '#8E8E93', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>No completed orders yet</div>
          ) : (
            data.delivered.slice(0, 5).map(o => (
              <div key={o.sub_order_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #2C2C2E', fontSize: 12 }}>
                <div>
                  <div style={{ color: '#fff', fontWeight: 500 }}>{o.retailer_name}</div>
                  <div style={{ color: '#8E8E93', fontSize: 10 }}>{new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                </div>
                <div style={{ color: '#30D158', fontWeight: 700 }}>₹{parseFloat(o.total_amount).toLocaleString('en-IN')}</div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
