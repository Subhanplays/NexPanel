import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api';

const THEMES = {
  midnight: {
    id: 'midnight', name: 'Midnight',
    bg: '#0a0a0f', surface: '#111118', surfaceHover: '#1a1a24', border: '#1e1e2a',
    text: '#e5e7eb', textMuted: '#6b7280', primary: '#6366f1', primaryHover: '#818cf8',
    accent: '#818cf8', sidebar: '#0d0d14', card: '#111118', input: '#0a0a0f',
  },
  dark: {
    id: 'dark', name: 'Pure Dark',
    bg: '#000000', surface: '#111111', surfaceHover: '#1a1a1a', border: '#222222',
    text: '#f5f5f5', textMuted: '#737373', primary: '#3b82f6', primaryHover: '#60a5fa',
    accent: '#60a5fa', sidebar: '#0a0a0a', card: '#111111', input: '#0a0a0a',
  },
  light: {
    id: 'light', name: 'Clean Light',
    bg: '#f8fafc', surface: '#ffffff', surfaceHover: '#f1f5f9', border: '#e2e8f0',
    text: '#0f172a', textMuted: '#64748b', primary: '#6366f1', primaryHover: '#4f46e5',
    accent: '#6366f1', sidebar: '#ffffff', card: '#ffffff', input: '#f8fafc',
  },
  ocean: {
    id: 'ocean', name: 'Deep Ocean',
    bg: '#0a1628', surface: '#0f2035', surfaceHover: '#152a42', border: '#1a3350',
    text: '#c8d6e5', textMuted: '#5a7a9a', primary: '#0ea5e9', primaryHover: '#38bdf8',
    accent: '#38bdf8', sidebar: '#0c1a2e', card: '#0f2035', input: '#0a1628',
  },
  forest: {
    id: 'forest', name: 'Forest',
    bg: '#0a1210', surface: '#0f1f1a', surfaceHover: '#162b23', border: '#1e3830',
    text: '#c8d8c8', textMuted: '#5a7a5a', primary: '#22c55e', primaryHover: '#4ade80',
    accent: '#4ade80', sidebar: '#0c1814', card: '#0f1f1a', input: '#0a1210',
  },
  sunset: {
    id: 'sunset', name: 'Sunset',
    bg: '#1a0a0a', surface: '#221010', surfaceHover: '#2e1818', border: '#3a2020',
    text: '#f0d0c0', textMuted: '#a07060', primary: '#f97316', primaryHover: '#fb923c',
    accent: '#fb923c', sidebar: '#1c0c0c', card: '#221010', input: '#1a0a0a',
  },
  cyberpunk: {
    id: 'cyberpunk', name: 'Cyberpunk',
    bg: '#0a0a14', surface: '#12121f', surfaceHover: '#1a1a2e', border: '#2a1a4a',
    text: '#e0d0ff', textMuted: '#7a6a9a', primary: '#a855f7', primaryHover: '#c084fc',
    accent: '#f0abfc', sidebar: '#0e0e1a', card: '#12121f', input: '#0a0a14',
  },
  rose: {
    id: 'rose', name: 'Rose',
    bg: '#140a10', surface: '#1f0f18', surfaceHover: '#2a1622', border: '#3a2030',
    text: '#f0d0e0', textMuted: '#a06a8a', primary: '#f43f5e', primaryHover: '#fb7185',
    accent: '#fda4af', sidebar: '#180c14', card: '#1f0f18', input: '#140a10',
  },
  amber: {
    id: 'amber', name: 'Amber',
    bg: '#14100a', surface: '#1f180f', surfaceHover: '#2a2216', border: '#3a3020',
    text: '#f0e0c0', textMuted: '#a09060', primary: '#f59e0b', primaryHover: '#fbbf24',
    accent: '#fcd34d', sidebar: '#18140c', card: '#1f180f', input: '#14100a',
  },
  teal: {
    id: 'teal', name: 'Teal',
    bg: '#0a1414', surface: '#0f1f1f', surfaceHover: '#162a2a', border: '#1e3a3a',
    text: '#c0e8e8', textMuted: '#5a9a9a', primary: '#14b8a6', primaryHover: '#2dd4bf',
    accent: '#5eead4', sidebar: '#0c1818', card: '#0f1f1f', input: '#0a1414',
  },
  cherry: {
    id: 'cherry', name: 'Cherry',
    bg: '#120a0e', surface: '#1b0f15', surfaceHover: '#25161e', border: '#352030',
    text: '#f0d0e0', textMuted: '#9a6080', primary: '#e11d48', primaryHover: '#fb7185',
    accent: '#fda4af', sidebar: '#160c12', card: '#1b0f15', input: '#120a0e',
  },
  neon: {
    id: 'neon', name: 'Neon Green',
    bg: '#050f0a', surface: '#0a1a12', surfaceHover: '#102a1c', border: '#1a4030',
    text: '#c0ffd0', textMuted: '#50a060', primary: '#10b981', primaryHover: '#34d399',
    accent: '#6ee7b7', sidebar: '#081410', card: '#0a1a12', input: '#050f0a',
  },
};

