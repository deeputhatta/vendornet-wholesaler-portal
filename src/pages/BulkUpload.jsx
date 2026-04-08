import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import api from '../services/api';

const TEMPLATE_HEADERS = [
  'Product Name', 'Brand', 'Grade', 'Weight (kg)', 'Pack Type',
  'Price (₹)', 'Offer Price (₹)', 'MOQ', 'Stock Qty',
  'Delivery Days', 'Delivery Radius (km)', 'Warehouse Lat', 'Warehouse Lng'
];

const SAMPLE_DATA = [
  ['Cement', 'UltraTech', 'OPC 53', 50, 'bag', 380, 365, 10, 500, 1, 25, 9.9252, 78.1198],
  ['Cement', 'Ramco', 'OPC 53', 50, 'bag', 375, '', 10, 300, 1, 25, 9.9252, 78.1198],
  ['Steel / TMT', 'TATA Tiscon', 'Fe500', 12, 'bundle', 68000, 65000, 1, 50, 2, 30, 9.9252, 78.1198],
  ['Paint', 'Asian Paints', 'Exterior', 20, 'litre', 3200, '', 5, 100, 1, 20, 9.9252, 78.1198],
];

export default function BulkUpload() {
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const [step, setStep] = useState('upload');
  const fileRef = useRef();

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...SAMPLE_DATA]);
    ws['!cols'] = TEMPLATE_HEADERS.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Price List');
    XLSX.writeFile(wb, 'vendornet_price_list_template.xlsx');
  };

  const handleFile = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);

    const data = await f.arrayBuffer();
    const wb = XLSX.read(data);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const dataRows = json.slice(1).filter(row => row.length > 0 && row[0]);

    setRows(dataRows.map(row => ({
      product_name: row[0] || '',
      brand: row[1] || '',
      grade: row[2] || '',
      weight_kg: row[3] || '',
      pack_type: row[4] || 'bag',
      price: row[5] || 0,
      offer_price: row[6] || null,
      moq: row[7] || 1,
      stock_qty: row[8] || 0,
      delivery_days: row[9] || 1,
      delivery_radius_km: row[10] || 20,
      warehouse_lat: row[11] || 0,
      warehouse_lng: row[12] || 0,
      status: 'pending',
      error: null
    })));

    try {
      const prodRes = await api.get('/products');
      setProducts(prodRes.data.products);
    } catch (err) {
      console.error(err);
    }

    setStep('preview');
  };

  const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

  const processUpload = async () => {
    setUploading(true);
    const updatedRows = [...rows];
    let success = 0, failed = 0;
    const errors = [];

    for (let i = 0; i < updatedRows.length; i++) {
      const row = updatedRows[i];
      updatedRows[i] = { ...row, status: 'processing' };
      setRows([...updatedRows]);

      try {
        const product = products.find(p =>
          normalize(p.generic_name).includes(normalize(row.product_name)) ||
          normalize(row.product_name).includes(normalize(p.generic_name)) ||
          normalize(p.generic_name) === normalize(row.product_name)
        );

        if (!product) {
          const msg = `Product "${row.product_name}" not found in catalogue`;
          updatedRows[i] = { ...row, status: 'failed', error: msg };
          errors.push({ row: i + 1, brand: row.brand, product: row.product_name, error: msg });
          failed++;
          continue;
        }

        const variantsRes = await api.get(`/products/${product.product_id}/variants`);
        const variants = variantsRes.data.variants;
        const variant = variants.find(v =>
          normalize(v.brand_name) === normalize(row.brand) ||
          normalize(v.brand_name).includes(normalize(row.brand)) ||
          normalize(row.brand).includes(normalize(v.brand_name))
        );

        if (!variant) {
          const msg = `Brand "${row.brand}" not found. Ask admin to add this variant first.`;
          updatedRows[i] = { ...row, status: 'failed', error: msg };
          errors.push({ row: i + 1, brand: row.brand, product: row.product_name, error: msg });
          failed++;
          continue;
        }

        await api.post('/listings/upsert', {
          variant_id: variant.variant_id,
          price: parseFloat(row.price),
          offer_price: row.offer_price ? parseFloat(row.offer_price) : null,
          min_order_qty: parseInt(row.moq),
          stock_qty: parseInt(row.stock_qty),
          delivery_days: parseInt(row.delivery_days),
          delivery_radius_km: parseFloat(row.delivery_radius_km),
          warehouse_lat: parseFloat(row.warehouse_lat),
          warehouse_lng: parseFloat(row.warehouse_lng)
        });

        updatedRows[i] = { ...row, status: 'success' };
        success++;
      } catch (err) {
        const msg = err.response?.data?.error || err.message;
        updatedRows[i] = { ...row, status: 'failed', error: msg };
        errors.push({ row: i + 1, brand: row.brand, product: row.product_name, error: msg });
        failed++;
      }

      setRows([...updatedRows]);
    }

    setResults({ success, failed, total: rows.length, errors });
    setUploading(false);
    setShowPopup(true);
  };

  const reset = () => {
    setFile(null);
    setRows([]);
    setResults(null);
    setShowPopup(false);
    setStep('upload');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* TOP BAR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #2C2C2E', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Bulk Upload Price List</div>
          <div style={{ fontSize: 10, color: '#8E8E93', marginTop: 1 }}>Upload Excel to create or update your listings</div>
        </div>
        <button onClick={downloadTemplate} style={{ background: '#0A2510', color: '#30D158', border: '1px solid #1D9E75', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          ⬇ Download Template
        </button>
      </div>

      {/* CONTENT */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>

        {step === 'upload' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div onClick={() => fileRef.current.click()} style={{ background: '#2C2C2E', borderRadius: 12, border: '2px dashed #1D9E75', padding: 40, textAlign: 'center', cursor: 'pointer' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#fff', marginBottom: 6 }}>Click to select your Excel price list</div>
              <div style={{ fontSize: 12, color: '#8E8E93' }}>Supported: .xlsx, .xls</div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFile} />
            </div>

            <div style={{ background: '#2C2C2E', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 10 }}>How to use</div>
              <ol style={{ paddingLeft: 18, lineHeight: 2, fontSize: 12, color: '#8E8E93', marginBottom: 14 }}>
                <li>Download the Excel template above</li>
                <li>Fill in your products, prices and stock</li>
                <li>Upload the filled Excel file</li>
                <li>Review and confirm upload</li>
              </ol>
              <div style={{ background: '#2A1F00', borderRadius: 8, padding: 10, fontSize: 11, color: '#F2C94C', border: '1px solid #BA7517', lineHeight: 1.6 }}>
                <strong>Note:</strong> Product names must match the VendorNet catalogue. Brands must already exist — contact admin to add new brands.
              </div>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#8E8E93' }}>
                📄 {file?.name} — <span style={{ color: '#fff' }}>{rows.length} rows found</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={reset} style={{ background: '#2C2C2E', color: '#8E8E93', border: '1px solid #3A3A3C', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                <button onClick={processUpload} disabled={uploading} style={{ background: uploading ? '#0A3A6A' : '#185FA5', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {uploading ? 'Uploading...' : `Upload ${rows.length} listings`}
                </button>
              </div>
            </div>

            <div style={{ background: '#2C2C2E', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'flex', padding: '10px 14px', background: '#3A3A3C', fontSize: 10, fontWeight: 600, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                <span style={{ flex: 2 }}>Product</span>
                <span style={{ flex: 1 }}>Brand</span>
                <span style={{ flex: 1 }}>Grade</span>
                <span style={{ flex: 1 }}>Price</span>
                <span style={{ flex: 1 }}>Offer</span>
                <span style={{ flex: 1 }}>MOQ</span>
                <span style={{ flex: 1 }}>Stock</span>
                <span style={{ flex: 1 }}>Status</span>
              </div>
              {rows.map((row, i) => (
                <div key={i} style={{
                  display: 'flex', padding: '10px 14px',
                  borderBottom: '1px solid #3A3A3C',
                  alignItems: 'center', fontSize: 12,
                  background: row.status === 'success' ? '#003A10' :
                    row.status === 'failed' ? '#2A0A0A' :
                    row.status === 'processing' ? '#0A1F35' : 'transparent'
                }}>
                  <span style={{ flex: 2, color: '#fff', fontWeight: 500 }}>{row.product_name}</span>
                  <span style={{ flex: 1, color: '#8E8E93' }}>{row.brand}</span>
                  <span style={{ flex: 1, color: '#8E8E93', fontSize: 11 }}>{row.grade} {row.weight_kg}kg</span>
                  <span style={{ flex: 1, color: '#fff' }}>₹{row.price}</span>
                  <span style={{ flex: 1, color: '#30D158' }}>{row.offer_price ? `₹${row.offer_price}` : '—'}</span>
                  <span style={{ flex: 1, color: '#8E8E93' }}>{row.moq}</span>
                  <span style={{ flex: 1, color: '#8E8E93' }}>{row.stock_qty}</span>
                  <span style={{ flex: 1 }}>
                    {row.status === 'pending' && <span style={{ background: '#3A3A3C', color: '#8E8E93', padding: '2px 8px', borderRadius: 8, fontSize: 10 }}>Pending</span>}
                    {row.status === 'processing' && <span style={{ background: '#0A1F35', color: '#0A84FF', padding: '2px 8px', borderRadius: 8, fontSize: 10 }}>⟳</span>}
                    {row.status === 'success' && <span style={{ background: '#003A10', color: '#30D158', padding: '2px 8px', borderRadius: 8, fontSize: 10 }}>✓ Done</span>}
                    {row.status === 'failed' && <span title={row.error} style={{ background: '#2A0A0A', color: '#FF453A', padding: '2px 8px', borderRadius: 8, fontSize: 10, cursor: 'help' }}>✗ Failed</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* RESULTS POPUP */}
      {showPopup && results && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#1C1C1E', border: '1px solid #3A3A3C', borderRadius: 16, padding: 28, width: 420, maxHeight: '80vh', overflowY: 'auto' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Upload Complete</div>
              <button onClick={() => setShowPopup(false)} style={{ background: '#3A3A3C', color: '#8E8E93', border: 'none', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
              <div style={{ background: '#003A10', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#30D158' }}>{results.success}</div>
                <div style={{ fontSize: 10, color: '#1D9E75', marginTop: 2 }}>Successful</div>
              </div>
              <div style={{ background: results.failed > 0 ? '#2A0A0A' : '#003A10', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: results.failed > 0 ? '#FF453A' : '#30D158' }}>{results.failed}</div>
                <div style={{ fontSize: 10, color: results.failed > 0 ? '#A32D2D' : '#1D9E75', marginTop: 2 }}>Failed</div>
              </div>
              <div style={{ background: '#0A1F35', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#0A84FF' }}>{results.total}</div>
                <div style={{ fontSize: 10, color: '#185FA5', marginTop: 2 }}>Total rows</div>
              </div>
            </div>

            {/* Success message */}
            {results.success > 0 && (
              <div style={{ background: '#003A10', border: '1px solid #1D9E75', borderRadius: 8, padding: 10, marginBottom: 14, fontSize: 12, color: '#30D158' }}>
                ✓ {results.success} listing{results.success > 1 ? 's' : ''} are now live on VendorNet
              </div>
            )}

            {/* Errors */}
            {results.errors?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#FF453A', marginBottom: 8 }}>
                  ✗ Failed rows ({results.errors.length})
                </div>
                {results.errors.map((e, i) => (
                  <div key={i} style={{ background: '#2A0A0A', border: '1px solid #3A0A0A', borderRadius: 8, padding: '8px 10px', marginBottom: 6 }}>
                    <div style={{ fontSize: 11, color: '#fff', fontWeight: 500, marginBottom: 2 }}>
                      Row {e.row} — {e.product} · {e.brand}
                    </div>
                    <div style={{ fontSize: 10, color: '#FF453A' }}>{e.error}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={reset} style={{ flex: 1, background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, padding: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Upload Another File
              </button>
              <button onClick={() => { setShowPopup(false); window.location.href = '/inventory'; }} style={{ flex: 1, background: '#2C2C2E', color: '#8E8E93', border: '1px solid #3A3A3C', borderRadius: 8, padding: 10, fontSize: 12, cursor: 'pointer' }}>
                View Inventory →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}