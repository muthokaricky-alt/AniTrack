// Rules for custom lists (limits and entry kinds) and cleanListInput, which checks what the browser sent.
import { cleanImageUrl } from './imageUrl.js';

// The same title can appear more than once, because a list like "Top 10 arcs" repeats shows (one entry per arc).
// Limits keep one account from filling the database, and keep the page readable.
export const MAX_ITEMS = 50;
export const MAX_LISTS = 30;
// What a list can hold. For anime and manga the id is the MyAnimeList id; for characters it is the AniList character id
// (the same id the profile favourites use). The column keeps its old name, mal_id.
export const KINDS = ['anime', 'manga', 'character'];

// Checks and tidies what the browser sent. Only fields that are present are returned, so the same
// function serves "create" and "edit". Returns { value } or { error } (a message that is safe to show).
export function cleanListInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Send the list as a JSON object' };
  const out = {};

  if ('title' in body) {
    const title = typeof body.title === 'string' ? body.title.trim().replace(/\s+/g, ' ') : '';
    if (!title || title.length > 80) return { error: 'Give the list a title of 1 to 80 characters' };
    out.title = title;
  }

  if ('description' in body) {
    if (body.description !== null && typeof body.description !== 'string') return { error: 'The description must be text' };
    const description = (body.description || '').trim();
    if (description.length > 500) return { error: 'The description can be at most 500 characters' };
    out.description = description || null;
  }

  for (const flag of ['ranked', 'is_public']) {
    if (flag in body) {
      if (typeof body[flag] !== 'boolean') return { error: `${flag} must be true or false` };
      out[flag] = body[flag];
    }
  }

  if ('items' in body) {
    if (!Array.isArray(body.items)) return { error: 'items must be a list' };
    if (body.items.length > MAX_ITEMS) return { error: `A list can hold at most ${MAX_ITEMS} titles` };
    const items = [];
    for (const it of body.items) {
      const malId = Number(it?.mal_id);
      const title = typeof it?.title === 'string' ? it.title.trim().slice(0, 300) : '';
      if (!KINDS.includes(it?.kind) || !Number.isInteger(malId) || malId <= 0 || !title) {
        return { error: 'Each entry needs a kind (anime, manga or character), an id and a name' };
      }
      if (it.note != null && typeof it.note !== 'string') return { error: 'A note must be text' };
      const note = (it.note || '').trim();
      if (note.length > 280) return { error: 'A note can be at most 280 characters' };
      items.push({ kind: it.kind, mal_id: malId, title, image_url: cleanImageUrl(it.image_url), note: note || null });
    }
    out.items = items;
  }

  return { value: out };
}
