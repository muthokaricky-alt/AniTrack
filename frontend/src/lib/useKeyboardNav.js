import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { nextPagePath } from './pageOrder.js';

// Ctrl+Shift+Right / Left (Cmd on a Mac) flips between the main pages, in the order of the top bar.
export default function useKeyboardNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey || e.altKey) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const t = e.target;
      // while typing, this shortcut selects words, so leave it alone; and don't navigate behind an open dialog
      if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      navigate(nextPagePath(pathname, e.key === 'ArrowRight' ? 1 : -1, Boolean(user)));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pathname, user, navigate]);
}
