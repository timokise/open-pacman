# AGENTS.md

Vanilla JS/HTML/CSS Pac-Man clone (28×31 grid, level 1 geometry). This repo is a teaching repo for
**Spec Driven Development**: features are specified in `specs/` first, then implemented via the
`/spec` and `/spec-impl` skills.

## Run & verify

There is **no build, no `package.json`, no test runner, no linter**. Do not add them unless a spec
explicitly asks for it.

- Serve `src/` as the web root: `python3 -m http.server 8000` run **from inside `src/`**. `index.html`
  references `css/style.css` and `js/*.js` relatively, so serving the repo root breaks those paths.
- Verification is manual: open the page, watch the console, play with the arrow keys. There is no
  automated test to run and no way to assert behavior headlessly.
- Canvas size is hardcoded in two places and must match the maze: `index.html` has
  `width="560" height="620"`, `style.css` has `#game-wrap { width: 560px; height: 620px }`.
  These equal `cols * TILE` and `rows * TILE` (`TILE = 20` in `render.js`). If the maze size changes,
  change all three together.

## Architecture

Four classic `<script>` files — no modules, no bundler. Load order in `index.html` is fixed and
matters: `maze.js` → `game.js` → `render.js` → `main.js`.

| File | Role | Exposes (via `window`) |
|---|---|---|
| `src/js/maze.js` | Level geometry, read-only constants | `MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS` |
| `src/js/game.js` | State and rules | `createGame`, `update`, `DIRS` |
| `src/js/render.js` | Canvas drawing | `draw( ctx, game, frame )` |
| `src/js/main.js` | RAF loop, keyboard, overlay screens | — (entrypoint) |

Consequences an agent would otherwise trip on:

- **No `import`/`export`.** Cross-file access is through `window` assignments. Top-level `const` in a
  classic script is also visible to later scripts (that is how `render.js` reads `DIRS`), but it is
  *not* a `window` property, so it cannot be probed off `window`.
- `render.js` must read `game.grid`, never `MAZE` — dots are eaten by zeroing `game.grid[y][x]`.
- `MAZE` is the pristine level; `createGame()` deep-copies it into `game.grid` so a new game can
  restore dots. Never mutate `MAZE` or `MAZE_STR`.
- `game.state` is the lifecycle flag: `start` → `playing` → `won` / `lost`. `main.js` only calls
  `update( game )` while `state === 'playing'`; `update` and the state transitions live in
  `game.js`/`main.js` respectively.

## Maze & movement model

- Cell coords `(x, y)`, origin top-left, `x ∈ [0,27]`, `y ∈ [0,30]`.
- Tiles are numbers: `1` wall, `2` dot, `0` empty walkable, `3` pen door. The door blocks Pac-Man
  only; ghosts pass through it.
- `MAZE_STR` is the readable source of truth: 31 strings of 28 chars, `#` wall, `.` dot, ` ` empty,
  `-` door. Edit the strings, not the parsed matrix.
- Row 14 is the wrap tunnel (`TUNNEL_ROW`): actors leaving left/right re-enter on the other side.
  `canMove()` checks the tunnel row *before* the out-of-bounds wall check in `isWall()` — keep that
  ordering when editing either function.
- Positions are floats in cell units. Turning, dot-eating and ghost decisions only happen when the
  actor is aligned to a cell center (`aligned()`). Speeds are 1/N cells per frame — Pac-Man `0.125`
  (1/8), ghosts `0.1` (1/10) — chosen so alignment recurs every N frames. Keep that 1/N property
  when tuning speed.
- Ghost kinds: `hunter` (greedy Manhattan chase) and `random`. The `random` ghost is intentionally
  nondeterministic, so erratic ghost movement is expected, not a bug.

## Style

- 2-space indent, semicolons, single quotes, **spaces inside parentheses and brackets**:
  `foo( bar )`, `[ 1, 2 ]`, `if ( x )`, `{ x: 1 }`. This is the dominant style in `src/js/*` — match
  the file you are editing.
- `const`/`let` over `var`; no semicolon after function declarations.
- Comments and UI strings are in Spanish (`'GANASTE'`, `'PERDISTE'`, `'VIDAS'`); `index.html` is
  `lang="es"`. Write new comments and user-facing text in Spanish to match.

## Spec-driven workflow

Skills live in `.agents/skills/` and are pinned by `skills-lock.json` (source:
`klerith/fernando-skills`) — do not hand-edit those files.

- `/spec <description>` writes `specs/NN-slug.md` with sequential zero-padded numbering, and
  `specs/.spec-config.yml` if absent. It creates specs in `Draft`; only a human approves them.
  The skill reads `AGENTS.md` (then `README.md`) as project memory, so keep this file accurate.
- `/spec-impl NN-slug` refuses to run unless the spec state *means* "Approved" ("Aprobado" counts).
  It switches to branch `spec-NN-slug` before touching code and never commits on its own.
- `specs/` does not exist yet, so the first spec is `specs/01-<slug>.md`. Specs in this repo are
  written in Spanish, matching the codebase.
- `AutoCreateBranch` in `specs/.spec-config.yml` defaults to `true` (branch created without asking).

## Gotchas

- **Never commit unless the user asks.** `/spec-impl` pauses after each plan step for diff review
  and leaves committing to the human.
- `main.js` rebuilds the overlay with `overlay.innerHTML`, so the module-level `actionBtn`
  reference goes stale after the first overlay is shown. Re-query `document.getElementById(
  'action-btn' )` instead of caching the element.
- `update( game )` mutates `game.grid`, `game.score`, `game.lives` and `game.state` in place and
  returns early on the losing collision — there is no return value to check.
