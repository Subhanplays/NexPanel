import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { ArrowLeft, Wifi, WifiOff, RefreshCw, Copy, Check, Trash2, Link, Terminal } from 'lucide-react';

export default function Network() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [vps, setVps] = useState(null);
  const [tab, setTab] = useState(searchParams.get('tab') || 'tailscale');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  // Tailscale
  const [tailscaleStatus, setTailscaleStatus] = useState(null);

  // tmate
  const [tmateSession, setTmateSession] = useState(null);

  // sshx
  const [sshxSession, setSshxSession] = useState(null);

  const [copied, setCopied] = useState('');

  useEffect(() => {
    api.get(`/vps/${id}`).then(setVps).catch(() => navigate('/vps')).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (vps) loadTab();
  }, [vps, tab]);

  const loadTab = () => {
    setError('');
    if (tab === 'tailscale') loadTailscale();
    else if (tab === 'tmate') loadTmate();
    else if (tab === 'sshx') loadSshx();
  };

  const loadTailscale = async () => {
    try {
      const data = await api.get(`/network/tailscale/${id}`);
      setTailscaleStatus(data);
    } catch {
      setTailscaleStatus(null);
    }
  };

  const loadTmate = async () => {
    try {
      const data = await api.get(`/network/tmate/${id}`);
      setTmateSession(data);
    } catch {
      setTmateSession(null);
    }
  };

  const loadSshx = async () => {
    try {
      const data = await api.get(`/network/sshx/${id}`);
      setSshxSession(data);
    } catch {
      setSshxSession(null);
    }
  };

  const tailscaleUp = async () => {
    setActionLoading('tailscale-up'); setError('');
    try {
      const res = await api.post(`/network/tailscale/${id}/up`);
      setError('');
      loadTailscale();
    } catch (err) {
      setError(err.message);
    }
    setActionLoading('');
  };

  const tailscaleDown = async () => {
    setActionLoading('tailscale-down'); setError('');
    try {
      await api.post(`/network/tailscale/${id}/down`);
      loadTailscale();
    } catch (err) {
      setError(err.message);
    }
    setActionLoading('');
  };

  const tailscaleRemove = async () => {
    if (!confirm('Remove Tailscale from this VPS?')) return;
    setActionLoading('tailscale-remove'); setError('');
    try {
      await api.del(`/network/tailscale/${id}`);
      setTailscaleStatus(null);
    } catch (err) {
      setError(err.message);
    }
    setActionLoading('');
  };

  const refreshTmate = async () => {
    setActionLoading('tmate-refresh'); setError('');
    try {
      const data = await api.post(`/network/tmate/${id}/refresh`);
      setTmateSession(data);
    } catch (err) {
      setError(err.message);
    }
    setActionLoading('');
  };

  const removeTmate = async () => {
    if (!confirm('Remove tmate session?')) return;
    setActionLoading('tmate-remove'); setError('');
    try {
      await api.del(`/network/tmate/${id}`);
      setTmateSession(null);
    } catch (err) {
      setError(err.message);
    }
    setActionLoading('');
  };

  const startSshx = async () => {
    setActionLoading('sshx-start'); setError('');
    try {
      const data = await api.post(`/network/sshx/${id}/start`);
      setSshxSession(data);
    } catch (err) {
      setError(err.message);
    }
    setActionLoading('');
  };

  const removeSshx = async () => {
    if (!confirm('Remove sshx session?')) return;
    setActionLoading('sshx-remove'); setError('');
    try {
      await api.del(`/network/sshx/${id}`);
      setSshxSession(null);
    } catch (err) {
      setError(err.message);
    }
    setActionLoading('');
  };

  const copyText = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  const tabs = [
    { id: 'tailscale', label: 'Tailscale', icon: Wifi },
    { id: 'tmate', label: 'tmate', icon: Terminal },
    { id: 'sshx', label: 'SSHX', icon: Link },
  ];

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-8 w-48 bg-gray-800 rounded" /><div className="h-64 bg-gray-800 rounded-xl" /></div>;
  if (!vps) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(`/vps/${id}`)} className="p-2 rounded-lg hover:bg-gray-800 transition-colors"><ArrowLeft size={20} /></button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Network</h1>
          <p className="text-sm text-gray-500">{vps.name}</p>
        </div>
      </div>

      {error && <div className="p-3 rounded-xl text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20">{error}</div>}

      {/* Tabs */}
      <div className="flex gap-2 p-1 rounded-xl" style={{ background: 'var(--surface)' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'shadow-sm' : ''}`}
            style={tab === t.id ? { background: 'var(--primary)', color: 'white' } : { color: 'var(--text-muted)' }}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* Tailscale */}
      {tab === 'tailscale' && (
        <div className="space-y-4">
          <div className="p-5 rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <h3 className="font-semibold mb-4">Tailscale VPN</h3>
            {tailscaleStatus ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${tailscaleStatus.status === 'connected' ? 'bg-emerald-400' : 'bg-yellow-400'}`} />
                  <span className="text-sm capitalize">{tailscaleStatus.status}</span>
                </div>
                {tailscaleStatus.ip && (
                  <div className="p-3 rounded-lg font-mono text-sm" style={{ background: 'var(--input)' }}>
                    <div className="flex items-center justify-between">
                      <span>{tailscaleStatus.ip}</span>
                      <button onClick={() => copyText(tailscaleStatus.ip, 'tsip')} className="p-1 rounded hover:bg-gray-800">
                        {copied === 'tsip' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={tailscaleDown} disabled={actionLoading === 'tailscale-down'}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm hover:bg-gray-800 transition-colors disabled:opacity-50"
                    style={{ borderColor: 'var(--border)' }}>
                    <WifiOff size={14} /> Disconnect
                  </button>
                  <button onClick={tailscaleRemove} disabled={actionLoading === 'tailscale-remove'}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-50"
                    style={{ borderColor: 'var(--border)' }}>
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <Wifi size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Tailscale not configured</p>
                <button onClick={tailscaleUp} disabled={actionLoading === 'tailscale-up'}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-50"
                  style={{ background: 'var(--primary)' }}>
                  <Wifi size={14} /> {actionLoading === 'tailscale-up' ? 'Connecting...' : 'Connect Tailscale'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* tmate */}
      {tab === 'tmate' && (
        <div className="space-y-4">
          <div className="p-5 rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <h3 className="font-semibold mb-4">tmate Remote Access</h3>
            {tmateSession ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg font-mono text-xs break-all" style={{ background: 'var(--input)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex-1">{tmateSession.session_string || tmateSession.session_url || 'No session'}</span>
                    <button onClick={() => copyText(tmateSession.session_string || tmateSession.session_url || '', 'tmate')}
                      className="p-1 rounded hover:bg-gray-800 shrink-0">
                      {copied === 'tmate' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={refreshTmate} disabled={actionLoading === 'tmate-refresh'}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm hover:bg-gray-800 transition-colors disabled:opacity-50"
                    style={{ borderColor: 'var(--border)' }}>
                    <RefreshCw size={14} /> {actionLoading === 'tmate-refresh' ? 'Refreshing...' : 'Refresh'}
                  </button>
                  <button onClick={removeTmate} disabled={actionLoading === 'tmate-remove'}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-50"
                    style={{ borderColor: 'var(--border)' }}>
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <Terminal size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>No active tmate session</p>
                <button onClick={refreshTmate} disabled={actionLoading === 'tmate-refresh'}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-50"
                  style={{ background: 'var(--primary)' }}>
                  <Terminal size={14} /> {actionLoading === 'tmate-refresh' ? 'Starting...' : 'Start tmate'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* sshx */}
      {tab === 'sshx' && (
        <div className="space-y-4">
          <div className="p-5 rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <h3 className="font-semibold mb-4">SSHX Remote Access</h3>
            {sshxSession ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg font-mono text-xs break-all" style={{ background: 'var(--input)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex-1">{sshxSession.session_url || 'No URL'}</span>
                    <button onClick={() => copyText(sshxSession.session_url || '', 'sshx')}
                      className="p-1 rounded hover:bg-gray-800 shrink-0">
                      {copied === 'sshx' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={startSshx} disabled={actionLoading === 'sshx-start'}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm hover:bg-gray-800 transition-colors disabled:opacity-50"
                    style={{ borderColor: 'var(--border)' }}>
                    <RefreshCw size={14} /> Refresh
                  </button>
                  <button onClick={removeSshx} disabled={actionLoading === 'sshx-remove'}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-50"
                    style={{ borderColor: 'var(--border)' }}>
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <Link size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>No active sshx session</p>
                <button onClick={startSshx} disabled={actionLoading === 'sshx-start'}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-50"
                  style={{ background: 'var(--primary)' }}>
                  <Link size={14} /> {actionLoading === 'sshx-start' ? 'Starting...' : 'Start SSHX'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
