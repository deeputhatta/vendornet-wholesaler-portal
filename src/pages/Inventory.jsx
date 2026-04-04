import { useState, useEffect } from 'react';
import api from '../services/api';

export default function Inventory() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState({});
  const [saving, setSaving] = useState(null);

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
      setEditing(prev => {
        const next = { ...prev };
        delete next[listingId];
        return next;
      });
      loadListings();
    } catch (err) {
      alert('Failed to save');
    } finally {
      setSaving(null);
    }
  };

  const cancelEdit = (listingId) => {
    setEditing(prev => {
      const next = { ...prev };
      delete next[listingId];
      return next;
    });
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <div style={styles.header}>
        <h2 style={styles.title}>My Inventory ({listings.length})</h2>
      </div>

      <div style={styles.table}>
        <div style={styles.tableHeader}>
          <span style={{ flex: 3 }}>Product</span>
          <span style={{ flex: 1 }}>Price (₹)</span>
          <span style={{ flex: 1 }}>Offer (₹)</span>
          <span style={{ flex: 1 }}>MOQ</span>
          <span style={{ flex: 1 }}>Stock</span>
          <span style={{ flex: 1 }}>Days</span>
          <span style={{ flex: 1 }}>Status</span>
          <span style={{ flex: 1 }}>Action</span>
        </div>

        {listings.map(listing => {
          const isEditing = !!editing[listing.listing_id];
          const editData = editing[listing.listing_id] || {};

          return (
            <div key={listing.listing_id} style={{
              ...styles.tableRow,
              background: isEditing ? '#f0f7ff' : '#fff'
            }}>
              <span style={{ flex: 3 }}>
                <p style={styles.productName}>{listing.generic_name}</p>
                <p style={styles.brandName}>{listing.brand_name}</p>
                {listing.attributes && (
                  <p style={styles.attrs}>
                    {Object.entries(listing.attributes)
                      .map(([k, v]) => `${v}`)
                      .join(' · ')}
                  </p>
                )}
              </span>

              {isEditing ? (
                <>
                  <span style={{ flex: 1 }}>
                    <input style={styles.editInput} type="number"
                      value={editData.price}
                      onChange={e => setEditing(prev => ({ ...prev, [listing.listing_id]: { ...editData, price: e.target.value } }))} />
                  </span>
                  <span style={{ flex: 1 }}>
                    <input style={styles.editInput} type="number"
                      placeholder="—"
                      value={editData.offer_price}
                      onChange={e => setEditing(prev => ({ ...prev, [listing.listing_id]: { ...editData, offer_price: e.target.value } }))} />
                  </span>
                  <span style={{ flex: 1 }}>
                    <input style={styles.editInput} type="number"
                      value={editData.min_order_qty}
                      onChange={e => setEditing(prev => ({ ...prev, [listing.listing_id]: { ...editData, min_order_qty: e.target.value } }))} />
                  </span>
                  <span style={{ flex: 1 }}>
                    <input style={styles.editInput} type="number"
                      value={editData.stock_qty}
                      onChange={e => setEditing(prev => ({ ...prev, [listing.listing_id]: { ...editData, stock_qty: e.target.value } }))} />
                  </span>
                  <span style={{ flex: 1 }}>
                    <input style={styles.editInput} type="number"
                      value={editData.delivery_days}
                      onChange={e => setEditing(prev => ({ ...prev, [listing.listing_id]: { ...editData, delivery_days: e.target.value } }))} />
                  </span>
                  <span style={{ flex: 1 }}>
                    <select style={styles.editInput}
                      value={editData.is_active}
                      onChange={e => setEditing(prev => ({ ...prev, [listing.listing_id]: { ...editData, is_active: e.target.value === 'true' } }))}>
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </span>
                  <span style={{ flex: 1 }}>
                    <button style={styles.saveBtn} onClick={() => saveEdit(listing.listing_id)} disabled={saving === listing.listing_id}>
                      {saving === listing.listing_id ? '...' : 'Save'}
                    </button>
                    <button style={styles.cancelBtn} onClick={() => cancelEdit(listing.listing_id)}>✗</button>
                  </span>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontWeight: 600 }}>₹{listing.price}</span>
                  <span style={{ flex: 1, color: '#0F6E56' }}>{listing.offer_price ? `₹${listing.offer_price}` : '—'}</span>
                  <span style={{ flex: 1 }}>{listing.min_order_qty}</span>
                  <span style={{ flex: 1, color: listing.stock_qty < 10 ? '#E24B4A' : '#333', fontWeight: listing.stock_qty < 10 ? 600 : 400 }}>
                    {listing.stock_qty}
                  </span>
                  <span style={{ flex: 1 }}>{listing.delivery_days}d</span>
                  <span style={{ flex: 1 }}>
                    <span style={{ background: listing.is_active ? '#EAF3DE' : '#FCEBEB', color: listing.is_active ? '#27500A' : '#791F1F', padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                      {listing.is_active ? 'Active' : 'Off'}
                    </span>
                  </span>
                  <span style={{ flex: 1 }}>
                    <button style={styles.editBtn} onClick={() => startEdit(listing)}>Edit</button>
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 600, color: '#333', margin: 0 },
  table: { background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  tableHeader: { display: 'flex', padding: '12px 16px', background: '#f9f9f9', fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', borderBottom: '1px solid #eee' },
  tableRow: { display: 'flex', padding: '12px 16px', borderBottom: '1px solid #f0f0f0', alignItems: 'center', fontSize: 14 },
  productName: { fontSize: 14, fontWeight: 500, margin: '0 0 2px' },
  brandName: { fontSize: 12, color: '#0F6E56', margin: '0 0 2px' },
  attrs: { fontSize: 11, color: '#888', margin: 0 },
  editInput: { width: '90%', border: '1px solid #ddd', borderRadius: 6, padding: '4px 8px', fontSize: 13, outline: 'none' },
  editBtn: { background: '#E6F1FB', color: '#0C447C', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600 },
  saveBtn: { background: '#0F6E56', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600, marginRight: 4 },
  cancelBtn: { background: '#FCEBEB', color: '#791F1F', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 12, cursor: 'pointer' }
};