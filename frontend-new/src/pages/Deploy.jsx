import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Server, Cpu, HardDrive, MemoryStick, Check } from 'lucide-react';

const osIcons = {
  ubuntu: '🟠', debian: '🔴', alpine: '🔵', centos: '🟣', fedora: '🎩', arch: '🔷',
};

function getOsIcon(name) {
  const lower = (name || '').toLowerCase();
  for (const [key, icon] of Object.entries(osIcons)) {
    if (lower.includes(key)) return icon;
  }
  return '🖥️';
}

const PRESETS = [
  { name: 'Starter', cpu: 1, ram: 1, disk: 20 },
  { name: 'Basic', cpu: 2, ram: 2, disk: 40 },
  { name: 'Standard', cpu: 2, ram: 4, disk: 60 },
  { name: 'Performance', cpu: 4, ram: 8, disk: 100 },
  { name: 'Power', cpu: 8, ram: 16, disk: 200 },
];

export default function Deploy() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [osImages, setOsImages] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '', os_image: '', cpu_cores: 1, memory_gb: 1, disk_gb: 20, username: 'root', password: '',
  });

  useEffect(() => {
    api.get('/vps/images').then(data => {
      const active = (Array.isArray(data) ? data : []).filter(i => i.is_active);
      setOsImages(active);
      if (active.length > 0 && !form.os_image) setForm(f => ({ ...f, os_image: active[0].docker_image }));
    }).catch(() => {});
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleDeploy = async () => {
    setLoading(true); setError('');
    try {
      const payload = { ...form };
      console.log('Deploy payload:', JSON.stringify(payload));
      await api.post('/vps/', payload);
      navigate('/vps');
    } catch (err) {
      console.error('Deploy error:', err);
      const msg = typeof err?.message === 'string' ? err.message : String(err);
      setError(msg || 'Deploy failed');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold">Deploy New VPS</h1>

      {/* Steps */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${step >= s ? 'text-white' : ''}`}
              style={{ background: step >= s ? 'var(--primary)' : 'var(--surface)', color: step >= s ? 'white' : 'var(--text-muted)', border: `1px solid ${step >= s ? 'var(--primary)' : 'var(--border)'}` }}>
              {step > s ? <Check size={14} /> : s}
            </div>
            {s < 3 && <div className="w-12 h-0.5" style={{ background: step > s ? 'var(--primary)' : 'var(--border)' }} />}
          </div>
        ))}
      </div>

      {/* Step 1: Config */}
      {step === 1 && (
        <div className="space-y-4 animate-fade-in">
          <h2 className="text-lg font-semibold">Configuration</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PRESETS.map(p => {
              const active = form.cpu_cores === p.cpu && form.memory_gb === p.ram && form.disk_gb === p.disk;
              return (
                <button key={p.name} onClick={() => { set('cpu_cores', p.cpu); set('memory_gb', p.ram); set('disk_gb', p.disk); }}
                  className="p-4 rounded-2xl border text-left transition-all hover:scale-[1.02]"
                  style={{ background: 'var(--surface)', borderColor: active ? 'var(--primary)' : 'var(--border)' }}>
                  <div className="font-medium mb-2">{p.name}</div>
                  <div className="flex gap-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                    <span className="flex items-center gap-1"><Cpu size={14} /> {p.cpu}</span>
                    <span className="flex items-center gap-1"><MemoryStick size={14} /> {p.ram} GB</span>
                    <span className="flex items-center gap-1"><HardDrive size={14} /> {p.disk} GB</span>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'CPU Cores', key: 'cpu_cores', min: 1, max: 16 },
              { label: 'RAM (GB)', key: 'memory_gb', min: 1, max: 64 },
              { label: 'Disk (GB)', key: 'disk_gb', min: 10, max: 1000 },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>{f.label}</label>
                <input type="number" min={f.min} max={f.max} value={form[f.key]} onChange={e => set(f.key, +e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                  style={{ background: 'var(--input)', color: 'var(--text)', borderColor: 'var(--border)' }} />
              </div>
            ))}
          </div>
          <button onClick={() => setStep(2)} className="w-full py-2.5 rounded-xl text-white text-sm font-medium" style={{ background: 'var(--primary)' }}>Next</button>
        </div>
      )}

      {/* Step 2: OS */}
      {step === 2 && (
        <div className="space-y-4 animate-fade-in">
          <h2 className="text-lg font-semibold">Choose OS</h2>
          <div className="space-y-2">
            {osImages.length === 0 ? (
              <div className="p-8 text-center rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <Server size={28} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No images available</p>
              </div>
            ) : osImages.map(os => {
              const active = form.os_image === os.docker_image;
              return (
                <button key={os.id} onClick={() => set('os_image', os.docker_image)}
                  className="w-full p-4 rounded-2xl border text-left flex items-center gap-4 transition-all"
                  style={{ background: 'var(--surface)', borderColor: active ? 'var(--primary)' : 'var(--border)' }}>
                  <span className="text-2xl">{getOsIcon(os.name)}</span>
                  <div className="flex-1">
                    <div className="font-medium">{os.name}</div>
                    <div className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{os.docker_image}</div>
                    {os.description && <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{os.description}</div>}
                  </div>
                  {active && <Check size={18} style={{ color: 'var(--primary)' }} />}
                </button>
              );
            })}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ border: '1px solid var(--border)', color: 'var(--text)' }}>Back</button>
            <button onClick={() => setStep(3)} className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium" style={{ background: 'var(--primary)' }}>Next</button>
          </div>
        </div>
      )}

      {/* Step 3: Details */}
      {step === 3 && (
        <div className="space-y-4 animate-fade-in">
          <h2 className="text-lg font-semibold">Details</h2>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>VPS Name</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="my-server"
              className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              style={{ background: 'var(--input)', color: 'var(--text)', borderColor: 'var(--border)' }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Username</label>
              <input value={form.username} onChange={e => set('username', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                style={{ background: 'var(--input)', color: 'var(--text)', borderColor: 'var(--border)' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Password</label>
              <input type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Min 8 characters" minLength={8}
                className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                style={{ background: 'var(--input)', color: 'var(--text)', borderColor: 'var(--border)' }} />
            </div>
          </div>

          <div className="rounded-2xl p-4 text-sm space-y-1.5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="font-medium mb-2">Summary</div>
            {[['OS', form.os_image], ['CPU', `${form.cpu_cores} cores`], ['RAM', `${form.memory_gb} GB`], ['Disk', `${form.disk_gb} GB`]].map(([l, v]) => (
              <div key={l} className="flex justify-between" style={{ color: 'var(--text-muted)' }}><span>{l}</span><span className="font-mono">{v}</span></div>
            ))}
          </div>

          {error && <div className="p-3 rounded-xl text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20">{error}</div>}

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ border: '1px solid var(--border)', color: 'var(--text)' }}>Back</button>
            <button onClick={handleDeploy} disabled={loading || !form.name || !form.password}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50" style={{ background: 'var(--primary)' }}>
              {loading ? 'Deploying...' : 'Deploy VPS'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
