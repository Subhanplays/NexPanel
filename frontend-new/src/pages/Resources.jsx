import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { ArrowLeft, RefreshCw, Cpu, HardDrive, MemoryStick, Wifi, Clock, Activity } from 'lucide-react';

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="p-4 rounded-2xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 rounded-xl" style={{ background: `${color}15` }}><Icon size={18} style={{ color }} /></div>
        <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
}

function ProgressBar({ value, max, color, label }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span className="font-mono">{pct.toFixed(1)}%</span>
      </div>
      <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
        <span>{formatBytes(value)}</span>
        <span>{formatBytes(max)}</span>
      </div>
    </div>
  );
}

export default function Resources() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vps, setVps] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef(null);

  useEffect(() => {
    api.get(`/vps/${id}`).then(setVps).catch(() => navigate('/vps'));
  }, [id]);

  const load = () => {
    setError('');
    api.get(`/vps/${id}/stats`)
      .then(setStats)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(load, 3000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, id]);

  if (!vps) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(`/vps/${id}`)} className="p-2 rounded-lg hover:bg-gray-800 transition-colors"><ArrowLeft size={20} /></button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Resources</h1>
          <p className="text-sm text-gray-500">{vps.name}</p>
        </div>
        <button onClick={() => setAutoRefresh(!autoRefresh)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${autoRefresh ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'border'}`}
          style={!autoRefresh ? { borderColor: 'var(--border)' } : {}}>
          {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
        </button>
        <button onClick={load} className="p-2 rounded-lg hover:bg-gray-800 transition-colors"><RefreshCw size={18} /></button>
      </div>

      {error && <div className="p-3 rounded-xl text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20">{error}</div>}

      {loading && !stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-32 rounded-2xl animate-pulse" style={{ background: 'var(--surface)' }} />)}
        </div>
      ) : stats && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard icon={Cpu} label="CPU" value={`${stats.cpu_percent}%`} color="#6366f1" />
            <StatCard icon={MemoryStick} label="Memory" value={`${stats.memory_percent}%`} sub={`${formatBytes(stats.memory_used)} / ${formatBytes(stats.memory_total)}`} color="#8b5cf6" />
            <StatCard icon={HardDrive} label="Disk" value={`${stats.disk_percent}%`} sub={`${formatBytes(stats.disk_used)} / ${formatBytes(stats.disk_total)}`} color="#a855f7" />
            <StatCard icon={Wifi} label="Network RX" value={formatBytes(stats.network_rx)} color="#06b6d4" />
            <StatCard icon={Wifi} label="Network TX" value={formatBytes(stats.network_tx)} color="#0ea5e9" />
            <StatCard icon={Clock} label="Uptime" value={stats.uptime} sub={`Load: ${stats.load_avg}`} color="#10b981" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <h3 className="font-semibold mb-4">Resource Usage</h3>
              <div className="space-y-5">
                <ProgressBar value={stats.memory_used} max={stats.memory_total} color="#8b5cf6" label="Memory" />
                <ProgressBar value={stats.disk_used} max={stats.disk_total} color="#a855f7" label="Disk" />
              </div>
            </div>
            <div className="p-5 rounded-2xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <h3 className="font-semibold mb-4">CPU Usage</h3>
              <div className="flex items-center justify-center h-40">
                <div className="relative w-40 h-40">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border)" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#6366f1" strokeWidth="3"
                      strokeDasharray={`${stats.cpu_percent} ${100 - stats.cpu_percent}`}
                      strokeLinecap="round" className="transition-all duration-500" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-3xl font-bold">{stats.cpu_percent}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
