import { useRef } from 'react';
import { gsap, useGSAP } from '../lib/gsap.js';

// Pulls its child toward the cursor (the "Magnet" effect from React Bits, built on GSAP quickTo).
export default function Magnet({ children, strength = 0.35 }) {
  const ref = useRef(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
      const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3' });
      const move = (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * strength);
        yTo((e.clientY - (r.top + r.height / 2)) * strength);
      };
      const leave = () => {
        xTo(0);
        yTo(0);
      };
      el.addEventListener('mousemove', move);
      el.addEventListener('mouseleave', leave);
      return () => {
        el.removeEventListener('mousemove', move);
        el.removeEventListener('mouseleave', leave);
      };
    },
    { scope: ref }
  );

  return (
    <span ref={ref} className="magnet">
      {children}
    </span>
  );
}
