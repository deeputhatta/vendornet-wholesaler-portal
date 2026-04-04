import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [pendingOrders, setPendingOrders] = useState([]);
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
      const listings = listingsRes.data.listings || [];

      setPendingOrders(orders);
      setStats({
        pending: orders.length,
        totalListings: listings.length,
        lowStock: listings.filter(l => l.stock_qty < 10).length,
        totalRevenue: orders.reduce((sum, o) => sum + parseFloat(o.total_amount), 0)
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

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h2 style={styles.title}>Welcome, {user?.name}</h2>

      <div style={styles.statsGrid}>
        <StatCard label="Pending Orders" value={stats.pending} color="#854F0B" bg="#FAEEDA" />
        <StatCard label="Active Listings" value={stats.totalListings} color="#0F6E56" bg="#EAF3DE" />
        <StatCard label="Low Stock Items" value={stats.lowStock} color="#791F1F" bg="#FCEBEB" />
        <StatCard label="Pending Revenue" value={`₹${stats.totalRevenue.toLocaleString('en-IN')}`} color="#0C447C" bg="#E6F1FB" />
      </div>

      {pendingOrders.length > 0 && (
        <>
          <h3 style={styles.sectionTitle}>Pending Orders — Action Required</h3>
          {pendingOrders.map(order => (
            <div key={order.sub_order_id} style={styles.orderCard}>
              <div style={styles.orderHeader}>
                <div>
                  <p style={styles.retailerName}>{order.retailer_name}</p>
                  <p style={styles.retailerMobile}>{order.retailer_mobile}</p>
                  <p style={styles.address}>{order.retailer_address}</p>
                </div>
                <div style={styles.orderRight}>
                  <p style={styles.amount}>₹{parseFloat(order.total_amount).toLocaleString('en-IN')}</p>
                  <p style={styles.autoCancel}>
                    Cancels at {new Date(order.auto_cancel_at).toLocaleTimeString('en-IN')}
                  </p>
                </div>
              </div>
              {order.items?.map(item => (
                <div key={item.item_id} style={styles.itemRow}>
                  <span>{item.generic_name} — {item.brand_name}</span>
                  <span style={styles.itemQty}>Qty: {item.quantity} × ₹{item.unit_price}</span>
                </div>
              ))}
              <div style={styles.actions}>
                <button style={styles.acceptBtn} onClick={() => acceptOrder(order.sub_order_id)}>
                  ✓ Accept Order
                </button>
                <button style={styles.rejectBtn} onClick={() => rejectOrder(order.sub_order_id)}>
                  ✗ Reject
                </button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, color, bg }) {
  return (
    <div style={{ ...styles.statCard, background: bg, borderLeft: `4px solid ${color}` }}>
      <p style={styles.statLabel}>{label}</p>
      <p style={{ ...styles.statValue, color }}>{value}</p>
    </div>
  );
}

const styles = {
  title: { fontSize: 22, fontWeight: 600, color: '#333', marginBottom: 20 },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 28 },
  statCard: { borderRadius: 12, padding: 20 },
  statLabel: { fontSize: 13, color: '#666', margin: '0 0 8px' },
  statValue: { fontSize: 28, fontWeight: 700, margin: 0 },
  sectionTitle: { fontSize: 16, fontWeight: 600, color: '#333', marginBottom: 12 },
  orderCard: { background: '#fff', borderRadius: 12, padding: 20, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  orderHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: 12 },
  retailerName: { fontSize: 16, fontWeight: 600, margin: '0 0 2px' },
  retailerMobile: { fontSize: 13, color: '#0F6E56', margin: '0 0 2px' },
  address: { fontSize: 12, color: '#888', margin: 0 },
  orderRight: { textAlign: 'right' },
  amount: { fontSize: 22, fontWeight: 700, color: '#0F6E56', margin: '0 0 4px' },
  autoCancel: { fontSize: 11, color: '#E24B4A', margin: 0 },
  itemRow: { display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #f0f0f0', fontSize: 14 },
  itemQty: { color: '#666' },
  actions: { display: 'flex', gap: 10, marginTop: 14 },
  acceptBtn: { flex: 1, background: '#0F6E56', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  rejectBtn: { background: '#FCEBEB', color: '#791F1F', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }
};