import { useState, useEffect } from 'react';
import api from '../services/api';
import * as XLSX from 'xlsx';

const STATUS_CONFIG = {
  pending:          { label: 'Pending',    chip: 'chip-pending',    next: 'accepted',   nextLabel: '✔ Accept' },
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
  const [showDownload, setShowDownload] = useState(false);

  useEffect(() => { loadOrders(); }, []);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get('/orders/wholesaler/all?limit=500');
      setSubOrders(res.data.sub_orders || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const updateStatus = async (subOrderId, status) => {
    setUpdating(subOrderId);
    try {
      if (status === 'accepted') await api.put(`/orders/${subOrderId}/accept`);
      else await api.put(`/orders/${subOrderId}/status`, { status });
      await loadOrders();
    } catch (err) { alert(err.response?.data?.error || 'Failed to update status'); }
    finally { setUpdating(null); }
  };

  const rejectOrder = async (subOrderId) => {
    const reason = prompt('Rejection reason (optional):') ?? '';
    if (reason === null) return;
    setUpdating(subOrderId);
    try {
      await api.put(`/orders/${subOrderId}/reject`, { reason: reason || 'Rejected by wholesaler' });
      await loadOrders();
    } catch (err) { alert(err.response?.data?.error || 'Failed to reject'); }
    finally { setUpdating(null); }
  };

  const filtered = subOrders.filter(o => filter === 'all' ? true : o.status === filter);

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
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowDownload(true)}
            style={{ background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            ⬇ Download
          </button>
          <button className="btn-secondary" onClick={loadOrders}>↻ Refresh</button>
        </div>
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

                    <button onClick={() => setExpanded(p => ({ ...p, [order.sub_order_id]: !p[order.sub_order_id] }))}
                      style={{ background: '#3A3A3C', border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: 11, color: '#8E8E93', cursor: 'pointer', width: '100%', textAlign: 'left', marginBottom: 8 }}>
                      {isExpanded ? '▲' : '▼'} {order.items?.length || 0} item{order.items?.length !== 1 ? 's' : ''}
                    </button>

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

                    <div style={{ display: 'flex', gap: 8 }}>
                      {cfg.next && (
                        <button onClick={() => updateStatus(order.sub_order_id, cfg.next)} disabled={isUpdating}
                          style={{ flex: 1, background: '#003A10', color: '#30D158', border: '1px solid #1D9E75', borderRadius: 8, padding: '9px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                          {isUpdating ? '...' : cfg.nextLabel}
                        </button>
                      )}
                      {order.status === 'pending' && (
                        <button onClick={() => rejectOrder(order.sub_order_id)} disabled={isUpdating}
                          style={{ background: '#2A0A0A', color: '#FF453A', border: '1px solid #FF453A', borderRadius: 8, padding: '9px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                          ✗ Reject
                        </button>
                      )}
                      {order.status === 'dispatched' && (
                        <button onClick={() => window.location.href = '/invoices'}
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

      {showDownload && (
        <OrderDownloadModal orders={subOrders} onClose={() => setShowDownload(false)} />
      )}
    </div>
  );
}

function OrderDownloadModal({ orders, onClose }) {
  const [dateMode, setDateMode] = useState('quick');
  const [quickPreset, setQuickPreset] = useState('today');
  const [fyYear, setFyYear] = useState('2025-26');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const QUICK_PRESETS = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'this_week', label: 'This Week' },
    { key: 'last_week', label: 'Last Week' },
    { key: 'this_month', label: 'This Month' },
    { key: 'last_month', label: 'Last Month' },
    { key: 'last_3_months', label: 'Last 3 Months' },
    { key: 'all_time', label: 'All Time' },
  ];

  const FY_YEARS = ['2023-24', '2024-25', '2025-26'];

  const QUARTER_RANGES = [
    { label: 'Q1 (Apr–Jun)', from: '-04-01', to: '-06-30' },
    { label: 'Q2 (Jul–Sep)', from: '-07-01', to: '-09-30' },
    { label: 'Q3 (Oct–Dec)', from: '-10-01', to: '-12-31' },
    { label: 'Q4 (Jan–Mar)', from: '-01-01', to: '-03-31' },
  ];

  const STATUS_OPTIONS = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'accepted', label: 'Accepted' },
    { key: 'packing', label: 'Packing' },
    { key: 'dispatched', label: 'Dispatched' },
    { key: 'delivered', label: 'Delivered' },
    { key: 'invoice_uploaded', label: 'Invoiced' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'auto_cancelled', label: 'Cancelled' },
  ];

  const getDateRange = () => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    if (dateMode === 'quick') {
      switch (quickPreset) {
        case 'today': return { from: today, to: today };
        case 'yesterday': { const y = new Date(now); y.setDate(y.getDate()-1); const d = y.toISOString().split('T')[0]; return { from: d, to: d }; }
        case 'this_week': { const m = new Date(now); m.setDate(now.getDate()-now.getDay()+1); return { from: m.toISOString().split('T')[0], to: today }; }
        case 'last_week': { const lm = new Date(now); lm.setDate(now.getDate()-now.getDay()-6); const ls = new Date(now); ls.setDate(now.getDate()-now.getDay()); return { from: lm.toISOString().split('T')[0], to: ls.toISOString().split('T')[0] }; }
        case 'this_month': return { from: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`, to: today };
        case 'last_month': { const lm = new Date(now.getFullYear(), now.getMonth()-1, 1); const lme = new Date(now.getFullYear(), now.getMonth(), 0); return { from: lm.toISOString().split('T')[0], to: lme.toISOString().split('T')[0] }; }
        case 'last_3_months': { const t = new Date(now); t.setMonth(t.getMonth()-3); return { from: t.toISOString().split('T')[0], to: today }; }
        default: return { from: '2020-01-01', to: today };
      }
    }
    if (dateMode === 'fy') {
      const [sy] = fyYear.split('-'); const ey = parseInt(sy)+1;
      return { from: `${sy}-04-01`, to: `${ey}-03-31` };
    }
    return { from: fromDate || '2020-01-01', to: toDate || today };
  };

  const applyQuarter = (q) => {
    const [sy] = fyYear.split('-'); const ey = parseInt(sy)+1;
    const isQ4 = q.from.startsWith('-01');
    const year = isQ4 ? ey : sy;
    setFromDate(`${year}${q.from}`); setToDate(`${year}${q.to}`); setDateMode('custom');
  };

  const getFiltered = () => {
    const { from, to } = getDateRange();
    const fromMs = new Date(from).getTime();
    const toMs = new Date(to + 'T23:59:59').getTime();
    let f = orders.filter(o => { const t = new Date(o.created_at).getTime(); return t >= fromMs && t <= toMs; });
    if (statusFilter !== 'all') f = f.filter(o => o.status === statusFilter);
    return f;
  };

  const download = () => {
    const { from, to } = getDateRange();
    const filtered = getFiltered();
    if (filtered.length === 0) { alert('No orders found for selected filters.'); return; }

    const wb = XLSX.utils.book_new();

    // Summary
    const totalAmt = filtered.reduce((s, o) => s + parseFloat(o.total_amount||0), 0);
    const delivered = filtered.filter(o => ['delivered','completed','invoice_uploaded'].includes(o.status));
    const deliveredAmt = delivered.reduce((s, o) => s + parseFloat(o.total_amount||0), 0);
    const pending = filtered.filter(o => ['pending','accepted','packing','dispatched'].includes(o.status));
    const pendingAmt = pending.reduce((s, o) => s + parseFloat(o.total_amount||0), 0);

    const summaryData = [
      ['VendorNet — Order Report'],
      [`Period: ${from}  to  ${to}`],
      [`Status Filter: ${statusFilter === 'all' ? 'All Statuses' : statusFilter}`],
      [`Generated: ${new Date().toLocaleString('en-IN')}`],
      [],
      ['Total Orders', filtered.length, '', 'Total Amount', `₹${totalAmt.toLocaleString('en-IN')}`],
      ['Delivered Orders', delivered.length, '', 'Delivered Amount', `₹${deliveredAmt.toLocaleString('en-IN')}`],
      ['Pending Orders', pending.length, '', 'Pending Amount', `₹${pendingAmt.toLocaleString('en-IN')}`],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    ws1['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 4 }, { wch: 20 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Summary');

    // Orders detail
    const headers = ['Order ID', 'Retailer Name', 'Mobile', 'Status', 'Amount (₹)', 'Date', 'Items'];
    const rows = filtered.map(o => [
      o.sub_order_id?.slice(0,8).toUpperCase(),
      o.retailer_name || '',
      o.retailer_mobile || '',
      STATUS_CONFIG[o.status]?.label || o.status,
      parseFloat(o.total_amount || 0),
      new Date(o.created_at).toLocaleDateString('en-IN'),
      o.items?.map(i => `${i.generic_name} (${i.brand_name}) x${i.quantity}`).join(' | ') || '',
    ]);
    const ws2 = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws2['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Orders');

    // Status-wise sheets
    const statuses = ['pending', 'delivered', 'invoice_uploaded', 'rejected'];
    statuses.forEach(s => {
      const sOrders = filtered.filter(o => o.status === s);
      if (sOrders.length === 0) return;
      const sRows = sOrders.map(o => [
        o.sub_order_id?.slice(0,8).toUpperCase(),
        o.retailer_name || '',
        o.retailer_mobile || '',
        parseFloat(o.total_amount || 0),
        new Date(o.created_at).toLocaleDateString('en-IN'),
      ]);
      const ws = XLSX.utils.aoa_to_sheet([['Order ID', 'Retailer', 'Mobile', 'Amount (₹)', 'Date'], ...sRows]);
      ws['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws, STATUS_CONFIG[s]?.label || s);
    });

    XLSX.writeFile(wb, `VendorNet_Orders_${from}_to_${to}.xlsx`);
  };

  const filtered = getFiltered();
  const total = filtered.reduce((s, o) => s + parseFloat(o.total_amount||0), 0);
  const { from, to } = getDateRange();

  const tabStyle = (active) => ({
    flex: 1, padding: '8px 0', background: active ? '#185FA5' : '#2C2C2E',
    color: active ? '#fff' : '#8E8E93', border: 'none',
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
  });
  const chipStyle = (active, color = '#185FA5') => ({
    padding: '5px 12px', borderRadius: 20,
    background: active ? color : '#2C2C2E',
    color: active ? '#fff' : '#8E8E93',
    border: 'none', fontSize: 11, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: '#1C1C1E', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 600, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>

        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #2C2C2E', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Download Order Report</div>
            <div style={{ fontSize: 10, color: '#8E8E93', marginTop: 2 }}>Excel with Summary + Detail + Status sheets</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8E8E93', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {/* Date mode */}
          <div style={{ fontSize: 11, color: '#8E8E93', marginBottom: 8, fontWeight: 600 }}>DATE RANGE</div>
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
            <button style={tabStyle(dateMode === 'quick')} onClick={() => setDateMode('quick')}>Quick Select</button>
            <button style={tabStyle(dateMode === 'fy')} onClick={() => setDateMode('fy')}>Financial Year</button>
            <button style={tabStyle(dateMode === 'custom')} onClick={() => setDateMode('custom')}>Custom</button>
          </div>

          {dateMode === 'quick' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {QUICK_PRESETS.map(p => (
                <button key={p.key} style={chipStyle(quickPreset === p.key)} onClick={() => setQuickPreset(p.key)}>{p.label}</button>
              ))}
            </div>
          )}

          {dateMode === 'fy' && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                {FY_YEARS.map(y => (
                  <button key={y} style={chipStyle(fyYear === y)} onClick={() => setFyYear(y)}>FY {y}</button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: '#8E8E93', marginBottom: 6 }}>Quick quarters:</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {QUARTER_RANGES.map((q, i) => (
                  <button key={i} style={chipStyle(false, '#1D9E75')} onClick={() => applyQuarter(q)}>{q.label}</button>
                ))}
              </div>
            </div>
          )}

          {dateMode === 'custom' && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: '#8E8E93', marginBottom: 4 }}>FROM</div>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                  style={{ width: '100%', background: '#2C2C2E', border: '1px solid #3A3A3C', borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: 13 }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: '#8E8E93', marginBottom: 4 }}>TO</div>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                  style={{ width: '100%', background: '#2C2C2E', border: '1px solid #3A3A3C', borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: 13 }} />
              </div>
            </div>
          )}

          {/* Status filter */}
          <div style={{ fontSize: 11, color: '#8E8E93', marginBottom: 8, fontWeight: 600 }}>STATUS FILTER</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {STATUS_OPTIONS.map(s => (
              <button key={s.key} style={chipStyle(statusFilter === s.key, '#1D9E75')} onClick={() => setStatusFilter(s.key)}>{s.label}</button>
            ))}
          </div>

          {/* Preview */}
          <div style={{ background: '#0A1F35', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: '#8E8E93', marginBottom: 10, fontWeight: 600 }}>PREVIEW</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: '#8E8E93', fontSize: 12 }}>Orders found</span>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{filtered.length}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: '#8E8E93', fontSize: 12 }}>Total amount</span>
              <span style={{ color: '#30D158', fontWeight: 700, fontSize: 14 }}>₹{total.toLocaleString('en-IN')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#8E8E93', fontSize: 12 }}>Period</span>
              <span style={{ color: '#8E8E93', fontSize: 11 }}>{from} → {to}</span>
            </div>
            <div style={{ marginTop: 10, fontSize: 10, color: '#636366' }}>
              Excel will include: Summary · All Orders · Pending · Delivered · Invoiced · Rejected sheets
            </div>
          </div>
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid #2C2C2E' }}>
          <button onClick={download}
            style={{ width: '100%', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 12, padding: '14px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
            ⬇ Download Excel ({filtered.length} orders)
          </button>
        </div>
      </div>
    </div>
  );
}
