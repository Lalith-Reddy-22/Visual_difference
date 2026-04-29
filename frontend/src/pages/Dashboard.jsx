import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import Sidebar from '../components/Sidebar';
import toast from 'react-hot-toast';
import { CheckCircle, XCircle, Clock, ChevronRight, Loader, Activity, TrendingUp, AlertTriangle, Play, GitCompare, Trash2 } from 'lucide-react';

function StatCard({ label, value, color, icon: Icon }) {
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 18 }}>
      <div style={{ width: 42, height: 42, borderRadius: 10, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={18} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>{value}</div>
        <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      </div>
    </div>
  );
}

function RunRow({ run, onClick, onDelete }) {
  const hasResults = run.results?.length > 0;
  const passRate = hasResults ? Math.round((run.summary.passed / run.summary.total) * 100) : null;

  return (
    <tr onClick={onClick} style={{ cursor: 'pointer' }}>
      <td>
        <span className="mono" style={{ fontSize: 11, color: 'var(--accent2)' }}>{run.runId.slice(0, 8)}…</span>
      </td>
      <td>
        <span className={`badge ${run.status === 'done' ? (run.summary.failed > 0 ? 'badge-fail' : 'badge-pass') : 'badge-running'}`}>
          {run.status === 'running' ? <span className="pulse">●</span> : null}
          {run.status}
        </span>
      </td>
      <td style={{ color: 'var(--text2)', fontFamily: 'JetBrains Mono', fontSize: 11 }}>
        {new Date(run.startedAt).toLocaleString()}
      </td>
      <td>
        {hasResults ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 4, background: 'var(--bg4)', borderRadius: 99, overflow: 'hidden', minWidth: 80 }}>
              <div style={{ width: `${passRate}%`, height: '100%', background: passRate === 100 ? 'var(--green)' : 'var(--red)', borderRadius: 99 }} />
            </div>
            <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono', color: 'var(--text2)', minWidth: 36 }}>{passRate}%</span>
          </div>
        ) : <span style={{ color: 'var(--text3)', fontSize: 11 }}>—</span>}
      </td>
      <td>
        {hasResults && (
          <div style={{ display: 'flex', gap: 6 }}>
            <span className="badge badge-pass">{run.summary.passed} pass</span>
            {run.summary.failed > 0 && <span className="badge badge-fail">{run.summary.failed} fail</span>}
          </div>
        )}
      </td>
      <td>
        <button
          className="btn btn-danger btn-sm"
          onClick={e => { e.stopPropagation(); onDelete(run.runId); }}
          title="Delete run"
        >
          <Trash2 size={12} />
        </button>
      </td>
    </tr>
  );
}

export default function Dashboard() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/runs').then(r => { setRuns(r.data); setLoading(false); })
      .catch(() => setLoading(false));
    const t = setInterval(() => api.get('/runs').then(r => setRuns(r.data)).catch(() => {}), 5000);
    return () => clearInterval(t);
  }, []);

  const [triggering, setTriggering] = useState(false);

  const triggerRun = async () => {
    setTriggering(true);
    try {
      const res = await api.post('/runs/trigger');
      toast.success(`Run started: ${res.data.runId.slice(0, 8)}…`);
      navigate(`/runs/${res.data.runId}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start run');
    } finally {
      setTriggering(false);
    }
  };

  const deleteRun = async (runId) => {
    if (!confirm('Delete this run?')) return;
    try {
      await api.delete(`/runs/${runId}`);
      setRuns(prev => prev.filter(r => r.runId !== runId));
      toast.success('Run deleted');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  const totalRuns = runs.length;
  const totalFailed = runs.reduce((s, r) => s + (r.summary?.failed || 0), 0);
  const totalPassed = runs.reduce((s, r) => s + (r.summary?.passed || 0), 0);
  const runningCount = runs.filter(r => r.status === 'running').length;

  return (
    <div className="page-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 className="page-title">Dashboard</h1>
              <p className="page-subtitle">Visual regression run history</p>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                className="btn btn-primary"
                onClick={triggerRun}
                disabled={triggering || runningCount > 0}
                style={{ gap: 8 }}
              >
                {triggering ? <Loader size={14} className="spinner" /> : <Play size={14} />}
                {triggering ? 'Starting…' : 'Run Tests'}
              </button>
              <button className="btn btn-ghost" onClick={() => navigate('/compare')} style={{ gap: 8 }}>
                <GitCompare size={14} /> Compare
              </button>
            {runningCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'rgba(227,83,54,0.1)', borderRadius: 8, border: '1px solid rgba(227,83,54,0.2)' }}>
                <Loader size={13} className="spinner" style={{ color: 'var(--accent2)' }} />
                <span style={{ fontSize: 12, color: 'var(--accent2)', fontWeight: 600 }}>{runningCount} run{runningCount > 1 ? 's' : ''} active</span>
              </div>
            )}
            </div>
          </div>
        </div>

        <div className="page-body fade-in">
          {/* Stats */}
          <div className="grid-3" style={{ marginBottom: 24 }}>
            <StatCard label="Total Runs" value={totalRuns} color="var(--accent)" icon={Activity} />
            <StatCard label="Tests Passed" value={totalPassed} color="var(--green)" icon={TrendingUp} />
            <StatCard label="Tests Failed" value={totalFailed} color="var(--red)" icon={AlertTriangle} />
          </div>

          {/* Runs Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Run History</span>
              <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'JetBrains Mono' }}>auto-refreshes every 5s</span>
            </div>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
                <Loader size={20} className="spinner" style={{ margin: '0 auto 8px', display: 'block' }} />
                Loading runs…
              </div>
            ) : runs.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📷</div>
                <div style={{ fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>No runs yet</div>
                <div style={{ color: 'var(--text3)', fontSize: 12, fontFamily: 'JetBrains Mono' }}>Click "Run Tests" above to capture your first screenshots</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Run ID</th>
                      <th>Status</th>
                      <th>Started</th>
                      <th>Pass Rate</th>
                      <th>Results</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map(run => (
                      <RunRow key={run.runId} run={run} onClick={() => navigate(`/runs/${run.runId}`)} onDelete={deleteRun} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
