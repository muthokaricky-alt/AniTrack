// Shown while the API server is waking up (free hosting sleeps when it is quiet).
// The api client announces slow requests; this just listens.
import { useEffect, useState } from 'react';

export default function WakeBanner() {
  const [waking, setWaking] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const on = () => setWaking(true);
    const off = () => setWaking(false);
    window.addEventListener('anitrack:waking', on);
    window.addEventListener('anitrack:awake', off);
    return () => {
      window.removeEventListener('anitrack:waking', on);
      window.removeEventListener('anitrack:awake', off);
    };
  }, []);

  useEffect(() => {
    if (!waking) {
      setSeconds(0);
      return undefined;
    }
    const t = setInterval(() => setSeconds((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [waking]);

  if (!waking) return null;
  return (
    <div className="wake-banner" role="status" aria-live="polite">
      <span className="wake-dots" aria-hidden="true"><i /><i /><i /></span>
      <div>
        <strong>Waking up the server{seconds >= 4 ? ` · ${seconds}s` : ''}</strong>
        <p>The free host sleeps when it is quiet, so the first load can take up to a minute. Your data will appear as soon as it is ready.</p>
      </div>
    </div>
  );
}
