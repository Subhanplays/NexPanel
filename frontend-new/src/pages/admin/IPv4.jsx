import { useState, useEffect } from 'react';
import { api } from '../../api';
import { Trash2, Plus } from 'lucide-react';

export default function AdminIPv4() {
  const [ips, setIps] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [form, setForm] = useState({ ip_address: '', subnet: '24', gateway: '', dns: '1.1.1.1' });
  const [bulk, setBulk] = useState({ start_ip: '', count: 10, subnet: '24', gateway: '', dns: '1.1.1.1' });
  const load = () => api.get('/ipv4/').then(d => setIps(Array.isArray(d) ? d : [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const add = async () => { await api.post('/ipv4/', form); setShowAdd(false); load(); };
  const addBulk = async () => { await api.post('/ipv4/bulk', bulk); setShowBulk(false); load(); };
  const remove = async (id) => { if (!confirm('Delete?')) return; await api.del(`/ipv4/${id}`); load(); };

  const statusColors = { available: 'bg-emerald-500/10 text-emerald-400', assigned: 'bg-blue-500/10 text-blue-400', reserved: 'bg-yellow-500/10 text-yellow-400' };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">IPv4 Pool ({ips.length} addresses)</h2>
        <div className="flex gap-2">
          <button onClick={() => { setShowAdd(!showAdd); setShowBulk(false); }} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: 'var(--primary)' }}><Plus size={14} /> Add IP</button>
          <button onClick={() => { setShowBulk(!showBulk); setShowAdd(false); }} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--border)' }}><Plus size={14} /> Bulk Add</button>
        </div>
      </div>
      {showAdd && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {['ip_address', 'subnet', 'gateway', 'dns'].map(k => <input key={k} placeholder={k.replace('_', ' ')} value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} className="px-3 py-2 rounded-lg border text-sm outline-none" style={{ background: 'var(--input)', color: 'var(--text)', borderColor: 'var(--border)' }} />)}
          </div>
          <button onClick={add} className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: 'var(--primary)' }}>Add</button>
        </div>
      )}
      {showBulk && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input placeholder="Start IP" value={bulk.start_ip} onChange={e => setBulk({ ...bulk, start_ip: e.target.value })} className="px-3 py-2 rounded-lg border text-sm outline-none" style={{ background: 'var(--input)', color: 'var(--text)', borderColor: 'var(--border)' }} />
            <input placeholder="Count" type="number" value={bulk.count} onChange={e => setBulk({ ...bulk, count: +e.target.value })} className="px-3 py-2 rounded-lg border text-sm outline-none" style={{ background: 'var(--input)', color: 'var(--text)', borderColor: 'var(--border)' }} />
            <input placeholder="Subnet" value={bulk.subnet} onChange={e => setBulk({ ...bulk, subnet: e.target.value })} className="px-3 py-2 rounded-lg border text-sm outline-none" style={{ background: 'var(--input)', color: 'var(--text)', borderColor: 'var(--border)' }} />
            <input placeholder="Gateway" value={bulk.gateway} onChange={e => setBulk({ ...bulk, gateway: e.target.value })} className="px-3 py-2 rounded-lg border text-sm outline-none" style={{ background: 'var(--input)', color: 'var(--text)', borderColor: 'var(--border)' }} />
          </div>
          <button onClick={addBulk} className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: 'var(--primary)' }}>Bulk Add {bulk.count} IPs</button>
        </div>
      )}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
        <table className="w-full text-sm">
          <thead><tr className="text-xs uppercase" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
            <th className="text-left px-5 py-3">IP Address</th><th className="text-left px-5 py-3">Subnet</th><th className="text-left px-5 py-3">Status</th><th className="text-left px-5 py-3">Actions</th>
          </tr></thead>
          <tbody>
            {ips.length === 0 ? <tr><td colSpan={4} className="px-5 py-8 text-center" style={{ color: 'var(--text-muted)' }}>No IPs</td></tr> : ips.slice(0, 100).map(ip => (
              <tr key={ip.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td className="px-5 py-3 font-mono text-xs">{ip.ip_address}</td>
                <td className="px-5 py-3" style={{ color: 'var(--text-muted)' }}>/{ip.subnet}</td>
                <td className="px-5 py-3"><span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[ip.status || (ip.reserved ? 'reserved' : 'available')] || 'bg-gray-500/10 text-gray-400'}`}>{ip.status || (ip.reserved ? 'reserved' : 'available')}</span></td>
                <td className="px-5 py-3"><button onClick={() => remove(ip.id)} className="p-1.5 rounded hover:bg-red-500/10 text-red-400"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
