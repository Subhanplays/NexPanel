import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Server, Cpu, HardDrive, MemoryStick, Globe, Play, Square, Activity, Plus } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

const StatCard = ({ icon: Icon, label, value, color, gradient }) => (
  <div className="rounded-2xl p-5 transition-all hover:scale-[1.02] cursor-default" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
    <div className="flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={22} />
      </div>
      <div>
        <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</div>
        <div className="text-2xl font-bold mt-0.5">{value}</div>
      </div>
    </div>
  </div>
);

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [vpsList, setVpsList] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.allSettled([api.get('/dashboard/stats'), api.get('/vps/')]).then(([s, v]) => {
      setStats(s.status === 'fulfilled' ? s.value : null);
      const list = v.status === 'fulfilled' ? v.value : [];
      setVpsList(Array.isArray(list) ? list : []);
    });
  }, []);

  const s = stats || { total_vps: 0, running: 0, stopped: 0, total_cpu: 0, total_ram: 0, total_disk: 0, total_ipv4: 0 };

  const chartData = [
    { name: 'CPU', used: s.running, total: s.total_vps || 1 },
    { name: 'RAM', used: s.total_ram, total: 100 },
    { name: 'Disk', used: s.total_disk, total: 100 },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <button onClick={() => navigate('/deploy')} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium transition-all hover:scale-[1.02]" style={{ background: 'var(--primary)' }}>
          <Plus size={16} /> Deploy VPS
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Server} label="Total VPS" value={s.total_vps} color="bg-indigo-500/10 text-indigo-400" />
        <StatCard icon={Play} label="Running" value={s.running} color="bg-emerald-500/10 text-emerald-400" />
        <StatCard icon={Square} label="Stopped" value={s.stopped} color="bg-red-500/10 text-red-400" />
        <StatCard icon={Cpu} label="CPU Cores" value={s.total_cpu} color="bg-purple-500/10 text-purple-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent VPS */}
        <div className="lg:col-span-2 rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="font-semibold">Recent VPS</h2>
            <button onClick={() => navigate('/vps')} className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors" style={{ color: 'var(--primary)', background: 'var(--primary)/10' }}>View All</button>
          </div>
          {vpsList.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--bg)' }}>
                <Server size={28} style={{ color: 'var(--text-muted)' }} />
              </div>
              <p className="font-medium mb-1" style={{ color: 'var(--text-muted)' }}>No VPS deployed yet</p>
              <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Deploy your first VPS to get started</p>
              <button onClick={() => navigate('/deploy')} className="px-4 py-2 rounded-xl text-white text-sm font-medium" style={{ background: 'var(--primary)' }}>Deploy First VPS</button>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {vpsList.slice(0, 5).map(v => (
                <div key={v.vps_id || v.id} onClick={() => navigate(`/vps/${v.vps_id || v.id}`)}
                  className="flex items-center justify-between px-6 py-3.5 cursor-pointer transition-colors hover:bg-[var(--surface-hover)]">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--bg)' }}>
                      <Server size={16} style={{ color: 'var(--text-muted)' }} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{v.name || 'Unnamed'}</div>
                      <div className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{v.os_image || '-'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <StatusBadge status={v.status} />
                    <span className="text-xs hidden sm:block" style={{ color: 'var(--text-muted)' }}>{timeAgo(v.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h2 className="font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <button onClick={() => navigate('/deploy')} className="w-full py-2.5 rounded-xl text-white text-sm font-medium transition-all" style={{ background: 'var(--primary)' }}>Deploy New VPS</button>
              <button onClick={() => navigate('/vps')} className="w-full py-2.5 rounded-xl text-sm font-medium transition-all" style={{ border: '1px solid var(--border)', color: 'var(--text)' }}>Manage VPS</button>
              <button onClick={() => navigate('/settings')} className="w-full py-2.5 rounded-xl text-sm font-medium transition-all" style={{ border: '1px solid var(--border)', color: 'var(--text)' }}>Account Settings</button>
            </div>
          </div>
          <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h2 className="font-semibold mb-4">Resources</h2>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12, color: 'var(--text)' }} />
                  <Bar dataKey="total" fill="var(--border)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="used" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StatusBadge({ status }) {
  const colors = {
    running: 'bg-emerald-500/10 text-emerald-400',
    stopped: 'bg-red-500/10 text-red-400',
    creating: 'bg-yellow-500/10 text-yellow-400',
    error: 'bg-red-500/10 text-red-400',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-500/10 text-gray-400'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'running' ? 'bg-emerald-400 animate-pulse-dot' : status === 'creating' ? 'bg-yellow-400 animate-pulse-dot' : 'bg-gray-500'}`} />
      {status || 'unknown'}
    </span>
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
