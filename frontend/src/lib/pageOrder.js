// The main pages in the order the top bar lists them, for the Ctrl+Shift+Left / Right shortcut.
// A page that belongs to a section counts as that section: an anime page is "Browse", a manga page is "Manga".
const PAGES = [
  { path: '/', match: (p) => p === '/' || p.startsWith('/anime/') },
  { path: '/search', match: (p) => p.startsWith('/search') },
  { path: '/schedule', match: (p) => p.startsWith('/schedule') },
  { path: '/manga', match: (p) => p === '/manga' || p.startsWith('/manga/') },
  { path: '/my-list', needsLogin: true, match: (p) => p.startsWith('/my-list') },
  { path: '/guide', match: (p) => p.startsWith('/guide') }
];

// Where to go from `pathname`: step 1 is the next page, -1 the previous one. It wraps around at either end.
// From a page outside the list (a profile, the login page) Right goes to the first page and Left to the last.
export function nextPagePath(pathname, step, loggedIn) {
  const pages = PAGES.filter((p) => !p.needsLogin || loggedIn);
  const here = pages.findIndex((p) => p.match(pathname));
  if (here === -1) return step > 0 ? pages[0].path : pages[pages.length - 1].path;
  return pages[(here + step + pages.length) % pages.length].path;
}
