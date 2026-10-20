import { useEffect } from 'react';
import { accentFrom } from './color.js';

// While a page is on screen, swap the site's accent colour for the given cover colour.
// The change is animated (see the @property rule in features.css) and undone when the page unmounts.
export function useAccent(color) {
  useEffect(() => {
    const a = accentFrom(color);
    if (!a) return undefined;
    const root = document.documentElement;
    root.style.setProperty('--signal', a.accent);
    root.style.setProperty('--signal-hot', a.hot);
    return () => {
      root.style.removeProperty('--signal');
      root.style.removeProperty('--signal-hot');
    };
  }, [color]);
}
