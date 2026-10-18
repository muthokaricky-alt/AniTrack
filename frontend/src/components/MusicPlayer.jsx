import { useCallback, useEffect, useRef, useState } from 'react';
import './musicSpotify.css';

// Your Spotify playlist: paste the share link or just the id. It must be a PUBLIC playlist. Set to '' to hide Spotify.
const SPOTIFY_PLAYLIST = 'https://open.spotify.com/playlist/45fjZqOFqN9OzwLGanc5Cu';
const SPOTIFY_ID = SPOTIFY_PLAYLIST ? (String(SPOTIFY_PLAYLIST).match(/playlist\/([A-Za-z0-9]+)/) || [null, String(SPOTIFY_PLAYLIST)])[1] : '';
const SPOTIFY_EMBED = `https://open.spotify.com/embed/playlist/${SPOTIFY_ID}?utm_source=generator&theme=0`;

const KEY = 'anitrack_music';

// localStorage can throw (private windows, blocked storage), so every access is guarded
function loadPrefs() {
  try {
    return { on: false, volume: 0.5, track: 0, open: true, source: 'built-in', expanded: false, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { on: false, volume: 0.5, track: 0, open: true, source: 'built-in', expanded: false };
  }
}
function savePrefs(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

/*
 * Background music. Browsers refuse to play sound before the visitor has interacted with the page,
 * so the first visit starts paused. Once someone presses play we remember it, and on later visits
 * the music starts on their first click or key press anywhere on the site.
 * "on" = the visitor wants music (remembered). Pausing from the widget turns it off until they press play again.
 */
export default function MusicPlayer() {
  const audio = useRef(null);
  const [tracks, setTracks] = useState([]);
  const [tracksLoaded, setTracksLoaded] = useState(false);
  const [prefs, setPrefs] = useState(loadPrefs);
  const [playing, setPlaying] = useState(false);
  // The Spotify embed loads third-party code, so it is only created once someone picks that tab
  const [spotifyLoaded, setSpotifyLoaded] = useState(() => Boolean(SPOTIFY_ID) && loadPrefs().source === 'spotify');
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  const update = useCallback((patch) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      savePrefs(next);
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/music/playlist.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => !cancelled && Array.isArray(list) && setTracks(list.filter((t) => t && t.src)))
      .catch(() => {})
      .finally(() => !cancelled && setTracksLoaded(true));
    return () => { cancelled = true; };
  }, []);

  const index = tracks.length ? prefs.track % tracks.length : 0;
  const current = tracks[index];

  const tryPlay = useCallback(() => {
    const el = audio.current;
    if (!el || !el.src) return Promise.resolve(false);
    return el.play().then(() => true, () => false);
  }, []);

  // Load the selected track. Keep playing if the visitor already had music on.
  useEffect(() => {
    const el = audio.current;
    if (!el || !current) return;
    if (!el.src.endsWith(current.src)) {
      el.src = current.src;
      if (prefsRef.current.on) tryPlay();
    }
  }, [current, tryPlay]);

  useEffect(() => {
    // squared so the bottom half of the slider is genuinely quiet (ears hear loudness on a curve)
    if (audio.current) audio.current.volume = prefs.volume ** 2;
  }, [prefs.volume]);

  // Returning visitor who left music on: start at the first interaction the browser accepts
  useEffect(() => {
    if (!tracks.length || !prefs.on || playing) return undefined;
    let done = false;
    const start = async () => {
      if (done) return;
      if (await tryPlay()) {
        done = true;
        cleanup();
      }
    };
    const events = ['pointerdown', 'keydown'];
    const cleanup = () => events.forEach((e) => window.removeEventListener(e, start));
    tryPlay().then((ok) => {
      if (ok) done = true;
      else events.forEach((e) => window.addEventListener(e, start));
    });
    return cleanup;
  }, [tracks.length, prefs.on, playing, tryPlay]);

  // Don't keep playing in a background tab
  useEffect(() => {
    const onVis = () => {
      const el = audio.current;
      if (!el) return;
      if (document.hidden) el.pause();
      else if (prefsRef.current.on) tryPlay();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [tryPlay]);

  const next = useCallback(() => update({ track: (index + 1) % Math.max(tracks.length, 1) }), [index, tracks.length, update]);
  const prev = () => update({ track: (index - 1 + tracks.length) % tracks.length });

  function toggle() {
    const el = audio.current;
    if (!el) return;
    if (playing) {
      el.pause();
      update({ on: false });
    } else {
      update({ on: true });
      tryPlay();
    }
  }

  // Spotify is the only source when there are no built-in tracks (decided once the track list has finished loading)
  const showSpotify = Boolean(SPOTIFY_ID) && (prefs.source === 'spotify' || (tracksLoaded && tracks.length === 0));
  const hasBoth = Boolean(SPOTIFY_ID) && tracks.length > 0;

  // Mount the Spotify player the first time it is needed and keep it mounted, so a song carries on when the widget is collapsed
  useEffect(() => {
    if (showSpotify) setSpotifyLoaded(true);
  }, [showSpotify]);

  // Only one source plays at a time: entering Spotify pauses the built-in tracks, leaving it removes the Spotify player (which stops it)
  function chooseSource(src) {
    if (src === 'spotify') {
      audio.current?.pause();
      update({ source: 'spotify', on: false });
    } else {
      setSpotifyLoaded(false);
      update({ source: 'built-in' });
    }
  }

  if (!tracks.length && !SPOTIFY_ID && tracksLoaded) return null;
  if (!tracksLoaded && !SPOTIFY_ID) return null;

  return (
    <div className={`music ${prefs.open ? 'is-open' : ''} ${playing ? 'is-playing' : ''}`} role="region" aria-label="Background music">
      <audio
        ref={audio}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          if (tracks.length < 2) {
            audio.current.currentTime = 0; // single track: loop it
            tryPlay();
          } else next();
        }}
        onError={() => setPlaying(false)}
      />
      <button
        className="music-fab"
        onClick={() => update({ open: !prefs.open })}
        aria-expanded={prefs.open}
        aria-label={prefs.open ? 'Hide music player' : 'Show music player'}
        title="Music"
      >
        <span className="music-bars" aria-hidden="true"><i /><i /><i /></span>
      </button>
      {spotifyLoaded && (
        <div className={`music-spotify ${prefs.open && showSpotify ? '' : 'is-hidden'} ${prefs.expanded ? 'is-expanded' : ''}`}>
          <iframe
            title="Spotify playlist player"
            src={SPOTIFY_EMBED}
            width="100%"
            height={prefs.expanded ? 352 : 152}
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          />
        </div>
      )}
      {prefs.open && (
        <div className="music-panel">
          {hasBoth && (
            <div className="music-source" role="group" aria-label="Music source">
              <button className={!showSpotify ? 'on' : ''} aria-pressed={!showSpotify} onClick={() => chooseSource('built-in')}>Built-in</button>
              <button className={showSpotify ? 'on' : ''} aria-pressed={showSpotify} onClick={() => chooseSource('spotify')}>Spotify</button>
            </div>
          )}
          {showSpotify ? (
            <div className="music-spot-ctl">
              <button className="music-chip" onClick={() => update({ expanded: !prefs.expanded })} aria-pressed={prefs.expanded}>
                {prefs.expanded ? '▾ Hide track list' : '▸ Track list'}
              </button>
              <a className="music-chip" href={`https://open.spotify.com/playlist/${SPOTIFY_ID}`} target="_blank" rel="noreferrer">Open in Spotify ↗</a>
            </div>
          ) : current ? (
            <>
              <div className="music-info">
                <p className="music-title">{current.title}</p>
                <p className="music-artist">{current.artist || 'Unknown artist'}</p>
              </div>
              <div className="music-ctl">
                <button onClick={prev} aria-label="Previous track" disabled={tracks.length < 2}>‹‹</button>
                <button className="music-play" onClick={toggle} aria-label={playing ? 'Pause music' : 'Play music'}>
                  {playing ? '❚❚' : '▶'}
                </button>
                <button onClick={next} aria-label="Next track" disabled={tracks.length < 2}>››</button>
                <input
                  type="range" min="0" max="1" step="0.05" value={prefs.volume}
                  onChange={(e) => update({ volume: Number(e.target.value) })}
                  aria-label="Volume"
                />
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
