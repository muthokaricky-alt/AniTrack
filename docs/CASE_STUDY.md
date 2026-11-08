# AniTrack: case study

**In one line:** a full-stack anime and manga tracker with custom ranked lists, imports from MyAnimeList and
AniList, and a taste-match score, running on free hosting.

Live: https://anitrack.muthokaricky.workers.dev  |  Code: https://github.com/muthokaricky-alt/AniTrack

## The problem

I wanted one place to track what I watch and read, rank my favourites, and compare taste with friends, without
paying for hosting. Existing trackers do the basics well but are awkward for things like "my top 10 arcs", where
one show appears several times and each entry needs a note.

## What I built

- Watchlists for anime and manga with status, score, progress, notes, tags, start and finish dates and rewatch counts
- Custom lists (anime, manga and characters), ranked or not, private by default, shareable, with a Discover page
  and "Save a copy"
- A poster image of any list, where the note is the caption (Marineford, with One Piece underneath)
- Imports from MyAnimeList exports and from an AniList username, so a friend can switch in a minute
- A taste match between two people, which I call Rick's Algorithm: genres, rating similarity, shared titles and
  shared favourites, blended into one percentage
- A year-long activity heatmap, live episode countdowns, and swipe gestures for rows on a phone

## Architecture

React and Vite on Cloudflare, an Express API on Render, Postgres on Neon, and AniList as the catalogue.

The main constraint was free hosting. Render's free tier sleeps after 15 minutes, and the first request after that
takes up to a minute, with a blank host page in the way. I fixed the experience in two steps: I moved the frontend
to an always-on static host so the app itself loads instantly, and I added a "Waking up the server" banner with
automatic retries for reads (writes are never retried, so nothing happens twice).

## Decisions and trade-offs

- **Link out, don't host.** The app links to official sites for watching and reading. It never hosts or embeds
  chapters or episodes, which keeps it legal and means it costs nothing in bandwidth.
- **Privacy by default.** Lists start private. A private profile answers exactly like a missing one, so it does not
  reveal that it exists or has lists.
- **A formula I can explain.** The taste match is a plain weighted average of four measures, not a black box. Each part is
  scored 0 to 100%, and if a part cannot be measured it is left out rather than counted as zero.
- **Test the logic that can break quietly.** Parsing imports, scoring, dates, paging and gestures are pure functions
  with tests. Gestures were also checked with real touch events in a headless browser.

## Problems worth mentioning

- After splitting the frontend and API onto different addresses, downloading share images started to fail, because
  browsers refuse to save a canvas that used cross-site images unless they were requested with permission. I
  reproduced it in a real browser with two local servers, then fixed it.
- A MyAnimeList file has IDs but no covers or genres, so imports would have shown blank posters. The importer now
  fetches covers, genres and totals in batches of 50.
- A new list feature briefly exposed public lists of private profiles through one endpoint. I caught it in review
  and made private profiles answer "not found".

## Testing

136 backend tests and 35 frontend tests (importers, taste match, heatmap, swipe logic, countdowns, card drawing).
The routes that run SQL are not covered yet. The next step is CI with a real Postgres so they are.

## How I built it

I designed the features and made the product decisions, and built the app together with an AI assistant (Claude),
reviewing, testing and deploying it myself. I can walk through any part of the code and explain why it works the
way it does.

## What I would do next

CI with Postgres-backed route tests, per-list link previews through a Cloudflare Worker, and push notifications
for new episodes.

---

### Before publishing this on a portfolio, add

- 3 to 4 screenshots: the My List page (with the heatmap), a ranked custom list, the taste match card, and the
  phone view
- A 20 to 30 second screen recording of importing a list, or swiping a row
- Check the live link and the repo link above
