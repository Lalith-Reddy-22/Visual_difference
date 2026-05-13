import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import Sidebar from '../components/Sidebar';
import toast from 'react-hot-toast';
import {
  GitCompare, Play, Loader, Monitor, Tablet, Smartphone,
  Check, X, AlertTriangle, SlidersHorizontal,
  ArrowLeftRight, Layers, Eye, Search, ChevronDown, Maximize2, Minimize2, ZoomIn
} from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

const BASE = '';
const VP_ICONS = { desktop: Monitor, tablet: Tablet, mobile: Smartphone };

// ─── Draggable slider diff viewer ────────────────────────────────────────────
function SliderViewer({ stagingUrl, productionUrl, diffUrl }) {
  const [mode, setMode] = useState('slider');
  const [zoomMode, setZoomMode] = useState(false);
  const [sliderPos, setSliderPos] = useState(50);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef(null);
  const leftRef = useRef(null);
  const rightRef = useRef(null);
  const syncingRef = useRef(false);

  const syncScroll = useCallback((source, target) => {
    return () => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      target.scrollTop = source.scrollTop;
      target.scrollLeft = source.scrollLeft;
      syncingRef.current = false;
    };
  }, []);

  useEffect(() => {
    const l = leftRef.current;
    const r = rightRef.current;
    if (!l || !r) return;
    const onLeft = syncScroll(l, r);
    const onRight = syncScroll(r, l);
    l.addEventListener('scroll', onLeft);
    r.addEventListener('scroll', onRight);
    return () => {
      l.removeEventListener('scroll', onLeft);
      r.removeEventListener('scroll', onRight);
    };
  }, [mode, syncScroll]);

  const onMouseMove = useCallback((e) => {
    if (!dragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    setSliderPos((x / rect.width) * 100);
  }, [dragging]);

  const onMouseUp = useCallback(() => setDragging(false), []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging, onMouseMove, onMouseUp]);

  const updatePos = useCallback((clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setSliderPos(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)));
  }, []);

  const onTouchMove = useCallback((e) => { e.preventDefault(); updatePos(e.touches[0].clientX); }, [updatePos]);
  const onTouchEnd = useCallback(() => setDragging(false), []);
  useEffect(() => {
    if (!dragging) return;
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    return () => { window.removeEventListener('touchmove', onTouchMove); window.removeEventListener('touchend', onTouchEnd); };
  }, [dragging, onTouchMove, onTouchEnd]);

  const tabs = [
    { id: 'slider', icon: ArrowLeftRight, label: 'Slider' },
    { id: 'side', icon: Layers, label: 'Side by Side' },
    { id: 'diff', icon: Eye, label: 'Diff' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
        {tabs.map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setMode(id)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
            background: mode === id ? 'var(--accent)' : 'var(--bg3)',
            color: mode === id ? 'white' : 'var(--text3)',
            border: mode === id ? 'none' : '1px solid var(--border)',
          }}>
            <Icon size={12} />{label}
          </button>
        ))}
      </div>

      {/* Viewer */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', background: '#111' }}>

        {/* SLIDER MODE */}
        {mode === 'slider' && (
          <div ref={containerRef}
            onMouseDown={() => setDragging(true)}
            onTouchStart={(e) => { setDragging(true); updatePos(e.touches[0].clientX); }}
            style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', cursor: 'ew-resize', userSelect: 'none' }}>
            {/* Production — base layer full width */}
            <div style={{ position: 'absolute', inset: 0, overflow: 'auto' }}>
              {productionUrl
                ? <img src={`${BASE}${productionUrl}`} alt="production" style={{ display: 'block', width: '100%' }} />
                : <Placeholder label="No production screenshot" />}
            </div>
            {/* Staging — clipped to left of divider */}
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', width: `${sliderPos}%`, pointerEvents: 'none' }}>
              <div style={{ position: 'absolute', inset: 0, overflow: 'auto', width: `${10000 / sliderPos}%` }}>
                {stagingUrl
                  ? <img src={`${BASE}${stagingUrl}`} alt="staging" style={{ display: 'block', width: '100%' }} />
                  : <Placeholder label="No staging screenshot" />}
              </div>
            </div>
            {/* Labels */}
            <div style={{ position: 'absolute', top: 10, left: 10, fontSize: 10, fontWeight: 700, fontFamily: 'JetBrains Mono', background: 'rgba(0,0,0,0.75)', color: '#ffd32a', padding: '3px 8px', borderRadius: 4, pointerEvents: 'none', zIndex: 5 }}>STAGING</div>
            <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 10, fontWeight: 700, fontFamily: 'JetBrains Mono', background: 'rgba(0,0,0,0.75)', color: '#22d688', padding: '3px 8px', borderRadius: 4, pointerEvents: 'none', zIndex: 5 }}>PRODUCTION</div>
            {/* Divider */}
            <div
              style={{
                position: 'absolute', top: 0, bottom: 0, left: `${sliderPos}%`,
                width: 3, background: 'white', cursor: 'ew-resize', zIndex: 10,
                transform: 'translateX(-50%)', boxShadow: '0 0 8px rgba(0,0,0,0.8)',
                pointerEvents: 'none',
              }}
            >
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 32, height: 32, borderRadius: '50%',
                background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <ArrowLeftRight size={14} color="#333" />
              </div>
            </div>
          </div>
        )}



        {/* SIDE BY SIDE MODE */}
        {mode === 'side' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '100%' }}>
            <div ref={leftRef} style={{ borderRight: '1px solid var(--border)', overflow: 'auto', display: 'flex', justifyContent: 'center' }}>
              <div style={{ flexShrink: 0 }}>
                <div style={{ position: 'sticky', top: 0, zIndex: 1, padding: '6px 12px', background: 'rgba(0,0,0,0.85)', fontSize: 10, fontWeight: 700, fontFamily: 'JetBrains Mono', color: '#ffd32a', borderBottom: '1px solid var(--border)' }}>▲ STAGING</div>
                {stagingUrl
                  ? <img src={`${BASE}${stagingUrl}`} alt="staging" style={{ display: 'block', maxWidth: '100%' }} />
                  : <Placeholder label="No staging screenshot" />}
              </div>
            </div>
            <div ref={rightRef} style={{ overflow: 'auto', display: 'flex', justifyContent: 'center' }}>
              <div style={{ flexShrink: 0 }}>
                <div style={{ position: 'sticky', top: 0, zIndex: 1, padding: '6px 12px', background: 'rgba(0,0,0,0.85)', fontSize: 10, fontWeight: 700, fontFamily: 'JetBrains Mono', color: '#22d688', borderBottom: '1px solid var(--border)' }}>▲ PRODUCTION</div>
                {productionUrl
                  ? <img src={`${BASE}${productionUrl}`} alt="production" style={{ display: 'block', maxWidth: '100%' }} />
                  : <Placeholder label="No production screenshot" />}
              </div>
            </div>
          </div>
        )}

        {/* DIFF MODE */}
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
  return (
    <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 12 }}>{label}</div>
  );
}

