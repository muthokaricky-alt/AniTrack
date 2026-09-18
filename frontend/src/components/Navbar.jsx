import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function getInitialTheme() {
  const saved = localStorage.getItem('anitrack_theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('anitrack_theme', theme);
  }, [theme]);

  const isActive = (path) => (pathname === path ? 'active' : '');

  return (
    <nav className="navbar">
      <Link to="/" className="brand">
        <span className="brand-mark" />
        AniTrack
      </Link>
      <div className="nav-links">
        <Link to="/" className={isActive('/')}>Browse</Link>
        <Link to="/search" className={isActive('/search')}>Search</Link>
        {user && <Link to="/my-list" className={isActive('/my-list')}>My List</Link>}
        {user ? (
          <button className="nav-user-btn" onClick={() => { logout(); navigate('/'); }}>
            {user.username} · Log out
          </button>
        ) : (
          <Link to="/login" className="nav-user-btn" style={{ display: 'inline-block' }}>Log in</Link>
        )}
        <button
          className="theme-toggle"
          onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </nav>
  );
}