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

    for (let i = 0; i < updatedRows.length; i++) {
      const row = updatedRows[i];
      updatedRows[i] = { ...row, status: 'processing' };
      setRows([...updatedRows]);

      try {
        // Find matching product using fuzzy match
        const product = products.find(p =>
          normalize(p.generic_name).includes(normalize(row.product_name)) ||
          normalize(row.product_name).includes(normalize(p.generic_name)) ||
          normalize(p.generic_name) === normalize(row.product_name)
        );

        if (!product) {
          updatedRows[i] = {
            ...row,
            status: 'failed',
            error: `Product "${row.product_name}" not found in catalogue`
          };
          failed++;
          continue;
        }

        // Find matching variant by brand name
        const variantsRes = await api.get(`/products/${product.product_id}/variants`);
        const variants = variantsRes.data.variants;

        const variant = variants.find(v =>
          normalize(v.brand_name) === normalize(row.brand) ||
          normalize(v.brand_name).includes(normalize(row.brand)) ||
          normalize(row.brand).includes(normalize(v.brand_name))
        );

        if (!variant) {
          updatedRows[i] = {
            ...row,
            status: 'failed',
            error: `Brand "${row.brand}" not found. Ask admin to add this variant first.`
          };
          failed++;
          continue;
        }

        // Create listing
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
        updatedRows[i] = {
          ...row,
          status: 'failed',
          error: err.response?.data?.error || err.message
        };
        failed++;
      }

      setRows([...updatedRows]);
    }

    setResults({ success, failed, total: rows.length });
    setUploading(false);
    setStep('results');
  };

  const reset = () => {
    setFile(null);
    setRows([]);
    setResults(null);
    setStep('upload');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div>
      <div style={styles.header}>
        <h2 style={styles.title}>Bulk Upload Price List</h2>
        <button style={styles.templateBtn} onClick={downloadTemplate}>
          ⬇ Download Template
        </button>
      </div>

      {step === 'upload' && (
        <div style={styles.uploadCard}>
          <div style={styles.uploadArea} onClick={() => fileRef.current.click()}>
            <p style={styles.uploadIcon}>📊</p>
            <p style={styles.uploadText}>Click to select your Excel price list</p>
            <p style={styles.uploadSub}>Supported: .xlsx, .xls</p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={handleFile}
            />
          </div>

          <div style={styles.instructions}>
            <h3 style={styles.instrTitle}>How to use:</h3>
            <ol style={styles.instrList}>
              <li>Download the Excel template above</li>
              <li>Fill in your products, prices and stock quantities</li>
              <li>Upload the filled Excel file</li>
              <li>Review and confirm the upload</li>
            </ol>
            <div style={styles.instrNote}>
              <strong>Note:</strong> Product names must match the VendorNet catalogue
              (Cement, Steel / TMT, Paint, Electrical, Plumbing, Hardware).
              Brands must already exist in the catalogue — contact admin to add new brands.
            </div>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div>
          <div style={styles.previewHeader}>
            <p style={styles.previewInfo}>
              📄 {file?.name} — {rows.length} rows found
            </p>
            <div style={styles.previewActions}>
              <button style={styles.cancelBtn} onClick={reset}>Cancel</button>
              <button style={styles.uploadBtn} onClick={processUpload} disabled={uploading}>
                {uploading ? 'Uploading...' : `Upload ${rows.length} listings`}
              </button>
            </div>
          </div>

          <div style={styles.table}>
            <div style={styles.tableHeader}>
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
                ...styles.tableRow,
                background: row.status === 'success' ? '#EAF3DE' :
                  row.status === 'failed' ? '#FCEBEB' :
                  row.status === 'processing' ? '#E6F1FB' : '#fff'
              }}>
                <span style={{ flex: 2, fontWeight: 500 }}>{row.product_name}</span>
                <span style={{ flex: 1 }}>{row.brand}</span>
                <span style={{ flex: 1, fontSize: 12, color: '#666' }}>{row.grade} {row.weight_kg}kg</span>
                <span style={{ flex: 1 }}>₹{row.price}</span>
                <span style={{ flex: 1, color: '#0F6E56' }}>{row.offer_price ? `₹${row.offer_price}` : '—'}</span>
                <span style={{ flex: 1 }}>{row.moq}</span>
                <span style={{ flex: 1 }}>{row.stock_qty}</span>
                <span style={{ flex: 1 }}>
                  {row.status === 'pending' && <span style={styles.badgePending}>Pending</span>}
                  {row.status === 'processing' && <span style={styles.badgeProcessing}>⟳</span>}
                  {row.status === 'success' && <span style={styles.badgeSuccess}>✓ Done</span>}
                  {row.status === 'failed' && (
                    <span style={styles.badgeFailed} title={row.error}>✗ Failed</span>
                  )}
                </span>
              </div>
            ))}
          </div>

          {rows.some(r => r.status === 'failed') && (
            <div style={styles.errorList}>
              <h4 style={{ margin: '0 0 8px', color: '#791F1F' }}>Errors:</h4>
              {rows.filter(r => r.status === 'failed').map((r, i) => (
                <p key={i} style={styles.errorItem}>
                  <strong>{r.product_name} — {r.brand}:</strong> {r.error}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 'results' && (
        <div style={styles.resultsCard}>
          <h3 style={styles.resultsTitle}>Upload Complete</h3>
          <div style={styles.resultsGrid}>
            <div style={{ ...styles.resultBox, background: '#EAF3DE' }}>
              <p style={{ ...styles.resultNum, color: '#0F6E56' }}>{results.success}</p>
              <p style={styles.resultLabel}>Successfully uploaded</p>
            </div>
            <div style={{ ...styles.resultBox, background: results.failed > 0 ? '#FCEBEB' : '#EAF3DE' }}>
              <p style={{ ...styles.resultNum, color: results.failed > 0 ? '#791F1F' : '#0F6E56' }}>{results.failed}</p>
              <p style={styles.resultLabel}>Failed</p>
            </div>
            <div style={{ ...styles.resultBox, background: '#E6F1FB' }}>
              <p style={{ ...styles.resultNum, color: '#0C447C' }}>{results.total}</p>
              <p style={styles.resultLabel}>Total rows</p>
            </div>
          </div>
          {results.success > 0 && (
            <p style={styles.successMsg}>
              ✓ {results.success} listings are now live on VendorNet
            </p>
          )}
          <div style={styles.resultActions}>
            <button style={styles.uploadBtn} onClick={reset}>Upload Another File</button>
            <button style={styles.cancelBtn} onClick={() => window.location.href = '/inventory'}>
              View My Listings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 600, color: '#333', margin: 0 },
  templateBtn: { background: '#EAF3DE', color: '#0F6E56', border: '1px solid #97C459', borderRadius: 8, padding: '8px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  uploadCard: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  uploadArea: { background: '#fff', borderRadius: 12, border: '2px dashed #9FE1CB', padding: 40, textAlign: 'center', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  uploadIcon: { fontSize: 48, margin: '0 0 12px' },
  uploadText: { fontSize: 16, fontWeight: 500, color: '#333', margin: '0 0 6px' },
  uploadSub: { fontSize: 13, color: '#888', margin: 0 },
  instructions: { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  instrTitle: { fontSize: 15, fontWeight: 600, margin: '0 0 12px' },
  instrList: { paddingLeft: 20, margin: '0 0 16px', lineHeight: 2, fontSize: 14, color: '#444' },
  instrNote: { background: '#FAEEDA', borderRadius: 8, padding: 12, fontSize: 13, color: '#633806', lineHeight: 1.6 },
  previewHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  previewInfo: { fontSize: 14, color: '#333', margin: 0 },
  previewActions: { display: 'flex', gap: 10 },
  uploadBtn: { background: '#0F6E56', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  cancelBtn: { background: '#f5f5f5', color: '#333', border: '1px solid #ddd', borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer' },
  table: { background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 },
  tableHeader: { display: 'flex', padding: '12px 16px', background: '#f9f9f9', fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', borderBottom: '1px solid #eee' },
  tableRow: { display: 'flex', padding: '12px 16px', borderBottom: '1px solid #f0f0f0', alignItems: 'center', fontSize: 14, transition: 'background 0.3s' },
  badgePending: { background: '#F1EFE8', color: '#5F5E5A', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 },
  badgeProcessing: { background: '#E6F1FB', color: '#0C447C', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 },
  badgeSuccess: { background: '#EAF3DE', color: '#27500A', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 },
  badgeFailed: { background: '#FCEBEB', color: '#791F1F', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'help' },
  errorList: { background: '#FCEBEB', borderRadius: 8, padding: 16, marginTop: 8 },
  errorItem: { fontSize: 13, color: '#791F1F', margin: '4px 0' },
  resultsCard: { background: '#fff', borderRadius: 12, padding: 32, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', maxWidth: 500 },
  resultsTitle: { fontSize: 20, fontWeight: 600, margin: '0 0 20px' },
  resultsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 },
  resultBox: { borderRadius: 10, padding: 16, textAlign: 'center' },
  resultNum: { fontSize: 32, fontWeight: 700, margin: '0 0 4px' },
  resultLabel: { fontSize: 12, color: '#666', margin: 0 },
  successMsg: { color: '#0F6E56', fontSize: 14, fontWeight: 500, marginBottom: 20 },
  resultActions: { display: 'flex', gap: 10 }
};