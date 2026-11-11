# Code trim report

Goal: fewer, tighter lines and fewer comments, with identical behaviour.

## Result

| | Before | After | Change |
|---|---:|---:|---:|
| Total lines (175 files) | 15,927 | 15,811 | **-116 (-0.7%)** |
| Lines of actual code (not blank, not comment-only) | 13,840 | 13,716 | -124 (-0.9%) |
| Comment-only lines | 525 | 556 | +31 (file headers added) |
| Trailing comments after code | 125 | 25 | -100 |

| Area | Before | After |
|---|---:|---:|
| backend/src | 3,249 | 3,198 |
| backend/test | 1,299 | 1,319 |
| frontend/src (js and jsx) | 9,125 | 9,058 |
| frontend CSS | 1,733 | 1,712 |
| frontend tests | 369 | 375 |
| other (vite config, service worker) | 152 | 149 |

## What was done

1. **Comments**: kept only a description at the top of each file and the comment lead-ins above top-level functions,
   routes and constants. Removed inline comments, comments inside functions, and trailing comments after code.
   Removed empty `{/* */}` blocks in JSX. (-156 lines together with the blank-line tidy below.)
2. **Blank lines**: collapsed runs of blank lines and removed blanks right after an opening bracket or before a closing one.
   Template strings (SQL, queries) and JSX text were never touched.
3. **File headers**: 135 files had no description at the top. 64 already described themselves further down, so that
   comment was moved to the top. 71 got a new one-line description. (+59 lines net, which is why the total drops by
   less than the comment trimming alone.)
4. **One duplicate removed**: the anime and manga list tables in `backend/src/db.js` were two copies of the same SQL;
   now one helper builds both (-18 lines).
5. **One unused import** removed from `MyList.jsx`.

## How it was checked

- Every JS and JSX file (171 of 172) compiles to byte-identical output before and after, with comments stripped.
  `db.js` was checked separately: the original and new schema contain the same 33 SQL statements, and every `ALTER`
  still runs after its table is created.
- CSS: with comments and whitespace removed, both files are identical to the originals.
- Backend: 137 of 137 tests pass. Frontend: 35 of 35 tests pass. All 172 source files parse.

## What was not done, and why

- **Rewriting logic for fewer lines.** The code was already compact: comments were about 4% of lines, only about
  30 multi-line lists could be joined, about 12 one-statement `if` blocks could lose their braces, and the compiler
  found one unused import. Rewriting beyond that would change code that has no tests (SQL routes, React screens),
  and that is where bugs like the Discover query one come from.
- **Merging the remaining duplicates** (about 370 lines in 60 small blocks, mostly modal shells, Escape-key handlers and
  search forms). Worth doing once route and screen tests exist (see "Next steps" in the README).
- Config files (`render.yaml`, `package.json`, `wrangler.jsonc`), the README and docs were left as they are.
