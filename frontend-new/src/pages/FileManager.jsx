import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { ArrowLeft, Folder, File, Upload, Download, Trash2, Edit3, Plus, RefreshCw, Home, ChevronRight, Search, FileText, Image, Music, Film, Archive } from 'lucide-react';

const FILE_ICONS = {
  folder: Folder, js: FileText, py: FileText, md: FileText, txt: FileText, log: FileText,
  json: FileText, yaml: FileText, yml: FileText, html: FileText, css: FileText, xml: FileText,
  sh: FileText, bash: FileText, conf: FileText, cfg: FileText, ini: FileText,
  jpg: Image, jpeg: Image, png: Image, gif: Image, svg: Image, webp: Image, bmp: Image,
  mp3: Music, wav: Music, flac: Music, ogg: Music,
  mp4: Film, mkv: Film, avi: Film, mov: Film, webm: Film,
  zip: Archive, tar: Archive, gz: Archive, bz2: Archive, xz: Archive, rar: Archive, '7z': Archive,
};

function getFileIcon(item) {
  if (item.is_dir) return Folder;
  const ext = item.name.split('.').pop()?.toLowerCase();
  return FILE_ICONS[ext] || File;
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function FileManager() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vps, setVps] = useState(null);
  const [files, setFiles] = useState([]);
  const [currentPath, setCurrentPath] = useState('/');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [editingFile, setEditingFile] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    api.get(`/vps/${id}`).then(setVps).catch(() => navigate('/vps'));
  }, [id]);

  const loadFiles = (path = currentPath) => {
    setLoading(true);
    setError('');
    api.get(`/vps/${id}/files?path=${encodeURIComponent(path)}`)
      .then(setFiles)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadFiles(); }, [id, currentPath]);

  const navigateTo = (path) => {
    setCurrentPath(path);
    setSearch('');
  };

  const goUp = () => {
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    navigateTo('/' + parts.join('/') || '/');
  };

  const openFile = async (file) => {
    if (file.is_dir) {
      navigateTo(file.path);
      return;
    }
    try {
      const data = await api.get(`/vps/${id}/files/read?path=${encodeURIComponent(file.path)}`);
      setEditingFile(file);
      setEditContent(data.content);
    } catch (err) {
      setError(err.message);
    }
  };

  const saveFile = async () => {
    if (!editingFile) return;
    setEditSaving(true);
    try {
      await api.post(`/vps/${id}/files/write`, { path: editingFile.path, content: editContent });
      setEditingFile(null);
      loadFiles();
    } catch (err) {
      setError(err.message);
    }
    setEditSaving(false);
  };

  const deleteItem = async (file) => {
    if (!confirm(`Delete ${file.name}?`)) return;
    try {
      await api.del(`/vps/${id}/files?path=${encodeURIComponent(file.path)}`);
      loadFiles();
    } catch (err) {
      setError(err.message);
    }
  };

  const createFolder = async () => {
    if (!newFolderName) return;
    const fullPath = currentPath === '/' ? `/${newFolderName}` : `${currentPath}/${newFolderName}`;
    try {
      await api.post(`/vps/${id}/files/mkdir`, { path: fullPath, content: '' });
      setNewFolderName('');
      setShowNewFolder(false);
      loadFiles();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('vps_token');
      const res = await fetch(`/api/v1/vps/${id}/files/upload?path=${encodeURIComponent(currentPath)}`, {
        method: 'POST',
        headers: { 'X-Auth-Token': token },
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Upload failed');
      }
      loadFiles();
    } catch (err) {
      setError(err.message);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadFile = (file) => {
    const token = localStorage.getItem('vps_token');
    const url = `/api/v1/vps/${id}/files/download?path=${encodeURIComponent(file.path)}`;
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', file.name);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const filteredFiles = files.filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()));
  const pathParts = currentPath.split('/').filter(Boolean);

  if (!vps) return null;

  if (editingFile) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center gap-4">
          <button onClick={() => setEditingFile(null)} className="p-2 rounded-lg hover:bg-gray-800 transition-colors"><ArrowLeft size={20} /></button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate">{editingFile.name}</h1>
            <p className="text-xs text-gray-500 font-mono truncate">{editingFile.path}</p>
          </div>
          <button onClick={saveFile} disabled={editSaving} className="px-4 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-50" style={{ background: 'var(--primary)' }}>
            {editSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
        {error && <div className="p-3 rounded-xl text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20">{error}</div>}
        <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
          className="w-full h-[70vh] p-4 rounded-xl border text-sm font-mono leading-relaxed outline-none resize-none focus:ring-2 focus:ring-[var(--primary)]/20"
          style={{ background: 'var(--input)', color: 'var(--text)', borderColor: 'var(--border)' }}
          spellCheck={false} />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(`/vps/${id}`)} className="p-2 rounded-lg hover:bg-gray-800 transition-colors"><ArrowLeft size={20} /></button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">File Manager</h1>
          <p className="text-sm text-gray-500">{vps.name}</p>
        </div>
        <button onClick={() => loadFiles()} className="p-2 rounded-lg hover:bg-gray-800 transition-colors"><RefreshCw size={18} /></button>
      </div>

      {error && <div className="p-3 rounded-xl text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20">{error}</div>}

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 p-3 rounded-xl border text-sm overflow-x-auto" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <button onClick={() => navigateTo('/')} className="p-1 rounded hover:bg-gray-800 transition-colors shrink-0"><Home size={16} /></button>
        {pathParts.map((part, i) => {
          const path = '/' + pathParts.slice(0, i + 1).join('/');
          return (
            <span key={i} className="flex items-center gap-1 shrink-0">
              <ChevronRight size={14} className="text-gray-600" />
              <button onClick={() => navigateTo(path)} className="hover:text-[var(--primary)] transition-colors truncate max-w-[120px]">{part}</button>
            </span>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search files..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
            style={{ background: 'var(--input)', color: 'var(--text)', borderColor: 'var(--border)' }} />
        </div>
        <button onClick={() => setShowNewFolder(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm hover:bg-gray-800 transition-colors" style={{ borderColor: 'var(--border)' }}>
          <Plus size={16} /> New Folder
        </button>
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm hover:bg-gray-800 transition-colors disabled:opacity-50" style={{ borderColor: 'var(--border)' }}>
          <Upload size={16} /> {uploading ? 'Uploading...' : 'Upload'}
        </button>
        <input ref={fileInputRef} type="file" onChange={handleUpload} className="hidden" />
      </div>

      {/* New Folder Input */}
      {showNewFolder && (
        <div className="flex gap-2 p-3 rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <input value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="Folder name"
            className="flex-1 px-3 py-2 rounded-lg border text-sm outline-none" style={{ background: 'var(--input)', borderColor: 'var(--border)' }}
            onKeyDown={e => e.key === 'Enter' && createFolder()} autoFocus />
          <button onClick={createFolder} className="px-3 py-2 rounded-lg text-white text-sm" style={{ background: 'var(--primary)' }}>Create</button>
          <button onClick={() => { setShowNewFolder(false); setNewFolderName(''); }} className="px-3 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--border)' }}>Cancel</button>
        </div>
      )}

      {/* File List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />)}
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="text-center py-12 rounded-xl" style={{ background: 'var(--surface)' }}>
          <Folder size={40} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{search ? 'No matching files' : 'Empty directory'}</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {currentPath !== '/' && (
            <button onClick={goUp} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 transition-colors border-b" style={{ borderColor: 'var(--border)' }}>
              <Folder size={18} className="text-gray-500" />
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>..</span>
            </button>
          )}
          {filteredFiles.map(file => {
            const Icon = getFileIcon(file);
            return (
              <div key={file.path} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 transition-colors border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                <Icon size={18} className={file.is_dir ? 'text-yellow-500' : 'text-gray-500'} />
                <button onClick={() => openFile(file)} className="flex-1 text-left text-sm truncate hover:text-[var(--primary)] transition-colors">
                  {file.name}
                </button>
                {!file.is_dir && <span className="text-xs text-gray-600 shrink-0">{formatSize(file.size)}</span>}
                <span className="text-xs text-gray-700 font-mono shrink-0 w-10 text-right">{file.permissions}</span>
                <div className="flex items-center gap-1 shrink-0">
                  {!file.is_dir && (
                    <button onClick={() => downloadFile(file)} className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors" title="Download">
                      <Download size={14} className="text-gray-500" />
                    </button>
                  )}
                  <button onClick={() => deleteItem(file)} className="p-1.5 rounded-lg hover:bg-red-900/30 transition-colors" title="Delete">
                    <Trash2 size={14} className="text-red-500" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
