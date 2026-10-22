import { useEffect, useRef, useState } from 'react';

// Shown while pages are being served from the backup source (MyAnimeList via Jikan) because AniList is down.
// The API client fires 'anitrack:backup' whenever an answer carries source: 'backup'. The notice fades out after a
// while on its own, and comes straight back if more backup answers arrive.
export default function BackupNotice() {
  const [show, setShow] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    const onBackup = () => {
      setShow(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setShow(false), 60000);
    };
    window.addEventListener('anitrack:backup', onBackup);
    return () => {
      window.removeEventListener('anitrack:backup', onBackup);
      clearTimeout(timer.current);
    };
  }, []);

  if (!show) return null;
  return (
    <div className="backup-note" role="status">
      <p>
        <b>AniList is down.</b> You're seeing backup data from MyAnimeList, so some details (banners, schedules, related titles) are missing.
      </p>
      <button type="button" onClick={() => setShow(false)} aria-label="Dismiss this message">×</button>
    </div>
  );
}
