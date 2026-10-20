import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const I = {
  home: <path d="M3 10l7-6 7 6v7H3z" />,
  search: <><circle cx="8.5" cy="8.5" r="5" /><path d="M12.5 12.5L17 17" /></>,
  cal: <><rect x="3" y="4" width="14" height="13" /><path d="M3 8h14M7 2v4M13 2v4" /></>,
  book: <path d="M4 3h8a4 4 0 0 1 4 4v10H8a4 4 0 0 1-4-4z" />,
  list: <path d="M4 5h12M4 10h12M4 15h12" />,
  user: <><circle cx="10" cy="7" r="3.5" /><path d="M3 17c1-4 4-5 7-5s6 1 7 5" /></>
};
const Icon = ({ d }) => <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">{I[d]}</svg>;

// Thumb-reach navigation on phones; hidden on wider screens by CSS
export default function BottomNav() {
  const { user } = useAuth();
  const items = [
    { to: '/', label: 'Browse', icon: 'home', end: true },
    { to: '/search', label: 'Search', icon: 'search' },
    { to: '/schedule', label: 'Schedule', icon: 'cal' },
    { to: '/manga', label: 'Manga', icon: 'book' },
    user ? { to: '/my-list', label: 'My List', icon: 'list' } : { to: '/login', label: 'Log in', icon: 'user' }
  ];
  return (
    <nav className="bnav" aria-label="Main (mobile)">
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} end={i.end}>
          <Icon d={i.icon} />
          <span>{i.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