const BACKGROUNDS = [
  { id: 'solid', name: 'Solid', type: 'solid' },
  { id: 'gradient-1', name: 'Purple Haze', type: 'gradient', value: 'linear-gradient(135deg, #0a0a1a 0%, #1a0a2a 50%, #0a1a2a 100%)' },
  { id: 'gradient-2', name: 'Ocean Deep', type: 'gradient', value: 'linear-gradient(135deg, #0a1628 0%, #0c2a3a 50%, #0a2030 100%)' },
  { id: 'gradient-3', name: 'Sunset Glow', type: 'gradient', value: 'linear-gradient(135deg, #1a0a0a 0%, #2a1008 50%, #1a0808 100%)' },
  { id: 'gradient-4', name: 'Forest Mist', type: 'gradient', value: 'linear-gradient(135deg, #0a1210 0%, #0a2018 50%, #081810 100%)' },
  { id: 'gradient-5', name: 'Cyber Glow', type: 'gradient', value: 'linear-gradient(135deg, #0a0a14 0%, #1a0a30 50%, #0a1028 100%)' },
  { id: 'gradient-6', name: 'Rose Petal', type: 'gradient', value: 'linear-gradient(135deg, #140a10 0%, #2a0a1a 50%, #1a0812 100%)' },
  { id: 'gradient-7', name: 'Midnight Aurora', type: 'gradient', value: 'linear-gradient(135deg, #0a0a1a 0%, #0a1a20 50%, #0a0a2a 100%)' },
  { id: 'gradient-8', name: 'Warm Ember', type: 'gradient', value: 'linear-gradient(135deg, #14100a 0%, #2a1808 50%, #1a1008 100%)' },
  { id: 'dots', name: 'Dot Pattern', type: 'pattern', value: 'radial-gradient(circle, #ffffff08 1px, transparent 1px)', size: '20px 20px' },
  { id: 'grid', name: 'Grid', type: 'pattern', value: 'linear-gradient(#ffffff06 1px, transparent 1px), linear-gradient(90deg, #ffffff06 1px, transparent 1px)', size: '40px 40px' },
  { id: 'mesh', name: 'Mesh', type: 'gradient', value: 'radial-gradient(at 20% 30%, #6366f10a 0%, transparent 50%), radial-gradient(at 80% 70%, #a855f70a 0%, transparent 50%), radial-gradient(at 50% 50%, #0ea5e90a 0%, transparent 50%)' },
];

