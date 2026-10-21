// Cover pictures may only come from the sites AniTrack really uses. Anything else would let a user point their profile
// at their own server, which then learns the IP address of everyone who views that profile.
export const ALLOWED_IMAGE_HOSTS = [/^s\d+\.anilist\.co$/i, /^img\d*\.anilist\.co$/i, /^cdn\.myanimelist\.net$/i];

export function isAllowedImageUrl(value) {
  let url;
  try {
    url = new URL(String(value));
  } catch {
    return false;
  }
  return url.protocol === 'https:' && !url.port && !url.username && !url.password && ALLOWED_IMAGE_HOSTS.some((re) => re.test(url.hostname));
}

// The URL itself if it is allowed (and not absurdly long), otherwise null
export const cleanImageUrl = (value, max = 500) => (typeof value === 'string' && value.length <= max && isAllowedImageUrl(value) ? value : null);
