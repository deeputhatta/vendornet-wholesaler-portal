import { useState, useEffect } from 'react';
import api from '../services/api';

const STATUS = {
  pending: { label: 'Pending', class: 'chip-pending' },
  accepted: { label: 'Accepted', class: 'chip-accepted' },
  rejected: { label: 'Rejected', class: 'chip-rejected' },
  dispatched: { label: 'Dispatched', class: 'chip-dispatched' },
  delivered: { label: 'Delivered', class: 'chip-delivered' },
  packing: { label: 'Packing', class: 'chip-dispatched' },
};

export default function Orders() {
  const [subOrders, setSubOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');

  useEffect(() => { loadOrders(); }, []);

  const loadOrders = async () => {
    try {
      const res = await api.get('/orders/pending');
      setSubOrders(res.data.sub_orders || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const acceptOrder = async (subOrderId) => {
    try {
      await api.put(`/orders/${subOrderId}/accept`);
      loadOrders();
    } catch (err) {
      alert('Failed to accept order');
    }
  };

  const rejectOrder = async (subOrderId) => {
    if (!confirm('Reject this order?')) return;
    try {
      await api.put(`/orders/${subOrderId}/reject`, { reason: 'Out of stock' });
      loadOrders();
    } catch (err) {
      alert('Failed to reject');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* TOP BAR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #2C2C2E', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Orders</div>
          <div style={{ fontSize: 10, color: '#8E8E93', marginTop: 1 }}>{subOrders.length} pending orders</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn-secondary" onClick={loadOrders}>↻ Refresh</button>
        </div>
      </div>

      {/* FILTER TABS */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 16px', borderBottom: '1px solid #2C2C2E', flexShrink: 0 }}>
        {['pending', 'accepted', 'all'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            background: filter === f ? '#185FA5' : '#2C2C2E',
            color: filter === f ? '#fff' : '#8E8E93',
            border: 'none', borderRadius: 8, padding: '6px 14px',
            fontSize: 11, fontWeight: 500, cursor: 'pointer',
            textTransform: 'capitalize'
          }}>
            {f === 'all' ? 'All orders' : f}
          </button>
        ))}
      </div>

      {/* ORDER LIST */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {loading ? (
          <div style={{ color: '#8E8E93', textAlign: 'center', padding: 40 }}>Loading...</div>
        ) : subOrders.length === 0 ? (
          <div style={{ color: '#8E8E93', textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
            <div>No pending orders</div>
          </div>
        ) : (
          subOrders.map(order => (
            <div key={order.sub_order_id} className="card" style={{ marginBottom: 10 }}>

              {/* Order header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{order.retailer_name}</div>
                  <div style={{ fontSize: 10, color: '#0A84FF', marginTop: 1 }}>{order.retailer_mobile}</div>
                  <div style={{ fontSize: 10, color: '#8E8E93', marginTop: 1 }}>{order.retailer_address}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#F2C94C' }}>
                    ₹{parseFloat(order.total_amount).toLocaleString('en-IN')}
                  </div>
                  <div style={{ fontSize: 9, color: '#FF453A', marginTop: 2 }}>
                    Auto-cancels {new Date(order.auto_cancel_at).toLocaleTimeString('en-IN')}
                  </div>
                </div>
              </div>

              {/* Items */}
              <div style={{ background: '#3A3A3C', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                {order.items?.map(item => (
                  <div key={item.item_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #2C2C2E', fontSize: 11 }}>
                    <span style={{ color: '#fff' }}>{item.generic_name} — {item.brand_name}</span>
                    <span style={{ color: '#8E8E93' }}>×{item.quantity} · ₹{item.unit_price}</span>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => acceptOrder(order.sub_order_id)} style={{ flex: 1, background: '#003A10', color: '#30D158', border: '1px solid #1D9E75', borderRadius: 8, padding: '9px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  ✓ Accept Order
                </button>
                <button onClick={() => rejectOrder(order.sub_order_id)} style={{ background: '#2A0A0A', color: '#FF453A', border: '1px solid #FF453A', borderRadius: 8, padding: '9px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  ✗ Reject
                </button>
                <button onClick={() => window.location.href='/bulk-upload'} style={{ background: '#0A1F35', color: '#0A84FF', border: '1px solid #185FA5', borderRadius: 8, padding: '9px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  🚚 Assign
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}