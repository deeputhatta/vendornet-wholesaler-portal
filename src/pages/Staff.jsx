import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const ALL_PERMISSIONS = [
  { key: 'view_orders',     label: 'View Orders' },
  { key: 'accept_orders',   label: 'Accept Orders' },
  { key: 'manage_listings', label: 'Manage Listings' },
  { key: 'view_analytics',  label: 'View Analytics' },
  { key: 'upload_invoice',  label: 'Upload Invoice' },
  { key: 'assign_driver',   label: 'Assign Driver' },
  { key: 'manage_staff',    label: 'Manage Staff' },
];

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ mobile: '', name: '', permissions: {} });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { user } = useAuth();
  const canManage = user?.role === 'wholesaler_admin' || user?.permissions?.manage_staff;

  useEffect(() => {
    if (!canManage) { setLoading(false); return; }
    loadStaff();
  }, []);

  const loadStaff = async () => {
    setLoading(true);
    try {
      const res = await api.get('/staff/list');
      setStaff(res.data.staff || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const defaultPermissions = () => Object.fromEntries(ALL_PERMISSIONS.map(p => [p.key, p.key === 'view_orders']));

  const openAdd = () => {
    setForm({ mobile: '', name: '', permissions: defaultPermissions() });
    setError('');
    setEditingId(null);
    setShowAdd(true);
  };

  const openEdit = (member) => {
    setForm({ mobile: member.mobile, name: member.name, permissions: member.permissions || defaultPermissions() });
    setError('');
    setEditingId(member.staff_id);
    setShowAdd(true);
  };

  const save = async () => {
    if (!form.mobile || form.mobile.length !== 10) return setError('Enter valid 10-digit mobile');
    if (!form.name) return setError('Name is required');
    setSaving(true); setError('');
    try {
      if (editingId) {
        await api.put(`/staff/${editingId}/permissions`, { permissions: form.permissions });
      } else {
        await api.post('/staff/add', { mobile: form.mobile, name: form.name, permissions: form.permissions });
      }
      setShowAdd(false);
      await loadStaff();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  const toggleActive = async (staffId, current) => {
    try {
      await api.put(`/staff/${staffId}/toggle`);
      setStaff(prev => prev.map(s => s.staff_id === staffId ? { ...s, is_active: !current } : s));
    } catch (err) { alert('Failed to update'); }
  };

  const removeStaff = async (staffId) => {
    if (!confirm('Remove this staff member?')) return;
    try {
      await api.delete(`/staff/${staffId}`);
      setStaff(prev => prev.filter(s => s.staff_id !== staffId));
    } catch (err) { alert('Failed to remove'); }
  };

  const togglePerm = (key) => setForm(f => ({ ...f, permissions: { ...f.permissions, [key]: !f.permissions[key] } }));

  if (!canManage) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <div style={{ fontSize: 36 }}>🔒</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Access Restricted</div>
      <div style={{ fontSize: 12, color: '#8E8E93' }}>You don't have permission to manage staff</div>
    </div>
  );

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#8E8E93' }}>Loading...</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* TOP BAR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #2C2C2E', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Staff</div>
          <div style={{ fontSize: 10, color: '#8E8E93', marginTop: 1 }}>{staff.length} staff members</div>
        </div>
        <button className="btn-primary" onClick={openAdd}>+ Add Staff</button>
      </div>

      {/* ADD/EDIT MODAL */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#1C1C1E', border: '1px solid #3A3A3C', borderRadius: 16, padding: 24, width: 420, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{editingId ? 'Edit Staff' : 'Add Staff Member'}</div>
              <button onClick={() => setShowAdd(false)} style={{ background: '#3A3A3C', border: 'none', color: '#8E8E93', borderRadius: 8, width: 28, height: 28, cursor: 'pointer' }}>✕</button>
            </div>

            {error && <div style={{ background: '#2A0A0A', border: '1px solid #FF453A', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: '#FF453A' }}>{error}</div>}

            {!editingId && (
              <>
                <div style={{ fontSize: 11, color: '#8E8E93', marginBottom: 6 }}>Mobile Number</div>
                <div style={{ display: 'flex', alignItems: 'center', background: '#2C2C2E', border: '1px solid #3A3A3C', borderRadius: 8, marginBottom: 14, paddingLeft: 12 }}>
                  <span style={{ color: '#8E8E93', fontSize: 13, marginRight: 6 }}>+91</span>
                  <input type="tel" maxLength={10} value={form.mobile}
                    onChange={e => setForm(f => ({ ...f, mobile: e.target.value.replace(/\D/g, '') }))}
                    placeholder="10-digit mobile"
                    style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', padding: '10px 12px 10px 0', fontSize: 14 }} />
                </div>
                <div style={{ fontSize: 11, color: '#8E8E93', marginBottom: 6 }}>Full Name</div>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Staff member name"
                  style={{ marginBottom: 16, background: '#2C2C2E', border: '1px solid #3A3A3C', borderRadius: 8, color: '#fff', padding: '10px 12px', fontSize: 13, width: '100%', outline: 'none' }} />
              </>
            )}

            <div style={{ fontSize: 11, fontWeight: 600, color: '#8E8E93', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Permissions</div>
            {ALL_PERMISSIONS.map(p => (
              <div key={p.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #2C2C2E' }}>
                <span style={{ fontSize: 13, color: '#fff' }}>{p.label}</span>
                <button onClick={() => togglePerm(p.key)}
                  style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: form.permissions[p.key] ? '#30D158' : '#3A3A3C', transition: 'background 0.2s', position: 'relative' }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, transition: 'left 0.2s', left: form.permissions[p.key] ? 23 : 3 }} />
                </button>
              </div>
            ))}

            <button onClick={save} disabled={saving}
              style={{ width: '100%', background: '#185FA5', color: '#fff', border: 'none', borderRadius: 10, padding: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 16 }}>
              {saving ? 'Saving...' : editingId ? 'Update Permissions' : 'Add Staff Member'}
            </button>
          </div>
        </div>
      )}

      {/* STAFF LIST */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {staff.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#8E8E93' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
            <div style={{ marginBottom: 12 }}>No staff members yet</div>
            <button className="btn-primary" onClick={openAdd}>Add your first staff member</button>
          </div>
        ) : (
          staff.map(member => (
            <div key={member.staff_id} className="card" style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#185FA5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {member.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{member.name}</div>
                    <div style={{ fontSize: 11, color: '#0A84FF' }}>+91 {member.mobile}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span className={`chip ${member.is_active ? 'chip-accepted' : 'chip-rejected'}`}>
                    {member.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              {/* Permissions */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                {ALL_PERMISSIONS.map(p => (
                  <span key={p.key} style={{
                    fontSize: 9, padding: '2px 7px', borderRadius: 6,
                    background: member.permissions?.[p.key] ? '#003A10' : '#2C2C2E',
                    color: member.permissions?.[p.key] ? '#30D158' : '#636366',
                    fontWeight: 600,
                  }}>{p.label}</span>
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => openEdit(member)}
                  style={{ flex: 1, background: '#0A1F35', color: '#0A84FF', border: 'none', borderRadius: 8, padding: '7px 0', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                  Edit Permissions
                </button>
                <button onClick={() => toggleActive(member.staff_id, member.is_active)}
                  style={{ background: member.is_active ? '#2A1500' : '#003A10', color: member.is_active ? '#FF9500' : '#30D158', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                  {member.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button onClick={() => removeStaff(member.staff_id)}
                  style={{ background: '#2A0A0A', color: '#FF453A', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
