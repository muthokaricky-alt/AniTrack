import { useEffect, useRef } from 'react';

// Interactive 3D dot field behind the hero. Lazy-loaded, desktop only, skipped for reduced motion.
// If WebGL is unavailable the CSS halftone underneath stays visible.
export default function VantaDots() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    const skip =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      window.matchMedia('(max-width: 899px)').matches;
    if (!el || skip) return;

    let effect;
    let cancelled = false;
    (async () => {
      try {
        const [THREE, dots] = await Promise.all([import('three'), import('vanta/dist/vanta.dots.min')]);
        if (cancelled) return;
        // Vanta's DOTS effect looks for a global THREE and ignores the option, so provide both
        window.THREE = THREE;
        const DOTS = dots.default || dots;
        effect = DOTS({
          el,
          THREE,
          mouseControls: true,
          touchControls: false,
          gyroControls: false,
          minHeight: 200,
          minWidth: 200,
          scale: 1,
          color: 0xff4b1f,
          color2: 0xff4b1f,
          backgroundColor: 0x0a0a0a,
          size: 3.6,
          spacing: 44,
          showLines: false
        });
        if (!el.querySelector('canvas')) {
          console.warn('Vanta started but drew no canvas; keeping the CSS dot pattern.');
          try {
            effect.destroy();
          } catch {
            /* ignore */
          }
          effect = undefined;
          el.style.background = 'transparent';
        }
      } catch (err) {
        console.warn('Vanta background unavailable:', err);
      }
    })();

    return () => {
      cancelled = true;
      // destroy() throws if Vanta failed to start (its canvas was never attached); that must not crash React
      try {
        effect?.destroy();
      } catch {
        /* nothing to clean up */
      }
    };
  }, []);

  return <div ref={ref} className="vanta" aria-hidden="true" />;
}
