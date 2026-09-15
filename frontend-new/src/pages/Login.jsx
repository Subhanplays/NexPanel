import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Login() {
  const { user, login, register } = useAuth();
  const { brandName, brandIcon, logoUrl } = useTheme();
  const navigate = useNavigate();
  const [tab, setTab] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (user) { navigate('/'); return null; }

  const handleLogin = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    const form = new FormData(e.target);
    try { await login(form.get('username'), form.get('password')); navigate('/'); }
    catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    const form = new FormData(e.target);
    try { await register(form.get('username'), form.get('email'), form.get('password')); navigate('/'); }
    catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4 shadow-lg overflow-hidden"
            style={{ background: logoUrl ? 'transparent' : 'var(--primary)' }}>
            {logoUrl ? <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" /> : brandIcon}
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{brandName}</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Cloud Infrastructure Management</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {/* Tab Switcher */}
          <div className="flex rounded-xl p-1 mb-6" style={{ background: 'var(--bg)' }}>
            {['login', 'register'].map(t => (
              <button key={t} onClick={() => { setTab(t); setError(''); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === t ? 'shadow-sm' : ''}`}
                style={{ background: tab === t ? 'var(--primary)' : 'transparent', color: tab === t ? 'white' : 'var(--text-muted)' }}>
                {t === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          {error && <div className="mb-4 p-3 rounded-xl text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20">{error}</div>}

          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Username or Email</label>
                <input name="username" required placeholder="Enter username or email"
                  className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-all"
                  style={{ background: 'var(--input)', color: 'var(--text)', borderColor: 'var(--border)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Password</label>
                <input name="password" type="password" required placeholder="Enter password"
                  className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-all"
                  style={{ background: 'var(--input)', color: 'var(--text)', borderColor: 'var(--border)' }} />
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-2.5 rounded-xl text-white font-medium transition-all disabled:opacity-50 text-sm mt-2"
                style={{ background: 'var(--primary)' }}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Username</label>
                <input name="username" required placeholder="Choose a username"
                  className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-all"
                  style={{ background: 'var(--input)', color: 'var(--text)', borderColor: 'var(--border)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Email</label>
                <input name="email" type="email" required placeholder="you@example.com"
                  className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-all"
                  style={{ background: 'var(--input)', color: 'var(--text)', borderColor: 'var(--border)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Password</label>
                <input name="password" type="password" required minLength={8} placeholder="Min 8 characters"
                  className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-all"
                  style={{ background: 'var(--input)', color: 'var(--text)', borderColor: 'var(--border)' }} />
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-2.5 rounded-xl text-white font-medium transition-all disabled:opacity-50 text-sm mt-2"
                style={{ background: 'var(--primary)' }}>
                {loading ? 'Creating...' : 'Create Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
