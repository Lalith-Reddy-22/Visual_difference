import { useEffect, useState } from 'react';
import api from '../api/client';
import Sidebar from '../components/Sidebar';
import { Image, Monitor, Tablet, Smartphone, Loader, RefreshCw, X, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const BASE = '';
const VP_ICONS = { desktop: Monitor, tablet: Tablet, mobile: Smartphone };

function BaselineModal({ baseline, onClose, onDelete }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete baseline "${baseline.page_name} / ${baseline.viewport}"?`)) return;
    setDeleting(true);
    try {
      await api.delete(`/snapshots/baselines/${baseline.id}`);
      toast.success('Baseline deleted');
      onDelete(baseline.id);
      onClose();
    } catch { toast.error('Failed to delete'); }
    finally { setDeleting(false); }
  };
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} className="fade-in" style={{
        background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16,
        maxWidth: 900, width: '100%', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontWeight: 700 }}>{baseline.page_name}</span>
            <span style={{ color: 'var(--text3)', marginLeft: 8, fontSize: 12 }}>/ {baseline.viewport}</span>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm"><X size={12} /></button>
          <button onClick={handleDelete} disabled={deleting} className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }}>
            {deleting ? <Loader size={12} className="spinner" /> : <Trash2 size={12} />} Delete
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 20, background: 'var(--bg)', display: 'flex', justifyContent: 'center' }}>
          <img src={`${BASE}${baseline.url_path}`} alt={baseline.page_name} style={{ maxWidth: '100%', height: 'auto', borderRadius: 8, border: '1px solid var(--border)' }} />
        </div>
      </div>
    </div>
  );
}

export default function BaselinesPage() {
  const [baselines, setBaselines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [vpFilter, setVpFilter] = useState('all');

  const handleDelete = (id) => setBaselines(prev => prev.filter(b => b.id !== id));
  const fetch = () => api.get('/snapshots/baselines').then(r => { setBaselines(r.data); setLoading(false); }).catch(() => setLoading(false));

  useEffect(() => { fetch(); }, []);

  const vpOptions = ['all', ...new Set(baselines.map(b => b.viewport))];
  const filtered = vpFilter === 'all' ? baselines : baselines.filter(b => b.viewport === vpFilter);

  // Group by name
  const grouped = filtered.reduce((acc, b) => {
    const key = b.page_name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(b);
    return acc;
  }, {});

  return (
    <div className="page-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 className="page-title">Baselines</h1>
              <p className="page-subtitle">Reference screenshots used for comparison</p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={fetch}>
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
        </div>

        <div className="page-body fade-in">
          {/* Viewport filter */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
            {vpOptions.map(vp => (
              <button key={vp} onClick={() => setVpFilter(vp)} style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: vpFilter === vp ? 'var(--accent)' : 'var(--bg3)',
                color: vpFilter === vp ? 'white' : 'var(--text2)',
                border: vpFilter === vp ? 'none' : '1px solid var(--border)',
                textTransform: 'capitalize',
              }}>{vp}</button>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
              <Loader size={22} className="spinner" style={{ display: 'block', margin: '0 auto 10px', color: 'var(--accent)' }} />
              Loading baselines…
            </div>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 56 }}>
              <Image size={36} style={{ color: 'var(--text3)', margin: '0 auto 12px', display: 'block' }} />
              <div style={{ fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>No baselines yet</div>
              <div style={{ color: 'var(--text3)', fontSize: 12, fontFamily: 'JetBrains Mono' }}>Approve a snapshot from a run to set it as a baseline</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {Object.entries(grouped).map(([name, items]) => (
                <div key={name}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text2)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{name}</span>
                    <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'JetBrains Mono' }}>{items.length} viewport{items.length > 1 ? 's' : ''}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                    {items.map(b => {
                      const Icon = VP_ICONS[b.viewport] || Monitor;
                      return (
                        <div key={b.id} onClick={() => setSelected(b)} style={{ cursor: 'pointer' }}
                          className="card" onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border2)'}
                          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                          style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)', transition: 'border 0.15s', cursor: 'pointer', borderRadius: 'var(--radius2)', background: 'var(--bg2)' }}>
                          <div style={{ height: 130, background: 'var(--bg)', overflow: 'hidden', position: 'relative' }}>
                            <img src={`${BASE}${b.url_path}`} alt={b.page_name} style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'top' }} />
                          </div>
                          <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Icon size={12} style={{ color: 'var(--text3)', flexShrink: 0 }} />
                            <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600, textTransform: 'capitalize' }}>{b.viewport}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {selected && <BaselineModal baseline={selected} onClose={() => setSelected(null)} onDelete={handleDelete} />}
    </div>
  );
}
