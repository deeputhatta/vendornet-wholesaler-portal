import { useState, useEffect } from 'react';
import api from '../services/api';

const STATUS_CONFIG = {
  pending:          { label: 'Pending',    chip: 'chip-pending',    next: 'accepted',   nextLabel: '✓ Accept' },
  accepted:         { label: 'Accepted',   chip: 'chip-accepted',   next: 'packing',    nextLabel: '📦 Start Packing' },
  packing:          { label: 'Packing',    chip: 'chip-dispatched', next: 'dispatched', nextLabel: '🚚 Mark Dispatched' },
  dispatched:       { label: 'Dispatched', chip: 'chip-dispatched', next: null,         nextLabel: null },
  delivered:        { label: 'Delivered',  chip: 'chip-delivered',  next: null,         nextLabel: null },
  completed:        { label: 'Completed',  chip: 'chip-delivered',  next: null,         nextLabel: null },
  invoice_uploaded: { label: 'Invoiced',   chip: 'chip-delivered',  next: null,         nextLabel: null },
  rejected:         { label: 'Rejected',   chip: 'chip-rejected',   next: null,         nextLabel: null },
  auto_cancelled:   { label: 'Cancelled',  chip: 'chip-rejected',   next: null,         nextLabel: null },
};

const FILTERS = ['pending', 'accepted', 'packing', 'dispatched', 'delivered', 'all'];

