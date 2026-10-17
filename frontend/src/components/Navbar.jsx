import { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Logo from './Logo.jsx';

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
      </nav>
      <div className="nav-end">
        {user ? (
          <button className="nav-user" onClick={() => { logout(); navigate('/'); }} title="Log out">
            <span className="nav-initial">{user.username.slice(0, 1).toUpperCase()}</span>
            <span className="nav-out">Log out</span>
          </button>
        ) : (
          <Link to="/login" className="btn btn-line btn-sm">Log in</Link>
        )}
      </div>
      <span className="nav-progress" ref={bar} aria-hidden="true" />
    </header>
  );
}
