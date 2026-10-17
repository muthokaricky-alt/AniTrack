import { useRef } from 'react';
import { gsap, useGSAP } from '../lib/gsap.js';
import AnimeCard from './AnimeCard.jsx';

// Apple-style section: the page pins in place and vertical scrolling slides the posters sideways.
// Below 900px (or with reduced motion) it becomes a normal swipeable row.
export default function PinnedRail({ anime, season }) {
  const root = useRef(null);
  const track = useRef(null);
  const bar = useRef(null);
  const count = useRef(null);
  const total = anime.length;

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
        const dist = () => Math.max(0, track.current.scrollWidth - window.innerWidth);
        gsap.to(track.current, {
          x: () => -dist(),
          ease: 'none',
          scrollTrigger: {
            trigger: root.current,
            start: 'top top',
            end: () => `+=${dist()}`,
            pin: true,
            scrub: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              bar.current.style.transform = `scaleX(${self.progress})`;
              const n = Math.min(total, Math.round(self.progress * (total - 1)) + 1);
              count.current.textContent = String(n).padStart(2, '0');
            }
          }
        });
      });
    },
    { scope: root, dependencies: [total] }
  );

  return (
    <section className="rail" ref={root} aria-labelledby="rail-title">
      <div className="wrap rail-head">
        <div>
          <p className="kicker">Now airing · {season}</p>
          <h2 id="rail-title" className="h2">This season</h2>
        </div>
        <p className="rail-count" aria-hidden="true">
          <span ref={count}>01</span> / {String(total).padStart(2, '0')}
        </p>
      </div>
      <div className="rail-view">
        <div className="rail-track" ref={track}>
          {anime.map((a) => (
            <AnimeCard key={a.mal_id} anime={a} />
          ))}
        </div>
      </div>
      <div className="wrap">
        <div className="rail-line"><span ref={bar} /></div>
      </div>
    </section>
  );
}
