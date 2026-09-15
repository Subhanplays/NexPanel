import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useState } from 'react';
import { Database, Users, Server, Globe, Image, Settings, Key, Palette, FileText, Shield, LogOut, ArrowLeft, Menu, X, LayoutDashboard, ChevronLeft } from 'lucide-react';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Overview', end: true },
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/vps', icon: Server, label: 'VPS' },
  { to: '/admin/hosts', icon: Globe, label: 'Hosts' },
  { to: '/admin/ipv4', icon: Database, label: 'IPv4' },
  { to: '/admin/images', icon: Image, label: 'Images' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
  { to: '/admin/branding', icon: Key, label: 'Branding' },
  { to: '/admin/customize', icon: Palette, label: 'Customize' },
  { to: '/admin/audit', icon: FileText, label: 'Audit' },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { brandName, brandIcon, logoUrl } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user?.is_admin) {
    return (
      <div className="flex flex-col items-center justify-center h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <Shield size={28} style={{ color: 'var(--text-muted)' }} />
        </div>
        <h2 className="text-xl font-semibold mb-1">Access Denied</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Admin privileges required.</p>
        <button onClick={() => navigate('/')} className="px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: 'var(--primary)' }}>Go to Dashboard</button>
      </div>
    );
  }

  const isActive = (path, end) => end ? location.pathname === path : location.pathname.startsWith(path);
  const handleLogout = async () => { await logout(); navigate('/login'); };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {mobileOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 flex flex-col transition-all duration-300 ${collapsed ? 'w-[68px]' : 'w-[260px]'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{ background: 'var(--sidebar-bg, var(--surface))', borderRight: '1px solid var(--border)' }}>
        {/* Brand */}
        <div className={`flex items-center h-16 shrink-0 px-4 ${collapsed ? 'justify-center' : 'gap-3'}`} style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden" style={{ background: logoUrl ? 'transparent' : 'var(--primary)' }}>
            {logoUrl ? <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" /> : brandIcon}
          </div>
          {!collapsed && <div className="min-w-0"><div className="font-semibold text-sm truncate">{brandName}</div><div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Admin Panel</div></div>}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {navItems.map(item => {
            const active = isActive(item.to, item.end);
            return (
              <NavLink key={item.to} to={item.to} end={item.end}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${collapsed ? 'justify-center' : ''}`}
                style={{ background: active ? 'var(--primary)' : 'transparent', color: active ? 'white' : 'var(--text-muted)' }}>
                <item.icon size={18} className="shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-2 space-y-1 shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={() => navigate('/')} className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${collapsed ? 'justify-center' : ''}`} style={{ color: 'var(--text-muted)' }}>
            <ArrowLeft size={18} className="shrink-0" />
            {!collapsed && <span>Back to Panel</span>}
          </button>
          <button onClick={handleLogout} className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${collapsed ? 'justify-center' : ''}`} style={{ color: 'var(--text-muted)' }}>
            <LogOut size={18} className="shrink-0" />
            {!collapsed && <span>Log out</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 shrink-0 flex items-center gap-3 px-4 lg:px-6" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          <button onClick={() => setCollapsed(!collapsed)} className="hidden lg:flex p-2 -ml-2 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}>
            <ChevronLeft size={18} className={`transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          </button>
          <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 -ml-2 rounded-lg" style={{ color: 'var(--text-muted)' }}>
            <Menu size={18} />
          </button>
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>Admin Panel</h1>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="max-w-7xl mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
