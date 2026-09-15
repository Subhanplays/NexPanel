import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { Server, Users, Cpu, HardDrive, MemoryStick, Globe, Play, Square, Shield, Activity, ArrowRight, Settings, Clock, TrendingUp, AlertTriangle, Zap } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts';

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [vpsList, setVpsList] = useState([]);
  const [logs, setLogs] = useState([]);
  const [hosts, setHosts] = useState([]);
  const [ips, setIps] = useState([]);

  useEffect(() => {
    if (!user?.is_admin) return;
    Promise.allSettled([
      api.get('/admin/vps/stats'),
      api.get('/admin/users'),
      api.get('/admin/vps'),
      api.get('/admin/audit-logs?page=1&per_page=10'),
      api.get('/admin/hosts'),
      api.get('/ipv4/'),
    ]).then(([s, u, v, l, h, ip]) => {
      if (s.status === 'fulfilled') setStats(s.value);
      if (u.status === 'fulfilled') setUsers(Array.isArray(u.value) ? u.value : []);
      if (v.status === 'fulfilled') setVpsList(Array.isArray(v.value) ? v.value : []);
      if (l.status === 'fulfilled') setLogs(Array.isArray(l.value) ? l.value : []);
      if (h.status === 'fulfilled') setHosts(Array.isArray(h.value) ? h.value : []);
      if (ip.status === 'fulfilled') setIps(Array.isArray(ip.value) ? ip.value : []);
    });
  }, [user]);

  if (!user?.is_admin) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Shield size={48} className="mb-4" style={{ color: 'var(--text-muted)' }} />
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p style={{ color: 'var(--text-muted)' }}>Admin privileges required.</p>
      </div>
    );
  }

  const s = stats || {};
  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.is_active).length;
  const adminUsers = users.filter(u => u.is_admin).length;
  const availableIps = ips.filter(i => i.status === 'available' || !i.status).length;
  const assignedIps = ips.filter(i => i.status === 'assigned').length;

  const vpsStatusData = [
    { name: 'Running', value: s.running || 0, color: '#22c55e' },
    { name: 'Stopped', value: s.stopped || 0, color: '#ef4444' },
    { name: 'Other', value: Math.max(0, (s.total_vps || 0) - (s.running || 0) - (s.stopped || 0)), color: '#eab308' },
  ].filter(d => d.value > 0);

  const resourceData = [
    { name: 'CPU', used: s.total_cpu_cores || 0, label: 'cores' },
    { name: 'RAM', used: s.total_ram_gb || 0, label: 'GB' },
    { name: 'Disk', used: s.total_disk_gb || 0, label: 'GB' },
  ];

  const recentUsers = users.slice(0, 5);
  const recentVps = vpsList.slice(0, 5);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>System overview and management</p>
        </div>
        <button onClick={() => navigate('/admin/panel')} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: 'var(--primary)' }}>
          <Settings size={14} /> Admin Panel <ArrowRight size={14} />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard icon={Users} label="Total Users" value={totalUsers} color="bg-indigo-500/10 text-indigo-400" />
        <StatCard icon={Server} label="Total VPS" value={s.total_vps || 0} color="bg-purple-500/10 text-purple-400" />
        <StatCard icon={Play} label="Running" value={s.running || 0} color="bg-emerald-500/10 text-emerald-400" />
        <StatCard icon={Square} label="Stopped" value={s.stopped || 0} color="bg-red-500/10 text-red-400" />
        <StatCard icon={Globe} label="IPv4 Pool" value={`${availableIps}/${ips.length}`} color="bg-cyan-500/10 text-cyan-400" />
        <StatCard icon={Zap} label="Hosts" value={hosts.length} color="bg-yellow-500/10 text-yellow-400" />
      </div>

      {/* Resource Usage */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {resourceData.map(r => (
          <div key={r.name} className="rounded-xl p-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">{r.name} Usage</span>
              <span className="text-sm" style={{ color: 'var(--primary)' }}>{r.used} {r.label}</span>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.min((r.used / (r.name === 'CPU' ? 32 : r.name === 'RAM' ? 128 : 1000)) * 100, 100)}%`, background: 'var(--primary)' }} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* VPS Status Chart */}
        <div className="rounded-xl p-5" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
          <h2 className="font-semibold mb-4">VPS Distribution</h2>
          {vpsStatusData.length > 0 ? (
            <div className="flex items-center gap-4">
              <div className="w-32 h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={vpsStatusData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value" strokeWidth={0}>
                      {vpsStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {vpsStatusData.map(d => (
                  <div key={d.name} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                    <span style={{ color: 'var(--text-muted)' }}>{d.name}</span>
                    <span className="font-semibold ml-auto">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-center py-8" style={{ color: 'var(--text-muted)' }}>No VPS data</p>
          )}
        </div>

        {/* Recent Users */}
        <div className="rounded-xl" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="font-semibold">Recent Users</h2>
            <button onClick={() => navigate('/admin/panel')} className="text-xs" style={{ color: 'var(--primary)' }}>View All</button>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {recentUsers.length === 0 ? (
              <p className="p-4 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No users</p>
            ) : recentUsers.map(u => (
              <div key={u.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0" style={{ background: 'var(--primary)' }}>
                  {(u.username || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{u.username}</div>
                  <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{u.email}</div>
                </div>
                <div className="flex items-center gap-1">
                  {u.is_admin && <Shield size={12} style={{ color: 'var(--primary)' }} />}
                  <span className={`w-2 h-2 rounded-full ${u.is_active ? 'bg-emerald-400' : 'bg-red-400'}`} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent VPS */}
        <div className="rounded-xl" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="font-semibold">Recent VPS</h2>
            <button onClick={() => navigate('/admin/panel')} className="text-xs" style={{ color: 'var(--primary)' }}>View All</button>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {recentVps.length === 0 ? (
              <p className="p-4 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No VPS</p>
            ) : recentVps.map(v => (
              <div key={v.vps_id || v.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--surface-hover)' }}>
                  <Server size={14} style={{ color: 'var(--text-muted)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{v.name}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{v.cpu_cores}c/{v.memory_gb}g/{v.disk_gb}g</div>
                </div>
                <span className={`w-2 h-2 rounded-full ${v.status === 'running' ? 'bg-emerald-400' : v.status === 'stopped' ? 'bg-red-400' : 'bg-yellow-400'}`} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Audit Logs */}
      <div className="rounded-xl" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="font-semibold">Recent Activity</h2>
          <button onClick={() => navigate('/admin')} className="text-xs" style={{ color: 'var(--primary)' }}>View All</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-xs uppercase" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
              <th className="text-left px-5 py-3">Time</th>
              <th className="text-left px-5 py-3">Action</th>
              <th className="text-left px-5 py-3">Resource</th>
            </tr></thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={3} className="px-5 py-6 text-center" style={{ color: 'var(--text-muted)' }}>No activity yet</td></tr>
              ) : logs.slice(0, 8).map(log => (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(log.created_at).toLocaleString()}</td>
                  <td className="px-5 py-3"><span className="px-2 py-0.5 rounded text-xs font-mono" style={{ background: 'var(--surface-hover)' }}>{log.action}</span></td>
                  <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{log.resource_type}/{log.resource_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={18} />
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</div>
          <div className="text-xl font-bold">{value}</div>
        </div>
      </div>
    </div>
  );
}
