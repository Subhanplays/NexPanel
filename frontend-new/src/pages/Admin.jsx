import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { Users, Server, Shield, Settings, Image, Globe, FileText, Key, Database, Trash2, Plus, Edit2, Eye, EyeOff, RefreshCw, Palette } from 'lucide-react';
import { useTheme, THEMES, BACKGROUNDS, FONTS } from '../context/ThemeContext';

export default function Admin() {
  const { user } = useAuth();
  const [tab, setTab] = useState('overview');

  if (!user?.is_admin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Shield size={48} className="text-[var(--text-muted)] mb-4" />
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p className="text-[var(--text-muted)]">You need administrator privileges.</p>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', icon: Database, label: 'Overview' },
    { id: 'users', icon: Users, label: 'Users' },
    { id: 'vps', icon: Server, label: 'VPS' },
    { id: 'hosts', icon: Globe, label: 'Hosts' },
    { id: 'ipv4', icon: Globe, label: 'IPv4 Pool' },
    { id: 'images', icon: Image, label: 'Images' },
    { id: 'settings', icon: Settings, label: 'System' },
    { id: 'branding', icon: Key, label: 'Branding' },
    { id: 'customize', icon: Palette, label: 'Customize' },
    { id: 'audit', icon: FileText, label: 'Audit Logs' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold">Admin Panel</h1>

      <div className="flex gap-2 overflow-x-auto pb-2 border-b border-[var(--border)]">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${tab === t.id ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]'}`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'vps' && <VPSTab />}
      {tab === 'hosts' && <HostsTab />}
      {tab === 'ipv4' && <IPv4Tab />}
      {tab === 'images' && <ImagesTab />}
      {tab === 'settings' && <SettingsTab />}
      {tab === 'branding' && <BrandingTab />}
      {tab === 'audit' && <AuditTab />}
      {tab === 'customize' && <CustomizeTab />}
    </div>
  );
}

function OverviewTab() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  useEffect(() => {
    api.get('/admin/vps/stats').then(setStats).catch(() => {});
    api.get('/admin/users').then(setUsers).catch(() => {});
  }, []);
  const s = stats || {};
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Users', value: users.length },
          { label: 'Total VPS', value: s.total_vps || 0 },
          { label: 'Running', value: s.running || 0 },
          { label: 'Stopped', value: s.stopped || 0 },
          { label: 'CPU Cores', value: s.total_cpu_cores || 0 },
          { label: 'RAM GB', value: s.total_ram_gb || 0 },
        ].map((item, i) => (
          <div key={i} className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4">
            <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">{item.label}</div>
            <div className="text-2xl font-bold mt-1">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', password: '', is_admin: false });

  const load = () => api.get('/admin/users').then(setUsers).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const toggle = async (id, field, val) => {
    await api.put(`/admin/users/${id}`, { [field]: !val });
    load();
  };

  const create = async () => {
    await api.post('/admin/users', form);
    setShowCreate(false);
    setForm({ username: '', email: '', password: '', is_admin: false });
    load();
  };

  const remove = async (id) => {
    if (!confirm('Delete this user?')) return;
    await api.del(`/admin/users/${id}`);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold">User Management</h2>
        <button onClick={() => setShowCreate(!showCreate)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium"><Plus size={14} /> Create User</button>
      </div>

      {showCreate && (
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Username" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm outline-none" style={{ background: 'var(--input)', color: 'var(--text)' }} />
            <input placeholder="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm outline-none" style={{ background: 'var(--input)', color: 'var(--text)' }} />
            <input placeholder="Password" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm outline-none" style={{ background: 'var(--input)', color: 'var(--text)' }} />
            <label className="flex items-center gap-2 text-sm cursor-pointer" onClick={() => setForm(f => ({ ...f, is_admin: !f.is_admin }))}>
              <div className={`w-5 h-5 rounded border flex items-center justify-center ${form.is_admin ? 'bg-[var(--primary)] border-[var(--primary)]' : 'border-[var(--border)]'}`}>
                {form.is_admin && <span className="text-white text-xs">&#10003;</span>}
              </div>
              Admin
            </label>
          </div>
          <button onClick={create} disabled={!form.username || !form.email || !form.password} className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium disabled:opacity-50">Create</button>
        </div>
      )}

      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-[var(--text-muted)] text-xs uppercase border-b border-[var(--border)]">
            <th className="text-left px-5 py-3">User</th>
            <th className="text-left px-5 py-3">Email</th>
            <th className="text-left px-5 py-3">Role</th>
            <th className="text-left px-5 py-3">Status</th>
            <th className="text-left px-5 py-3">Actions</th>
          </tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-[var(--border)]/50">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium" style={{ background: 'var(--primary)' }}>{(u.username || '?')[0].toUpperCase()}</div>
                    <div><div className="font-medium">{u.username}</div><div className="text-xs text-[var(--text-muted)]">ID: {u.id}</div></div>
                  </div>
                </td>
                <td className="px-5 py-3 text-[var(--text-muted)]">{u.email}</td>
                <td className="px-5 py-3">
                  <button onClick={() => toggle(u.id, 'is_admin', u.is_admin)} className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${u.is_admin ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
                    {u.is_admin ? 'Admin' : 'User'}
                  </button>
                </td>
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center gap-1.5 text-xs ${u.is_active ? 'text-emerald-400' : 'text-red-400'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    {u.is_active ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => toggle(u.id, 'is_active', u.is_active)} className="p-1.5 rounded hover:bg-[var(--surface-hover)]" title={u.is_active ? 'Disable' : 'Enable'}>
                      {u.is_active ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button onClick={() => remove(u.id)} className="p-1.5 rounded hover:bg-red-500/10 text-red-400" title="Delete"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VPSTab() {
  const [vps, setVps] = useState([]);
  useEffect(() => { api.get('/admin/vps').then(d => setVps(Array.isArray(d) ? d : [])).catch(() => {}); }, []);
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead><tr className="text-[var(--text-muted)] text-xs uppercase border-b border-[var(--border)]">
          <th className="text-left px-5 py-3">Name</th>
          <th className="text-left px-5 py-3">Status</th>
          <th className="text-left px-5 py-3">Specs</th>
          <th className="text-left px-5 py-3">User ID</th>
          <th className="text-left px-5 py-3">Created</th>
        </tr></thead>
        <tbody>
          {vps.length === 0 ? (
            <tr><td colSpan={5} className="px-5 py-8 text-center text-[var(--text-muted)]">No VPS found</td></tr>
          ) : vps.map(v => (
            <tr key={v.vps_id || v.id} className="border-b border-[var(--border)]/50">
              <td className="px-5 py-3 font-medium">{v.name}</td>
              <td className="px-5 py-3"><StatusPill status={v.status} /></td>
              <td className="px-5 py-3 text-[var(--text-muted)]">{v.cpu_cores}c/{v.memory_gb}g/{v.disk_gb}g</td>
              <td className="px-5 py-3 text-[var(--text-muted)]">{v.user_id}</td>
              <td className="px-5 py-3 text-[var(--text-muted)] text-xs">{new Date(v.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HostsTab() {
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
        <h2 className="font-semibold">Host Management</h2>
        <button onClick={() => setShowCreate(!showCreate)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium"><Plus size={14} /> Add Host</button>
      </div>
      {showCreate && (
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <input placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm outline-none" style={{ background: 'var(--input)', color: 'var(--text)' }} />
            <input placeholder="Hostname" value={form.hostname} onChange={e => setForm(f => ({ ...f, hostname: e.target.value }))} className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm outline-none" style={{ background: 'var(--input)', color: 'var(--text)' }} />
            <input placeholder="IP Address" value={form.ip_address} onChange={e => setForm(f => ({ ...f, ip_address: e.target.value }))} className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm outline-none" style={{ background: 'var(--input)', color: 'var(--text)' }} />
            <input placeholder="Max Containers" type="number" value={form.max_containers} onChange={e => setForm(f => ({ ...f, max_containers: +e.target.value }))} className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm outline-none" style={{ background: 'var(--input)', color: 'var(--text)' }} />
            <input placeholder="API Key" value={form.api_key} onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))} className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm outline-none" style={{ background: 'var(--input)', color: 'var(--text)' }} />
          </div>
          <button onClick={create} disabled={!form.name} className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium disabled:opacity-50">Create</button>
        </div>
      )}
      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-[var(--text-muted)] text-xs uppercase border-b border-[var(--border)]">
            <th className="text-left px-5 py-3">Name</th><th className="text-left px-5 py-3">Hostname</th><th className="text-left px-5 py-3">IP</th><th className="text-left px-5 py-3">Max</th><th className="text-left px-5 py-3">Actions</th>
          </tr></thead>
          <tbody>
            {hosts.length === 0 ? <tr><td colSpan={5} className="px-5 py-8 text-center text-[var(--text-muted)]">No hosts</td></tr> : hosts.map(h => (
              <tr key={h.id} className="border-b border-[var(--border)]/50">
                <td className="px-5 py-3 font-medium">{h.name}</td>
                <td className="px-5 py-3 text-[var(--text-muted)]">{h.hostname}</td>
                <td className="px-5 py-3 font-mono text-xs">{h.ip_address}</td>
                <td className="px-5 py-3 text-[var(--text-muted)]">{h.max_containers}</td>
                <td className="px-5 py-3"><button onClick={() => remove(h.id)} className="p-1.5 rounded hover:bg-red-500/10 text-red-400"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IPv4Tab() {
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

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold">IPv4 Pool ({ips.length} addresses)</h2>
        <div className="flex gap-2">
          <button onClick={() => { setShowAdd(!showAdd); setShowBulk(false); }} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium"><Plus size={14} /> Add IP</button>
          <button onClick={() => { setShowBulk(!showBulk); setShowAdd(false); }} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] text-sm"><Plus size={14} /> Bulk Add</button>
        </div>
      </div>
      {showAdd && (
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input placeholder="IP Address" value={form.ip_address} onChange={e => setForm(f => ({ ...f, ip_address: e.target.value }))} className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm outline-none" style={{ background: 'var(--input)', color: 'var(--text)' }} />
            <input placeholder="Subnet" value={form.subnet} onChange={e => setForm(f => ({ ...f, subnet: e.target.value }))} className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm outline-none" style={{ background: 'var(--input)', color: 'var(--text)' }} />
            <input placeholder="Gateway" value={form.gateway} onChange={e => setForm(f => ({ ...f, gateway: e.target.value }))} className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm outline-none" style={{ background: 'var(--input)', color: 'var(--text)' }} />
            <input placeholder="DNS" value={form.dns} onChange={e => setForm(f => ({ ...f, dns: e.target.value }))} className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm outline-none" style={{ background: 'var(--input)', color: 'var(--text)' }} />
          </div>
          <button onClick={add} className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium">Add</button>
        </div>
      )}
      {showBulk && (
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input placeholder="Start IP" value={bulk.start_ip} onChange={e => setBulk(f => ({ ...f, start_ip: e.target.value }))} className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm outline-none" style={{ background: 'var(--input)', color: 'var(--text)' }} />
            <input placeholder="Count" type="number" value={bulk.count} onChange={e => setBulk(f => ({ ...f, count: +e.target.value }))} className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm outline-none" style={{ background: 'var(--input)', color: 'var(--text)' }} />
            <input placeholder="Subnet" value={bulk.subnet} onChange={e => setBulk(f => ({ ...f, subnet: e.target.value }))} className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm outline-none" style={{ background: 'var(--input)', color: 'var(--text)' }} />
            <input placeholder="Gateway" value={bulk.gateway} onChange={e => setBulk(f => ({ ...f, gateway: e.target.value }))} className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm outline-none" style={{ background: 'var(--input)', color: 'var(--text)' }} />
          </div>
          <button onClick={addBulk} className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium">Bulk Add {bulk.count} IPs</button>
        </div>
      )}
      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-[var(--text-muted)] text-xs uppercase border-b border-[var(--border)]">
            <th className="text-left px-5 py-3">IP Address</th><th className="text-left px-5 py-3">Subnet</th><th className="text-left px-5 py-3">Status</th><th className="text-left px-5 py-3">Actions</th>
          </tr></thead>
          <tbody>
            {ips.length === 0 ? <tr><td colSpan={4} className="px-5 py-8 text-center text-[var(--text-muted)]">No IPs in pool</td></tr> : ips.slice(0, 50).map(ip => (
              <tr key={ip.id} className="border-b border-[var(--border)]/50">
                <td className="px-5 py-3 font-mono text-xs">{ip.ip_address}</td>
                <td className="px-5 py-3 text-[var(--text-muted)]">/{ip.subnet}</td>
                <td className="px-5 py-3"><StatusPill status={ip.status || (ip.reserved ? 'reserved' : 'available')} /></td>
                <td className="px-5 py-3"><button onClick={() => remove(ip.id)} className="p-1.5 rounded hover:bg-red-500/10 text-red-400"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ImagesTab() {
  const [images, setImages] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', docker_image: '', description: '', is_active: true });
  const load = () => api.get('/admin/images').then(setImages).catch(() => {});
  useEffect(() => { load(); }, []);

  const create = async () => { await api.post('/admin/images', form); setShowCreate(false); load(); };
  const remove = async (id) => { if (!confirm('Delete?')) return; await api.del(`/admin/images/${id}`); load(); };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold">Image Management</h2>
        <button onClick={() => setShowCreate(!showCreate)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium"><Plus size={14} /> Add Image</button>
      </div>
      {showCreate && (
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm outline-none" style={{ background: 'var(--input)', color: 'var(--text)' }} />
            <input placeholder="Docker Image (e.g. ubuntu:22.04)" value={form.docker_image} onChange={e => setForm(f => ({ ...f, docker_image: e.target.value }))} className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm outline-none" style={{ background: 'var(--input)', color: 'var(--text)' }} />
            <input placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm outline-none col-span-2" style={{ background: 'var(--input)', color: 'var(--text)' }} />
          </div>
          <button onClick={create} disabled={!form.name || !form.docker_image} className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium disabled:opacity-50">Create</button>
        </div>
      )}
      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-[var(--text-muted)] text-xs uppercase border-b border-[var(--border)]">
            <th className="text-left px-5 py-3">Name</th><th className="text-left px-5 py-3">Docker Image</th><th className="text-left px-5 py-3">Status</th><th className="text-left px-5 py-3">Actions</th>
          </tr></thead>
          <tbody>
            {images.length === 0 ? <tr><td colSpan={4} className="px-5 py-8 text-center text-[var(--text-muted)]">No images</td></tr> : images.map(img => (
              <tr key={img.id} className="border-b border-[var(--border)]/50">
                <td className="px-5 py-3 font-medium">{img.name}</td>
                <td className="px-5 py-3 font-mono text-xs">{img.docker_image}</td>
                <td className="px-5 py-3"><StatusPill status={img.is_active ? 'active' : 'inactive'} /></td>
                <td className="px-5 py-3"><button onClick={() => remove(img.id)} className="p-1.5 rounded hover:bg-red-500/10 text-red-400"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SettingsTab() {
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
        <h2 className="font-semibold">System Settings</h2>
        <button onClick={() => setShowCreate(!showCreate)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium"><Plus size={14} /> Add Setting</button>
      </div>
      {showCreate && (
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <input placeholder="Key" value={form.key} onChange={e => setForm(f => ({ ...f, key: e.target.value }))} className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm outline-none" style={{ background: 'var(--input)', color: 'var(--text)' }} />
            <input placeholder="Value" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm outline-none" style={{ background: 'var(--input)', color: 'var(--text)' }} />
            <input placeholder="Category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm outline-none" style={{ background: 'var(--input)', color: 'var(--text)' }} />
          </div>
          <button onClick={create} disabled={!form.key} className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium disabled:opacity-50">Create</button>
        </div>
      )}
      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-[var(--text-muted)] text-xs uppercase border-b border-[var(--border)]">
            <th className="text-left px-5 py-3">Key</th><th className="text-left px-5 py-3">Value</th><th className="text-left px-5 py-3">Category</th><th className="text-left px-5 py-3">Actions</th>
          </tr></thead>
          <tbody>
            {settings.length === 0 ? <tr><td colSpan={4} className="px-5 py-8 text-center text-[var(--text-muted)]">No settings</td></tr> : settings.map(s => (
              <tr key={s.id} className="border-b border-[var(--border)]/50">
                <td className="px-5 py-3 font-mono text-xs">{s.key}</td>
                <td className="px-5 py-3">
                  {editId === s.id ? (
                    <div className="flex gap-2">
                      <input value={editVal} onChange={e => setEditVal(e.target.value)} className="px-2 py-1 rounded border border-[var(--border)] text-sm outline-none flex-1" style={{ background: 'var(--input)', color: 'var(--text)' }} />
                      <button onClick={() => save(s.id)} className="text-emerald-400 text-xs">Save</button>
                    </div>
                  ) : (
                    <span className="cursor-pointer hover:text-[var(--primary)]" onClick={() => { setEditId(s.id); setEditVal(s.value); }}>{s.value}</span>
                  )}
                </td>
                <td className="px-5 py-3 text-[var(--text-muted)]">{s.category}</td>
                <td className="px-5 py-3"><button onClick={() => remove(s.id)} className="p-1.5 rounded hover:bg-red-500/10 text-red-400"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BrandingTab() {
  const [branding, setBranding] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ key: '', value: '', category: 'general' });

  const load = () => api.get('/admin/branding').then(setBranding).catch(() => {});
  useEffect(() => { load(); }, []);

  const create = async () => { await api.post('/admin/branding', form); setShowCreate(false); load(); };
  const remove = async (id) => { if (!confirm('Delete?')) return; await api.del(`/admin/branding/${id}`); load(); };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold">Branding Settings</h2>
        <button onClick={() => setShowCreate(!showCreate)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium"><Plus size={14} /> Add Branding</button>
      </div>
      {showCreate && (
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <input placeholder="Key" value={form.key} onChange={e => setForm(f => ({ ...f, key: e.target.value }))} className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm outline-none" style={{ background: 'var(--input)', color: 'var(--text)' }} />
            <input placeholder="Value" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm outline-none" style={{ background: 'var(--input)', color: 'var(--text)' }} />
            <input placeholder="Category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm outline-none" style={{ background: 'var(--input)', color: 'var(--text)' }} />
          </div>
          <button onClick={create} disabled={!form.key} className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium disabled:opacity-50">Create</button>
        </div>
      )}
      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-[var(--text-muted)] text-xs uppercase border-b border-[var(--border)]">
            <th className="text-left px-5 py-3">Key</th><th className="text-left px-5 py-3">Value</th><th className="text-left px-5 py-3">Category</th><th className="text-left px-5 py-3">Actions</th>
          </tr></thead>
          <tbody>
            {branding.length === 0 ? <tr><td colSpan={4} className="px-5 py-8 text-center text-[var(--text-muted)]">No branding settings</td></tr> : branding.map(b => (
              <tr key={b.id} className="border-b border-[var(--border)]/50">
                <td className="px-5 py-3 font-mono text-xs">{b.key}</td>
                <td className="px-5 py-3">{b.value}</td>
                <td className="px-5 py-3 text-[var(--text-muted)]">{b.category}</td>
                <td className="px-5 py-3"><button onClick={() => remove(b.id)} className="p-1.5 rounded hover:bg-red-500/10 text-red-400"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditTab() {
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  useEffect(() => { api.get(`/admin/audit-logs?page=${page}&per_page=50`).then(setLogs).catch(() => {}); }, [page]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold">Audit Logs</h2>
        <button onClick={() => api.get(`/admin/audit-logs?page=${page}&per_page=50`).then(setLogs)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] text-sm"><RefreshCw size={14} /> Refresh</button>
      </div>
      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-[var(--text-muted)] text-xs uppercase border-b border-[var(--border)]">
            <th className="text-left px-5 py-3">Time</th><th className="text-left px-5 py-3">User</th><th className="text-left px-5 py-3">Action</th><th className="text-left px-5 py-3">Resource</th><th className="text-left px-5 py-3">Details</th>
          </tr></thead>
          <tbody>
            {logs.length === 0 ? <tr><td colSpan={5} className="px-5 py-8 text-center text-[var(--text-muted)]">No logs</td></tr> : logs.map(log => (
              <tr key={log.id} className="border-b border-[var(--border)]/50">
                <td className="px-5 py-3 text-xs text-[var(--text-muted)]">{new Date(log.created_at).toLocaleString()}</td>
                <td className="px-5 py-3">{log.user_id}</td>
                <td className="px-5 py-3"><span className="px-2 py-0.5 rounded bg-[var(--surface)] text-xs font-mono">{log.action}</span></td>
                <td className="px-5 py-3 text-[var(--text-muted)]">{log.resource_type}/{log.resource_id}</td>
                <td className="px-5 py-3 text-xs text-[var(--text-muted)] max-w-[200px] truncate">{log.details ? JSON.stringify(log.details) : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-center gap-2">
        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm disabled:opacity-50">Prev</button>
        <span className="px-3 py-1.5 text-sm text-[var(--text-muted)]">Page {page}</span>
        <button onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm">Next</button>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const colors = {
    running: 'bg-emerald-500/10 text-emerald-400',
    stopped: 'bg-red-500/10 text-red-400',
    creating: 'bg-yellow-500/10 text-yellow-400',
    active: 'bg-emerald-500/10 text-emerald-400',
    available: 'bg-emerald-500/10 text-emerald-400',
    assigned: 'bg-blue-500/10 text-blue-400',
    reserved: 'bg-yellow-500/10 text-yellow-400',
    error: 'bg-red-500/10 text-red-400',
    inactive: 'bg-gray-500/10 text-gray-400',
  };
  return <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-500/10 text-gray-400'}`}>{status}</span>;
}

function CustomizeTab() {
  const ctx = useTheme();
  const [branding, setBranding] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get('/admin/branding').then(setBranding).catch(() => {});
  }, []);

  const saveBranding = async (key, value) => {
    setSaving(true); setMsg('');
    try {
      const existing = branding.find(b => b.key === key);
      if (existing) {
        const res = await api.put(`/admin/branding/${existing.id}`, { value });
      } else {
        const res = await api.post('/admin/branding', { key, value, category: 'theme' });
      }
      setMsg('Saved!');
      const updated = await api.get('/admin/branding');
      setBranding(updated);
    } catch (err) {
      setMsg('Error: ' + err.message);
    }
    setSaving(false);
    setTimeout(() => setMsg(''), 2000);
  };

  const saveAllTheme = async () => {
    setSaving(true); setMsg('');
    try {
      const settings = {
        'admin_theme': ctx.themeId,
        'admin_bg': ctx.bgId,
        'admin_font': ctx.fontId,
        'admin_radius': ctx.borderRadius,
        'admin_brand_name': ctx.brandName,
        'admin_brand_icon': ctx.brandIcon,
        'admin_compact': String(ctx.compact),
        'admin_animations': String(ctx.animations),
      };
      for (const [key, value] of Object.entries(settings)) {
        const existing = branding.find(b => b.key === key);
        if (existing) {
          await api.put(`/admin/branding/${existing.id}`, { value });
        } else {
          await api.post('/admin/branding', { key, value, category: 'theme' });
        }
      }
      const updated = await api.get('/admin/branding');
      setBranding(updated);
      setMsg('All theme settings saved to server!');
    } catch (err) {
      setMsg('Error: ' + err.message);
    }
    setSaving(false);
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Global Theme Settings</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Configure the default theme for all users. These settings are saved to the server.</p>
        </div>
        <button onClick={saveAllTheme} disabled={saving} className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50" style={{ background: 'var(--primary)' }}>
          {saving ? 'Saving...' : 'Save to Server'}
        </button>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg text-sm ${msg.includes('Error') ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>{msg}</div>
      )}

      {/* Theme Picker */}
      <div>
        <h3 className="font-medium mb-3">Color Theme</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {THEMES.map(t => (
            <button key={t.id} onClick={() => { ctx.setThemeId(t.id); saveBranding('admin_theme', t.id); }}
              className={`p-3 rounded-xl border-2 text-left transition-all hover:scale-[1.02] ${ctx.themeId === t.id ? 'border-[var(--primary)]' : 'border-[var(--border)] hover:border-[var(--text-muted)]'}`}
              style={{ background: t.surface }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-full" style={{ background: t.primary }} />
                <span className="text-xs font-medium" style={{ color: t.text }}>{t.name}</span>
              </div>
              <div className="flex gap-1">
                {[t.bg, t.surface, t.border, t.primary, t.accent].map((c, i) => (
                  <div key={i} className="w-3.5 h-3.5 rounded-full" style={{ background: c }} />
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Background Picker */}
      <div>
        <h3 className="font-medium mb-3">Background</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {BACKGROUNDS.map(b => (
            <button key={b.id} onClick={() => { ctx.setBgId(b.id); saveBranding('admin_bg', b.id); }}
              className={`aspect-[4/3] rounded-xl border-2 overflow-hidden transition-all hover:scale-[1.02] ${ctx.bgId === b.id ? 'border-[var(--primary)]' : 'border-[var(--border)] hover:border-[var(--text-muted)]'}`}
              style={{ background: b.type === 'solid' ? ctx.theme.bg : b.value, backgroundSize: b.size || 'auto' }}>
              <div className="w-full h-full flex items-end p-2" style={{ background: 'linear-gradient(transparent 50%, rgba(0,0,0,0.7))' }}>
                <span className="text-xs text-white font-medium">{b.name}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Font Picker */}
      <div>
        <h3 className="font-medium mb-3">Font Family</h3>
        <div className="grid grid-cols-2 gap-3">
          {FONTS.map(f => (
            <button key={f.id} onClick={() => { ctx.setFontId(f.id); saveBranding('admin_font', f.id); }}
              className={`p-4 rounded-xl border-2 text-left transition-all ${ctx.fontId === f.id ? 'border-[var(--primary)]' : 'border-[var(--border)] hover:border-[var(--text-muted)]'}`}
              style={{ background: 'var(--surface)', fontFamily: f.family }}>
              <div className="text-sm font-medium">{f.name}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>The quick brown fox jumps</div>
            </button>
          ))}
        </div>
      </div>

      {/* Border Radius */}
      <div>
        <h3 className="font-medium mb-3">Border Radius</h3>
        <div className="flex items-center gap-4">
          <input type="range" min="0" max="24" value={ctx.borderRadius} onChange={e => { ctx.setBorderRadius(e.target.value); saveBranding('admin_radius', e.target.value); }} className="flex-1 accent-[var(--primary)]" />
          <div className="w-12 h-12 flex items-center justify-center border text-xs" style={{ borderRadius: ctx.borderRadius + 'px', background: 'var(--primary)', color: 'white', borderColor: 'var(--border)' }}>
            {ctx.borderRadius}px
          </div>
        </div>
      </div>

      {/* Branding */}
      <div>
        <h3 className="font-medium mb-3">Panel Branding</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>Panel Name</label>
            <input value={ctx.brandName} onChange={e => { ctx.setBrandName(e.target.value); saveBranding('admin_brand_name', e.target.value); }}
              className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none focus:border-[var(--primary)]" style={{ background: 'var(--input)', color: 'var(--text)', borderColor: 'var(--border)' }} />
          </div>
          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'var(--text-muted)' }}>Logo Icon (1 char)</label>
            <input value={ctx.brandIcon} onChange={e => { ctx.setBrandIcon(e.target.value.slice(0, 1)); saveBranding('admin_brand_icon', e.target.value.slice(0, 1)); }}
              maxLength={1} className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none focus:border-[var(--primary)] text-center text-2xl" style={{ background: 'var(--input)', color: 'var(--text)', borderColor: 'var(--border)' }} />
          </div>
        </div>
      </div>

      {/* Preview */}
      <div>
        <h3 className="font-medium mb-3">Preview</h3>
        <div className="p-6 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: 'var(--primary)' }}>{ctx.brandIcon}</div>
            <div>
              <div className="font-semibold">{ctx.brandName}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Cloud Infrastructure Management</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg text-center" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Theme</div>
              <div className="text-sm font-medium mt-1">{ctx.theme.name}</div>
            </div>
            <div className="p-3 rounded-lg text-center" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Font</div>
              <div className="text-sm font-medium mt-1">{ctx.font.name}</div>
            </div>
            <div className="p-3 rounded-lg text-center" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Radius</div>
              <div className="text-sm font-medium mt-1">{ctx.borderRadius}px</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
