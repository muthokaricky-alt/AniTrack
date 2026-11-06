// Helpers for talking to a server that may be asleep (free hosting spins down when idle,
// and the first request after that takes up to about a minute).
export const SLOW_MS = 3500; // a request slower than this is probably waiting on a sleeping server
export const RETRY_DELAYS = [2000, 4000, 8000, 12000, 15000]; // about 40 seconds of patience in total

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Only reads are retried. Retrying a write could do it twice.
export function isRead(options = {}) {
  return !options.method || String(options.method).toUpperCase() === 'GET';
}

// A 502/503/504 that is NOT one of our own JSON errors came from the host's proxy,
// which means the app is not up yet. Our own 502s (upstream catalogue down) carry an error message.
export function looksAsleep(status, data) {
  return [502, 503, 504].includes(status) && !(data && typeof data.error === 'string');
}

// Calls emit('anitrack:waking') once any request has been slow, and emit('anitrack:awake') when none are.
export function createWakeTracker(emit, slowMs = SLOW_MS) {
  let slow = 0;
  return function track() {
    let flagged = false;
    const timer = setTimeout(() => {
      flagged = true;
      slow += 1;
      if (slow === 1) emit('anitrack:waking');
    }, slowMs);
    return () => {
      clearTimeout(timer);
      if (flagged) {
        slow -= 1;
        if (slow === 0) emit('anitrack:awake');
      }
    };
  };
}
