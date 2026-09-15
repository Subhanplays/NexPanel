import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import VPSList from './pages/VPSList';
import VPSDetail from './pages/VPSDetail';
import Deploy from './pages/Deploy';
import Terminal from './pages/Terminal';
import Settings from './pages/Settings';
import ThemesPage from './pages/Themes';
import FileManager from './pages/FileManager';
import Processes from './pages/Processes';
import Resources from './pages/Resources';
import Console from './pages/Console';
import Network from './pages/Network';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <Navigate to="/login" />;
  return children;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <Navigate to="/login" />;
  if (!user.is_admin) return <Navigate to="/" />;
  return children;
}

export default function App() {
  return (
    <ThemeProvider>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Admin Panel - completely separate layout */}
        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<AdminOverviewLazy />} />
          <Route path="users" element={<AdminUsersLazy />} />
          <Route path="vps" element={<AdminVPSLazy />} />
          <Route path="hosts" element={<AdminHostsLazy />} />
          <Route path="ipv4" element={<AdminIPv4Lazy />} />
          <Route path="images" element={<AdminImagesLazy />} />
          <Route path="settings" element={<AdminSettingsLazy />} />
          <Route path="branding" element={<AdminBrandingLazy />} />
          <Route path="customize" element={<AdminCustomizeLazy />} />
          <Route path="audit" element={<AdminAuditLazy />} />
        </Route>

        {/* User Panel - regular layout */}
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="vps" element={<VPSList />} />
          <Route path="vps/:id" element={<VPSDetail />} />
          <Route path="deploy" element={<Deploy />} />
          <Route path="terminal" element={<Terminal />} />
          <Route path="terminal/:id" element={<Terminal />} />
          <Route path="files/:id" element={<FileManager />} />
          <Route path="processes/:id" element={<Processes />} />
          <Route path="resources/:id" element={<Resources />} />
          <Route path="console/:id" element={<Console />} />
          <Route path="network/:id" element={<Network />} />
          <Route path="settings" element={<Settings />} />
          <Route path="themes" element={<ThemesPage />} />
        </Route>
      </Routes>
    </ThemeProvider>
  );
}

import { lazy } from 'react';
const AdminOverviewLazy = lazy(() => import('./pages/admin/Overview'));
const AdminUsersLazy = lazy(() => import('./pages/admin/Users'));
const AdminVPSLazy = lazy(() => import('./pages/admin/VPS'));
const AdminHostsLazy = lazy(() => import('./pages/admin/Hosts'));
const AdminIPv4Lazy = lazy(() => import('./pages/admin/IPv4'));
const AdminImagesLazy = lazy(() => import('./pages/admin/Images'));
const AdminSettingsLazy = lazy(() => import('./pages/admin/SystemSettings'));
const AdminBrandingLazy = lazy(() => import('./pages/admin/Branding'));
const AdminCustomizeLazy = lazy(() => import('./pages/admin/Customize'));
const AdminAuditLazy = lazy(() => import('./pages/admin/Audit'));
