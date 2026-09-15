import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { ArrowLeft, RefreshCw, X, Cpu } from 'lucide-react';

export default function Processes() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vps, setVps] = useState(null);
  const [processes, setProcesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState('cpu');

  useEffect(() => {
    api.get(`/vps/${id}`).then(setVps).catch(() => navigate('/vps'));
  }, [id]);

  const load = () => {
    setLoading(true); setError('');
    api.get(`/vps/${id}/processes`)
      .then(setProcesses)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const kill = async (pid, signal = 'SIGTERM') => {
    if (!confirm(`Kill process ${pid}?`)) return;
    try {
      await api.post(`/vps/${id}/processes/${pid}/kill?signal=${signal}`);
      setTimeout(load, 500);
    } catch (err) {
      setError(err.message);
    }
  };

  const sorted = [...processes].sort((a, b) => {
    if (sortBy === 'cpu') return b.cpu - a.cpu;
    if (sortBy === 'mem') return b.mem - a.mem;
    if (sortBy === 'pid') return b.pid - a.pid;
    return 0;
  });

  if (!vps) return null;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(`/vps/${id}`)} className="p-2 rounded-lg hover:bg-gray-800 transition-colors"><ArrowLeft size={20} /></button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Process Manager</h1>
          <p className="text-sm text-gray-500">{vps.name}</p>
        </div>
        <button onClick={load} className="p-2 rounded-lg hover:bg-gray-800 transition-colors"><RefreshCw size={18} /></button>
      </div>

      {error && <div className="p-3 rounded-xl text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20">{error}</div>}

      {/* Sort buttons */}
      <div className="flex gap-2">
        {['cpu', 'mem', 'pid'].map(s => (
          <button key={s} onClick={() => setSortBy(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${sortBy === s ? 'text-white' : 'border'}`}
            style={sortBy === s ? { background: 'var(--primary)' } : { borderColor: 'var(--border)', color: 'var(--text)' }}>
            {s === 'cpu' ? 'CPU' : s === 'mem' ? 'RAM' : 'PID'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(10)].map((_, i) => <div key={i} className="h-10 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />)}
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <div className="grid grid-cols-[60px_60px_60px_60px_1fr_80px] gap-2 px-4 py-2 text-xs font-medium border-b" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            <span>PID</span><span>CPU%</span><span>RAM%</span><span>RSS</span><span>Command</span><span></span>
          </div>
          {sorted.map(p => (
            <div key={p.pid} className="grid grid-cols-[60px_60px_60px_60px_1fr_80px] gap-2 px-4 py-2.5 text-sm border-b last:border-0 hover:bg-gray-800/30 transition-colors items-center" style={{ borderColor: 'var(--border)' }}>
              <span className="font-mono text-xs">{p.pid}</span>
              <span className={`font-mono text-xs ${p.cpu > 50 ? 'text-red-400' : p.cpu > 20 ? 'text-yellow-400' : ''}`}>{p.cpu.toFixed(1)}</span>
              <span className={`font-mono text-xs ${p.mem > 50 ? 'text-red-400' : p.mem > 20 ? 'text-yellow-400' : ''}`}>{p.mem.toFixed(1)}</span>
              <span className="font-mono text-xs">{Math.round(p.rss / 1024)}M</span>
              <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{p.command}</span>
              <button onClick={() => kill(p.pid)} className="p-1 rounded hover:bg-red-900/30 transition-colors justify-self-end" title="Kill">
                <X size={14} className="text-red-500" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
