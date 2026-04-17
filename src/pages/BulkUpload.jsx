import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import api from '../services/api';

export default function BulkUpload() {
  const [categories, setCategories] = useState([]);
  const [showCatModal, setShowCatModal] = useState(false);
  const [selectedCats, setSelectedCats] = useState([]);
  const [catalogue, setCatalogue] = useState([]);
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const [step, setStep] = useState('upload');
  const [loadingCat, setLoadingCat] = useState(false);
  const fileRef = useRef();

  useEffect(() => { loadCategories(); }, []);

  const loadCategories = async () => {
    try {
      const res = await api.get('/listings/catalogue');
      setCategories(res.data.categories || []);
    } catch (err) { console.error(err); }
  };

  const openCatModal = () => {
    setSelectedCats([]);
    setShowCatModal(true);
  };

  const toggleCat = (id) => {
    // Single selection only
    setSelectedCats([id]);
  };

  const downloadTemplate = async () => {
    if (selectedCats.length === 0) return;
    setLoadingCat(true);
    try {
      const catId = selectedCats[0];
      const selCat = categories.find(c => c.category_id === catId);
      const res = await api.get(
        `/bulk/template/inventory?category_id=${catId}&category_name=${encodeURIComponent(selCat?.name || '')}`,
        { responseType: 'blob' }
      );
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `vendornet_${(selCat?.name || 'inventory').toLowerCase().replace(/\s+/g, '_')}_template.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setShowCatModal(false);
    } catch (err) {
      console.error(err);
      alert('Failed to download template');
    } finally { setLoadingCat(false); }
  };

  const generateExcel = (cat, selCats) => {
    const wb = XLSX.utils.book_new();

    // === Sheet 1: Price List ===
    const headers = [
      'Product Name', 'Brand Name', 'HSN Code', 'Category',
      'Price (₹)', 'Offer Price (₹)', 'MOQ', 'Stock Qty',
      'Delivery Days', 'Delivery Radius (km)', 'Warehouse Lat', 'Warehouse Lng'
    ];

    // Build sample rows from catalogue
    const sampleRows = cat.slice(0, 5).map(item => [
      item.generic_name, item.brand_name, item.hsn_code, item.category_name,
      '', '', item.floor_moq || 1, 0, 1, 20, '', ''
    ]);

    if (sampleRows.length === 0) {
      sampleRows.push(['(Type product name)', '(Type brand name)', '(HSN Code)', selCats[0]?.name || '', '', '', 1, 0, 1, 20, '', '']);
    }

    const priceListData = [headers, ...sampleRows];
    const ws1 = XLSX.utils.aoa_to_sheet(priceListData);

    // Column widths
    ws1['!cols'] = [
      { wch: 20 }, { wch: 18 }, { wch: 12 }, { wch: 14 },
      { wch: 12 }, { wch: 14 }, { wch: 8 }, { wch: 10 },
      { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 14 }
    ];

    // Data validation dropdown for Product Name (col A)
    const productNames = [...new Set(cat.map(c => `${c.generic_name} (${c.hsn_code})`))];
    if (productNames.length > 0) {
      ws1['!dataValidation'] = ws1['!dataValidation'] || [];
      ws1['!dataValidation'].push({
        sqref: 'A2:A500',
        type: 'list',
        formula1: `"${productNames.slice(0, 20).join(',')}"`,
      });
    }

    XLSX.utils.book_append_sheet(wb, ws1, 'Price List');

    // === Sheet 2: Approved Catalogue ===
    const catHeaders = ['Product Name', 'HSN Code (Mandatory)', 'Brand Name', 'Category', 'Attributes', 'Variant ID'];
    const catRows = cat.map(item => [
      item.generic_name,
      item.hsn_code || 'REQUIRED',
      item.brand_name,
      item.category_name,
      Object.entries(item.attributes || {}).map(([k, v]) => `${k}: ${v}`).join(', '),
      item.variant_id
    ]);

    const ws2 = XLSX.utils.aoa_to_sheet([catHeaders, ...catRows]);
    ws2['!cols'] = [{ wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 40 }, { wch: 38 }];

    // Style header row
    ws2['A1'].s = { font: { bold: true }, fill: { fgColor: { rgb: '185FA5' } } };

    XLSX.utils.book_append_sheet(wb, ws2, 'Approved Catalogue');

    // === Sheet 3: New Brand Requests ===
    const reqHeaders = [
      'Product Name (existing or new)',
      'HSN Code (MANDATORY)',
      'Category',
      'New Brand Name',
      'Manufacturer',
      'Grade / Spec',
      'Weight / Size',
      'Pack Type',
      'Other Attributes'
    ];

    const reqSample = [
      ['Cement', '2523', 'Cement', 'Zuari', 'Zuari Cement Ltd', 'OPC 53', '50', 'bag', ''],
      ['', '', '', '', '', '', '', '', '← Leave blank if not applicable'],
    ];

    const ws3 = XLSX.utils.aoa_to_sheet([reqHeaders, ...reqSample]);
    ws3['!cols'] = reqHeaders.map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, ws3, 'New Brand Requests');

    // === Sheet 4: Categories Reference ===
    const catRefHeaders = ['Category Name', 'Category ID', 'Min Order Qty'];
    const catRefRows = selCats.map(c => [c.name, c.category_id, c.floor_moq]);
    const ws4 = XLSX.utils.aoa_to_sheet([catRefHeaders, ...catRefRows]);
    ws4['!cols'] = [{ wch: 20 }, { wch: 38 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws4, 'Categories');

    const catNames = selCats.map(c => c.name).join('_');
    XLSX.writeFile(wb, `vendornet_pricelist_${catNames}.xlsx`);
  };

  const handleFile = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);

    const data = await f.arrayBuffer();
    const wb = XLSX.read(data);

    // Read Price List sheet
    const ws = wb.Sheets['Price List'] || wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const dataRows = json.slice(1).filter(row => row.length > 0 && row[0]);

    // Read New Brand Requests sheet
    const wsReq = wb.Sheets['New Brand Requests'];
    let requestRows = [];
    if (wsReq) {
      const reqJson = XLSX.utils.sheet_to_json(wsReq, { header: 1 });
      requestRows = reqJson.slice(1).filter(row => row.length > 0 && row[0] && row[1]);
    }

    setRows(dataRows.map(row => ({
      product_name: String(row[0] || '').split('(')[0].trim(),
      brand_name: String(row[1] || '').trim(),
      hsn_code: String(row[2] || '').trim(),
      category_name: String(row[3] || '').trim(),
      price: row[4] || 0,
      offer_price: row[5] || null,
      moq: row[6] || 1,
      stock_qty: row[7] || 0,
      delivery_days: row[8] || 1,
      delivery_radius_km: row[9] || 20,
      warehouse_lat: row[10] || 0,
      warehouse_lng: row[11] || 0,
      is_request: false,
      status: 'pending',
      error: null,
    })));

    // Add request rows
    if (requestRows.length > 0) {
      const reqMapped = requestRows.map(row => ({
        product_name: String(row[0] || '').trim(),
        hsn_code: String(row[1] || '').trim(),
        category_name: String(row[2] || '').trim(),
        brand_name: String(row[3] || '').trim(),
        manufacturer: String(row[4] || '').trim(),
        attributes: {
          ...(row[5] ? { grade: String(row[5]) } : {}),
          ...(row[6] ? { weight_kg: String(row[6]) } : {}),
          ...(row[7] ? { pack_type: String(row[7]) } : {}),
          ...(row[8] ? { other: String(row[8]) } : {}),
        },
        is_request: true,
        status: 'pending',
        error: null,
        price: 0, offer_price: null, moq: 1, stock_qty: 0,
        delivery_days: 1, delivery_radius_km: 20,
        warehouse_lat: 0, warehouse_lng: 0,
      }));
      setRows(prev => [...prev, ...reqMapped]);
    }

    // Load catalogue for matching
    try {
      const catRes = await api.get('/listings/catalogue');
      setCatalogue(catRes.data.catalogue || []);
    } catch (err) { console.error(err); }

    setStep('preview');
  };

  const normalize = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const processUpload = async () => {
    setUploading(true);
    const updatedRows = [...rows];
    let success = 0, failed = 0, requested = 0;
    const errors = [];

    for (let i = 0; i < updatedRows.length; i++) {
      const row = updatedRows[i];
      updatedRows[i] = { ...row, status: 'processing' };
      setRows([...updatedRows]);

      try {
        if (row.is_request) {
          // Submit new brand request
          if (!row.hsn_code) throw new Error('HSN Code is mandatory for new brand requests');

          // Find existing product or flag as new
          const existingProduct = catalogue.find(c =>
            normalize(c.generic_name) === normalize(row.product_name)
          );

          await api.post('/listings/request-variant', {
            product_id: existingProduct?.product_id || null,
            generic_name: existingProduct ? null : row.product_name,
            category_id: existingProduct ? null : categories.find(c =>
              normalize(c.name) === normalize(row.category_name))?.category_id,
            hsn_code: row.hsn_code,
            brand_name: row.brand_name,
            manufacturer: row.manufacturer,
            attributes: row.attributes,
          });

          updatedRows[i] = { ...row, status: 'requested' };
          requested++;
        } else {
          // Match to existing variant
          const match = catalogue.find(c =>
            normalize(c.generic_name) === normalize(row.product_name) &&
            normalize(c.brand_name) === normalize(row.brand_name)
          );

          if (!match) {
            // Auto-submit as request instead of failing
            if (!row.hsn_code) throw new Error(`Brand "${row.brand_name}" not found. Add HSN Code to submit as request`);

            const existingProduct = catalogue.find(c =>
              normalize(c.generic_name) === normalize(row.product_name)
            );

            await api.post('/listings/request-variant', {
              product_id: existingProduct?.product_id || null,
              generic_name: existingProduct ? null : row.product_name,
              category_id: existingProduct ? null : categories.find(c =>
                normalize(c.name) === normalize(row.category_name))?.category_id,
              hsn_code: row.hsn_code,
              brand_name: row.brand_name,
              attributes: {},
            });

            updatedRows[i] = { ...row, status: 'requested', error: 'Brand not found — submitted as request' };
            requested++;
            continue;
          }

          await api.post('/listings/upsert', {
            variant_id: match.variant_id,
            price: parseFloat(row.price),
            offer_price: row.offer_price ? parseFloat(row.offer_price) : null,
            min_order_qty: parseInt(row.moq),
            stock_qty: parseInt(row.stock_qty),
            delivery_days: parseInt(row.delivery_days),
            delivery_radius_km: parseFloat(row.delivery_radius_km),
            warehouse_lat: parseFloat(row.warehouse_lat) || null,
            warehouse_lng: parseFloat(row.warehouse_lng) || null,
          });

          updatedRows[i] = { ...row, status: 'success' };
          success++;
        }
      } catch (err) {
        const msg = err.response?.data?.error || err.message;
        updatedRows[i] = { ...row, status: 'failed', error: msg };
        errors.push({ row: i + 1, product: row.product_name, brand: row.brand_name, error: msg });
        failed++;
      }

      setRows([...updatedRows]);
    }

    setResults({ success, failed, requested, total: rows.length, errors });
    setUploading(false);
    setShowPopup(true);
  };

  const reset = () => {
    setFile(null); setRows([]); setResults(null);
    setShowPopup(false); setStep('upload');
    if (fileRef.current) fileRef.current.value = '';
  };

  const listingRows = rows.filter(r => !r.is_request);
  const requestRows = rows.filter(r => r.is_request);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* TOP BAR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #2C2C2E', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Bulk Upload Price List</div>
          <div style={{ fontSize: 10, color: '#8E8E93', marginTop: 1 }}>Upload Excel to create or update listings</div>
        </div>
        <button onClick={openCatModal}
          style={{ background: '#0A2510', color: '#30D158', border: '1px solid #1D9E75', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          ⬇ Download Template
        </button>
      </div>

      {/* CATEGORY SELECTION MODAL */}
      {showCatModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#1C1C1E', border: '1px solid #3A3A3C', borderRadius: 16, padding: 24, width: 380 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Select Category</div>
              <button onClick={() => setShowCatModal(false)} style={{ background: '#3A3A3C', border: 'none', color: '#8E8E93', borderRadius: 8, width: 28, height: 28, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ fontSize: 11, color: '#8E8E93', marginBottom: 12 }}>
              Select categories to include in the template
            </div>

            {/* Select All */}
            <button onClick={() => setSelectedCats(
              selectedCats.length === categories.length ? [] : categories.map(c => c.category_id)
            )} style={{ background: '#2C2C2E', border: '1px solid #3A3A3C', borderRadius: 8, color: '#0A84FF', padding: '6px 12px', fontSize: 11, cursor: 'pointer', marginBottom: 12, width: '100%' }}>
              {selectedCats.length === categories.length ? 'Deselect All' : 'Select All'}
            </button>

            {/* Category checklist */}
            {categories.map(cat => (
              <div key={cat.category_id}
                onClick={() => toggleCat(cat.category_id)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, marginBottom: 6, cursor: 'pointer', background: selectedCats.includes(cat.category_id) ? '#0A2510' : '#2C2C2E', border: `1px solid ${selectedCats.includes(cat.category_id) ? '#1D9E75' : '#3A3A3C'}` }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${selectedCats.includes(cat.category_id) ? '#30D158' : '#636366'}`, background: selectedCats.includes(cat.category_id) ? '#30D158' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {selectedCats.includes(cat.category_id) && <span style={{ color: '#000', fontSize: 11, fontWeight: 700 }}>✓</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>{cat.name}</div>
                  <div style={{ fontSize: 10, color: '#8E8E93' }}>Min order qty: {cat.floor_moq}</div>
                </div>
              </div>
            ))}

            <button
              onClick={downloadTemplate}
              disabled={selectedCats.length === 0 || loadingCat}
              style={{ width: '100%', background: selectedCats.length === 0 ? '#2C2C2E' : '#185FA5', color: selectedCats.length === 0 ? '#636366' : '#fff', border: 'none', borderRadius: 10, padding: 12, fontSize: 13, fontWeight: 700, cursor: selectedCats.length === 0 ? 'not-allowed' : 'pointer', marginTop: 16 }}>
              {loadingCat ? 'Generating...' : `⬇ Download Template (${selectedCats.length} selected)`}
            </button>
          </div>
        </div>
      )}

      {/* CONTENT */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>

        {step === 'upload' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div onClick={() => fileRef.current.click()}
              style={{ background: '#2C2C2E', borderRadius: 12, border: '2px dashed #1D9E75', padding: 40, textAlign: 'center', cursor: 'pointer' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#fff', marginBottom: 6 }}>Click to select your Excel price list</div>
              <div style={{ fontSize: 12, color: '#8E8E93' }}>Supported: .xlsx, .xls</div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFile} />
            </div>

            <div style={{ background: '#2C2C2E', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 12 }}>How to use</div>
              <ol style={{ paddingLeft: 18, lineHeight: 2.2, fontSize: 12, color: '#8E8E93', marginBottom: 14 }}>
                <li>Click "Download Template" and select categories</li>
                <li>Fill <strong style={{ color: '#fff' }}>Price List</strong> sheet — use products from Approved Catalogue</li>
                <li>For new brands, fill <strong style={{ color: '#fff' }}>New Brand Requests</strong> sheet with HSN code</li>
                <li>Upload the filled Excel file</li>
                <li>Known brands → listed immediately</li>
                <li>New brands → sent to admin for approval</li>
              </ol>
              <div style={{ background: '#2A1F00', borderRadius: 8, padding: 10, fontSize: 11, color: '#F2C94C', border: '1px solid #BA7517', lineHeight: 1.6 }}>
                <strong>⚠ Note:</strong> HSN Code is mandatory for all new brand requests. Requests without HSN will be rejected.
              </div>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#8E8E93' }}>
                📄 {file?.name} — <span style={{ color: '#fff' }}>{listingRows.length} listings</span>
                {requestRows.length > 0 && <span style={{ color: '#F2C94C' }}> · {requestRows.length} brand requests</span>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={reset} style={{ background: '#2C2C2E', color: '#8E8E93', border: '1px solid #3A3A3C', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                <button onClick={processUpload} disabled={uploading}
                  style={{ background: uploading ? '#0A3A6A' : '#185FA5', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {uploading ? 'Processing...' : `Upload ${rows.length} rows`}
                </button>
              </div>
            </div>

            {/* Price List rows */}
            {listingRows.length > 0 && (
              <div style={{ background: '#2C2C2E', borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
                <div style={{ padding: '8px 14px', background: '#003A10', fontSize: 10, fontWeight: 700, color: '#30D158', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  📋 Listings ({listingRows.length})
                </div>
                <div style={{ display: 'flex', padding: '8px 14px', background: '#3A3A3C', fontSize: 10, fontWeight: 600, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  <span style={{ flex: 2 }}>Product</span>
                  <span style={{ flex: 1 }}>Brand</span>
                  <span style={{ flex: 1 }}>HSN</span>
                  <span style={{ flex: 1 }}>Price</span>
                  <span style={{ flex: 1 }}>Stock</span>
                  <span style={{ flex: 1 }}>Status</span>
                </div>
                {listingRows.map((row, i) => (
                  <div key={i} style={{ display: 'flex', padding: '10px 14px', borderBottom: '1px solid #3A3A3C', alignItems: 'center', fontSize: 12, background: row.status === 'success' ? '#003A10' : row.status === 'failed' ? '#2A0A0A' : row.status === 'requested' ? '#2A1F00' : row.status === 'processing' ? '#0A1F35' : 'transparent' }}>
                    <span style={{ flex: 2, color: '#fff', fontWeight: 500 }}>{row.product_name}</span>
                    <span style={{ flex: 1, color: '#8E8E93' }}>{row.brand_name}</span>
                    <span style={{ flex: 1, color: '#8E8E93', fontSize: 10 }}>{row.hsn_code || '—'}</span>
                    <span style={{ flex: 1, color: '#fff' }}>₹{row.price}</span>
                    <span style={{ flex: 1, color: '#8E8E93' }}>{row.stock_qty}</span>
                    <span style={{ flex: 1 }}>
                      <StatusChip status={row.status} error={row.error} />
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Request rows */}
            {requestRows.length > 0 && (
              <div style={{ background: '#2C2C2E', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '8px 14px', background: '#2A1F00', fontSize: 10, fontWeight: 700, color: '#F2C94C', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  🆕 New Brand Requests ({requestRows.length}) — pending admin approval
                </div>
                <div style={{ display: 'flex', padding: '8px 14px', background: '#3A3A3C', fontSize: 10, fontWeight: 600, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  <span style={{ flex: 2 }}>Product</span>
                  <span style={{ flex: 1 }}>Brand</span>
                  <span style={{ flex: 1 }}>HSN</span>
                  <span style={{ flex: 1 }}>Manufacturer</span>
                  <span style={{ flex: 1 }}>Status</span>
                </div>
                {requestRows.map((row, i) => (
                  <div key={i} style={{ display: 'flex', padding: '10px 14px', borderBottom: '1px solid #3A3A3C', alignItems: 'center', fontSize: 12, background: row.status === 'requested' ? '#2A1F00' : row.status === 'failed' ? '#2A0A0A' : row.status === 'processing' ? '#0A1F35' : 'transparent' }}>
                    <span style={{ flex: 2, color: '#fff', fontWeight: 500 }}>{row.product_name}</span>
                    <span style={{ flex: 1, color: '#F2C94C' }}>{row.brand_name}</span>
                    <span style={{ flex: 1, color: row.hsn_code ? '#fff' : '#FF453A', fontSize: 10, fontWeight: row.hsn_code ? 400 : 700 }}>{row.hsn_code || 'MISSING!'}</span>
                    <span style={{ flex: 1, color: '#8E8E93', fontSize: 11 }}>{row.manufacturer || '—'}</span>
                    <span style={{ flex: 1 }}>
                      <StatusChip status={row.status} error={row.error} />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* RESULTS POPUP */}
      {showPopup && results && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#1C1C1E', border: '1px solid #3A3A3C', borderRadius: 16, padding: 28, width: 420, maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Upload Complete</div>
              <button onClick={() => setShowPopup(false)} style={{ background: '#3A3A3C', color: '#8E8E93', border: 'none', borderRadius: 8, width: 28, height: 28, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
              <StatBox value={results.success} label="Listed" color="#30D158" bg="#003A10" />
              <StatBox value={results.requested} label="Requested" color="#F2C94C" bg="#2A1F00" />
              <StatBox value={results.failed} label="Failed" color={results.failed > 0 ? '#FF453A' : '#30D158'} bg={results.failed > 0 ? '#2A0A0A' : '#003A10'} />
            </div>

            {results.success > 0 && (
              <div style={{ background: '#003A10', border: '1px solid #1D9E75', borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 12, color: '#30D158' }}>
                ✓ {results.success} listing{results.success > 1 ? 's' : ''} are now live on VendorNet
              </div>
            )}
            {results.requested > 0 && (
              <div style={{ background: '#2A1F00', border: '1px solid #BA7517', borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 12, color: '#F2C94C' }}>
                ⏳ {results.requested} brand request{results.requested > 1 ? 's' : ''} sent to admin for approval
              </div>
            )}
            {results.errors?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#FF453A', marginBottom: 8 }}>✗ Failed ({results.errors.length})</div>
                {results.errors.map((e, i) => (
                  <div key={i} style={{ background: '#2A0A0A', border: '1px solid #3A0A0A', borderRadius: 8, padding: '8px 10px', marginBottom: 6 }}>
                    <div style={{ fontSize: 11, color: '#fff', fontWeight: 500, marginBottom: 2 }}>Row {e.row} — {e.product} · {e.brand}</div>
                    <div style={{ fontSize: 10, color: '#FF453A' }}>{e.error}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={reset} style={{ flex: 1, background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, padding: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Upload Another</button>
              <button onClick={() => { setShowPopup(false); window.location.href = '/inventory'; }} style={{ flex: 1, background: '#2C2C2E', color: '#8E8E93', border: '1px solid #3A3A3C', borderRadius: 8, padding: 10, fontSize: 12, cursor: 'pointer' }}>View Inventory →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusChip({ status, error }) {
  const map = {
    pending:    { bg: '#3A3A3C', color: '#8E8E93', label: 'Pending' },
    processing: { bg: '#0A1F35', color: '#0A84FF', label: '⟳' },
    success:    { bg: '#003A10', color: '#30D158', label: '✓ Done' },
    requested:  { bg: '#2A1F00', color: '#F2C94C', label: '⏳ Requested' },
    failed:     { bg: '#2A0A0A', color: '#FF453A', label: '✗ Failed' },
  };
  const s = map[status] || map.pending;
  return (
    <span title={error || ''} style={{ background: s.bg, color: s.color, padding: '2px 8px', borderRadius: 8, fontSize: 10, cursor: error ? 'help' : 'default' }}>
      {s.label}
    </span>
  );
}

function StatBox({ value, label, color, bg }) {
  return (
    <div style={{ background: bg, borderRadius: 10, padding: 14, textAlign: 'center' }}>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 10, color, opacity: 0.8, marginTop: 2 }}>{label}</div>
    </div>
  );
}
