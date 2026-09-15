import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { Server, Users, Play, Square, Globe, Zap, HardDrive, ChevronRight } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export default function AdminOverview() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [vpsList, setVpsList] = useState([]);
  const [hosts, setHosts] = useState([]);

  useEffect(() => {
    Promise.allSettled([
      api.get('/admin/vps/stats'), api.get('/admin/users'), api.get('/admin/vps'), api.get('/admin/hosts'),
    ]).then(([s, u, v, h]) => {
      if (s.status === 'fulfilled') setStats(s.value);
      if (u.status === 'fulfilled') setUsers(Array.isArray(u.value) ? u.value : []);
      if (v.status === 'fulfilled') setVpsList(Array.isArray(v.value) ? v.value : []);
      if (h.status === 'fulfilled') setHosts(Array.isArray(h.value) ? h.value : []);
    });
  }, []);

  const s = stats || {};

  const cards = [
    { label: 'Users', value: users.length, icon: Users, color: 'bg-indigo-500/10 text-indigo-400', to: '/admin/users' },
    { label: 'VPS', value: s.total_vps || 0, icon: Server, color: 'bg-purple-500/10 text-purple-400', to: '/admin/vps' },
    { label: 'Running', value: s.running || 0, icon: Play, color: 'bg-emerald-500/10 text-emerald-400', to: '/admin/vps' },
    { label: 'Stopped', value: s.stopped || 0, icon: Square, color: 'bg-red-500/10 text-red-400', to: '/admin/vps' },
    { label: 'CPU', value: s.total_cpu_cores || 0, icon: Zap, color: 'bg-yellow-500/10 text-yellow-400', to: '/admin/vps' },
    { label: 'Hosts', value: hosts.length, icon: Globe, color: 'bg-cyan-500/10 text-cyan-400', to: '/admin/hosts' },
  ];

  const vpsData = [
    { name: 'Running', value: s.running || 0, color: '#22c55e' },
    { name: 'Stopped', value: s.stopped || 0, color: '#ef4444' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((c, i) => (
          <div key={i} onClick={() => navigate(c.to)}
            className="rounded-2xl p-4 cursor-pointer transition-all hover:scale-[1.02] group"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.color} group-hover:scale-110 transition-transform`}>
                <c.icon size={18} />
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{c.label}</div>
                <div className="text-xl font-bold">{c.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* VPS Distribution */}
        <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold mb-5">VPS Distribution</h2>
          {vpsData.length > 0 ? (
            <div className="flex items-center gap-8">
              <div className="w-36 h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={vpsData} cx="50%" cy="50%" innerRadius={38} outerRadius={60} dataKey="value" strokeWidth={0}>
                      {vpsData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-4">
                {vpsData.map(d => (
                  <div key={d.name} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{d.name}</span>
                    <span className="text-lg font-bold ml-auto">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center">
              <Server size={28} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No VPS yet</p>
            </div>
          )}
        </div>

        {/* Resources */}
        <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold mb-5">Resource Allocation</h2>
          <div className="space-y-5">
            {[
              { label: 'CPU', used: s.total_cpu_cores || 0, max: 128, unit: 'cores', icon: Zap, color: 'var(--primary)' },
              { label: 'RAM', used: s.total_ram_gb || 0, max: 512, unit: 'GB', icon: HardDrive, color: '#22c55e' },
              { label: 'Disk', used: s.total_disk_gb || 0, max: 4000, unit: 'GB', icon: HardDrive, color: '#f59e0b' },
            ].map(r => (
              <div key={r.label}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <r.icon size={14} style={{ color: r.color }} />
                    <span className="text-sm font-medium">{r.label}</span>
                  </div>
                  <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{r.used} / {r.max} {r.unit}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min((r.used / r.max) * 100, 100)}%`, background: r.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Users & VPS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="text-sm font-semibold">Recent Users</h2>
            <button onClick={() => navigate('/admin/users')} className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--primary)' }}>
              View All <ChevronRight size={12} />
            </button>
          </div>
          {users.length === 0 ? (
            <div className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No users yet</div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {users.slice(0, 5).map(u => (
                <div key={u.id} className="flex items-center gap-3 px-6 py-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-medium shrink-0" style={{ background: 'var(--primary)' }}>
                    {(u.username || '?')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{u.username}</div>
                    <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{u.email}</div>
                  </div>
                  {u.is_admin && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400">ADMIN</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="text-sm font-semibold">Recent VPS</h2>
            <button onClick={() => navigate('/admin/vps')} className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--primary)' }}>
              View All <ChevronRight size={12} />
            </button>
          </div>
          {vpsList.length === 0 ? (
            <div className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No VPS yet</div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {vpsList.slice(0, 5).map(v => (
                <div key={v.vps_id || v.id} className="flex items-center justify-between px-6 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--bg)' }}>
                      <Server size={14} style={{ color: 'var(--text-muted)' }} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{v.name || 'Unnamed'}</div>
                      <div className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{v.os_image || '-'}</div>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${v.status === 'running' ? 'bg-emerald-500/10 text-emerald-400' : v.status === 'stopped' ? 'bg-red-500/10 text-red-400' : 'bg-gray-500/10 text-gray-400'}`}>
                    {v.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
