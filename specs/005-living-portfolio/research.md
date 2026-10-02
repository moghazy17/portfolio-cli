# Research: Living Portfolio

**Feature**: 005-living-portfolio | **Date**: 2026-10-02 | **Plan**: [plan.md](./plan.md)

Each decision lists what was chosen, why, and what was rejected. The user's planning notes are the
starting point; where they conflict with the clarified spec, the conflict and its resolution are
recorded here (R1, R14, R17).

---

## US1 — GUI mode

### R1. Styling tokens for the regular page

- **Decision**: Tailwind utilities in `apps/web` are mapped to CSS custom properties (`--gui-bg`,
  `--gui-fg`, `--gui-muted`, `--gui-card`, `--gui-border`, `--gui-accent`), defined twice: a light set
  and a dark set chosen with `prefers-color-scheme`. The accent (`#2c84db`) and monospace font come
  from the default `matrix` theme in `packages/shared/src/theme.ts`, so the page reads as the same
  brand. The page does **not** switch colours when the visitor changes terminal theme.
- **Rationale**: The planning note asked for components "adapted to theme tokens (matrix/dracula/nord
  mapped to CSS variables)". The clarified spec (FR-006, FR-006a) says the page follows the device's
  light/dark preference, not the terminal theme. Mapping Tailwind colours to variables satisfies the
  note's intent (no hard-coded colours from the generated components; one token system) while
  keeping the clarified behaviour. The terminal themes are all dark, so following them would break the
  light-mode requirement.
- **Alternatives rejected**: following the visitor's terminal theme (contradicts FR-006a, breaks
  light mode); hard-coded Tailwind palette (`bg-zinc-900` etc.) from the generated components
  (no single source for brand colours).

### R2. Tailwind setup without touching the terminal

- **Decision**: Tailwind CSS v4 via `@tailwindcss/postcss`, imported **only** from
  `apps/web/app/gui/gui.css`, which is imported only by `app/gui/layout.tsx`. Import the theme and
  utilities layers but **not** Preflight (`@import "tailwindcss/theme.css" layer(theme);
  @import "tailwindcss/utilities.css" layer(utilities);`), and add a small scoped reset under
  `.gui-root`.
- **Rationale**: After a client-side switch from `/gui` back to `/`, Next keeps already-loaded CSS in
  the document. Preflight would then restyle the terminal (headings, lists, buttons). Utilities only
  match class names the terminal never uses, so leaking is harmless. The terminal keeps its own
  `globals.css` and stays free of Tailwind on its critical path (Principle VII).
- **Alternatives rejected**: CSS Modules only (the 21st components are Tailwind; porting every class
  by hand is slower and error-prone); global Tailwind with Preflight (restyles the terminal).

### R3. Component sourcing through the 21st MCP

- **Decision**: During implementation, search the 21st catalog first (free `search`), pick one
  candidate per section, retrieve it with `get_component` (daily quota), then **port** the markup into
  our own components in `apps/web/components/gui/`, with plain Tailwind, our token classes and content
  props. Do not run the `npx shadcn add` install commands: they embed a 21st API key in the URL and
  pull in shadcn scaffolding (`components.json`, Radix, `cn`). A tiny local `cx()` helper replaces
  `cn`. Candidates found while planning (2026-10-02):

  | Section | Candidate (21st id) | Note |
  |---|---|---|
  | Hero | Hero Block — moumensoliman (10628); Portfolio Hero — waleedkibhen (9037) | Drop profile image if none in content; keep staggered text |
  | Experience timeline | Experience Timeline — shadcnui-blocks timeline-02 (28334), timeline-01 (28329) | Company, role, dates, tech badges map to `experience` |
  | Project cards | Project Card — ravikatiyar162 (5964); Portfolio Showcase Grid — uiable (29523) | No images in content: use title, stack badges, bullets, links |
  | Glitch (terminal, reference only) | Glitch Text — kokonutd (19111), Animated Glitch Text (35) | Port idea to CSS keyframes; no component code shipped |

  Contact and skills sections are simple enough to write directly; search anyway and use one only if
  it saves work.
