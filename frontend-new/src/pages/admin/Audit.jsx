import { useState, useEffect } from 'react';
import { api } from '../../api';
import { RefreshCw } from 'lucide-react';

export default function AdminAudit() {
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const load = () => api.get(`/admin/audit-logs?page=${page}&per_page=50`).then(setLogs).catch(() => {});
  useEffect(() => { load(); }, [page]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Audit Logs</h2>
        <button onClick={load} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--border)' }}><RefreshCw size={14} /> Refresh</button>
      </div>
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-xs uppercase" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
              <th className="text-left px-5 py-3">Time</th><th className="text-left px-5 py-3">User</th><th className="text-left px-5 py-3">Action</th><th className="text-left px-5 py-3">Resource</th><th className="text-left px-5 py-3">Details</th>
            </tr></thead>
            <tbody>
              {logs.length === 0 ? <tr><td colSpan={5} className="px-5 py-8 text-center" style={{ color: 'var(--text-muted)' }}>No logs</td></tr> : logs.map(log => (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="px-5 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{new Date(log.created_at).toLocaleString()}</td>
                  <td className="px-5 py-3">{log.user_id}</td>
                  <td className="px-5 py-3"><span className="px-2 py-0.5 rounded text-xs font-mono" style={{ background: 'var(--surface-hover)' }}>{log.action}</span></td>
                  <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{log.resource_type}/{log.resource_id}</td>
                  <td className="px-5 py-3 text-xs max-w-[200px] truncate" style={{ color: 'var(--text-muted)' }}>{log.details ? JSON.stringify(log.details) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex justify-center gap-2">
        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-lg text-sm disabled:opacity-50" style={{ border: '1px solid var(--border)' }}>Prev</button>
        <span className="px-3 py-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>Page {page}</span>
        <button onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-lg text-sm" style={{ border: '1px solid var(--border)' }}>Next</button>
      </div>
    </div>
  );
}
