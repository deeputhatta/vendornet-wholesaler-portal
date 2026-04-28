import { useState, useEffect } from 'react';
import api from '../services/api';

const PAGE_SIZE = 100;

// ============================================================
// PAGINATION COMPONENT
// ============================================================
function Pagination({ currentPage, totalPages, onPage }) {
  if (totalPages <= 1) return null;
  const getPages = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '10px 16px', borderTop: '1px solid #2C2C2E', flexShrink: 0 }}>
      <button onClick={() => onPage(currentPage - 1)} disabled={currentPage === 1}
        style={{ background: '#2C2C2E', border: 'none', color: currentPage === 1 ? '#636366' : '#fff', borderRadius: 6, padding: '5px 10px', cursor: currentPage === 1 ? 'default' : 'pointer', fontSize: 13 }}>←</button>
      {getPages().map((p, i) => p === '...' ? (
        <span key={`d${i}`} style={{ color: '#636366', fontSize: 12, padding: '0 2px' }}>…</span>
      ) : (
        <button key={p} onClick={() => onPage(p)}
          style={{ background: currentPage === p ? '#185FA5' : '#2C2C2E', border: 'none', color: '#fff', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', fontSize: 12, fontWeight: currentPage === p ? 700 : 400, minWidth: 30 }}>{p}</button>
      ))}
      <button onClick={() => onPage(currentPage + 1)} disabled={currentPage === totalPages}
        style={{ background: '#2C2C2E', border: 'none', color: currentPage === totalPages ? '#636366' : '#fff', borderRadius: 6, padding: '5px 10px', cursor: currentPage === totalPages ? 'default' : 'pointer', fontSize: 13 }}>→</button>
      <span style={{ fontSize: 10, color: '#636366', marginLeft: 6 }}>
        {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, 0)} of ?
      </span>
    </div>
  );
}

