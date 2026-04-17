import { useState, useEffect } from 'react';
import api from '../services/api';

export default function AddListingModal({ onClose, onSave }) {
  const [step, setStep] = useState('product'); // product | variant | listing
  const [products, setProducts] = useState([]);
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [form, setForm] = useState({
    price: '', offer_price: '', min_order_qty: '1',
    stock_qty: '', delivery_days: '1', delivery_radius_km: '20',
    warehouse_lat: '', warehouse_lng: '',
  });

  useEffect(() => { loadCatalogue(); }, []);

  const loadCatalogue = async () => {
    setLoading(true);
    try {
      const res = await api.get('/listings/catalogue');
      const cat = res.data.catalogue || [];
      // Group by product
      const prodMap = {};
      cat.forEach(item => {
        if (!prodMap[item.product_id]) {
          prodMap[item.product_id] = {
            product_id: item.product_id,
            generic_name: item.generic_name,
            hsn_code: item.hsn_code,
            category_name: item.category_name,
            variants: [],
          };
        }
        prodMap[item.product_id].variants.push({
          variant_id: item.variant_id,
          brand_name: item.brand_name,
          attributes: item.attributes,
        });
      });
      setProducts(Object.values(prodMap));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const selectProduct = (product) => {
    setSelectedProduct(product);
    setVariants(product.variants);
    setStep('variant');
    setSearch('');
    setError('');
  };

  const selectVariant = (variant) => {
    setSelectedVariant(variant);
    setStep('listing');
    setError('');
  };

  const submit = async () => {
    if (!form.price) return setError('Price is required');
    if (!form.stock_qty) return setError('Stock quantity is required');
    setSaving(true); setError('');
    try {
      const res = await api.post('/listings/upsert', {
        variant_id: selectedVariant.variant_id,
        price: parseFloat(form.price),
        offer_price: form.offer_price ? parseFloat(form.offer_price) : null,
        min_order_qty: parseInt(form.min_order_qty) || 1,
        stock_qty: parseInt(form.stock_qty),
        delivery_days: parseInt(form.delivery_days) || 1,
        delivery_radius_km: parseFloat(form.delivery_radius_km) || 20,
        warehouse_lat: form.warehouse_lat ? parseFloat(form.warehouse_lat) : null,
        warehouse_lng: form.warehouse_lng ? parseFloat(form.warehouse_lng) : null,
      });
      onSave(res.data.listing, res.data.action);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save listing');
    } finally { setSaving(false); }
  };

  const filteredProducts = products.filter(p =>
    p.generic_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.category_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.hsn_code?.includes(search)
  );

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={s.header}>
          <div>
            <div style={s.title}>Add to Inventory</div>
            <div style={s.breadcrumb}>
              <span style={{ color: step === 'product' ? '#0A84FF' : '#8E8E93' }}>Product</span>
              <span style={s.sep}>›</span>
              <span style={{ color: step === 'variant' ? '#0A84FF' : '#8E8E93' }}>Brand</span>
              <span style={s.sep}>›</span>
              <span style={{ color: step === 'listing' ? '#0A84FF' : '#8E8E93' }}>Price & Stock</span>
            </div>
          </div>
          <button onClick={onClose} style={s.closeBtn}>✕</button>
        </div>

        {error && <div style={s.error}>{error}</div>}

        {/* Step 1: Select Product */}
        {step === 'product' && (
          <div>
            <input style={s.search} placeholder="Search product, category or HSN..."
              value={search} onChange={e => setSearch(e.target.value)} autoFocus />
            {loading ? (
              <div style={s.loading}>Loading catalogue...</div>
            ) : (
              <div style={s.list}>
                {filteredProducts.map(p => (
                  <div key={p.product_id} style={s.item} onClick={() => selectProduct(p)}>
                    <div>
                      <div style={s.itemName}>{p.generic_name}</div>
                      <div style={s.itemMeta}>{p.category_name} · HSN: {p.hsn_code || '—'}</div>
                    </div>
                    <div style={s.itemRight}>
                      <span style={s.variantCount}>{p.variants.length} brand{p.variants.length !== 1 ? 's' : ''}</span>
                      <span style={s.arrow}>›</span>
                    </div>
                  </div>
                ))}
                {filteredProducts.length === 0 && (
                  <div style={s.empty}>No products found</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Select Variant/Brand */}
        {step === 'variant' && (
          <div>
            <button onClick={() => setStep('product')} style={s.backBtn}>← Back</button>
            <div style={s.selectedInfo}>
              <div style={s.selectedName}>{selectedProduct.generic_name}</div>
              <div style={s.selectedMeta}>{selectedProduct.category_name} · HSN: {selectedProduct.hsn_code}</div>
            </div>
            <div style={s.sectionLabel}>Select Brand</div>
            <div style={s.list}>
              {variants.map(v => (
                <div key={v.variant_id} style={s.item} onClick={() => selectVariant(v)}>
                  <div>
                    <div style={s.itemName}>{v.brand_name}</div>
                    {v.attributes && Object.keys(v.attributes).length > 0 && (
                      <div style={s.itemMeta}>
                        {Object.entries(v.attributes).slice(0, 3).map(([k, val]) => `${k}: ${val}`).join(' · ')}
                      </div>
                    )}
                  </div>
                  <span style={s.arrow}>›</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Price & Stock */}
        {step === 'listing' && (
          <div>
            <button onClick={() => setStep('variant')} style={s.backBtn}>← Back</button>
            <div style={s.selectedInfo}>
              <div style={s.selectedName}>{selectedProduct.generic_name} — {selectedVariant.brand_name}</div>
              <div style={s.selectedMeta}>{selectedProduct.category_name}</div>
            </div>

            <div style={s.formGrid}>
              <Field label="Price (₹) *" value={form.price} onChange={v => setForm(f => ({ ...f, price: v }))} type="number" placeholder="e.g. 380" />
              <Field label="Offer Price (₹)" value={form.offer_price} onChange={v => setForm(f => ({ ...f, offer_price: v }))} type="number" placeholder="Optional" />
              <Field label="Stock Qty *" value={form.stock_qty} onChange={v => setForm(f => ({ ...f, stock_qty: v }))} type="number" placeholder="e.g. 500" />
              <Field label="Min Order Qty" value={form.min_order_qty} onChange={v => setForm(f => ({ ...f, min_order_qty: v }))} type="number" placeholder="e.g. 10" />
              <Field label="Delivery Days" value={form.delivery_days} onChange={v => setForm(f => ({ ...f, delivery_days: v }))} type="number" placeholder="e.g. 1" />
              <Field label="Delivery Radius (km)" value={form.delivery_radius_km} onChange={v => setForm(f => ({ ...f, delivery_radius_km: v }))} type="number" placeholder="e.g. 20" />
              <Field label="Warehouse Lat" value={form.warehouse_lat} onChange={v => setForm(f => ({ ...f, warehouse_lat: v }))} type="number" placeholder="e.g. 9.9252" />
              <Field label="Warehouse Lng" value={form.warehouse_lng} onChange={v => setForm(f => ({ ...f, warehouse_lng: v }))} type="number" placeholder="e.g. 78.1198" />
            </div>

            <button onClick={submit} disabled={saving} style={s.submitBtn}>
              {saving ? 'Saving...' : '+ Add to Inventory'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type, placeholder }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#8E8E93', marginBottom: 4 }}>{label}</div>
      <input type={type || 'text'} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', background: '#3A3A3C', border: '1px solid #636366', borderRadius: 8, color: '#fff', padding: '8px 10px', fontSize: 13, outline: 'none' }} />
    </div>
  );
}

const s = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  modal: { background: '#1C1C1E', border: '1px solid #3A3A3C', borderRadius: 16, width: '100%', maxWidth: 460, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '18px 18px 12px', borderBottom: '1px solid #2C2C2E', flexShrink: 0 },
  title: { fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 },
  sep: { color: '#3A3A3C' },
  closeBtn: { background: '#3A3A3C', border: 'none', color: '#8E8E93', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', fontSize: 14, flexShrink: 0 },
  error: { background: '#2A0A0A', border: '1px solid #FF453A', borderRadius: 8, padding: '8px 12px', margin: '10px 16px 0', fontSize: 12, color: '#FF453A' },
  search: { width: 'calc(100% - 32px)', margin: '12px 16px', background: '#2C2C2E', border: '1px solid #3A3A3C', borderRadius: 8, color: '#fff', padding: '9px 12px', fontSize: 13, outline: 'none' },
  list: { overflowY: 'auto', maxHeight: 340, padding: '0 8px 12px' },
  item: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 10px', borderRadius: 10, cursor: 'pointer', marginBottom: 2, borderBottom: '1px solid #2C2C2E' },
  itemName: { fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 2 },
  itemMeta: { fontSize: 10, color: '#8E8E93' },
  itemRight: { display: 'flex', alignItems: 'center', gap: 8 },
  variantCount: { fontSize: 10, color: '#0A84FF', background: '#0A1F35', padding: '2px 7px', borderRadius: 6 },
  arrow: { fontSize: 18, color: '#636366' },
  loading: { textAlign: 'center', padding: 32, color: '#8E8E93', fontSize: 13 },
  empty: { textAlign: 'center', padding: 32, color: '#636366', fontSize: 13 },
  backBtn: { background: 'none', border: 'none', color: '#0A84FF', fontSize: 12, cursor: 'pointer', padding: '0 16px', margin: '8px 0 0' },
  selectedInfo: { padding: '10px 16px 12px', borderBottom: '1px solid #2C2C2E', marginBottom: 4 },
  selectedName: { fontSize: 13, fontWeight: 700, color: '#fff' },
  selectedMeta: { fontSize: 10, color: '#8E8E93', marginTop: 2 },
  sectionLabel: { fontSize: 10, fontWeight: 600, color: '#636366', textTransform: 'uppercase', letterSpacing: 0.5, padding: '8px 16px 4px' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '12px 16px', overflowY: 'auto', maxHeight: 320 },
  submitBtn: { width: 'calc(100% - 32px)', margin: '8px 16px 16px', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 10, padding: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer' },
};
