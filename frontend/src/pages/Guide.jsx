import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { isMac } from '../components/CommandPalette.jsx';

const K = isMac ? '⌘ K' : 'Ctrl K';

// Each guide: where it lives, the steps, and a link to go straight there
const GUIDES = [
  {
    id: 'add', group: 'Your list', title: 'Add an anime or manga to your list',
    words: 'add track save plan watch read status',
    steps: [
      'Find a title with Search, Browse or Manga, or press ' + K + ' and type its name.',
      'On a card, use the quick-add button, or open the title and pick a status: Watching, Completed, On hold, Dropped or Plan to watch.',
      'In the ' + K + ' palette, press Alt + Enter on a result to add it to Plan to watch without leaving the page.'
    ],
    to: '/search', cta: 'Open Search'
  },
  {
    id: 'progress', group: 'Your list', title: 'Log episodes and chapters',
    words: 'progress episode chapter +1 watched behind',
    steps: [
      'Go to My List. Each row has a +1 button: tap it every time you finish an episode or chapter.',
      'On the anime list, the "Airing this week" box shows shows that are behind. Tap "Watched ep N" to log the next one.',
      'Setting a title to Completed fills its progress for you.'
    ],
    to: '/my-list', cta: 'Open My List', auth: true
  },
  {
    id: 'details', group: 'Your list', title: 'Add notes, a score and tags to a title',
    words: 'notes score tags rewatch comfort details panel review label',
    steps: [
      'On My List, press Details on a row. A panel opens under it with your score, private notes and tags.',
      'Type a tag such as Rewatch or Comfort and press Enter. Tap a tag on a row to filter the list by it.',
      'Use the tag menu in the filter bar to see only one tag.'
    ],
    to: '/my-list', cta: 'Open My List', auth: true
  },
  {
    id: 'undo', group: 'Your list', title: 'Undo a removal or a bulk move',
    words: 'undo restore removed deleted mistake',
    steps: [
      'After you remove a title, or move or remove several, a message appears in the corner with an Undo button.',
      'Press Undo within about 7 seconds and the titles come back with their score, notes and tags.'
    ]
  },
  {
    id: 'streak', group: 'Discover', title: 'Streaks and your weekly goal',
    words: 'streak goal weekly week progress momentum',
    steps: [
      'The strip at the top of My List shows how many episodes (or chapters) you logged this week and your day streak.',
      'Press the goal number to change it. The week resets every Monday.',
      'Every +1 counts, so log as you go.'
    ],
    to: '/my-list', cta: 'Open My List', auth: true
  },
  {
    id: 'bell', group: 'Discover', title: 'Get told about new episodes',
    words: 'bell notification new episode airing behind alert',
    steps: [
      'The bell in the top bar shows a dot when a show you are watching, or plan to watch, has aired episodes you have not logged.',
      'Press it to see which shows, then tap one to open it. Logging the episode clears it.'
    ]
  },
  {
    id: 'wrapped', group: 'Favourites and sharing', title: 'See your Wrapped',
    words: 'wrapped recap year summary stats card hours genres',
    steps: [
      'On My List press Wrapped, or press ' + K + ' and type Wrapped.',
      'Switch between Anime and Manga to see episodes or chapters, hours, top genres and your highest rated.',
      'Press Download card for an image you can post. Month and streak fill in as you keep logging.'
    ],
    to: '/wrapped', cta: 'Open Wrapped', auth: true
  },
  {
    id: 'install', group: 'Tips', title: 'Install AniTrack on your phone or computer',
    words: 'install app home screen pwa add offline phone',
    steps: [
      'On Android Chrome: open the menu and choose Install app (or Add to Home screen). On iPhone Safari: press Share, then Add to Home Screen.',
      'On a computer in Chrome or Edge, use the install icon at the right of the address bar.',
      'The app opens full screen and loads faster. If the server is asleep, My List still shows your last saved copy.'
    ]
  },
  {
    id: 'organise', group: 'Your list', title: 'Sort, filter and change the view of My List',
    words: 'sort filter search genre view grid compact list',
    steps: [
      'On My List, type in "Filter this list" to find a title, or pick a genre.',
      'Use the sort menu for title, score, progress or oldest first.',
      'Switch between List, Grid and Compact. Your choice is remembered.'
    ],
    to: '/my-list', cta: 'Open My List', auth: true
  },
  {
    id: 'bulk', group: 'Your list', title: 'Change or remove many titles at once',
    words: 'bulk select multiple move delete remove status',
    steps: [
      'On My List, press Select (next to the view buttons).',
      'Tick the titles you want, or press "Select all" to take everything currently shown. Filters narrow what "all" means.',
      'Choose "Move to…" to change their status, or Remove to delete them. Press Done when finished.'
    ],
    to: '/my-list', cta: 'Open My List', auth: true
  },
  {
    id: 'import', group: 'Import and export', title: 'Import your list from Excel, Word or CSV',
    words: 'import excel word docx xlsx csv json myanimelist',
    steps: [
      'Go to My List and press the orange Import button.',
      'Pick your .xlsx, .docx, .csv or .json file. Titles are matched against the catalogue.',
      'Check the preview. Titles that could not be matched are listed so you can see what will be skipped, then press the Import button to confirm.'
    ],
    note: 'Importing never removes titles you already have.',
    to: '/my-list', cta: 'Open My List', auth: true
  },
  {
    id: 'export', group: 'Import and export', title: 'Export your whole list',
    words: 'export download backup excel csv json save',
    steps: [
      'Go to My List. The buttons above the status tabs are Export JSON, Export CSV and Export Excel.',
      'Export Excel makes one workbook with an Anime sheet and a Manga sheet. JSON and CSV export only the list you are viewing.',
      'Do this now and then. On the free Render host the database can be wiped when the server restarts, so a file is your backup.'
    ],
    to: '/my-list', cta: 'Open My List', auth: true
  },
  {
    id: 'top15', group: 'Favourites and sharing', title: 'Pick your Top 3 and Top 15',
    words: 'favourite favorite top 3 top 15 top15 order reorder drag characters',
    steps: [
      'Open your Profile (click your name in the top bar). The Favourites tab is the first one.',
      'Choose Anime, Manga or Characters, then search in the box under a list to add a title.',
      'Drag items to reorder them, or use the arrows. Every change saves straight away.'
    ],
    to: '/profile', cta: 'Open Profile', auth: true
  },
  {
    id: 'download-top15', group: 'Favourites and sharing', title: 'Download your Top 15 as an image',
    words: 'download export top 15 top15 image png poster text favourites',
    steps: [
      'Open your Profile, then the Favourites tab.',
      'Pick Anime (or Manga) at the top. Each one has its own list and its own download.',
      'Scroll to the bottom, below both lists. Press "Download Top 15 Anime (image)" for a poster PNG, or "Text list" for a plain .txt file.'
    ],
    note: 'The buttons only appear once the list has at least one title in it.',
    to: '/profile', cta: 'Open Profile', auth: true
  },
  {
    id: 'sharecard', group: 'Favourites and sharing', title: 'Make a share card of your Top 3',
    words: 'share card image png top 3 instagram status',
    steps: [
      'Open your Profile and press "Share card" at the top.',
      'Switch between Anime and Manga, then press Download PNG. On phones there is a Share button too.',
      'The card shows your Top 3 favourites, topped up with your highest-rated titles if you have fewer than three.'
    ],
    to: '/profile', cta: 'Open Profile', auth: true
  },
  {
    id: 'public', group: 'Favourites and sharing', title: 'Make your profile public and compare tastes',
    words: 'public profile compare taste match friends share link privacy',
    steps: [
      'Open Profile, then the Settings tab, and switch on a public profile. It is off by default.',
      'Share the link /u/yourname. Visitors see your bio, stats and favourites. Your email and full list stay private.',
      'To compare, open the Compare tab, type a friend\'s username, and see your match percentage, shared titles and genres. Both of you need to be logged in, and their profile must be public.'
    ],
    to: '/profile', cta: 'Open Profile', auth: true
  },
  {
    id: 'discover', group: 'Discover', title: 'Get recommendations and see what is airing',
    words: 'recommend because you loved schedule airing this week',
    steps: [
      'On Home, once you are logged in and have rated some titles, "Because you loved…" shows picks based on your highest scores. Tap a title chip to switch.',
      'Schedule shows episodes airing over the coming week in your local time.',
      'My List has its own "Airing this week" box for shows you are watching or plan to watch.'
    ],
    to: '/schedule', cta: 'Open Schedule'
  },
  {
    id: 'shortcuts', group: 'Tips', title: 'Keyboard shortcuts',
    words: 'keyboard shortcut ctrl k palette search slash',
    steps: [
      K + ' opens the command palette: jump to any page, find titles on your list, or search the catalogue.',
      'Use the arrow keys to move, Enter to open, Alt + Enter to add to Plan to watch, Esc to close.',
      'Press / on any page to jump to the search box.'
    ]
  },
  {
    id: 'theme', group: 'Tips', title: 'Change the theme and accent colour',
    words: 'theme dark light accent colour color appearance',
    steps: [
      'Press the half-moon button in the top bar.',
      'Pick Dark, Light or Match device, then one of the accent colours.',
      'Title pages borrow their cover\'s colour while you are on them.'
    ]
  },
  {
    id: 'music', group: 'Tips', title: 'Control the background music',
    words: 'music sound volume pause spotify lofi off',
    steps: [
      'The round button at the bottom left opens the player. Play, pause, skip or change the volume there.',
      'Use the Spotify tab to load a playlist. Spotify only plays full songs if the browser can see your Spotify login; otherwise it plays previews.',
      'Music never starts by itself, and it stays off until you press play.'
    ]
  }
];

