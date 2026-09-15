import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { StatusBadge } from './Dashboard';
import { Plus, Search } from 'lucide-react';

export default function VPSList() {
  const [vpsList, setVpsList] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/vps/').then(data => {
      setVpsList(Array.isArray(data) ? data : []);
    }).catch(() => setVpsList([])).finally(() => setLoading(false));
  }, []);

  const filtered = vpsList.filter(v => {
    if (filter !== 'all' && v.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (v.name || '').toLowerCase().includes(q) || (v.vps_id || '').toLowerCase().includes(q) || (v.os_image || '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">VPS Management</h1>
        <button onClick={() => navigate('/deploy')} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium transition-all hover:scale-[1.02]" style={{ background: 'var(--primary)' }}>
          <Plus size={16} /> Deploy VPS
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search VPS..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-all"
            style={{ background: 'var(--input)', color: 'var(--text)', borderColor: 'var(--border)' }} />
        </div>
        <div className="flex gap-1.5 p-1 rounded-xl" style={{ background: 'var(--surface)' }}>
          {['all', 'running', 'stopped'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{ background: filter === f ? 'var(--primary)' : 'transparent', color: filter === f ? 'white' : 'var(--text-muted)' }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="rounded-2xl p-5 h-48 animate-pulse" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl p-16 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--bg)' }}>
            <Search size={24} style={{ color: 'var(--text-muted)' }} />
          </div>
          <h3 className="font-semibold mb-1">No VPS Found</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{search ? 'Try a different search.' : 'Deploy your first VPS to get started.'}</p>
          <button onClick={() => navigate('/deploy')} className="px-4 py-2 rounded-xl text-white text-sm font-medium" style={{ background: 'var(--primary)' }}>Deploy VPS</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((v, i) => (
            <div key={v.vps_id || v.id} onClick={() => navigate(`/vps/${v.vps_id || v.id}`)}
              className="rounded-2xl p-5 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg group"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="font-semibold group-hover:text-[var(--primary)] transition-colors">{v.name || 'Unnamed'}</div>
                  <div className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>{v.vps_id || v.id}</div>
                </div>
                <StatusBadge status={v.status} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                <div style={{ color: 'var(--text-muted)' }}>{v.cpu_cores || 1} vCPU</div>
                <div style={{ color: 'var(--text-muted)' }}>{v.memory_gb || 1} GB RAM</div>
                <div style={{ color: 'var(--text-muted)' }}>{v.disk_gb || 20} GB Disk</div>
                <div className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{v.os_image || 'N/A'}</div>
              </div>
              <div className="flex items-center justify-between text-xs pt-3" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
                <span className="font-mono">{v.tailscale_ip || '-'}</span>
                <span>{timeAgo(v.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function timeAgo(d) {
  if (!d) return '-';
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
