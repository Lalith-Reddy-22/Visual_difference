import { useEffect, useState, useRef, useCallback, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import Sidebar from '../components/Sidebar';
import { ArrowLeft, Check, X, HelpCircle, Eye, Loader, GitCompare, ArrowLeftRight, Layers, Maximize2, Minimize2, ZoomIn } from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import toast from 'react-hot-toast';

const BASE = '';

// ─── Shared slider viewer ─────────────────────────────────────────────────────
function SliderViewer({ leftUrl, rightUrl, diffUrl, leftLabel = 'BEFORE', rightLabel = 'AFTER', viewport }) {
  const isDesktop = viewport === 'desktop';
  const [mode, setMode] = useState('slider');
  const [zoomMode, setZoomMode] = useState(false);
  const [pos, setPos] = useState(50);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef(null);
  const leftRef = useRef(null);
  const rightRef = useRef(null);
  const syncing = useRef(false);

  useEffect(() => {
    const l = leftRef.current, r = rightRef.current;
    if (!l || !r || mode !== 'side') return;
    const syncL = () => { if (syncing.current) return; syncing.current = true; r.scrollTop = l.scrollTop; syncing.current = false; };
    const syncR = () => { if (syncing.current) return; syncing.current = true; l.scrollTop = r.scrollTop; syncing.current = false; };
    l.addEventListener('scroll', syncL); r.addEventListener('scroll', syncR);
    return () => { l.removeEventListener('scroll', syncL); r.removeEventListener('scroll', syncR); };
  }, [mode]);

  const onMove = useCallback((e) => {
    if (!dragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    // clamp to image bounds, not modal bounds
    const x = Math.max(rect.left, Math.min(rect.right, e.clientX));
    setPos(Math.max(0, Math.min(100, ((x - rect.left) / rect.width) * 100)));
  }, [dragging]);

  useEffect(() => {
    if (!dragging) return;
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', () => setDragging(false));
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', () => setDragging(false)); };
  }, [dragging, onMove]);

  const tabs = [{ id: 'slider', icon: ArrowLeftRight, label: 'Slider' }, { id: 'side', icon: Layers, label: 'Side by Side' }, { id: 'diff', icon: Eye, label: 'Diff' }];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: 4, padding: '8px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', flexShrink: 0 }}>
        {tabs.map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setMode(id)} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '4px 11px', borderRadius: 6, fontSize: 12, fontWeight: 600,
            background: mode === id ? 'var(--accent)' : 'var(--bg3)',
            color: mode === id ? 'white' : 'var(--text3)',
            border: mode === id ? 'none' : '1px solid var(--border)',
          }}><Icon size={11} />{label}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', background: '#111' }}>
        {mode === 'slider' && (
          <div style={{ position: 'absolute', inset: 0, overflow: 'auto', display: 'flex', justifyContent: isDesktop ? 'flex-start' : 'center', alignItems: 'flex-start' }}>
            <div ref={containerRef} style={{ position: 'relative', display: 'inline-block', width: isDesktop ? '100%' : undefined, userSelect: 'none', cursor: dragging ? 'col-resize' : 'default' }}>
              {rightUrl ? <img src={`${BASE}${rightUrl}`} alt={rightLabel} style={{ display: 'block', width: isDesktop ? '100%' : undefined }} /> : <Placeholder label={`No ${rightLabel} screenshot`} />}
              {leftUrl && (
                <img src={`${BASE}${leftUrl}`} alt={leftLabel} style={{
                  position: 'absolute', top: 0, left: 0, display: 'block', width: isDesktop ? '100%' : undefined,
                  clipPath: `inset(0 ${100 - pos}% 0 0)`,
                  pointerEvents: 'none',
                }} />
              )}
              <div style={{ position: 'absolute', top: 10, left: 10, fontSize: 10, fontWeight: 700, fontFamily: 'JetBrains Mono', background: 'rgba(0,0,0,0.75)', color: '#ffd32a', padding: '3px 8px', borderRadius: 4, pointerEvents: 'none' }}>{leftLabel}</div>
              <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 10, fontWeight: 700, fontFamily: 'JetBrains Mono', background: 'rgba(0,0,0,0.75)', color: '#22d688', padding: '3px 8px', borderRadius: 4, pointerEvents: 'none' }}>{rightLabel}</div>
              <div onMouseDown={() => setDragging(true)} style={{ position: 'absolute', top: 0, bottom: 0, left: `${pos}%`, width: 3, background: 'white', cursor: 'col-resize', zIndex: 10, transform: 'translateX(-50%)', boxShadow: '0 0 8px rgba(0,0,0,0.8)' }}>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 30, height: 30, borderRadius: '50%', background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ArrowLeftRight size={13} color="#333" />
                </div>
              </div>
            </div>
          </div>
        )}

        {mode === 'side' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '100%' }}>
            <div ref={leftRef} style={{ borderRight: '1px solid var(--border)', overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: isDesktop ? 'flex-start' : 'center' }}>
              <div style={{ position: 'sticky', top: 0, zIndex: 1, width: '100%', padding: '5px 12px', background: 'rgba(0,0,0,0.85)', fontSize: 10, fontWeight: 700, fontFamily: 'JetBrains Mono', color: '#ffd32a', borderBottom: '1px solid var(--border)' }}>▲ {leftLabel}</div>
              {leftUrl ? <img src={`${BASE}${leftUrl}`} alt={leftLabel} style={{ display: 'block', width: isDesktop ? '100%' : undefined }} /> : <Placeholder label={`No ${leftLabel} screenshot`} />}
            </div>
            <div ref={rightRef} style={{ overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: isDesktop ? 'flex-start' : 'center' }}>
              <div style={{ position: 'sticky', top: 0, zIndex: 1, width: '100%', padding: '5px 12px', background: 'rgba(0,0,0,0.85)', fontSize: 10, fontWeight: 700, fontFamily: 'JetBrains Mono', color: '#22d688', borderBottom: '1px solid var(--border)' }}>▲ {rightLabel}</div>
              {rightUrl ? <img src={`${BASE}${rightUrl}`} alt={rightLabel} style={{ display: 'block', width: isDesktop ? '100%' : undefined }} /> : <Placeholder label={`No ${rightLabel} screenshot`} />}
            </div>
          </div>
        )}

        {mode === 'diff' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '4px 12px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                {zoomMode ? <><ZoomIn size={11} style={{ marginRight: 5, verticalAlign: 'middle' }} />Scroll to zoom · Drag to pan</> : 'Scroll to navigate'}
              </span>
              <button onClick={() => setZoomMode(v => !v)} className="btn btn-ghost btn-sm">
                <ZoomIn size={11} /> {zoomMode ? 'Exit Zoom' : 'Zoom & Pan'}
              </button>
            </div>
            {diffUrl ? (
              zoomMode ? (
                <div style={{ flex: 1, overflow: 'auto' }}>
                  <TransformWrapper minScale={0.5} maxScale={8} wheel={{ step: 0.05 }}>
                    <TransformComponent wrapperStyle={{ width: '100%' }} contentStyle={{ width: '100%' }}>
                      <img src={`${BASE}${diffUrl}`} alt="diff" style={{ width: '100%', display: 'block' }} />
                    </TransformComponent>
                  </TransformWrapper>
                </div>
              ) : (
                <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                  <img src={`${BASE}${diffUrl}`} alt="diff" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                </div>
              )
            ) : <Placeholder label="No diff image available" />}
          </div>
        )}
      </div>
    </div>
  );
}

