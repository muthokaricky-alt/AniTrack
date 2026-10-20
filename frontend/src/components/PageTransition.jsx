import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { gsap, ScrollTrigger, prefersReducedMotion } from '../lib/gsap.js';

const BARS = 6;

/*
 * A curtain of coloured bars that sweeps up over the page when you click an internal link, then lifts off the new page.
 * Links are caught in one place (a capture-phase click listener), so no link in the app needs to change.
 * Back/forward buttons, keyboard shortcuts and code-driven navigation skip the curtain on purpose.
 */
export default function PageTransition() {
  const root = useRef(null);
  const navigate = useNavigate();
  const { key } = useLocation();
  const s = useRef({ busy: false, covered: false, timers: [] });

  const bars = () => root.current?.querySelectorAll('i') || [];

  function reveal() {
    const st = s.current;
    st.timers.forEach(clearTimeout);
    st.timers = [];
    gsap.set(bars(), { transformOrigin: '50% 0%' });
    gsap.to(bars(), {
      scaleY: 0,
      duration: 0.55,
      ease: 'power3.inOut',
      stagger: 0.05,
      onComplete: () => {
        if (root.current) root.current.style.pointerEvents = 'none';
        st.covered = false;
        st.busy = false;
        ScrollTrigger.refresh();
      }
    });
  }

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const st = s.current;

    const cover = () =>
      new Promise((resolve) => {
        st.busy = true;
        st.covered = true;
        root.current.style.pointerEvents = 'auto';
        gsap.killTweensOf(bars());
        gsap.set(bars(), { transformOrigin: '50% 100%' });
        gsap.fromTo(bars(), { scaleY: 0 }, { scaleY: 1, duration: 0.42, ease: 'power3.inOut', stagger: 0.05, onComplete: resolve });
      });

    const onClick = (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
      if (!a || a.target === '_blank' || a.hasAttribute('download') || a.hasAttribute('data-no-transition')) return;
      // a button or field inside a link (like a card's quick-add) keeps its own behaviour
      const inner = e.target.closest('button, input, select, textarea');
      if (inner && a.contains(inner)) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const here = window.location;
      if (url.pathname === here.pathname && url.search === here.search) return; // same page, or just a #hash

      e.preventDefault();
      e.stopPropagation();
      if (st.busy) return;
      const base = import.meta.env.BASE_URL.replace(/\/$/, '');
      const to = (base && url.pathname.startsWith(base) ? url.pathname.slice(base.length) || '/' : url.pathname) + url.search + url.hash;
      cover().then(() => {
        navigate(to);
        // if the route never changes (blocked or failed), don't leave the curtain down
        st.timers.push(setTimeout(reveal, 1800));
      });
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  // The new route has mounted underneath: give it a moment to paint, then lift the curtain
  useEffect(() => {
    const st = s.current;
    if (!st.covered) return undefined;
    st.timers.forEach(clearTimeout);
    st.timers = [setTimeout(reveal, 160)];
    return () => st.timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div className="curtain" ref={root} aria-hidden="true">
      {Array.from({ length: BARS }, (_, i) => <i key={i} />)}
    </div>
  );
}
