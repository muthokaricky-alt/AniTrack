// Extra security headers for the built site.
//
// The Content-Security-Policy says which places the page may load things from, so an injected script can't phone home.
// It starts in "report only" mode: the browser logs anything it WOULD block in the dev-tools console but blocks nothing,
// so it can't break the site. Once the console stays clean, set CSP_ENFORCE=1 on the server to switch it on for real.
export function buildCsp() {
  const directives = {
    'default-src': ["'self'"],
    'script-src': ["'self'", 'https://w.soundcloud.com'], // SoundCloud's player API
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], // React sets inline style attributes
    'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
    'img-src': ["'self'", 'data:', 'blob:', 'https:'], // AniList covers, profile photos (data URLs), share cards
    'media-src': ["'self'"], // the built-in mp3 tracks
    'connect-src': ["'self'"],
    'frame-src': ['https://w.soundcloud.com', 'https://www.youtube-nocookie.com'], // music player, trailers
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'self'"]
  };
  return Object.entries(directives).map(([name, values]) => `${name} ${values.join(' ')}`).join('; ');
}

export function securityHeaders(env = {}) {
  const headers = {
    [env.CSP_ENFORCE === '1' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only']: buildCsp()
  };
  // Tell browsers to always use https for this site (only in production, where https is guaranteed)
  if (env.NODE_ENV === 'production') headers['Strict-Transport-Security'] = 'max-age=15552000';
  return headers;
}