function Placeholder({ label }) {
  return <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 12 }}>{label}</div>;
}

// ─── Unified result modal ─────────────────────────────────────────────────────
function ResultModal({ result, isCompare, onClose, onApprove }) {
  const [approving, setApproving] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // ESC closes, F toggles fullscreen
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'f' || e.key === 'F') setFullscreen(v => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleApprove = async () => {
    setApproving(true);
    try {
      const snapshotUrl = isCompare ? result.stagingUrl : result.snapshotUrl;
      await api.post('/snapshots/approve', { snapshotUrl, name: result.name, viewport: result.viewport });
      toast.success('Baseline updated!');
      onApprove?.();
      onClose();
    } catch { toast.error('Failed to approve'); }
    finally { setApproving(false); }
  };

  const leftUrl = isCompare ? result.stagingUrl : result.snapshotUrl;
  const rightUrl = isCompare ? result.productionUrl : result.diffUrl;
  const leftLabel = isCompare ? 'STAGING' : 'SNAPSHOT';
  const rightLabel = isCompare ? 'PRODUCTION' : 'DIFF';
  const subtitle = result.isNew ? 'NEW — no baseline existed' : result.diffPercent !== undefined ? `${result.diffPercent.toFixed(3)}% pixel diff` : result.error || '';

  return (
    <div onClick={fullscreen ? undefined : onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: fullscreen ? 0 : 20 }}>
      <div onClick={e => e.stopPropagation()} className="fade-in" style={{
        background: 'var(--bg2)', border: fullscreen ? 'none' : '1px solid var(--border)',
        borderRadius: fullscreen ? 0 : 16,
        width: '100%', maxWidth: fullscreen ? '100%' : 1100,
        height: fullscreen ? '100vh' : '88vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{result.name}</span>
            <span style={{ color: 'var(--text3)', marginLeft: 8, fontSize: 13 }}>/ {result.viewport}</span>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'JetBrains Mono', marginTop: 2 }}>{subtitle}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {(isCompare ? result.stagingUrl : (!result.passed && !result.isNew && result.snapshotUrl)) && (
              <button onClick={handleApprove} disabled={approving} className="btn btn-success btn-sm">
                {approving ? <Loader size={12} className="spinner" /> : <Check size={12} />} Approve as Baseline
              </button>
            )}
            <button onClick={() => setFullscreen(v => !v)} className="btn btn-ghost btn-sm" title={fullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}>
              {fullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
              {fullscreen ? 'Exit' : 'Fullscreen'}
            </button>
            <button onClick={onClose} className="btn btn-ghost btn-sm"><X size={12} /> Close</button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <SliderViewer leftUrl={leftUrl} rightUrl={rightUrl} diffUrl={result.diffUrl} leftLabel={leftLabel} rightLabel={rightLabel} viewport={result.viewport} />
        </div>
      </div>
    </div>
  );
}

