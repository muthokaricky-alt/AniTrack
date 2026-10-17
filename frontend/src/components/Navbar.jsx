import { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function getInitialTheme() {
  const saved = localStorage.getItem('anitrack_theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

const Sun = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
const Moon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('anitrack_theme', theme);
  }, [theme]);

  return (
    <nav className="navbar">
      <Link to="/" className="brand">
        <span className="brand-mark">A</span>
        <span className="brand-name">AniTrack</span>
      </Link>
      <div className="nav-links">
        <NavLink to="/" end>Browse</NavLink>
        <NavLink to="/search">Search</NavLink>
        {user && <NavLink to="/my-list">My List</NavLink>}
      </div>
      <div className="nav-actions">
        {user ? (
          <button className="btn btn-ghost" onClick={() => { logout(); navigate('/'); }} title="Log out">
            <span className="avatar">{user.username.slice(0, 1).toUpperCase()}</span>
            <span className="hide-sm">Log out</span>
          </button>
        ) : (
          <Link to="/login" className="btn btn-primary btn-sm">Log in</Link>
        )}
        <button
          className="icon-btn"
          onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun /> : <Moon />}
        </button>
      </div>
    </nav>
  );
}