- **Rationale**: Matches the planning note ("search first, then generate") while keeping secrets and
  extra dependencies out of the repo. Licences are checked per component before porting.
- **Alternatives rejected**: shadcn CLI install (secret in command, new dependency tree); writing every
  section from scratch (slower, and the note asks for the MCP).

### R4. Route, rendering and content source

- **Decision**: `apps/web/app/gui/page.tsx` is a statically rendered Server Component that reads the
  same generated content as the terminal (`cvData`, `profile`, `site`, `itemIds` from
  `@ahmed-moghazy/shared`). Interactive parts (theme-independent motion, guestbook form, presence
  badge, "back to terminal") are small client islands.
- **Rationale**: Single source of truth (Principle I, FR-002); static HTML gives the best Lighthouse
  performance and full content for crawlers (FR-008).
- **Alternatives rejected**: fetching `/api/content` client-side (slower, worse SEO); a GUI overlay on
  the terminal page (no own address, weaker SEO, bigger terminal bundle).

### R5. `/gui` versus the deep-link middleware

- **Decision**: `gui` and `startx` become registered commands, so `parseAddress('/gui')` would treat
  `/gui` as a deep link and rewrite it to `/`. The browser branch of `middleware.ts` passes `/gui`
  (and `/gui/`) straight through to the route. Text clients on `/gui` still get the `gui` command's
  curl output (a one-line pointer to the page). `/startx` stays a deep link: the terminal loads, runs
  `startx`, and switches to `/gui` (display only, allowed by the spec's edge cases).
- **Rationale**: Keeps the one address format from spec 004 and gives the page its own real URL.
- **Alternatives rejected**: a different path such as `/classic` (the planning note names `/gui`; a path
  that equals the command is easier to remember).

### R6. Switching views and remembering the last view

- **Decision**: A new `CommandResult` effect `view: 'gui'`. The web host applies it with
  `router.push('/gui')` (client navigation, no full reload). The last-used view is stored in a cookie
  `view=gui|terminal` (1 year, `SameSite=Lax`, not `HttpOnly` because the client sets it). Middleware
  redirects (307) a **plain** `/` request with `view=gui` and no query to `/gui`; every deep link and
  every request with a query still goes to the terminal. "Back to terminal" sets `view=terminal`
  before navigating to `/`.
- **Rationale**: FR-004a must apply on the server's first response to avoid a visible terminal flash
  before a client-side redirect; `localStorage` is not readable by middleware. The cookie stores only
  a view name, so it is a functional preference cookie, not tracking.
- **Alternatives rejected**: `localStorage` + client redirect (terminal flash, extra round trip);
  rewrite instead of redirect (address bar would say `/` while showing the GUI, so sharing it would
  show the terminal to others).

### R7. Keeping terminal state across a switch

- **Decision**: On unmount, `useTerminal` saves its visible log, prompt state and cwd to a
  module-level store (`lib/terminal-snapshot.ts`); on mount within the same tab it restores them
  instead of replaying the welcome. A full page load starts fresh as today.
- **Rationale**: Spec US1 scenario 4: returning to the terminal "without a full reload of content
  they already had". Client-side navigation keeps JS modules alive, so a module variable is enough.
- **Alternatives rejected**: `sessionStorage` serialisation (larger, must handle `CommandOutput`
  versioning); a shared layout keeping `<Terminal>` mounted under `/gui` (loads the terminal on the
  GUI page, hurting its performance).

### R8. Motion on the regular page

- **Decision**: `motion` (the current package name of Framer Motion) using `LazyMotion` with
  `domAnimation` and the `m` component, wrapped in `<MotionConfig reducedMotion="user">`. Used only for
  subtle entrance fades/slides of sections and cards, only under `/gui`.
- **Rationale**: The planning note asks for Framer Motion for subtle entrances. `LazyMotion` keeps
  the initial bundle small (~5 kB for `m` vs ~30 kB for `motion`). `reducedMotion="user"` turns
  transform animations off for reduced-motion users (FR-017 spirit, Principle VI). It never loads on
  the terminal route (Principle VII).
- **Alternatives rejected**: CSS-only entrances (fine, but the note asks for Motion and the 21st
  components already use it); full `motion` import (larger bundle).

### R9. Accessibility and performance verification

- **Decision**: Playwright tests for `/gui` at 320 px and 1280 px, in light and dark (`emulateMedia`),
  plus `@axe-core/playwright` with no serious/critical violations. Lighthouse ≥ 90 for performance
  and accessibility is checked with `npx lighthouse` against a local production build (documented in
  quickstart) and recorded in the PR; it is not a CI gate.
- **Rationale**: axe in Playwright is deterministic enough for CI; Lighthouse performance scores
  fluctuate on shared CI runners and would make the gate flaky.
- **Alternatives rejected**: Lighthouse CI as a required check (flaky); manual only (no regression net
  for accessibility).

### R10. SEO for two views of the same content

- **Decision**: `/gui` has its own `metadata` (title "Ahmed Moghazy — Portfolio", description,
  Open Graph image reused) and a self-canonical URL. The terminal page keeps its hidden semantic
  article (Principle VI). Both are indexable; `sitemap` (if present) lists both.
- **Rationale**: FR-008; the regular page is the better landing for search visitors.

---

## US2 — Terminal motion

### R11. Animation technique on the terminal path

- **Decision**: CSS keyframes for the glitch and CRT; `requestAnimationFrame` loops for the typewriter
  and matrix rain. No animation library on the terminal route. The matrix-rain module is loaded with a
  dynamic `import()` the first time the idle timer fires, so it is never in the initial bundle.
- **Rationale**: Principle VII (no heavy libraries on the critical path); planning note.

### R12. Boot sequence

- **Decision**: The boot lines are a shared `bootSequence(): SequenceStep[]` in
  `packages/shared/src/motion/boot.ts` (structured output, so the SSH host can reuse it later). The web
  host plays it with the existing `SequencePlayer`, total ≤ 3 s, before the welcome. It plays only
  when: the address is the plain `/` (no deep link), `localStorage['boot:v1']` is not set, and
  reduced motion is off. The flag is written when the boot starts (so a reload mid-boot does not
  replay it). If storage throws, an in-memory flag prevents a repeat within the page.
- **Input during boot**: the command input is mounted and focused from the start. Any `keydown`,
  `pointerdown` or `touchstart` skips the boot; the key is **not** prevented, so it lands in the input.
  A Playwright test types `about` immediately on load and expects `about` in the input (planning note:
  "no dropped input during boot").
- **Rationale**: FR-011, Principle VII (boot never blocks input).

### R13. Typewriter inside the DOM renderer

- **Decision**: `OutputRenderer` gets a `reveal` mode. A `useTypewriter` hook counts the visible
  characters of the rendered output (flattened text per block) and advances a character budget each
  animation frame so the whole output finishes in ≤ 1.5 s (rate = total chars / 1.5 s, minimum
  ~60 chars/s). Applies only when the output is ≤ 40 lines (counted with the shared output-to-lines
  conversion), not piped, not an assistant answer, not a sequence frame, and reduced motion is off.
  Any keydown or a new command completes it instantly (key not prevented).
- **Screen readers**: the complete output is rendered once from the start in the normal tree
  (visually hidden while typing), so the `aria-live` log announces it once; the animating copy is a
  separate `aria-hidden` layer. When typing ends the hidden class is removed from the same node, so no
  second announced copy is ever mounted.
- **Rationale**: FR-012 and the clarification (≤ 40 lines); Principle VI.
- **Alternatives rejected**: CSS `steps()` width animation (does not work for multi-line, styled,
  wrapped output); a per-character `setTimeout` (janky, many timers).

### R14. Glitch banner

- **Decision**: The welcome banner (`.ascii-banner`) gets a one-shot `glitch-reveal` keyframe
  animation (~600 ms): two pseudo-element copies offset with `clip-path` slices and colour shifts,
  then settle. Pattern taken from the 21st glitch components as reference only and written as plain
  CSS. Any key press or tap settles it at once (Constitution VI: every animation skippable).
  Disabled in `@media (prefers-reduced-motion: reduce)`.
- **Rationale**: FR-013; planning note ("reference only, port to plain CSS").

### R15. CRT theme

- **Decision**: Add `crt` to `themes` with a new optional `Theme.effects?: { crt?: boolean }` field.
  The web host sets `data-effect="crt"` on the terminal container. CSS: `::before` overlay with a
  `repeating-linear-gradient` scanline pattern, `::after` radial vignette, `text-shadow` phosphor glow
  on text, and an inline SVG `<filter id="crt-barrel">` (`feDisplacementMap` from a radial gradient
  map) applied with `filter: url(#crt-barrel)` on wide screens only (`min-width: 768px`), because
  SVG filters on large scrolling text can drop frames on phones. No flicker animation at all, so
  reduced motion needs no change beyond keeping it static. Overlays are `pointer-events: none` and
  `aria-hidden`. curl ignores themes, so no ANSI work.
- **Risk**: Safari renders `filter: url()` on HTML with lower quality; if text is blurred in testing,
  fall back to a `border-radius` + vignette "curvature" on Safari. Recorded as a task check.
- **Rationale**: FR-014; planning note.

### R16. Matrix-rain screensaver

- **Decision**: `components/Screensaver.tsx`, a full-terminal `<canvas>` overlay (`aria-hidden`)
  drawing katakana/digit columns in the current theme's primary colour with a `requestAnimationFrame`
  loop at ≤ 30 fps. An idle timer (`useIdle(60_000)`) resets on `keydown`, `pointermove`, `pointerdown`,
  `wheel`, `scroll` and `touchstart`. It does not start while an assistant answer streams, a sequence
  plays, the tab is hidden, or reduced motion is on. On `visibilitychange` to hidden the loop stops.
- **Dismissal input rule**: the event that dismisses it is not prevented, so typed characters reach
  the input; **Enter** is the exception — it only dismisses (prevented), so a half-typed command is
  never run by accident. This is the concrete meaning of "not lost or misapplied" in FR-015.
- **Rationale**: FR-015, SC-006 (dismiss within 100 ms: removal is a state change on the first event).

### R17. Skill bars from GitHub evidence

- **Decision**: A pure function `skillEvidence(snapshot, skills)` in
  `packages/shared/src/inventory/skills.ts` maps each skill string to a repo count using the existing
  `lookupTech` (alias-aware). Skill strings are normalised first: strip qualifiers in parentheses
  ("Python (Advanced)" → "Python") but also try the parenthetical when it looks like an acronym
  ("Retrieval-Augmented Generation (RAG)" → "RAG"); take the larger count. The `skills` command takes
  an optional injected `ctx.skillEvidence()`; when present it renders one `progress` node per skill,
  scaled to the most-used skill, with a `note` like `4 repos` or `no public repos`. When absent or
  failing it renders the plain list (FR-016a).
- **Wiring**: web gets counts from `GET /api/skills` (computed on the server from the cached inventory,
  `Cache-Control: s-maxage=3600`), curl injects the server function directly.
- **Output type change**: `ProgressOutput` gains optional `note?: string` (shown instead of the
  percentage) and `reveal?: boolean` (renderers may animate the fill). Only `skills` sets `reveal`, so
  the `sudo hire-me` sequence frames do not re-animate. ANSI and lines conversion render the final
  bar with the note.
- **Rationale**: The clarification chose GitHub evidence; Principle IV (honest claims) is served by
  showing the count, not a proficiency score.

### R18. SSH motion (deferred)

- **Decision**: The planning note's "Ink: spinner + typewriter hook; no matrix rain" is recorded for
  the SSH spec. `bootSequence()` and the ≤ 40-line rule live in `packages/shared` so the Ink host can
  reuse them with a `useTypewriter` Ink hook and a spinner. Nothing is built for SSH now because
  `apps/ssh` does not exist (SSH deferred in spec 004 for cost).

---

## US3 — Presence and guestbook

### R19. Presence counting

- **Decision**: One Redis sorted set per surface, `presence:web` (later `presence:ssh`), member =
  random per-tab session id (from `crypto.randomUUID()`, kept in `sessionStorage`), score = last
  heartbeat time in ms. Heartbeat `POST /api/presence` every 30 s while the tab is visible (terminal
  and `/gui`), plus once on `visibilitychange` to visible. Each heartbeat runs one pipeline:
  `ZADD`, `ZREMRANGEBYSCORE (-inf, now-60s)`, `ZCARD`, and an `EVAL` that raises the daily peak
  (`HSET surface:stats:<date> presence_peak` only when larger). `who` reads with
  `ZREMRANGEBYSCORE` + `ZCARD` (no write of its own presence). A visitor counts as present for 60 s
  after their last heartbeat, which meets the spec's "about 2 minutes" and SC-007.
- **Deviation from the note**: the note says "presence keys with a 60s TTL". Separate keys would need
  a `SCAN` to count, which is slow and costs many Upstash commands. A sorted set with a 60 s window
  gives the same semantics with three commands per heartbeat.
- **Cost check**: 30 s heartbeats pause when the tab is hidden. 100 visitors × 10 visible minutes/day ≈
  2,000 heartbeats × 4 commands ≈ 8,000 commands/day, well inside Upstash's free tier and Vercel's
  free function invocations (SC-009).
- **Abuse**: heartbeats are rate-limited (60/min per IP so an office network with many visitors is not under-counted; fail open — a lost heartbeat only lowers a
  count), session ids are validated as UUIDs, and the set is trimmed on every write, so a flood can
  inflate the count for at most 60 s.
- **Privacy**: no IP or user agent is stored; the session id is random and dies with the tab (FR-021).

### R20. Guestbook storage

- **Decision**: Redis list `guestbook:v1`, newest first. Sign: `LPUSH` JSON entry then `LTRIM 0 199`
  (keeps 200, FR and spec assumption updated). Read: `LRANGE 0 19` for the newest 20 (FR-022),
  served from `GET /api/guestbook` with `Cache-Control: no-store` and a 15 s in-memory memo on the
  server for curl. Delete: `LRANGE 0 199`, find the entry by id, `LREM 1 <exact JSON>`.
- **Rationale**: Matches the note; a list of ≤ 200 small JSON strings is trivially cheap.
- **Alternatives rejected**: a hash + sorted set (more commands for no benefit at this size).

### R21. Validation and filtering

- **Decision**: A pure `validateGuestbookEntry({ name, message })` in
  `packages/shared/src/guestbook/validate.ts`: trim and NFKC-normalise; strip all C0/C1 control
  characters and bidi overrides (newlines and tabs become single spaces); name 1–24 chars, message 1–140 chars
  (counted in Unicode code points). Reject when either contains: a URL or bare domain
  (`\b[\w-]+\.(com|net|org|io|dev|me|ai|co|xyz|…)\b`, `http`, `www.`), an email address, a phone-like
  run of ≥ 7 digits (ignoring spaces, dashes, parentheses), or a blocklisted word. The blocklist is a
  small word list in `packages/shared/src/guestbook/blocklist.ts`, matched on a "skeleton" (lowercase,
  diacritics removed, common leetspeak `0→o 1→i 3→e 4→a 5→s 7→t @→a $→s`, repeated letters
  collapsed) at word boundaries to limit false positives. Returns a reason code: `too_long`,
  `empty`, `blocked`, `link`, `contact`.
- **Rationale**: FR-023, FR-024; pure function is unit-testable and shared by web, curl and later SSH.
- **Rendering**: entries render as React text (escaped) and in ANSI after control-character stripping
  at write time, so nothing a visitor types can style the terminal.

### R22. Rate limits

- **Decision**: In `POST /api/guestbook`, after validation and the human check: (1) per visitor
  `Ratelimit.fixedWindow(1, '1 d')`, prefix `rl:guestbook`, identifier = SHA-256 of the
  `resolveVisitorIp()` address with a server salt; (2) site-wide `fixedWindow(200, '1 d')` with the
  constant identifier `all`. Any limiter error refuses the signature (fail closed, FR-025). Rejected
  validation never consumes the limit. The heartbeat and `GET` routes are rate-limited separately
  (fail open).
- **Note**: the planning note sets 1 signature per IP per day (the spec said 3); the spec was updated to
  match the note.

### R23. Human check

- **Decision**: Cloudflare Turnstile (free) in invisible/managed mode. The widget script is loaded
  lazily only when a visitor starts signing (`sign` command on the web, or focusing the GUI form), so
  it is never on the critical path. The client sends the token with the entry; the route verifies it
  with `siteverify` (secret `TURNSTILE_SECRET_KEY`, 3 s timeout) before touching the rate limiter.
  When the secret is unset: refuse in production; in development allow with a console warning so the
  flow can be tested without keys. Public site key: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
- **Rationale**: Clarification Q3; free tier keeps SC-009.
- **SSH (later)**: Turnstile needs a browser, so SSH signing will need its own rule in the SSH spec.

### R24. Owner deletion

- **Decision**: `DELETE /api/guestbook/<id>` with `Authorization: Bearer <ADMIN_TOKEN>`, compared in
  constant time (hash then `timingSafeEqual`, same pattern as `identity.ts`). Returns 404 when
  `ADMIN_TOKEN` is unset (endpoint invisible), 401 on a bad token, rate-limited 10/min per IP.
- **Rationale**: Planning note; Principle V (admin actions need a server-side token).

### R25. Command surface and service injection

- **Decision**: New commands `who`, `guestbook`, `sign "<message>" --name <name>`. They get their data
  through an injected `ctx.live?: LiveServices` (same pattern as `ctx.github`): the web host
  implements it with `fetch` to the new routes, the curl route implements it with direct server calls.
  `sign` declares `surfaces: ['web']`; over curl it prints "sign the guestbook in the web terminal:
  <origin>". `who` and `guestbook` work on web and curl. `who` and `guestbook` are read-only and marked
  `assistant: true`; `sign` is not.
- **sign on the web**: the command returns a new effect `sign: { name, message }` after validating
  locally; the host runs the Turnstile check, posts, and appends the result (thank-you or the reason)
  to the log, like the `ask` effect does for the assistant. Validation reasons use the same messages on
  the server and the client.
- **Rationale**: Principle II (engine stays render-agnostic; hosts own I/O).

### R26. Usage report

- **Decision**: Extend `SurfaceEventKind` with `gui_visits`, `guestbook_signed`, `guestbook_rejected`,
  and store `presence_peak` in the same daily hash. `gui_visits` is counted in middleware for real
  document navigations to `/gui` and for client navigations (RSC requests to `/gui` that are not
  prefetches). `readSurfaceStats` returns the new fields; `/api/chat-stats` shows them under
  `surfaces.daily` (FR-028).

---

## Environment variables added

| Variable | Where | Purpose |
|---|---|---|
| `ADMIN_TOKEN` | Vercel | Bearer token for guestbook deletion (route 404s when unset) |
| `TURNSTILE_SECRET_KEY` | Vercel | Server-side human-check verification |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Vercel | Client widget key (public by design) |
| `GUESTBOOK_SALT` | Vercel | Salt for hashing visitor addresses in the rate-limit key |

## New dependencies

| Package | Workspace | Why | On terminal critical path? |
|---|---|---|---|
| `tailwindcss`, `@tailwindcss/postcss` | apps/web (dev) | GUI styling (R2) | No — imported only under `/gui` |
| `motion` | apps/web | GUI entrance animation (R8) | No — `/gui` only |
| `@axe-core/playwright` | root (dev) | Accessibility checks (R9) | No |

No new service, host or datastore: Upstash Redis already holds presence and guestbook by
constitution; Turnstile is a free verification API with no account cost (Principle III note in
plan.md Complexity Tracking).
