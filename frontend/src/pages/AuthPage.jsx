import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { GitCompare, Eye, EyeOff } from 'lucide-react';

const validateEmail = email => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
const validatePassword = pw => ({
  length: pw.length >= 8,
  upper:  /[A-Z]/.test(pw),
  lower:  /[a-z]/.test(pw),
  number: /[0-9]/.test(pw),
});

export default function AuthPage() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const pwChecks = validatePassword(form.password);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!validateEmail(form.email)) return toast.error('Enter a valid email address');
    if (mode === 'register') {
      if (!form.name.trim()) return toast.error('Name is required');
      if (!pwChecks.length) return toast.error('Password must be at least 8 characters');
      if (!pwChecks.upper)  return toast.error('Password must contain an uppercase letter');
      if (!pwChecks.lower)  return toast.error('Password must contain a lowercase letter');
      if (!pwChecks.number) return toast.error('Password must contain a number');
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        await register(form.name, form.email, form.password);
      }
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
      backgroundImage: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(108,99,255,0.12) 0%, transparent 70%)',
    }}>
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
        backgroundSize: '40px 40px', opacity: 0.3,
      }} />

      <div className="fade-in" style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 380, padding: 16 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, background: 'var(--accent)', borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
            boxShadow: '0 0 40px rgba(108,99,255,0.4)',
          }}>
            <GitCompare size={22} color="white" />
          </div>
          <h1 style={{ fontWeight: 800, fontSize: 24, color: 'var(--text)', fontFamily: 'Syne' }}>VisualDiff</h1>
          <p style={{ color: 'var(--text3)', fontSize: 12, marginTop: 4, fontFamily: 'JetBrains Mono' }}>visual regression testing</p>
        </div>

        <div className="card" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', background: 'var(--bg3)', borderRadius: 8, padding: 3, marginBottom: 24 }}>
            {['login', 'register'].map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                flex: 1, padding: '7px 0', borderRadius: 6, fontSize: 13, fontWeight: 600,
                background: mode === m ? 'var(--bg2)' : 'transparent',
                color: mode === m ? 'var(--text)' : 'var(--text3)',
                border: mode === m ? '1px solid var(--border)' : 'none',
                textTransform: 'capitalize',
              }}>
                {m}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {mode === 'register' && (
              <div className="field">
                <label className="label">Name</label>
                <input className="input" placeholder="Jane Smith" value={form.name} onChange={set('name')} />
              </div>
            )}
            <div className="field">
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                placeholder="you@company.com"
                value={form.email}
                onChange={set('email')}
                required
              />
            </div>
            <div className="field" style={{ marginBottom: mode === 'register' ? 8 : 24 }}>
              <label className="label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={set('password')}
                  required
                  style={{ paddingRight: 40 }}
                />
                <button type="button" onClick={() => setShowPass(p => !p)} style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', color: 'var(--text3)', display: 'flex',
                }}>
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {mode === 'register' && form.password && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
                {[['8+ chars', pwChecks.length], ['Uppercase', pwChecks.upper], ['Lowercase', pwChecks.lower], ['Number', pwChecks.number]].map(([label, ok]) => (
                  <span key={label} style={{
                    fontSize: 10, fontFamily: 'JetBrains Mono', padding: '2px 7px', borderRadius: 4,
                    background: ok ? 'var(--green-bg)' : 'var(--red-bg)',
                    color: ok ? 'var(--green)' : 'var(--red)',
                  }}>
                    {ok ? '✓' : '✗'} {label}
                  </span>
                ))}
              </div>
            )}

            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', height: 40 }}>
              {loading
                ? <span className="spinner" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' }} />
                : (mode === 'login' ? 'Sign In' : 'Create Account')}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 11, marginTop: 20, fontFamily: 'JetBrains Mono' }}>
          Visual Regression Testing Platform
        </p>
      </div>
    </div>
  );
}
