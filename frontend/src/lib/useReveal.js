import { gsap, ScrollTrigger, useGSAP } from './gsap.js';

// Fades and lifts every matching element into place as it scrolls into view, in staggered batches.
export function useReveal(scopeRef, selector, deps = []) {
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const els = scopeRef.current?.querySelectorAll(selector);
        if (!els || !els.length) return;
        gsap.set(els, { opacity: 0, y: 44 });
        ScrollTrigger.batch(els, {
          start: 'top 90%',
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08, overwrite: true })
        });
      });
    },
    { scope: scopeRef, dependencies: deps }
  );
}
