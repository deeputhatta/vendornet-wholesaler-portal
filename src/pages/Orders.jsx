import { useState, useEffect } from 'react';
import api from '../services/api';

const STATUS_COLORS = {
  pending: { bg: '#FAEEDA', text: '#633806' },
  accepted: { bg: '#EAF3DE', text: '#27500A' },
  packing: { bg: '#E6F1FB', text: '#0C447C' },
  dispatched: { bg: '#E6F1FB', text: '#0C447C' },
  delivered: { bg: '#EAF3DE', text: '#27500A' },
  invoice_uploaded: { bg: '#EAF3DE', text: '#27500A' },
  rejected: { bg: '#FCEBEB', text: '#791F1F' },
  auto_cancelled: { bg: '#FCEBEB', text: '#791F1F' }
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [driverMobile, setDriverMobile] = useState({});
  const [vehicleNo, setVehicleNo] = useState({});

  useEffect(() => { loadOrders(); }, []);

  const loadOrders = async () => {
    try {
      const res = await api.get('/orders/pending');
      setOrders(res.data.sub_orders);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const acceptOrder = async (id) => {
    try {
      await api.put(`/orders/${id}/accept`);
      loadOrders();
    } catch (err) {
      alert('Failed to accept');
    }
  };

  const rejectOrder = async (id) => {
    if (!confirm('Reject this order?')) return;
    try {
      await api.put(`/orders/${id}/reject`, { reason: 'Out of stock' });
      loadOrders();
    } catch (err) {
      alert('Failed to reject');
    }
  };

  const assignDriver = async (subOrderId) => {
    const mobile = driverMobile[subOrderId];
    const vehicle = vehicleNo[subOrderId];
    if (!mobile || !vehicle) {
      alert('Enter driver mobile and vehicle number');
      return;
    }
    try {
      const driverRes = await api.get(`/users/by-mobile/${mobile}`);
      await api.post('/delivery/assign', {
        sub_order_id: subOrderId,
        driver_id: driverRes.data.user.user_id,
        vehicle_number: vehicle,
        vehicle_type: 'Mini truck'
      });
      alert('Driver assigned successfully');
      loadOrders();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to assign driver');
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <div style={styles.header}>
        <h2 style={styles.title}>Orders</h2>
        <div style={styles.filters}>
          {['pending', 'accepted', 'dispatched', 'delivered'].map(s => (
            <button key={s}
              style={{ ...styles.filterBtn, background: filter === s ? '#0F6E56' : '#fff', color: filter === s ? '#fff' : '#333' }}
              onClick={() => setFilter(s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {orders.length === 0 ? (
        <div style={styles.empty}>
          <p>No {filter} orders</p>
        </div>
      ) : (
        orders.map(order => (
          <div key={order.sub_order_id} style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <p style={styles.retailer}>{order.retailer_name} — {order.retailer_mobile}</p>
                <p style={styles.address}>{order.retailer_address}</p>
              </div>
              <div style={styles.cardRight}>
                <p style={styles.amount}>₹{parseFloat(order.total_amount).toLocaleString('en-IN')}</p>
                <span style={{ background: STATUS_COLORS[order.status]?.bg, color: STATUS_COLORS[order.status]?.text, padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                  {order.status.replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            {order.items?.map(item => (
              <div key={item.item_id} style={styles.itemRow}>
                <span>{item.generic_name} — {item.brand_name}</span>
                <span style={{ color: '#666' }}>Qty: {item.quantity} × ₹{item.unit_price} = ₹{(item.quantity * item.unit_price).toLocaleString('en-IN')}</span>
              </div>
            ))}

            {order.status === 'pending' && (
              <div style={styles.actions}>
                <button style={styles.acceptBtn} onClick={() => acceptOrder(order.sub_order_id)}>✓ Accept</button>
                <button style={styles.rejectBtn} onClick={() => rejectOrder(order.sub_order_id)}>✗ Reject</button>
              </div>
            )}

            {order.status === 'accepted' && (
              <div style={styles.assignBox}>
                <p style={styles.assignTitle}>Assign Driver</p>
                <div style={styles.assignRow}>
                  <input style={styles.assignInput} placeholder="Driver mobile"
                    value={driverMobile[order.sub_order_id] || ''}
                    onChange={e => setDriverMobile(prev => ({ ...prev, [order.sub_order_id]: e.target.value }))} />
                  <input style={styles.assignInput} placeholder="Vehicle number"
                    value={vehicleNo[order.sub_order_id] || ''}
                    onChange={e => setVehicleNo(prev => ({ ...prev, [order.sub_order_id]: e.target.value }))} />
                  <button style={styles.assignBtn} onClick={() => assignDriver(order.sub_order_id)}>
                    Assign
                  </button>
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

const styles = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
  title: { fontSize: 22, fontWeight: 600, color: '#333', margin: 0 },
  filters: { display: 'flex', gap: 6 },
  filterBtn: { border: '1px solid #ddd', borderRadius: 20, padding: '6px 14px', fontSize: 13, cursor: 'pointer', fontWeight: 500 },
  empty: { background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', color: '#888' },
  card: { background: '#fff', borderRadius: 12, padding: 20, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: 12 },
  retailer: { fontSize: 15, fontWeight: 600, margin: '0 0 4px' },
  address: { fontSize: 12, color: '#888', margin: 0 },
  cardRight: { textAlign: 'right' },
  amount: { fontSize: 20, fontWeight: 700, color: '#0F6E56', margin: '0 0 6px' },
  itemRow: { display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #f0f0f0', fontSize: 14 },
  actions: { display: 'flex', gap: 10, marginTop: 14 },
  acceptBtn: { flex: 1, background: '#0F6E56', color: '#fff', border: 'none', borderRadius: 8, padding: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  rejectBtn: { background: '#FCEBEB', color: '#791F1F', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  assignBox: { marginTop: 14, padding: 14, background: '#f9f9f9', borderRadius: 8 },
  assignTitle: { fontSize: 13, fontWeight: 600, color: '#333', margin: '0 0 8px' },
  assignRow: { display: 'flex', gap: 8 },
  assignInput: { flex: 1, border: '1px solid #ddd', borderRadius: 6, padding: '8px 10px', fontSize: 13, outline: 'none' },
  assignBtn: { background: '#0F6E56', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
};