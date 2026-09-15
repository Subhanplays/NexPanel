import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { ArrowLeft, Play, Trash2, Copy, Check } from 'lucide-react';

export default function Console() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vps, setVps] = useState(null);
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [cmdHistory, setCmdHistory] = useState([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [copiedIdx, setCopiedIdx] = useState(-1);
  const outputRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    api.get(`/vps/${id}`).then(setVps).catch(() => navigate('/vps'));
  }, [id]);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [history]);

  const run = async (cmd) => {
    const c = cmd || command;
    if (!c.trim() || running) return;

    setRunning(true); setError('');
    setCmdHistory(prev => [c, ...prev].slice(0, 50));
    setHistoryIdx(-1);

    const entry = { command: c, output: '', exit_code: null, time: new Date() };
    setHistory(prev => [...prev, entry]);
    setCommand('');

    try {
      const res = await api.post(`/vps/${id}/exec`, { command: c, timeout: 60 });
      setHistory(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { ...updated[updated.length - 1], output: res.output, exit_code: res.exit_code };
        return updated;
      });
    } catch (err) {
      setError(err.message);
      setHistory(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { ...updated[updated.length - 1], output: err.message, exit_code: -1 };
        return updated;
      });
    }
    setRunning(false);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      run();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIdx < cmdHistory.length - 1) {
        const newIdx = historyIdx + 1;
        setHistoryIdx(newIdx);
        setCommand(cmdHistory[newIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx > 0) {
        const newIdx = historyIdx - 1;
        setHistoryIdx(newIdx);
        setCommand(cmdHistory[newIdx]);
      } else {
        setHistoryIdx(-1);
        setCommand('');
      }
    }
  };

  const copyOutput = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(-1), 2000);
  };

  const clearHistory = () => setHistory([]);

  const quickCommands = [
    { label: 'System Info', cmd: 'uname -a && cat /etc/os-release | head -5' },
    { label: 'Disk Usage', cmd: 'df -h' },
    { label: 'Memory', cmd: 'free -h' },
    { label: 'Top Processes', cmd: 'ps aux --sort=-%cpu | head -10' },
    { label: 'Network', cmd: 'ip addr show && ss -tlnp' },
    { label: 'Docker', cmd: 'docker ps -a 2>/dev/null || echo "Docker not available"' },
    { label: 'Users', cmd: 'cat /etc/passwd | grep -v nologin | grep -v false' },
    { label: 'Uptime', cmd: 'uptime && who' },
  ];

  if (!vps) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] animate-fade-in">
      <div className="flex items-center gap-4 mb-4">
        <button onClick={() => navigate(`/vps/${id}`)} className="p-2 rounded-lg hover:bg-gray-800 transition-colors"><ArrowLeft size={20} /></button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Console</h1>
          <p className="text-sm text-gray-500">{vps.name}</p>
        </div>
        <button onClick={clearHistory} className="p-2 rounded-lg hover:bg-gray-800 transition-colors" title="Clear"><Trash2 size={18} /></button>
      </div>

      {error && <div className="mb-3 p-3 rounded-xl text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20">{error}</div>}

      {/* Quick commands */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {quickCommands.map(q => (
          <button key={q.label} onClick={() => { setCommand(q.cmd); inputRef.current?.focus(); }}
            className="px-2.5 py-1 rounded-lg text-xs border hover:bg-gray-800 transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            {q.label}
          </button>
        ))}
      </div>

      {/* Output */}
      <div ref={outputRef} className="flex-1 overflow-y-auto rounded-xl border p-4 font-mono text-sm space-y-3"
        style={{ background: '#0a0a0f', borderColor: 'var(--border)' }}
        onClick={() => inputRef.current?.focus()}>
        {history.length === 0 && (
          <div className="text-gray-600 text-center py-8">Type a command and press Enter to execute</div>
        )}
        {history.map((entry, i) => (
          <div key={i} className="group">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-emerald-400">$</span>
              <span className="text-gray-200">{entry.command}</span>
              <button onClick={() => copyOutput(entry.command + '\n' + entry.output, i)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-800 transition-all">
                {copiedIdx === i ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} className="text-gray-500" />}
              </button>
            </div>
            {entry.output && (
              <pre className={`text-xs whitespace-pre-wrap break-all ${entry.exit_code === 0 ? 'text-gray-400' : entry.exit_code === -1 ? 'text-red-400' : 'text-yellow-400'}`}>
                {entry.output}
              </pre>
            )}
            {entry.exit_code !== null && entry.exit_code !== 0 && (
              <div className="text-xs text-red-500/60 mt-0.5">exit code: {entry.exit_code}</div>
            )}
          </div>
        ))}
        {running && <div className="text-gray-500 animate-pulse">Running...</div>}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 mt-3 p-3 rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <span className="text-emerald-400 font-mono text-sm">$</span>
        <input ref={inputRef} value={command} onChange={e => setCommand(e.target.value)} onKeyDown={handleKey}
          placeholder="Enter command..." disabled={running}
          className="flex-1 bg-transparent outline-none text-sm font-mono" style={{ color: 'var(--text)' }} autoFocus />
        <button onClick={() => run()} disabled={running || !command.trim()}
          className="p-2 rounded-lg text-white disabled:opacity-50 transition-colors" style={{ background: 'var(--primary)' }}>
          <Play size={16} />
        </button>
      </div>
    </div>
  );
}
