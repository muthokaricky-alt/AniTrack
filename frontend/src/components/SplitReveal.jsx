import { useRef } from 'react';
import { gsap, useGSAP } from '../lib/gsap.js';

// Letters rise out of a mask one after another (same idea as React Bits' SplitText, built on GSAP).
export default function SplitReveal({ text, className = '', delay = 0, stagger = 0.04 }) {
  const ref = useRef(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          ref.current.querySelectorAll('.sr-char'),
          { yPercent: 115, rotate: 5 },
          { yPercent: 0, rotate: 0, duration: 1, ease: 'expo.out', stagger, delay }
        );
      });
    },
    { scope: ref, dependencies: [text] }
  );

  return (
    <span ref={ref} className={`sr ${className}`} aria-label={text}>
      {text.split(' ').map((word, wi, words) => (
        <span className="sr-word" key={wi} aria-hidden="true">
          {[...word].map((c, ci) => (
            <span className="sr-mask" key={ci}>
              <span className="sr-char">{c}</span>
            </span>
          ))}
          {wi < words.length - 1 ? ' ' : null}
        </span>
      ))}
    </span>
  );
}