export default function Guide() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(() => (typeof window !== 'undefined' ? window.location.hash.slice(1) : ''));

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? GUIDES.filter((g) => `${g.title} ${g.group} ${g.words} ${g.steps.join(' ')}`.toLowerCase().includes(t)) : GUIDES;
  }, [q]);
  const groups = [...new Set(shown.map((g) => g.group))];

  return (
    <div className="wrap page-pad guide">
      <div className="page-title">
        <p className="kicker">Help</p>
        <h1 className="h1">How to</h1>
        <p className="muted guide-lead">Short answers to "where do I find…". Search, or open a topic.</p>
      </div>

      <input className="guide-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the guide, e.g. export top 15" aria-label="Search the guide" />

      {shown.length === 0 && <div className="empty-state">Nothing matches that. Try a shorter word, like "export" or "import".</div>}

      {groups.map((group) => (
        <section key={group} className="guide-group">
          <h2 className="mini-h">{group}</h2>
          {shown.filter((g) => g.group === group).map((g) => (
            <details key={g.id} id={g.id} className="guide-item" open={q.trim() ? true : open === g.id} onToggle={(e) => e.currentTarget.open && setOpen(g.id)}>
              <summary>{g.title}</summary>
              <ol>{g.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
              {g.note && <p className="muted guide-note">{g.note}</p>}
              {g.to && <Link className="btn btn-line btn-sm" to={g.to}>{g.cta}</Link>}
            </details>
          ))}
        </section>
      ))}
    </div>
  );
}
