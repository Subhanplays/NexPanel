import { useState, useEffect } from 'react';
import { api } from '../../api';
import { Trash2, Plus, Server } from 'lucide-react';

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

export default function AdminImages() {
  const [images, setImages] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', docker_image: '', description: '', is_active: true });
  const load = () => api.get('/admin/images').then(setImages).catch(() => {});
  useEffect(() => { load(); }, []);

  const create = async () => { await api.post('/admin/images', form); setShowCreate(false); setForm({ name: '', docker_image: '', description: '', is_active: true }); load(); };
  const remove = async (id) => { if (!confirm('Delete?')) return; await api.del(`/admin/images/${id}`); load(); };
  const toggle = async (id, val) => { await api.put(`/admin/images/${id}`, { is_active: !val }); load(); };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">OS Images</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{images.length} images available for VPS deployment</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium" style={{ background: 'var(--primary)' }}>
          <Plus size={14} /> Add Image
        </button>
      </div>

      {showCreate && (
        <div className="rounded-2xl p-5 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Name (e.g. Ubuntu 22.04)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="px-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/20" style={{ background: 'var(--input)', color: 'var(--text)', borderColor: 'var(--border)' }} />
            <input placeholder="Docker Image (e.g. ubuntu:22.04)" value={form.docker_image} onChange={e => setForm({ ...form, docker_image: e.target.value })}
              className="px-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/20" style={{ background: 'var(--input)', color: 'var(--text)', borderColor: 'var(--border)' }} />
          </div>
          <input placeholder="Description (optional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/20" style={{ background: 'var(--input)', color: 'var(--text)', borderColor: 'var(--border)' }} />
          <button onClick={create} disabled={!form.name || !form.docker_image}
            className="px-5 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50" style={{ background: 'var(--primary)' }}>Create</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {images.map(img => (
          <div key={img.id} className="rounded-2xl p-4 transition-all hover:scale-[1.01]" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: 'var(--bg)' }}>
                  {getOsIcon(img.name)}
                </div>
                <div>
                  <div className="font-medium text-sm">{img.name}</div>
                  <div className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{img.docker_image}</div>
                </div>
              </div>
              <button onClick={() => toggle(img.id, img.is_active)}
                className="relative w-10 h-6 rounded-full transition-colors shrink-0"
                style={{ background: img.is_active ? 'var(--primary)' : 'var(--border)' }}>
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${img.is_active ? 'left-[18px]' : 'left-0.5'}`} />
              </button>
            </div>
            {img.description && <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{img.description}</p>}
            <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid var(--border)' }}>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${img.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-400'}`}>
                {img.is_active ? 'Active' : 'Inactive'}
              </span>
              <button onClick={() => remove(img.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
