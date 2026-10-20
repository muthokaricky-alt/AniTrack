import { useCallback, useEffect, useRef, useState } from 'react';
import './musicSpotify.css';

// Your SoundCloud playlist (or track) URL. It must be PUBLIC. Set to '' to hide SoundCloud.
const SC_URL = 'https://soundcloud.com/ricky-242658922/sets/anitrack-osts';
const HAS_SC = Boolean(SC_URL);
const SC_EMBED =
  `https://w.soundcloud.com/player/?url=${encodeURIComponent(SC_URL)}` +
  '&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false' +
  '&show_user=true&show_reposts=false&show_teaser=false&visual=false';

const KEY = 'anitrack_music';

// SoundCloud's Widget API lets us control the embedded player (volume). Loaded once, only when the SoundCloud tab is used.
let scApiPromise = null;
function loadScApi() {
  if (typeof window !== 'undefined' && window.SC && window.SC.Widget) return Promise.resolve(window.SC);
  if (!scApiPromise) {
    scApiPromise = new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = 'https://w.soundcloud.com/player/api.js';
      el.async = true;
      el.onload = () => resolve(window.SC);
      el.onerror = () => { scApiPromise = null; reject(new Error('SoundCloud API failed to load')); };
      document.head.appendChild(el);
    });
  }
  return scApiPromise;
}

// localStorage can throw (private windows, blocked storage), so every access is guarded
function loadPrefs() {
  try {
    return { on: false, volume: 0.5, track: 0, open: true, source: 'built-in', expanded: false, scVolume: 1, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { on: false, volume: 0.5, track: 0, open: true, source: 'built-in', expanded: false, scVolume: 1 };
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
  // The SoundCloud embed loads third-party code, so it is only created once someone picks that tab
  const [scLoaded, setScLoaded] = useState(() => HAS_SC && loadPrefs().source === 'soundcloud');
  const scFrame = useRef(null);
  const scWidget = useRef(null);
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

  // Hook up the SoundCloud widget once its iframe exists, so the volume slider can control it.
  // Volume is re-applied on every PLAY event because the widget can reset it when the song changes.
  useEffect(() => {
    if (!scLoaded) {
      scWidget.current = null;
      return undefined;
    }
    let cancelled = false;
    loadScApi()
      .then((SC) => {
        if (cancelled || !scFrame.current) return;
        const widget = SC.Widget(scFrame.current);
        scWidget.current = widget;
        const apply = () => widget.setVolume(Math.round((prefsRef.current.scVolume ** 2) * 100));
        widget.bind(SC.Widget.Events.READY, apply);
        widget.bind(SC.Widget.Events.PLAY, apply);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [scLoaded]);

  useEffect(() => {
    if (scWidget.current) scWidget.current.setVolume(Math.round((prefs.scVolume ** 2) * 100));
  }, [prefs.scVolume]);

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

  // SoundCloud is the only source when there are no built-in tracks (decided once the track list has finished loading)
  const showSC = HAS_SC && (prefs.source === 'soundcloud' || (tracksLoaded && tracks.length === 0));
  const hasBoth = HAS_SC && tracks.length > 0;

  // Mount the SoundCloud player the first time it is needed and keep it mounted, so a song carries on when the widget is collapsed
  useEffect(() => {
    if (showSC) setScLoaded(true);
  }, [showSC]);

  // Only one source plays at a time: entering SoundCloud pauses the built-in tracks, leaving it removes the SoundCloud player (which stops it)
  function chooseSource(src) {
    if (src === 'soundcloud') {
      audio.current?.pause();
      update({ source: 'soundcloud', on: false });
    } else {
      setScLoaded(false);
      update({ source: 'built-in' });
    }
  }

  if (!tracks.length && !HAS_SC && tracksLoaded) return null;
  if (!tracksLoaded && !HAS_SC) return null;

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
      {scLoaded && (
        <div className={`music-spotify ${prefs.open && showSC ? '' : 'is-hidden'} ${prefs.expanded ? 'is-expanded' : ''}`}>
          <iframe
            ref={scFrame}
            title="SoundCloud playlist player"
            src={SC_EMBED}
            width="100%"
            height={prefs.expanded ? 450 : 166}
            frameBorder="0"
            allow="autoplay"
            loading="lazy"
          />
        </div>
      )}
      {prefs.open && (
        <div className="music-panel">
          {hasBoth && (
            <div className="music-source" role="group" aria-label="Music source">
              <button className={!showSC ? 'on' : ''} aria-pressed={!showSC} onClick={() => chooseSource('built-in')}>Built-in</button>
              <button className={showSC ? 'on' : ''} aria-pressed={showSC} onClick={() => chooseSource('soundcloud')}>SoundCloud</button>
            </div>
          )}
          {showSC ? (
            <div className="music-spot-ctl">
              <button className="music-chip music-chip-btn" onClick={() => update({ expanded: !prefs.expanded })} aria-pressed={prefs.expanded}>
                {prefs.expanded ? '▾ Hide playlist' : '▸ Show playlist'}
              </button>
              <div className="music-ctl">
                <button onClick={() => scWidget.current?.prev()} aria-label="Previous song">‹‹</button>
                <button onClick={() => scWidget.current?.next()} aria-label="Next song">››</button>
                <input
                  type="range" min="0" max="1" step="0.05" value={prefs.scVolume}
                  onChange={(e) => update({ scVolume: Number(e.target.value) })}
                  aria-label="SoundCloud volume"
                />
              </div>
              <a className="music-chip" href={SC_URL} target="_blank" rel="noreferrer">Open in SoundCloud ↗</a>
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
