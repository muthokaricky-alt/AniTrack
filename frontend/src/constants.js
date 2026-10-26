export const STATUSES = [
  { key: 'watching', label: 'Watching' },
  { key: 'completed', label: 'Completed' },
  { key: 'on_hold', label: 'On hold' },
  { key: 'dropped', label: 'Dropped' },
  { key: 'plan_to_watch', label: 'Plan to watch' }
];

export const MANGA_STATUSES = [
  { key: 'reading', label: 'Reading' },
  { key: 'completed', label: 'Completed' },
  { key: 'on_hold', label: 'On hold' },
  { key: 'dropped', label: 'Dropped' },
  { key: 'plan_to_read', label: 'Plan to read' }
];

export const STATUS_LABEL = Object.fromEntries([...STATUSES, ...MANGA_STATUSES].map((s) => [s.key, s.label]));

// Everything that differs between the anime list and the manga list lives here
export const KINDS = {
  anime: {
    key: 'anime',
    path: '/anime',
    name: 'Anime',
    statuses: STATUSES,
    activeStatus: 'watching',
    defaultStatus: 'plan_to_watch',
    planLabel: 'Plan to watch',
    progress: 'episodes_watched', // field on a list entry
    total: 'total_episodes', // field on a list entry
    totalProp: 'episodes', // field on a catalogue item
    unit: 'Episodes',
    unitShort: 'EP',
    progressLabel: 'Episodes watched',
    ratings: [
      { key: 'story', label: 'Story' },
      { key: 'characters', label: 'Characters' },
      { key: 'visuals', label: 'Visuals' },
      { key: 'music', label: 'Music' },
      { key: 'enjoyment', label: 'Enjoyment' }
    ]
  },
  manga: {
    key: 'manga',
    path: '/manga',
    name: 'Manga',
    statuses: MANGA_STATUSES,
    activeStatus: 'reading',
    defaultStatus: 'plan_to_read',
    planLabel: 'Plan to read',
    progress: 'chapters_read',
    total: 'total_chapters',
    totalProp: 'chapters',
    unit: 'Chapters',
    unitShort: 'CH',
    progressLabel: 'Chapters read',
    ratings: [
      { key: 'story', label: 'Story' },
      { key: 'characters', label: 'Characters' },
      { key: 'art', label: 'Art' },
      { key: 'pacing', label: 'Pacing' },
      { key: 'enjoyment', label: 'Enjoyment' }
    ]
  }
};

// 10, 9.5, 9 ... 0.5
export const SCORE_OPTIONS = Array.from({ length: 20 }, (_, i) => 10 - i * 0.5);

export const GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mahou Shoujo', 'Mecha', 'Music',
  'Mystery', 'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller'
];

// "Recommend to a friend": the longest note allowed (the server enforces the same limit)
export const REC_NOTE_MAX = 140;

// Your Discord server's permanent invite link, for example 'https://discord.gg/abc123'.
// Leave it '' and the footer link stays hidden. Anything that isn't a Discord invite is ignored.
export const DISCORD_URL = '';
export const discordLink = /^https:\/\/(discord\.gg|discord\.com\/invite)\/[A-Za-z0-9-]+\/?$/.test(DISCORD_URL) ? DISCORD_URL : '';

// An uploaded banner picture is shrunk until its data URL is no longer than this (the server enforces the same limit)
export const BANNER_MAX_CHARS = 330000;

// One progress update counts for at most this many episodes (or chapters) in the weekly goal. This matches the server, which
// caps what it logs, and also keeps old, inflated activity from before that change from skewing the week.
export const ACTIVITY_STEP_CAP = 25;
