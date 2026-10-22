// A tiny "circuit breaker". After a few failures in a row it opens for a short while, so we stop asking a service that
// is clearly down (AniList can switch its API off for hours). Pages then fall back to the backup source straight away,
// and AniList isn't hammered while it recovers. After the pause one request is let through to check on it.
export function makeBreaker({ threshold = 3, pauseMs = 30000, now = () => Date.now() } = {}) {
  let failures = 0;
  let pausedUntil = 0;
  return {
    isOpen: () => now() < pausedUntil,
    success() {
      failures = 0;
      pausedUntil = 0;
    },
    failure() {
      failures += 1;
      if (failures >= threshold) pausedUntil = now() + pauseMs;
    }
  };
}
