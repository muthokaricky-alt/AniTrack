import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { gsap, ScrollTrigger, prefersReducedMotion } from '../lib/gsap.js';

let instance = null;
export const getLenis = () => instance;

// One Lenis instance for the whole app, driven by GSAP's ticker so ScrollTrigger stays in sync.
export default function SmoothScroll() {
  const { pathname, key } = useLocation();
  const navType = useNavigationType();
  const positions = useRef({}); // scroll position per history entry, so Back returns you to where you were
  const currentKey = useRef(key);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const lenis = new Lenis({ lerp: 0.1 });
    instance = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    const tick = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      instance = null;
    };
  }, []);

  useEffect(() => {
    const onScroll = () => { positions.current[currentKey.current] = window.scrollY; };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    currentKey.current = key;
    const jump = (y) => (instance ? instance.scrollTo(y, { immediate: true }) : window.scrollTo(0, y));
    const saved = navType === 'POP' ? positions.current[key] : undefined;
    if (!saved) { jump(0); return undefined; }
    // the page is still filling in: keep trying for up to 2 seconds until it is tall enough
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (document.documentElement.scrollHeight >= saved + window.innerHeight || tries > 20) {
        jump(saved);
        clearInterval(timer);
      }
    }, 100);
    return () => clearInterval(timer);
  }, [pathname, key, navType]);

  return null;
}
