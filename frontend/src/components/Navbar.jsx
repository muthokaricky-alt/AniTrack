import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();

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
      </div>
    </nav>
  );
}
