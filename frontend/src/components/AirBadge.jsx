// " · Ep 8 in 2d 4h" at the end of a row's progress line
import { useEffect, useState } from 'react';
import { untilText } from '../lib/countdown.js';

export default function AirBadge({ item }) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 60000);
    return () => clearInterval(id);
  }, []);
  return <span className="meta-air"> · Ep {item.next_episode} {untilText(item.airing_at - now)}</span>;
}