// ============================================================
// MAIN INVENTORY PAGE
// ============================================================
export default function Inventory() {
  const [catalogue, setCatalogue] = useState([]);
  const [myListings, setMyListings] = useState({});
  const [edits, setEdits] = useState({});
  const [categories, setCategories] = useState([]);
  const [catFilter, setCatFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null);
  const [tab, setTab] = useState('existing');
  const [showUnlisted, setShowUnlisted] = useState(false);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => { loadData(1); }, []);

  // Debounced search/filter — reset to page 1
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      loadData(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search, catFilter]);

  const loadData = async (p = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p });
      if (catFilter) params.append('category_ids', catFilter);
      if (search) params.append('search', search);
      const [catRes, myRes] = await Promise.all([
        api.get(`/listings/catalogue?${params}`),
        api.get('/listings/my'),
      ]);
      setCatalogue(catRes.data.catalogue || []);
      setCategories(catRes.data.categories || []);
      setTotalItems(catRes.data.total || 0);
      const map = {};
      (myRes.data.listings || []).forEach(l => { map[l.variant_id] = l; });
      setMyListings(map);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const goToPage = (p) => {
    setPage(p);
    loadData(p);
  };

  const getVal = (vid, field) => {
    if (edits[vid]?.[field] !== undefined) return edits[vid][field];
    return myListings[vid]?.[field] ?? '';
  };

  const setVal = (vid, field, value) => {
    setEdits(p => ({ ...p, [vid]: { ...p[vid], [field]: value } }));
    setSaveResult(null);
  };

  const saveAll = async () => {
    setSaving(true); setSaveResult(null);
    let saved = 0, failed = 0;
    for (const [vid, changes] of Object.entries(edits)) {
      const listing = myListings[vid];
      try {
        const price = parseFloat(changes.price ?? listing?.price);
        if (!price) continue;
        const payload = {
          price,
          offer_price: changes.offer_price ? parseFloat(changes.offer_price) : (listing?.offer_price || null),
          min_order_qty: parseInt(changes.min_order_qty ?? listing?.min_order_qty) || 1,
          stock_qty: parseInt(changes.stock_qty ?? listing?.stock_qty) || 0,
          delivery_days: parseInt(changes.delivery_days ?? listing?.delivery_days) || 1,
        };
        if (listing) {
          await api.put(`/listings/${listing.listing_id}`, { ...payload, is_active: listing.is_active });
        } else {
          await api.post('/listings/upsert', { variant_id: vid, ...payload, delivery_radius_km: 20 });
        }
        saved++;
      } catch { failed++; }
    }
    setEdits({});
    await loadData(page);
    setSaveResult({ saved, failed });
    setSaving(false);
  };

  // Client-side split of current page into listed/unlisted
  const listed = catalogue.filter(i => myListings[i.variant_id]);
  const unlisted = catalogue.filter(i => !myListings[i.variant_id]);
  const changedCount = Object.keys(edits).length;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #2C2C2E', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Inventory</div>
          <div style={{ fontSize: 10, color: '#8E8E93', marginTop: 1 }}>
            {Object.keys(myListings).length} listed · {totalItems} total products
            {changedCount > 0 && <span style={{ color: '#FF9500' }}> · {changedCount} unsaved</span>}
          </div>
        </div>
        {changedCount > 0 && tab === 'existing' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setEdits({}); setSaveResult(null); }}
              style={{ background: '#2C2C2E', color: '#8E8E93', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 12, cursor: 'pointer' }}>Discard</button>
            <button onClick={saveAll} disabled={saving}
              style={{ background: '#30D158', color: '#000', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving...' : `💾 Save ${changedCount}`}
            </button>
          </div>
        )}
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: 6, padding: '8px 16px', borderBottom: '1px solid #2C2C2E', flexShrink: 0 }}>
        {[
          ['existing', '📦 My Inventory'],
          ['bulk_add', '✚ Add from Catalogue'],
          ['import', '📥 Import CSV'],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ background: tab === key ? '#185FA5' : '#2C2C2E', color: tab === key ? '#fff' : '#8E8E93', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 11, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {label}
          </button>
        ))}
      </div>

      {/* TAB: My Inventory */}
      {tab === 'existing' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 8, padding: '10px 16px', flexShrink: 0 }}>
            <input placeholder="🔍 Search product, brand or HSN..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ flex: 3, background: '#2C2C2E', border: '1px solid #3A3A3C', borderRadius: 8, color: '#fff', padding: '8px 12px', fontSize: 12, outline: 'none', minWidth: 0 }} />
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
              style={{ background: '#2C2C2E', border: '1px solid #3A3A3C', borderRadius: 8, color: catFilter ? '#fff' : '#636366', padding: '8px 12px', fontSize: 12, outline: 'none', flexShrink: 0, maxWidth: 160 }}>
              <option value="">All Categories</option>
              {categories.map(c => <option key={c.category_id} value={c.category_id}>{c.name}</option>)}
            </select>
          </div>

          {saveResult && (
            <div style={{ margin: '0 16px 8px', background: saveResult.failed ? '#2A1500' : '#003A10', border: `1px solid ${saveResult.failed ? '#FF9500' : '#1D9E75'}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: saveResult.failed ? '#FF9500' : '#30D158', flexShrink: 0 }}>
              ✓ {saveResult.saved} saved{saveResult.failed > 0 ? ` · ⚠ ${saveResult.failed} failed` : ''}
            </div>
          )}

          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8E8E93' }}>Loading...</div>
          ) : (
            <>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {/* Column headers */}
                <div style={{ display: 'flex', padding: '7px 16px', background: '#1C1C1E', fontSize: 9, fontWeight: 700, color: '#636366', textTransform: 'uppercase', letterSpacing: 0.5, position: 'sticky', top: 0, zIndex: 10 }}>
                  <span style={{ flex: 2.5 }}>Product / Brand</span>
                  <span style={{ flex: 0.8 }}>Price ₹ *</span>
                  <span style={{ flex: 0.8 }}>Offer ₹</span>
                  <span style={{ flex: 0.6 }}>MOQ</span>
                  <span style={{ flex: 0.7 }}>Stock</span>
                  <span style={{ flex: 0.6 }}>Days</span>
                  <span style={{ flex: 0.5 }}></span>
                </div>

                {listed.length > 0 && (
                  <>
                    <div style={{ padding: '6px 16px', fontSize: 10, fontWeight: 700, color: '#30D158', background: '#001A08', letterSpacing: 0.5 }}>
                      ● MY LISTINGS ({listed.length})
                    </div>
                    {listed.map(item => (
                      <InlineRow key={item.variant_id} item={item} listing={myListings[item.variant_id]}
                        edited={!!edits[item.variant_id]} getVal={getVal} setVal={setVal} />
                    ))}
                  </>
                )}

                {unlisted.length > 0 && (
                  <>
                    <button onClick={() => setShowUnlisted(p => !p)}
                      style={{ width: '100%', padding: '6px 16px', fontSize: 10, fontWeight: 700, color: '#636366', background: '#1C1C1E', border: 'none', textAlign: 'left', cursor: 'pointer', letterSpacing: 0.5 }}>
                      {showUnlisted ? '▾' : '▸'} NOT LISTED ({unlisted.length}) — set price to add
                    </button>
                    {showUnlisted && unlisted.map(item => (
                      <InlineRow key={item.variant_id} item={item} listing={null}
                        edited={!!edits[item.variant_id]} getVal={getVal} setVal={setVal} />
                    ))}
                  </>
                )}

                {catalogue.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 40, color: '#636366', fontSize: 13 }}>No products found</div>
                )}
              </div>

              {/* PAGINATION */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderTop: '1px solid #2C2C2E', flexShrink: 0, background: '#1C1C1E' }}>
                  <span style={{ fontSize: 11, color: '#636366' }}>
                    {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalItems)} of {totalItems} products
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button onClick={() => goToPage(page - 1)} disabled={page === 1}
                      style={{ background: '#2C2C2E', border: 'none', color: page === 1 ? '#636366' : '#fff', borderRadius: 6, padding: '5px 10px', cursor: page === 1 ? 'default' : 'pointer', fontSize: 13 }}>←</button>
                    {(() => {
                      const pages = [];
                      if (totalPages <= 7) {
                        for (let i = 1; i <= totalPages; i++) pages.push(i);
                      } else {
                        pages.push(1);
                        if (page > 3) pages.push('...');
                        for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
                        if (page < totalPages - 2) pages.push('...');
                        pages.push(totalPages);
                      }
                      return pages.map((p, i) => p === '...' ? (
                        <span key={`d${i}`} style={{ color: '#636366', fontSize: 12, padding: '0 2px' }}>…</span>
                      ) : (
                        <button key={p} onClick={() => goToPage(p)}
                          style={{ background: page === p ? '#185FA5' : '#2C2C2E', border: 'none', color: '#fff', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', fontSize: 12, fontWeight: page === p ? 700 : 400, minWidth: 30 }}>{p}</button>
                      ));
                    })()}
                    <button onClick={() => goToPage(page + 1)} disabled={page === totalPages}
                      style={{ background: '#2C2C2E', border: 'none', color: page === totalPages ? '#636366' : '#fff', borderRadius: 6, padding: '5px 10px', cursor: page === totalPages ? 'default' : 'pointer', fontSize: 13 }}>→</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'bulk_add' && (
        <BulkAddTab
          catalogue={catalogue}
          categories={categories}
          myListings={myListings}
          onAdded={() => { loadData(page); setTab('existing'); }}
        />
      )}

      {tab === 'import' && (
        <ImportTab categories={categories} onImported={() => loadData(page)} />
      )}
    </div>
  );
}

// ============================================================
// INLINE ROW (My Inventory tab)
// ============================================================
function InlineRow({ item, listing, edited, getVal, setVal }) {
  const isLowStock = listing && listing.stock_qty < 10;
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '7px 16px', borderBottom: '1px solid #222', background: edited ? 'rgba(24,95,165,0.1)' : 'transparent' }}>
      <span style={{ flex: 2.5 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: edited ? '#64B5F6' : '#fff' }}>{item.generic_name}</div>
        <div style={{ fontSize: 10, color: '#0A84FF' }}>
          {item.brand_name}
          {item.attributes?.pack_size && <span style={{ color: '#636366' }}> · {item.attributes.pack_size}</span>}
        </div>
      </span>
      <EC flex={0.8} value={getVal(item.variant_id, 'price')} onChange={v => setVal(item.variant_id, 'price', v)} placeholder="0" accent={!listing} />
      <EC flex={0.8} value={getVal(item.variant_id, 'offer_price')} onChange={v => setVal(item.variant_id, 'offer_price', v)} placeholder="—" />
      <EC flex={0.6} value={getVal(item.variant_id, 'min_order_qty')} onChange={v => setVal(item.variant_id, 'min_order_qty', v)} placeholder="1" />
      <EC flex={0.7} value={getVal(item.variant_id, 'stock_qty')} onChange={v => setVal(item.variant_id, 'stock_qty', v)} placeholder="0" warn={isLowStock} />
      <EC flex={0.6} value={getVal(item.variant_id, 'delivery_days')} onChange={v => setVal(item.variant_id, 'delivery_days', v)} placeholder="1" />
      <span style={{ flex: 0.5, textAlign: 'center' }}>
        {listing
          ? <span style={{ fontSize: 10, color: isLowStock ? '#FF9500' : '#30D158' }}>{isLowStock ? '⚠' : '✓'}</span>
          : <span style={{ fontSize: 10, color: '#636366' }}>New</span>}
      </span>
    </div>
  );
}

function EC({ flex, value, onChange, placeholder, accent, warn }) {
  return (
    <span style={{ flex }}>
      <input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '88%', background: accent ? '#0A2510' : warn ? '#2A1500' : '#2C2C2E', border: `1px solid ${accent ? '#30D158' : warn ? '#FF9500' : '#3A3A3C'}`, borderRadius: 6, color: '#fff', padding: '5px 7px', fontSize: 12, outline: 'none' }} />
    </span>
  );
}

// ============================================================
// BULK ADD TAB
// ============================================================
function BulkAddTab({ catalogue, categories, myListings, onAdded }) {
  const [catFilter, setCatFilter] = useState('');
  const [search, setSearch] = useState('');
  const [prices, setPrices] = useState({});
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  const unlisted = catalogue.filter(item => !myListings[item.variant_id]);
  const filtered = unlisted.filter(item => {
    const matchCat = !catFilter || item.category_id === catFilter;
    const matchSearch = !search ||
      item.generic_name?.toLowerCase().includes(search.toLowerCase()) ||
      item.brand_name?.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const setP = (vid, field, val) => setPrices(p => ({ ...p, [vid]: { ...p[vid], [field]: val } }));
  const getP = (vid, field) => prices[vid]?.[field] ?? '';

  const fStyle = (val, mandatory, hasLeftPad) => ({
    width: '88%',
    background: val ? '#003A10' : '#2C2C2E',
    border: `2px solid ${val ? '#30D158' : mandatory ? '#FF9500' : '#3A3A3C'}`,
    borderRadius: 8,
    color: '#fff',
    padding: hasLeftPad ? '7px 8px 7px 20px' : '7px 8px',
    fontSize: 13,
    fontWeight: val ? 700 : 400,
    outline: 'none',
    transition: 'all 0.15s',
  });

  const isRowReady = (vid) => {
    const p = prices[vid];
    return !!(p?.price && p?.offer_price && p?.min_order_qty && p?.stock_qty !== undefined && p?.stock_qty !== '' && p?.delivery_days);
  };
  const readyItems = filtered.filter(item => isRowReady(item.variant_id));
  const readyCount = readyItems.length;

  const saveAll = async () => {
    if (!readyCount) return;
    setSaving(true); setResult(null);
    let saved = 0, failed = 0;
    for (const item of readyItems) {
      const p = prices[item.variant_id];
      try {
        await api.post('/listings/upsert', {
          variant_id: item.variant_id,
          price: parseFloat(p.price),
          offer_price: p.offer_price ? parseFloat(p.offer_price) : null,
          min_order_qty: parseInt(p.min_order_qty) || 1,
          stock_qty: parseInt(p.stock_qty) || 0,
          delivery_days: parseInt(p.delivery_days) || 1,
          delivery_radius_km: 20,
        });
        saved++;
      } catch { failed++; }
    }
    setPrices({});
    setResult({ saved, failed });
    setSaving(false);
    if (saved > 0) onAdded();
  };

  const grouped = {};
  filtered.forEach(item => {
    if (!grouped[item.product_id]) {
      grouped[item.product_id] = { product_id: item.product_id, generic_name: item.generic_name, category_name: item.category_name, hsn_code: item.hsn_code, variants: [] };
    }
    grouped[item.product_id].variants.push(item);
  });
  const groups = Object.values(grouped);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #2C2C2E', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
            style={{ flex: 1, background: '#1C1C1E', border: '1px solid #3A3A3C', borderRadius: 8, color: catFilter ? '#fff' : '#636366', padding: '9px 12px', fontSize: 13, outline: 'none' }}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.category_id} value={c.category_id}>{c.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: '#8E8E93' }}>
            {filtered.length} products · <span style={{ color: readyCount > 0 ? '#30D158' : '#636366', fontWeight: 600 }}>{readyCount} ready</span>
          </div>
          <button onClick={saveAll} disabled={saving || readyCount === 0}
            style={{ background: readyCount > 0 ? '#30D158' : '#2C2C2E', color: readyCount > 0 ? '#000' : '#636366', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: readyCount > 0 ? 'pointer' : 'not-allowed', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving...' : `💾 Add ${readyCount} to Inventory`}
          </button>
        </div>
        {result && (
          <div style={{ marginTop: 8, background: result.failed ? '#2A1500' : '#003A10', border: `1px solid ${result.failed ? '#FF9500' : '#1D9E75'}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: result.failed ? '#FF9500' : '#30D158' }}>
            ✓ {result.saved} added{result.failed > 0 ? ` · ⚠ ${result.failed} failed` : ''}
          </div>
        )}
      </div>

      <div style={{ padding: '8px 16px', background: '#0A1F35', flexShrink: 0, fontSize: 11, color: '#64B5F6' }}>
        💡 Fill in all fields to add a product to your inventory.
      </div>

      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', background: '#1C1C1E', borderBottom: '1px solid #2C2C2E', flexShrink: 0 }}>
        <div style={{ flex: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>Product / Brand</span>
          <input placeholder="🔍 Search..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, background: '#2C2C2E', border: '1px solid #3A3A3C', borderRadius: 6, color: '#fff', padding: '4px 8px', fontSize: 11, outline: 'none', maxWidth: 140 }} />
        </div>
        {['Price ₹ *', 'Offer ₹ *', 'MOQ *', 'Stock *', 'Days *'].map((h, i) => (
          <div key={i} style={{ flex: i < 2 ? 0.9 : i < 4 ? 0.7 : 0.6, fontSize: 10, fontWeight: 700, color: '#FF9500', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</div>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {groups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#636366', fontSize: 13 }}>
            {unlisted.length === 0 ? '🎉 All products listed!' : 'No products match'}
          </div>
        ) : groups.map(group => (
          <div key={group.product_id}>
            <div style={{ padding: '10px 16px 4px', background: '#1C1C1E', borderBottom: '1px solid #2C2C2E' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{group.generic_name}</span>
                <span style={{ fontSize: 10, color: '#185FA5', background: '#0A1F35', padding: '2px 8px', borderRadius: 10 }}>{group.category_name}</span>
                {group.hsn_code && <span style={{ fontSize: 10, color: '#636366', fontFamily: 'monospace' }}>HSN: {group.hsn_code}</span>}
              </div>
            </div>
            {group.variants.map((item, vi) => {
              const hasPrice = isRowReady(item.variant_id);
              return (
                <div key={item.variant_id} style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #222', background: hasPrice ? 'rgba(48,209,88,0.07)' : vi % 2 === 0 ? '#181818' : '#1A1A1A' }}>
                  <div style={{ flex: 3 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, color: '#0A84FF', fontWeight: 600 }}>{item.brand_name}</span>
                      {item.attributes?.pack_size && <span style={{ fontSize: 11, color: '#8E8E93', background: '#2C2C2E', padding: '1px 8px', borderRadius: 6 }}>{item.attributes.pack_size}</span>}
                      {hasPrice && <span style={{ fontSize: 10, color: '#30D158', fontWeight: 700 }}>✓ Ready</span>}
                    </div>
                  </div>
                  {[['price', true], ['offer_price', true], ['min_order_qty', false], ['stock_qty', false], ['delivery_days', false]].map(([field, hasRupee], fi) => (
                    <div key={field} style={{ flex: fi < 2 ? 0.9 : fi < 4 ? 0.7 : 0.6 }}>
                      <div style={{ position: 'relative' }}>
                        {hasRupee && <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#8E8E93', pointerEvents: 'none' }}>₹</span>}
                        <input type="number" value={getP(item.variant_id, field)} onChange={e => setP(item.variant_id, field, e.target.value)}
                          placeholder={field === 'price' || field === 'offer_price' ? '0' : field === 'min_order_qty' ? '1' : field === 'stock_qty' ? '0' : '1'}
                          style={fStyle(getP(item.variant_id, field), true, hasRupee)} />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {readyCount > 0 && (
        <div style={{ padding: '12px 16px', background: '#003A10', borderTop: '2px solid #30D158', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, color: '#30D158', fontWeight: 600 }}>{readyCount} product{readyCount > 1 ? 's' : ''} ready</div>
          <button onClick={saveAll} disabled={saving}
            style={{ background: '#30D158', color: '#000', border: 'none', borderRadius: 10, padding: '10px 24px', fontSize: 14, fontWeight: 800, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving...' : '💾 Add to Inventory'}
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// IMPORT TAB
// ============================================================
function ImportTab({ categories, onImported }) {
  const [rows, setRows] = useState([]);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  const downloadTemplate = () => {
    const headers = 'product_name,hsn_code,category_name,tax_percent,primary_unit,brand_name,manufacturer,grade,weight_kg,price,offer_price,min_order_qty,stock_qty,delivery_days';
    const ex1 = 'White Cement,2523,Cement,18,bag,Birla White,Birla Corp,Premium,40,850,800,50,500,1';
    const ex2 = 'AAC Block,6810,Blocks,18,piece,Renacon,Renacon Pvt Ltd,600x200x150,,32,,10,2000,2';
    const blob = new Blob([[headers, ex1, ex2].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'vendornet_new_products_template.csv';
    a.click();
  };

  const parseCSV = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f); setResult(null);
    const reader = new FileReader();
    reader.onload = ev => {
      const lines = ev.target.result.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const parsed = lines.slice(1).map((line, i) => {
        const vals = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const row = {};
        headers.forEach((h, j) => { row[h] = vals[j] || ''; });
        row._i = i + 2;
        return row;
      }).filter(r => r.product_name && r.brand_name);
      setRows(parsed);
    };
    reader.readAsText(f);
    e.target.value = '';
  };

  const runImport = async () => {
    setUploading(true);
    let added = 0, pending = 0, failed = 0, errors = [];
    for (const row of rows) {
      try {
        const cat = categories.find(c => c.name.toLowerCase() === row.category_name?.toLowerCase());
        const res = await api.post('/listings/request-variant', {
          generic_name: row.product_name,
          hsn_code: row.hsn_code || null,
          category_id: cat?.category_id || null,
          tax_percentage: parseFloat(row.tax_percent) || 0,
          primary_unit: row.primary_unit || null,
          brand_name: row.brand_name,
          manufacturer: row.manufacturer || null,
          attributes: {
            ...(row.grade ? { grade: row.grade } : {}),
            ...(row.weight_kg ? { weight_kg: parseFloat(row.weight_kg) } : {}),
          },
        });
        const vid = res.data.variant?.variant_id;
        const isApproved = res.data.variant?.request_status === 'approved';
        if (row.price && vid && isApproved) {
          await api.post('/listings/upsert', {
            variant_id: vid,
            price: parseFloat(row.price),
            offer_price: row.offer_price ? parseFloat(row.offer_price) : null,
            min_order_qty: parseInt(row.min_order_qty) || 1,
            stock_qty: parseInt(row.stock_qty) || 0,
            delivery_days: parseInt(row.delivery_days) || 1,
            delivery_radius_km: 20,
          }).catch(() => {});
          added++;
        } else { pending++; }
      } catch (err) {
        failed++;
        errors.push(`Row ${row._i} (${row.product_name}): ${err.response?.data?.error || err.message}`);
      }
    }
    setResult({ added, pending, failed, errors });
    setRows([]); setFile(null);
    setUploading(false);
    if (added > 0) onImported();
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
      <div style={{ background: '#2C2C2E', borderRadius: 12, padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Import New Products via CSV</div>
        <div style={{ fontSize: 11, color: '#8E8E93', lineHeight: 1.7, marginBottom: 12 }}>
          Use for bulk-adding new products/brands not in catalogue yet.<br />
          • Existing brands → matched instantly<br />
          • New products → submitted for admin approval
        </div>
        <button onClick={downloadTemplate}
          style={{ background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          📥 Download CSV Template
        </button>
      </div>

      <div style={{ background: '#2C2C2E', borderRadius: 12, padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 10 }}>Upload CSV</div>
        <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 20, border: '2px dashed #3A3A3C', borderRadius: 10, cursor: 'pointer', marginBottom: 10 }}>
          <span style={{ fontSize: 24 }}>📂</span>
          <span style={{ fontSize: 12, color: '#8E8E93' }}>{file ? file.name : 'Tap to choose CSV file'}</span>
          <input type="file" accept=".csv" style={{ display: 'none' }} onChange={parseCSV} />
        </label>
        {rows.length > 0 && (
          <>
            <div style={{ fontSize: 11, color: '#8E8E93', marginBottom: 8 }}>{rows.length} rows ready</div>
            <div style={{ background: '#1C1C1E', borderRadius: 8, overflow: 'hidden', marginBottom: 12, maxHeight: 200, overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr', padding: '6px 10px', background: '#2C2C2E', fontSize: 9, color: '#636366', fontWeight: 700, textTransform: 'uppercase' }}>
                {['Product', 'Brand', 'Category', 'HSN', 'Price'].map(h => <span key={h}>{h}</span>)}
              </div>
              {rows.map((r, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr', padding: '7px 10px', borderBottom: '1px solid #2C2C2E', fontSize: 11 }}>
                  <span style={{ color: '#fff' }}>{r.product_name}</span>
                  <span style={{ color: '#0A84FF' }}>{r.brand_name}</span>
                  <span style={{ color: '#8E8E93' }}>{r.category_name || '—'}</span>
                  <span style={{ color: '#8E8E93' }}>{r.hsn_code || '—'}</span>
                  <span style={{ color: '#30D158' }}>{r.price ? `₹${r.price}` : '—'}</span>
                </div>
              ))}
            </div>
            <button onClick={runImport} disabled={uploading}
              style={{ width: '100%', background: '#30D158', color: '#000', border: 'none', borderRadius: 8, padding: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: uploading ? 0.6 : 1 }}>
              {uploading ? 'Importing...' : `📤 Import ${rows.length} Products`}
            </button>
          </>
        )}
      </div>

      {result && (
        <div style={{ background: result.failed > 0 ? '#1A1000' : '#001A08', border: `1px solid ${result.failed > 0 ? '#FF9500' : '#1D9E75'}`, borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: result.failed > 0 ? '#FF9500' : '#30D158', marginBottom: 8 }}>Import Complete</div>
          <div style={{ fontSize: 12, color: '#8E8E93', marginBottom: 6 }}>
            ✓ {result.added} added · {result.pending} pending approval{result.failed > 0 ? ` · ⚠ ${result.failed} failed` : ''}
          </div>
          {result.errors.slice(0, 5).map((e, i) => (
            <div key={i} style={{ fontSize: 11, color: '#FF453A', marginTop: 4 }}>{e}</div>
          ))}
        </div>
      )}
    </div>
  );
}
