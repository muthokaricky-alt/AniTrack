import { useLocation, useNavigate } from 'react-router-dom';

// A back arrow for the top bar, so people can go back a step on a phone (an installed app has no browser Back button) or
// on a computer. On a page you reached from inside AniTrack it goes back one step, exactly like the browser's Back.
// A page opened directly (a shared link, or the installed app's first screen) has nothing behind it inside AniTrack, so
// there the arrow takes you to the home page instead. It is hidden on the home page itself.
export default function BackButton() {
  const { pathname, key } = useLocation();
  const navigate = useNavigate();
  if (pathname === '/') return null;

  // React Router gives the first page of a visit the key 'default'; every page reached by navigating has its own key
  const hasHistory = key !== 'default';
  return (
    <button
      type="button"
      className="nav-back"
      aria-label={hasHistory ? 'Go back' : 'Go to the home page'}
      title={hasHistory ? 'Back' : 'Home'}
      onClick={() => (hasHistory ? navigate(-1) : navigate('/'))}
    >
      <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
        <path d="M16 10H4M9 5l-5 5 5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
