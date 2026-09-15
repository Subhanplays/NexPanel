import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';

export default function Terminal() {
  const { id } = useParams();
  const termRef = useRef(null);
  const wsRef = useRef(null);
  const xtermRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let disposed = false;

    const init = async () => {
      const { Terminal: XTerm } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');
      await import('@xterm/xterm/css/xterm.css');

      if (disposed) return;

      const term = new XTerm({
        theme: {
          background: '#0a0a0f',
          foreground: '#e5e7eb',
          cursor: '#6366f1',
          selectionBackground: '#6366f140',
          black: '#1f2937',
          red: '#ef4444',
          green: '#22c55e',
          yellow: '#eab308',
          blue: '#6366f1',
          magenta: '#a855f7',
          cyan: '#06b6d4',
          white: '#e5e7eb',
        },
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 14,
        cursorBlink: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(termRef.current);
      fitAddon.fit();
      xtermRef.current = { term, fitAddon };

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      let wsUrl;
      if (id) {
        wsUrl = `${protocol}//${window.location.host}/api/v1/ws/vps/${id}/terminal`;
      } else {
        wsUrl = `${protocol}//${window.location.host}/api/v1/ws/terminal`;
      }

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (api.token) {
          ws.send(JSON.stringify({ type: 'auth', token: api.token }));
        }
        setConnected(true);
        term.focus();
      };

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.output) term.write(data.output);
          if (data.type === 'error') setError(data.message || 'Connection error');
        } catch {
          term.write(e.data);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        term.write('\r\n\x1b[31mConnection closed\x1b[0m\r\n');
      };

      ws.onerror = () => setError('WebSocket connection failed');

      term.onData(data => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'input', input: data }));
        }
      });

      const resizeObserver = new ResizeObserver(() => fitAddon.fit());
      resizeObserver.observe(termRef.current);

      return () => { resizeObserver.disconnect(); };
    };

    init();

    return () => {
      disposed = true;
      if (wsRef.current) wsRef.current.close();
      if (xtermRef.current) xtermRef.current.term.dispose();
    };
  }, [id]);

  return (
    <div className="space-y-4 animate-fade-in h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{id ? `Terminal - ${id}` : 'Terminal'}</h1>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'}`} />
          <span className="text-sm text-gray-400">{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

      <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden min-h-[500px]">
        <div ref={termRef} className="w-full h-full p-2" />
      </div>
    </div>
  );
}
