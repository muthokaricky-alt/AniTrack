// Shared helpers for anything that returns or accepts user profile data

const AVATAR_PATTERN = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const AVATAR_MAX_CHARS = 100000; // the client shrinks photos to ~256px, so real ones are far smaller

// Returns { valid: true, value } where value is a data URL or null (no avatar), or { valid: false }
export function parseAvatar(input) {
  if (input === undefined || input === null || input === '') return { valid: true, value: null };
  if (typeof input !== 'string' || input.length > AVATAR_MAX_CHARS || !AVATAR_PATTERN.test(input)) return { valid: false };
  return { valid: true, value: input };
}

// What the client is allowed to know about an account (never the password hash)
// The user columns the app needs on login and profile calls. Named explicitly (rather than SELECT *) so a large banner
// picture is not read from the database every time someone logs in or the app opens.
export const USER_COLUMNS = 'id, username, email, password_hash, avatar, avatar_shape, bio, is_public, token_version, created_at';

// The shapes a profile picture can have. 'circle' is what everyone starts with.
export const AVATAR_SHAPES = ['circle', 'square', 'rounded', 'hexagon', 'heart'];
export const DEFAULT_AVATAR_SHAPE = 'circle';
// One of the allowed shapes, or null if the value is not one of them
export const parseShape = (value) => (AVATAR_SHAPES.includes(value) ? value : null);

export function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    avatar: row.avatar || null,
    avatar_shape: parseShape(row.avatar_shape) || DEFAULT_AVATAR_SHAPE,
    bio: row.bio || '',
    is_public: Boolean(row.is_public)
  };
}