const FONTS = [
  { id: 'inter', name: 'Inter', family: '"Inter", ui-sans-serif, system-ui, sans-serif' },
  { id: 'jetbrains', name: 'JetBrains Mono', family: '"JetBrains Mono", ui-monospace, monospace' },
  { id: 'system', name: 'System', family: 'system-ui, -apple-system, sans-serif' },
  { id: 'georgia', name: 'Georgia', family: 'Georgia, "Times New Roman", serif' },
];

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(() => localStorage.getItem('vps_theme') || 'midnight');
  const [bgId, setBgId] = useState(() => localStorage.getItem('vps_bg') || 'solid');
  const [fontId, setFontId] = useState(() => localStorage.getItem('vps_font') || 'inter');
  const [sidebarStyle, setSidebarStyle] = useState(() => localStorage.getItem('vps_sidebar') || 'default');
  const [borderRadius, setBorderRadius] = useState(() => localStorage.getItem('vps_radius') || '12');
  const [compact, setCompact] = useState(() => localStorage.getItem('vps_compact') === 'true');
  const [animations, setAnimations] = useState(() => localStorage.getItem('vps_animations') !== 'false');
  const [brandName, setBrandName] = useState(() => localStorage.getItem('vps_brand_name') || 'NexPanel');
  const [brandIcon, setBrandIcon] = useState(() => localStorage.getItem('vps_brand_icon') || 'V');
  const [logoUrl, setLogoUrl] = useState('');
  const [bgImage, setBgImage] = useState('');

  // Fetch admin branding on mount and apply
  useEffect(() => {
    const token = localStorage.getItem('vps_token');
    if (!token) return;
    api.get('/admin/branding').then(data => {
      if (!Array.isArray(data)) return;
      const get = (key) => data.find(b => b.key === key)?.value || '';

      const t = get('admin_theme');
      const f = get('admin_font');
      const r = get('admin_radius');
      const bn = get('admin_brand_name');
      const bi = get('admin_brand_icon');
      const logo = get('admin_logo_url');
      const bgImg = get('admin_bg_image');
      const cm = get('admin_compact');
      const an = get('admin_animations');

      if (t && THEMES[t]) { setThemeId(t); localStorage.setItem('vps_theme', t); }
      if (f && FONTS.find(x => x.id === f)) { setFontId(f); localStorage.setItem('vps_font', f); }
      if (r) { setBorderRadius(r); localStorage.setItem('vps_radius', r); }
      if (bn) { setBrandName(bn); localStorage.setItem('vps_brand_name', bn); }
      if (bi) { setBrandIcon(bi); localStorage.setItem('vps_brand_icon', bi); }
      if (logo !== undefined) { setLogoUrl(logo); }
      if (bgImg !== undefined) { setBgImage(bgImg); }
      if (cm) { setCompact(cm === 'true'); localStorage.setItem('vps_compact', cm); }
      if (an) { setAnimations(an !== 'false'); localStorage.setItem('vps_animations', an); }
    }).catch(() => {});
  }, []);

  const theme = THEMES[themeId] || THEMES.midnight;
  const bg = BACKGROUNDS.find(b => b.id === bgId) || BACKGROUNDS[0];
  const font = FONTS.find(f => f.id === fontId) || FONTS[0];

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--bg', theme.bg);
    root.style.setProperty('--surface', theme.surface);
    root.style.setProperty('--surface-hover', theme.surfaceHover);
    root.style.setProperty('--border', theme.border);
    root.style.setProperty('--text', theme.text);
    root.style.setProperty('--text-muted', theme.textMuted);
    root.style.setProperty('--primary', theme.primary);
    root.style.setProperty('--primary-hover', theme.primaryHover);
    root.style.setProperty('--accent', theme.accent);
    root.style.setProperty('--sidebar-bg', theme.sidebar);
    root.style.setProperty('--card-bg', theme.card);
    root.style.setProperty('--input-bg', theme.input);
    root.style.setProperty('--font-family', font.family);
    root.style.setProperty('--radius', borderRadius + 'px');
    root.style.setProperty('--radius-sm', Math.max(4, borderRadius - 4) + 'px');
    root.style.setProperty('--radius-lg', (borderRadius + 4) + 'px');

    if (bg.type === 'gradient' || bg.type === 'pattern') {
      root.style.setProperty('--bg-image', bg.value);
      root.style.setProperty('--bg-size', bg.size || 'auto');
    } else {
      root.style.setProperty('--bg-image', 'none');
      root.style.setProperty('--bg-size', 'auto');
    }

    root.style.setProperty('--animation-duration', animations ? '0.2s' : '0s');
  }, [theme, bg, font, borderRadius, animations]);

  useEffect(() => {
    localStorage.setItem('vps_theme', themeId);
    localStorage.setItem('vps_bg', bgId);
    localStorage.setItem('vps_font', fontId);
    localStorage.setItem('vps_sidebar', sidebarStyle);
    localStorage.setItem('vps_radius', borderRadius);
    localStorage.setItem('vps_compact', compact);
    localStorage.setItem('vps_animations', animations);
    localStorage.setItem('vps_brand_name', brandName);
    localStorage.setItem('vps_brand_icon', brandIcon);
  }, [themeId, bgId, fontId, sidebarStyle, borderRadius, compact, animations, brandName, brandIcon]);

  return (
    <ThemeContext.Provider value={{
      theme, themeId, setThemeId, themes: Object.values(THEMES),
      bg, bgId, setBgId, backgrounds: BACKGROUNDS,
      font, fontId, setFontId, fonts: FONTS,
      sidebarStyle, setSidebarStyle,
      borderRadius, setBorderRadius,
      compact, setCompact,
      animations, setAnimations,
      brandName, setBrandName,
      brandIcon, setBrandIcon,
      logoUrl, setLogoUrl,
      bgImage, setBgImage,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
export { THEMES, BACKGROUNDS, FONTS };
