import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { LayoutDashboard, Settings, LogOut, GitCompare, Sun, Moon, Image } from 'lucide-react';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/compare', icon: GitCompare, label: 'Compare' },
  { to: '/baselines', icon: Image, label: 'Baselines' },
  { to: '/config', icon: Settings, label: 'Config' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <aside style={{
      width: 220, minWidth: 220, background: 'var(--bg2)',
      borderRight: '1px solid var(--border)', display: 'flex',
      flexDirection: 'column', height: '100vh', position: 'sticky', top: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, background: 'var(--accent)', borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <GitCompare size={16} color="white" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>VisualDiff</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'JetBrains Mono' }}>regression suite</div>
            </div>
          </div>
          {/* Theme toggle */}
          <button
            onClick={toggle}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              width: 30, height: 30, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', flexShrink: 0,
            }}
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px' }}>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
            borderRadius: 'var(--radius)', marginBottom: 2, fontSize: 13, fontWeight: 600,
            color: isActive ? 'var(--headline-color)' : 'var(--text3)',
            background: isActive ? 'var(--yellow-bg)' : 'transparent',
          })}>
            <Icon size={15} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div style={{ padding: '12px 10px', borderTop: '1px solid var(--border)' }}>
        <div style={{ padding: '10px', background: 'var(--bg3)', borderRadius: 'var(--radius)', marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{user?.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'JetBrains Mono', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
        </div>
        <button onClick={handleLogout} className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }}>
          <LogOut size={13} /> Logout
        </button>
      </div>
    </aside>
  );
}
