import { useLayoutEffect, useRef } from 'react';
import { gsap, ScrollTrigger, prefersReducedMotion } from '../lib/gsap.js';

// A number that counts up from zero the first time it scrolls into view. Later changes count from the old value.
// Without JavaScript or with reduced motion it just shows the final number.
export default function CountUp({ value, decimals, className }) {
  const ref = useRef(null);
  const played = useRef(false);
  const shown = useRef(0);
  const num = Number(value);
  const ok = value !== null && value !== undefined && value !== '' && Number.isFinite(num);
  const places = decimals ?? (String(value).split('.')[1] || '').length;
  const fmt = (n) => n.toFixed(places);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !ok) return undefined;
    if (prefersReducedMotion()) {
      el.textContent = fmt(num);
      return undefined;
    }
    const state = { v: played.current ? shown.current : 0 };
    el.textContent = fmt(state.v);
    const run = () => {
      played.current = true;
      gsap.to(state, {
        v: num,
        duration: 1.3,
        ease: 'power3.out',
        onUpdate: () => {
          shown.current = state.v;
          el.textContent = fmt(state.v);
        },
        onComplete: () => {
          shown.current = num;
          el.textContent = fmt(num);
        }
      });
    };
    if (played.current) {
      run();
      return () => gsap.killTweensOf(state);
    }
    const trigger = ScrollTrigger.create({ trigger: el, start: 'top 98%', once: true, onEnter: run });
    return () => {
      trigger.kill();
      gsap.killTweensOf(state);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [num, ok, places]);

  return <span ref={ref} className={className}>{ok ? fmt(num) : value ?? '—'}</span>;
}
