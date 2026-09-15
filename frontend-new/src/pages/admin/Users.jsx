import { useState, useEffect } from 'react';
import { api } from '../../api';
import { Trash2, Plus, Eye, EyeOff, Shield } from 'lucide-react';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', password: '', is_admin: false, vps_limit: 10, cpu_limit: 8, ram_limit: 32, disk_limit: 500, ipv4_limit: 5 });

  const load = () => api.get('/admin/users').then(setUsers).catch(() => {});
  useEffect(() => { load(); }, []);

  const toggle = async (id, field, val) => { await api.put(`/admin/users/${id}`, { [field]: !val }); load(); };
  const create = async () => { await api.post('/admin/users', form); setShowCreate(false); setForm({ username: '', email: '', password: '', is_admin: false, vps_limit: 10, cpu_limit: 8, ram_limit: 32, disk_limit: 500, ipv4_limit: 5 }); load(); };
  const remove = async (id) => { if (!confirm('Delete this user?')) return; await api.del(`/admin/users/${id}`); load(); };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">User Management</h2>
        <button onClick={() => setShowCreate(!showCreate)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: 'var(--primary)' }}><Plus size={14} /> Create User</button>
      </div>

      {showCreate && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { k: 'username', ph: 'Username' },
              { k: 'email', ph: 'Email', type: 'email' },
              { k: 'password', ph: 'Password', type: 'password' },
            ].map(f => <input key={f.k} type={f.type || 'text'} placeholder={f.ph} value={form[f.k]} onChange={e => setForm({ ...form, [f.k]: e.target.value })} className="px-3 py-2 rounded-lg border text-sm outline-none" style={{ background: 'var(--input)', color: 'var(--text)', borderColor: 'var(--border)' }} />)}
            <label className="flex items-center gap-2 text-sm cursor-pointer" onClick={() => setForm({ ...form, is_admin: !form.is_admin })}>
              <div className={`w-5 h-5 rounded border flex items-center justify-center ${form.is_admin ? 'text-white' : ''}`} style={{ background: form.is_admin ? 'var(--primary)' : 'transparent', borderColor: 'var(--border)' }}>
                {form.is_admin && <span className="text-xs">&#10003;</span>}
              </div> Admin
            </label>
            {[
              { k: 'vps_limit', l: 'VPS Limit' },
              { k: 'cpu_limit', l: 'CPU Limit' },
              { k: 'ram_limit', l: 'RAM Limit' },
              { k: 'disk_limit', l: 'Disk Limit' },
              { k: 'ipv4_limit', l: 'IPv4 Limit' },
            ].map(f => <div key={f.k}><label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{f.l}</label><input type="number" value={form[f.k]} onChange={e => setForm({ ...form, [f.k]: +e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={{ background: 'var(--input)', color: 'var(--text)', borderColor: 'var(--border)' }} /></div>)}
          </div>
          <button onClick={create} disabled={!form.username || !form.email || !form.password} className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50" style={{ background: 'var(--primary)' }}>Create</button>
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
        <table className="w-full text-sm">
          <thead><tr className="text-xs uppercase" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
            <th className="text-left px-5 py-3">User</th><th className="text-left px-5 py-3">Email</th><th className="text-left px-5 py-3">Limits</th><th className="text-left px-5 py-3">Role</th><th className="text-left px-5 py-3">Status</th><th className="text-left px-5 py-3">Actions</th>
          </tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td className="px-5 py-3"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium" style={{ background: 'var(--primary)' }}>{(u.username || '?')[0].toUpperCase()}</div><div><div className="font-medium">{u.username}</div><div className="text-xs" style={{ color: 'var(--text-muted)' }}>ID: {u.id}</div></div></div></td>
                <td className="px-5 py-3" style={{ color: 'var(--text-muted)' }}>{u.email}</td>
                <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{u.vps_limit} VPS / {u.cpu_limit}c / {u.ram_limit}g / {u.disk_limit}g</td>
                <td className="px-5 py-3"><button onClick={() => toggle(u.id, 'is_admin', u.is_admin)} className={`px-2.5 py-1 rounded-full text-xs font-medium border ${u.is_admin ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>{u.is_admin ? 'Admin' : 'User'}</button></td>
                <td className="px-5 py-3"><span className={`inline-flex items-center gap-1.5 text-xs ${u.is_active ? 'text-emerald-400' : 'text-red-400'}`}><span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-400' : 'bg-red-400'}`} />{u.is_active ? 'Active' : 'Disabled'}</span></td>
                <td className="px-5 py-3"><div className="flex gap-1"><button onClick={() => toggle(u.id, 'is_active', u.is_active)} className="p-1.5 rounded hover:bg-[var(--surface-hover)]" title={u.is_active ? 'Disable' : 'Enable'}>{u.is_active ? <EyeOff size={14} /> : <Eye size={14} />}</button><button onClick={() => remove(u.id)} className="p-1.5 rounded hover:bg-red-500/10 text-red-400" title="Delete"><Trash2 size={14} /></button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
