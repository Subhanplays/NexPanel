import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { StatusBadge } from './Dashboard';
import { ArrowLeft, Play, Square, RotateCw, Trash2, Terminal as TermIcon, Folder, FileText, Cpu, Activity, Monitor, Key, RefreshCw, Wifi } from 'lucide-react';

export default function VPSDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vps, setVps] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [changingPw, setChangingPw] = useState(false);

  const load = () => {
    api.get(`/vps/${id}`).then(setVps).catch(() => navigate('/vps')).finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const action = async (act) => {
    setActionLoading(act); setError('');
    try {
      await api.post(`/vps/${id}/${act}`);
      setTimeout(load, 1500);
    } catch (err) {
      setError(err.message);
    }
    setActionLoading('');
  };

  const deleteVps = async () => {
    if (!confirm('Delete this VPS? This cannot be undone.')) return;
    setError('');
    try {
      await api.del(`/vps/${id}`);
      navigate('/vps');
    } catch (err) {
      setError(err.message);
    }
  };

  const changePassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setChangingPw(true); setError('');
    try {
      await api.post(`/vps/${id}/change-password`, { new_password: newPassword });
      setNewPassword('');
      setShowPassword(false);
    } catch (err) {
      setError(err.message);
    }
    setChangingPw(false);
  };

  const isRunning = vps?.status === 'running';

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-8 w-48 bg-gray-800 rounded" /><div className="h-64 bg-gray-800 rounded-xl" /></div>;
  if (!vps) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/vps')} className="p-2 rounded-lg hover:bg-gray-800 transition-colors"><ArrowLeft size={20} /></button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{vps.name || 'VPS'}</h1>
          <p className="text-sm text-gray-500 font-mono">{vps.vps_id || vps.id}</p>
        </div>
        <StatusBadge status={vps.status} />
      </div>

      {error && <div className="p-3 rounded-xl text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20">{error}</div>}

      {/* Power Actions */}
      <div className="flex flex-wrap gap-2">
        {isRunning ? (
          <>
            <button onClick={() => action('stop')} disabled={actionLoading === 'stop'} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-600/10 text-yellow-400 border border-yellow-600/20 text-sm font-medium hover:bg-yellow-600/20 transition-colors disabled:opacity-50">
              <Square size={14} /> {actionLoading === 'stop' ? 'Stopping...' : 'Stop'}
            </button>
            <button onClick={() => action('restart')} disabled={actionLoading === 'restart'} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-700 text-sm hover:bg-gray-800 transition-colors disabled:opacity-50">
              <RotateCw size={14} /> {actionLoading === 'restart' ? 'Restarting...' : 'Restart'}
            </button>
          </>
        ) : (
          <button onClick={() => action('start')} disabled={actionLoading === 'start'} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600/10 text-emerald-400 border border-emerald-600/20 text-sm font-medium hover:bg-emerald-600/20 transition-colors disabled:opacity-50">
            <Play size={14} /> {actionLoading === 'start' ? 'Starting...' : 'Start'}
          </button>
        )}
        <button onClick={deleteVps} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600/10 text-red-400 border border-red-600/20 text-sm font-medium hover:bg-red-600/20 transition-colors">
          <Trash2 size={14} /> Delete
        </button>
      </div>

      {/* Management Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <ActionCard icon={TermIcon} label="Terminal" color="#6366f1" onClick={() => navigate(`/terminal/${id}`)} disabled={!isRunning} />
        <ActionCard icon={Folder} label="Files" color="#8b5cf6" onClick={() => navigate(`/files/${id}`)} disabled={!isRunning} />
        <ActionCard icon={Cpu} label="Processes" color="#a855f7" onClick={() => navigate(`/processes/${id}`)} disabled={!isRunning} />
        <ActionCard icon={Activity} label="Resources" color="#06b6d4" onClick={() => navigate(`/resources/${id}`)} disabled={!isRunning} />
        <ActionCard icon={Monitor} label="Console" color="#10b981" onClick={() => navigate(`/console/${id}`)} disabled={!isRunning} />
        <ActionCard icon={Key} label="Password" color="#f59e0b" onClick={() => setShowPassword(!showPassword)} disabled={!isRunning} />
        <ActionCard icon={Wifi} label="Tailscale" color="#0ea5e9" onClick={() => navigate(`/network/${id}?tab=tailscale`)} disabled={!isRunning} />
        <ActionCard icon={RefreshCw} label="tmate" color="#14b8a6" onClick={() => navigate(`/network/${id}?tab=tmate`)} disabled={!isRunning} />
      </div>

      {/* Change Password */}
      {showPassword && (
        <div className="p-4 rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <h3 className="font-semibold mb-3">Change Password</h3>
          <div className="flex gap-2">
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password (min 8 chars)"
              className="flex-1 px-3 py-2 rounded-lg border text-sm outline-none" style={{ background: 'var(--input)', borderColor: 'var(--border)' }} />
            <button onClick={changePassword} disabled={changingPw} className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50" style={{ background: 'var(--primary)' }}>
              {changingPw ? 'Changing...' : 'Change'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Details */}
          <div className="rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}><h2 className="font-semibold">Details</h2></div>
            <div className="p-5 grid grid-cols-2 gap-4 text-sm">
              <InfoRow label="Status" value={<StatusBadge status={vps.status} />} />
              <InfoRow label="Operating System" value={vps.os_image || '-'} />
              <InfoRow label="Tailscale IP" value={vps.tailscale_ip || '-'} mono />
              <InfoRow label="Username" value={vps.username || '-'} />
              <InfoRow label="Created" value={new Date(vps.created_at).toLocaleDateString()} />
              <InfoRow label="tmate" value={vps.tmate_session ? vps.tmate_session.substring(0, 50) + '...' : '-'} mono />
            </div>
          </div>

          {/* Connection */}
          <div className="rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}><h2 className="font-semibold">Connection</h2></div>
            <div className="p-5 space-y-3">
              <div className="p-3 rounded-lg font-mono text-sm break-all" style={{ background: 'var(--input)' }}>
                ssh {vps.username || 'root'}@{vps.tailscale_ip || '<server-ip>'}
              </div>
              {vps.tmate_session && (
                <div className="p-3 rounded-lg font-mono text-xs break-all" style={{ background: 'var(--input)' }}>
                  {vps.tmate_session}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Resources */}
          <div className="rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}><h2 className="font-semibold">Resources</h2></div>
            <div className="p-5 space-y-3">
              <ResourceBar label="CPU" value={vps.cpu_cores || 1} unit="cores" max={16} />
              <ResourceBar label="RAM" value={vps.memory_gb || 1} unit="GB" max={64} />
              <ResourceBar label="Disk" value={vps.disk_gb || 20} unit="GB" max={500} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionCard({ icon: Icon, label, color, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="flex flex-col items-center gap-2 p-4 rounded-xl border transition-all hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="p-2.5 rounded-xl" style={{ background: `${color}15` }}>
        <Icon size={20} style={{ color }} />
      </div>
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

function InfoRow({ label, value, mono }) {
  return (
    <div>
      <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className={mono ? 'font-mono text-xs text-gray-300 break-all' : 'text-gray-200'}>{value}</div>
    </div>
  );
}

function ResourceBar({ label, value, unit, max }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span className="font-mono">{value} {unit}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'var(--primary)' }} />
      </div>
    </div>
  );
}
