import { useState, useEffect } from 'react';
import api from '../services/api';

export default function Inventory() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState({});
  const [saving, setSaving] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => { loadListings(); }, []);

  const loadListings = async () => {
    try {
      const res = await api.get('/listings/my');
      setListings(res.data.listings);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (listing) => {
    setEditing(prev => ({
      ...prev,
      [listing.listing_id]: {
        price: listing.price,
        offer_price: listing.offer_price || '',
        min_order_qty: listing.min_order_qty,
        stock_qty: listing.stock_qty,
        delivery_days: listing.delivery_days,
        is_active: listing.is_active
      }
    }));
  };

  const saveEdit = async (listingId) => {
    setSaving(listingId);
    try {
      await api.put(`/listings/${listingId}`, editing[listingId]);
      setEditing(prev => { const n = { ...prev }; delete n[listingId]; return n; });
      loadListings();
    } catch (err) {
      alert('Failed to save');
    } finally {
      setSaving(null);
    }
  };

  const cancelEdit = (listingId) => {
    setEditing(prev => { const n = { ...prev }; delete n[listingId]; return n; });
  };

  const deleteListing = async (listingId, name) => {
    if (!confirm(`Delete listing for ${name}?`)) return;
    setDeleting(listingId);
    try {
      await api.delete(`/listings/${listingId}`);
      setListings(prev => prev.filter(l => l.listing_id !== listingId));
    } catch (err) {
      alert('Failed to delete');
    } finally {
      setDeleting(null);
    }
  };

  const filtered = listings.filter(l =>
    l.generic_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.brand_name?.toLowerCase().includes(search.toLowerCase())
  );

  const lowStock = listings.filter(l => l.stock_qty < 10).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* TOP BAR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #2C2C2E', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Inventory</div>
          <div style={{ fontSize: 10, color: '#8E8E93', marginTop: 1 }}>
            {listings.length} listings · {lowStock > 0 ? <span style={{ color: '#FF9500' }}>{lowStock} low stock</span> : <span style={{ color: '#30D158' }}>All stocked</span>}
          </div>
        </div>
        <button className="btn-primary" onClick={() => window.location.href = '/bulk-upload'}>
          + Bulk Upload
        </button>
      </div>

      {/* SEARCH */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #2C2C2E', flexShrink: 0 }}>
        <input
          placeholder="Search products or brands..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ background: '#2C2C2E', border: '1px solid #3A3A3C', borderRadius: 8, color: '#fff', padding: '8px 12px', fontSize: 12, width: '100%', outline: 'none' }}
        />
      </div>

      {/* LOW STOCK BANNER */}
      {lowStock > 0 && (
        <div style={{ margin: '10px 14px 0', background: '#2A1500', border: '1px solid #FF9500', borderRadius: 10, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: '#FF9500' }}>⚠️ {lowStock} listings are low on stock</div>
          <div style={{ fontSize: 9, color: '#854F0B' }}>Update stock to avoid missed orders</div>
        </div>
      )}

      {/* TABLE HEADER */}
      <div style={{ display: 'flex', padding: '10px 14px', margin: '10px 14px 0', background: '#2C2C2E', borderRadius: '10px 10px 0 0', fontSize: 10, fontWeight: 600, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0 }}>
        <span style={{ flex: 3 }}>Product</span>
        <span style={{ flex: 1 }}>Price</span>
        <span style={{ flex: 1 }}>Offer</span>
        <span style={{ flex: 1 }}>MOQ</span>
        <span style={{ flex: 1 }}>Stock</span>
        <span style={{ flex: 1 }}>Days</span>
        <span style={{ flex: 1 }}>Status</span>
        <span style={{ flex: 2 }}>Actions</span>
      </div>

      {/* LIST */}
      <div style={{ flex: 1, overflowY: 'auto', margin: '0 14px 14px', background: '#2C2C2E', borderRadius: '0 0 10px 10px' }}>
        {loading ? (
          <div style={{ color: '#8E8E93', textAlign: 'center', padding: 40 }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ color: '#8E8E93', textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🏷</div>
            <div>No listings found</div>
            <button className="btn-primary" style={{ marginTop: 12 }} onClick={() => window.location.href = '/bulk-upload'}>Upload price list</button>
          </div>
        ) : (
          filtered.map(listing => {
            const isEditing = !!editing[listing.listing_id];
            const editData = editing[listing.listing_id] || {};
            const isLowStock = listing.stock_qty < 10;

            return (
              <div key={listing.listing_id} style={{
                display: 'flex', padding: '12px 14px',
                borderBottom: '1px solid #3A3A3C',
                alignItems: 'center', fontSize: 13,
                background: isEditing ? '#0A1F35' : 'transparent'
              }}>
                <span style={{ flex: 3 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>{listing.generic_name}</div>
                  <div style={{ fontSize: 11, color: '#0A84FF' }}>{listing.brand_name}</div>
                  {listing.attributes && (
                    <div style={{ fontSize: 10, color: '#3A3A3C' }}>
                      {Object.values(listing.attributes).join(' · ')}
                    </div>
                  )}
                </span>

                {isEditing ? (
                  <>
                    <span style={{ flex: 1 }}><input type="number" style={{ width: '90%', background: '#3A3A3C', border: '1px solid #185FA5', borderRadius: 6, color: '#fff', padding: '4px 8px', fontSize: 12 }} value={editData.price} onChange={e => setEditing(p => ({ ...p, [listing.listing_id]: { ...editData, price: e.target.value } }))} /></span>
                    <span style={{ flex: 1 }}><input type="number" placeholder="—" style={{ width: '90%', background: '#3A3A3C', border: '1px solid #3A3A3C', borderRadius: 6, color: '#fff', padding: '4px 8px', fontSize: 12 }} value={editData.offer_price} onChange={e => setEditing(p => ({ ...p, [listing.listing_id]: { ...editData, offer_price: e.target.value } }))} /></span>
                    <span style={{ flex: 1 }}><input type="number" style={{ width: '90%', background: '#3A3A3C', border: '1px solid #3A3A3C', borderRadius: 6, color: '#fff', padding: '4px 8px', fontSize: 12 }} value={editData.min_order_qty} onChange={e => setEditing(p => ({ ...p, [listing.listing_id]: { ...editData, min_order_qty: e.target.value } }))} /></span>
                    <span style={{ flex: 1 }}><input type="number" style={{ width: '90%', background: '#3A3A3C', border: '1px solid #3A3A3C', borderRadius: 6, color: '#fff', padding: '4px 8px', fontSize: 12 }} value={editData.stock_qty} onChange={e => setEditing(p => ({ ...p, [listing.listing_id]: { ...editData, stock_qty: e.target.value } }))} /></span>
                    <span style={{ flex: 1 }}><input type="number" style={{ width: '90%', background: '#3A3A3C', border: '1px solid #3A3A3C', borderRadius: 6, color: '#fff', padding: '4px 8px', fontSize: 12 }} value={editData.delivery_days} onChange={e => setEditing(p => ({ ...p, [listing.listing_id]: { ...editData, delivery_days: e.target.value } }))} /></span>
                    <span style={{ flex: 1 }}>
                      <select style={{ width: '90%', background: '#3A3A3C', border: '1px solid #3A3A3C', borderRadius: 6, color: '#fff', padding: '4px 8px', fontSize: 11 }} value={editData.is_active} onChange={e => setEditing(p => ({ ...p, [listing.listing_id]: { ...editData, is_active: e.target.value === 'true' } }))}>
                        <option value="true">Active</option>
                        <option value="false">Off</option>
                      </select>
                    </span>
                    <span style={{ flex: 2, display: 'flex', gap: 4 }}>
                      <button onClick={() => saveEdit(listing.listing_id)} disabled={saving === listing.listing_id} style={{ flex: 1, background: '#003A10', color: '#30D158', border: 'none', borderRadius: 6, padding: '5px 0', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                        {saving === listing.listing_id ? '...' : 'Save'}
                      </button>
                      <button onClick={() => cancelEdit(listing.listing_id)} style={{ background: '#2C2C2E', color: '#8E8E93', border: 'none', borderRadius: 6, padding: '5px 8px', fontSize: 11, cursor: 'pointer' }}>✗</button>
                    </span>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1, fontWeight: 600, color: '#fff' }}>₹{listing.price}</span>
                    <span style={{ flex: 1, color: '#30D158' }}>{listing.offer_price ? `₹${listing.offer_price}` : '—'}</span>
                    <span style={{ flex: 1, color: '#8E8E93' }}>{listing.min_order_qty}</span>
                    <span style={{ flex: 1, color: isLowStock ? '#FF9500' : '#30D158', fontWeight: isLowStock ? 700 : 400 }}>
                      {listing.stock_qty} {isLowStock && '⚠️'}
                    </span>
                    <span style={{ flex: 1, color: '#8E8E93' }}>{listing.delivery_days}d</span>
                    <span style={{ flex: 1 }}>
                      <span className={`chip ${listing.is_active ? 'chip-accepted' : 'chip-rejected'}`}>
                        {listing.is_active ? 'Active' : 'Off'}
                      </span>
                    </span>
                    <span style={{ flex: 2, display: 'flex', gap: 4 }}>
                      <button onClick={() => startEdit(listing)} style={{ background: '#0A1F35', color: '#0A84FF', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Edit</button>
                      <button onClick={() => deleteListing(listing.listing_id, listing.generic_name)} disabled={deleting === listing.listing_id} style={{ background: '#2A0A0A', color: '#FF453A', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                        {deleting === listing.listing_id ? '...' : 'Delete'}
                      </button>
                    </span>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}