// ─── Lazy wrapper — only renders children when scrolled into view ─────────────
function LazyCard({ children, minHeight }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { rootMargin: '300px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return <div ref={ref} style={{ minHeight }}>{visible ? children : null}</div>;
}

// ─── Normal result card ───────────────────────────────────────────────────────
const ResultCard = memo(function ResultCard({ result, onView }) {
  const statusColor = result.passed ? 'var(--green)' : result.isNew ? 'var(--yellow)' : 'var(--red)';
  const statusBg = result.passed ? 'var(--green-bg)' : result.isNew ? 'var(--yellow-bg)' : 'var(--red-bg)';
  const Icon = result.passed ? Check : result.isNew ? HelpCircle : X;

  return (
    <div onClick={onView} className="card card-clickable" style={{ cursor: 'pointer', padding: 14, border: '1px solid var(--border)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{result.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'JetBrains Mono' }}>{result.viewport}</div>
        </div>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: statusBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={14} color={statusColor} />
        </div>
      </div>
      {result.snapshotUrl && (
        <div style={{ height: 100, background: 'var(--bg)', borderRadius: 6, overflow: 'hidden', marginBottom: 10, position: 'relative' }}>
          <img src={`${BASE}${result.snapshotUrl}`} alt={result.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} onError={e => e.target.style.display = 'none'} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.15s', background: 'rgba(0,0,0,0.5)' }}
            onMouseEnter={e => e.currentTarget.style.opacity = 1}
            onMouseLeave={e => e.currentTarget.style.opacity = 0}>
            <Eye size={20} color="white" />
          </div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className={`badge ${result.passed ? 'badge-pass' : result.isNew ? 'badge-new' : 'badge-fail'}`}>
          {result.isNew ? 'NEW' : result.passed ? 'PASS' : 'FAIL'}
        </span>
        {!result.isNew && result.diffPercent !== undefined && (
          <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'JetBrains Mono' }}>Δ {result.diffPercent.toFixed(3)}%</span>
        )}
      </div>
    </div>
  );
});

// ─── Compare result card ──────────────────────────────────────────────────────
const CompareCard = memo(function CompareCard({ result, onView }) {
  const passed = result.passed;
  const hasError = !!result.error;

  return (
    <div onClick={onView} className="card card-clickable" style={{ cursor: 'pointer', padding: 0, overflow: 'hidden', border: `1px solid ${hasError ? 'rgba(255,71,87,0.3)' : passed ? 'rgba(34,214,136,0.2)' : 'rgba(255,71,87,0.3)'}` }}
    >
      {/* Side-by-side thumbnails */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: 110 }}>
        <div style={{ background: 'var(--bg)', overflow: 'hidden', borderRight: '1px solid var(--border)', position: 'relative' }}>
          {result.stagingUrl
            ? <img src={`${BASE}${result.stagingUrl}`} alt="staging" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} onError={e => { e.target.style.display = 'none'; e.target.parentElement.innerHTML += '<div style="height:100%;display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:10px">Image missing</div>'; }} />
            : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 10 }}>No capture</div>}
          <div style={{ position: 'absolute', bottom: 4, left: 4, fontSize: 9, fontWeight: 700, fontFamily: 'JetBrains Mono', background: 'rgba(0,0,0,0.7)', color: 'var(--yellow)', padding: '2px 5px', borderRadius: 3 }}>STAGING</div>
        </div>
        <div style={{ background: 'var(--bg)', overflow: 'hidden', position: 'relative' }}>
          {result.productionUrl
            ? <img src={`${BASE}${result.productionUrl}`} alt="production" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} onError={e => { e.target.style.display = 'none'; e.target.parentElement.innerHTML += '<div style="height:100%;display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:10px">Image missing</div>'; }} />
            : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 10 }}>No capture</div>}
          <div style={{ position: 'absolute', bottom: 4, left: 4, fontSize: 9, fontWeight: 700, fontFamily: 'JetBrains Mono', background: 'rgba(0,0,0,0.7)', color: 'var(--green)', padding: '2px 5px', borderRadius: 3 }}>PROD</div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 12 }}>{result.name}</div>
          <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'JetBrains Mono' }}>{result.viewport} · {result.path}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {hasError
            ? <span className="badge badge-fail">ERROR</span>
            : <span className={`badge ${passed ? 'badge-pass' : 'badge-fail'}`}>{passed ? 'MATCH' : 'DIFF'}</span>}
          {!hasError && result.diffPercent !== undefined && (
            <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'JetBrains Mono', marginTop: 2 }}>Δ {result.diffPercent.toFixed(3)}%</div>
          )}
        </div>
      </div>
    </div>
  );
});

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function RunDetail() {
  const { runId } = useParams();
  const navigate = useNavigate();
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('all');
  const runRef = useRef(null);
  const pollRef = useRef(null);

  const fetchRun = useCallback(() => {
    api.get(`/runs/${runId}`)
      .then(r => {
        // only re-render if data actually changed — prevents jank while scrolling
        if (JSON.stringify(runRef.current) !== JSON.stringify(r.data)) {
          runRef.current = r.data;
          setRun(r.data);
        }
        setLoading(false);
        if (r.data.status === 'done') clearInterval(pollRef.current);
      })
      .catch(() => setLoading(false));
  }, [runId]);

  useEffect(() => {
    fetchRun();
    pollRef.current = setInterval(fetchRun, 4000);
    return () => clearInterval(pollRef.current);
  }, [fetchRun]);

  if (loading) return (
    <div className="page-layout"><Sidebar />
      <main className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader size={24} className="spinner" style={{ color: 'var(--accent)' }} />
      </main>
    </div>
  );

  if (!run) return (
    <div className="page-layout"><Sidebar />
      <main className="main-content" style={{ padding: 40 }}><p style={{ color: 'var(--text3)' }}>Run not found.</p></main>
    </div>
  );

  const isCompare = run.type === 'compare';

  const filtered = (run.results || []).filter(r =>
    filter === 'all' ||
    (filter === 'pass' && r.passed) ||
    (filter === 'fail' && !r.passed) ||
    (filter === 'new' && r.isNew)
  );

  return (
    <div className="page-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <button onClick={() => navigate('/dashboard')} className="btn btn-ghost btn-sm" style={{ marginBottom: 14 }}>
            <ArrowLeft size={13} /> Back to Dashboard
          </button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                {isCompare && <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: 'rgba(227,83,54,0.12)', border: '1px solid rgba(227,83,54,0.25)', borderRadius: 6, fontSize: 11, fontWeight: 700, color: 'var(--accent2)' }}><GitCompare size={11} /> COMPARE</span>}
                <h1 className="page-title" style={{ fontFamily: 'JetBrains Mono', fontSize: 18 }}>{runId}</h1>
              </div>
              {isCompare && (
                <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 11, fontFamily: 'JetBrains Mono' }}>
                  <span style={{ color: 'var(--yellow)' }}>▲ {run.stagingUrl}</span>
                  <span style={{ color: 'var(--text3)' }}>vs</span>
                  <span style={{ color: 'var(--green)' }}>▲ {run.productionUrl}</span>
                </div>
              )}
              <div style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'center' }}>
                <span className={`badge ${run.status === 'done' ? (run.summary.failed > 0 ? 'badge-fail' : 'badge-pass') : 'badge-running'}`}>{run.status}</span>
                <span style={{ color: 'var(--text3)', fontSize: 11, fontFamily: 'JetBrains Mono' }}>{new Date(run.startedAt).toLocaleString()}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div className="card" style={{ padding: '10px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--green)' }}>{run.summary.passed}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 600 }}>{isCompare ? 'Match' : 'Passed'}</div>
              </div>
              <div className="card" style={{ padding: '10px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--red)' }}>{run.summary.failed}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 600 }}>{isCompare ? 'Diff' : 'Failed'}</div>
              </div>
              <div className="card" style={{ padding: '10px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{run.summary.total}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 600 }}>Total</div>
              </div>
            </div>
          </div>
        </div>

        <div className="page-body">
          <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
            {['all', 'pass', 'fail'].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: filter === f ? 'var(--accent)' : 'var(--bg3)',
                color: filter === f ? 'white' : 'var(--text2)',
                border: filter === f ? 'none' : '1px solid var(--border)',
                textTransform: 'capitalize',
              }}>{f}</button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--text3)' }}>
              {run.status === 'running' ? (
                <><Loader size={24} className="spinner" style={{ margin: '0 auto 12px', display: 'block', color: 'var(--accent)' }} /><div>Capturing screenshots…</div></>
              ) : 'No results match this filter.'}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: isCompare ? 'repeat(auto-fill, minmax(300px, 1fr))' : 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
              {filtered.map((result) =>
                isCompare
                  ? <LazyCard key={`${result.name}-${result.viewport}`} minHeight={160}><CompareCard result={result} onView={() => setSelected(result)} /></LazyCard>
                  : <LazyCard key={`${result.name}-${result.viewport}`} minHeight={160}><ResultCard result={result} onView={() => setSelected(result)} /></LazyCard>
              )}
            </div>
          )}
        </div>
      </main>

      {selected && <ResultModal result={selected} isCompare={isCompare} onClose={() => setSelected(null)} onApprove={fetchRun} />}
    </div>
  );
}
