import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { LayoutDashboard, Server, Plus, Terminal as TermIcon, Settings, Shield, LogOut, Menu, X, Palette } from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/vps', icon: Server, label: 'VPS' },
  { to: '/deploy', icon: Plus, label: 'Deploy' },
  { to: '/terminal', icon: TermIcon, label: 'Terminal' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { brandName, brandIcon, logoUrl, bgImage } = useTheme();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-[260px] flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{ background: 'var(--sidebar-bg)', borderRight: '1px solid var(--border)' }}>
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 h-16 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden" style={{ background: logoUrl ? 'transparent' : 'var(--primary)' }}>
            {logoUrl ? <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" /> : brandIcon}
          </div>
          <span className="text-base font-semibold truncate">{brandName}</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider px-3 mb-2" style={{ color: 'var(--text-muted)' }}>Main</div>
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? 'text-white' : 'hover:text-[var(--text)]'}`}
              style={({ isActive }) => ({ background: isActive ? 'var(--primary)' : 'transparent', color: isActive ? 'white' : 'var(--text-muted)' })}>
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}

          {user?.is_admin && (
            <>
              <div className="text-[10px] font-semibold uppercase tracking-wider px-3 mt-6 mb-2" style={{ color: 'var(--text-muted)' }}>Admin</div>
              <NavLink to="/admin" onClick={() => setSidebarOpen(false)}
                className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? 'text-white' : 'hover:text-[var(--text)]'}`}
                style={({ isActive }) => ({ background: isActive ? 'var(--primary)' : 'transparent', color: isActive ? 'white' : 'var(--text-muted)' })}>
                <Shield size={18} /><span>Admin Panel</span>
              </NavLink>
            </>
          )}

          <div className="text-[10px] font-semibold uppercase tracking-wider px-3 mt-6 mb-2" style={{ color: 'var(--text-muted)' }}>Account</div>
          <NavLink to="/themes" onClick={() => setSidebarOpen(false)}
            className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? 'text-white' : 'hover:text-[var(--text)]'}`}
            style={({ isActive }) => ({ background: isActive ? 'var(--primary)' : 'transparent', color: isActive ? 'white' : 'var(--text-muted)' })}>
            <Palette size={18} /><span>Customize</span>
          </NavLink>
          <NavLink to="/settings" onClick={() => setSidebarOpen(false)}
            className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? 'text-white' : 'hover:text-[var(--text)]'}`}
            style={({ isActive }) => ({ background: isActive ? 'var(--primary)' : 'transparent', color: isActive ? 'white' : 'var(--text-muted)' })}>
            <Settings size={18} /><span>Settings</span>
          </NavLink>
        </nav>

        {/* User */}
        <div className="p-3 shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-medium shrink-0" style={{ background: 'var(--primary)' }}>
              {(user?.username || '?')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{user?.username}</div>
              <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{user?.is_admin ? 'Administrator' : 'User'}</div>
            </div>
            <button onClick={handleLogout} className="p-2 rounded-lg transition-colors hover:bg-red-500/10 text-red-400" title="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-14 flex items-center px-4 lg:px-6 gap-4 shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          <button className="lg:hidden p-2 -ml-2 rounded-lg" style={{ color: 'var(--text-muted)' }} onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex-1" />
          <div className="text-xs font-medium px-2.5 py-1 rounded-lg" style={{ color: 'var(--text-muted)', background: 'var(--bg)' }}>v1.0</div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6" style={{ background: 'var(--bg)' }}>
          {bgImage && <div className="fixed inset-0 z-0" style={{ backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.15 }} />}
          <div className="max-w-6xl mx-auto relative z-10">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
