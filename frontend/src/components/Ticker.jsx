import { useRef } from 'react';
import { gsap, useGSAP, prefersReducedMotion } from '../lib/gsap.js';
import { getLenis } from './SmoothScroll.jsx';

// Marquee of airing titles. Scrolling the page speeds it up and flips its direction.
export default function Ticker({ items }) {
  const track = useRef(null);
  const reduced = prefersReducedMotion();
  // repeat so one "set" always overflows the viewport, then render two sets for the seamless loop
  const set = items.length >= 8 ? items : [...items, ...items, ...items];

  useGSAP(
    () => {
      const el = track.current;
      if (!el || reduced) return;
      let x = 0;
      let dir = -1;
      const tick = () => {
        const half = el.scrollWidth / 2;
        if (!half) return;
        const v = getLenis()?.velocity ?? 0;
        if (v > 0.4) dir = -1;
        else if (v < -0.4) dir = 1;
        x += dir * (0.7 + Math.min(Math.abs(v) * 0.45, 16)) * gsap.ticker.deltaRatio();
        if (x <= -half) x += half;
        if (x > 0) x -= half;
        gsap.set(el, { x });
      };
      gsap.ticker.add(tick);
      return () => gsap.ticker.remove(tick);
    },
    { scope: track }
  );

  const row = (hidden) =>
    set.map((t, i) => (
      <span className="ticker-item" key={`${hidden ? 'b' : 'a'}${i}`} aria-hidden={hidden || undefined}>
        {t}
        <i>/</i>
      </span>
    ));

  return (
    <div className="ticker" aria-label="Currently airing">
      <div className="ticker-track" ref={track}>
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
