import { useEffect, useState } from 'react';
import api from '../api/client';
import Sidebar from '../components/Sidebar';
import { Save, Monitor, Tablet, Smartphone, Settings2, Globe, Loader } from 'lucide-react';
import toast from 'react-hot-toast';

const VIEWPORT_ICONS = { desktop: Monitor, tablet: Tablet, mobile: Smartphone };

export default function ConfigPage() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchConfig = () => api.get('/config').then(r => { setConfig(r.data); setLoading(false); });

  useEffect(() => { fetchConfig(); }, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await api.put('/config', config);
      toast.success('Settings saved');
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div className="page-layout">
      <Sidebar />
      <main className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader size={24} className="spinner" style={{ color: 'var(--accent)' }} />
      </main>
    </div>
  );

  return (
    <div className="page-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1 className="page-title">Configuration</h1>
          <p className="page-subtitle">Manage test endpoints, viewports, and comparison settings</p>
        </div>

        <div className="page-body fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Thresholds */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Settings2 size={15} style={{ color: 'var(--accent)' }} />
                <span style={{ fontWeight: 700, fontSize: 14 }}>Comparison Thresholds</span>
              </div>
              <button className="btn btn-primary btn-sm" onClick={saveSettings} disabled={saving}>
                {saving ? <Loader size={12} className="spinner" /> : <Save size={12} />}
                Save Settings
              </button>
            </div>
            <div className="grid-2">
              <div className="field">
                <label className="label">Pixel Threshold (0–1)</label>
                <input className="input" type="number" step="0.01" min="0" max="1"
                  value={config.threshold}
                  onChange={e => setConfig(c => ({ ...c, threshold: parseFloat(e.target.value) }))} />
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Per-pixel color tolerance. 0 = exact match, 1 = ignore all color differences.</div>
              </div>
              <div className="field">
                <label className="label">Fail Threshold (% pixels)</label>
                <input className="input" type="number" step="0.001" min="0" max="1"
                  value={config.failThreshold}
                  onChange={e => setConfig(c => ({ ...c, failThreshold: parseFloat(e.target.value) }))} />
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Max % of pixels that can differ before the test fails. 0.01 = 1%.</div>
              </div>
            </div>
          </div>

          {/* Viewports */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Monitor size={15} style={{ color: 'var(--accent)' }} />
              <span style={{ fontWeight: 700, fontSize: 14 }}>Viewports</span>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {(config.viewports || []).map((vp, i) => {
                const Icon = VIEWPORT_ICONS[vp.name] || Globe;
                return (
                  <div key={i} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', minWidth: 160 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <Icon size={14} style={{ color: 'var(--accent2)' }} />
                      <span style={{ fontWeight: 700, fontSize: 13, textTransform: 'capitalize' }}>{vp.name}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                        <label className="label" style={{ fontSize: 9 }}>W (px)</label>
                        <input className="input" type="number" value={vp.width}
                          onChange={e => {
                            const viewports = [...config.viewports];
                            viewports[i] = { ...vp, width: parseInt(e.target.value) };
                            setConfig(c => ({ ...c, viewports }));
                          }} style={{ padding: '5px 8px', fontSize: 12 }} />
                      </div>
                      <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                        <label className="label" style={{ fontSize: 9 }}>H (px)</label>
                        <input className="input" type="number" value={vp.height}
                          onChange={e => {
                            const viewports = [...config.viewports];
                            viewports[i] = { ...vp, height: parseInt(e.target.value) };
                            setConfig(c => ({ ...c, viewports }));
                          }} style={{ padding: '5px 8px', fontSize: 12 }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-ghost btn-sm" onClick={saveSettings}>
                <Save size={11} /> Save Viewport Changes
              </button>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