// ─── Result card in the list ──────────────────────────────────────────────────
function ResultCard({ result, active, onClick }) {
  const hasError = !!result.error;
  const passed = result.passed && !hasError;

  return (
    <div onClick={onClick} style={{
      padding: '12px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
              background: active ? 'rgba(227,83,54,0.1)' : 'transparent',
      borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent',
      transition: 'background 0.1s',
    }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg3)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{result.name}</div>
          <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'JetBrains Mono', marginTop: 2 }}>
            {result.viewport} · {result.path}
          </div>
        </div>
        <span className={`badge ${hasError ? 'badge-fail' : passed ? 'badge-pass' : 'badge-fail'}`} style={{ fontSize: 10 }}>
          {hasError ? 'ERR' : passed ? 'MATCH' : 'DIFF'}
        </span>
      </div>

      {/* Thumbnail strip */}
      {(result.stagingUrl || result.productionUrl) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ height: 48, background: 'var(--bg4)', overflow: 'hidden', position: 'relative' }}>
            {result.stagingUrl && <img src={`${BASE}${result.stagingUrl}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />}
            <div style={{ position: 'absolute', bottom: 2, left: 2, fontSize: 8, fontWeight: 700, fontFamily: 'JetBrains Mono', background: 'rgba(0,0,0,0.8)', color: '#ffd32a', padding: '1px 4px', borderRadius: 2 }}>S</div>
          </div>
          <div style={{ height: 48, background: 'var(--bg4)', overflow: 'hidden', position: 'relative' }}>
            {result.productionUrl && <img src={`${BASE}${result.productionUrl}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />}
            <div style={{ position: 'absolute', bottom: 2, left: 2, fontSize: 8, fontWeight: 700, fontFamily: 'JetBrains Mono', background: 'rgba(0,0,0,0.8)', color: '#22d688', padding: '1px 4px', borderRadius: 2 }}>P</div>
          </div>
        </div>
      )}

      {!hasError && result.diffPercent !== undefined && (
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ flex: 1, height: 3, background: 'var(--bg4)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(result.diffPercent, 100)}%`, height: '100%', background: passed ? 'var(--green)' : 'var(--red)', borderRadius: 99 }} />
          </div>
          <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: 'var(--text3)' }}>Δ {result.diffPercent.toFixed(2)}%</span>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ComparePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ stagingUrl: '', productionUrl: '', viewports: ['desktop'], dismissPopups: true });
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState(null);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('all');
  const pollRef = useRef(null);
  const [crawling, setCrawling] = useState(false);
  const [crawledPages, setCrawledPages] = useState([]);
  const [selectedPaths, setSelectedPaths] = useState(new Set());
  const [showPathPicker, setShowPathPicker] = useState(false);

  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'f' || e.key === 'F') setFullscreen(v => !v); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const crawlPaths = async () => {
    if (!form.stagingUrl) return toast.error('Enter Staging URL first');
    setCrawling(true);
    setShowPathPicker(false);
    try {
      const res = await api.post('/config/crawl', { baseUrl: form.stagingUrl });
      setCrawledPages(res.data.pages);
      setSelectedPaths(new Set(res.data.pages.map((_, i) => i)));
      setShowPathPicker(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Crawl failed');
    } finally {
      setCrawling(false);
    }
  };

  const togglePath = i => setSelectedPaths(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const toggleAllPaths = () => setSelectedPaths(s => s.size === crawledPages.length ? new Set() : new Set(crawledPages.map((_, i) => i)));

  const toggleVp = (vp) => {
    setForm(f => ({
      ...f,
      viewports: f.viewports.includes(vp) ? f.viewports.filter(v => v !== vp) : [...f.viewports, vp],
    }));
  };

  const startCompare = async () => {
    if (!form.stagingUrl || !form.productionUrl) return toast.error('Both URLs are required');
    setRunning(true);
    setRun(null);
    setSelected(null);
    try {
      const paths = crawledPages.length
        ? crawledPages.filter((_, i) => selectedPaths.has(i)).map(p => new URL(p.url).pathname)
        : ['/'];
      const res = await api.post('/runs/compare', { ...form, paths });
      pollRun(res.data.runId);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start compare');
      setRunning(false);
    }
  };

  const pollRun = (runId) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/runs/${runId}`);
        setRun(res.data);
        if (res.data.results?.length > 0 && !selected) setSelected(res.data.results[0]);
        if (res.data.status === 'done') {
          clearInterval(pollRef.current);
          setRunning(false);
          toast.success(`Compare done — ${res.data.summary.total} pages`);
        }
      } catch {}
    }, 2000);
  };

  useEffect(() => () => clearInterval(pollRef.current), []);

  const results = run?.results || [];
  const filtered = results.filter(r =>
    filter === 'all' ||
    (filter === 'diff' && !r.passed) ||
    (filter === 'match' && r.passed && !r.error) ||
    (filter === 'error' && r.error)
  );

  const diffCount = results.filter(r => !r.passed && !r.error).length;
  const matchCount = results.filter(r => r.passed).length;
  const errorCount = results.filter(r => r.error).length;

  return (
    <div className="page-layout">
      <Sidebar />
      <main className="main-content" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(227,83,54,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GitCompare size={16} style={{ color: 'var(--accent2)' }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Environment Compare</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>Compare staging vs production side by side</div>
            </div>
          </div>

          {/* URL inputs + controls */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            {/* Staging */}
            <div style={{ flex: '1 1 220px', minWidth: 0 }}>
              <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ffd32a', display: 'inline-block' }} /> Staging URL
              </label>
              <input className="input" placeholder="https://staging.example.com" value={form.stagingUrl}
                onChange={e => setForm(f => ({ ...f, stagingUrl: e.target.value }))} />
            </div>

            {/* Arrow */}
            <div style={{ paddingBottom: 2, color: 'var(--text3)', flexShrink: 0 }}>
              <ArrowLeftRight size={16} />
            </div>

            {/* Production */}
            <div style={{ flex: '1 1 220px', minWidth: 0 }}>
              <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22d688', display: 'inline-block' }} /> Production URL
              </label>
              <input className="input" placeholder="https://example.com" value={form.productionUrl}
                onChange={e => setForm(f => ({ ...f, productionUrl: e.target.value }))} />
            </div>

            {/* Path picker */}
            <div style={{ flex: '0 1 auto', minWidth: 0, position: 'relative' }}>
              <label className="label">Paths</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button className="btn btn-ghost" onClick={crawlPaths} disabled={crawling} style={{ height: 36, whiteSpace: 'nowrap' }}>
                  {crawling ? <Loader size={13} className="spinner" /> : <Search size={13} />}
                  {crawling ? 'Crawling…' : 'Discover Paths'}
                </button>
                {crawledPages.length > 0 && (
                  <button onClick={() => setShowPathPicker(v => !v)} style={{
                    height: 36, padding: '0 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)',
                    display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
                  }}>
                    {selectedPaths.size}/{crawledPages.length} <ChevronDown size={12} />
                  </button>
                )}
              </div>
              {showPathPicker && crawledPages.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: 4,
                  background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10,
                  width: 320, maxHeight: 320, display: 'flex', flexDirection: 'column',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                }}>
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{crawledPages.length} pages found</span>
                    <button onClick={toggleAllPaths} className="btn btn-ghost btn-sm">
                      {selectedPaths.size === crawledPages.length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <div style={{ overflowY: 'auto', flex: 1 }}>
                    {crawledPages.map((p, i) => (
                      <div key={i} onClick={() => togglePath(i)} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                        cursor: 'pointer', borderBottom: '1px solid var(--border)',
                        background: selectedPaths.has(i) ? 'rgba(227,83,54,0.06)' : 'transparent',
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(227,83,54,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.background = selectedPaths.has(i) ? 'rgba(227,83,54,0.06)' : 'transparent'}
                      >
                        <div style={{
                          width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                          border: `1px solid ${selectedPaths.has(i) ? 'var(--accent)' : 'var(--border2)'}`,
                          background: selectedPaths.has(i) ? 'var(--accent)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {selectedPaths.has(i) && <Check size={10} color="white" />}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{p.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'JetBrains Mono', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{new URL(p.url).pathname}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn btn-primary btn-sm" onClick={() => setShowPathPicker(false)}>
                      <Check size={11} /> Done
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Viewports */}
            <div style={{ flexShrink: 0 }}>
              <label className="label">Viewports</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {['desktop', 'tablet', 'mobile'].map(vp => {
                  const Icon = VP_ICONS[vp];
                  const active = form.viewports.includes(vp);
                  return (
                    <button key={vp} onClick={() => toggleVp(vp)} title={vp} style={{
                      width: 34, height: 34, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: active ? 'rgba(227,83,54,0.2)' : 'var(--bg3)',
                      color: active ? 'var(--accent2)' : 'var(--text3)',
                      border: active ? '1px solid rgba(227,83,54,0.4)' : '1px solid var(--border)',
                    }}>
                      <Icon size={14} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dismiss popups toggle */}
            <div style={{ flexShrink: 0 }}>
              <label className="label">Popups</label>
              <button
                onClick={() => setForm(f => ({ ...f, dismissPopups: !f.dismissPopups }))}
                title={form.dismissPopups ? 'Popups will be dismissed' : 'Popups will NOT be dismissed'}
                style={{
                  height: 34, padding: '0 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: form.dismissPopups ? 'rgba(34,214,136,0.12)' : 'rgba(255,71,87,0.12)',
                  color: form.dismissPopups ? 'var(--green)' : 'var(--red)',
                  border: `1px solid ${form.dismissPopups ? 'rgba(34,214,136,0.3)' : 'rgba(255,71,87,0.3)'}`,
                }}
              >
                {form.dismissPopups ? <Check size={13} /> : <X size={13} />}
                {form.dismissPopups ? 'Dismiss' : 'Keep'}
              </button>
            </div>

            {/* Run button */}
            <button className="btn btn-primary" onClick={startCompare} disabled={running} style={{ flexShrink: 0, height: 36 }}>
              {running ? <Loader size={14} className="spinner" /> : <Play size={14} />}
              {running ? 'Running…' : 'Compare'}
            </button>
          </div>
        </div>

        {/* Body */}
        {!run && !running && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--text3)' }}>
            <GitCompare size={48} style={{ opacity: 0.2 }} />
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text2)' }}>No comparison yet</div>
            <div style={{ fontSize: 12 }}>Enter your URLs above and click Compare</div>
          </div>
        )}

        {running && results.length === 0 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
            <Loader size={32} className="spinner" style={{ color: 'var(--accent)' }} />
            <div style={{ color: 'var(--text2)', fontWeight: 600 }}>Capturing screenshots…</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>This may take a minute depending on page count</div>
          </div>
        )}

        {(run || results.length > 0) && (
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '280px 1fr', overflow: 'hidden' }}>

            {/* Left panel — result list */}
            <div style={{ borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg2)' }}>
              {/* Stats bar */}
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: `All ${results.length}`, color: 'var(--text2)' },
                  { id: 'diff', label: `Diff ${diffCount}`, color: 'var(--red)' },
                  { id: 'match', label: `Match ${matchCount}`, color: 'var(--green)' },
                  { id: 'error', label: `Error ${errorCount}`, color: 'var(--yellow)' },
                ].map(f => (
                  <button key={f.id} onClick={() => setFilter(f.id)} style={{
                    padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                    background: filter === f.id ? 'rgba(227,83,54,0.15)' : 'transparent',
                    color: filter === f.id ? 'var(--accent2)' : f.color,
                    border: filter === f.id ? '1px solid rgba(227,83,54,0.3)' : '1px solid transparent',
                  }}>{f.label}</button>
                ))}
                {running && <Loader size={12} className="spinner" style={{ color: 'var(--accent)', marginLeft: 'auto', alignSelf: 'center' }} />}
              </div>

              {/* List */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {filtered.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>No results yet</div>
                ) : filtered.map((r, i) => (
                  <ResultCard key={i} result={r} active={selected === r} onClick={() => setSelected(r)} />
                ))}
              </div>
            </div>

            {/* Right panel — viewer */}
            <div style={{
              overflow: 'hidden', display: 'flex', flexDirection: 'column',
              ...(fullscreen ? { position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--bg)' } : {}),
            }}>
              {selected ? (
                <>
                  {/* Result header */}
                  <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{selected.name}</span>
                      <span style={{ color: 'var(--text3)', fontSize: 12, marginLeft: 8, fontFamily: 'JetBrains Mono' }}>{selected.viewport} · {selected.path}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {selected.error ? (
                        <span className="badge badge-fail"><AlertTriangle size={10} /> {selected.error.slice(0, 60)}</span>
                      ) : (
                        <>
                          <span className={`badge ${selected.passed ? 'badge-pass' : 'badge-fail'}`}>
                            {selected.passed ? <><Check size={10} /> Match</> : <><X size={10} /> Diff</>}
                          </span>
                          {selected.diffPercent !== undefined && (
                            <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono', color: 'var(--text3)' }}>Δ {selected.diffPercent.toFixed(3)}%</span>
                          )}
                        </>
                      )}
                      <button onClick={() => setFullscreen(v => !v)} className="btn btn-ghost btn-sm" title={fullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}>
                        {fullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                        {fullscreen ? 'Exit' : 'Fullscreen'}
                      </button>
                    </div>
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <SliderViewer
                      key={selected.stagingUrl + selected.productionUrl}
                      stagingUrl={selected.stagingUrl}
                      productionUrl={selected.productionUrl}
                      diffUrl={selected.diffUrl}
                    />
                  </div>
                </>
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', flexDirection: 'column', gap: 8 }}>
                  <SlidersHorizontal size={32} style={{ opacity: 0.2 }} />
                  <div style={{ fontSize: 12 }}>Select a result to view</div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
