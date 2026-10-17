import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useList } from '../context/ListContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useReveal } from '../lib/useReveal.js';
import { ScrollTrigger } from '../lib/gsap.js';
import { getLenis } from '../components/SmoothScroll.jsx';
import AnimeCard from '../components/AnimeCard.jsx';
import SkeletonGrid from '../components/SkeletonGrid.jsx';
import VantaDots from '../components/VantaDots.jsx';
import SplitReveal from '../components/SplitReveal.jsx';
import Ticker from '../components/Ticker.jsx';
import Spotlight from '../components/Spotlight.jsx';
import PinnedRail from '../components/PinnedRail.jsx';
import Magnet from '../components/Magnet.jsx';

function seasonLabel() {
  const d = new Date();
  const m = d.getMonth() + 1;
  const name = m <= 3 ? 'Winter' : m <= 6 ? 'Spring' : m <= 9 ? 'Summer' : 'Fall';
  return `${name} ${d.getFullYear()}`;
}

function TopTen({ anime }) {
  const root = useRef(null);
  useReveal(root, '.t10-item', [anime.length]);
  return (
    <section className="top10" ref={root} aria-labelledby="top-title">
      <div className="wrap">
        <p className="kicker">All-time ranking</p>
        <h2 id="top-title" className="h2">Top ten</h2>
        <div className="t10-grid">
          {anime.map((a, i) => (
            <div className="t10-item" key={a.mal_id}>
              <AnimeCard anime={a} rank={i + 1} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const root = useRef(null);
  useReveal(root, '.step', []);
  const steps = [
    ['01', 'Search', 'Every title in the AniList catalogue, with covers, genres and synopses.'],
    ['02', 'Log', 'Set a status and bump episodes as you go. Your list remembers where you stopped.'],
    ['03', 'Rate', 'Score from one to ten. Your mean score and episode count update on their own.']
  ];
  return (
    <section className="paper" ref={root}>
      <div className="wrap">
        <p className="kicker">How it works</p>
        <h2 className="h2 h2-xl">Three moves.</h2>
        <div className="steps">
          {steps.map(([n, t, body]) => (
            <div className="step" key={n}>
              <span className="step-n">{n}</span>
              <h3>{t}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ContinueWatching({ entries }) {
  const root = useRef(null);
  const { updateEntry } = useList();
  const toast = useToast();
  useReveal(root, '.cw-row', [entries.length]);
  return (
    <section className="paper" ref={root}>
      <div className="wrap">
        <p className="kicker">Your list</p>
        <h2 className="h2 h2-xl">Continue watching.</h2>
        <div className="cw">
          {entries.slice(0, 5).map((e) => {
            const total = e.total_episodes;
            const next = (e.episodes_watched || 0) + 1;
            return (
              <div className="cw-row" key={e.id}>
                <Link to={`/anime/${e.mal_id}`} className="cw-cover">
                  {e.image_url && <img src={e.image_url} alt="" loading="lazy" />}
                </Link>
                <div className="cw-main">
                  <Link to={`/anime/${e.mal_id}`}><h3>{e.title}</h3></Link>
                  <p>EP {e.episodes_watched || 0}{total ? ` / ${total}` : ''}</p>
                </div>
                <button
                  className="btn btn-dark btn-sm"
                  disabled={total ? next > total : false}
                  onClick={() => updateEntry(e.id, { episodes_watched: next }).catch((err) => toast(err.message, 'error'))}
                >
                  + Ep {next}
                </button>
              </div>
            );
          })}
        </div>
        <Link to="/my-list" className="text-link">Open full list →</Link>
      </div>
    </section>
  );
}

export default function Home() {
  const { user } = useAuth();
  const { entries } = useList();
  const navigate = useNavigate();
  const [top, setTop] = useState([]);
  const [seasonal, setSeasonal] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const season = useMemo(seasonLabel, []);
  const featured = useMemo(() => seasonal.filter((a) => a.banner).slice(0, 4), [seasonal]);
  const watching = useMemo(() => entries.filter((e) => e.status === 'watching'), [entries]);

  function load() {
    setLoading(true);
    setError('');
    Promise.all([api.topAnime(), api.seasonalAnime()])
      .then(([t, s]) => {
        setTop(t.data || []);
        setSeasonal(s.data || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  // Sections below the pinned rail were measured before async content settled, so re-measure
  useEffect(() => {
    const id = setTimeout(() => ScrollTrigger.refresh(), 150);
    return () => clearTimeout(id);
  }, [loading, seasonal.length, featured.length, top.length, watching.length, user]);

  function onSearch(e) {
    e.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  function scrollDown() {
    const target = document.querySelector('.ticker, .rail');
    const lenis = getLenis();
    if (lenis && target) lenis.scrollTo(target, { offset: -40 });
    else target?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <>
      <section className="hero">
        <VantaDots />
        <div className="hero-shade" />
        <div className="wrap hero-inner">
          <p className="kicker hero-kicker"><i className="pulse" />{season} · now tracking</p>
          <h1 className="hero-title">
            <SplitReveal text="WATCH." className="hero-line" delay={0.1} />
            <SplitReveal text="LOG." className="hero-line" delay={0.3} />
            <SplitReveal text="RATE." className="hero-line hero-line-accent" delay={0.5} />
          </h1>
          <div className="hero-foot">
            <p className="hero-copy">A watchlist for people who actually finish series.</p>
            <form className="hero-search" onSubmit={onSearch}>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a title" aria-label="Search anime" />
              <button type="submit" className="btn btn-signal">Search</button>
            </form>
            <button className="scroll-cue" onClick={scrollDown} aria-label="Scroll to this season">
              Scroll<span />
            </button>
          </div>
        </div>
      </section>

      {seasonal.length > 0 && <Ticker items={seasonal.map((a) => a.title)} />}

      {featured.length > 0 && <Spotlight items={featured} />}

      {loading && <div className="wrap section-pad"><SkeletonGrid count={10} /></div>}
      {!loading && error && (
        <div className="wrap section-pad">
          <div className="empty-state">
            <p>{error}</p>
            <button className="btn btn-line" onClick={load}>Try again</button>
          </div>
        </div>
      )}

      {seasonal.length >= 4 && <PinnedRail anime={seasonal.slice(0, 12)} season={season} />}
      {user && watching.length > 0 ? <ContinueWatching entries={watching} /> : !loading && <HowItWorks />}
      {top.length >= 4 && <TopTen anime={top.slice(0, 10)} />}

      {!user && (
        <section className="final-cta">
          <div className="wrap">
            <h2 className="cta-title">START YOUR LIST.</h2>
            <Magnet>
              <Link to="/register" className="btn btn-signal btn-xl">Create account</Link>
            </Magnet>
          </div>
        </section>
      )}
    </>
  );
}
