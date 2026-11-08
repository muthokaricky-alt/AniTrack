// Swiping a list row: right for "+1", left for "remove". Plain DOM so it can be tested in a real browser.

// Is this drag clearly sideways, so it should take over from scrolling?
export function isHorizontal(dx, dy, slop = 10) {
  return Math.abs(dx) > slop && Math.abs(dx) > Math.abs(dy) * 1.4;
}

// What a finished drag means: 'right', 'left' or null (too short, or too much up and down)
export function swipeAction(dx, dy, threshold = 80) {
  if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.5) return null;
  return dx > 0 ? 'right' : 'left';
}

const IGNORE = 'input, textarea, select';

// Adds the gesture to one element. canRight / canLeft say whether that direction does anything right now.
// Returns a function that removes everything again.
export function attachSwipe(el, { onRight, onLeft, canRight = () => true, canLeft = () => true, threshold = 80, max = 120 }) {
  let startX = 0;
  let startY = 0;
  let tracking = false;
  let dragging = false;

  const reset = () => {
    el.style.transform = '';
    el.classList.remove('swiping', 'swipe-right', 'swipe-left');
  };

  const onStart = (e) => {
    if (e.touches.length !== 1 || e.target.closest?.(IGNORE)) { tracking = false; return; }
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = true;
    dragging = false;
  };

  const onMove = (e) => {
    if (!tracking) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (!dragging) {
      if (isHorizontal(dx, dy)) dragging = true;
      else { if (Math.abs(dy) > 10) tracking = false; return; } // it is a scroll: leave it alone
    }
    if (e.cancelable) e.preventDefault();
    const allowed = dx > 0 ? canRight() : canLeft();
    // a direction that does nothing only wiggles a little
    const shown = allowed ? Math.max(-max, Math.min(max, dx)) : Math.max(-16, Math.min(16, dx * 0.2));
    el.style.transform = `translateX(${shown}px)`;
    el.classList.add('swiping');
    el.classList.toggle('swipe-right', allowed && dx > 0);
    el.classList.toggle('swipe-left', allowed && dx < 0);
  };

  const onEnd = (e) => {
    if (!tracking) return;
    tracking = false;
    const t = e.changedTouches[0];
    const action = dragging ? swipeAction(t.clientX - startX, t.clientY - startY, threshold) : null;
    dragging = false;
    reset();
    if (action === 'right' && canRight()) onRight?.();
    else if (action === 'left' && canLeft()) onLeft?.();
  };

  const onCancel = () => { tracking = false; dragging = false; reset(); };

  el.addEventListener('touchstart', onStart, { passive: true });
  el.addEventListener('touchmove', onMove, { passive: false });
  el.addEventListener('touchend', onEnd);
  el.addEventListener('touchcancel', onCancel);
  return () => {
    el.removeEventListener('touchstart', onStart);
    el.removeEventListener('touchmove', onMove);
    el.removeEventListener('touchend', onEnd);
    el.removeEventListener('touchcancel', onCancel);
    reset();
  };
}
