import { useState, useEffect } from 'react';
import { api } from '../../api';
import { Trash2, Plus } from 'lucide-react';

export default function AdminHosts() {
  const [hosts, setHosts] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', hostname: '', ip_address: '', max_containers: 50, api_key: '' });
  const load = () => api.get('/admin/hosts').then(setHosts).catch(() => {});
  useEffect(() => { load(); }, []);

  const create = async () => { await api.post('/admin/hosts', form); setShowCreate(false); load(); };
  const remove = async (id) => { if (!confirm('Delete?')) return; await api.del(`/admin/hosts/${id}`); load(); };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Host Management</h2>
        <button onClick={() => setShowCreate(!showCreate)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: 'var(--primary)' }}><Plus size={14} /> Add Host</button>
      </div>
      {showCreate && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {['name', 'hostname', 'ip_address', 'api_key'].map(k => <input key={k} placeholder={k.replace('_', ' ')} value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} className="px-3 py-2 rounded-lg border text-sm outline-none" style={{ background: 'var(--input)', color: 'var(--text)', borderColor: 'var(--border)' }} />)}
            <input placeholder="Max Containers" type="number" value={form.max_containers} onChange={e => setForm({ ...form, max_containers: +e.target.value })} className="px-3 py-2 rounded-lg border text-sm outline-none" style={{ background: 'var(--input)', color: 'var(--text)', borderColor: 'var(--border)' }} />
          </div>
          <button onClick={create} disabled={!form.name} className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50" style={{ background: 'var(--primary)' }}>Create</button>
        </div>
      )}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
        <table className="w-full text-sm">
          <thead><tr className="text-xs uppercase" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
            <th className="text-left px-5 py-3">Name</th><th className="text-left px-5 py-3">Hostname</th><th className="text-left px-5 py-3">IP</th><th className="text-left px-5 py-3">Max</th><th className="text-left px-5 py-3">Actions</th>
          </tr></thead>
          <tbody>
            {hosts.length === 0 ? <tr><td colSpan={5} className="px-5 py-8 text-center" style={{ color: 'var(--text-muted)' }}>No hosts</td></tr> : hosts.map(h => (
              <tr key={h.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td className="px-5 py-3 font-medium">{h.name}</td>
                <td className="px-5 py-3" style={{ color: 'var(--text-muted)' }}>{h.hostname}</td>
                <td className="px-5 py-3 font-mono text-xs">{h.ip_address}</td>
                <td className="px-5 py-3" style={{ color: 'var(--text-muted)' }}>{h.max_containers}</td>
                <td className="px-5 py-3"><button onClick={() => remove(h.id)} className="p-1.5 rounded hover:bg-red-500/10 text-red-400"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
