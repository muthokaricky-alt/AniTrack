import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { gsap, prefersReducedMotion } from '../lib/gsap.js';
import CountUp from './CountUp.jsx';

const R = 74;
const CIRC = 2 * Math.PI * R;

function verdict(p) {
  if (p >= 85) return 'Practically the same taste';
  if (p >= 70) return 'A strong match';
  if (p >= 50) return 'Plenty in common';
  if (p >= 30) return 'Different shelves, some overlap';
  return 'Nearly opposite tastes';
}

const PART_LABEL = { genres: 'Genres you lean towards', scores: 'How you rate shared titles', overlap: 'Titles you both have' };

// Compares the logged-in visitor with the profile they are looking at
export default function TasteMatch({ username, viewer }) {
  const [state, setState] = useState({ loading: true });
  const ring = useRef(null);

  useEffect(() => {
    if (!viewer) return undefined;
    let off = false;
    setState({ loading: true });
    api.tasteMatch(username)
      .then((res) => !off && setState({ data: res }))
      .catch((e) => !off && setState({ error: e.message }));
    return () => { off = true; };
  }, [username, viewer]);

  useEffect(() => {
    const el = ring.current;
    if (!el || !state.data) return;
    const target = CIRC * (1 - state.data.percent / 100);
    if (prefersReducedMotion()) {
      el.style.strokeDashoffset = target;
      return;
    }
    gsap.fromTo(el, { strokeDashoffset: CIRC }, { strokeDashoffset: target, duration: 1.4, ease: 'power3.out', delay: 0.15 });
  }, [state.data]);

  if (!viewer) {
    return (
      <section className="tm tm-quiet">
        <h2 className="tm-title">Taste match</h2>
        <p className="muted"><Link to="/login">Log in</Link> to see how your taste compares with {username}.</p>
      </section>
    );
  }
  if (state.loading) return <section className="tm tm-quiet" aria-busy="true"><h2 className="tm-title">Taste match</h2><p className="muted">Comparing your lists…</p></section>;
  if (state.error) return <section className="tm tm-quiet"><h2 className="tm-title">Taste match</h2><p className="muted">{state.error}</p></section>;

  const d = state.data;
  return (
    <section className="tm" aria-labelledby="tm-title">
      <h2 id="tm-title" className="tm-title">Taste match with you</h2>
      <div className="tm-grid">
        <div className="tm-ring">
          <svg viewBox="0 0 180 180" role="img" aria-label={`${d.percent} percent match`}>
            <circle cx="90" cy="90" r={R} className="tm-track" />
            <circle ref={ring} cx="90" cy="90" r={R} className="tm-arc" strokeDasharray={CIRC} strokeDashoffset={CIRC} transform="rotate(-90 90 90)" />
          </svg>
          <p className="tm-pct"><CountUp value={d.percent} decimals={0} /><small>%</small></p>
        </div>

        <div className="tm-body">
          <p className="tm-verdict">{verdict(d.percent)}</p>
          <ul className="tm-parts">
            {Object.entries(d.parts).map(([k, v]) => (
              <li key={k}>
                <span>{PART_LABEL[k]}</span>
                <div className="tm-bar"><i style={{ width: `${v ?? 0}%` }} /></div>
                <b>{v == null ? 'Not enough data' : `${v}%`}</b>
              </li>
            ))}
          </ul>
          <p className="muted tm-note">
            {d.shared_count} title{d.shared_count === 1 ? '' : 's'} in common{d.mean_diff != null ? `, rated ${d.mean_diff} points apart on average` : ''}.
          </p>
          {d.common_genres.length > 0 && (
            <p className="tm-genres">{d.common_genres.map((g) => <span key={g} className="chip">{g}</span>)}</p>
          )}
        </div>
      </div>

      {d.both_loved.length > 0 && (
        <div className="tm-block">
          <h3 className="mini-h">You both rated these highly</h3>
          <ul className="tm-titles">
            {d.both_loved.map((t) => <TitleRow key={`${t.kind}${t.mal_id}`} t={t} />)}
          </ul>
        </div>
      )}
      {d.disagree.length > 0 && (
        <div className="tm-block">
          <h3 className="mini-h">You see these differently</h3>
          <ul className="tm-titles">
            {d.disagree.map((t) => <TitleRow key={`${t.kind}${t.mal_id}`} t={t} />)}
          </ul>
        </div>
      )}
      <p className="muted tm-foot">The match blends genres, ratings on shared titles and how many titles you share. It is a fun guide, not science.</p>
    </section>
  );
}

function TitleRow({ t }) {
  return (
    <li>
      <Link to={`/${t.kind}/${t.mal_id}`}>
        {t.image_url ? <img src={t.image_url} alt="" loading="lazy" /> : <span className="tm-noimg" />}
        <span className="tm-t">{t.title}</span>
        <span className="tm-s">you {t.you} · them {t.them}</span>
      </Link>
    </li>
  );
}
