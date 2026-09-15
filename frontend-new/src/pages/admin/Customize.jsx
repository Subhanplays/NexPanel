import { useState, useEffect, useRef } from 'react';
import { api } from '../../api';
import { useTheme, THEMES, FONTS } from '../../context/ThemeContext';
import { Upload, Trash2, Check, Image } from 'lucide-react';

export default function AdminCustomize() {
  const ctx = useTheme();
  const [branding, setBranding] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [logoPreview, setLogoPreview] = useState(null);
  const [bgPreview, setBgPreview] = useState(null);
  const logoInput = useRef();
  const bgInput = useRef();

  useEffect(() => {
    api.get('/admin/branding').then(d => {
      setBranding(d);
      const logo = d.find(b => b.key === 'admin_logo_url');
      const bg = d.find(b => b.key === 'admin_bg_image');
      if (logo?.value) setLogoPreview(logo.value);
      if (bg?.value) setBgPreview(bg.value);
    }).catch(() => {});
  }, []);

  const saveBranding = async (key, value) => {
    try {
      const existing = branding.find(b => b.key === key);
      if (existing) await api.put(`/admin/branding/${existing.id}`, { value });
      else await api.post('/admin/branding', { key, value, category: 'theme' });
      setBranding(await api.get('/admin/branding'));
    } catch (err) { console.error(err); }
  };

  const saveAll = async () => {
    setSaving(true); setMsg('');
    try {
      const entries = {
        'admin_theme': ctx.themeId, 'admin_font': ctx.fontId, 'admin_radius': ctx.borderRadius,
        'admin_brand_name': ctx.brandName, 'admin_brand_icon': ctx.brandIcon,
        'admin_compact': String(ctx.compact), 'admin_animations': String(ctx.animations),
      };
      for (const [key, value] of Object.entries(entries)) {
        const existing = branding.find(b => b.key === key);
        if (existing) await api.put(`/admin/branding/${existing.id}`, { value });
        else await api.post('/admin/branding', { key, value, category: 'theme' });
      }
      setBranding(await api.get('/admin/branding'));
      setMsg('All settings saved!');
    } catch (err) { setMsg('Error: ' + err.message); }
    setSaving(false);
    setTimeout(() => setMsg(''), 3000);
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setLogoPreview(ev.target.result); saveBranding('admin_logo_url', ev.target.result); };
    reader.readAsDataURL(file);
  };

  const handleBgUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setBgPreview(ev.target.result); saveBranding('admin_bg_image', ev.target.result); };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Customize</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Configure branding, theme, and appearance for all users.</p>
        </div>
        <button onClick={saveAll} disabled={saving} className="px-5 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50 transition-all" style={{ background: 'var(--primary)' }}>
          {saving ? 'Saving...' : 'Save All'}
        </button>
      </div>

      {msg && <div className={`p-3 rounded-xl text-sm font-medium ${msg.includes('Error') ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>{msg}</div>}

      {/* Branding Card */}
      <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h3 className="text-sm font-semibold mb-4">Branding</h3>
        <div className="flex flex-col sm:flex-row gap-8">
          {/* Logo */}
          <div>
            <div className="w-24 h-24 rounded-2xl flex items-center justify-center text-4xl font-bold text-white shrink-0 relative overflow-hidden mb-3"
              style={{ background: logoPreview ? 'var(--surface)' : 'var(--primary)', border: '2px dashed var(--border)' }}>
              {logoPreview ? <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" /> : ctx.brandIcon}
            </div>
            <div className="flex gap-2">
              <button onClick={() => logoInput.current.click()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-[var(--surface-hover)]" style={{ borderColor: 'var(--border)' }}>
                <Upload size={12} /> Upload
              </button>
              {logoPreview && (
                <button onClick={() => { setLogoPreview(null); saveBranding('admin_logo_url', ''); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-colors">
                  <Trash2 size={12} /> Remove
                </button>
              )}
            </div>
            <input ref={logoInput} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
          </div>

          {/* Fields */}
          <div className="flex-1 space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Panel Name</label>
              <input value={ctx.brandName} onChange={e => { ctx.setBrandName(e.target.value); saveBranding('admin_brand_name', e.target.value); }}
                className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-all" style={{ background: 'var(--input)', color: 'var(--text)', borderColor: 'var(--border)' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Icon (1-2 characters)</label>
              <input value={ctx.brandIcon} onChange={e => { ctx.setBrandIcon(e.target.value.slice(0, 2)); saveBranding('admin_brand_icon', e.target.value.slice(0, 2)); }}
                maxLength={2} className="w-20 px-3 py-2.5 rounded-xl border text-sm outline-none text-center font-bold focus:ring-2 focus:ring-[var(--primary)]/20 transition-all" style={{ background: 'var(--input)', color: 'var(--text)', borderColor: 'var(--border)' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Background Image */}
      <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h3 className="text-sm font-semibold mb-4">Background Image</h3>
        {bgPreview ? (
          <div className="relative rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
            <img src={bgPreview} alt="Background" className="w-full h-48 object-cover" />
            <button onClick={() => { setBgPreview(null); saveBranding('admin_bg_image', ''); }}
              className="absolute top-3 right-3 p-2 rounded-lg bg-black/60 text-white hover:bg-black/80 transition-colors backdrop-blur-sm">
              <Trash2 size={16} />
            </button>
          </div>
        ) : (
          <button onClick={() => bgInput.current.click()}
            className="w-full aspect-video max-w-md rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 hover:bg-[var(--surface-hover)] transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            <Image size={36} strokeWidth={1.5} />
            <span className="text-sm font-medium">Click to upload</span>
            <span className="text-xs">PNG, JPG, WEBP</span>
          </button>
        )}
        <input ref={bgInput} type="file" accept="image/*" onChange={handleBgUpload} className="hidden" />
      </div>

      {/* Color Themes */}
      <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h3 className="text-sm font-semibold mb-4">Color Theme</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {Object.values(THEMES).map(t => {
            const active = ctx.themeId === t.id;
            return (
              <button key={t.id} onClick={() => { ctx.setThemeId(t.id); saveBranding('admin_theme', t.id); }}
                className="relative p-3 rounded-xl border-2 text-left transition-all hover:scale-[1.02]"
                style={{ background: t.surface, borderColor: active ? t.primary : 'var(--border)' }}>
                {active && <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: t.primary }}><Check size={12} className="text-white" /></div>}
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-4 h-4 rounded-full" style={{ background: t.primary }} />
                  <span className="text-xs font-medium" style={{ color: t.text }}>{t.name}</span>
                </div>
                <div className="flex gap-1">{[t.bg, t.surface, t.border, t.primary, t.accent].map((c, i) => <div key={i} className="w-3 h-3 rounded-full" style={{ background: c }} />)}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fonts */}
        <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h3 className="text-sm font-semibold mb-4">Font Family</h3>
          <div className="space-y-2">
            {FONTS.map(f => {
              const active = ctx.fontId === f.id;
              return (
                <button key={f.id} onClick={() => { ctx.setFontId(f.id); saveBranding('admin_font', f.id); }}
                  className="w-full p-3 rounded-xl border-2 text-left transition-all flex items-center justify-between"
                  style={{ background: active ? 'var(--primary)/5' : 'var(--bg)', fontFamily: f.family, borderColor: active ? 'var(--primary)' : 'var(--border)' }}>
                  <div>
                    <div className="text-sm font-medium">{f.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>The quick brown fox</div>
                  </div>
                  {active && <Check size={16} style={{ color: 'var(--primary)' }} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Settings */}
        <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h3 className="text-sm font-semibold mb-4">Settings</h3>

          {/* Radius */}
          <div className="mb-6">
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Border Radius</label>
            <div className="flex items-center gap-4">
              <input type="range" min="0" max="24" value={ctx.borderRadius}
                onChange={e => { ctx.setBorderRadius(e.target.value); saveBranding('admin_radius', e.target.value); }}
                className="flex-1 accent-[var(--primary)]" />
              <div className="w-10 h-10 flex items-center justify-center border text-xs font-semibold shrink-0 rounded-lg"
                style={{ borderRadius: ctx.borderRadius + 'px', background: 'var(--primary)', color: 'white' }}>
                {ctx.borderRadius}
              </div>
            </div>
            <div className="flex gap-1.5 mt-2">
              {[0, 6, 12, 18, 24].map(r => (
                <button key={r} onClick={() => { ctx.setBorderRadius(String(r)); saveBranding('admin_radius', String(r)); }}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all"
                  style={{
                    background: ctx.borderRadius === String(r) ? 'var(--primary)' : 'transparent',
                    borderColor: ctx.borderRadius === String(r) ? 'var(--primary)' : 'var(--border)',
                    color: ctx.borderRadius === String(r) ? 'white' : 'var(--text-muted)',
                  }}>
                  {r}px
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            {[
              { label: 'Compact Mode', desc: 'Reduce spacing', value: ctx.compact, toggle: () => { ctx.setCompact(!ctx.compact); saveBranding('admin_compact', String(!ctx.compact)); } },
              { label: 'Animations', desc: 'Smooth transitions', value: ctx.animations, toggle: () => { ctx.setAnimations(!ctx.animations); saveBranding('admin_animations', String(!ctx.animations)); } },
            ].map(opt => (
              <div key={opt.label} className="flex items-center justify-between p-3 rounded-xl border" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
                <div>
                  <div className="text-sm font-medium">{opt.label}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{opt.desc}</div>
                </div>
                <button onClick={opt.toggle} className="relative w-11 h-6 rounded-full transition-colors shrink-0" style={{ background: opt.value ? 'var(--primary)' : 'var(--border)' }}>
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${opt.value ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h3 className="text-sm font-semibold mb-4">Preview</h3>
        <div className="p-5 rounded-xl flex items-center gap-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl shrink-0 overflow-hidden" style={{ background: logoPreview ? 'var(--surface)' : 'var(--primary)' }}>
            {logoPreview ? <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" /> : ctx.brandIcon}
          </div>
          <div className="flex-1">
            <div className="font-bold text-lg">{ctx.brandName}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Cloud Infrastructure Management</div>
          </div>
          <div className="hidden sm:flex gap-2">
            {[{ l: 'Theme', v: ctx.theme.name }, { l: 'Font', v: ctx.font.name }, { l: 'R', v: ctx.borderRadius + 'px' }].map(p => (
              <div key={p.l} className="px-3 py-1.5 rounded-lg text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="text-[10px] uppercase" style={{ color: 'var(--text-muted)' }}>{p.l}</div>
                <div className="text-xs font-semibold">{p.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
