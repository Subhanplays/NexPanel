import { useTheme } from '../context/ThemeContext';
import { Check } from 'lucide-react';

export default function ThemesPage() {
  const ctx = useTheme();

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Themes</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Choose a color theme for the panel</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {ctx.themes.map(t => {
          const active = ctx.themeId === t.id;
          return (
            <button key={t.id} onClick={() => ctx.setThemeId(t.id)}
              className="relative p-4 rounded-2xl border-2 text-left transition-all hover:scale-[1.02]"
              style={{ background: t.surface, borderColor: active ? t.primary : 'var(--border)' }}>
              {active && (
                <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: t.primary }}>
                  <Check size={12} className="text-white" />
                </div>
              )}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-4 h-4 rounded-full" style={{ background: t.primary }} />
                <span className="font-medium text-sm" style={{ color: t.text }}>{t.name}</span>
              </div>
              <div className="flex gap-1">
                {[t.bg, t.surface, t.border, t.primary, t.accent].map((c, i) => (
                  <div key={i} className="w-4 h-4 rounded-full" style={{ background: c }} />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
