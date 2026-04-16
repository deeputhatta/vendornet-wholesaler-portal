import { useState, useEffect, useRef } from 'react';
import api from '../services/api';

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [dispatchedOrders, setDispatchedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(null);
  const [tab, setTab] = useState('pending');
  const fileRefs = useRef({});

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersRes, invoicesRes] = await Promise.all([
        api.get('/orders/my'),
        api.get('/invoices/my').catch(() => ({ data: { invoices: [] } })),
      ]);
      const dispatched = (ordersRes.data.sub_orders || []).filter(o =>
        ['dispatched', 'delivered', 'completed'].includes(o.status)
      );
      setDispatchedOrders(dispatched);
      setInvoices(invoicesRes.data.invoices || []);
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  };

  const uploadInvoice = async (subOrderId, file) => {
    if (!file) return;
    setUploading(subOrderId);
    try {
      const formData = new FormData();
      formData.append('invoice', file);
      formData.append('sub_order_id', subOrderId);
      await api.post('/invoices/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert('Invoice uploaded successfully!');
      await loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Upload failed');
    } finally { setUploading(null); }
  };

  const pendingInvoice = dispatchedOrders.filter(o =>
    !invoices.find(i => i.sub_order_id === o.sub_order_id)
  );

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#8E8E93' }}>Loading...</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* TOP BAR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #2C2C2E', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Invoices</div>
          <div style={{ fontSize: 10, color: '#8E8E93', marginTop: 1 }}>
            {pendingInvoice.length > 0
              ? <span style={{ color: '#FF9500' }}>{pendingInvoice.length} pending upload</span>
              : <span style={{ color: '#30D158' }}>All invoices uploaded</span>}
          </div>
        </div>
        <button className="btn-secondary" onClick={loadData}>↻ Refresh</button>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 16px', borderBottom: '1px solid #2C2C2E', flexShrink: 0 }}>
        {[['pending', `Pending (${pendingInvoice.length})`], ['uploaded', `Uploaded (${invoices.length})`]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            background: tab === key ? '#185FA5' : '#2C2C2E',
            color: tab === key ? '#fff' : '#8E8E93',
            border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 11, fontWeight: 500, cursor: 'pointer',
          }}>{label}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {tab === 'pending' && (
          pendingInvoice.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#8E8E93' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
              <div>All invoices uploaded</div>
            </div>
          ) : (
            pendingInvoice.map(order => (
              <div key={order.sub_order_id} className="card" style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{order.retailer_name}</div>
                    <div style={{ fontSize: 10, color: '#8E8E93', marginTop: 2 }}>
                      {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                    <span className={`chip ${order.status === 'dispatched' ? 'chip-dispatched' : 'chip-delivered'}`} style={{ marginTop: 4, display: 'inline-block' }}>
                      {order.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#F2C94C' }}>
                    ₹{parseFloat(order.total_amount).toLocaleString('en-IN')}
                  </div>
                </div>

                <input
                  ref={el => fileRefs.current[order.sub_order_id] = el}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  style={{ display: 'none' }}
                  onChange={e => uploadInvoice(order.sub_order_id, e.target.files[0])}
                />
                <button
                  onClick={() => fileRefs.current[order.sub_order_id]?.click()}
                  disabled={uploading === order.sub_order_id}
                  style={{ width: '100%', background: '#0A1F35', color: '#0A84FF', border: '1px solid #185FA5', borderRadius: 8, padding: '10px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {uploading === order.sub_order_id ? 'Uploading...' : '📤 Upload Invoice (PDF/Image)'}
                </button>
              </div>
            ))
          )
        )}

        {tab === 'uploaded' && (
          invoices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#8E8E93' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🧾</div>
              <div>No invoices uploaded yet</div>
            </div>
          ) : (
            invoices.map(inv => (
              <div key={inv.invoice_id} className="card" style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{inv.invoice_number}</div>
                    <div style={{ fontSize: 10, color: '#8E8E93', marginTop: 2 }}>
                      {new Date(inv.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#F2C94C' }}>
                      ₹{parseFloat(inv.amount || 0).toLocaleString('en-IN')}
                    </div>
                    {inv.file_url && (
                      <a href={inv.file_url} target="_blank" rel="noreferrer"
                        style={{ background: '#0A2510', color: '#30D158', border: '1px solid #1D9E75', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 600 }}>
                        View →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}
