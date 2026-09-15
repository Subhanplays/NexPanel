import { useState, useEffect } from 'react';
import { api } from '../../api';

const statusColors = {
  running: 'bg-emerald-500/10 text-emerald-400',
  stopped: 'bg-red-500/10 text-red-400',
  creating: 'bg-yellow-500/10 text-yellow-400',
  error: 'bg-red-500/10 text-red-400',
};

export default function AdminVPS() {
  const [vps, setVps] = useState([]);
  useEffect(() => { api.get('/admin/vps').then(d => setVps(Array.isArray(d) ? d : [])).catch(() => {}); }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">All VPS Instances</h2>
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
        <table className="w-full text-sm">
          <thead><tr className="text-xs uppercase" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
            <th className="text-left px-5 py-3">Name</th><th className="text-left px-5 py-3">Status</th><th className="text-left px-5 py-3">Specs</th><th className="text-left px-5 py-3">OS</th><th className="text-left px-5 py-3">User ID</th><th className="text-left px-5 py-3">Created</th>
          </tr></thead>
          <tbody>
            {vps.length === 0 ? <tr><td colSpan={6} className="px-5 py-8 text-center" style={{ color: 'var(--text-muted)' }}>No VPS found</td></tr> : vps.map(v => (
              <tr key={v.vps_id || v.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td className="px-5 py-3 font-medium">{v.name}</td>
                <td className="px-5 py-3"><span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[v.status] || 'bg-gray-500/10 text-gray-400'}`}>{v.status}</span></td>
                <td className="px-5 py-3" style={{ color: 'var(--text-muted)' }}>{v.cpu_cores}c / {v.memory_gb}g / {v.disk_gb}g</td>
                <td className="px-5 py-3 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{v.os_image}</td>
                <td className="px-5 py-3" style={{ color: 'var(--text-muted)' }}>{v.user_id}</td>
                <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(v.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
