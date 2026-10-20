import { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Logo from './Logo.jsx';
import ThemeMenu from './ThemeMenu.jsx';
import Avatar from './Avatar.jsx';
import { OPEN_EVENT, isMac } from './CommandPalette.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [solid, setSolid] = useState(false);
  const bar = useRef(null);

  useEffect(() => {
    const onScroll = () => {
      setSolid(window.scrollY > 40);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (bar.current) bar.current.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Press "/" anywhere to jump to the search box
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      const input = document.querySelector('.search-bar input, .hero-search input');
      if (input) input.focus();
      else navigate('/search');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  return (
    <header className={`nav ${solid ? 'is-solid' : ''}`}>
      <Link to="/" className="brand" aria-label="AniTrack home">
        <Logo size={30} />
        <span className="brand-name">ANITRACK</span>
      </Link>
      <nav className="nav-links" aria-label="Main">
        <NavLink to="/" end className="nav-home">Browse</NavLink>
        <NavLink to="/search">Search</NavLink>
        <NavLink to="/schedule">Schedule</NavLink>
        <NavLink to="/manga">Manga</NavLink>
        {user && <NavLink to="/my-list">My List</NavLink>}
        <NavLink to="/guide">Guide</NavLink>
      </nav>
      <div className="nav-end">
        <button className="nav-k" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))} aria-label="Open search and shortcuts" title="Search and jump (Ctrl K)">
          <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M13 13l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          <kbd>{isMac ? '⌘ K' : 'Ctrl K'}</kbd>
        </button>
        <ThemeMenu />
        {user ? (
          <div className="nav-user">
            <Link to="/profile" className="nav-profile" title="Your profile">
              <Avatar user={user} size={34} />
              <span className="nav-name">{user.username}</span>
            </Link>
            <button className="nav-out" onClick={() => { logout(); navigate('/'); }}>Log out</button>
          </div>
        ) : (
          <Link to="/login" className="btn btn-line btn-sm">Log in</Link>
        )}
      </div>
      <span className="nav-progress" ref={bar} aria-hidden="true" />
    </header>
  );
}
