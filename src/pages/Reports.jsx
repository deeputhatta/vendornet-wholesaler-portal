import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';

const STATUS_COLORS = {
  pending: '#FF9500', accepted: '#30D158', packing: '#0A84FF',
  dispatched: '#F2C94C', delivered: '#30D158', completed: '#30D158',
  invoice_uploaded: '#1D9E75', rejected: '#FF453A', auto_cancelled: '#FF453A',
};
const STATUS_LABELS = {
  pending: 'Pending', accepted: 'Accepted', packing: 'Packing',
  dispatched: 'Dispatched', delivered: 'Delivered', completed: 'Completed',
  invoice_uploaded: 'Invoiced', rejected: 'Rejected', auto_cancelled: 'Cancelled',
};

export default function Reports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDownload, setShowDownload] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const { user } = useAuth();
  const canView = user?.role === 'wholesaler_admin' || user?.permissions?.view_analytics;

  useEffect(() => { if (!canView) { setLoading(false); return; } loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersRes, listingsRes] = await Promise.all([
        api.get('/orders/wholesaler/all?limit=500'),
        api.get('/listings/my').catch(() => ({ data: { listings: [] } })),
      ]);
      const orders = ordersRes.data.sub_orders || [];
      const listings = listingsRes.data.listings || [];
      const delivered = orders.filter(o => ['delivered', 'completed', 'invoice_uploaded'].includes(o.status));
      const totalRevenue = delivered.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0);
      const pendingRevenue = orders.filter(o => ['pending','accepted','packing','dispatched'].includes(o.status)).reduce((s, o) => s + parseFloat(o.total_amount || 0), 0);
      const statusCount = orders.reduce((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc; }, {});
      const dayMap = {};
      for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate()-i); dayMap[d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })] = 0; }
      orders.forEach(o => { const k = new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); if (dayMap[k] !== undefined) dayMap[k]++; });
      const topListings = [...listings].filter(l => l.stock_qty > 0 && l.price).sort((a,b) => (b.stock_qty*parseFloat(b.price))-(a.stock_qty*parseFloat(a.price))).slice(0,5);
      const avgOrderValue = orders.length > 0 ? (orders.reduce((s, o) => s + parseFloat(o.total_amount||0), 0) / orders.length) : 0;
      setData({ orders, listings, totalRevenue, pendingRevenue, statusCount, dayMap, topListings, delivered, avgOrderValue });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (!canView) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <div style={{ fontSize: 48 }}>🔒</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Access Restricted</div>
      <div style={{ fontSize: 12, color: '#8E8E93' }}>You don't have permission to view analytics</div>
    </div>
  );

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ width: 32, height: 32, border: '3px solid #2C2C2E', borderTopColor: '#185FA5', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <div style={{ color: '#8E8E93', fontSize: 12 }}>Loading analytics...</div>
    </div>
  );

  const maxDay = Math.max(...Object.values(data.dayMap), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* TOP BAR */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #2C2C2E', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Analytics & Reports</div>
          <div style={{ fontSize: 10, color: '#8E8E93', marginTop: 1 }}>Business performance overview</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowAnalytics(true)}
            style={{ background: '#BF5AF2', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            📊 Analytics
          </button>
          <button onClick={() => setShowDownload(true)}
            style={{ background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            ⬇ Orders
          </button>
          <button className="btn-secondary" onClick={loadData}>↻</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>

        {/* KPI Cards — 2x2 grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <KPICard
            icon="💰" iconBg="#003A10"
            value={`₹${formatAmount(data.totalRevenue)}`}
            label="Revenue Earned"
            sub={`${data.delivered.length} orders delivered`}
            valueColor="#30D158"
          />
          <KPICard
            icon="⏳" iconBg="#2A1F00"
            value={`₹${formatAmount(data.pendingRevenue)}`}
            label="Pending Revenue"
            sub="In pipeline"
            valueColor="#F2C94C"
          />
          <KPICard
            icon="📦" iconBg="#0A1F35"
            value={data.orders.length}
            label="Total Orders"
            sub={`${data.orders.filter(o=>o.status==='pending').length} pending action`}
            valueColor="#0A84FF"
          />
          <KPICard
            icon="📈" iconBg="#1A0A2A"
            value={`₹${formatAmount(data.avgOrderValue)}`}
            label="Avg Order Value"
            sub={`${data.listings.length} active listings`}
            valueColor="#BF5AF2"
          />
        </div>

        {/* 7-day chart */}
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div className="section-title" style={{ marginBottom: 2 }}>Orders — Last 7 Days</div>
              <div style={{ fontSize: 10, color: '#8E8E93' }}>
                Total: {Object.values(data.dayMap).reduce((a,b)=>a+b,0)} orders this week
              </div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0A84FF' }}>
              {Object.values(data.dayMap).reduce((a,b)=>a+b,0)}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 90 }}>
            {Object.entries(data.dayMap).map(([day, count]) => {
              const isToday = day === Object.keys(data.dayMap).slice(-1)[0];
              return (
                <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ fontSize: 9, color: isToday ? '#0A84FF' : '#8E8E93', marginBottom: 3, fontWeight: 700 }}>{count > 0 ? count : ''}</div>
                  <div style={{
                    width: '100%',
                    height: Math.max(4, (count / maxDay) * 72),
                    background: count > 0 ? (isToday ? '#0A84FF' : '#185FA5') : '#2C2C2E',
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 0.4s ease',
                  }} />
                  <div style={{ fontSize: 8, color: isToday ? '#0A84FF' : '#636366', marginTop: 5, fontWeight: isToday ? 700 : 400 }}>{day}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Status breakdown */}
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="section-title" style={{ marginBottom: 12 }}>Order Status Breakdown</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {Object.entries(data.statusCount).map(([status, count]) => {
              const pct = Math.round((count / data.orders.length) * 100);
              const color = STATUS_COLORS[status] || '#8E8E93';
              return (
                <div key={status} style={{ background: '#2C2C2E', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: '#8E8E93' }}>{STATUS_LABELS[status] || status}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color }}>{count}</span>
                  </div>
                  <div style={{ height: 4, background: '#3A3A3C', borderRadius: 2 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.5s ease' }} />
                  </div>
                  <div style={{ fontSize: 9, color: '#636366', marginTop: 4 }}>{pct}% of total</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top listings */}
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="section-title" style={{ marginBottom: 12 }}>Top Listings by Inventory Value</div>
          {data.topListings.length === 0 ? (
            <div style={{ color: '#8E8E93', fontSize: 12, textAlign: 'center', padding: 16 }}>No listings data</div>
          ) : data.topListings.map((l, i) => {
            const value = l.stock_qty * parseFloat(l.price);
            const maxVal = data.topListings[0].stock_qty * parseFloat(data.topListings[0].price);
            const barColors = ['#0A84FF', '#30D158', '#F2C94C', '#FF9500', '#BF5AF2'];
            return (
              <div key={l.listing_id} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 20, height: 20, borderRadius: 6, background: barColors[i], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff' }}>{i+1}</div>
                    <div>
                      <div style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>{l.brand_name}</div>
                      <div style={{ fontSize: 10, color: '#8E8E93' }}>{l.generic_name}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, color: '#F2C94C', fontWeight: 700 }}>₹{formatAmount(value)}</div>
                    <div style={{ fontSize: 9, color: '#8E8E93' }}>Stock: {l.stock_qty}</div>
                  </div>
                </div>
                <div style={{ height: 5, background: '#2C2C2E', borderRadius: 3 }}>
                  <div style={{ height: '100%', width: `${(value/maxVal)*100}%`, background: barColors[i], borderRadius: 3, transition: 'width 0.5s ease' }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent delivered */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="section-title">Recent Delivered Orders</div>
            <div style={{ fontSize: 11, color: '#30D158', fontWeight: 600 }}>₹{formatAmount(data.totalRevenue)}</div>
          </div>
          {data.delivered.length === 0 ? (
            <div style={{ color: '#8E8E93', fontSize: 12, textAlign: 'center', padding: 16 }}>No completed orders yet</div>
          ) : data.delivered.slice(0, 8).map((o, i) => (
            <div key={o.sub_order_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: i < 7 ? '1px solid #2C2C2E' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#003A10', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#30D158' }}>
                  {o.retailer_name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>{o.retailer_name}</div>
                  <div style={{ fontSize: 9, color: '#8E8E93' }}>{new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 8, background: o.status === 'invoice_uploaded' ? '#003A10' : '#0A2510', color: o.status === 'invoice_uploaded' ? '#30D158' : '#1D9E75', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                  {o.status === 'invoice_uploaded' ? 'INVOICED' : 'DELIVERED'}
                </div>
                <div style={{ fontSize: 14, color: '#30D158', fontWeight: 700 }}>₹{formatAmount(parseFloat(o.total_amount))}</div>
              </div>
            </div>
          ))}
        </div>

      </div>

      {showDownload && <AnalyticsDownloadModal orders={data.orders} data={data} onClose={() => setShowDownload(false)} />}
      {showAnalytics && <AnalyticsReportModal data={data} onClose={() => setShowAnalytics(false)} />}
    </div>
  );
}

function KPICard({ icon, iconBg, value, label, sub, valueColor }) {
  return (
    <div className="card" style={{ padding: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{icon}</div>
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: valueColor, marginBottom: 2 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#fff', fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 9, color: '#8E8E93' }}>{sub}</div>
    </div>
  );
}

function formatAmount(n) {
  if (n >= 10000000) return (n/10000000).toFixed(1) + 'Cr';
  if (n >= 100000) return (n/100000).toFixed(1) + 'L';
  if (n >= 1000) return (n/1000).toFixed(1) + 'K';
  return Math.round(n).toLocaleString('en-IN');
}

function AnalyticsDownloadModal({ orders, data, onClose }) {
  const [dateMode, setDateMode] = useState('quick');
  const [quickPreset, setQuickPreset] = useState('this_month');
  const [fyYear, setFyYear] = useState('2025-26');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const QUICK_PRESETS = [
    { key: 'today', label: 'Today' }, { key: 'yesterday', label: 'Yesterday' },
    { key: 'this_week', label: 'This Week' }, { key: 'last_week', label: 'Last Week' },
    { key: 'this_month', label: 'This Month' }, { key: 'last_month', label: 'Last Month' },
    { key: 'last_3_months', label: 'Last 3 Months' }, { key: 'all_time', label: 'All Time' },
  ];
  const FY_YEARS = ['2023-24', '2024-25', '2025-26'];
  const QUARTER_RANGES = [
    { label: 'Q1 (Apr–Jun)', from: '-04-01', to: '-06-30' },
    { label: 'Q2 (Jul–Sep)', from: '-07-01', to: '-09-30' },
    { key: 'q3', label: 'Q3 (Oct–Dec)', from: '-10-01', to: '-12-31' },
    { label: 'Q4 (Jan–Mar)', from: '-01-01', to: '-03-31' },
  ];
  const STATUS_OPTIONS = [
    { key: 'all', label: 'All' }, { key: 'pending', label: 'Pending' },
    { key: 'dispatched', label: 'Dispatched' }, { key: 'delivered', label: 'Delivered' },
    { key: 'invoice_uploaded', label: 'Invoiced' }, { key: 'rejected', label: 'Rejected' },
  ];

  const getDateRange = () => {
    const now = new Date(); const today = now.toISOString().split('T')[0];
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
    if (dateMode === 'fy') { const [sy] = fyYear.split('-'); const ey = parseInt(sy)+1; return { from: `${sy}-04-01`, to: `${ey}-03-31` }; }
    return { from: fromDate || '2020-01-01', to: toDate || today };
  };

  const applyQuarter = (q) => {
    const [sy] = fyYear.split('-'); const ey = parseInt(sy)+1;
    const isQ4 = q.from.startsWith('-01'); const year = isQ4 ? ey : sy;
    setFromDate(`${year}${q.from}`); setToDate(`${year}${q.to}`); setDateMode('custom');
  };

  const getFiltered = () => {
    const { from, to } = getDateRange();
    const fromMs = new Date(from).getTime(); const toMs = new Date(to+'T23:59:59').getTime();
    let f = orders.filter(o => { const t = new Date(o.created_at).getTime(); return t >= fromMs && t <= toMs; });
    if (statusFilter !== 'all') f = f.filter(o => o.status === statusFilter);
    return f;
  };

  const download = () => {
    const { from, to } = getDateRange();
    const filtered = getFiltered();
    if (filtered.length === 0) { alert('No orders found for selected filters.'); return; }

    const wb = XLSX.utils.book_new();
    const totalAmt = filtered.reduce((s,o) => s+parseFloat(o.total_amount||0), 0);
    const delivered = filtered.filter(o => ['delivered','completed','invoice_uploaded'].includes(o.status));
    const deliveredAmt = delivered.reduce((s,o) => s+parseFloat(o.total_amount||0), 0);
    const pending = filtered.filter(o => ['pending','accepted','packing','dispatched'].includes(o.status));
    const pendingAmt = pending.reduce((s,o) => s+parseFloat(o.total_amount||0), 0);

    // Status breakdown
    const statusBreakdown = filtered.reduce((acc, o) => { acc[o.status] = (acc[o.status]||0)+1; return acc; }, {});

    const summaryData = [
      ['VendorNet — Order Report'],
      [`Period: ${from}  to  ${to}`],
      [`Status Filter: ${statusFilter === 'all' ? 'All Statuses' : STATUS_LABELS[statusFilter] || statusFilter}`],
      [`Generated: ${new Date().toLocaleString('en-IN')}`],
      [],
      ['SUMMARY', '', '', '', ''],
      ['Total Orders', filtered.length, '', 'Total Amount', `₹${totalAmt.toLocaleString('en-IN')}`],
      ['Delivered Orders', delivered.length, '', 'Delivered Amount', `₹${deliveredAmt.toLocaleString('en-IN')}`],
      ['Pending Orders', pending.length, '', 'Pending Amount', `₹${pendingAmt.toLocaleString('en-IN')}`],
      ['Avg Order Value', filtered.length > 0 ? `₹${Math.round(totalAmt/filtered.length).toLocaleString('en-IN')}` : '-'],
      [],
      ['STATUS BREAKDOWN', ''],
      ...Object.entries(statusBreakdown).map(([s, c]) => [STATUS_LABELS[s]||s, c, `${Math.round((c/filtered.length)*100)}%`]),
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    ws1['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 6 }, { wch: 20 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Summary');

    const headers = ['Order ID', 'Retailer Name', 'Mobile', 'Status', 'Amount (₹)', 'Date', 'Items'];
    const rows = filtered.map(o => [
      o.sub_order_id?.slice(0,8).toUpperCase(),
      o.retailer_name || '',
      o.retailer_mobile || '',
      STATUS_LABELS[o.status] || o.status,
      parseFloat(o.total_amount || 0),
      new Date(o.created_at).toLocaleDateString('en-IN'),
      o.items?.map(i => `${i.generic_name} (${i.brand_name}) x${i.quantity}`).join(' | ') || '',
    ]);
    const ws2 = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws2['!cols'] = [{ wch: 12 }, { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'All Orders');

    // Delivered sheet
    if (delivered.length > 0) {
      const dRows = delivered.map(o => [o.sub_order_id?.slice(0,8).toUpperCase(), o.retailer_name||'', o.retailer_mobile||'', parseFloat(o.total_amount||0), new Date(o.created_at).toLocaleDateString('en-IN')]);
      const ws3 = XLSX.utils.aoa_to_sheet([['Order ID','Retailer','Mobile','Amount (₹)','Date'], ...dRows]);
      ws3['!cols'] = [{ wch: 12 }, { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws3, 'Delivered');
    }

    // Pending sheet
    if (pending.length > 0) {
      const pRows = pending.map(o => [o.sub_order_id?.slice(0,8).toUpperCase(), o.retailer_name||'', o.retailer_mobile||'', STATUS_LABELS[o.status]||o.status, parseFloat(o.total_amount||0), new Date(o.created_at).toLocaleDateString('en-IN')]);
      const ws4 = XLSX.utils.aoa_to_sheet([['Order ID','Retailer','Mobile','Status','Amount (₹)','Date'], ...pRows]);
      ws4['!cols'] = [{ wch: 12 }, { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws4, 'Pending');
    }

    XLSX.writeFile(wb, `VendorNet_Report_${from}_to_${to}.xlsx`);
  };

  const filtered = getFiltered();
  const total = filtered.reduce((s,o) => s+parseFloat(o.total_amount||0), 0);
  const { from, to } = getDateRange();

  const tabStyle = (active) => ({ flex: 1, padding: '8px 0', background: active ? '#185FA5' : '#2C2C2E', color: active ? '#fff' : '#8E8E93', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' });
  const chipStyle = (active, color = '#185FA5') => ({ padding: '5px 12px', borderRadius: 20, background: active ? color : '#2C2C2E', color: active ? '#fff' : '#8E8E93', border: 'none', fontSize: 11, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: '#1C1C1E', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 600, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #2C2C2E', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Download Order Report</div>
            <div style={{ fontSize: 10, color: '#8E8E93', marginTop: 2 }}>Excel with Summary · All Orders · Delivered · Pending sheets</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8E8E93', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          <div style={{ fontSize: 11, color: '#8E8E93', marginBottom: 8, fontWeight: 600 }}>DATE RANGE</div>
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
            <button style={tabStyle(dateMode === 'quick')} onClick={() => setDateMode('quick')}>Quick Select</button>
            <button style={tabStyle(dateMode === 'fy')} onClick={() => setDateMode('fy')}>Financial Year</button>
            <button style={tabStyle(dateMode === 'custom')} onClick={() => setDateMode('custom')}>Custom</button>
          </div>

          {dateMode === 'quick' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {QUICK_PRESETS.map(p => <button key={p.key} style={chipStyle(quickPreset === p.key)} onClick={() => setQuickPreset(p.key)}>{p.label}</button>)}
            </div>
          )}

          {dateMode === 'fy' && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                {FY_YEARS.map(y => <button key={y} style={chipStyle(fyYear === y)} onClick={() => setFyYear(y)}>FY {y}</button>)}
              </div>
              <div style={{ fontSize: 11, color: '#8E8E93', marginBottom: 6 }}>Quarter shortcuts:</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {QUARTER_RANGES.map((q, i) => <button key={i} style={chipStyle(false, '#1D9E75')} onClick={() => applyQuarter(q)}>{q.label}</button>)}
              </div>
            </div>
          )}

          {dateMode === 'custom' && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: '#8E8E93', marginBottom: 4 }}>FROM</div>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ width: '100%', background: '#2C2C2E', border: '1px solid #3A3A3C', borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: 13 }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: '#8E8E93', marginBottom: 4 }}>TO</div>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ width: '100%', background: '#2C2C2E', border: '1px solid #3A3A3C', borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: 13 }} />
              </div>
            </div>
          )}

          <div style={{ fontSize: 11, color: '#8E8E93', marginBottom: 8, fontWeight: 600 }}>STATUS FILTER</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {STATUS_OPTIONS.map(s => <button key={s.key} style={chipStyle(statusFilter === s.key, '#1D9E75')} onClick={() => setStatusFilter(s.key)}>{s.label}</button>)}
          </div>

          {/* Preview */}
          <div style={{ background: '#0A1F35', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: '#8E8E93', marginBottom: 10, fontWeight: 600 }}>PREVIEW</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div style={{ background: '#0D2A45', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 9, color: '#8E8E93', marginBottom: 4 }}>ORDERS</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#0A84FF' }}>{filtered.length}</div>
              </div>
              <div style={{ background: '#0A2510', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 9, color: '#8E8E93', marginBottom: 4 }}>TOTAL AMOUNT</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#30D158' }}>₹{formatAmount(total)}</div>
              </div>
            </div>
            <div style={{ fontSize: 10, color: '#636366' }}>Period: {from} → {to}</div>
          </div>
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid #2C2C2E' }}>
          <button onClick={download} style={{ width: '100%', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 12, padding: '14px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
            ⬇ Download Excel Report ({filtered.length} orders)
          </button>
        </div>
      </div>
    </div>
  );
}

function AnalyticsReportModal({ data, onClose }) {
  const [dateMode, setDateMode] = useState('quick');
  const [quickPreset, setQuickPreset] = useState('this_month');
  const [fyYear, setFyYear] = useState('2025-26');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const QUICK_PRESETS = [
    { key: 'today', label: 'Today' }, { key: 'yesterday', label: 'Yesterday' },
    { key: 'this_week', label: 'This Week' }, { key: 'last_week', label: 'Last Week' },
    { key: 'this_month', label: 'This Month' }, { key: 'last_month', label: 'Last Month' },
    { key: 'last_3_months', label: 'Last 3 Months' }, { key: 'all_time', label: 'All Time' },
  ];
  const FY_YEARS = ['2023-24', '2024-25', '2025-26'];
  const QUARTER_RANGES = [
    { label: 'Q1 (Apr–Jun)', from: '-04-01', to: '-06-30' },
    { label: 'Q2 (Jul–Sep)', from: '-07-01', to: '-09-30' },
    { label: 'Q3 (Oct–Dec)', from: '-10-01', to: '-12-31' },
    { label: 'Q4 (Jan–Mar)', from: '-01-01', to: '-03-31' },
  ];

  const getDateRange = () => {
    const now = new Date(); const today = now.toISOString().split('T')[0];
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
    if (dateMode === 'fy') { const [sy] = fyYear.split('-'); const ey = parseInt(sy)+1; return { from: `${sy}-04-01`, to: `${ey}-03-31` }; }
    return { from: fromDate || '2020-01-01', to: toDate || today };
  };

  const applyQuarter = (q) => {
    const [sy] = fyYear.split('-'); const ey = parseInt(sy)+1;
    const isQ4 = q.from.startsWith('-01'); const year = isQ4 ? ey : sy;
    setFromDate(`${year}${q.from}`); setToDate(`${year}${q.to}`); setDateMode('custom');
  };

  const getFiltered = () => {
    const { from, to } = getDateRange();
    const fromMs = new Date(from).getTime(); const toMs = new Date(to+'T23:59:59').getTime();
    return data.orders.filter(o => { const t = new Date(o.created_at).getTime(); return t >= fromMs && t <= toMs; });
  };

  const download = () => {
    const { from, to } = getDateRange();
    const filtered = getFiltered();
    if (filtered.length === 0) { alert('No data for selected period.'); return; }

    const wb = XLSX.utils.book_new();

    // ── SHEET 1: Executive Summary ──
    const totalAmt = filtered.reduce((s,o) => s+parseFloat(o.total_amount||0), 0);
    const delivered = filtered.filter(o => ['delivered','completed','invoice_uploaded'].includes(o.status));
    const deliveredAmt = delivered.reduce((s,o) => s+parseFloat(o.total_amount||0), 0);
    const pending = filtered.filter(o => ['pending','accepted','packing','dispatched'].includes(o.status));
    const pendingAmt = pending.reduce((s,o) => s+parseFloat(o.total_amount||0), 0);
    const rejected = filtered.filter(o => ['rejected','auto_cancelled'].includes(o.status));
    const avgVal = filtered.length > 0 ? totalAmt/filtered.length : 0;
    const deliveryRate = filtered.length > 0 ? ((delivered.length/filtered.length)*100).toFixed(1) : 0;
    const rejectionRate = filtered.length > 0 ? ((rejected.length/filtered.length)*100).toFixed(1) : 0;

    const summary = [
      ['VENDORNET — ANALYTICS REPORT'],
      [`Period: ${from}  to  ${to}`],
      [`Generated: ${new Date().toLocaleString('en-IN')}`],
      [],
      ['── REVENUE SUMMARY ──'],
      ['Metric', 'Value'],
      ['Total Revenue (Delivered)', `₹${deliveredAmt.toLocaleString('en-IN')}`],
      ['Pending Revenue (In Pipeline)', `₹${pendingAmt.toLocaleString('en-IN')}`],
      ['Total Order Value (All)', `₹${totalAmt.toLocaleString('en-IN')}`],
      ['Average Order Value', `₹${Math.round(avgVal).toLocaleString('en-IN')}`],
      [],
      ['── ORDER PERFORMANCE ──'],
      ['Metric', 'Count', 'Percentage'],
      ['Total Orders', filtered.length, '100%'],
      ['Delivered / Completed', delivered.length, `${deliveryRate}%`],
      ['In Progress (Active)', pending.length, `${((pending.length/filtered.length)*100).toFixed(1)}%`],
      ['Rejected / Cancelled', rejected.length, `${rejectionRate}%`],
      [],
      ['── BUSINESS METRICS ──'],
      ['Delivery Rate', `${deliveryRate}%`],
      ['Rejection Rate', `${rejectionRate}%`],
      ['Conversion Rate (Accepted→Delivered)', delivered.length > 0 ? `${((delivered.length/(filtered.length-rejected.length))*100).toFixed(1)}%` : '0%'],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summary);
    ws1['!cols'] = [{ wch: 35 }, { wch: 20 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Executive Summary');

    // ── SHEET 2: Status Breakdown ──
    const statusBreakdown = filtered.reduce((acc,o) => {
      if (!acc[o.status]) acc[o.status] = { count: 0, amount: 0 };
      acc[o.status].count++;
      acc[o.status].amount += parseFloat(o.total_amount||0);
      return acc;
    }, {});
    const statusRows = Object.entries(statusBreakdown).map(([s, v]) => [
      STATUS_LABELS[s]||s, v.count,
      `${((v.count/filtered.length)*100).toFixed(1)}%`,
      `₹${v.amount.toLocaleString('en-IN')}`,
      `₹${Math.round(v.amount/v.count).toLocaleString('en-IN')}`,
    ]);
    const ws2 = XLSX.utils.aoa_to_sheet([
      ['Status', 'Orders', '% of Total', 'Total Amount', 'Avg Amount'],
      ...statusRows,
      [],
      ['TOTAL', filtered.length, '100%', `₹${totalAmt.toLocaleString('en-IN')}`, `₹${Math.round(avgVal).toLocaleString('en-IN')}`],
    ]);
    ws2['!cols'] = [{ wch: 18 }, { wch: 10 }, { wch: 12 }, { wch: 18 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Status Breakdown');

    // ── SHEET 3: Day-by-Day Trend ──
    const dayTrend = {};
    filtered.forEach(o => {
      const d = new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      if (!dayTrend[d]) dayTrend[d] = { orders: 0, amount: 0, delivered: 0 };
      dayTrend[d].orders++;
      dayTrend[d].amount += parseFloat(o.total_amount||0);
      if (['delivered','completed','invoice_uploaded'].includes(o.status)) dayTrend[d].delivered++;
    });
    const trendRows = Object.entries(dayTrend).map(([d, v]) => [
      d, v.orders, v.delivered,
      `₹${v.amount.toLocaleString('en-IN')}`,
      v.orders > 0 ? `${((v.delivered/v.orders)*100).toFixed(0)}%` : '0%',
    ]);
    const ws3 = XLSX.utils.aoa_to_sheet([
      ['Date', 'Total Orders', 'Delivered', 'Amount', 'Delivery Rate'],
      ...trendRows,
    ]);
    ws3['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws3, 'Daily Trend');

    // ── SHEET 4: Retailer Performance ──
    const retailerMap = {};
    filtered.forEach(o => {
      const key = o.retailer_name || 'Unknown';
      if (!retailerMap[key]) retailerMap[key] = { mobile: o.retailer_mobile||'', orders: 0, amount: 0, delivered: 0, rejected: 0 };
      retailerMap[key].orders++;
      retailerMap[key].amount += parseFloat(o.total_amount||0);
      if (['delivered','completed','invoice_uploaded'].includes(o.status)) retailerMap[key].delivered++;
      if (['rejected','auto_cancelled'].includes(o.status)) retailerMap[key].rejected++;
    });
    const retailerRows = Object.entries(retailerMap)
      .sort((a,b) => b[1].amount - a[1].amount)
      .map(([name, v]) => [
        name, v.mobile, v.orders, v.delivered, v.rejected,
        `₹${v.amount.toLocaleString('en-IN')}`,
        `₹${Math.round(v.amount/v.orders).toLocaleString('en-IN')}`,
        `${((v.delivered/v.orders)*100).toFixed(0)}%`,
      ]);
    const ws4 = XLSX.utils.aoa_to_sheet([
      ['Retailer Name', 'Mobile', 'Total Orders', 'Delivered', 'Rejected', 'Total Amount', 'Avg Order Value', 'Delivery Rate'],
      ...retailerRows,
    ]);
    ws4['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws4, 'Retailer Performance');

    // ── SHEET 5: Product / Item Analysis ──
    const productMap = {};
    filtered.forEach(o => {
      (o.items||[]).forEach(item => {
        const key = `${item.generic_name} — ${item.brand_name}`;
        if (!productMap[key]) productMap[key] = { qty: 0, revenue: 0, orders: 0 };
        productMap[key].qty += item.quantity || 0;
        productMap[key].revenue += parseFloat(item.item_total||0);
        productMap[key].orders++;
      });
    });
    const productRows = Object.entries(productMap)
      .sort((a,b) => b[1].revenue - a[1].revenue)
      .slice(0, 50)
      .map(([name, v]) => [
        name, v.qty, v.orders,
        `₹${v.revenue.toLocaleString('en-IN')}`,
        `₹${Math.round(v.revenue/v.qty).toLocaleString('en-IN')}`,
      ]);
    const ws5 = XLSX.utils.aoa_to_sheet([
      ['Product — Brand', 'Total Qty Sold', 'No. of Orders', 'Total Revenue', 'Avg Price/Unit'],
      ...productRows,
    ]);
    ws5['!cols'] = [{ wch: 36 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws5, 'Product Analysis');

    // ── SHEET 6: Weekly Summary ──
    const weekMap = {};
    filtered.forEach(o => {
      const d = new Date(o.created_at);
      const weekStart = new Date(d); weekStart.setDate(d.getDate() - d.getDay() + 1);
      const key = weekStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      if (!weekMap[key]) weekMap[key] = { orders: 0, amount: 0, delivered: 0 };
      weekMap[key].orders++;
      weekMap[key].amount += parseFloat(o.total_amount||0);
      if (['delivered','completed','invoice_uploaded'].includes(o.status)) weekMap[key].delivered++;
    });
    const weekRows = Object.entries(weekMap).map(([w, v]) => [
      `Week of ${w}`, v.orders, v.delivered,
      `₹${v.amount.toLocaleString('en-IN')}`,
      `₹${Math.round(v.amount/v.orders).toLocaleString('en-IN')}`,
    ]);
    const ws6 = XLSX.utils.aoa_to_sheet([
      ['Week', 'Orders', 'Delivered', 'Revenue', 'Avg Order Value'],
      ...weekRows,
    ]);
    ws6['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 12 }, { wch: 18 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws6, 'Weekly Summary');

    XLSX.writeFile(wb, `VendorNet_Analytics_${from}_to_${to}.xlsx`);
  };

  const filtered = getFiltered();
  const { from, to } = getDateRange();
  const totalAmt = filtered.reduce((s,o) => s+parseFloat(o.total_amount||0), 0);
  const delivered = filtered.filter(o => ['delivered','completed','invoice_uploaded'].includes(o.status));

  const tabStyle = (active) => ({ flex: 1, padding: '8px 0', background: active ? '#BF5AF2' : '#2C2C2E', color: active ? '#fff' : '#8E8E93', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' });
  const chipStyle = (active) => ({ padding: '5px 12px', borderRadius: 20, background: active ? '#BF5AF2' : '#2C2C2E', color: active ? '#fff' : '#8E8E93', border: 'none', fontSize: 11, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: '#1C1C1E', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 600, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>

        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #2C2C2E', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>📊 Download Analytics Report</div>
            <div style={{ fontSize: 10, color: '#8E8E93', marginTop: 2 }}>6 sheets: Summary · Status · Daily Trend · Retailer · Products · Weekly</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8E8E93', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          <div style={{ fontSize: 11, color: '#8E8E93', marginBottom: 8, fontWeight: 600 }}>DATE RANGE</div>
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
            <button style={tabStyle(dateMode === 'quick')} onClick={() => setDateMode('quick')}>Quick Select</button>
            <button style={tabStyle(dateMode === 'fy')} onClick={() => setDateMode('fy')}>Financial Year</button>
            <button style={tabStyle(dateMode === 'custom')} onClick={() => setDateMode('custom')}>Custom</button>
          </div>

          {dateMode === 'quick' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {QUICK_PRESETS.map(p => <button key={p.key} style={chipStyle(quickPreset === p.key)} onClick={() => setQuickPreset(p.key)}>{p.label}</button>)}
            </div>
          )}

          {dateMode === 'fy' && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                {FY_YEARS.map(y => <button key={y} style={chipStyle(fyYear === y)} onClick={() => setFyYear(y)}>FY {y}</button>)}
              </div>
              <div style={{ fontSize: 11, color: '#8E8E93', marginBottom: 6 }}>Quarter shortcuts:</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {QUARTER_RANGES.map((q, i) => <button key={i} style={{ ...chipStyle(false), background: '#2A1A3A', color: '#BF5AF2' }} onClick={() => applyQuarter(q)}>{q.label}</button>)}
              </div>
            </div>
          )}

          {dateMode === 'custom' && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: '#8E8E93', marginBottom: 4 }}>FROM</div>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ width: '100%', background: '#2C2C2E', border: '1px solid #3A3A3C', borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: 13 }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: '#8E8E93', marginBottom: 4 }}>TO</div>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ width: '100%', background: '#2C2C2E', border: '1px solid #3A3A3C', borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: 13 }} />
              </div>
            </div>
          )}

          {/* What's included */}
          <div style={{ fontSize: 11, color: '#8E8E93', marginBottom: 8, fontWeight: 600 }}>REPORT INCLUDES</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            {[
              { icon: '📋', title: 'Executive Summary', desc: 'Revenue, KPIs, rates' },
              { icon: '📊', title: 'Status Breakdown', desc: 'Orders per status + amounts' },
              { icon: '📈', title: 'Daily Trend', desc: 'Day-by-day order volume' },
              { icon: '🏪', title: 'Retailer Performance', desc: 'Top buyers ranked by revenue' },
              { icon: '📦', title: 'Product Analysis', desc: 'Top 50 products by qty + revenue' },
              { icon: '📅', title: 'Weekly Summary', desc: 'Week-by-week breakdown' },
            ].map((s, i) => (
              <div key={i} style={{ background: '#2C2C2E', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ fontSize: 18 }}>{s.icon}</div>
                <div>
                  <div style={{ fontSize: 11, color: '#fff', fontWeight: 600, marginBottom: 2 }}>{s.title}</div>
                  <div style={{ fontSize: 9, color: '#8E8E93' }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Preview */}
          <div style={{ background: '#1A0A2A', borderRadius: 12, padding: '14px 16px', border: '1px solid #3A2A4A' }}>
            <div style={{ fontSize: 11, color: '#8E8E93', marginBottom: 10, fontWeight: 600 }}>PREVIEW</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div style={{ background: '#2A1A3A', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: '#8E8E93', marginBottom: 4 }}>ORDERS</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#BF5AF2' }}>{filtered.length}</div>
              </div>
              <div style={{ background: '#0A2510', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: '#8E8E93', marginBottom: 4 }}>REVENUE</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#30D158' }}>₹{formatAmount(totalAmt)}</div>
              </div>
              <div style={{ background: '#0A1F35', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: '#8E8E93', marginBottom: 4 }}>DELIVERED</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0A84FF' }}>{delivered.length}</div>
              </div>
            </div>
            <div style={{ fontSize: 10, color: '#636366', marginTop: 10 }}>Period: {from} → {to}</div>
          </div>
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid #2C2C2E' }}>
          <button onClick={download} style={{ width: '100%', background: '#BF5AF2', color: '#fff', border: 'none', borderRadius: 12, padding: '14px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
            📊 Download Analytics Report ({filtered.length} orders)
          </button>
        </div>
      </div>
    </div>
  );
}
