// A list row that can be swiped (right for +1, left for remove) when enabled; otherwise just a div.
import { useEffect, useRef } from 'react';
import { attachSwipe } from '../lib/swipe.js';

export default function SwipeRow({ enabled, onRight, onLeft, canRight, canLeft, children, ...rest }) {
  const ref = useRef(null);
  const handlers = useRef({});
  handlers.current = { onRight, onLeft, canRight, canLeft };
  useEffect(() => {
    if (!enabled || !ref.current) return undefined;
    return attachSwipe(ref.current, {
      onRight: () => handlers.current.onRight?.(),
      onLeft: () => handlers.current.onLeft?.(),
      canRight: () => (handlers.current.canRight ? handlers.current.canRight() : true),
      canLeft: () => (handlers.current.canLeft ? handlers.current.canLeft() : true)
    });
  }, [enabled]);
  return <div ref={ref} {...rest}>{children}</div>;
}
