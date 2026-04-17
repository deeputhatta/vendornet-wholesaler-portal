import { useState, useEffect, useRef } from 'react';
import api from '../services/api';

const TAX_RATES = [0, 3, 5, 12, 18, 28];
const UNITS = ['bag', 'kg', 'g', 'ton', 'litre', 'ml', 'metre', 'sqft', 'sqm', 'piece', 'box', 'bundle', 'roll', 'sheet', 'set', 'pair', 'nos'];
const ATTR_SUGGESTIONS = {
  'Cement':     ['grade', 'weight_kg', 'pack_type', 'colour', 'is_standard'],
  'Steel / TMT':['grade', 'weight_kg', 'length_m', 'diameter_mm'],
  'Paint':      ['finish', 'volume_l', 'coverage_sqft', 'base'],
  'Electrical': ['wattage', 'voltage', 'type', 'colour'],
  'Plumbing':   ['size_mm', 'material', 'type', 'length_m'],
  'Hardware':   ['size', 'material', 'type', 'finish'],
};

export default function RequestProduct() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [tab, setTab] = useState('variant');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadedMedia, setUploadedMedia] = useState({ images: [], video: null });
  const imageRef = useRef();
  const videoRef = useRef();

  const [variantForm, setVariantForm] = useState({ product_id: '', brand_name: '', manufacturer: '', attributes: {} });
  const [attrKey, setAttrKey] = useState('');
  const [attrVal, setAttrVal] = useState('');

  const [productForm, setProductForm] = useState({
    generic_name: '', category_id: '', hsn_code: '', tax_percentage: '0',
    primary_unit: '', barcode: '', description: '', brand_name: '', manufacturer: '', attributes: {},
  });
  const [prodAttrKey, setProdAttrKey] = useState('');
  const [prodAttrVal, setProdAttrVal] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [catRes, reqRes] = await Promise.all([
        api.get('/listings/catalogue'),
        api.get('/listings/my-requests').catch(() => ({ data: { requests: [] } })),
      ]);
      setCategories(catRes.data.categories || []);
      const cat = catRes.data.catalogue || [];
      const prodMap = {};
      cat.forEach(item => {
        if (!prodMap[item.product_id]) {
          prodMap[item.product_id] = {
            product_id: item.product_id, generic_name: item.generic_name,
            hsn_code: item.hsn_code, category_id: item.category_id, category_name: item.category_name,
          };
        }
      });
      setProducts(Object.values(prodMap));
      setMyRequests(reqRes.data.requests || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const selectedProduct = products.find(p => p.product_id === variantForm.product_id);
  const suggestedAttrs = ATTR_SUGGESTIONS[selectedProduct?.category_name] || [];

  const generateBarcode = () => setProductForm(f => ({ ...f, barcode: 'VN' + Date.now().toString().slice(-10) }));

  const addAttr = (form, setForm, key, val, setKey, setVal) => {
    if (!key.trim()) return;
    setForm(f => ({ ...f, attributes: { ...f.attributes, [key.trim()]: val.trim() } }));
    setKey(''); setVal('');
  };

  const removeAttr = (form, setForm, key) => {
    const attrs = { ...form.attributes };
    delete attrs[key];
    setForm(f => ({ ...f, attributes: attrs }));
  };

  const addMedia = (file, type) => {
    const reader = new FileReader();
    reader.onload = e => {
      if (type === 'video') setUploadedMedia(m => ({ ...m, video: { file, preview: e.target.result } }));
      else setUploadedMedia(m => ({ ...m, images: [...m.images, { file, preview: e.target.result }] }));
    };
    reader.readAsDataURL(file);
  };

  const submitVariant = async () => {
    if (!variantForm.product_id) return setError('Select a product');
    if (!variantForm.brand_name) return setError('Brand name is required');
    setSaving(true); setError(''); setSuccess('');
    try {
      await api.post('/listings/request-variant', {
        product_id: variantForm.product_id,
        brand_name: variantForm.brand_name,
        manufacturer: variantForm.manufacturer,
        attributes: variantForm.attributes,
        hsn_code: selectedProduct?.hsn_code,
      });
      setSuccess('Brand added successfully! It is now live in the catalogue.');
      setVariantForm({ product_id: '', brand_name: '', manufacturer: '', attributes: {} });
      await loadData();
    } catch (err) { setError(err.response?.data?.error || 'Failed to submit'); }
    finally { setSaving(false); }
  };

  const submitProduct = async () => {
    if (!productForm.generic_name) return setError('Product name is required');
    if (!productForm.category_id) return setError('Select a category');
    if (!productForm.hsn_code) return setError('HSN Code is mandatory');
    if (!productForm.brand_name) return setError('Brand name is required');
    setSaving(true); setError(''); setSuccess('');
    try {
      const res = await api.post('/listings/request-variant', {
        generic_name: productForm.generic_name,
        category_id: productForm.category_id,
        hsn_code: productForm.hsn_code,
        description: productForm.description,
        tax_percentage: parseFloat(productForm.tax_percentage) || 0,
        primary_unit: productForm.primary_unit || null,
        barcode: productForm.barcode || null,
        brand_name: productForm.brand_name,
        manufacturer: productForm.manufacturer,
        attributes: productForm.attributes,
      });

      // Upload media if any
      const newProductId = res.data.variant?.product_id;
      if (newProductId && (uploadedMedia.images.length > 0 || uploadedMedia.video)) {
        for (const img of uploadedMedia.images) {
          const fd = new FormData();
          fd.append('file', img.file);
          await api.post(`/listings/product-media/${newProductId}`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          }).catch(() => {});
        }
        if (uploadedMedia.video) {
          const fd = new FormData();
          fd.append('file', uploadedMedia.video.file);
          await api.post(`/listings/product-media/${newProductId}`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          }).catch(() => {});
        }
      }

      setSuccess('Product + brand request submitted! Admin will review and approve it.');
      setProductForm({ generic_name: '', category_id: '', hsn_code: '', tax_percentage: '0', primary_unit: '', barcode: '', description: '', brand_name: '', manufacturer: '', attributes: {} });
      setUploadedMedia({ images: [], video: null });
      await loadData();
    } catch (err) { setError(err.response?.data?.error || 'Failed to submit'); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#8E8E93' }}>Loading...</div></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <input ref={imageRef} type="file" accept="image/jpeg,image/png,image/webp" multiple style={{ display: 'none' }}
        onChange={e => Array.from(e.target.files).forEach(f => addMedia(f, 'image'))} />
      <input ref={videoRef} type="file" accept="video/mp4,video/quicktime" style={{ display: 'none' }}
        onChange={e => e.target.files[0] && addMedia(e.target.files[0], 'video')} />

      <div style={{ padding: '12px 16px', borderBottom: '1px solid #2C2C2E', flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Request Product / Brand</div>
        <div style={{ fontSize: 10, color: '#8E8E93', marginTop: 1 }}>Submit for admin approval · goes live once approved</div>
      </div>

      <div style={{ display: 'flex', gap: 6, padding: '10px 16px', borderBottom: '1px solid #2C2C2E', flexShrink: 0 }}>
        {[['variant','New Brand'],['product','New Product'],['requests',`My Requests (${myRequests.length})`]].map(([key, label]) => (
          <button key={key} onClick={() => { setTab(key); setError(''); setSuccess(''); }}
            style={{ background: tab === key ? '#185FA5' : '#2C2C2E', color: tab === key ? '#fff' : '#8E8E93', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 11, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {error && <div style={s.error}>{error}</div>}
        {success && <div style={s.success}>✓ {success}</div>}

        {/* TAB 1 */}
        {tab === 'variant' && (
          <div style={s.card}>
            <div style={s.cardTitle}>Add new brand to existing product</div>
            <div style={s.hint}>Product exists but your brand is not listed yet.</div>
            <F label="Select Product *">
              <select style={s.select} value={variantForm.product_id}
                onChange={e => setVariantForm(f => ({ ...f, product_id: e.target.value, attributes: {} }))}>
                <option value="">-- Select product --</option>
                {products.map(p => <option key={p.product_id} value={p.product_id}>{p.generic_name} ({p.category_name})</option>)}
              </select>
            </F>
            {selectedProduct && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, marginTop: -6 }}>
                <span style={{ background: '#0A1F35', color: '#0A84FF', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6 }}>{selectedProduct.category_name}</span>
                <span style={{ background: '#2A1F00', color: '#F2C94C', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6 }}>HSN: {selectedProduct.hsn_code || '—'}</span>
              </div>
            )}
            <TF label="Brand Name *" value={variantForm.brand_name} onChange={v => setVariantForm(f => ({ ...f, brand_name: v }))} placeholder="e.g. Zuari" />
            <TF label="Manufacturer" value={variantForm.manufacturer} onChange={v => setVariantForm(f => ({ ...f, manufacturer: v }))} placeholder="e.g. Zuari Cement Ltd" />
            <AttrSection form={variantForm} setForm={setVariantForm} suggestions={suggestedAttrs} attrKey={attrKey} setAttrKey={setAttrKey} attrVal={attrVal} setAttrVal={setAttrVal} addAttr={addAttr} removeAttr={removeAttr} />
            <button onClick={submitVariant} disabled={saving} style={{ ...s.submitBtn, opacity: saving ? 0.6 : 1 }}>{saving ? 'Submitting...' : '+ Add Brand'}</button>
          </div>
        )}

        {/* TAB 2 */}
        {tab === 'product' && (
          <div style={s.card}>
            <div style={s.cardTitle}>Request new product</div>
            <div style={s.hint}>Product doesn't exist in VendorNet. HSN Code is mandatory.</div>
            <div style={s.twoCol}>
              <TF label="Product Name *" value={productForm.generic_name} onChange={v => setProductForm(f => ({ ...f, generic_name: v }))} placeholder="e.g. White Cement" />
              <TF label="HSN Code *" value={productForm.hsn_code} onChange={v => setProductForm(f => ({ ...f, hsn_code: v }))} placeholder="e.g. 2523" />
            </div>
            <F label="Category *">
              <select style={s.select} value={productForm.category_id} onChange={e => setProductForm(f => ({ ...f, category_id: e.target.value }))}>
                <option value="">-- Select --</option>
                {categories.map(c => <option key={c.category_id} value={c.category_id}>{c.name}</option>)}
              </select>
            </F>
            <div style={s.twoCol}>
              <F label="Tax %"><select style={s.select} value={productForm.tax_percentage} onChange={e => setProductForm(f => ({ ...f, tax_percentage: e.target.value }))}>{TAX_RATES.map(r => <option key={r} value={r}>{r}% GST</option>)}</select></F>
              <F label="Primary Unit"><select style={s.select} value={productForm.primary_unit} onChange={e => setProductForm(f => ({ ...f, primary_unit: e.target.value }))}><option value="">Select</option>{UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select></F>
            </div>
            <F label="Barcode">
              <div style={{ display: 'flex', gap: 6 }}>
                <input style={{ ...s.input, flex: 1 }} value={productForm.barcode} onChange={e => setProductForm(f => ({ ...f, barcode: e.target.value }))} placeholder="Scan or enter" />
                <button onClick={generateBarcode} style={{ background: '#2C2C2E', border: '1px solid #3A3A3C', borderRadius: 8, color: '#0A84FF', padding: '0 12px', cursor: 'pointer' }}>🔄</button>
              </div>
            </F>
            <TF label="Description" value={productForm.description} onChange={v => setProductForm(f => ({ ...f, description: v }))} placeholder="Brief description" textarea />
            <div style={{ height: 1, background: '#3A3A3C', margin: '4px 0 16px' }} />
            <div style={s.cardTitle}>Brand Details</div>
            <div style={s.twoCol}>
              <TF label="Brand Name *" value={productForm.brand_name} onChange={v => setProductForm(f => ({ ...f, brand_name: v }))} placeholder="e.g. Zuari" />
              <TF label="Manufacturer" value={productForm.manufacturer} onChange={v => setProductForm(f => ({ ...f, manufacturer: v }))} placeholder="e.g. Zuari Cement Ltd" />
            </div>
            <AttrSection form={productForm} setForm={setProductForm} suggestions={[]} attrKey={prodAttrKey} setAttrKey={setProdAttrKey} attrVal={prodAttrVal} setAttrVal={setProdAttrVal} addAttr={addAttr} removeAttr={removeAttr} />

            {/* Media */}
            <div style={{ height: 1, background: '#3A3A3C', margin: '4px 0 16px' }} />
            <div style={s.cardTitle}>Images & Video <span style={{ fontSize: 10, color: '#8E8E93', fontWeight: 400 }}>(optional)</span></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {uploadedMedia.images.map((img, i) => (
                <div key={i} style={{ position: 'relative', width: 64, height: 64 }}>
                  <img src={img.preview} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid #3A3A3C' }} />
                  <button onClick={() => setUploadedMedia(m => ({ ...m, images: m.images.filter((_, j) => j !== i) }))}
                    style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#FF453A', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                </div>
              ))}
              <button onClick={() => imageRef.current.click()}
                style={{ width: 64, height: 64, borderRadius: 8, border: '2px dashed #3A3A3C', background: '#2C2C2E', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#0A84FF', gap: 2, fontSize: 10 }}>
                📷<span>Add</span>
              </button>
            </div>
            {uploadedMedia.video ? (
              <div style={{ marginBottom: 10 }}>
                <video src={uploadedMedia.video.preview} controls style={{ width: '100%', borderRadius: 8, maxHeight: 140 }} />
                <button onClick={() => setUploadedMedia(m => ({ ...m, video: null }))} style={{ fontSize: 11, color: '#FF453A', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4 }}>Remove video</button>
              </div>
            ) : (
              <button onClick={() => videoRef.current.click()}
                style={{ width: '100%', padding: '10px', border: '2px dashed #3A3A3C', borderRadius: 8, background: '#2C2C2E', cursor: 'pointer', color: '#0A84FF', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 10 }}>
                🎥 Upload Video (optional)
              </button>
            )}
            <button onClick={submitProduct} disabled={saving} style={{ ...s.submitBtn, opacity: saving ? 0.6 : 1 }}>{saving ? 'Submitting...' : '📤 Submit Request'}</button>
          </div>
        )}

        {/* TAB 3 */}
        {tab === 'requests' && (
          <div>
            {myRequests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#8E8E93' }}><div style={{ fontSize: 32, marginBottom: 8 }}>📋</div><div>No requests yet</div></div>
            ) : myRequests.map(r => {
              const sc = { pending: { color: '#FF9500', bg: '#3A2500', label: '⏳ Pending' }, approved: { color: '#30D158', bg: '#003A10', label: '✓ Approved' }, rejected: { color: '#FF453A', bg: '#2A0A0A', label: '✗ Rejected' } }[r.request_status] || { color: '#FF9500', bg: '#3A2500', label: '⏳' };
              return (
                <div key={r.variant_id} className="card" style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{r.generic_name}</div>
                      <div style={{ fontSize: 11, color: '#0A84FF', marginTop: 2 }}>{r.brand_name}</div>
                    </div>
                    <span style={{ background: sc.bg, color: sc.color, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{sc.label}</span>
                  </div>
                  {r.rejection_reason && <div style={{ background: '#2A0A0A', border: '1px solid #FF453A', borderRadius: 8, padding: '6px 10px', fontSize: 11, color: '#FF453A', marginBottom: 6 }}>Reason: {r.rejection_reason}</div>}
                  <div style={{ fontSize: 9, color: '#636366' }}>{new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function AttrSection({ form, setForm, suggestions, attrKey, setAttrKey, attrVal, setAttrVal, addAttr, removeAttr }) {
  return (
    <div style={s.field}>
      <label style={s.label}>Attributes</label>
      {suggestions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          <span style={{ fontSize: 9, color: '#636366', alignSelf: 'center' }}>Suggested:</span>
          {suggestions.filter(a => !form.attributes[a]).map(a => (
            <button key={a} onClick={() => setAttrKey(a)}
              style={{ background: '#2C2C2E', border: '1px solid #3A3A3C', borderRadius: 6, color: '#0A84FF', padding: '2px 8px', fontSize: 10, cursor: 'pointer' }}>+ {a}</button>
          ))}
        </div>
      )}
      {Object.entries(form.attributes).map(([k, v]) => (
        <div key={k} style={s.attrRow}>
          <span style={s.attrKey}>{k}</span>
          <span style={s.attrVal}>{v}</span>
          <button onClick={() => removeAttr(form, setForm, k)} style={s.removeAttr}>✕</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <input style={{ ...s.input, flex: 1 }} placeholder="Key" value={attrKey} onChange={e => setAttrKey(e.target.value)} />
        <input style={{ ...s.input, flex: 1 }} placeholder="Value" value={attrVal} onChange={e => setAttrVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addAttr(form, setForm, attrKey, attrVal, setAttrKey, setAttrVal)} />
        <button onClick={() => addAttr(form, setForm, attrKey, attrVal, setAttrKey, setAttrVal)}
          style={{ background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, padding: '0 14px', fontSize: 18, cursor: 'pointer' }}>+</button>
      </div>
    </div>
  );
}

function F({ label, children }) {
  return <div style={s.field}><label style={s.label}>{label}</label>{children}</div>;
}

function TF({ label, value, onChange, placeholder, textarea }) {
  return (
    <div style={s.field}>
      <label style={s.label}>{label}</label>
      {textarea
        ? <textarea style={{ ...s.input, height: 64, resize: 'vertical' }} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
        : <input style={s.input} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />}
    </div>
  );
}

const s = {
  card: { background: '#2C2C2E', borderRadius: 12, padding: 18, marginBottom: 12 },
  cardTitle: { fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 6 },
  hint: { fontSize: 11, color: '#8E8E93', marginBottom: 16, lineHeight: 1.5 },
  field: { marginBottom: 14 },
  label: { display: 'block', fontSize: 11, color: '#8E8E93', marginBottom: 5, fontWeight: 500 },
  input: { width: '100%', background: '#3A3A3C', border: '1px solid #636366', borderRadius: 8, color: '#fff', padding: '9px 12px', fontSize: 13, outline: 'none' },
  select: { width: '100%', background: '#3A3A3C', border: '1px solid #636366', borderRadius: 8, color: '#fff', padding: '9px 12px', fontSize: 13, outline: 'none' },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  attrRow: { display: 'flex', alignItems: 'center', gap: 8, background: '#3A3A3C', borderRadius: 6, padding: '5px 10px', marginBottom: 4 },
  attrKey: { fontSize: 10, color: '#8E8E93', minWidth: 80 },
  attrVal: { fontSize: 12, color: '#fff', flex: 1, fontWeight: 500 },
  removeAttr: { background: 'none', border: 'none', color: '#636366', cursor: 'pointer', fontSize: 12 },
  submitBtn: { width: '100%', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 10, padding: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 6 },
  error: { background: '#2A0A0A', border: '1px solid #FF453A', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#FF453A', marginBottom: 12 },
  success: { background: '#003A10', border: '1px solid #1D9E75', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#30D158', marginBottom: 12 },
};
