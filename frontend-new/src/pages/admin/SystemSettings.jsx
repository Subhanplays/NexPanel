import { useState, useEffect } from 'react';
import { api } from '../../api';
import { Trash2, Plus } from 'lucide-react';

export default function AdminSettings() {
  const [settings, setSettings] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ key: '', value: '', category: 'general' });
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState('');

  const load = () => api.get('/admin/settings').then(setSettings).catch(() => {});
  useEffect(() => { load(); }, []);

  const create = async () => { await api.post('/admin/settings', form); setShowCreate(false); load(); };
  const save = async (id) => { await api.put(`/admin/settings/${id}`, { value: editVal }); setEditId(null); load(); };
  const remove = async (id) => { if (!confirm('Delete?')) return; await api.del(`/admin/settings/${id}`); load(); };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">System Settings</h2>
        <button onClick={() => setShowCreate(!showCreate)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: 'var(--primary)' }}><Plus size={14} /> Add Setting</button>
      </div>
      {showCreate && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
          <div className="grid grid-cols-3 gap-3">
            {['key', 'value', 'category'].map(k => <input key={k} placeholder={k} value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} className="px-3 py-2 rounded-lg border text-sm outline-none" style={{ background: 'var(--input)', color: 'var(--text)', borderColor: 'var(--border)' }} />)}
          </div>
          <button onClick={create} disabled={!form.key} className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50" style={{ background: 'var(--primary)' }}>Create</button>
        </div>
      )}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
        <table className="w-full text-sm">
          <thead><tr className="text-xs uppercase" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
            <th className="text-left px-5 py-3">Key</th><th className="text-left px-5 py-3">Value</th><th className="text-left px-5 py-3">Category</th><th className="text-left px-5 py-3">Actions</th>
          </tr></thead>
          <tbody>
            {settings.length === 0 ? <tr><td colSpan={4} className="px-5 py-8 text-center" style={{ color: 'var(--text-muted)' }}>No settings</td></tr> : settings.map(s => (
              <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td className="px-5 py-3 font-mono text-xs">{s.key}</td>
                <td className="px-5 py-3">
                  {editId === s.id ? (
                    <div className="flex gap-2"><input value={editVal} onChange={e => setEditVal(e.target.value)} className="px-2 py-1 rounded border text-sm outline-none flex-1" style={{ background: 'var(--input)', color: 'var(--text)', borderColor: 'var(--border)' }} /><button onClick={() => save(s.id)} className="text-emerald-400 text-xs font-medium">Save</button></div>
                  ) : <span className="cursor-pointer hover:opacity-80" onClick={() => { setEditId(s.id); setEditVal(s.value); }}>{s.value}</span>}
                </td>
                <td className="px-5 py-3" style={{ color: 'var(--text-muted)' }}>{s.category}</td>
                <td className="px-5 py-3"><button onClick={() => remove(s.id)} className="p-1.5 rounded hover:bg-red-500/10 text-red-400"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