export default function Orders() {
  const [subOrders, setSubOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [updating, setUpdating] = useState(null);
  const [expanded, setExpanded] = useState({});

  useEffect(() => { loadOrders(); }, []);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get('/orders/my');
      setSubOrders(res.data.sub_orders || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (subOrderId, status) => {
    setUpdating(subOrderId);
    try {
      if (status === 'accepted') await api.put(`/orders/${subOrderId}/accept`);
      else await api.put(`/orders/${subOrderId}/status`, { status });
      await loadOrders();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update status');
    } finally {
      setUpdating(null); }
  };

  const rejectOrder = async (subOrderId) => {
    const reason = prompt('Rejection reason (optional):') ?? '';
    if (reason === null) return;
    setUpdating(subOrderId);
    try {
      await api.put(`/orders/${subOrderId}/reject`, { reason: reason || 'Rejected by wholesaler' });
      await loadOrders();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reject');
    } finally { setUpdating(null); }
  };

  const filtered = subOrders.filter(o => {
    if (filter === 'all') return true;
    return o.status === filter;
  });

  // Group by date
  const grouped = filtered.reduce((acc, o) => {
    const d = new Date(o.created_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    let label;
    if (d.toDateString() === today.toDateString()) label = 'Today';
    else if (d.toDateString() === yesterday.toDateString()) label = 'Yesterday';
    else label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    if (!acc[label]) acc[label] = [];
    acc[label].push(o);
    return acc;
  }, {});

  const pendingCount = subOrders.filter(o => o.status === 'pending').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* TOP BAR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #2C2C2E', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Orders</div>
          <div style={{ fontSize: 10, color: '#8E8E93', marginTop: 1 }}>
            {subOrders.length} total
            {pendingCount > 0 && <span style={{ color: '#FF9500', marginLeft: 6 }}>· {pendingCount} pending action</span>}
          </div>
        </div>
        <button className="btn-secondary" onClick={loadOrders}>↻ Refresh</button>
      </div>

      {/* FILTER TABS */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 16px', borderBottom: '1px solid #2C2C2E', flexShrink: 0, overflowX: 'auto' }}>
        {FILTERS.map(f => {
          const count = f === 'all' ? subOrders.length : subOrders.filter(o => o.status === f).length;
          return (
            <button key={f} onClick={() => setFilter(f)} style={{
              background: filter === f ? '#185FA5' : '#2C2C2E',
              color: filter === f ? '#fff' : '#8E8E93',
              border: 'none', borderRadius: 8, padding: '6px 14px',
              fontSize: 11, fontWeight: 500, cursor: 'pointer',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              {f === 'all' ? 'All' : STATUS_CONFIG[f]?.label || f}
              {count > 0 && <span style={{ marginLeft: 5, background: filter === f ? 'rgba(255,255,255,0.2)' : '#3A3A3C', borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* ORDER LIST */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {loading ? (
          <div style={{ color: '#8E8E93', textAlign: 'center', padding: 40 }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ color: '#8E8E93', textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
            <div>No {filter === 'all' ? '' : filter} orders</div>
          </div>
        ) : (
          Object.entries(grouped).map(([dateLabel, orders]) => (
            <div key={dateLabel}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#636366', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 4 }}>{dateLabel}</div>
              {orders.map(order => {
                const cfg = STATUS_CONFIG[order.status] || { label: order.status, chip: 'chip-pending' };
                const isExpanded = expanded[order.sub_order_id];
                const isUpdating = updating === order.sub_order_id;

                return (
                  <div key={order.sub_order_id} className="card" style={{ marginBottom: 10 }}>
                    {/* Order header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{order.retailer_name}</div>
                        <div style={{ fontSize: 10, color: '#0A84FF', marginTop: 1 }}>{order.retailer_mobile}</div>
                        {order.retailer_address && <div style={{ fontSize: 10, color: '#8E8E93', marginTop: 1 }}>{order.retailer_address}</div>}
                        {order.auto_cancel_at && order.status === 'pending' && (
                          <div style={{ fontSize: 9, color: '#FF453A', marginTop: 2 }}>
                            ⏱ Auto-cancels {new Date(order.auto_cancel_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#F2C94C' }}>
                          ₹{parseFloat(order.total_amount).toLocaleString('en-IN')}
                        </div>
                        <span className={`chip ${cfg.chip}`}>{cfg.label}</span>
                      </div>
                    </div>

                    {/* Items toggle */}
                    <button onClick={() => setExpanded(p => ({ ...p, [order.sub_order_id]: !p[order.sub_order_id] }))}
                      style={{ background: '#3A3A3C', border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: 11, color: '#8E8E93', cursor: 'pointer', width: '100%', textAlign: 'left', marginBottom: 8 }}>
                      {isExpanded ? '▲' : '▼'} {order.items?.length || 0} item{order.items?.length !== 1 ? 's' : ''}
                    </button>

                    {/* Items */}
                    {isExpanded && order.items?.length > 0 && (
                      <div style={{ background: '#3A3A3C', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                        {order.items.map(item => (
                          <div key={item.item_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #2C2C2E', fontSize: 11 }}>
                            <div>
                              <div style={{ color: '#fff', fontWeight: 500 }}>{item.generic_name}</div>
                              <div style={{ color: '#0A84FF', fontSize: 10 }}>{item.brand_name}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ color: '#8E8E93' }}>×{item.quantity} · ₹{item.unit_price}</div>
                              <div style={{ color: '#F2C94C', fontWeight: 600 }}>₹{parseFloat(item.item_total).toLocaleString('en-IN')}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      {cfg.next && (
                        <button
                          onClick={() => updateStatus(order.sub_order_id, cfg.next)}
                          disabled={isUpdating}
                          style={{ flex: 1, background: '#003A10', color: '#30D158', border: '1px solid #1D9E75', borderRadius: 8, padding: '9px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                          {isUpdating ? '...' : cfg.nextLabel}
                        </button>
                      )}
                      {order.status === 'pending' && (
                        <button
                          onClick={() => rejectOrder(order.sub_order_id)}
                          disabled={isUpdating}
                          style={{ background: '#2A0A0A', color: '#FF453A', border: '1px solid #FF453A', borderRadius: 8, padding: '9px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                          ✗ Reject
                        </button>
                      )}
                      {order.status === 'dispatched' && (
                        <button
                          onClick={() => window.location.href = '/invoices'}
                          style={{ background: '#0A1F35', color: '#0A84FF', border: '1px solid #185FA5', borderRadius: 8, padding: '9px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          🧾 Invoice
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
