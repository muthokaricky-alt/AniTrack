import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { KINDS } from '../constants.js';

// "Can't decide?": shuffles through the Plan-to list and lands on one
export default function Roulette({ pool, kind, onStart }) {
  const cfg = KINDS[kind];
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(null);
  const [winner, setWinner] = useState(null);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  function spin() {
    if (pool.length === 0) return;
    clearTimeout(timer.current);
    setOpen(true);
    setWinner(null);
    const target = pool[Math.floor(Math.random() * pool.length)];
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const steps = reduced || pool.length === 1 ? 1 : 16 + Math.floor(Math.random() * 6);
    let n = 0;
    const tick = () => {
      n += 1;
      if (n >= steps) {
        setShown(target);
        setWinner(target);
        return;
      }
      setShown(pool[Math.floor(Math.random() * pool.length)]);
      timer.current = setTimeout(tick, 55 + n * n * 0.9); // slows down as it nears the end
    };
    tick();
  }

  if (pool.length === 0) return null;

  return (
    <>
      <button className="btn btn-line btn-sm" onClick={spin}>
        {open ? 'Spin again' : `Can't decide? (${pool.length})`}
      </button>
      {open && (
        <div className={`roulette ${winner ? 'is-done' : ''}`}>
          <div className="roulette-cover">
            {shown?.image_url && <img src={shown.image_url} alt="" />}
          </div>
          <div className="roulette-main">
            <p className="kicker">{winner ? 'Tonight it is' : 'Picking…'}</p>
            <p className="roulette-title">{shown?.title}</p>
            {winner && (
              <div className="roulette-actions">
                <Link className="btn btn-dark btn-sm" to={`${cfg.path}/${winner.mal_id}`}>Open</Link>
                <button
                  className="btn btn-dark btn-sm"
                  onClick={() => { onStart(winner); setOpen(false); }}
                >
                  Start {kind === 'manga' ? 'reading' : 'watching'}
                </button>
                <button className="btn btn-quiet btn-sm" onClick={() => setOpen(false)}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
