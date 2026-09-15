import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { Key, User, Lock, Trash2, Plus } from 'lucide-react';

export default function Settings() {
  const { user } = useAuth();
  const [tab, setTab] = useState('profile');
  const [apiKeys, setApiKeys] = useState([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKey, setNewKey] = useState('');

  useEffect(() => {
    api.get('/settings/api-keys').then(setApiKeys).catch(() => setApiKeys([]));
  }, []);

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--surface)' }}>
        {[{ id: 'profile', icon: User, label: 'Profile' }, { id: 'password', icon: Lock, label: 'Password' }, { id: 'api-keys', icon: Key, label: 'API Keys' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
            style={{ background: tab === t.id ? 'var(--primary)' : 'transparent', color: tab === t.id ? 'white' : 'var(--text-muted)' }}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && <ProfileTab user={user} />}
      {tab === 'password' && <PasswordTab />}
      {tab === 'api-keys' && <APIKeysTab apiKeys={apiKeys} setApiKeys={setApiKeys} newKeyName={newKeyName} setNewKeyName={setNewKeyName} newKey={newKey} setNewKey={setNewKey} />}
    </div>
  );
}

function ProfileTab({ user }) {
  const [form, setForm] = useState({ username: user?.username || '', email: user?.email || '' });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const save = async () => {
    setLoading(true); setMsg('');
    try { await api.put('/settings/profile', form); setMsg('Profile updated'); }
    catch (err) { setMsg(err.message); }
    setLoading(false);
  };

  return (
    <div className="rounded-2xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h2 className="font-semibold">Profile</h2>
      {msg && <div className={`p-3 rounded-xl text-sm font-medium ${msg.includes('updated') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{msg}</div>}
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Username</label>
        <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
          className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-all"
          style={{ background: 'var(--input)', color: 'var(--text)', borderColor: 'var(--border)' }} />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Email</label>
        <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-all"
          style={{ background: 'var(--input)', color: 'var(--text)', borderColor: 'var(--border)' }} />
      </div>
      <button onClick={save} disabled={loading}
        className="px-6 py-2.5 rounded-xl text-white text-sm font-medium transition-all disabled:opacity-50"
        style={{ background: 'var(--primary)' }}>
        {loading ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}

function PasswordTab() {
  const [form, setForm] = useState({ current_password: '', new_password: '' });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const save = async () => {
    setLoading(true); setMsg('');
    try { await api.put('/settings/password', form); setMsg('Password updated'); setForm({ current_password: '', new_password: '' }); }
    catch (err) { setMsg(err.message); }
    setLoading(false);
  };

  return (
    <div className="rounded-2xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h2 className="font-semibold">Change Password</h2>
      {msg && <div className={`p-3 rounded-xl text-sm font-medium ${msg.includes('updated') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{msg}</div>}
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Current Password</label>
        <input type="password" value={form.current_password} onChange={e => setForm(f => ({ ...f, current_password: e.target.value }))}
          className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-all"
          style={{ background: 'var(--input)', color: 'var(--text)', borderColor: 'var(--border)' }} />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>New Password</label>
        <input type="password" value={form.new_password} onChange={e => setForm(f => ({ ...f, new_password: e.target.value }))}
          placeholder="Min 8 characters"
          className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-all"
          style={{ background: 'var(--input)', color: 'var(--text)', borderColor: 'var(--border)' }} />
      </div>
      <button onClick={save} disabled={loading || !form.current_password || !form.new_password}
        className="px-6 py-2.5 rounded-xl text-white text-sm font-medium transition-all disabled:opacity-50"
        style={{ background: 'var(--primary)' }}>
        {loading ? 'Updating...' : 'Update Password'}
      </button>
    </div>
  );
}

function APIKeysTab({ apiKeys, setApiKeys, newKeyName, setNewKeyName, newKey, setNewKey }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const createKey = async () => {
    if (!newKeyName) return; setLoading(true); setError('');
    try { const res = await api.post('/settings/api-keys', { name: newKeyName }); setNewKey(res.key); setApiKeys([...apiKeys, res]); setNewKeyName(''); }
    catch (err) { setError(err.message); }
    setLoading(false);
  };

  const deleteKey = async (id) => {
    if (!confirm('Delete this API key?')) return; setError('');
    try { await api.del(`/settings/api-keys/${id}`); setApiKeys(apiKeys.filter(k => k.id !== id)); }
    catch (err) { setError(err.message); }
  };

  return (
    <div className="space-y-4">
      {error && <div className="p-3 rounded-xl text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20">{error}</div>}
      {newKey && (
        <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="text-sm font-medium text-emerald-400 mb-2">API Key Created</div>
          <div className="rounded-xl p-3 font-mono text-sm break-all" style={{ background: 'var(--input)', color: 'var(--text)' }}>{newKey}</div>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Copy this key now. It won't be shown again.</p>
        </div>
      )}

      <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex gap-3">
          <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="Key name"
            className="flex-1 px-4 py-2 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-all"
            style={{ background: 'var(--input)', color: 'var(--text)', borderColor: 'var(--border)' }} />
          <button onClick={createKey} disabled={loading || !newKeyName}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium transition-all disabled:opacity-50"
            style={{ background: 'var(--primary)' }}>
            <Plus size={14} /> {loading ? '...' : 'Create'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="font-semibold text-sm">API Keys</h2>
        </div>
        {apiKeys.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No API keys yet</div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {apiKeys.map(k => (
              <div key={k.id} className="flex items-center justify-between px-6 py-3">
                <div>
                  <div className="font-medium text-sm">{k.name}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{k.expires ? `Expires ${new Date(k.expires).toLocaleDateString()}` : 'No expiry'}</div>
                </div>
                <button onClick={() => deleteKey(k.id)} className="p-2 rounded-lg transition-colors hover:bg-red-500/10 text-red-400"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
